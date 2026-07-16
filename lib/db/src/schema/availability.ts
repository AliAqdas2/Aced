import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  date,
} from "drizzle-orm/pg-core";
import { creatorProfilesTable } from "./creators";
import { listingsTable, serviceOffersTable } from "./listings";
import { usersTable } from "./users";

export const holdStatusEnum = pgEnum("hold_status", [
  "active",
  "expired",
  "converted",
  "released",
]);

export const availabilityRulesTable = pgTable("availability_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id, { onDelete: "cascade" }),
  serviceOfferId: uuid("service_offer_id").references(
    () => serviceOffersTable.id,
    { onDelete: "cascade" }
  ),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sun, 1=Mon, ..., 6=Sat
  startTimeUtc: text("start_time_utc").notNull(), // "HH:MM"
  endTimeUtc: text("end_time_utc").notNull(), // "HH:MM"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const availabilityExceptionsTable = pgTable("availability_exceptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id, { onDelete: "cascade" }),
  exceptionDate: date("exception_date", { mode: "string" }).notNull(),
  isBlocked: boolean("is_blocked").notNull().default(true),
  startTimeUtc: text("start_time_utc"),
  endTimeUtc: text("end_time_utc"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bookingHoldsTable = pgTable("booking_holds", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listingsTable.id),
  serviceOfferId: uuid("service_offer_id")
    .notNull()
    .references(() => serviceOffersTable.id),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => usersTable.id),
  holdStartsAt: timestamp("hold_starts_at", { withTimezone: true }).notNull(),
  holdEndsAt: timestamp("hold_ends_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  status: holdStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AvailabilityRule = typeof availabilityRulesTable.$inferSelect;
export type AvailabilityException =
  typeof availabilityExceptionsTable.$inferSelect;
export type BookingHold = typeof bookingHoldsTable.$inferSelect;
