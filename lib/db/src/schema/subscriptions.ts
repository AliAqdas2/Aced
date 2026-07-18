import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { creatorProfilesTable } from "./creators";
import { listingsTable, serviceOffersTable } from "./listings";

export const billingIntervalEnum = pgEnum("billing_interval", [
  "weekly",
  "monthly",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "cancelled",
  "past_due",
  "unpaid",
  "expired",
]);

/**
 * One row per service offer that has subscription pricing.
 * Holds the Stripe Product/Price IDs and billing parameters.
 */
export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  serviceOfferId: uuid("service_offer_id")
    .notNull()
    .unique()
    .references(() => serviceOffersTable.id, { onDelete: "cascade" }),
  /** Stripe Product ID (created lazily on first subscriber checkout) */
  stripeProductId: text("stripe_product_id"),
  /** Stripe Price ID (recurring). Null until created. */
  stripePriceId: text("stripe_price_id"),
  billingInterval: billingIntervalEnum("billing_interval").notNull(),
  /** Sessions granted to the learner each billing period */
  sessionsPerPeriod: integer("sessions_per_period").notNull(),
  amountMinorUnits: integer("amount_minor_units").notNull(),
  currency: text("currency").notNull().default("GBP"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * One row per learner × subscription plan.
 * Tracks Stripe subscription lifecycle and session credit balance.
 */
export const learnerSubscriptionsTable = pgTable("learner_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  learnerId: uuid("learner_id")
    .notNull()
    .references(() => usersTable.id),
  creatorId: uuid("creator_id")
    .notNull()
    .references(() => creatorProfilesTable.id),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listingsTable.id),
  serviceOfferId: uuid("service_offer_id")
    .notNull()
    .references(() => serviceOffersTable.id),
  subscriptionPlanId: uuid("subscription_plan_id")
    .notNull()
    .references(() => subscriptionPlansTable.id),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  status: subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  /** Credits remaining in the current billing period */
  sessionsRemaining: integer("sessions_remaining").notNull().default(0),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
export type LearnerSubscription = typeof learnerSubscriptionsTable.$inferSelect;
