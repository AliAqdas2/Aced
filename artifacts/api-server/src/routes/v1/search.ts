import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  listingsTable,
  storefrontsTable,
  creatorProfilesTable,
  profilesTable,
  universitiesTable,
  priceRecordsTable,
} from "@workspace/db";
import { eq, and, ilike, or, desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/v1/marketplace/search
router.get("/marketplace/search", async (req, res): Promise<void> => {
  const q = ((req.query["q"] as string) ?? "").trim();
  const type = req.query["type"] as string | undefined;
  const universityId = req.query["universityId"] as string | undefined;
  const courseId = req.query["courseId"] as string | undefined;
  const minPrice = req.query["minPrice"] ? Number(req.query["minPrice"]) : undefined;
  const maxPrice = req.query["maxPrice"] ? Number(req.query["maxPrice"]) : undefined;
  const minRating = req.query["minRating"] ? Number(req.query["minRating"]) : undefined;
  const sort = (req.query["sort"] as string) ?? "recommended";
  const limit = Math.min(Number(req.query["limit"] ?? 20), 50);

  // Build conditions
  const conditions: any[] = [eq(listingsTable.status, "published")];

  if (q) {
    const pattern = `%${q}%`;

    // Match tutors by profile display name or storefront name/slug
    const [byProfile, byStorefront] = await Promise.all([
      db
        .select({ id: creatorProfilesTable.id })
        .from(creatorProfilesTable)
        .innerJoin(profilesTable, eq(profilesTable.userId, creatorProfilesTable.userId))
        .where(ilike(profilesTable.displayName, pattern)),
      db
        .select({ id: creatorProfilesTable.id })
        .from(creatorProfilesTable)
        .innerJoin(storefrontsTable, eq(storefrontsTable.creatorId, creatorProfilesTable.id))
        .where(
          or(
            ilike(storefrontsTable.displayName, pattern),
            ilike(storefrontsTable.slug, pattern)
          )
        ),
    ]);

    const matchingCreatorIds = [
      ...new Set([...byProfile, ...byStorefront].map((r) => r.id)),
    ];

    const textMatch = or(
      ilike(listingsTable.title, pattern),
      ilike(listingsTable.description, pattern),
      ...(matchingCreatorIds.length > 0
        ? [inArray(listingsTable.creatorId, matchingCreatorIds)]
        : [])
    );

    if (textMatch) {
      conditions.push(textMatch);
    }
  }

  if (type) {
    conditions.push(eq(listingsTable.type, type as any));
  }

  if (universityId) {
    conditions.push(eq(listingsTable.primaryUniversityId, universityId));
  }

  if (courseId) {
    conditions.push(eq(listingsTable.primaryCourseId, courseId));
  }

  const listings = await db
    .select()
    .from(listingsTable)
    .where(and(...conditions))
    .limit(limit + 1);

  // Attach prices and filter by price range
  const listingsWithPrices = await Promise.all(
    listings.map(async (l) => {
      const [price] = await db
        .select()
        .from(priceRecordsTable)
        .where(and(eq(priceRecordsTable.listingId, l.id), eq(priceRecordsTable.isActive, true)))
        .limit(1);
      return { ...l, activePrice: price ?? null };
    })
  );

  let filtered = listingsWithPrices;

  if (minPrice !== undefined) {
    filtered = filtered.filter(
      (l) => l.activePrice && l.activePrice.amountMinorUnits >= minPrice
    );
  }
  if (maxPrice !== undefined) {
    filtered = filtered.filter(
      (l) => l.activePrice && l.activePrice.amountMinorUnits <= maxPrice
    );
  }
  if (minRating !== undefined) {
    filtered = filtered.filter(
      (l) => l.averageRating && l.averageRating / 10 >= minRating
    );
  }

  // Sort
  if (sort === "price_asc") {
    filtered.sort(
      (a, b) => (a.activePrice?.amountMinorUnits ?? 0) - (b.activePrice?.amountMinorUnits ?? 0)
    );
  } else if (sort === "price_desc") {
    filtered.sort(
      (a, b) => (b.activePrice?.amountMinorUnits ?? 0) - (a.activePrice?.amountMinorUnits ?? 0)
    );
  } else if (sort === "rating") {
    filtered.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
  } else if (sort === "newest") {
    filtered.sort(
      (a, b) =>
        new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
    );
  } else if (sort === "most_booked") {
    filtered.sort((a, b) => b.purchaseCount - a.purchaseCount);
  }

  const hasMore = filtered.length > limit;
  const results = filtered.slice(0, limit);

  // Attach creator info
  const resultsWithCreators = await Promise.all(
    results.map(async (l) => {
      const [cp] = await db
        .select()
        .from(creatorProfilesTable)
        .where(eq(creatorProfilesTable.id, l.creatorId))
        .limit(1);

      const [profile] = cp
        ? await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.userId, cp.userId))
            .limit(1)
        : [null];

      const [storefront] = await db
        .select({ slug: storefrontsTable.slug })
        .from(storefrontsTable)
        .where(eq(storefrontsTable.creatorId, l.creatorId))
        .limit(1);

      return {
        ...l,
        creator: {
          id: cp?.id,
          completedSessions: cp?.completedSessions,
          averageRating: cp?.averageRating,
          reviewCount: cp?.reviewCount,
          displayName: profile?.displayName,
          avatarUrl: profile?.avatarUrl,
          storefrontSlug: storefront?.slug,
        },
      };
    })
  );

  res.json({
    data: resultsWithCreators,
    meta: {
      hasMore,
      count: resultsWithCreators.length,
    },
  });
});

// GET /api/v1/marketplace/featured — curated landing page content
router.get("/marketplace/featured", async (_req, res): Promise<void> => {
  const universities = await db
    .select()
    .from(universitiesTable)
    .where(eq(universitiesTable.status, "active"))
    .orderBy(universitiesTable.name)
    .limit(10);

  const recentListings = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.status, "published"))
    .orderBy(desc(listingsTable.publishedAt))
    .limit(8);

  res.json({
    data: {
      universities,
      recentListings,
    },
  });
});

export default router;
