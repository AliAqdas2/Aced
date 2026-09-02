import type { ConnectionOptions } from "tls";

/**
 * Whether to use SSL for PostgreSQL connections.
 * Docker/internal hosts and local dev typically do not use SSL.
 */
export function shouldUseSsl(databaseUrl: string): boolean {
  if (process.env.DATABASE_SSL === "true") return true;
  if (process.env.DATABASE_SSL === "false") return false;
  if (/sslmode=disable/i.test(databaseUrl)) return false;
  if (/sslmode=require/i.test(databaseUrl)) return true;

  try {
    const parsed = new URL(databaseUrl.replace(/^postgresql:/, "http:"));
    const host = parsed.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "postgres") {
      return false;
    }
    if (/^10\./.test(host)) return false;
    if (/^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return false;
  } catch {
    // Unparseable URL — default to SSL for safety on unknown hosts.
    return true;
  }

  return true;
}

export function getPoolSslOption(
  databaseUrl: string,
): { ssl: ConnectionOptions } | Record<string, never> {
  return shouldUseSsl(databaseUrl)
    ? { ssl: { rejectUnauthorized: false } }
    : {};
}

export function getDrizzleKitSsl(
  databaseUrl: string,
): false | { rejectUnauthorized: false } {
  return shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false;
}

export type RedactedDatabaseTarget =
  | {
      host: string;
      port: string;
      database: string;
      user: string;
    }
  | { parseError: true };

/**
 * Safe DATABASE_URL summary for logs/health — never includes password.
 */
export function redactDatabaseUrl(databaseUrl: string): RedactedDatabaseTarget {
  try {
    const parsed = new URL(databaseUrl.replace(/^postgresql:/i, "http:"));
    return {
      host: parsed.hostname || "(empty)",
      port: parsed.port || "5432",
      database: decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "(empty)",
      user: decodeURIComponent(parsed.username || "") || "(empty)",
    };
  } catch {
    return { parseError: true };
  }
}
