/**
 * Task #92 — Calendar sync meeting-link tests
 *
 * Verifies that:
 * 1. syncBookingMeetingLinkUpdated sends an updated .ics to both parties with
 *    the new meeting link in the Location and Description fields.
 * 2. syncBookingCreated (the "reconnect" scenario) uses the meetingLink that
 *    is passed in — which at call-time is always read from the booking record —
 *    so a reconnect after a link change automatically picks up the current link.
 * 3. When meetingLink is null, both functions fall back to the placeholder
 *    "share a link" text rather than leaving Location empty or crashing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DB mock — must come before any import that pulls in @workspace/db
// ---------------------------------------------------------------------------

const LEARNER_EMAIL  = "learner@example.com";
const CREATOR_EMAIL  = "creator@example.com";
const LISTING_TITLE  = "Advanced Maths Tutoring";

const BOOKING = {
  learnerId:       "aaaaaaaa-0000-4000-a000-000000000001",
  listingId:       "bbbbbbbb-0000-4000-a000-000000000002",
  creatorId:       "cccccccc-0000-4000-a000-000000000003",
  scheduledStartAt: new Date("2026-08-10T14:00:00Z"),
  scheduledEndAt:   new Date("2026-08-10T15:00:00Z"),
};

// selectQueue drives sequential db.select calls in each test
const selectQueue: any[][] = [];

vi.mock("@workspace/db", () => {
  const makeTable = (name: string) =>
    new Proxy({ __tableName: name } as any, {
      get(t, prop) { return prop in t ? t[prop] : `${name}.${String(prop)}`; },
    });

  const makeChain = (getValue: () => any) => {
    const chain: any = new Proxy({}, {
      get(_t, prop) {
        if (prop === "then") return (resolve: any) => Promise.resolve(getValue()).then(resolve);
        return () => chain;
      },
    });
    return chain;
  };

  const db = {
    select: () => makeChain(() => selectQueue.shift() ?? []),
    update: () => makeChain(() => []),
    insert: () => makeChain(() => []),
  };

  return {
    db,
    bookingsTable:        makeTable("bookings"),
    listingsTable:        makeTable("listings"),
    usersTable:           makeTable("users"),
    creatorProfilesTable: makeTable("creator_profiles"),
  };
});

vi.mock("drizzle-orm", () => ({
  eq:  (..._a: any[]) => "eq",
  and: (..._a: any[]) => "and",
}));

// Capture every sendEmailResilient call
const sentEmails: Array<{ to: string; subject: string; html: string; icsContent?: string }> = [];

vi.mock("../../../lib/email", () => ({
  sendEmailResilient: async (payload: any) => {
    sentEmails.push({
      to:      payload.to,
      subject: payload.subject,
      html:    payload.html,
      icsContent: payload.attachments?.[0]?.content ?? null,
    });
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedSelectsForMeetingLinkUpdated(creatorProfileUserId: string) {
  // syncBookingMeetingLinkUpdated: booking → [listing, learner, cp] → creator
  selectQueue.push(
    [BOOKING],                                        // booking lookup
    [{ title: LISTING_TITLE }],                       // listing
    [{ email: LEARNER_EMAIL }],                       // learner user
    [{ userId: creatorProfileUserId }],               // creator profile
    [{ email: CREATOR_EMAIL }],                       // creator user
  );
}

function seedSelectsForBookingCreated(learnerId: string, creatorUserId: string) {
  // syncBookingCreated: [learner, creator] in parallel
  selectQueue.push(
    [{ email: LEARNER_EMAIL }],   // learner
    [{ email: CREATOR_EMAIL }],   // creator
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("syncBookingMeetingLinkUpdated", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    sentEmails.length = 0;
  });

  it("sends updated .ics to both learner and creator with the new meeting link", async () => {
    const { syncBookingMeetingLinkUpdated } = await import("../../../lib/calendar-sync");

    const CREATOR_PROFILE_USER = "dddddddd-0000-4000-a000-000000000004";
    seedSelectsForMeetingLinkUpdated(CREATOR_PROFILE_USER);

    const newLink = "https://meet.google.com/new-room-abc";
    await syncBookingMeetingLinkUpdated("booking-id-123", newLink);

    expect(sentEmails).toHaveLength(2);

    const [learnerEmail, creatorEmail] = sentEmails;

    // Correct recipients
    expect(learnerEmail.to).toBe(LEARNER_EMAIL);
    expect(creatorEmail.to).toBe(CREATOR_EMAIL);

    // Subject signals an update
    expect(learnerEmail.subject).toMatch(/updated/i);

    // Meeting link appears in both email bodies
    expect(learnerEmail.html).toContain(newLink);
    expect(creatorEmail.html).toContain(newLink);

    // Meeting link appears in both .ics LOCATION and DESCRIPTION
    expect(learnerEmail.icsContent).toContain(`LOCATION:${newLink}`);
    expect(learnerEmail.icsContent).toContain(`Join here: ${newLink}`);
    expect(creatorEmail.icsContent).toContain(`LOCATION:${newLink}`);
    expect(creatorEmail.icsContent).toContain(`Join here: ${newLink}`);

    // Both invites carry the same UID so calendar clients update the existing event
    // UID format: "booking-{bookingId}@acedtutoring.co.uk"
    expect(learnerEmail.icsContent).toContain("UID:booking-booking-id-123@acedtutoring.co.uk");
    expect(creatorEmail.icsContent).toContain("UID:booking-booking-id-123@acedtutoring.co.uk");

    // Method must be REQUEST (not CANCEL) so clients update rather than delete
    expect(learnerEmail.icsContent).toContain("METHOD:REQUEST");
  });

  it("falls back to placeholder text when meetingLink is null", async () => {
    const { syncBookingMeetingLinkUpdated } = await import("../../../lib/calendar-sync");

    const CREATOR_PROFILE_USER = "dddddddd-0000-4000-a000-000000000004";
    seedSelectsForMeetingLinkUpdated(CREATOR_PROFILE_USER);

    await syncBookingMeetingLinkUpdated("booking-id-456", null);

    expect(sentEmails).toHaveLength(2);

    const [learnerEmail] = sentEmails;

    // Placeholder text in email body
    expect(learnerEmail.html).toContain("will share a meeting link");

    // Placeholder text in .ics Location (no real URL)
    expect(learnerEmail.icsContent).toContain("LOCATION:Online");
    expect(learnerEmail.icsContent).not.toContain("LOCATION:https://");

    // Description falls back too
    expect(learnerEmail.icsContent).toContain("will share a meeting link");
  });
});

describe("syncBookingCreated — reconnect scenario", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    sentEmails.length = 0;
  });

  it("uses the meetingLink passed in, which reflects the current booking record", async () => {
    const { syncBookingCreated } = await import("../../../lib/calendar-sync");

    const LEARNER_ID       = "eeeeeeee-0000-4000-a000-000000000005";
    const CREATOR_USER_ID  = "ffffffff-0000-4000-a000-000000000006";
    seedSelectsForBookingCreated(LEARNER_ID, CREATOR_USER_ID);

    // Simulate a reconnect after the link was changed — caller supplies current link
    const currentLink = "https://zoom.us/j/updated-link-after-reconnect";

    await syncBookingCreated({
      bookingId:        "booking-reconnect-1",
      listingTitle:     LISTING_TITLE,
      scheduledStartAt: new Date("2026-08-15T10:00:00Z"),
      scheduledEndAt:   new Date("2026-08-15T11:00:00Z"),
      meetingLink:      currentLink,
      learnerId:        LEARNER_ID,
      creatorUserId:    CREATOR_USER_ID,
    });

    expect(sentEmails).toHaveLength(2);

    const [learnerEmail, creatorEmail] = sentEmails;

    // Both emails contain the current link
    expect(learnerEmail.html).toContain(currentLink);
    expect(creatorEmail.html).toContain(currentLink);

    // .ics Location and Description carry the link
    expect(learnerEmail.icsContent).toContain(`LOCATION:${currentLink}`);
    expect(learnerEmail.icsContent).toContain(`Join here: ${currentLink}`);
  });

  it("sends placeholder text when meetingLink is null at booking creation time", async () => {
    const { syncBookingCreated } = await import("../../../lib/calendar-sync");

    const LEARNER_ID       = "11111111-1111-4000-a000-000000000011";
    const CREATOR_USER_ID  = "22222222-2222-4000-a000-000000000022";
    seedSelectsForBookingCreated(LEARNER_ID, CREATOR_USER_ID);

    await syncBookingCreated({
      bookingId:        "booking-no-link",
      listingTitle:     LISTING_TITLE,
      scheduledStartAt: new Date("2026-08-20T09:00:00Z"),
      scheduledEndAt:   new Date("2026-08-20T10:00:00Z"),
      meetingLink:      null,
      learnerId:        LEARNER_ID,
      creatorUserId:    CREATOR_USER_ID,
    });

    expect(sentEmails).toHaveLength(2);

    const [learnerEmail] = sentEmails;
    expect(learnerEmail.html).not.toContain("https://");
    expect(learnerEmail.icsContent).toContain("LOCATION:Online");
    expect(learnerEmail.icsContent).not.toContain("LOCATION:https://");
  });
});
