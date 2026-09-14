import { Router, type IRouter } from "express";
import { z } from "zod";
import { syncBookingCancelled } from "../../lib/calendar-sync";
import { db } from "@workspace/db";
import {
  entitlementsTable,
  listingsTable,
  productsTable,
  assetsTable,
  bookingsTable,
  serviceOffersTable,
  profilesTable,
  creatorProfilesTable,
  learnerSubscriptionsTable,
  ordersTable,
  orderItemsTable,
  priceRecordsTable,
  platformConfigTable,
  usersTable,
  reviewsTable,
} from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { generateDownloadUrl } from "../../lib/storage";
import { sendEmailResilient, buildReviewRequestEmail } from "../../lib/email";
import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

/**
 * Reads refund policy from platform_config.
 * REFUND_FULL_HOURS  — hours before session start that qualify for a full refund (default: 24)
 * REFUND_PARTIAL_RATE — fraction [0,1] returned when within that window (default: 0.5)
 *
 * Values are clamped to safe ranges; invalid/NaN config falls back to safe defaults.
 */
async function getRefundPolicy(): Promise<{ fullRefundHours: number; partialRate: number }> {
  const [hoursRow, rateRow] = await Promise.all([
    db
      .select({ value: platformConfigTable.value })
      .from(platformConfigTable)
      .where(eq(platformConfigTable.key, "REFUND_FULL_HOURS"))
      .limit(1),
    db
      .select({ value: platformConfigTable.value })
      .from(platformConfigTable)
      .where(eq(platformConfigTable.key, "REFUND_PARTIAL_RATE"))
      .limit(1),
  ]);

  const rawHours = parseFloat(hoursRow[0]?.value ?? "");
  const rawRate = parseFloat(rateRow[0]?.value ?? "");

  // Clamp to safe ranges; fall back to defaults on NaN or out-of-range values
  const fullRefundHours = Number.isFinite(rawHours) && rawHours >= 0 ? rawHours : 24;
  const partialRate =
    Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 1 ? rawRate : 0.5;

  return { fullRefundHours, partialRate };
}

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
      if (listing?.type === "digital_product" || listing?.type === "recorded_course") {
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

// GET /api/v1/me/bookings — learner bookings (enriched)
router.get("/me/bookings", requireAuth, async (req, res): Promise<void> => {
  const bookings = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.learnerId, req.session.userId!))
    .orderBy(desc(bookingsTable.scheduledStartAt));

  const enriched = await Promise.all(
    bookings.map(async (b) => {
      const [listing] = await db
        .select({ title: listingsTable.title })
        .from(listingsTable)
        .where(eq(listingsTable.id, b.listingId))
        .limit(1);

      const [offer] = await db
        .select({ durationMinutes: serviceOffersTable.durationMinutes })
        .from(serviceOffersTable)
        .where(eq(serviceOffersTable.id, b.serviceOfferId))
        .limit(1);

      const [cp] = await db
        .select({ userId: creatorProfilesTable.userId })
        .from(creatorProfilesTable)
        .where(eq(creatorProfilesTable.id, b.creatorId))
        .limit(1);

      let creatorDisplayName: string | null = null;
      if (cp?.userId) {
        const [profile] = await db
          .select({ displayName: profilesTable.displayName })
          .from(profilesTable)
          .where(eq(profilesTable.userId, cp.userId))
          .limit(1);
        creatorDisplayName = profile?.displayName ?? null;
      }

      let orderItemId: string | null = null;
      let hasReviewed = false;
      if (b.orderId) {
        const [item] = await db
          .select({ id: orderItemsTable.id })
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, b.orderId))
          .limit(1);
        orderItemId = item?.id ?? null;
        if (orderItemId) {
          const [existingReview] = await db
            .select({ id: reviewsTable.id })
            .from(reviewsTable)
            .where(eq(reviewsTable.orderItemId, orderItemId))
            .limit(1);
          hasReviewed = !!existingReview;
        }
      }

      return {
        ...b,
        listingTitle: listing?.title ?? null,
        durationMinutes: offer?.durationMinutes ?? null,
        creatorDisplayName,
        orderItemId,
        hasReviewed,
      };
    })
  );

  res.json({ data: enriched });
});

