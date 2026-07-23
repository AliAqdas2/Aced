import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  creatorProfilesTable,
  storefrontsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createUser,
  verifyPassword,
  generateMagicLink,
  consumeMagicLink,
  generatePasswordResetToken,
  consumePasswordReset,
  generateEmailVerificationToken,
  consumeEmailVerification,
  logAuditEvent,
} from "../../lib/auth";
import { sendEmailResilient, buildMagicLinkEmail, buildPasswordResetEmail } from "../../lib/email";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(80),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

const MagicLinkBody = z.object({
  email: z.string().email(),
});

const PasswordResetRequestBody = z.object({
  email: z.string().email(),
});

const PasswordResetBody = z.object({
  token: z.string(),
  password: z.string().min(8),
});

// POST /api/v1/auth/register
router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { email, password, displayName } = parsed.data;

  // Check if email already exists
  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Email already registered", code: "EMAIL_EXISTS" });
    return;
  }

  const user = await createUser({ email, password, displayName });

  // Send verification email
  const token = await generateEmailVerificationToken(user.id, email);
  const verifyUrl = `${process.env.APP_URL ?? "http://localhost:5000"}/api/v1/auth/verify-email?token=${token}`;
  await sendEmailResilient({
    to: email,
    subject: "Verify your Aced email",
    html: `<p>Please <a href="${verifyUrl}">verify your email</a> to activate your account.</p>`,
  });

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.email = user.email;

  await logAuditEvent({
    actorId: user.id,
    action: "user.register",
    targetId: user.id,
    targetType: "user",
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.status(201).json({
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// POST /api/v1/auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
    return;
  }

  if (user.status !== "active") {
    res.status(403).json({ error: "Account suspended", code: "ACCOUNT_SUSPENDED" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials", code: "INVALID_CREDENTIALS" });
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.email = user.email;

  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  res.json({
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  });
});

// POST /api/v1/auth/logout
router.post("/auth/logout", requireAuth, (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Error destroying session");
      res.status(500).json({ error: "Logout failed" });
      return;
    }
    res.clearCookie("aced.sid");
    res.json({ data: { success: true } });
  });
});

// POST /api/v1/auth/magic-link
router.post("/auth/magic-link", async (req, res): Promise<void> => {
  const parsed = MagicLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const { email } = parsed.data;
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);

  if (!user) {
    // Don't reveal whether email exists
    res.json({ data: { message: "If that email exists, a link has been sent." } });
    return;
  }

  const token = await generateMagicLink(user.id);
  const loginUrl = `${process.env.APP_URL ?? "http://localhost:5000"}/api/v1/auth/magic-link/verify?token=${token}`;

  await sendEmailResilient({
    to: email,
    subject: "Your Aced sign-in link",
    html: buildMagicLinkEmail(loginUrl),
  });

  res.json({ data: { message: "If that email exists, a link has been sent." } });
});

// GET /api/v1/auth/magic-link/verify
router.get("/auth/magic-link/verify", async (req, res): Promise<void> => {
  const token = req.query["token"] as string;
  if (!token) {
    res.status(400).json({ error: "Token required" });
    return;
  }

  const user = await consumeMagicLink(token);
  if (!user) {
    res.status(400).json({ error: "Invalid or expired link", code: "INVALID_TOKEN" });
    return;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.email = user.email;

  const appUrl = process.env.APP_URL ?? "http://localhost:5000";
  res.redirect(`${appUrl}/dashboard`);
});

// GET /api/v1/auth/verify-email
router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const token = req.query["token"] as string;
  if (!token) {
    res.status(400).json({ error: "Token required" });
    return;
  }

  const ok = await consumeEmailVerification(token);
  if (!ok) {
    res.status(400).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
    return;
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:5000";
  res.redirect(`${appUrl}/email-verified`);
});

// POST /api/v1/auth/password-reset/request
router.post("/auth/password-reset/request", async (req, res): Promise<void> => {
  const parsed = PasswordResetRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()))
    .limit(1);

  if (user) {
    const token = await generatePasswordResetToken(user.id);
    const resetUrl = `${process.env.APP_URL ?? "http://localhost:5000"}/reset-password?token=${token}`;
    await sendEmailResilient({
      to: user.email,
      subject: "Reset your Aced password",
      html: buildPasswordResetEmail(resetUrl),
    });
  }

  // Always return 200 to prevent email enumeration
  res.json({ data: { message: "If that email exists, a reset link has been sent." } });
});

// POST /api/v1/auth/password-reset/confirm
router.post("/auth/password-reset/confirm", async (req, res): Promise<void> => {
  const parsed = PasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const ok = await consumePasswordReset(parsed.data.token, parsed.data.password);
  if (!ok) {
    res.status(400).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
    return;
  }

  res.json({ data: { success: true } });
});

// GET /api/v1/auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!))
    .limit(1);

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, user.id))
    .limit(1);

  let creatorProfile = null;
  if (user.role === "creator" || user.role === "creator_applicant") {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, user.id))
      .limit(1);
    creatorProfile = cp ?? null;
  }

  res.json({
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      timezone: user.timezone,
      profile: profile ?? null,
      creatorProfile,
    },
  });
});

export default router;
