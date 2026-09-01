/**
 * Calendar OAuth routes and connection management.
 *
 * Google Calendar:
 *   GET /api/v1/auth/google/calendar          — initiate OAuth
 *   GET /api/v1/auth/google/calendar/callback — OAuth callback
 *
 * Microsoft (Outlook / Office 365):
 *   GET /api/v1/auth/microsoft/calendar          — initiate OAuth
 *   GET /api/v1/auth/microsoft/calendar/callback — OAuth callback
 *
 * Connection management (auth required):
 *   GET    /api/v1/profile/calendars             — list connected calendars
 *   DELETE /api/v1/profile/calendars/:provider   — disconnect a calendar
 */

import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { calendarConnectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";
import { encrypt, decrypt } from "../../lib/crypto";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  return "http://localhost:5000";
}

function googleRedirectUri(): string {
  return `${getAppUrl()}/api/v1/auth/google/calendar/callback`;
}

function microsoftRedirectUri(): string {
  return `${getAppUrl()}/api/v1/auth/microsoft/calendar/callback`;
}

function googleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CALENDAR_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function microsoftAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID;
  if (!clientId) throw new Error("MICROSOFT_CALENDAR_CLIENT_ID not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: microsoftRedirectUri(),
    response_type: "code",
    scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    response_mode: "query",
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
}

// ---------------------------------------------------------------------------
// Google Calendar — initiate OAuth
// ---------------------------------------------------------------------------

router.get("/auth/google/calendar", requireAuth, (req, res) => {
  if (!process.env.GOOGLE_CALENDAR_CLIENT_ID) {
    res.status(503).json({ error: "Google Calendar integration not configured" });
    return;
  }

  const returnTo = (req.query["returnTo"] as string) ?? "/profile";
  const state = Buffer.from(
    JSON.stringify({ userId: req.session.userId, returnTo, provider: "google" })
  ).toString("base64url");

  // Store state in session for CSRF validation
  (req.session as any).calendarOAuthState = state;

  res.redirect(googleAuthUrl(state));
});

// ---------------------------------------------------------------------------
// Google Calendar — OAuth callback
// ---------------------------------------------------------------------------

