import {
  pgTable,
  pgEnum,
  text,
  boolean,
  timestamp,
  uuid,
  integer,
  jsonb,
  date,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { universitiesTable, coursesTable, modulesTable } from "./taxonomy";

export const creatorStatusEnum = pgEnum("creator_status", [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "suspended",
  "closed",
]);

export const stripeAccountStatusEnum = pgEnum("stripe_account_status", [
  "not_started",
  "pending",
  "active",
  "restricted",
  "disabled",
]);

export const verificationStatusEnum = pgEnum("verification_status", [
  "not_started",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "expired",
]);

export const commissionScopeEnum = pgEnum("commission_scope", [
  "global",
  "creator",
  "category",
]);

export const videoCallProviderEnum = pgEnum("video_call_provider", [
  "zoom",
  "teams",
  "meet",
  "custom",
]);

export const creatorProfilesTable = pgTable("creator_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: creatorStatusEnum("status").notNull().default("draft"),
  headline: text("headline"),
  stripeAccountId: text("stripe_account_id"),
  stripeAccountStatus: stripeAccountStatusEnum("stripe_account_status")
    .notNull()
    .default("not_started"),
  responseRate: integer("response_rate"),
  responseTimeHours: integer("response_time_hours"),
  completedSessions: integer("completed_sessions").notNull().default(0),
  totalSales: integer("total_sales").notNull().default(0),
  averageRating: integer("average_rating"),
  reviewCount: integer("review_count").notNull().default(0),
  reviewNotes: text("review_notes"),
  videoCallProvider: videoCallProviderEnum("video_call_provider"),
  videoCallLink: text("video_call_link"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const creatorVerificationsTable = pgTable("creator_verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id, { onDelete: "cascade" }),
  claimType: text("claim_type").notNull(),
  evidenceRef: text("evidence_ref").notNull(),
  evidenceFileName: text("evidence_file_name").notNull(),
  status: verificationStatusEnum("status").notNull().default("submitted"),
  reviewerId: uuid("reviewer_id").references(() => usersTable.id),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const creatorExpertiseTable = pgTable("creator_expertise", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id, { onDelete: "cascade" }),
  universityId: uuid("university_id").references(() => universitiesTable.id),
  courseId: uuid("course_id").references(() => coursesTable.id),
  moduleId: uuid("module_id").references(() => modulesTable.id),
  graduationYear: integer("graduation_year"),
  academicResult: text("academic_result"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const storefrontsTable = pgTable("storefronts", {
  id: uuid("id").defaultRandom().primaryKey(),
  creatorId: uuid("creator_id")
    .notNull()
    .unique()
    .references(() => creatorProfilesTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  displayName: text("display_name").notNull(),
  coverImageUrl: text("cover_image_url"),
  introVideoUrl: text("intro_video_url"),
  bio: text("bio").notNull().default(""),
  policies: text("policies"),
  faqJson: jsonb("faq_json"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const commissionRulesTable = pgTable("commission_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  scope: commissionScopeEnum("scope").notNull().default("global"),
  scopeId: uuid("scope_id"),
  offerType: text("offer_type"),
  rateBasisPoints: integer("rate_basis_points").notNull(),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  isActive: boolean("is_active").notNull().default(true),
  description: text("description"),
  createdBy: uuid("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type VideoCallProvider = typeof videoCallProviderEnum.enumValues[number];
export type CreatorProfile = typeof creatorProfilesTable.$inferSelect;
export type CreatorVerification = typeof creatorVerificationsTable.$inferSelect;
export type Storefront = typeof storefrontsTable.$inferSelect;
export type CommissionRule = typeof commissionRulesTable.$inferSelect;
