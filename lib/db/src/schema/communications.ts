import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  boolean,
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

export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Notification = typeof notificationsTable.$inferSelect;
