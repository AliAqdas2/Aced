/**
 * Calendar sync service — creates and deletes events in Google Calendar and
 * Microsoft Outlook when bookings are confirmed or cancelled.
 *
 * Each (booking × user × provider) pair is tracked in bookingCalendarEventsTable
 * so learner + creator each get their own event, and a user connected to both
 * providers gets one event per provider.
 *
 * All operations are fire-and-forget safe — errors are logged but never thrown.
 */

import { db } from "@workspace/db";
import {
  calendarConnectionsTable,
  bookingCalendarEventsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { decrypt, encrypt } from "./crypto";

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

async function refreshGoogleToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`Google token refresh failed: ${JSON.stringify(data)}`);
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function refreshMicrosoftToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
      }),
    }
  );
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${JSON.stringify(data)}`);
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

async function getValidAccessToken(
  connection: typeof calendarConnectionsTable.$inferSelect
): Promise<string> {
  const bufferMs = 60_000;
  const now = Date.now();

  if (
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() - now > bufferMs
  ) {
    return decrypt(connection.encryptedAccessToken);
  }

  const refreshToken = decrypt(connection.encryptedRefreshToken);
  const newTokens =
    connection.provider === "google"
      ? await refreshGoogleToken(refreshToken)
      : await refreshMicrosoftToken(refreshToken);

  await db
    .update(calendarConnectionsTable)
    .set({
      encryptedAccessToken: encrypt(newTokens.accessToken),
      tokenExpiresAt: newTokens.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(calendarConnectionsTable.id, connection.id));

  return newTokens.accessToken;
}

// ---------------------------------------------------------------------------
// Google Calendar API v3
// ---------------------------------------------------------------------------

type EventPayload = {
  summary: string;
  description: string;
  startAt: Date;
  endAt: Date;
  location: string;
};

async function createGoogleEvent(
  accessToken: string,
  event: EventPayload
): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startAt.toISOString(), timeZone: "UTC" },
        end: { dateTime: event.endAt.toISOString(), timeZone: "UTC" },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 60 },
            { method: "popup", minutes: 15 },
          ],
        },
      }),
    }
  );
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`Google event creation failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function deleteGoogleEvent(
  accessToken: string,
  remoteEventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${remoteEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  // 204 No Content = success; 404/410 = already deleted (idempotent — treat as success)
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google event deletion failed (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Microsoft Graph API
// ---------------------------------------------------------------------------

async function createMicrosoftEvent(
  accessToken: string,
  event: EventPayload
): Promise<string> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.summary,
      body: { contentType: "Text", content: event.description },
      location: { displayName: event.location },
      start: { dateTime: event.startAt.toISOString(), timeZone: "UTC" },
      end: { dateTime: event.endAt.toISOString(), timeZone: "UTC" },
      isReminderOn: true,
      reminderMinutesBeforeStart: 15,
    }),
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(`Microsoft event creation failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

async function deleteMicrosoftEvent(
  accessToken: string,
  remoteEventId: string
): Promise<void> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${remoteEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  // 204 No Content = success; 404 = already deleted (idempotent — treat as success)
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`Microsoft event deletion failed (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type BookingEventData = {
  bookingId: string;
  listingTitle: string;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  meetingLink?: string | null;
  learnerId: string;
  creatorUserId: string; // user ID of the creator (not the creator profile ID)
};

/**
 * Create calendar events for both learner and creator across all their
 * connected providers. Each created event is tracked in bookingCalendarEventsTable.
 *
 * Safe to call fire-and-forget — errors are caught and logged.
 */
export async function syncBookingCreated(data: BookingEventData): Promise<void> {
  const { bookingId, listingTitle, scheduledStartAt, scheduledEndAt, meetingLink, learnerId, creatorUserId } = data;

  const location = meetingLink ?? "Online (link to be provided)";
  const description = meetingLink
    ? `Join your session here: ${meetingLink}`
    : "Your tutor will provide a meeting link before the session.";

  const event: EventPayload = {
    summary: `Aced Session: ${listingTitle}`,
    description,
    startAt: scheduledStartAt,
    endAt: scheduledEndAt,
    location,
  };

  // Sync for both participants independently and in parallel
  await Promise.allSettled([
    syncEventsForUser(bookingId, learnerId, event),
    syncEventsForUser(bookingId, creatorUserId, event),
  ]);
}

/**
 * Create calendar events in ALL connected providers for a single user.
 * Inserts a bookingCalendarEventsTable row for each created event.
 */
async function syncEventsForUser(
  bookingId: string,
  userId: string,
  event: EventPayload
): Promise<void> {
  const connections = await db
    .select()
    .from(calendarConnectionsTable)
    .where(eq(calendarConnectionsTable.userId, userId));

  if (connections.length === 0) return;

  await Promise.allSettled(
    connections.map(async (conn) => {
      try {
        const accessToken = await getValidAccessToken(conn);
        const remoteEventId =
          conn.provider === "google"
            ? await createGoogleEvent(accessToken, event)
            : await createMicrosoftEvent(accessToken, event);

        await db.insert(bookingCalendarEventsTable).values({
          bookingId,
          userId,
          provider: conn.provider as "google" | "microsoft",
          remoteEventId,
        });
      } catch (err) {
        console.error(
          `Calendar sync error (create) for user=${userId} provider=${conn.provider}:`,
          err
        );
      }
    })
  );
}

/**
 * Delete all calendar events tracked for a booking — for every participant
 * and every provider. Mapping rows are removed after each successful deletion.
 *
 * Safe to call fire-and-forget — errors are caught and logged.
 */
export async function syncBookingCancelled(bookingId: string): Promise<void> {
  const mappings = await db
    .select()
    .from(bookingCalendarEventsTable)
    .where(eq(bookingCalendarEventsTable.bookingId, bookingId));

  if (mappings.length === 0) return;

  await Promise.allSettled(
    mappings.map(async (mapping) => {
      // Find the user's connection for this provider
      const [conn] = await db
        .select()
        .from(calendarConnectionsTable)
        .where(
          and(
            eq(calendarConnectionsTable.userId, mapping.userId),
            eq(calendarConnectionsTable.provider, mapping.provider)
          )
        )
        .limit(1);

      if (conn) {
        try {
          const accessToken = await getValidAccessToken(conn);
          if (mapping.provider === "google") {
            await deleteGoogleEvent(accessToken, mapping.remoteEventId);
          } else {
            await deleteMicrosoftEvent(accessToken, mapping.remoteEventId);
          }
        } catch (err) {
          console.error(
            `Calendar sync error (delete) for user=${mapping.userId} provider=${mapping.provider}:`,
            err
          );
          // Do not remove the mapping row on failure — keeps it retryable
          return;
        }
      }
      // Remove the mapping row once the remote event is gone (or user disconnected)
      await db
        .delete(bookingCalendarEventsTable)
        .where(eq(bookingCalendarEventsTable.id, mapping.id));
    })
  );
}
