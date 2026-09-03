import { Router, type IRouter } from "express";
import { z } from "zod";
import { syncBookingCreated } from "../../lib/calendar-sync";
import { db } from "@workspace/db";
import {
  ordersTable,
  orderItemsTable,
  paymentsTable,
  ledgerEntriesTable,
  entitlementsTable,
  bookingHoldsTable,
  bookingsTable,
  listingsTable,
  serviceOffersTable,
  priceRecordsTable,
  creatorProfilesTable,
  profilesTable,
  commissionRulesTable,
  webhookEventsTable,
  platformConfigTable,
  usersTable,
  subscriptionPlansTable,
  learnerSubscriptionsTable,
} from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAuth } from "../../middlewares/auth";
import Stripe from "stripe";
import { createHash } from "crypto";

const router: IRouter = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

/**
 * Returns the platform commission rate in basis points (1% = 100 bps).
 * Reads COMMISSION_RATE from platform_config; falls back to 15% if not set.
 */
async function getCommissionRateBps(): Promise<number> {
  const [cfg] = await db
    .select()
    .from(platformConfigTable)
    .where(eq(platformConfigTable.key, "COMMISSION_RATE"))
    .limit(1);
  const ratePct = parseFloat(cfg?.value ?? "15");
  return Math.round(ratePct * 100); // percentage → basis points
}

// POST /api/v1/checkout/sessions — create Stripe Checkout for an order
router.post("/checkout/sessions", requireAuth, async (req, res): Promise<void> => {
  const Body = z.object({
    listingId: z.string().uuid(),
    holdId: z.string().uuid().optional(),
    idempotencyKey: z.string().min(8).max(64).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const buyerId = req.session.userId!;
  const { listingId, holdId } = parsed.data;
  const idempotencyKey = parsed.data.idempotencyKey ?? nanoid(32);

  // Check for existing order with same idempotency key
  const [existingOrder] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existingOrder) {
    res.json({ data: { orderId: existingOrder.id, existing: true } });
    return;
  }

  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(and(eq(listingsTable.id, listingId), eq(listingsTable.status, "published")))
    .limit(1);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const [priceRecord] = await db
    .select()
    .from(priceRecordsTable)
    .where(and(eq(priceRecordsTable.listingId, listingId), eq(priceRecordsTable.isActive, true)))
    .limit(1);

  if (!priceRecord) {
    res.status(400).json({ error: "No active price found", code: "NO_PRICE" });
    return;
  }

  const [creator] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.id, listing.creatorId))
    .limit(1);

  if (!creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  if (creator.userId === buyerId) {
    res.status(403).json({
      error: "You cannot purchase or book your own listing",
      code: "CANNOT_PURCHASE_OWN_LISTING",
    });
    return;
  }

  if (!creator.stripeAccountId || creator.stripeAccountStatus !== "active") {
    res.status(400).json({ error: "Creator payment setup incomplete", code: "CREATOR_NOT_READY" });
    return;
  }

  // Snapshot the creator's display name so the order remains auditable even if
  // the creator's profile is later deleted.
  const [creatorProfile] = await db
    .select({ displayName: profilesTable.displayName })
    .from(profilesTable)
    .where(eq(profilesTable.userId, creator.userId))
    .limit(1);
  const creatorNameSnapshot = creatorProfile?.displayName ?? null;

  const commissionRateBps = await getCommissionRateBps();
  const platformFee = Math.round(priceRecord.amountMinorUnits * (commissionRateBps / 10000));
  const creatorProceeds = priceRecord.amountMinorUnits - platformFee;

  // Create draft order
  const [order] = await db
    .insert(ordersTable)
    .values({
      buyerId,
      status: "pending_payment",
      currency: priceRecord.currency,
      subtotalMinorUnits: priceRecord.amountMinorUnits,
      platformFeeMinorUnits: platformFee,
      totalMinorUnits: priceRecord.amountMinorUnits,
      idempotencyKey,
    })
    .returning();

  const [orderItem] = await db
    .insert(orderItemsTable)
    .values({
      orderId: order.id,
      listingId,
      priceRecordId: priceRecord.id,
      listingTitleSnapshot: listing.title,
      creatorIdSnapshot: creator.id,
      creatorNameSnapshot,
      quantity: 1,
      unitAmountMinorUnits: priceRecord.amountMinorUnits,
      platformFeeMinorUnits: platformFee,
      creatorProceedsMinorUnits: creatorProceeds,
      commissionRateBasisPoints: commissionRateBps,
      fulfilmentStatus: "pending",
    })
    .returning();

  const stripe = getStripe();
  const appUrl = process.env.APP_URL ?? "http://localhost:5000";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: priceRecord.currency.toLowerCase(),
          unit_amount: priceRecord.amountMinorUnits,
          product_data: { name: listing.title },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFee,
      transfer_data: { destination: creator.stripeAccountId },
      metadata: {
        orderId: order.id,
        orderItemId: orderItem.id,
        holdId: holdId ?? "",
      },
    },
    metadata: { orderId: order.id, orderItemId: orderItem.id, holdId: holdId ?? "" },
    success_url: `${appUrl}/checkout/success?orderId=${order.id}`,
    cancel_url: `${appUrl}/listings/${listingId}`,
  });

  // Update order with Stripe session ID
  await db
    .update(ordersTable)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(ordersTable.id, order.id));

  res.status(201).json({
    data: {
      orderId: order.id,
      checkoutUrl: session.url,
      sessionId: session.id,
    },
  });
});

