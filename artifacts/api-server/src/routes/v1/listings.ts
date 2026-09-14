import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  listingsTable,
  serviceOffersTable,
  productsTable,
  priceRecordsTable,
  storefrontsTable,
  creatorProfilesTable,
  reviewsTable,
  subscriptionPlansTable,
  learnerSubscriptionsTable,
  assetsTable,
} from "@workspace/db";
import { generateUploadUrl } from "../../lib/storage";
import { eq, and, desc, inArray } from "drizzle-orm";
import { requireRole } from "../../middlewares/auth";
import { logAuditEvent } from "../../lib/auth";

const router: IRouter = Router();

const CreateListingBody = z.object({
  type: z.enum(["service_offer", "digital_product", "recorded_course", "group_session"]),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  tags: z.array(z.string()).default([]),
  primaryUniversityId: z.string().uuid().optional(),
  primaryCourseId: z.string().uuid().optional(),
  /** Ignored for subscription listings — use subscription.amountMinorUnits instead */
  isFree: z.boolean().optional(),
  price: z
    .object({
      amountMinorUnits: z.number().int().nonnegative(),
      currency: z.string().length(3).default("GBP"),
    })
    .optional(),
  pricingMode: z.enum(["per_session", "subscription"]).default("per_session"),
  subscription: z
    .object({
      billingInterval: z.enum(["weekly", "monthly"]),
      sessionsPerPeriod: z.number().int().min(1).max(100),
      amountMinorUnits: z.number().int().positive(),
      currency: z.string().length(3).default("GBP"),
    })
    .optional(),
  serviceOffer: z
    .object({
      durationMinutes: z.number().int().positive(),
      deliveryMode: z.enum(["online", "in_person", "hybrid"]).default("online"),
      minNoticeHours: z.number().int().default(24),
      bookingHorizonDays: z.number().int().default(60),
      cancellationHoursNotice: z.number().int().default(24),
      bufferMinutesBefore: z.number().int().default(0),
      bufferMinutesAfter: z.number().int().default(0),
    })
    .optional(),
  product: z
    .object({
      licenceType: z.enum(["personal", "personal_non_commercial", "educational"]).default("personal"),
      downloadLimit: z.number().int().optional(),
      pageCount: z.number().int().optional(),
      fileFormat: z.string().optional(),
    })
    .optional(),
});

// GET /api/v1/listings/:id — public listing detail
router.get("/listings/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(and(eq(listingsTable.id, id), eq(listingsTable.status, "published")))
    .limit(1);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const [price] = await db
    .select()
    .from(priceRecordsTable)
    .where(and(eq(priceRecordsTable.listingId, id), eq(priceRecordsTable.isActive, true)))
    .limit(1);

  let offer = null;
  let product = null;

  let subscriptionPlan = null;

  if (listing.type === "service_offer") {
    const [so] = await db
      .select()
      .from(serviceOffersTable)
      .where(eq(serviceOffersTable.listingId, id))
      .limit(1);
    offer = so ?? null;

    if (offer) {
      const [sp] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.serviceOfferId, offer.id))
        .limit(1);
      subscriptionPlan = sp ?? null;
    }
  } else if (listing.type === "digital_product") {
    const [p] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.listingId, id))
      .limit(1);
    product = p ?? null;
  }

  const reviews = await db
    .select()
    .from(reviewsTable)
    .where(and(eq(reviewsTable.listingId, id), eq(reviewsTable.status, "published")))
    .orderBy(desc(reviewsTable.createdAt))
    .limit(10);

  // For authenticated learners on subscription listings, resolve their credit balance.
  let isSubscribed = false;
  let sessionsRemaining: number | null = null;
  let currentPeriodEnd: Date | null = null;
  if (subscriptionPlan && req.session?.userId) {
    const [activeSub] = await db
      .select({
        status: learnerSubscriptionsTable.status,
        sessionsRemaining: learnerSubscriptionsTable.sessionsRemaining,
        currentPeriodEnd: learnerSubscriptionsTable.currentPeriodEnd,
      })
      .from(learnerSubscriptionsTable)
      .where(
        and(
          eq(learnerSubscriptionsTable.learnerId, req.session.userId),
          eq(learnerSubscriptionsTable.listingId, id),
          eq(learnerSubscriptionsTable.status, "active")
        )
      )
      .limit(1);
    if (activeSub) {
      isSubscribed = true;
      sessionsRemaining = activeSub.sessionsRemaining;
      currentPeriodEnd = activeSub.currentPeriodEnd ?? null;
    }
  }

  // Increment view count (fire and forget)
  db.update(listingsTable)
    .set({ viewCount: listing.viewCount + 1 })
    .where(eq(listingsTable.id, id))
    .catch(() => {});

  res.json({
    data: {
      listing,
      price,
      serviceOffer: offer,
      product,
      reviews,
      subscriptionPlan,
      isSubscribed,
      sessionsRemaining,
      currentPeriodEnd,
    },
  });
});

