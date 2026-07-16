import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core";

export const universityStatusEnum = pgEnum("university_status", [
  "active",
  "retired",
]);

export const moduleProposalStatusEnum = pgEnum("module_proposal_status", [
  "pending",
  "approved",
  "rejected",
]);

export const countriesTable = pgTable("countries", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const universitiesTable = pgTable("universities", {
  id: uuid("id").defaultRandom().primaryKey(),
  countryId: uuid("country_id")
    .notNull()
    .references(() => countriesTable.id),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: universityStatusEnum("status").notNull().default("active"),
  website: text("website"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const universityAliasesTable = pgTable("university_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universitiesTable.id, { onDelete: "cascade" }),
  alias: text("alias").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const coursesTable = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  universityId: uuid("university_id")
    .notNull()
    .references(() => universitiesTable.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  faculty: text("faculty"),
  level: text("level"),
  durationYears: integer("duration_years"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const modulesTable = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => coursesTable.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  code: text("code"),
  academicYear: text("academic_year"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const moduleProposalsTable = pgTable("module_proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  proposedByCreatorId: uuid("proposed_by_creator_id").notNull(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => coursesTable.id),
  proposedName: text("proposed_name").notNull(),
  code: text("code"),
  status: moduleProposalStatusEnum("status").notNull().default("pending"),
  reviewerId: uuid("reviewer_id"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Country = typeof countriesTable.$inferSelect;
export type University = typeof universitiesTable.$inferSelect;
export type Course = typeof coursesTable.$inferSelect;
export type Module = typeof modulesTable.$inferSelect;
