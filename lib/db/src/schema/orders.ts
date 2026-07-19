import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { listingsTable, priceRecordsTable } from "./listings";
import { commissionRulesTable } from "./creators";

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "pending_payment",
  "paid",
  "partially_refunded",
  "refunded",
  "disputed",
  "closed",
]);

export const fulfilmentStatusEnum = pgEnum("fulfilment_status", [
  "pending",
  "fulfilled",
  "refunded",
  "disputed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "disputed",
]);

export const ledgerEntryTypeEnum = pgEnum("ledger_entry_type", [
  "gross",
  "platform_fee",
  "creator_proceeds",
  "refund",
  "dispute_reversal",
  "adjustment",
]);

export const ordersTable = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => usersTable.id),
  status: orderStatusEnum("status").notNull().default("draft"),
  currency: text("currency").notNull().default("GBP"),
  subtotalMinorUnits: integer("subtotal_minor_units").notNull().default(0),
  platformFeeMinorUnits: integer("platform_fee_minor_units")
    .notNull()
    .default(0),
  totalMinorUnits: integer("total_minor_units").notNull().default(0),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const orderItemsTable = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listingsTable.id),
  priceRecordId: uuid("price_record_id")
    .notNull()
    .references(() => priceRecordsTable.id),
  listingTitleSnapshot: text("listing_title_snapshot").notNull(),
  creatorIdSnapshot: uuid("creator_id_snapshot").notNull(),
  creatorNameSnapshot: text("creator_name_snapshot"),
  quantity: integer("quantity").notNull().default(1),
  unitAmountMinorUnits: integer("unit_amount_minor_units").notNull(),
  platformFeeMinorUnits: integer("platform_fee_minor_units").notNull(),
  creatorProceedsMinorUnits: integer("creator_proceeds_minor_units").notNull(),
  commissionRateBasisPoints: integer("commission_rate_basis_points").notNull(),
  commissionRuleId: uuid("commission_rule_id").references(
    () => commissionRulesTable.id
  ),
  fulfilmentStatus: fulfilmentStatusEnum("fulfilment_status")
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const paymentsTable = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => ordersTable.id),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeTransferId: text("stripe_transfer_id"),
  amountMinorUnits: integer("amount_minor_units").notNull(),
  currency: text("currency").notNull().default("GBP"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const ledgerEntriesTable = pgTable("ledger_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => ordersTable.id),
  orderItemId: uuid("order_item_id").references(() => orderItemsTable.id),
  paymentId: uuid("payment_id").references(() => paymentsTable.id),
  entryType: ledgerEntryTypeEnum("entry_type").notNull(),
  amountMinorUnits: integer("amount_minor_units").notNull(),
  currency: text("currency").notNull().default("GBP"),
  reference: text("reference").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;
export type Payment = typeof paymentsTable.$inferSelect;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