router.get("/auth/google/calendar/callback", async (req, res): Promise<void> => {
  const code = req.query["code"] as string;
  const state = req.query["state"] as string;

  const sessionState = (req.session as any).calendarOAuthState;
  if (!state || state !== sessionState) {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }
  delete (req.session as any).calendarOAuthState;

  let parsed: { userId: string; returnTo: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    res.status(400).json({ error: "Malformed state" });
    return;
  }

  const { userId, returnTo } = parsed;
  const appUrl = getAppUrl();

  // Exchange code for tokens
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenRes.json()) as any;

  if (!tokenRes.ok || !tokenData.access_token) {
    res.redirect(`${appUrl}${returnTo}?calendarError=google_token_failed`);
    return;
  }

  // Fetch user's Google profile email for display
  let providerEmail: string | null = null;
  try {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = (await profileRes.json()) as any;
    providerEmail = profileData.email ?? null;
  } catch {
    // Non-fatal
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);

  // Upsert calendar connection
  const [existing] = await db
    .select()
    .from(calendarConnectionsTable)
    .where(
      and(
        eq(calendarConnectionsTable.userId, userId),
        eq(calendarConnectionsTable.provider, "google")
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(calendarConnectionsTable)
      .set({
        encryptedAccessToken: encrypt(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? encrypt(tokenData.refresh_token)
          : existing.encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        providerEmail,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnectionsTable.id, existing.id));
  } else {
    await db.insert(calendarConnectionsTable).values({
      userId,
      provider: "google",
      encryptedAccessToken: encrypt(tokenData.access_token),
      encryptedRefreshToken: encrypt(tokenData.refresh_token ?? ""),
      tokenExpiresAt: expiresAt,
      providerEmail,
    });
  }

  res.redirect(`${appUrl}${returnTo}?calendarConnected=google`);
});

// ---------------------------------------------------------------------------
// Microsoft Calendar — initiate OAuth
// ---------------------------------------------------------------------------

router.get("/auth/microsoft/calendar", requireAuth, (req, res) => {
  if (!process.env.MICROSOFT_CALENDAR_CLIENT_ID) {
    res.status(503).json({ error: "Microsoft Calendar integration not configured" });
    return;
  }

  const returnTo = (req.query["returnTo"] as string) ?? "/profile";
  const state = Buffer.from(
    JSON.stringify({ userId: req.session.userId, returnTo, provider: "microsoft" })
  ).toString("base64url");

  (req.session as any).calendarOAuthState = state;
  res.redirect(microsoftAuthUrl(state));
});

// ---------------------------------------------------------------------------
// Microsoft Calendar — OAuth callback
// ---------------------------------------------------------------------------

router.get("/auth/microsoft/calendar/callback", async (req, res): Promise<void> => {
  const code = req.query["code"] as string;
  const state = req.query["state"] as string;

  const sessionState = (req.session as any).calendarOAuthState;
  if (!state || state !== sessionState) {
    res.status(400).json({ error: "Invalid OAuth state" });
    return;
  }
  delete (req.session as any).calendarOAuthState;

  let parsed: { userId: string; returnTo: string };
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString());
  } catch {
    res.status(400).json({ error: "Malformed state" });
    return;
  }

  const { userId, returnTo } = parsed;
  const appUrl = getAppUrl();

  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID!;
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET!;

  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: microsoftRedirectUri(),
        grant_type: "authorization_code",
        scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
      }),
    }
  );
  const tokenData = (await tokenRes.json()) as any;

  if (!tokenRes.ok || !tokenData.access_token) {
    res.redirect(`${appUrl}${returnTo}?calendarError=microsoft_token_failed`);
    return;
  }

  // Fetch user's Microsoft profile email for display
  let providerEmail: string | null = null;
  try {
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profileData = (await profileRes.json()) as any;
    providerEmail = profileData.mail ?? profileData.userPrincipalName ?? null;
  } catch {
    // Non-fatal
  }

  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000);

  const [existing] = await db
    .select()
    .from(calendarConnectionsTable)
    .where(
      and(
        eq(calendarConnectionsTable.userId, userId),
        eq(calendarConnectionsTable.provider, "microsoft")
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(calendarConnectionsTable)
      .set({
        encryptedAccessToken: encrypt(tokenData.access_token),
        encryptedRefreshToken: encrypt(tokenData.refresh_token ?? ""),
        tokenExpiresAt: expiresAt,
        providerEmail,
        updatedAt: new Date(),
      })
      .where(eq(calendarConnectionsTable.id, existing.id));
  } else {
    await db.insert(calendarConnectionsTable).values({
      userId,
      provider: "microsoft",
      encryptedAccessToken: encrypt(tokenData.access_token),
      encryptedRefreshToken: encrypt(tokenData.refresh_token ?? ""),
      tokenExpiresAt: expiresAt,
      providerEmail,
    });
  }

  res.redirect(`${appUrl}${returnTo}?calendarConnected=microsoft`);
});

// ---------------------------------------------------------------------------
// GET /api/v1/profile/calendars — list connected calendars (safe, no tokens)
// ---------------------------------------------------------------------------

router.get("/profile/calendars", requireAuth, async (req, res): Promise<void> => {
  const connections = await db
    .select({
      id: calendarConnectionsTable.id,
      provider: calendarConnectionsTable.provider,
      providerEmail: calendarConnectionsTable.providerEmail,
      createdAt: calendarConnectionsTable.createdAt,
    })
    .from(calendarConnectionsTable)
    .where(eq(calendarConnectionsTable.userId, req.session.userId!));

  res.json({ data: connections });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/profile/calendars/:provider — disconnect a calendar
// ---------------------------------------------------------------------------

router.delete(
  "/profile/calendars/:provider",
  requireAuth,
  async (req, res): Promise<void> => {
    const provider = req.params.provider as string;
    if (provider !== "google" && provider !== "microsoft") {
      res.status(400).json({ error: "Unknown provider" });
      return;
    }

    await db
      .delete(calendarConnectionsTable)
      .where(
        and(
          eq(calendarConnectionsTable.userId, req.session.userId!),
          eq(calendarConnectionsTable.provider, provider)
        )
      );

    res.json({ data: { success: true } });
  }
);

export default router;
