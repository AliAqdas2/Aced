import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable } from "./listings";
import { ordersTable } from "./orders";

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
  "push",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
  "skipped",
]);

export const conversationsTable = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId: uuid("listing_id").references(() => listingsTable.id),
  orderId: uuid("order_id").references(() => ordersTable.id),
  participantA: uuid("participant_a")
    .notNull()
    .references(() => usersTable.id),
  participantB: uuid("participant_b")
    .notNull()
    .references(() => usersTable.id),
  isBlockedByA: boolean("is_blocked_by_a").notNull().default(false),
  isBlockedByB: boolean("is_blocked_by_b").notNull().default(false),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const messagesTable = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversationsTable.id, { onDelete: "cascade" }),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => usersTable.id),
  body: text("body").notNull(),
  isModerated: boolean("is_moderated").notNull().default(false),
  moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const notificationsTable = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  subject: text("subject"),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  status: notificationStatusEnum("status").notNull().default("pending"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Dead-letter log for transactional emails that failed all retry attempts.
 * Admins can view this via GET /api/v1/admin/failed-emails to see which
 * applicants/users were never notified so they can manually follow up.
 */
export const failedEmailsTable = pgTable("failed_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Recipient email address */
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  /** Caller-supplied label for where in the codebase this send originated */
  context: text("context").notNull(),
  /** Last error message from the SMTP/provider call */
  errorMessage: text("error_message").notNull(),
  /** Total number of delivery attempts made before giving up */
  attempts: integer("attempts").notNull().default(1),
  /** Whether an admin has manually resolved / re-sent this */
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: uuid("resolved_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
export type FailedEmail = typeof failedEmailsTable.$inferSelect;
