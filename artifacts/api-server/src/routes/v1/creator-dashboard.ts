import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  creatorProfilesTable,
  listingsTable,
  bookingsTable,
  ordersTable,
  orderItemsTable,
  ledgerEntriesTable,
  reviewsTable,
} from "@workspace/db";
import { eq, and, desc, sum, count, gte } from "drizzle-orm";
import { requireRole } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/v1/creator/dashboard — creator KPIs and actions needed
router.get(
  "/creator/dashboard",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Active listings
    const listings = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.creatorId, cp.id), eq(listingsTable.status, "published")));

    // Upcoming bookings
    const upcomingBookings = await db
      .select()
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.creatorId, cp.id),
          gte(bookingsTable.scheduledStartAt, new Date())
        )
      )
      .orderBy(bookingsTable.scheduledStartAt)
      .limit(5);

    // Recent earnings (last 30 days)
    const recentEarnings = await db
      .select({ total: sum(ledgerEntriesTable.amountMinorUnits) })
      .from(ledgerEntriesTable)
      .innerJoin(orderItemsTable, eq(ledgerEntriesTable.orderItemId, orderItemsTable.id))
      .where(
        and(
          eq(orderItemsTable.creatorIdSnapshot, cp.id),
          eq(ledgerEntriesTable.entryType, "creator_proceeds"),
          gte(ledgerEntriesTable.createdAt, thirtyDaysAgo)
        )
      );

    // Total earnings (all time)
    const totalEarnings = await db
      .select({ total: sum(ledgerEntriesTable.amountMinorUnits) })
      .from(ledgerEntriesTable)
      .innerJoin(orderItemsTable, eq(ledgerEntriesTable.orderItemId, orderItemsTable.id))
      .where(
        and(
          eq(orderItemsTable.creatorIdSnapshot, cp.id),
          eq(ledgerEntriesTable.entryType, "creator_proceeds")
        )
      );

    // Recent reviews
    const recentReviews = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.creatorId, cp.id), eq(reviewsTable.status, "published")))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(3);

    // Pending review: bookings completed but no review yet (simple check)
    const pendingItems = [];
    if (cp.status !== "approved") {
      pendingItems.push({ type: "verification_pending", message: "Complete account verification" });
    }
    if (cp.stripeAccountStatus !== "active") {
      pendingItems.push({ type: "stripe_onboarding", message: "Set up payouts" });
    }

    res.json({
      data: {
        profile: cp,
        stats: {
          publishedListings: listings.length,
          completedSessions: cp.completedSessions,
          totalSales: cp.totalSales,
          averageRating: cp.averageRating ? cp.averageRating / 10 : null,
          reviewCount: cp.reviewCount,
          recentEarningsMinorUnits: Number(recentEarnings[0]?.total ?? 0),
          totalEarningsMinorUnits: Number(totalEarnings[0]?.total ?? 0),
        },
        upcomingBookings,
        recentReviews,
        pendingItems,
      },
    });
  }
);

// GET /api/v1/creator/earnings — earnings ledger
router.get(
  "/creator/earnings",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const entries = await db
      .select()
      .from(ledgerEntriesTable)
      .innerJoin(orderItemsTable, eq(ledgerEntriesTable.orderItemId, orderItemsTable.id))
      .where(eq(orderItemsTable.creatorIdSnapshot, cp.id))
      .orderBy(desc(ledgerEntriesTable.createdAt))
      .limit(50);

    res.json({ data: entries });
  }
);

// GET /api/v1/creator/orders — creator's order history (sales)
router.get(
  "/creator/orders",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const items = await db
      .select()
      .from(orderItemsTable)
      .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
      .where(eq(orderItemsTable.creatorIdSnapshot, cp.id))
      .orderBy(desc(ordersTable.createdAt))
      .limit(50);

    res.json({ data: items });
  }
);

export default router;
