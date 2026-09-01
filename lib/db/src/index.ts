import { loadEnv } from "./loadEnv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

// Load DATABASE_URL (and other vars) from the workspace `.env` before connecting
loadEnv();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Copy env.example to .env and configure a local PostgreSQL URL.",
  );
}

const isLocal =
  databaseUrl.includes("localhost") ||
  databaseUrl.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: databaseUrl,
  // Local Postgres does not use SSL; cloud providers usually require it.
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export { loadEnv } from "./loadEnv";
