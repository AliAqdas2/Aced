/**
 * Calendar integration — sends .ics email attachments to both the creator
 * (tutor) and the learner when a booking is confirmed or cancelled.
 *
 * No OAuth credentials required. Both parties receive a calendar invite that
 * can be imported into any calendar app (Google, Outlook, Apple Calendar, etc).
 *
 * The meeting link (if any) appears in the invite's Location and Description
 * fields so it is visible directly inside the calendar event.
 *
 * Safe to call fire-and-forget — the exported functions never throw.
 */

import { db } from "@workspace/db";
import {
  bookingsTable,
  usersTable,
  listingsTable,
  creatorProfilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { format } from "date-fns";
import { sendEmailResilient } from "./email";

// ---------------------------------------------------------------------------
// ICS generation
// ---------------------------------------------------------------------------

function fmtUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildIcs({
  uid,
  summary,
  description,
  location,
  startAt,
  endAt,
  organizerEmail,
  method,
}: {
  uid: string;
  summary: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  organizerEmail: string;
  method: "REQUEST" | "CANCEL";
}): string {
  const status = method === "CANCEL" ? "CANCELLED" : "CONFIRMED";
  // Fold long lines to stay within the 75-octet RFC 5545 soft limit
  const fold = (s: string) =>
    s
      .match(/.{1,74}/g)!
      .join("\r\n ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Aced//Aced Tutoring//EN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    fold(`UID:${uid}`),
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(startAt)}`,
    `DTEND:${fmtUtc(endAt)}`,
    fold(`SUMMARY:${summary}`),
    fold(`DESCRIPTION:${description.replace(/\n/g, "\\n")}`),
    fold(`LOCATION:${location}`),
    fold(`ORGANIZER;CN=Aced:mailto:${organizerEmail}`),
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.join("\r\n");
}

// ---------------------------------------------------------------------------
// Public API — same signatures as the old OAuth calendar sync
// ---------------------------------------------------------------------------

export async function syncBookingCreated({
  bookingId,
  listingTitle,
  scheduledStartAt,
  scheduledEndAt,
  meetingLink,
  learnerId,
  creatorUserId,
}: {
  bookingId: string;
  listingTitle: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  meetingLink: string | null;
  learnerId: string;
  creatorUserId: string;
}): Promise<void> {
  try {
    const [[learner], [creator]] = await Promise.all([
      db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, learnerId))
        .limit(1),
      db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, creatorUserId))
        .limit(1),
    ]);

    if (!learner || !creator) return;

    const dateLabel = format(scheduledStartAt, "EEE, d MMM yyyy 'at' HH:mm 'UTC'");
    const location = meetingLink ?? "Online — your tutor will share a link";
    const description = [
      `Session: ${listingTitle}`,
      `When: ${dateLabel}`,
      meetingLink
        ? `Join here: ${meetingLink}`
        : "Your tutor will share a meeting link before the session.",
    ].join("\n");

    const ics = buildIcs({
      uid: `booking-${bookingId}@aced.co.uk`,
      summary: `Aced session: ${listingTitle}`,
      description,
      location,
      startAt: scheduledStartAt,
      endAt: scheduledEndAt,
      organizerEmail: creator.email,
      method: "REQUEST",
    });

    const attachment = {
      filename: "session.ics",
      content: ics,
      contentType: "text/calendar; method=REQUEST",
    };

    const subject = `Session confirmed — ${listingTitle} on ${format(scheduledStartAt, "EEE, d MMM")}`;

    const learnerHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#7B2FF7;">Your session is confirmed 🎉</h2>
        <p><strong>${listingTitle}</strong> is booked for <strong>${dateLabel}</strong>.</p>
        ${meetingLink ? `<p><a href="${meetingLink}" style="color:#7B2FF7;">Join the session</a></p>` : ""}
        <p style="color:#666;font-size:14px;">
          A calendar invite is attached — open it to add the session directly to
          Google Calendar, Outlook, or Apple Calendar.
        </p>
      </div>`;

    const creatorHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#7B2FF7;">New session booked</h2>
        <p>A learner has booked <strong>${listingTitle}</strong> for <strong>${dateLabel}</strong>.</p>
        ${meetingLink ? `<p>Meeting link: <a href="${meetingLink}" style="color:#7B2FF7;">${meetingLink}</a></p>` : ""}
        <p style="color:#666;font-size:14px;">
          A calendar invite is attached — open it to add the session to your calendar.
        </p>
      </div>`;

    await Promise.allSettled([
      sendEmailResilient(
        {
          to: learner.email,
          subject,
          html: learnerHtml,
          text: description,
          attachments: [attachment],
        },
        "booking_confirmation_learner"
      ),
      sendEmailResilient(
        {
          to: creator.email,
          subject,
          html: creatorHtml,
          text: description,
          attachments: [attachment],
        },
        "booking_confirmation_creator"
      ),
    ]);
  } catch (err) {
    // Never let calendar errors bubble up to the booking response
    console.error("calendar-sync syncBookingCreated error:", err);
  }
}

export async function syncBookingCancelled(bookingId: string): Promise<void> {
  try {
    const [booking] = await db
      .select({
        learnerId: bookingsTable.learnerId,
        listingId: bookingsTable.listingId,
        scheduledStartAt: bookingsTable.scheduledStartAt,
        scheduledEndAt: bookingsTable.scheduledEndAt,
      })
      .from(bookingsTable)
      .where(eq(bookingsTable.id, bookingId))
      .limit(1);

    if (!booking) return;

    const [[listing], [learner]] = await Promise.all([
      db
        .select({ title: listingsTable.title, creatorId: listingsTable.creatorId })
        .from(listingsTable)
        .where(eq(listingsTable.id, booking.listingId))
        .limit(1),
      db
        .select({ email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.id, booking.learnerId))
        .limit(1),
    ]);

    if (!listing || !learner) return;

    // Fetch creator email so we can send them a cancellation notice too
    const [cp] = await db
      .select({ userId: creatorProfilesTable.userId })
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.id, listing.creatorId))
      .limit(1);

    const [creator] = cp
      ? await db
          .select({ email: usersTable.email })
          .from(usersTable)
          .where(eq(usersTable.id, cp.userId))
          .limit(1)
      : [];

    const dateLabel = format(booking.scheduledStartAt, "EEE, d MMM yyyy 'at' HH:mm 'UTC'");

    const cancelIcs = buildIcs({
      uid: `booking-${bookingId}@aced.co.uk`,
      summary: `Cancelled: ${listing.title}`,
      description: `Your session on ${dateLabel} has been cancelled.`,
      location: "N/A",
      startAt: booking.scheduledStartAt,
      endAt: booking.scheduledEndAt,
      organizerEmail: "noreply@aced.co.uk",
      method: "CANCEL",
    });

    const attachment = {
      filename: "cancellation.ics",
      content: cancelIcs,
      contentType: "text/calendar; method=CANCEL",
    };

    const subject = `Session cancelled — ${listing.title} on ${format(booking.scheduledStartAt, "EEE, d MMM")}`;

    const recipients = [learner, ...(creator ? [creator] : [])];

    await Promise.allSettled(
      recipients.map((r) =>
        sendEmailResilient(
          {
            to: r.email,
            subject,
            html: `<p>Your session <strong>${listing.title}</strong> on <strong>${dateLabel}</strong> has been cancelled.</p>`,
            text: `Your session ${listing.title} on ${dateLabel} has been cancelled.`,
            attachments: [attachment],
          },
          "booking_cancellation"
        )
      )
    );
  } catch (err) {
    console.error("calendar-sync syncBookingCancelled error:", err);
  }
}