// POST /api/v1/creator/listings
router.post(
  "/creator/listings",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const parsed = CreateListingBody.safeParse(req.body);
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
      res.status(400).json({ error: "Storefront not set up", code: "NO_STOREFRONT" });
      return;
    }

    const [listing] = await db
      .insert(listingsTable)
      .values({
        creatorId: cp.id,
        storefrontId: storefront.id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
        tags: parsed.data.tags,
        primaryUniversityId: parsed.data.primaryUniversityId ?? null,
        primaryCourseId: parsed.data.primaryCourseId ?? null,
        // Auto-submit for moderation on create — no separate Submit step
        status: "submitted",
      })
      .returning();

    // Create price record
    const isSubscription = parsed.data.pricingMode === "subscription" && parsed.data.subscription;
    const isFree = !isSubscription && (parsed.data.isFree === true || !parsed.data.price);
    await db.insert(priceRecordsTable).values({
      listingId: listing.id,
      amountMinorUnits: isSubscription
        ? parsed.data.subscription!.amountMinorUnits
        : isFree
        ? 0
        : parsed.data.price!.amountMinorUnits,
      currency: isSubscription
        ? parsed.data.subscription!.currency
        : isFree
        ? "GBP"
        : (parsed.data.price!.currency ?? "GBP"),
      isActive: true,
    });

    // Create service offer or product
    let serviceOfferId: string | null = null;
    if (parsed.data.type === "service_offer" && parsed.data.serviceOffer) {
      const [so] = await db.insert(serviceOffersTable).values({
        listingId: listing.id,
        pricingMode: parsed.data.pricingMode,
        ...parsed.data.serviceOffer,
      }).returning();
      serviceOfferId = so.id;

      // Create subscription plan if applicable
      if (isSubscription && serviceOfferId) {
        await db.insert(subscriptionPlansTable).values({
          serviceOfferId,
          billingInterval: parsed.data.subscription!.billingInterval,
          sessionsPerPeriod: parsed.data.subscription!.sessionsPerPeriod,
          amountMinorUnits: parsed.data.subscription!.amountMinorUnits,
          currency: parsed.data.subscription!.currency,
        });
      }
    } else if (parsed.data.type === "digital_product" && parsed.data.product) {
      await db.insert(productsTable).values({
        listingId: listing.id,
        ...parsed.data.product,
      });
    }

    res.status(201).json({ data: listing });
  }
);

// PATCH /api/v1/creator/listings/:id
router.patch(
  "/creator/listings/:id",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, id), eq(listingsTable.creatorId, cp.id)))
      .limit(1);

    if (!listing) {
      res.status(404).json({ error: "Listing not found or access denied" });
      return;
    }

    const UpdateBody = z.object({
      title: z.string().min(5).max(200).optional(),
      description: z.string().min(20).max(5000).optional(),
      tags: z.array(z.string()).optional(),
      primaryUniversityId: z.string().uuid().optional().nullable(),
      primaryCourseId: z.string().uuid().optional().nullable(),
    });

    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    // Saving a draft/rejected listing re-enters the moderation queue
    const shouldResubmit =
      listing.status === "draft" || listing.status === "rejected";

    const [updated] = await db
      .update(listingsTable)
      .set({
        ...parsed.data,
        ...(shouldResubmit ? { status: "submitted" as const } : {}),
      })
      .where(eq(listingsTable.id, id))
      .returning();

    res.json({ data: updated });
  }
);

