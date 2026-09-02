/**
 * One-shot admin bootstrap — create or promote fixed admin accounts.
 * Run: pnpm --filter @workspace/scripts run bootstrap-admins
 * Docker: docker compose --profile tools run --rm bootstrap-admins
 */
import "@workspace/db/load-env";
import { db } from "@workspace/db";
import { usersTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

const DEFAULT_PASSWORD = "password123";

const ADMIN_ACCOUNTS = [
  {
    email: "chan.vekaria@slimsumo.co.uk",
    displayName: "Chan Vekaria",
    passwordEnvKey: "ADMIN_CHAN_PASSWORD",
  },
  {
    email: "jaikiranvekaria@gmail.com",
    displayName: "Jaikiran Vekaria",
    passwordEnvKey: "ADMIN_JAIKIRAN_PASSWORD",
  },
] as const;

function resolvePassword(envKey: string): string {
  const perUser = process.env[envKey];
  if (perUser) return perUser;
  if (process.env.ADMIN_BOOTSTRAP_PASSWORD) return process.env.ADMIN_BOOTSTRAP_PASSWORD;
  return DEFAULT_PASSWORD;
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function upsertAdmin(account: (typeof ADMIN_ACCOUNTS)[number]): Promise<"created" | "updated"> {
  const email = account.email.toLowerCase().trim();
  const password = resolvePassword(account.passwordEnvKey);
  const passwordHash = await bcrypt.hash(password, 12);
  const displayName = account.displayName || displayNameFromEmail(email);

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(usersTable)
      .set({
        role: "admin",
        passwordHash,
        emailVerified: true,
        status: "active",
      })
      .where(eq(usersTable.id, existing.id));

    await db
      .insert(profilesTable)
      .values({ userId: existing.id, displayName })
      .onConflictDoNothing();

    return "updated";
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email,
      passwordHash,
      emailVerified: true,
      role: "admin",
      status: "active",
    })
    .returning({ id: usersTable.id });

  await db
    .insert(profilesTable)
    .values({ userId: user.id, displayName })
    .onConflictDoNothing();

  return "created";
}

async function main() {
  console.log("Bootstrapping admin accounts...\n");

  for (const account of ADMIN_ACCOUNTS) {
    const action = await upsertAdmin(account);
    const password = resolvePassword(account.passwordEnvKey);
    console.log(`  ${action === "created" ? "Created" : "Updated"}: ${account.email} (role: admin)`);
    console.log(`    Password: ${password}`);
  }

  console.log("\nDone. Log in at /auth/login and open /admin.");
  console.log("If a user was already logged in, they must log out and back in to refresh their session role.");

  process.exit(0);
}

main().catch((err) => {
  console.error("Bootstrap admins failed:", err);
  process.exit(1);
});
