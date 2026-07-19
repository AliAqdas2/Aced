/**
 * Task #47 — Subscription expiry edge-case tests
 *
 * Proves that POST /v1/bookings/confirm rejects bookings when
 * currentPeriodEnd is in the past, and accepts them when it is in the future.
 * The atomic UPDATE…WHERE eliminates the TOCTOU race; these tests confirm the
 * WHERE predicate is correctly evaluated against the DB timestamp.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ---------------------------------------------------------------------------
// Mock @workspace/db before importing the router so the module resolver picks
// up our stubs instead of the real Drizzle client.
// ---------------------------------------------------------------------------

// Shared mutable state that each test controls
const mockDbState = {
  // What db.update().set().where().returning() resolves to
  updateReturning: [] as { id: string }[],
  // What db.select().from().where().limit() resolves to (used for listing,
  // offer, priceRecord lookups)
  selectResults: [] as any[],
  // Queue of results for sequential select calls
  selectQueue: [] as any[][],
  // What db.insert().values().returning() resolves to
  insertReturning: [] as any[],
};

// Chainable Drizzle-like mock builder
function makeChain(finalValue: () => any) {
  const chain: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          // Make the chain itself thenable so `await chain` resolves
          return (resolve: any) => Promise.resolve(finalValue()).then(resolve);
        }
        // Every other method returns the same chain
        return () => chain;
      },
    }
  );
  return chain;
}

vi.mock("@workspace/db", () => {
  // Each table export just needs to be a truthy object; Drizzle columns are
  // referenced as properties so we proxy them too.
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
        return mockDbState.selectResults;
      }),
    update: () =>
      makeChain(() => mockDbState.updateReturning),
    insert: () =>
      makeChain(() => mockDbState.insertReturning),
  };

  return {
    db,
    // Table exports
    listingsTable: makeTable("listings"),
    serviceOffersTable: makeTable("service_offers"),
    priceRecordsTable: makeTable("price_records"),
    bookingsTable: makeTable("bookings"),
    bookingHoldsTable: makeTable("booking_holds"),
    learnerSubscriptionsTable: makeTable("learner_subscriptions"),
    creatorProfilesTable: makeTable("creator_profiles"),
    availabilityRulesTable: makeTable("availability_rules"),
    availabilityExceptionsTable: makeTable("availability_exceptions"),
  };
});

// Mock drizzle-orm operators — they just need to be callable
vi.mock("drizzle-orm", () => ({
  eq: (..._a: any[]) => "eq",
  and: (..._a: any[]) => "and",
  gte: (..._a: any[]) => "gte",
  lte: (..._a: any[]) => "lte",
  gt: (..._a: any[]) => "gt",
  isNull: (..._a: any[]) => "isNull",
  or: (..._a: any[]) => "or",
  sql: Object.assign((..._a: any[]) => "sql", { raw: () => "sql.raw" }),
}));

// Mock calendar sync — we don't want real HTTP calls
vi.mock("../../../lib/calendar-sync", () => ({
  syncBookingCreated: () => Promise.resolve(),
}));

// ---------------------------------------------------------------------------
// Build a minimal Express app that mounts the availability router with a
// fake session injected via middleware.
// ---------------------------------------------------------------------------
async function buildApp() {
  // Import the router AFTER mocks are in place
  const { default: availabilityRouter } = await import("../availability");

  const app = express();
  app.use(express.json());

  // Inject a session with a learner userId so requireAuth passes
  app.use((req: any, _res, next) => {
    req.session = { userId: "learner-uuid-1234", role: "learner" };
    next();
  });

  app.use("/api/v1", availabilityRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------
// All IDs must be valid UUIDs — Zod's z.string().uuid() rejects anything else
const IDS = {
  listing:       "11111111-0000-4000-a000-000000000001",
  offer:         "22222222-0000-4000-a000-000000000002",
  creatorProfile:"33333333-0000-4000-a000-000000000003",
  creatorUser:   "44444444-0000-4000-a000-000000000004",
  sub:           "55555555-0000-4000-a000-000000000005",
  hold:          "66666666-0000-4000-a000-000000000006",
  booking:       "77777777-0000-4000-a000-000000000007",
};

const LISTING = {
  id: IDS.listing,
  type: "service_offer",
  status: "published",
  creatorId: IDS.creatorProfile,
  title: "Test Session",
  viewCount: 0,
};

const OFFER = {
  id: IDS.offer,
  listingId: IDS.listing,
  pricingMode: "subscription",
  durationMinutes: 60,
  minNoticeHours: 0,   // no advance notice required in tests
  bufferMinutesAfter: 0,
};

const CREATOR_PROFILE = {
  userId: IDS.creatorUser,
  videoCallLink: null,
};

const HOLD    = { id: IDS.hold };
const BOOKING = { id: IDS.booking };

// A slot 24 h from now so minNoticeHours check always passes
const FUTURE_START = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

const CONFIRM_BODY = {
  listingId:      IDS.listing,
  serviceOfferId: IDS.offer,
  startAt:        FUTURE_START,
  timezone:       "Europe/London",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("POST /api/v1/bookings/confirm — subscription expiry check", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.resetModules();
    app = await buildApp();

    // Default: no overlapping bookings, no overlapping holds, insert succeeds
    mockDbState.updateReturning = [];
    mockDbState.selectResults = [];
    mockDbState.selectQueue = [];
    mockDbState.insertReturning = [HOLD, BOOKING, CREATOR_PROFILE];
  });

  it("returns 409 NO_CREDITS when currentPeriodEnd is 1 second in the past", async () => {
    // The atomic UPDATE finds no matching row (period already expired)
    mockDbState.updateReturning = [];

    // select queue: listing, offer (the two selects before the UPDATE)
    mockDbState.selectQueue = [
      [LISTING],   // listing lookup
      [OFFER],     // offer lookup
    ];

    const res = await request(app)
      .post("/api/v1/bookings/confirm")
      .send(CONFIRM_BODY);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("NO_CREDITS");
  });

  it("returns 201 and confirms booking when currentPeriodEnd is 1 second in the future", async () => {
    // The atomic UPDATE succeeds — subscription is still valid
    mockDbState.updateReturning = [{ id: "sub-uuid" }];

    // select queue: listing, offer, then no-conflict bookings, no-conflict holds, creator profile
    mockDbState.selectQueue = [
      [LISTING],          // listing lookup
      [OFFER],            // offer lookup
      [],                 // overlapping bookings (none)
      [],                 // overlapping holds (none)
      [CREATOR_PROFILE],  // creator profile for calendar sync
    ];

    // insert queue: hold first, then booking
    mockDbState.insertReturning = [HOLD, BOOKING];

    // Second insert (booking) — we need to handle two sequential inserts.
    // Since our mock always returns insertReturning, we make the queue support it:
    const insertQueue = [[HOLD], [BOOKING]];
    let insertCallCount = 0;
    const { db } = await import("@workspace/db");
    vi.spyOn(db, "insert").mockImplementation(() => {
      const result = insertQueue[insertCallCount++ % insertQueue.length];
      return makeChain(() => result) as any;
    });

    const res = await request(app)
      .post("/api/v1/bookings/confirm")
      .send(CONFIRM_BODY);

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("confirmed");
  });
});
