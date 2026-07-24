/**
 * Task #66 — Subscription credit refund on booking cancellation
 *
 * POST /v1/bookings/:id/cancel (library.ts)
 *
 * 1. Cancelling a confirmed subscription booking restores sessionsRemaining + 1
 * 2. Cancelling an already-terminal booking returns 409 — sequential double-cancel
 * 3. A concurrent "loser" (booking reads as confirmed but the atomic UPDATE gets
 *    0 rows back) returns 409 and does NOT restore a credit — proves the atomic
 *    WHERE guard prevents double-grant under concurrent requests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ---------------------------------------------------------------------------
// Shared mutable state
// ---------------------------------------------------------------------------
const mockDbState = {
  selectQueue: [] as any[][],
};

// Chainable Drizzle-like proxy — every method call returns itself;
// awaiting resolves via the `then` trap.
function makeChain(finalValue: () => any) {
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: any) => Promise.resolve(finalValue()).then(resolve);
        }
        return () => chain;
      },
    }
  );
  return chain;
}

// ---------------------------------------------------------------------------
// Module mocks (hoisted by Vitest before any import)
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({ __tableName: name } as any, {
      get(t, prop) {
        return prop in t ? t[prop] : `${name}.${String(prop)}`;
      },
    });

  const db = {
    select: () =>
      makeChain(() => {
        if (mockDbState.selectQueue.length > 0) {
          return mockDbState.selectQueue.shift();
        }
        return [];
      }),
    // update is overridden per-test via vi.spyOn
    update: () => makeChain(() => []),
    insert: () => makeChain(() => []),
  };

  return {
    db,
    entitlementsTable:         makeTable("entitlements"),
    listingsTable:             makeTable("listings"),
    productsTable:             makeTable("products"),
    assetsTable:               makeTable("assets"),
    bookingsTable:             makeTable("bookings"),
    serviceOffersTable:        makeTable("service_offers"),
    profilesTable:             makeTable("profiles"),
    creatorProfilesTable:      makeTable("creator_profiles"),
    learnerSubscriptionsTable: makeTable("learner_subscriptions"),
    ordersTable:               makeTable("orders"),
    platformConfigTable:       makeTable("platform_config"),
  };
});

vi.mock("drizzle-orm", () => ({
  eq:   (..._a: any[]) => "eq",
  and:  (..._a: any[]) => "and",
  or:   (..._a: any[]) => "or",
  desc: (..._a: any[]) => "desc",
}));

vi.mock("../../../lib/calendar-sync", () => ({
  syncBookingCancelled: () => Promise.resolve(),
}));

vi.mock("../../../lib/storage", () => ({
  generateDownloadUrl: () => Promise.resolve("https://example.com/asset"),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    refunds: { create: vi.fn().mockResolvedValue({ id: "re_test" }) },
  })),
}));

// ---------------------------------------------------------------------------
// App factory — imports the router fresh after vi.resetModules()
// ---------------------------------------------------------------------------
async function buildApp() {
  const { default: libraryRouter } = await import("../library");
  const app = express();
  app.use(express.json());
  // Inject a learner session
  app.use((req: any, _res, next) => {
    req.session = { userId: LEARNER_ID, role: "learner" };
    next();
  });
  app.use("/api/v1", libraryRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const LEARNER_ID = "aaaaaaaa-0000-4000-a000-000000000001";

const IDS = {
  booking: "bbbbbbbb-0000-4000-a000-000000000002",
  offer:   "cccccccc-0000-4000-a000-000000000003",
  creator: "dddddddd-0000-4000-a000-000000000004",
  sub:     "eeeeeeee-0000-4000-a000-000000000005",
};

const CONFIRMED_BOOKING = {
  id:               IDS.booking,
  learnerId:        LEARNER_ID,
  creatorId:        IDS.creator,
  serviceOfferId:   IDS.offer,
  listingId:        "ffffffff-0000-4000-a000-000000000006",
  status:           "confirmed",
  orderId:          null,   // free / subscription — no Stripe charge
  scheduledStartAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  scheduledEndAt:   new Date(Date.now() + 49 * 60 * 60 * 1000),
  cancellationReason: null,
};

const CANCELLED_BOOKING        = { ...CONFIRMED_BOOKING, status: "cancelled" };
const SUBSCRIPTION_OFFER       = { pricingMode: "subscription" };
const ACTIVE_SUB_ZERO_CREDITS  = {
  id:                IDS.sub,
  learnerId:         LEARNER_ID,
  serviceOfferId:    IDS.offer,
  status:            "active",
  sessionsRemaining: 0,
};

const CANCEL_BODY = { reason: "No longer available for this slot" };

// ---------------------------------------------------------------------------
// Helper — builds an update spy that:
//   • records every .set() payload into `setArgs`
//   • returns successive values from `returnValues` for each call
// ---------------------------------------------------------------------------
function makeUpdateSpy(returnValues: any[][], setArgs: any[]) {
  let callCount = 0;
  return vi.fn().mockImplementation(() => {
    const idx = callCount++;
    const chain: any = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: any) =>
              Promise.resolve(returnValues[idx] ?? []).then(resolve);
          }
          if (prop === "set") {
            return (args: any) => {
              setArgs.push(args);
              return chain;
            };
          }
          return () => chain;
        },
      }
    );
    return chain as any;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/v1/bookings/:id/cancel — subscription credit refund", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    mockDbState.selectQueue = [];
    app = await buildApp();
  });

  // ── Test 1: happy path ────────────────────────────────────────────────────
  it("restores one credit when a confirmed subscription booking is cancelled", async () => {
    // Select queue (in route execution order):
    // 1. booking lookup
    // 2. creatorProfile for learner's userId → empty (user is not a creator)
    // (no orderId → no order/refund-policy selects)
    // 3. serviceOffer pricingMode → subscription
    // 4. active learner subscription → 0 credits
    mockDbState.selectQueue = [
      [CONFIRMED_BOOKING],
      [],                        // no creatorProfile — user is the learner
      [SUBSCRIPTION_OFFER],
      [ACTIVE_SUB_ZERO_CREDITS],
    ];

    const setArgs: any[] = [];
    const { db } = await import("@workspace/db");
    vi.spyOn(db, "update").mockImplementation(
      makeUpdateSpy(
        [
          [{ ...CONFIRMED_BOOKING, status: "cancelled" }], // atomic booking update → 1 row
          [],                                               // credit restore update → void
        ],
        setArgs
      ) as any
    );

    const res = await request(app)
      .post(`/api/v1/bookings/${IDS.booking}/cancel`)
      .send(CANCEL_BODY);

    expect(res.status).toBe(200);

    // The subscription update must have incremented sessionsRemaining from 0 → 1
    const subUpdate = setArgs.find((a) => "sessionsRemaining" in a);
    expect(subUpdate).toBeDefined();
    expect(subUpdate.sessionsRemaining).toBe(1);
  });

  // ── Test 2: sequential double-cancel ─────────────────────────────────────
  it("returns 409 INVALID_STATUS when the booking is already cancelled", async () => {
    // Booking row is in terminal state — the atomic UPDATE WHERE status IN
    // ('confirmed','in_progress') matches 0 rows and returns an empty array.
    mockDbState.selectQueue = [
      [CANCELLED_BOOKING],
      [], // creatorProfile (learner is not a creator)
    ];

    const setArgs: any[] = [];
    const { db } = await import("@workspace/db");
    vi.spyOn(db, "update").mockImplementation(
      makeUpdateSpy(
        [[]], // atomic update finds 0 rows → no booking returned
        setArgs
      ) as any
    );

    const res = await request(app)
      .post(`/api/v1/bookings/${IDS.booking}/cancel`)
      .send(CANCEL_BODY);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATUS");

    // No subscription credit must have been written
    const subUpdate = setArgs.find((a) => "sessionsRemaining" in a);
    expect(subUpdate).toBeUndefined();
  });

  // ── Test 3: concurrent-loser scenario ─────────────────────────────────────
  it("returns 409 and does not restore a credit when another request won the atomic update race", async () => {
    // The booking SELECT returns 'confirmed' (read before the racing request
    // updated it), but the atomic UPDATE returns 0 rows — the other request
    // already transitioned the booking.
    mockDbState.selectQueue = [
      [CONFIRMED_BOOKING], // initial read: still looks cancellable
      [],                  // no creatorProfile — user is the learner
      // (no orderId → no order/refund-policy selects)
    ];

    const setArgs: any[] = [];
    const { db } = await import("@workspace/db");
    vi.spyOn(db, "update").mockImplementation(
      makeUpdateSpy(
        [[]], // atomic UPDATE returns 0 rows — lost the race
        setArgs
      ) as any
    );

    const res = await request(app)
      .post(`/api/v1/bookings/${IDS.booking}/cancel`)
      .send(CANCEL_BODY);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATUS");

    // Credit restore must NOT have run — only one request should ever win
    const subUpdate = setArgs.find((a) => "sessionsRemaining" in a);
    expect(subUpdate).toBeUndefined();
  });
});