// POST /api/v1/creator/listings/:id/submit
router.post(
  "/creator/listings/:id/submit",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, id), eq(listingsTable.creatorId, cp.id)))
      .limit(1);

    if (!listing) {
      res.status(404).json({ error: "Listing not found or access denied" });
      return;
    }

    const [updated] = await db
      .update(listingsTable)
      .set({ status: "submitted" })
      .where(eq(listingsTable.id, id))
      .returning();

    res.json({ data: updated });
  }
);

// POST /api/v1/creator/listings/:id/publish
router.post(
  "/creator/listings/:id/publish",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(
        and(
          eq(listingsTable.id, id),
          eq(listingsTable.creatorId, cp.id)
        )
      )
      .limit(1);

    if (!listing) {
      res.status(404).json({ error: "Listing not found or access denied" });
      return;
    }

    if (!["approved", "paused"].includes(listing.status)) {
      res.status(400).json({ error: "Listing must be approved to publish", code: "NOT_APPROVED" });
      return;
    }

    const [updated] = await db
      .update(listingsTable)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(listingsTable.id, id))
      .returning();

    res.json({ data: updated });
  }
);

// POST /api/v1/creator/listings/:id/pause — published → paused (hide from public)
router.post(
  "/creator/listings/:id/pause",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(
        and(
          eq(listingsTable.id, id),
          eq(listingsTable.creatorId, cp.id)
        )
      )
      .limit(1);

    if (!listing) {
      res.status(404).json({ error: "Listing not found or access denied" });
      return;
    }

    if (listing.status !== "published") {
      res.status(400).json({ error: "Only published listings can be paused", code: "NOT_PUBLISHED" });
      return;
    }

    const [updated] = await db
      .update(listingsTable)
      .set({ status: "paused" })
      .where(eq(listingsTable.id, id))
      .returning();

    res.json({ data: updated });
  }
);

// GET /api/v1/creator/listings
router.get(
  "/creator/listings",
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

    const listings = await db
      .select()
      .from(listingsTable)
      .where(eq(listingsTable.creatorId, cp.id))
      .orderBy(desc(listingsTable.updatedAt));

    const listingsWithPrices = await Promise.all(
      listings.map(async (l) => {
        const [price] = await db
          .select()
          .from(priceRecordsTable)
          .where(
            and(eq(priceRecordsTable.listingId, l.id), eq(priceRecordsTable.isActive, true))
          )
          .limit(1);

        // Include subscription plan info for pause/resume UI
        let subscriptionPlan = null;
        if (l.type === "service_offer") {
          const [offer] = await db
            .select()
            .from(serviceOffersTable)
            .where(eq(serviceOffersTable.listingId, l.id))
            .limit(1);
          if (offer) {
            const [sp] = await db
              .select()
              .from(subscriptionPlansTable)
              .where(eq(subscriptionPlansTable.serviceOfferId, offer.id))
              .limit(1);
            subscriptionPlan = sp ?? null;
          }
        }

        return { ...l, activePrice: price ?? null, subscriptionPlan };
      })
    );

    res.json({ data: listingsWithPrices });
  }
);

// --- Admin listing moderation ---

// GET /api/v1/admin/listings — moderation queue
// status=pending → draft + submitted; otherwise exact status match
router.get(
  "/admin/listings",
  requireRole("moderator"),
  async (req, res): Promise<void> => {
    const status = (req.query["status"] as string) ?? "pending";
    const where =
      status === "pending"
        ? inArray(listingsTable.status, ["draft", "submitted"])
        : eq(listingsTable.status, status as any);

    const listings = await db
      .select()
      .from(listingsTable)
      .where(where)
      .orderBy(listingsTable.createdAt)
      .limit(50);

    res.json({ data: listings });
  }
);

