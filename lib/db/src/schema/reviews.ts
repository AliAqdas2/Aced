import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { creatorProfilesTable } from "./creators";
import { listingsTable } from "./listings";
import { orderItemsTable } from "./orders";

export const reviewStatusEnum = pgEnum("review_status", [
  "published",
  "flagged",
  "removed",
]);

export const reviewsTable = pgTable("reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .unique()
    .references(() => orderItemsTable.id),
  reviewerId: uuid("reviewer_id")
    .notNull()
    .references(() => usersTable.id),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listingsTable.id),
  overallRating: integer("overall_rating").notNull(),
  knowledgeRating: integer("knowledge_rating"),
  communicationRating: integer("communication_rating"),
  usefulnessRating: integer("usefulness_rating"),
  body: text("body"),
  status: reviewStatusEnum("status").notNull().default("published"),
  creatorResponse: text("creator_response"),
  creatorRespondedAt: timestamp("creator_responded_at", { withTimezone: true }),
  moderatedBy: uuid("moderated_by").references(() => usersTable.id),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Review = typeof reviewsTable.$inferSelect;
