/**
 * One-shot admin bootstrap — create or promote fixed admin accounts.
 * Also provisions approved creator profiles + storefronts so admins can use Studio.
 * Run: pnpm --filter @workspace/scripts run bootstrap-admins
 * Docker: docker compose --profile tools run --rm bootstrap-admins
 */
import "@workspace/db/load-env";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  creatorProfilesTable,
  storefrontsTable,
} from "@workspace/db";
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

async function ensureCreatorAccess(userId: string, displayName: string): Promise<void> {
  const [existingCp] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.userId, userId))
    .limit(1);

  let creatorId = existingCp?.id;

  if (existingCp) {
    if (existingCp.status !== "approved") {
      await db
        .update(creatorProfilesTable)
        .set({ status: "approved", verifiedAt: new Date() })
        .where(eq(creatorProfilesTable.id, existingCp.id));
    }
  } else {
    const [cp] = await db
      .insert(creatorProfilesTable)
      .values({
        userId,
        status: "approved",
        headline: "Platform admin",
        verifiedAt: new Date(),
      })
      .returning({ id: creatorProfilesTable.id });
    creatorId = cp.id;
  }

  if (!creatorId) return;

  const [existingStorefront] = await db
    .select({ id: storefrontsTable.id })
    .from(storefrontsTable)
    .where(eq(storefrontsTable.creatorId, creatorId))
    .limit(1);

  if (!existingStorefront) {
    const slug = `creator-${creatorId.slice(0, 8)}`;
    await db.insert(storefrontsTable).values({
      creatorId,
      slug,
      displayName,
    });
  }
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

    await ensureCreatorAccess(existing.id, displayName);

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

  await ensureCreatorAccess(user.id, displayName);

  return "created";
}

async function main() {
  console.log("Bootstrapping admin accounts...\n");

  for (const account of ADMIN_ACCOUNTS) {
    const action = await upsertAdmin(account);
    const password = resolvePassword(account.passwordEnvKey);
    console.log(`  ${action === "created" ? "Created" : "Updated"}: ${account.email} (role: admin + creator profile)`);
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
