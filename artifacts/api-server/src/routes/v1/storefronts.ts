import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  storefrontsTable,
  creatorProfilesTable,
  listingsTable,
  reviewsTable,
  creatorExpertiseTable,
  universitiesTable,
  coursesTable,
  profilesTable,
  usersTable,
  priceRecordsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireRole } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/v1/storefronts/:slug — public storefront
router.get("/storefronts/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [storefront] = await db
    .select()
    .from(storefrontsTable)
    .where(and(eq(storefrontsTable.slug, slug), eq(storefrontsTable.isPublished, true)))
    .limit(1);

  if (!storefront) {
    res.status(404).json({ error: "Storefront not found" });
    return;
  }

  const [cp] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.id, storefront.creatorId))
    .limit(1);

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, cp.userId))
    .limit(1);

  const listings = await db
    .select()
    .from(listingsTable)
    .where(
      and(
        eq(listingsTable.creatorId, storefront.creatorId),
        eq(listingsTable.status, "published")
      )
    )
    .orderBy(desc(listingsTable.publishedAt))
    .limit(20);

  // Attach active prices
  const listingsWithPrices = await Promise.all(
    listings.map(async (listing) => {
      const [price] = await db
        .select()
        .from(priceRecordsTable)
        .where(
          and(eq(priceRecordsTable.listingId, listing.id), eq(priceRecordsTable.isActive, true))
        )
        .limit(1);
      return { ...listing, activePrice: price ?? null };
    })
  );

  const expertise = await db
    .select()
    .from(creatorExpertiseTable)
    .where(eq(creatorExpertiseTable.creatorId, cp.id));

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.creatorId, cp.id), eq(reviewsTable.status, "published")))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(10);

  res.json({
    data: {
      storefront,
      creator: {
        ...cp,
        profile,
        expertise,
      },
      listings: listingsWithPrices,
      reviews,
    },
  });
});

// GET /api/v1/creator/storefront — creator's own storefront
router.get(
  "/creator/storefront",
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

    const [storefront] = await db
      .select()
      .from(storefrontsTable)
      .where(eq(storefrontsTable.creatorId, cp.id))
      .limit(1);

    res.json({ data: storefront ?? null });
  }
);

// PATCH /api/v1/creator/storefront — update storefront
router.patch(
  "/creator/storefront",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      displayName: z.string().min(2).max(80).optional(),
      slug: z.string().min(3).max(60).optional(),
      bio: z.string().max(2000).optional(),
      coverImageUrl: z.string().min(1).optional().nullable(),
      introVideoUrl: z.string().url().optional().nullable(),
      policies: z.string().max(5000).optional().nullable(),
      faqJson: z.any().optional(),
      seoTitle: z.string().max(70).optional().nullable(),
      seoDescription: z.string().max(160).optional().nullable(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
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

    const [storefront] = await db
      .select()
      .from(storefrontsTable)
      .where(eq(storefrontsTable.creatorId, cp.id))
      .limit(1);

    if (!storefront) {
      res.status(404).json({ error: "Storefront not found" });
      return;
    }

    const [updated] = await db
      .update(storefrontsTable)
      .set(parsed.data)
      .where(eq(storefrontsTable.id, storefront.id))
      .returning();

    res.json({ data: updated });
  }
);

// POST /api/v1/creator/storefront/publish — toggle publish
router.post(
  "/creator/storefront/publish",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const Body = z.object({ published: z.boolean() });
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

    const [updated] = await db
      .update(storefrontsTable)
      .set({
        isPublished: parsed.data.published,
        publishedAt: parsed.data.published ? new Date() : null,
      })
      .where(eq(storefrontsTable.creatorId, cp.id))
      .returning();

    res.json({ data: updated });
  }
);

export default router;
