/**
 * One-shot baseline — mark 0000_init as applied without running SQL.
 * For databases that already have schema from db-push or earlier deploys.
 *
 * Run: pnpm --filter @workspace/db run baseline
 * Docker: docker compose --profile tools run --rm db-baseline
 */
import "@workspace/db/load-env";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getPoolSslOption } from "./dbConnection";

const INIT_TAG = "0000_init";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(packageDir, "drizzle");
const journalPath = path.join(migrationsDir, "meta", "_journal.json");

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL must be set.");
    process.exit(1);
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ...getPoolSslOption(databaseUrl),
  });

  try {
    const usersCheck = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
      ) AS exists
    `);

    if (!usersCheck.rows[0]?.exists) {
      console.error(
        "Empty database — no public.users table found. Run migrate instead:\n" +
          "  docker compose --profile tools run --rm db-migrate",
      );
      process.exit(1);
    }

    await pool.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    if (!fs.existsSync(journalPath)) {
      console.error(`Journal not found: ${journalPath}`);
      process.exit(1);
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
      entries: Array<{ tag: string; when: number }>;
    };
    const initEntry = journal.entries.find((entry) => entry.tag === INIT_TAG);
    if (!initEntry) {
      console.error(`No journal entry for ${INIT_TAG}`);
      process.exit(1);
    }

    const migrationPath = path.join(migrationsDir, `${INIT_TAG}.sql`);
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const hash = crypto.createHash("sha256").update(migrationSql).digest("hex");

    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM drizzle."__drizzle_migrations" WHERE hash = $1`,
      [hash],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      console.log(
        `Migration ${INIT_TAG} already marked as applied (hash: ${hash.slice(0, 12)}…).`,
      );
      return;
    }

    await pool.query(
      `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
      [hash, initEntry.when],
    );

    console.log(
      `Baselined ${INIT_TAG} (created_at=${initEntry.when}, hash=${hash.slice(0, 12)}…).`,
    );
    console.log("Run db-migrate to verify — it should apply no pending migrations.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
