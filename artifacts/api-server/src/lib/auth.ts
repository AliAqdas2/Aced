import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  magicLinksTable,
  passwordResetsTable,
  emailVerificationsTable,
  type User,
} from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "./logger";

export const SALT_ROUNDS = 12;
export const MAGIC_LINK_EXPIRES_MINUTES = 15;
export const PASSWORD_RESET_EXPIRES_MINUTES = 60;
export const EMAIL_VERIFY_EXPIRES_HOURS = 24;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createUser(opts: {
  email: string;
  password?: string;
  displayName: string;
  role?: User["role"];
}): Promise<User> {
  const passwordHash = opts.password
    ? await hashPassword(opts.password)
    : null;

  const [user] = await db
    .insert(usersTable)
    .values({
      email: opts.email.toLowerCase().trim(),
      passwordHash,
      role: opts.role ?? "learner",
    })
    .returning();

  await db.insert(profilesTable).values({
    userId: user.id,
    displayName: opts.displayName,
  });

  return user;
}

export async function generateMagicLink(userId: string): Promise<string> {
  const token = nanoid(48);
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_EXPIRES_MINUTES * 60 * 1000
  );

  await db.insert(magicLinksTable).values({ userId, token, expiresAt });
  return token;
}

export async function consumeMagicLink(
  token: string
): Promise<User | null> {
  const now = new Date();
  const [link] = await db
    .select()
    .from(magicLinksTable)
    .where(
      and(
        eq(magicLinksTable.token, token),
        gt(magicLinksTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!link || link.usedAt) return null;

  await db
    .update(magicLinksTable)
    .set({ usedAt: new Date() })
    .where(eq(magicLinksTable.id, link.id));

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, link.userId))
    .limit(1);

  // Mark email verified if not already
  if (user && !user.emailVerified) {
    await db
      .update(usersTable)
      .set({ emailVerified: true })
      .where(eq(usersTable.id, user.id));
  }

  return user ?? null;
}

export async function generatePasswordResetToken(
  userId: string
): Promise<string> {
  const token = nanoid(48);
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000
  );
  await db.insert(passwordResetsTable).values({ userId, token, expiresAt });
  return token;
}

export async function consumePasswordReset(
  token: string,
  newPassword: string
): Promise<boolean> {
  const now = new Date();
  const [reset] = await db
    .select()
    .from(passwordResetsTable)
    .where(
      and(
        eq(passwordResetsTable.token, token),
        gt(passwordResetsTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!reset || reset.usedAt) return false;

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, reset.userId));

  await db
    .update(passwordResetsTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetsTable.id, reset.id));

  return true;
}

export async function generateEmailVerificationToken(
  userId: string,
  email: string
): Promise<string> {
  const token = nanoid(48);
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000
  );
  await db.insert(emailVerificationsTable).values({
    userId,
    email,
    token,
    expiresAt,
  });
  return token;
}

export async function consumeEmailVerification(
  token: string
): Promise<boolean> {
  const now = new Date();
  const [verification] = await db
    .select()
    .from(emailVerificationsTable)
    .where(
      and(
        eq(emailVerificationsTable.token, token),
        gt(emailVerificationsTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!verification || verification.verifiedAt) return false;

  await db
    .update(usersTable)
    .set({ emailVerified: true })
    .where(eq(usersTable.id, verification.userId));

  await db
    .update(emailVerificationsTable)
    .set({ verifiedAt: new Date() })
    .where(eq(emailVerificationsTable.id, verification.id));

  return true;
}

export async function logAuditEvent(opts: {
  actorId?: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  summary?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    const { auditLogsTable } = await import("@workspace/db");
    await db.insert(auditLogsTable).values({
      actorId: opts.actorId ?? null,
      actorRole: opts.actorRole ?? null,
      action: opts.action,
      targetType: opts.targetType ?? null,
      targetId: opts.targetId ?? null,
      summary: opts.summary ?? null,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}
