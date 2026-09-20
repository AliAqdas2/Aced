/**
 * Subscription plan management and subscription checkout.
 *
 * Creator:
 *   POST /v1/creator/subscription-plans       — upsert a subscription plan for a service offer
 *   GET  /v1/creator/subscribers              — list active subscribers per listing
 *
 * Learner:
 *   POST /v1/bookings/subscribe               — create Stripe Checkout in subscription mode
 *   GET  /v1/me/subscriptions                 — list learner's active and past subscriptions
 *   POST /v1/me/subscriptions/:id/cancel      — cancel at period end
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  subscriptionPlansTable,
  learnerSubscriptionsTable,
  serviceOffersTable,
  listingsTable,
  creatorProfilesTable,
  platformConfigTable,
  usersTable,
  profilesTable,
} from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { rejectIfOwnListing } from "../../lib/ownListing";
import { publicPath } from "../../lib/appUrl";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

async function getCommissionRatePct(): Promise<number> {
  const [cfg] = await db
    .select()
    .from(platformConfigTable)
    .where(eq(platformConfigTable.key, "COMMISSION_RATE"))
    .limit(1);
  return parseFloat(cfg?.value ?? "15");
}

// ---------------------------------------------------------------------------
// POST /api/v1/creator/subscription-plans
// Upsert a subscription plan for a service offer (creator only).
// Creates or updates the Stripe Product + recurring Price lazily on first subscribe.
// ---------------------------------------------------------------------------

router.post(
  "/creator/subscription-plans",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      serviceOfferId: z.string().uuid(),
      billingInterval: z.enum(["weekly", "monthly"]),
      sessionsPerPeriod: z.number().int().min(1).max(100),
      amountMinorUnits: z.number().int().positive(),
      currency: z.string().length(3).default("GBP"),
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

    // Verify the service offer belongs to this creator
    const [offer] = await db
      .select()
      .from(serviceOffersTable)
      .where(eq(serviceOffersTable.id, parsed.data.serviceOfferId))
      .limit(1);

    if (!offer) {
      res.status(404).json({ error: "Service offer not found" });
      return;
    }

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(
        and(eq(listingsTable.id, offer.listingId), eq(listingsTable.creatorId, cp.id))
      )
      .limit(1);

    if (!listing) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const { serviceOfferId, billingInterval, sessionsPerPeriod, amountMinorUnits, currency } =
      parsed.data;

    // Upsert subscription plan (no Stripe objects yet — created lazily on first subscribe)
    const [existing] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.serviceOfferId, serviceOfferId))
      .limit(1);

    let plan: typeof subscriptionPlansTable.$inferSelect;

    if (existing) {
      const amountChanged =
        existing.amountMinorUnits !== amountMinorUnits ||
        existing.billingInterval !== billingInterval ||
        existing.currency !== currency;

      // If price details changed, clear cached Stripe Price ID so it gets recreated
      const [updated] = await db
        .update(subscriptionPlansTable)
        .set({
          billingInterval,
          sessionsPerPeriod,
          amountMinorUnits,
          currency,
          stripePriceId: amountChanged ? null : existing.stripePriceId,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(subscriptionPlansTable.id, existing.id))
        .returning();
      plan = updated;
    } else {
      const [inserted] = await db
        .insert(subscriptionPlansTable)
        .values({ serviceOfferId, billingInterval, sessionsPerPeriod, amountMinorUnits, currency })
        .returning();
      plan = inserted;
    }

    res.status(existing ? 200 : 201).json({ data: plan });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/bookings/subscribe
// Create a Stripe Checkout session in subscription mode for a plan.
// ---------------------------------------------------------------------------

router.post(
  "/bookings/subscribe",
  requireAuth,
  async (req, res): Promise<void> => {
    const Body = z.object({
      subscriptionPlanId: z.string().uuid(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const learnerId = req.session.userId!;

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(
        and(eq(subscriptionPlansTable.id, parsed.data.subscriptionPlanId), eq(subscriptionPlansTable.isActive, true))
      )
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: "Subscription plan not found" });
      return;
    }

    const [offer] = await db
      .select()
      .from(serviceOffersTable)
      .where(eq(serviceOffersTable.id, plan.serviceOfferId))
      .limit(1);

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, offer.listingId), eq(listingsTable.status, "published")))
      .limit(1);

    if (!listing) {
      res.status(404).json({ error: "Listing not found or not published" });
      return;
    }

    if (await rejectIfOwnListing(res, listing.creatorId, learnerId)) {
      return;
    }

    const [creator] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.id, listing.creatorId))
      .limit(1);

    if (!creator.stripeAccountId || creator.stripeAccountStatus !== "active") {
      res.status(400).json({ error: "Creator payment setup incomplete", code: "CREATOR_NOT_READY" });
      return;
    }

    // Check learner doesn't already have an active subscription for this plan
    const [existingSub] = await db
      .select()
      .from(learnerSubscriptionsTable)
      .where(
        and(
          eq(learnerSubscriptionsTable.learnerId, learnerId),
          eq(learnerSubscriptionsTable.subscriptionPlanId, plan.id),
          eq(learnerSubscriptionsTable.status, "active")
        )
      )
      .limit(1);

    if (existingSub) {
      res.status(409).json({ error: "Already subscribed to this plan", code: "ALREADY_SUBSCRIBED" });
      return;
    }

    const stripe = getStripe();
    const commissionPct = await getCommissionRatePct();

    // Find or create Stripe Customer for this learner
    const [learner] = await db.select().from(usersTable).where(eq(usersTable.id, learnerId)).limit(1);
    let stripeCustomerId = learner.stripeCustomerId;

    if (!stripeCustomerId) {
      const [profile] = await db
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.userId, learnerId))
        .limit(1);

      const customer = await stripe.customers.create({
        email: learner.email,
        name: profile?.displayName ?? learner.email,
        metadata: { userId: learnerId },
      });
      stripeCustomerId = customer.id;

      await db.update(usersTable)
        .set({ stripeCustomerId })
        .where(eq(usersTable.id, learnerId));
    }

    // Lazily create Stripe Product + Price if not yet created
    let { stripePriceId, stripeProductId } = plan;

    if (!stripePriceId || !stripeProductId) {
      const intervalMap: Record<string, Stripe.PriceCreateParams.Recurring.Interval> = {
        weekly: "week",
        monthly: "month",
      };

      if (!stripeProductId) {
        const product = await stripe.products.create({
          name: `${listing.title} — ${plan.sessionsPerPeriod} sessions/${plan.billingInterval}`,
          metadata: { subscriptionPlanId: plan.id, listingId: listing.id },
        });
        stripeProductId = product.id;
      }

      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: plan.amountMinorUnits,
        currency: plan.currency.toLowerCase(),
        recurring: { interval: intervalMap[plan.billingInterval] },
        metadata: { subscriptionPlanId: plan.id },
      });
      stripePriceId = price.id;

      await db
        .update(subscriptionPlansTable)
        .set({ stripeProductId, stripePriceId, updatedAt: new Date() })
        .where(eq(subscriptionPlansTable.id, plan.id));
    }

    // Create Stripe Checkout session in subscription mode
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: stripePriceId, quantity: 1 }],
      subscription_data: {
        metadata: {
          subscriptionPlanId: plan.id,
          learnerId,
          serviceOfferId: plan.serviceOfferId,
          listingId: listing.id,
          creatorId: listing.creatorId,
        },
        application_fee_percent: commissionPct,
        transfer_data: { destination: creator.stripeAccountId },
      },
      success_url: publicPath(`/subscriptions?success=true&planId=${plan.id}`),
      cancel_url: publicPath(`/listings/${listing.id}`),
    });

    res.status(201).json({
      data: {
        checkoutUrl: session.url,
        sessionId: session.id,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/creator/subscription-plans/:planId/pause
// PATCH /api/v1/creator/subscription-plans/:planId/resume
// ---------------------------------------------------------------------------

router.patch(
  "/creator/subscription-plans/:planId/pause",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    // Verify plan belongs to this creator via service offer → listing → creator
    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: "Subscription plan not found" });
      return;
    }

    const [offer] = await db
      .select()
      .from(serviceOffersTable)
      .where(eq(serviceOffersTable.id, plan.serviceOfferId))
      .limit(1);

    if (!offer) {
      res.status(404).json({ error: "Service offer not found" });
      return;
    }

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, offer.listingId), eq(listingsTable.creatorId, cp.id)))
      .limit(1);

    if (!listing) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [updated] = await db
      .update(subscriptionPlansTable)
      .set({ isActive: false, pausedAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptionPlansTable.id, planId))
      .returning();

    res.json({ data: updated });
  }
);

router.patch(
  "/creator/subscription-plans/:planId/resume",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: "Subscription plan not found" });
      return;
    }

    const [offer] = await db
      .select()
      .from(serviceOffersTable)
      .where(eq(serviceOffersTable.id, plan.serviceOfferId))
      .limit(1);

    if (!offer) {
      res.status(404).json({ error: "Service offer not found" });
      return;
    }

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, offer.listingId), eq(listingsTable.creatorId, cp.id)))
      .limit(1);

    if (!listing) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [updated] = await db
      .update(subscriptionPlansTable)
      .set({ isActive: true, pausedAt: null, updatedAt: new Date() })
      .where(eq(subscriptionPlansTable.id, planId))
      .returning();

    res.json({ data: updated });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/me/subscriptions — list learner's subscriptions
// ---------------------------------------------------------------------------

router.get("/me/subscriptions", requireAuth, async (req, res): Promise<void> => {
  const learnerId = req.session.userId!;

  const subs = await db
    .select()
    .from(learnerSubscriptionsTable)
    .where(eq(learnerSubscriptionsTable.learnerId, learnerId));

  const enriched = await Promise.all(
    subs.map(async (sub) => {
      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, sub.subscriptionPlanId))
        .limit(1);

      const [listing] = await db
        .select({ id: listingsTable.id, title: listingsTable.title })
        .from(listingsTable)
        .where(eq(listingsTable.id, sub.listingId))
        .limit(1);

      const [creatorProfile] = await db
        .select({ displayName: profilesTable.displayName })
        .from(profilesTable)
        .innerJoin(
          creatorProfilesTable,
          eq(profilesTable.userId, creatorProfilesTable.userId)
        )
        .where(eq(creatorProfilesTable.id, sub.creatorId))
        .limit(1);

      return {
        ...sub,
        plan: plan ?? null,
        listingTitle: listing?.title ?? null,
        creatorDisplayName: creatorProfile?.displayName ?? null,
      };
    })
  );

  res.json({ data: enriched });
});

// ---------------------------------------------------------------------------
// POST /api/v1/me/subscriptions/:id/cancel — cancel at period end
// ---------------------------------------------------------------------------

router.post(
  "/me/subscriptions/:id/cancel",
  requireAuth,
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [sub] = await db
      .select()
      .from(learnerSubscriptionsTable)
      .where(
        and(
          eq(learnerSubscriptionsTable.id, id),
          eq(learnerSubscriptionsTable.learnerId, req.session.userId!)
        )
      )
      .limit(1);

    if (!sub) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }

    if (sub.status !== "active") {
      res.status(400).json({ error: "Subscription is not active" });
      return;
    }

    if (!sub.stripeSubscriptionId) {
      res.status(400).json({ error: "No Stripe subscription linked" });
      return;
    }

    const stripe = getStripe();

    // Cancel at period end (learner keeps access until currentPeriodEnd)
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    const [updated] = await db
      .update(learnerSubscriptionsTable)
      .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
      .where(eq(learnerSubscriptionsTable.id, sub.id))
      .returning();

    res.json({ data: updated });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/creator/subscription-plans/:planId/impact
// Returns the count of active subscribers for a plan (creator only).
// ---------------------------------------------------------------------------

router.get(
  "/creator/subscription-plans/:planId/impact",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const planId = Array.isArray(req.params.planId) ? req.params.planId[0] : req.params.planId;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    // Verify plan belongs to this creator
    const [plan] = await db
      .select()
      .from(subscriptionPlansTable)
      .where(eq(subscriptionPlansTable.id, planId))
      .limit(1);

    if (!plan) {
      res.status(404).json({ error: "Subscription plan not found" });
      return;
    }

    const [offer] = await db
      .select()
      .from(serviceOffersTable)
      .where(eq(serviceOffersTable.id, plan.serviceOfferId))
      .limit(1);

    if (!offer) {
      res.status(404).json({ error: "Service offer not found" });
      return;
    }

    const [listing] = await db
      .select()
      .from(listingsTable)
      .where(and(eq(listingsTable.id, offer.listingId), eq(listingsTable.creatorId, cp.id)))
      .limit(1);

    if (!listing) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [result] = await db
      .select({ activeSubscriberCount: count() })
      .from(learnerSubscriptionsTable)
      .where(
        and(
          eq(learnerSubscriptionsTable.subscriptionPlanId, planId),
          eq(learnerSubscriptionsTable.status, "active")
        )
      );

    res.json({ data: { activeSubscriberCount: result?.activeSubscriberCount ?? 0 } });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/creator/subscribers — list subscribers per listing
// ---------------------------------------------------------------------------

router.get(
  "/creator/subscribers",
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

    const subs = await db
      .select()
      .from(learnerSubscriptionsTable)
      .where(eq(learnerSubscriptionsTable.creatorId, cp.id));

    const enriched = await Promise.all(
      subs.map(async (sub) => {
        const [plan] = await db
          .select()
          .from(subscriptionPlansTable)
          .where(eq(subscriptionPlansTable.id, sub.subscriptionPlanId))
          .limit(1);

        const [listing] = await db
          .select({ title: listingsTable.title })
          .from(listingsTable)
          .where(eq(listingsTable.id, sub.listingId))
          .limit(1);

        const [learnerProfile] = await db
          .select({ displayName: profilesTable.displayName })
          .from(profilesTable)
          .where(eq(profilesTable.userId, sub.learnerId))
          .limit(1);

        return {
          ...sub,
          plan: plan ?? null,
          listingTitle: listing?.title ?? null,
          learnerDisplayName: learnerProfile?.displayName ?? null,
        };
      })
    );

    res.json({ data: enriched });
  }
);

export default router;