// POST /api/v1/admin/listings/:id/decision
router.post(
  "/admin/listings/:id/decision",
  requireRole("moderator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({
      decision: z.enum(["approved", "rejected"]),
      notes: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    // Approve → publish immediately so listings appear on the public showcase
    const isApproved = parsed.data.decision === "approved";
    const [updated] = await db
      .update(listingsTable)
      .set(
        isApproved
          ? {
              status: "published" as const,
              publishedAt: new Date(),
              moderationNotes: parsed.data.notes ?? null,
              moderatedBy: req.session.userId,
              moderatedAt: new Date(),
            }
          : {
              status: "rejected" as const,
              moderationNotes: parsed.data.notes ?? null,
              moderatedBy: req.session.userId,
              moderatedAt: new Date(),
            }
      )
      .where(eq(listingsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }

    await logAuditEvent({
      actorId: req.session.userId,
      actorRole: req.session.role,
      action: `listing.${parsed.data.decision}`,
      targetId: id,
      targetType: "listing",
      summary: parsed.data.notes,
    });

    res.json({ data: updated });
  }
);

// POST /api/v1/creator/listings/:id/upload-url — signed PUT URL for digital product file
router.post(
  "/creator/listings/:id/upload-url",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({
      fileName: z.string().min(1).max(260),
      mimeType: z.string().min(1).max(100),
      sizeBytes: z.number().int().positive(),
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

    if (!cp) { res.status(404).json({ error: "Creator profile not found" }); return; }

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, id), eq(listingsTable.creatorId, cp.id)))
      .limit(1);

    if (!listing) { res.status(404).json({ error: "Listing not found or access denied" }); return; }

    if (listing.type !== "digital_product" && listing.type !== "recorded_course") {
      res.status(400).json({ error: "File uploads are only supported for digital products and recorded courses" });
      return;
    }

    const { uploadUrl, storageKey } = await generateUploadUrl({
      folder: `digital-products/${cp.id}`,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    });

    res.json({ data: { uploadUrl, storageKey } });
  }
);

// POST /api/v1/creator/listings/:id/paid-asset — register uploaded file as listing's paid asset
router.post(
  "/creator/listings/:id/paid-asset",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({
      storageKey: z.string().min(1),
      fileName: z.string().min(1).max(260),
      mimeType: z.string().min(1).max(100),
      sizeBytes: z.number().int().positive(),
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

    if (!cp) { res.status(404).json({ error: "Creator profile not found" }); return; }

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, id), eq(listingsTable.creatorId, cp.id)))
      .limit(1);

    if (!listing) { res.status(404).json({ error: "Listing not found or access denied" }); return; }

    if (listing.type !== "digital_product" && listing.type !== "recorded_course") {
      res.status(400).json({ error: "File uploads not supported for this listing type" });
      return;
    }

    // Create asset record — auto-marked clean for MVP (production: run virus scan first)
    const [asset] = await db
      .insert(assetsTable)
      .values({
        ownerId: req.session.userId!,
        ownerType: "creator",
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
        storageKey: parsed.data.storageKey,
        isPrivate: true,
        scanStatus: "clean",
      })
      .returning();

    // Upsert product row and link asset
    const ext = parsed.data.mimeType.split("/")[1] ?? parsed.data.fileName.split(".").pop() ?? "bin";
    const [existingProduct] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.listingId, id))
      .limit(1);

    if (existingProduct) {
      await db
        .update(productsTable)
        .set({ paidAssetId: asset.id, fileFormat: ext })
        .where(eq(productsTable.id, existingProduct.id));
    } else {
      await db.insert(productsTable).values({
        listingId: id,
        paidAssetId: asset.id,
        fileFormat: ext,
      });
    }

    res.json({ data: { assetId: asset.id, fileName: asset.fileName } });
  }
);

export default router;
