import { defineConfig } from "drizzle-kit";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "./src/loadEnv";

const configDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv(configDir);

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Copy env.example to .env and configure a local PostgreSQL URL.",
  );
}

export default defineConfig({
  schema: path.join(configDir, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