// POST /api/v1/webhooks/stripe — handle Stripe events
// Note: app.ts mounts express.raw() for this path before express.json(),
// so req.body is a Buffer here containing the raw request body.
router.post(
  "/webhooks/stripe",
  async (req, res): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      req.log.error("STRIPE_WEBHOOK_SECRET not configured");
      res.status(500).json({ error: "Webhook not configured" });
      return;
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripe();
      // req.body is a Buffer from express.raw() mounted in app.ts
      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        webhookSecret
      );
    } catch (err) {
      req.log.warn({ err }, "Stripe webhook signature verification failed");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const payloadHash = createHash("sha256")
      .update(JSON.stringify(event))
      .digest("hex");

    // Idempotency check
    const [existing] = await db
      .select()
      .from(webhookEventsTable)
      .where(eq(webhookEventsTable.eventId, event.id))
      .limit(1);

    if (existing) {
      if (existing.processingStatus === "processed") {
        res.json({ received: true });
        return;
      }
    } else {
      await db.insert(webhookEventsTable).values({
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        payloadHash,
        processingStatus: "pending",
        attempts: 1,
      });
    }

    try {
      await handleStripeEvent(event);

      await db
        .update(webhookEventsTable)
        .set({ processingStatus: "processed", processedAt: new Date() })
        .where(eq(webhookEventsTable.eventId, event.id));
    } catch (err: any) {
      await db
        .update(webhookEventsTable)
        .set({
          processingStatus: "failed",
          errorMessage: err?.message ?? "Unknown error",
          attempts: (existing?.attempts ?? 0) + 1,
        })
        .where(eq(webhookEventsTable.eventId, event.id));

      req.log.error({ err, eventId: event.id }, "Stripe webhook processing failed");
      res.status(500).json({ error: "Processing failed" });
      return;
    }

    res.json({ received: true });
  }
);

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      const orderItemId = session.metadata?.orderItemId;
      const holdId = session.metadata?.holdId;

      if (!orderId || !orderItemId) return;

      const [order] = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1);

      if (!order || order.status === "paid") return;

      const [orderItem] = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.id, orderItemId))
        .limit(1);

      if (!orderItem) return;

      // Update order to paid
      await db
        .update(ordersTable)
        .set({
          status: "paid",
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
        })
        .where(eq(ordersTable.id, orderId));

      // Create payment record
      const [payment] = await db
        .insert(paymentsTable)
        .values({
          orderId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent as string,
          amountMinorUnits: session.amount_total ?? 0,
          currency: (session.currency ?? "gbp").toUpperCase(),
          status: "succeeded",
          processedAt: new Date(),
        })
        .returning();

      // Write ledger entries (immutable)
      await db.insert(ledgerEntriesTable).values([
        {
          orderId,
          orderItemId,
          paymentId: payment.id,
          entryType: "gross",
          amountMinorUnits: orderItem.unitAmountMinorUnits,
          currency: order.currency,
          reference: `stripe:${session.payment_intent}`,
        },
        {
          orderId,
          orderItemId,
          paymentId: payment.id,
          entryType: "platform_fee",
          amountMinorUnits: orderItem.platformFeeMinorUnits,
          currency: order.currency,
          reference: `stripe:${session.payment_intent}`,
        },
        {
          orderId,
          orderItemId,
          paymentId: payment.id,
          entryType: "creator_proceeds",
          amountMinorUnits: orderItem.creatorProceedsMinorUnits,
          currency: order.currency,
          reference: `stripe:${session.payment_intent}`,
        },
      ]);

      // Grant entitlement
      await db.insert(entitlementsTable).values({
        userId: order.buyerId,
        orderItemId,
        listingId: orderItem.listingId,
        status: "active",
        grantReason: `order:${orderId}`,
      });

      // Update order item fulfillment
      await db
        .update(orderItemsTable)
        .set({ fulfilmentStatus: "fulfilled" })
        .where(eq(orderItemsTable.id, orderItemId));

      // Convert booking hold if applicable
      if (holdId) {
        const [hold] = await db
          .select()
          .from(bookingHoldsTable)
          .where(eq(bookingHoldsTable.id, holdId))
          .limit(1);

        if (hold) {
          await db
            .update(bookingHoldsTable)
            .set({ status: "converted" })
            .where(eq(bookingHoldsTable.id, holdId));

          const [listing] = await db
            .select()
            .from(listingsTable)
            .where(eq(listingsTable.id, hold.listingId))
            .limit(1);

          // Fetch creator's video call link alongside userId in one query
          const [cp] = await db
            .select({ userId: creatorProfilesTable.userId, videoCallLink: creatorProfilesTable.videoCallLink })
            .from(creatorProfilesTable)
            .where(eq(creatorProfilesTable.id, listing.creatorId))
            .limit(1);
          const meetingLink = cp?.videoCallLink ?? null;

          const [newBooking] = await db.insert(bookingsTable).values({
            holdId,
            orderId,
            learnerId: order.buyerId,
            creatorId: listing.creatorId,
            serviceOfferId: hold.serviceOfferId,
            listingId: hold.listingId,
            scheduledStartAt: hold.holdStartsAt,
            scheduledEndAt: hold.holdEndsAt,
            status: "confirmed",
            meetingLink,
          }).returning();

          // Sync to calendars — fire-and-forget, must not block webhook
          if (newBooking) {

            if (cp) {
              syncBookingCreated({
                bookingId: newBooking.id,
                listingTitle: listing.title,
                scheduledStartAt: hold.holdStartsAt,
                scheduledEndAt: hold.holdEndsAt,
                meetingLink,
                learnerId: order.buyerId,
                creatorUserId: cp.userId,
              }).catch(() => {}); // non-blocking
            }
          }
        }
      }

      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = charge.payment_intent as string;

      const [payment] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.stripePaymentIntentId, paymentIntentId))
        .limit(1);

      if (!payment) return;

      const refundAmount = charge.amount_refunded;

      await db
        .update(paymentsTable)
        .set({ status: "refunded" })
        .where(eq(paymentsTable.id, payment.id));

      await db
        .update(ordersTable)
        .set({ status: "refunded" })
        .where(eq(ordersTable.id, payment.orderId));

      await db.insert(ledgerEntriesTable).values({
        orderId: payment.orderId,
        paymentId: payment.id,
        entryType: "refund",
        amountMinorUnits: -refundAmount,
        currency: charge.currency.toUpperCase(),
        reference: `stripe:refund:${charge.id}`,
      });

      // Revoke entitlement
      const [orderItem] = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, payment.orderId))
        .limit(1);

      if (orderItem) {
        await db
          .update(entitlementsTable)
          .set({ status: "revoked", revokeReason: "refund" })
          .where(eq(entitlementsTable.orderItemId, orderItem.id));
      }

      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & { subscription?: string };
      const stripeSubscriptionId = invoice.subscription;
      if (!stripeSubscriptionId) break;

      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const { subscriptionPlanId, learnerId, serviceOfferId, listingId, creatorId } =
        subscription.metadata ?? {};

      if (!subscriptionPlanId || !learnerId) break;

      const [plan] = await db
        .select()
        .from(subscriptionPlansTable)
        .where(eq(subscriptionPlansTable.id, subscriptionPlanId))
        .limit(1);
      if (!plan) break;

      const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
      const customerId = subscription.customer as string;

      const [existing] = await db
        .select()
        .from(learnerSubscriptionsTable)
        .where(eq(learnerSubscriptionsTable.stripeSubscriptionId, stripeSubscriptionId))
        .limit(1);

      if (existing) {
        // Renewal: reset credits for the new period
        await db
          .update(learnerSubscriptionsTable)
          .set({
            status: "active",
            currentPeriodEnd,
            sessionsRemaining: plan.sessionsPerPeriod,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            updatedAt: new Date(),
          })
          .where(eq(learnerSubscriptionsTable.id, existing.id));
      } else {
        // First invoice: create the subscription row
        await db.insert(learnerSubscriptionsTable).values({
          learnerId,
          creatorId,
          listingId,
          serviceOfferId,
          subscriptionPlanId,
          stripeSubscriptionId,
          stripeCustomerId: customerId,
          status: "active",
          currentPeriodEnd,
          sessionsRemaining: plan.sessionsPerPeriod,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });

        // Save Stripe Customer ID to user record if not already set
        await db
          .update(usersTable)
          .set({ stripeCustomerId: customerId })
          .where(and(eq(usersTable.id, learnerId), isNull(usersTable.stripeCustomerId)));
      }

      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const statusMap: Record<string, string> = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        unpaid: "unpaid",
        canceled: "expired",
      };
      const newStatus = (statusMap[subscription.status] ?? "active") as any;

      await db
        .update(learnerSubscriptionsTable)
        .set({
          status: newStatus,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(learnerSubscriptionsTable.stripeSubscriptionId, subscription.id));

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await db
        .update(learnerSubscriptionsTable)
        .set({ status: "expired", updatedAt: new Date() })
        .where(eq(learnerSubscriptionsTable.stripeSubscriptionId, subscription.id));
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const status = account.charges_enabled ? "active" : "pending";

      await db
        .update(creatorProfilesTable)
        .set({ stripeAccountStatus: status })
        .where(eq(creatorProfilesTable.stripeAccountId, account.id));

      break;
    }

    default:
      // Acknowledge unhandled events
      break;
  }
}

// GET /api/v1/me/orders — buyer order history
router.get("/me/orders", requireAuth, async (req, res): Promise<void> => {
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.buyerId, req.session.userId!))
    .orderBy(ordersTable.createdAt);

  const ordersWithItems = await Promise.all(
    orders.map(async (o) => {
      const items = await db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, o.id));
      return { ...o, items };
    })
  );

  res.json({ data: ordersWithItems });
});

// POST /api/v1/orders/:id/refund-request
router.post("/orders/:id/refund-request", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const Body = z.object({ reason: z.string().min(10).max(1000) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [order] = await db
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.id, id), eq(ordersTable.buyerId, req.session.userId!)))
    .limit(1);

  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const { reportsCasesTable } = await import("@workspace/db");
  const [report] = await db
    .insert(reportsCasesTable)
    .values({
      reporterId: req.session.userId!,
      subjectType: "listing",
      subjectId: order.id,
      category: "other",
      description: `Refund request: ${parsed.data.reason}`,
      priority: "medium",
      status: "open",
    })
    .returning();

  res.status(201).json({ data: report });
});

export default router;
