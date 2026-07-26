import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Managed by connect-pg-simple for express-session storage.
 * Defined here so Replit's publish-time schema diff includes it.
 */
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);
