import { pgTable, pgEnum, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { bookingsTable } from "./bookings";

export const calendarProviderEnum2 = pgEnum("calendar_event_provider", ["google", "microsoft"]);

/**
 * Tracks each remote calendar event created for a booking.
 * One row per (booking × user × provider) so that:
 *  - learner and creator each get their own event
 *  - a user connected to both Google and Microsoft gets two events
 *  - all remote event IDs are stored and independently deletable
 */
export const bookingCalendarEventsTable = pgTable("booking_calendar_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookingsTable.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  provider: calendarProviderEnum2("provider").notNull(),
  remoteEventId: text("remote_event_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingCalendarEvent = typeof bookingCalendarEventsTable.$inferSelect;
