---
name: Aced backend architecture
description: Key decisions, patterns and gotchas for the Aced API server (artifacts/api-server).
---

# Aced Backend Architecture

## Auth & session
Session in PostgreSQL via `connect-pg-simple`; cookie name `aced.sid`. Session holds `userId`, `role`, `email`.
Role hierarchy enforced via `ROLE_HIERARCHY` map in `middlewares/auth.ts`; `requireRole("creator")` also passes for admins.

## Money and time
All amounts stored as integer minor units (pence for GBP). Never floats. All timestamps UTC.

## Payments
Stripe Connect Express with destination charges. Platform fee computed server-side from `commissionRulesTable`.
**Why:** Never trust client-supplied fee amounts — all commission logic lives in `routes/v1/checkout.ts`.

## Webhook body parsing
`app.ts` mounts `express.raw({ type: '*/*' })` for `/api/v1/webhooks/stripe` BEFORE `express.json()`.
**Why:** Stripe signature verification requires the raw request Buffer. The webhook handler reads `req.body` directly as a Buffer — no secondary raw-body middleware needed in the route.

## Booking slot overlap
Canonical overlap check: `existing.start < newEnd && existing.end > newStart`. Used for both bookings and holds in `routes/v1/availability.ts`.
**Why:** OR-based point checks miss full-enclosure collisions where one interval entirely contains another.

## Creator application lifecycle
DB enum values (no "rejected"): draft → submitted → under_review → changes_requested → approved → suspended → closed.
**Why:** "rejected" in the API maps to "closed" in the DB enum (hard rejection, no path back). The route translates this in `admin/applications/:id/decision`.

## Asset download authorization
`POST /assets/:id/download-url` checks entitlement scoped to the specific asset (by `assetId`) OR the listing that owns that asset (by `listingId`).
**Why:** Fallback to "any active entitlement" would allow users with unrelated purchases to access private assets.

## Stripe API version
Use `"2026-06-24.dahlia"` when constructing `new Stripe(key, { apiVersion: ... })`.

## Storage abstraction
`lib/storage.ts` uses `require()` for AWS SDK at runtime (not `import`) to avoid hard type-level dependencies.
Dev mode returns mock URLs when `NODE_ENV !== 'production'` or `STORAGE_ENDPOINT` is unset.

## Codegen quirk
`orval v8.21.0` generates Zod v4 syntax; workspace catalog pins Zod v3. api-server uses Zod v3 directly and is unaffected. Fix before building the frontend: upgrade catalog or reconfigure orval.

## Env vars
Required: `DATABASE_URL`, `SESSION_SECRET`. Optional (graceful degradation): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SMTP_*`, `STORAGE_*`, `APP_URL`, `CORS_ORIGINS`.
