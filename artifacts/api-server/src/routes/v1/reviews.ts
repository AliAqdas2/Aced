import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  reviewsTable,
  orderItemsTable,
  ordersTable,
  creatorProfilesTable,
  listingsTable,
} from "@workspace/db";
import { eq, and, avg, count, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";

const router: IRouter = Router();

// POST /api/v1/reviews — submit a verified review
router.post("/reviews", requireAuth, async (req, res): Promise<void> => {
  const Body = z.object({
    orderItemId: z.string().uuid(),
    overallRating: z.number().int().min(1).max(5),
    knowledgeRating: z.number().int().min(1).max(5).optional(),
    communicationRating: z.number().int().min(1).max(5).optional(),
    usefulnessRating: z.number().int().min(1).max(5).optional(),
    body: z.string().max(2000).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const reviewerId = req.session.userId!;

  // Verify the reviewer actually purchased this item
  const [orderItem] = await db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.id, parsed.data.orderItemId))
    .limit(1);

  if (!orderItem) {
    res.status(404).json({ error: "Order item not found" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, orderItem.orderId), eq(ordersTable.buyerId, reviewerId)))
    .limit(1);

  if (!order || order.status !== "paid") {
    res.status(403).json({ error: "Only verified purchasers can review", code: "NOT_PURCHASER" });
    return;
  }

  // Check for existing review
  const [existing] = await db
    .select()
    .from(reviewsTable)
    .where(eq(reviewsTable.orderItemId, parsed.data.orderItemId))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Review already submitted", code: "ALREADY_REVIEWED" });
    return;
  }

  const [review] = await db
    .insert(reviewsTable)
    .values({
      orderItemId: parsed.data.orderItemId,
      reviewerId,
      creatorId: orderItem.creatorIdSnapshot,
      listingId: orderItem.listingId,
      overallRating: parsed.data.overallRating,
      knowledgeRating: parsed.data.knowledgeRating ?? null,
      communicationRating: parsed.data.communicationRating ?? null,
      usefulnessRating: parsed.data.usefulnessRating ?? null,
      body: parsed.data.body ?? null,
      status: "published",
    })
    .returning();

  // Update creator average rating
  const ratingStats = await db
    .select({
      avg: avg(reviewsTable.overallRating),
      count: count(),
    })
    .from(reviewsTable)
    .where(
      and(
        eq(reviewsTable.creatorId, orderItem.creatorIdSnapshot),
        eq(reviewsTable.status, "published")
      )
    );

  if (ratingStats[0]) {
    const avgRating = Math.round(Number(ratingStats[0].avg) * 10); // store as tenths
    await db
      .update(creatorProfilesTable)
      .set({
        averageRating: avgRating,
        reviewCount: Number(ratingStats[0].count),
      })
      .where(eq(creatorProfilesTable.id, orderItem.creatorIdSnapshot));
  }

  res.status(201).json({ data: review });
});

// POST /api/v1/creator/reviews/:id/respond
router.post(
  "/creator/reviews/:id/respond",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({ response: z.string().min(10).max(2000) });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const [review] = await db
      .select()
      .from(reviewsTable)
      .where(and(eq(reviewsTable.id, id), eq(reviewsTable.creatorId, cp.id)))
      .limit(1);

    if (!review) {
      res.status(404).json({ error: "Review not found or access denied" });
      return;
    }

    const [updated] = await db
      .update(reviewsTable)
      .set({
        creatorResponse: parsed.data.response,
        creatorRespondedAt: new Date(),
      })
      .where(eq(reviewsTable.id, id))
      .returning();

    res.json({ data: updated });
  }
);

// Admin: GET /api/v1/admin/reviews — moderation queue
router.get(
  "/admin/reviews",
  requireRole("moderator"),
  async (req, res): Promise<void> => {
    const status = (req.query["status"] as string) ?? "flagged";
    const reviews = await db
      .select()
      .from(reviewsTable)
      .where(eq(reviewsTable.status, status as any))
      .orderBy(reviewsTable.createdAt)
      .limit(50);

    res.json({ data: reviews });
  }
);

// Admin: POST /api/v1/admin/reviews/:id/moderate
router.post(
  "/admin/reviews/:id/moderate",
  requireRole("moderator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({ status: z.enum(["published", "removed"]) });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [updated] = await db
      .update(reviewsTable)
      .set({
        status: parsed.data.status,
        moderatedBy: req.session.userId,
        moderatedAt: new Date(),
      })
      .where(eq(reviewsTable.id, id))
      .returning();

    res.json({ data: updated });
  }
);

export default router;
