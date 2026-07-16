# Aced

Premium UK university creator marketplace where verified top students sell tutoring sessions and digital study products.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from the OpenAPI spec (note: Zod v3/v4 mismatch — see Gotchas)
- `pnpm --filter @workspace/db run push-force` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed dev database with test creators, listings and universities

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **API**: Express 5 — `artifacts/api-server`
- **DB**: PostgreSQL + Drizzle ORM — `lib/db`
- **Validation**: Zod v3 (inline in route handlers)
- **Auth**: express-session + connect-pg-simple (HTTP-only cookie `aced.sid`)
- **Payments**: Stripe Connect Express with destination charges
- **API codegen**: Orval — OpenAPI spec at `lib/api-spec/openapi.yaml`
- **Build**: esbuild (ESM bundle)

## Where things live

- `lib/db/src/schema/` — Drizzle table definitions (users, creators, listings, orders, etc.)
- `artifacts/api-server/src/routes/v1/` — all API route files
- `artifacts/api-server/src/middlewares/` — auth, session, error handler
- `artifacts/api-server/src/lib/` — auth helpers, email adapter, storage adapter, notifications
- `lib/api-spec/openapi.yaml` — OpenAPI 3.1 spec (source of truth for the API contract)
- `scripts/src/seed.ts` — dev seed data

## Architecture decisions

- **Session auth over JWT**: server-side session stored in PostgreSQL, invalidatable server-side. Cookie name: `aced.sid`.
- **Money as integer minor units**: all prices/fees stored as integers (pence for GBP). Never floats.
- **Immutable ledger**: payments write to `ledger_entries` (never update). Refunds add negative entries.
- **Stripe Connect Express + destination charges**: platform fee computed server-side in `checkout.ts` using `commissionRulesTable`. Never trust client-provided fee amounts.
- **Dev-mode degradation**: email logs to console, storage returns mock URLs, Stripe routes fail gracefully if `STRIPE_SECRET_KEY` is absent.

## Product

- **Learners** browse the marketplace, search by university/module/price, book 1-to-1 sessions, buy digital revision materials, and leave verified reviews.
- **Creators** (verified top students) apply for creator status, set up a storefront, list services and products, manage availability, and receive payouts via Stripe Connect.
- **Admins** review creator applications, moderate listings and reviews, handle disputes and refunds, and view GMV/earnings analytics.

## Environment variables

Required:
- `DATABASE_URL` — PostgreSQL connection string (Replit DB, already set)
- `SESSION_SECRET` — session signing secret (Replit secret, already set)

Optional (degrade gracefully in dev):
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — Stripe Connect payments
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — transactional email
- `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` — S3-compatible file storage
- `APP_URL` — used in redirect URLs (default: `http://localhost:5000`)
- `CORS_ORIGINS` — comma-separated allowed origins (default: `http://localhost:5173,http://localhost:3000`)

## Test accounts (dev seed)

| Role | Email | Password |
|---|---|---|
| Admin | admin@aced.co.uk | Admin@Aced2026! |
| Creator | sarah.chen@example.com | Creator@Aced2026! |
| Creator | james.okafor@example.com | Creator@Aced2026! |
| Creator | priya.sharma@example.com | Creator@Aced2026! |
| Creator | alex.williams@example.com | Creator@Aced2026! |
| Creator | emma.johnson@example.com | Creator@Aced2026! |
| Learner | learner@example.com | Learner@Aced2026! |

## Gotchas

- **Zod v3/v4 codegen mismatch**: The workspace catalog pins `zod: ^3.25.76` but `orval v8.21.0` generates Zod v4 syntax. The `pnpm --filter @workspace/api-spec run codegen` command generates files successfully but the typecheck step fails. The api-server itself is unaffected (uses Zod v3 directly). When building the frontend, either upgrade `zod` in the catalog to v4 or configure orval to target v3.
- **Stripe webhook raw body**: The `/api/v1/webhooks/stripe` route uses a custom raw body middleware to capture the raw request body for signature verification. Do not add `express.json()` to this route.
- **Role hierarchy**: Creator applicants have role `creator_applicant`; approved creators have role `creator`. The `requireRole` middleware checks hierarchy levels — `requireRole("creator")` passes for admins too.
- **Schema push**: Use `push-force` (not `push`) to avoid interactive prompts in CI: `pnpm --filter @workspace/db run push-force`

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
