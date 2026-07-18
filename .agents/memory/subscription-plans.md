---
name: Subscription plans architecture
description: How weekly/monthly session credit subscriptions work — DB schema, Stripe flow, credit enforcement, and key gotchas.
---

# Subscription Plans Architecture

## Schema (lib/db/src/schema/subscriptions.ts)
- `subscriptionPlansTable` — one row per service offer; stores billingInterval, sessionsPerPeriod, amountMinorUnits, stripePriceId, stripeProductId (both nullable until first subscriber)
- `learnerSubscriptionsTable` — one row per learner × plan; tracks stripeSubscriptionId, sessionsRemaining, status, currentPeriodEnd, cancelAtPeriodEnd
- `serviceOffersTable.pricingMode` — new enum field (per_session | subscription), default per_session
- `usersTable.stripeCustomerId` — one Stripe Customer per platform user (for subscription billing)

## Stripe Objects
- Stripe Product + Price are created **lazily** in `POST /v1/bookings/subscribe` if stripePriceId is null
- Stripe Customer is created lazily in the same endpoint and saved to usersTable.stripeCustomerId
- Subscription mode checkout uses `subscription_data.application_fee_percent` (not application_fee_amount) for Connect

## Webhook Flow (artifacts/api-server/src/routes/v1/checkout.ts handleStripeEvent)
- `invoice.paid` — upserts learnerSubscription, always resets sessionsRemaining = plan.sessionsPerPeriod
- `customer.subscription.updated` — syncs status (past_due, etc.) and cancelAtPeriodEnd
- `customer.subscription.deleted` — marks status = expired
- Note: Invoice type needs cast `Stripe.Invoice & { subscription?: string }` to access subscription field

## Credit Enforcement (artifacts/api-server/src/routes/v1/availability.ts)
- `POST /bookings/confirm` checks offer.pricingMode first
- If subscription: requires active learnerSubscription with sessionsRemaining > 0; decrements after booking is created
- If per_session: existing free check (amountMinorUnits === 0)
- Credit refund on cancel: library.ts POST /bookings/:id/cancel increments sessionsRemaining for subscription bookings

## Routes (artifacts/api-server/src/routes/v1/subscriptions.ts)
- POST /creator/subscription-plans — upsert plan (no Stripe yet)
- POST /bookings/subscribe — create Stripe Checkout, lazy-create Stripe objects
- GET /me/subscriptions — learner list
- POST /me/subscriptions/:id/cancel — cancel_at_period_end via Stripe
- GET /creator/subscribers — creator view of all subscribers

## Key Gotcha
- The public listing detail route (GET /v1/listings/:id) does NOT yet return subscription plan data — needed for learner subscribe flow (Task #32)

**Why:** Stripe Connect requires subscription checkout on platform, not connected account. Use application_fee_percent not application_fee_amount for recurring charges.
