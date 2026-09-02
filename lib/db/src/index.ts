import { loadEnv } from "./loadEnv";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import { getPoolSslOption } from "./dbConnection";

// Load DATABASE_URL (and other vars) from the workspace `.env` before connecting
loadEnv();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Copy env.example to .env and configure a local PostgreSQL URL.",
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  ...getPoolSslOption(databaseUrl),
});

export const db = drizzle(pool, { schema });

export * from "./schema";
export { loadEnv } from "./loadEnv";
export {
  redactDatabaseUrl,
  type RedactedDatabaseTarget,
} from "./dbConnection";

export type LiveDbIdentity = {
  database: string | null;
  serverAddr: string | null;
  dbUser: string | null;
};

/** Query the live connection for database name / server / user (no secrets). */
export async function getLiveDbIdentity(): Promise<LiveDbIdentity> {
  const result = await pool.query<{
    database: string | null;
    server_addr: string | null;
    db_user: string | null;
  }>(
    `SELECT current_database() AS database,
            inet_server_addr()::text AS server_addr,
            current_user AS db_user`,
  );
  const row = result.rows[0];
  return {
    database: row?.database ?? null,
    serverAddr: row?.server_addr ?? null,
    dbUser: row?.db_user ?? null,
  };
}
