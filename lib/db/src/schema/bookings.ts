import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { creatorProfilesTable } from "./creators";
import { listingsTable, serviceOffersTable } from "./listings";

export const bookingStatusEnum = pgEnum("booking_status", [
  "held",
  "pending_payment",
  "confirmed",
  "rescheduled",
  "cancelled",
  "in_progress",
  "completed",
  "no_show",
  "disputed",
  "refunded",
]);

export const bookingsTable = pgTable("bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  holdId: uuid("hold_id"),
  orderId: uuid("order_id"),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => usersTable.id),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id),
  serviceOfferId: uuid("service_offer_id")
    .notNull()
    .references(() => serviceOffersTable.id),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listingsTable.id),
  scheduledStartAt: timestamp("scheduled_start_at", {
    withTimezone: true,
  }).notNull(),
  scheduledEndAt: timestamp("scheduled_end_at", {
    withTimezone: true,
  }).notNull(),
  status: bookingStatusEnum("status").notNull().default("held"),
  meetingLink: text("meeting_link"),
  learnerTimezone: text("learner_timezone").notNull().default("Europe/London"),
  cancellationReason: text("cancellation_reason"),
  disputeNotes: text("dispute_notes"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Booking = typeof bookingsTable.$inferSelect;
