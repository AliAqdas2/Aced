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
import { listingsTable } from "./listings";
import { orderItemsTable } from "./orders";

export const entitlementStatusEnum = pgEnum("entitlement_status", [
  "pending",
  "active",
  "suspended",
  "revoked",
  "expired",
]);

export const assetScanStatusEnum = pgEnum("asset_scan_status", [
  "pending",
  "clean",
  "quarantined",
  "failed",
]);

export const assetOwnerTypeEnum = pgEnum("asset_owner_type", [
  "user",
  "creator",
  "platform",
]);

export const assetsTable = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => usersTable.id),
  ownerType: assetOwnerTypeEnum("owner_type").notNull().default("creator"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  isPrivate: boolean("is_private").notNull().default(true),
  checksum: text("checksum"),
  scanStatus: assetScanStatusEnum("scan_status").notNull().default("pending"),
  scanNotes: text("scan_notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const entitlementsTable = pgTable("entitlements", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id),
  orderItemId: uuid("order_item_id").references(() => orderItemsTable.id),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listingsTable.id),
  assetId: uuid("asset_id").references(() => assetsTable.id),
  status: entitlementStatusEnum("status").notNull().default("pending"),
  grantReason: text("grant_reason").notNull(),
  revokeReason: text("revoke_reason"),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessAt: timestamp("last_access_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Asset = typeof assetsTable.$inferSelect;
export type Entitlement = typeof entitlementsTable.$inferSelect;
