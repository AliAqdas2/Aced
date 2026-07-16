import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const reportCategoryEnum = pgEnum("report_category", [
  "academic_misconduct",
  "copyright_infringement",
  "spam",
  "harassment",
  "fraud",
  "inappropriate_content",
  "other",
]);

export const reportPriorityEnum = pgEnum("report_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "under_review",
  "resolved",
  "dismissed",
]);

export const reportSubjectTypeEnum = pgEnum("report_subject_type", [
  "user",
  "listing",
  "review",
  "message",
  "asset",
]);

export const webhookProcessingStatusEnum = pgEnum("webhook_processing_status", [
  "pending",
  "processed",
  "failed",
  "duplicate",
]);

export const reportsCasesTable = pgTable("reports_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  reporterId: uuid("reporter_id")
    .notNull()
    .references(() => usersTable.id),
  subjectType: reportSubjectTypeEnum("subject_type").notNull(),
  subjectId: uuid("subject_id").notNull(),
  category: reportCategoryEnum("category").notNull(),
  description: text("description").notNull(),
  evidenceRefs: text("evidence_refs").array().notNull().default([]),
  priority: reportPriorityEnum("priority").notNull().default("medium"),
  status: reportStatusEnum("status").notNull().default("open"),
  assignedTo: uuid("assigned_to").references(() => usersTable.id),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorId: uuid("actor_id").references(() => usersTable.id),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: uuid("target_id"),
  summary: text("summary"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const webhookEventsTable = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payloadHash: text("payload_hash").notNull(),
  processingStatus: webhookProcessingStatusEnum("processing_status")
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const platformConfigTable = pgTable("platform_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedBy: uuid("updated_by").references(() => usersTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ReportCase = typeof reportsCasesTable.$inferSelect;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
