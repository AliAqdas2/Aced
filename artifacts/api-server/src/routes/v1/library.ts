import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  entitlementsTable,
  listingsTable,
  productsTable,
  assetsTable,
  bookingsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { generateDownloadUrl } from "../../lib/storage";

const router: IRouter = Router();

// GET /api/v1/me/library — buyer's entitlements
router.get("/me/library", requireAuth, async (req, res): Promise<void> => {
  const entitlements = await db
    .select()
    .from(entitlementsTable)
    .where(
      and(
        eq(entitlementsTable.userId, req.session.userId!),
        eq(entitlementsTable.status, "active")
      )
    )
    .orderBy(desc(entitlementsTable.createdAt));

  const withListings = await Promise.all(
    entitlements.map(async (e) => {
      const [listing] = await db
        .select()
        .from(listingsTable)
        .where(eq(listingsTable.id, e.listingId))
        .limit(1);

      let product = null;
      if (listing?.type === "digital_product") {
        const [p] = await db
          .select()
          .from(productsTable)
          .where(eq(productsTable.listingId, listing.id))
          .limit(1);
        product = p ?? null;
      }

      return { ...e, listing, product };
    })
  );

  res.json({ data: withListings });
});

// POST /api/v1/assets/:id/download-url — issue short-lived signed URL
router.post("/assets/:id/download-url", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.session.userId!;

  // Find the asset
  const [asset] = await db
    .select()
    .from(assetsTable)
    .where(eq(assetsTable.id, id))
    .limit(1);

  if (!asset) {
    res.status(404).json({ error: "Asset not found" });
    return;
  }

  if (asset.scanStatus !== "clean") {
    res.status(403).json({ error: "Asset not available", code: "SCAN_PENDING" });
    return;
  }

  // Authorization strategy (most-to-least specific):
  // 1. Direct asset entitlement: user has an entitlement row with assetId = this asset.
  // 2. Listing-level entitlement: find the listingId associated with this asset by looking
  //    at any existing entitlement row that references this assetId, then verify the requesting
  //    user has an active entitlement for that same listing.
  //    (assetsTable has no direct listingId FK — the link is via entitlements.)
  // Never grant access based on unrelated listings.

  const [directEntitlement] = await db
    .select()
    .from(entitlementsTable)
    .where(
      and(
        eq(entitlementsTable.userId, userId),
        eq(entitlementsTable.assetId, id),
        eq(entitlementsTable.status, "active")
      )
    )
    .limit(1);

  let entitlement = directEntitlement ?? null;

  if (!entitlement) {
    // Discover the listingId for this asset from any existing entitlement
    const [assetLink] = await db
      .select({ listingId: entitlementsTable.listingId })
      .from(entitlementsTable)
      .where(eq(entitlementsTable.assetId, id))
      .limit(1);

    if (assetLink) {
      // Check if the requesting user has a listing-level entitlement for the same listing
      const [listingEnt] = await db
        .select()
        .from(entitlementsTable)
        .where(
          and(
            eq(entitlementsTable.userId, userId),
            eq(entitlementsTable.listingId, assetLink.listingId),
            eq(entitlementsTable.status, "active")
          )
        )
        .limit(1);
      entitlement = listingEnt ?? null;
    }
  }

  if (!entitlement) {
    res.status(403).json({ error: "Access denied", code: "NO_ENTITLEMENT" });
    return;
  }

  // Enforce download limit on private assets
  if (asset.isPrivate) {
    await db
      .update(entitlementsTable)
      .set({
        accessCount: (entitlement.accessCount ?? 0) + 1,
        lastAccessAt: new Date(),
      })
      .where(eq(entitlementsTable.id, entitlement.id));
  }

  const url = await generateDownloadUrl(asset.storageKey);
  res.json({ data: { url, expiresInSeconds: 3600, fileName: asset.fileName } });
});

// GET /api/v1/me/bookings — learner bookings
router.get("/me/bookings", requireAuth, async (req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.learnerId, req.session.userId!))
    .orderBy(desc(bookingsTable.scheduledStartAt));

  res.json({ data: bookings });
});

// GET /api/v1/creator/bookings — creator's bookings
router.get(
  "/creator/bookings",
  async (req, res): Promise<void> => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { creatorProfilesTable } = await import("@workspace/db");
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.creatorId, cp.id))
      .orderBy(desc(bookingsTable.scheduledStartAt));

    res.json({ data: bookings });
  }
);

// POST /api/v1/bookings/:id/complete — mark booking complete
router.post("/bookings/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, id))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  // Only creator can complete
  const { creatorProfilesTable } = await import("@workspace/db");
  const [cp] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.userId, req.session.userId!))
    .limit(1);

  if (!cp || cp.id !== booking.creatorId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(bookingsTable.id, id))
    .returning();

  // Increment completed sessions count
  await db
    .update(creatorProfilesTable)
    .set({ completedSessions: cp.completedSessions + 1 })
    .where(eq(creatorProfilesTable.id, cp.id));

  res.json({ data: updated });
});

// POST /api/v1/bookings/:id/cancel — cancel booking
router.post("/bookings/:id/cancel", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const Body = z.object({ reason: z.string().min(5).max(500) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, id))
    .limit(1);

  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }

  const userId = req.session.userId!;
  const isLearner = booking.learnerId === userId;
  const { creatorProfilesTable } = await import("@workspace/db");
  const [cp] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.userId, userId))
    .limit(1);
  const isCreator = cp?.id === booking.creatorId;

  if (!isLearner && !isCreator) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db
    .update(bookingsTable)
    .set({ status: "cancelled", cancellationReason: parsed.data.reason })
    .where(eq(bookingsTable.id, id))
    .returning();

  res.json({ data: updated });
});

export default router;
