import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "./src/loadEnv";
import { getDrizzleKitSsl } from "./src/dbConnection";

const configDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv(configDir);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Copy env.example to .env and configure a local PostgreSQL URL.",
  );
}

export default defineConfig({
  schema: path.join(configDir, "./src/schema/index.ts"),
  out: path.join(configDir, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: getDrizzleKitSsl(databaseUrl),
  },
});