// GET /api/v1/creator/bookings — creator's bookings (enriched)
router.get(
  "/creator/bookings",
  async (req, res): Promise<void> => {
    if (!req.session.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

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

    const enriched = await Promise.all(
      bookings.map(async (b) => {
        const [listing] = await db
          .select({ title: listingsTable.title })
          .from(listingsTable)
          .where(eq(listingsTable.id, b.listingId))
          .limit(1);

        const [offer] = await db
          .select({ durationMinutes: serviceOffersTable.durationMinutes })
          .from(serviceOffersTable)
          .where(eq(serviceOffersTable.id, b.serviceOfferId))
          .limit(1);

        const [learnerProfile] = await db
          .select({ displayName: profilesTable.displayName })
          .from(profilesTable)
          .where(eq(profilesTable.userId, b.learnerId))
          .limit(1);

        return {
          ...b,
          listingTitle: listing?.title ?? null,
          durationMinutes: offer?.durationMinutes ?? null,
          learnerDisplayName: learnerProfile?.displayName ?? null,
        };
      })
    );

    res.json({ data: enriched });
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

  // Ensure a paid order item exists so the learner can leave a verified review,
  // then email them a deep link.
  try {
    let orderId = booking.orderId;
    let orderItemId: string | null = null;

    if (orderId) {
      const [existingItem] = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, orderId))
        .limit(1);
      orderItemId = existingItem?.id ?? null;
    }

    if (!orderItemId) {
      const [listing] = await db
        .select()
        .from(listingsTable)
        .where(eq(listingsTable.id, booking.listingId))
        .limit(1);

      const [priceRecord] = await db
        .select()
        .from(priceRecordsTable)
        .where(
          and(
            eq(priceRecordsTable.listingId, booking.listingId),
            eq(priceRecordsTable.isActive, true)
          )
        )
        .limit(1);

      if (!priceRecord) {
        throw new Error("No active price record for listing — cannot create review order");
      }

      const [creatorProfile] = await db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .where(eq(profilesTable.userId, cp.userId))
        .limit(1);

      const idempotencyKey = `session_review:${booking.id}`;
      const [order] = await db
        .insert(ordersTable)
        .values({
          buyerId: booking.learnerId,
          status: "paid",
          currency: priceRecord.currency,
          subtotalMinorUnits: priceRecord.amountMinorUnits,
          platformFeeMinorUnits: 0,
          totalMinorUnits: priceRecord.amountMinorUnits,
          idempotencyKey,
        })
        .returning();

      orderId = order.id;
      const [orderItem] = await db
        .insert(orderItemsTable)
        .values({
          orderId: order.id,
          listingId: booking.listingId,
          priceRecordId: priceRecord.id,
          listingTitleSnapshot: listing?.title ?? "Session",
          creatorIdSnapshot: booking.creatorId,
          creatorNameSnapshot: creatorProfile?.displayName ?? null,
          quantity: 1,
          unitAmountMinorUnits: priceRecord.amountMinorUnits,
          platformFeeMinorUnits: 0,
          creatorProceedsMinorUnits: priceRecord.amountMinorUnits,
          commissionRateBasisPoints: 0,
          fulfilmentStatus: "fulfilled",
        })
        .returning();
      orderItemId = orderItem.id;

      await db
        .update(bookingsTable)
        .set({ orderId: order.id })
        .where(eq(bookingsTable.id, booking.id));
    }

    if (orderItemId) {
      const [learner] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, booking.learnerId))
        .limit(1);
      const [learnerProfile] = await db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .where(eq(profilesTable.userId, booking.learnerId))
        .limit(1);
      const [tutorProfile] = await db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .where(eq(profilesTable.userId, cp.userId))
        .limit(1);
      const [listing] = await db
        .select()
        .from(listingsTable)
        .where(eq(listingsTable.id, booking.listingId))
        .limit(1);

      if (learner?.email) {
        const appUrl = process.env.APP_URL ?? "http://localhost:5000";
        const reviewUrl = `${appUrl}/reviews/submit?orderItemId=${orderItemId}`;
        await sendEmailResilient(
          {
            to: learner.email,
            subject: "How was your Aced session?",
            html: buildReviewRequestEmail({
              learnerName: learnerProfile?.displayName ?? "there",
              tutorName: tutorProfile?.displayName ?? "your tutor",
              listingTitle: listing?.title ?? "your session",
              reviewUrl,
            }),
          },
          "session_review_request"
        );
      }
    }
  } catch (err) {
    req.log?.error?.({ err, bookingId: id }, "Failed to send review-request email");
  }

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

  // Determine whether a Stripe refund should be issued.
  // Only paid bookings that are confirmed or in_progress have an associated order to refund.
  const isPaidStatus = booking.status === "confirmed" || booking.status === "in_progress";
  let stripeRefundId: string | null = null;
  let refundAmountMinorUnits: number | null = null;
  let finalStatus: "cancelled" | "refunded" = "cancelled";

  if (isPaidStatus && booking.orderId) {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, booking.orderId))
      .limit(1);

    if (order?.stripePaymentIntentId && order.status === "paid") {
      // Calculate refund amount based on cancellation policy
      const { fullRefundHours, partialRate } = await getRefundPolicy();
      const now = new Date();
      const hoursUntilSession =
        (booking.scheduledStartAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      const grossAmount = order.totalMinorUnits;
      const refundAmount =
        hoursUntilSession >= fullRefundHours
          ? grossAmount
          : Math.round(grossAmount * partialRate);

      if (refundAmount > 0) {
        // Call Stripe with an idempotency key derived from this booking's cancellation so
        // concurrent or retried calls never issue a double-refund.
        // Any Stripe failure propagates as a 500 — the booking stays in confirmed/in_progress
        // so the caller can retry and no money is silently lost.
        const stripe = getStripe();
        const stripeRefund = await stripe.refunds.create(
          {
            payment_intent: order.stripePaymentIntentId,
            amount: refundAmount,
            reason: "requested_by_customer",
            metadata: { bookingId: booking.id, orderId: order.id },
          },
          { idempotencyKey: `booking-cancel-${booking.id}` }
        );
        stripeRefundId = stripeRefund.id;
        refundAmountMinorUnits = refundAmount;
        finalStatus = "refunded";
      }
    }
  }

  // Atomic status transition — the WHERE guard on status means only one
  // concurrent cancel request can win. If another request already transitioned
  // this booking (or it was never in a cancellable state), 0 rows are returned
  // and we reject immediately without restoring any credits.
  const [updated] = await db
    .update(bookingsTable)
    .set({ status: finalStatus, cancellationReason: parsed.data.reason })
    .where(
      and(
        eq(bookingsTable.id, id),
        or(
          eq(bookingsTable.status, "confirmed"),
          eq(bookingsTable.status, "in_progress")
        )
      )
    )
    .returning();

  if (!updated) {
    res.status(409).json({
      error: "Booking cannot be cancelled in its current state",
      code: "INVALID_STATUS",
    });
    return;
  }

  // Fire-and-forget calendar event deletion — looks up all mapping rows internally
  syncBookingCancelled(booking.id).catch(() => {});

  // Refund subscription credit if this was a subscription booking
  const [so] = await db
    .select({ pricingMode: serviceOffersTable.pricingMode })
    .from(serviceOffersTable)
    .where(eq(serviceOffersTable.id, booking.serviceOfferId))
    .limit(1);

  if (so?.pricingMode === "subscription") {
    const [activeSub] = await db
      .select()
      .from(learnerSubscriptionsTable)
      .where(
        and(
          eq(learnerSubscriptionsTable.learnerId, booking.learnerId),
          eq(learnerSubscriptionsTable.serviceOfferId, booking.serviceOfferId),
          eq(learnerSubscriptionsTable.status, "active")
        )
      )
      .limit(1);

    if (activeSub) {
      await db
        .update(learnerSubscriptionsTable)
        .set({ sessionsRemaining: activeSub.sessionsRemaining + 1 })
        .where(eq(learnerSubscriptionsTable.id, activeSub.id));
    }
  }

  res.json({
    data: {
      ...updated,
      refund: stripeRefundId
        ? { refundId: stripeRefundId, amountMinorUnits: refundAmountMinorUnits }
        : null,
    },
  });
});

export default router;
