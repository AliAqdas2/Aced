import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { universitiesTable, coursesTable } from "./taxonomy";
import { creatorProfilesTable, storefrontsTable } from "./creators";

export const listingTypeEnum = pgEnum("listing_type", [
  "service_offer",
  "digital_product",
  "recorded_course",
  "group_session",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "draft",
  "submitted",
  "approved",
  "published",
  "paused",
  "rejected",
  "archived",
]);

export const deliveryModeEnum = pgEnum("delivery_mode", [
  "online",
  "in_person",
  "hybrid",
]);

export const licenceTypeEnum = pgEnum("licence_type", [
  "personal",
  "personal_non_commercial",
  "educational",
]);

export const listingsTable = pgTable("listings", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id, { onDelete: "cascade" }),
  storefrontId: uuid("storefront_id")
    .notNull()
    .references(() => storefrontsTable.id),
  type: listingTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  tags: text("tags").array().notNull().default([]),
  primaryUniversityId: uuid("primary_university_id").references(
    () => universitiesTable.id
  ),
  primaryCourseId: uuid("primary_course_id").references(() => coursesTable.id),
  status: listingStatusEnum("status").notNull().default("draft"),
  moderationNotes: text("moderation_notes"),
  moderatedBy: uuid("moderated_by").references(() => usersTable.id),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  viewCount: integer("view_count").notNull().default(0),
  purchaseCount: integer("purchase_count").notNull().default(0),
  averageRating: integer("average_rating"),
  reviewCount: integer("review_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const serviceOffersTable = pgTable("service_offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .unique()
    .references(() => listingsTable.id, { onDelete: "cascade" }),
  durationMinutes: integer("duration_minutes").notNull(),
  deliveryMode: deliveryModeEnum("delivery_mode").notNull().default("online"),
  maxCapacity: integer("max_capacity").notNull().default(1),
  bookingHorizonDays: integer("booking_horizon_days").notNull().default(60),
  cancellationHoursNotice: integer("cancellation_hours_notice")
    .notNull()
    .default(24),
  videoMeetingLink: text("video_meeting_link"),
  bufferMinutesBefore: integer("buffer_minutes_before").notNull().default(0),
  bufferMinutesAfter: integer("buffer_minutes_after").notNull().default(0),
  minNoticeHours: integer("min_notice_hours").notNull().default(24),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const productsTable = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .unique()
    .references(() => listingsTable.id, { onDelete: "cascade" }),
  previewAssetId: uuid("preview_asset_id"),
  paidAssetId: uuid("paid_asset_id"),
  version: text("version").notNull().default("1.0"),
  versionNotes: text("version_notes"),
  licenceType: licenceTypeEnum("licence_type").notNull().default("personal"),
  downloadLimit: integer("download_limit"),
  pageCount: integer("page_count"),
  fileFormat: text("file_format"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const priceRecordsTable = pgTable("price_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listingsTable.id, { onDelete: "cascade" }),
  amountMinorUnits: integer("amount_minor_units").notNull(),
  currency: text("currency").notNull().default("GBP"),
  isActive: boolean("is_active").notNull().default(true),
  validFrom: timestamp("valid_from", { withTimezone: true })
    .notNull()
    .defaultNow(),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Listing = typeof listingsTable.$inferSelect;
export type ServiceOffer = typeof serviceOffersTable.$inferSelect;
export type Product = typeof productsTable.$inferSelect;
export type PriceRecord = typeof priceRecordsTable.$inferSelect;
