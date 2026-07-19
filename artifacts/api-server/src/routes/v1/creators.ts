import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  creatorProfilesTable,
  creatorVerificationsTable,
  creatorExpertiseTable,
  storefrontsTable,
  commissionRulesTable,
  platformConfigTable,
  coursesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { generateUploadUrl } from "../../lib/storage";
import { logAuditEvent } from "../../lib/auth";
import {
  sendEmailResilient,
  buildCreatorApplicationEmail,
  buildApprovalEmail,
  buildRejectionEmail,
  buildChangesRequestedEmail,
  buildApplicationReceivedEmail,
} from "../../lib/email";
import { logger } from "../../lib/logger";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

// GET /api/v1/taxonomy/courses?universityId=... — list courses for a university
// Used by the application form to populate the cascading course selector (#15)
router.get(
  "/taxonomy/courses",
  async (req, res): Promise<void> => {
    const universityId = req.query["universityId"] as string | undefined;
    if (!universityId) {
      res.status(400).json({ error: "universityId query parameter is required" });
      return;
    }
    const courses = await db
      .select()
      .from(coursesTable)
      .where(eq(coursesTable.universityId, universityId))
      .orderBy(coursesTable.name);
    res.json({ data: courses });
  }
);

// GET /api/v1/creator/applications/config — DBS required flag and approval email
router.get(
  "/creator/applications/config",
  async (_req, res): Promise<void> => {
    const configs = await db
      .select()
      .from(platformConfigTable)
      .where(
        eq(platformConfigTable.key, "DBS_REQUIRED")
      );
    // Also fetch APPROVAL_EMAIL in same query via separate call to avoid complex OR
    const [approvalCfg] = await db
      .select()
      .from(platformConfigTable)
      .where(eq(platformConfigTable.key, "APPROVAL_EMAIL"))
      .limit(1);

    const dbsRow = configs.find((r) => r.key === "DBS_REQUIRED");
    res.json({
      data: {
        dbsRequired: dbsRow?.value === "true",
      },
    });
  }
);

// POST /api/v1/creator/applications — submit creator application
router.post(
  "/creator/applications",
  requireAuth,
  async (req, res): Promise<void> => {
    const Body = z.object({
      headline: z.string().min(10).max(160),
      universityId: z.string().uuid(),
      courseId: z.string().uuid(),
      graduationYear: z.number().int().min(1990).max(2030),
      academicResult: z.string().min(2).max(100),
      agreedToTerms: z.literal(true),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const userId = req.session.userId!;

    // Check if creator profile already exists
    const [existing] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, userId))
      .limit(1);

    const isResubmission = existing?.status === "changes_requested";

    if (existing && existing.status !== "draft" && !isResubmission) {
      res.status(409).json({ error: "Application already submitted", code: "ALREADY_APPLIED" });
      return;
    }

    let creatorProfile = existing;
    if (!creatorProfile) {
      const [cp] = await db
        .insert(creatorProfilesTable)
        .values({ userId, status: "submitted", headline: parsed.data.headline })
        .returning();
      creatorProfile = cp;
    } else {
      const updateFields: Record<string, unknown> = { status: "submitted", headline: parsed.data.headline };
      if (isResubmission) {
        // Clear reviewer feedback so admin sees a fresh submission
        updateFields.reviewNotes = null;
      }
      const [cp] = await db
        .update(creatorProfilesTable)
        .set(updateFields)
        .where(eq(creatorProfilesTable.id, existing.id))
        .returning();
      creatorProfile = cp;
    }

    // #40 — Single atomic upsert on the unique creator_id index.
    // Because creator_expertise has a unique constraint on creator_id,
    // concurrent double-submits both hit the same conflict target and the
    // last writer wins cleanly — duplicates are physically impossible.
    await db
      .insert(creatorExpertiseTable)
      .values({
        creatorId: creatorProfile!.id,
        universityId: parsed.data.universityId,
        courseId: parsed.data.courseId,
        graduationYear: parsed.data.graduationYear,
        academicResult: parsed.data.academicResult,
        isPrimary: true,
      })
      .onConflictDoUpdate({
        target: creatorExpertiseTable.creatorId,
        set: {
          universityId: parsed.data.universityId,
          courseId: parsed.data.courseId,
          graduationYear: parsed.data.graduationYear,
          academicResult: parsed.data.academicResult,
          isPrimary: true,
        },
      });

    // Update user role to creator_applicant
    await db
      .update(usersTable)
      .set({ role: "creator_applicant" })
      .where(eq(usersTable.id, userId));
    req.session.role = "creator_applicant";

    await logAuditEvent({
      actorId: userId,
      action: "creator.application.submitted",
      targetId: creatorProfile.id,
      targetType: "creator_profile",
    });

    // #14 — Send confirmation email to applicant (fire-and-forget — must not fail the response)
    (async () => {
      try {
        const [userInfo] = await db
          .select({ email: usersTable.email, displayName: profilesTable.displayName })
          .from(usersTable)
          .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
          .where(eq(usersTable.id, userId))
          .limit(1);

        if (userInfo?.email) {
          await sendEmailResilient(
            {
              to: userInfo.email,
              subject: "We've received your Aced application",
              html: buildApplicationReceivedEmail({
                applicantName: userInfo.displayName ?? "there",
              }),
            },
            "creator_application_received_applicant"
          );
        }
      } catch (err) {
        logger.error({ err }, "Failed to send application received email to applicant");
      }
    })();

    // Send notification email to internal team (fire-and-forget — must not fail the response)
    (async () => {
      try {
        const [approvalCfg] = await db
          .select()
          .from(platformConfigTable)
          .where(eq(platformConfigTable.key, "APPROVAL_EMAIL"))
          .limit(1);
        const approvalEmail = approvalCfg?.value ?? "AcedApprovals@creativecloud.ai";

        const [userInfo] = await db
          .select({ email: usersTable.email, displayName: profilesTable.displayName })
          .from(usersTable)
          .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
          .where(eq(usersTable.id, userId))
          .limit(1);

        await sendEmailResilient(
          {
            to: approvalEmail,
            subject: `New Creator Application — ${userInfo?.displayName ?? userInfo?.email ?? "Unknown"}`,
            html: buildCreatorApplicationEmail({
              applicantName: userInfo?.displayName ?? "Unknown",
              applicantEmail: userInfo?.email ?? "",
              grade: parsed.data.academicResult,
              graduationYear: parsed.data.graduationYear,
              headline: parsed.data.headline,
              creatorProfileId: creatorProfile.id,
            }),
          },
          "creator_application_received_internal"
        );
      } catch (err) {
        logger.error({ err }, "Failed to send creator application notification email to internal team");
      }
    })();

    res.status(201).json({ data: creatorProfile });
  }
);

// GET /api/v1/creator/applications/status
router.get(
  "/creator/applications/status",
  requireAuth,
  async (req, res): Promise<void> => {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.json({ data: null });
      return;
    }

    const expertise = await db
      .select()
      .from(creatorExpertiseTable)
      .where(eq(creatorExpertiseTable.creatorId, cp.id));

    const verifications = await db
      .select()
      .from(creatorVerificationsTable)
      .where(eq(creatorVerificationsTable.creatorId, cp.id));

    res.json({ data: { ...cp, expertise, verifications } });
  }
);

// POST /api/v1/creator/verifications/upload-url — signed upload URL for evidence
router.post(
  "/creator/verifications/upload-url",
  requireRole("creator_applicant"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      fileName: z.string().min(1).max(255),
      mimeType: z.string(),
      sizeBytes: z.number().int().positive().max(20 * 1024 * 1024), // 20MB max
      claimType: z.string().min(2).max(100),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(parsed.data.mimeType)) {
      res.status(400).json({ error: "File type not allowed", code: "INVALID_MIME" });
      return;
    }

    const { uploadUrl, storageKey } = await generateUploadUrl({
      folder: `verifications/${req.session.userId}`,
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    });

    res.json({ data: { uploadUrl, storageKey, expiresInSeconds: 900 } });
  }
);

// POST /api/v1/creator/verifications — record uploaded verification doc
router.post(
  "/creator/verifications",
  requireRole("creator_applicant"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      claimType: z.string().min(2).max(100),
      evidenceRef: z.string().min(1),
      evidenceFileName: z.string().min(1),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const [verification] = await db
      .insert(creatorVerificationsTable)
      .values({
        creatorId: cp.id,
        claimType: parsed.data.claimType,
        evidenceRef: parsed.data.evidenceRef,
        evidenceFileName: parsed.data.evidenceFileName,
        status: "submitted",
      })
      .returning();

    res.status(201).json({ data: verification });
  }
);

// POST /api/v1/creator/stripe/onboard — create Stripe Connect account
router.post(
  "/creator/stripe/onboard",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const userId = req.session.userId!;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, userId))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const stripe = getStripe();

    let accountId = cp.stripeAccountId;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { creatorProfileId: cp.id, userId },
      });
      accountId = account.id;
      await db
        .update(creatorProfilesTable)
        .set({ stripeAccountId: accountId, stripeAccountStatus: "pending" })
        .where(eq(creatorProfilesTable.id, cp.id));
    }

    const appUrl = process.env.APP_URL ?? "http://localhost:5000";
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/creator/stripe/onboard`,
      return_url: `${appUrl}/creator/earnings`,
      type: "account_onboarding",
    });

    res.json({ data: { onboardingUrl: accountLink.url } });
  }
);

// GET /api/v1/creator/stripe/status
router.get(
  "/creator/stripe/status",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp || !cp.stripeAccountId) {
      res.json({ data: { status: "not_started", payoutsEnabled: false, chargesEnabled: false } });
      return;
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(cp.stripeAccountId);

    const newStatus = account.charges_enabled ? "active" : account.details_submitted ? "pending" : "pending";
    if (newStatus !== cp.stripeAccountStatus) {
      await db
        .update(creatorProfilesTable)
        .set({ stripeAccountStatus: newStatus })
        .where(eq(creatorProfilesTable.id, cp.id));
    }

    res.json({
      data: {
        status: newStatus,
        payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled,
        requirementsCurrently: account.requirements?.currently_due ?? [],
      },
    });
  }
);

// GET /api/v1/creator/profile
router.get(
  "/creator/profile",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const userId = req.session.userId!;
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, userId))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const expertise = await db
      .select()
      .from(creatorExpertiseTable)
      .where(eq(creatorExpertiseTable.creatorId, cp.id));

    const [storefront] = await db
      .select()
      .from(storefrontsTable)
      .where(eq(storefrontsTable.creatorId, cp.id))
      .limit(1);

    res.json({ data: { ...cp, expertise, storefront: storefront ?? null } });
  }
);

// PATCH /api/v1/creator/profile — update video call settings
router.patch(
  "/creator/profile",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      videoCallProvider: z.enum(["zoom", "teams", "meet", "custom"]).nullable().optional(),
      videoCallLink: z.string().url("Must be a valid URL").nullable().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const userId = req.session.userId!;
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, userId))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.videoCallProvider !== undefined)
      updates.videoCallProvider = parsed.data.videoCallProvider;
    if (parsed.data.videoCallLink !== undefined)
      updates.videoCallLink = parsed.data.videoCallLink;

    const [updated] = await db
      .update(creatorProfilesTable)
      .set(updates)
      .where(eq(creatorProfilesTable.id, cp.id))
      .returning();

    res.json({
      data: {
        videoCallProvider: updated.videoCallProvider ?? null,
        videoCallLink: updated.videoCallLink ?? null,
      },
    });
  }
);

// --- Admin routes for creator management ---

// GET /api/v1/admin/applications
router.get(
  "/admin/applications",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const status = (req.query["status"] as string) ?? "submitted";
    const applications = await db
      .select({
        creator: creatorProfilesTable,
        user: { id: usersTable.id, email: usersTable.email },
        profile: { displayName: profilesTable.displayName, avatarUrl: profilesTable.avatarUrl },
      })
      .from(creatorProfilesTable)
      .innerJoin(usersTable, eq(creatorProfilesTable.userId, usersTable.id))
      .innerJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
      .where(eq(creatorProfilesTable.status, status as any))
      .orderBy(creatorProfilesTable.createdAt)
      .limit(50);

    res.json({ data: applications });
  }
);

// POST /api/v1/admin/applications/:id/decision
router.post(
  "/admin/applications/:id/decision",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    // "rejected" maps to "closed" in the DB enum — no path back from hard rejection.
    // "changes_requested" leaves the door open for re-submission.
    const Body = z.object({
      decision: z.enum(["approved", "rejected", "changes_requested"]),
      notes: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.id, id))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    // Map API decision to DB enum value
    const dbStatus =
      parsed.data.decision === "rejected" ? "closed" : parsed.data.decision;

    const updateData: any = { status: dbStatus };
    if (parsed.data.decision === "approved") {
      updateData.verifiedAt = new Date();
    }
    if (parsed.data.notes) {
      updateData.reviewNotes = parsed.data.notes;
    }

    const [updated] = await db
      .update(creatorProfilesTable)
      .set(updateData)
      .where(eq(creatorProfilesTable.id, id))
      .returning();

    if (parsed.data.decision === "approved") {
      await db
        .update(usersTable)
        .set({ role: "creator" })
        .where(eq(usersTable.id, cp.userId));

      // Create storefront if it doesn't exist
      const [existingStorefront] = await db
        .select()
        .from(storefrontsTable)
        .where(eq(storefrontsTable.creatorId, cp.id))
        .limit(1);

      if (!existingStorefront) {
        const [profile] = await db
          .select()
          .from(profilesTable)
          .where(eq(profilesTable.userId, cp.userId))
          .limit(1);

        const slug = `creator-${cp.id.slice(0, 8)}`;
        await db.insert(storefrontsTable).values({
          creatorId: cp.id,
          slug,
          displayName: profile?.displayName ?? "Creator",
        });
      }
    }

    await logAuditEvent({
      actorId: req.session.userId,
      actorRole: req.session.role,
      action: `creator.application.${parsed.data.decision}`,
      targetId: cp.id,
      targetType: "creator_profile",
      summary: parsed.data.notes,
    });

    // Notify applicant by email for all decision types — resilient send with retry + structured failure log
    (async () => {
      try {
        const [userInfo] = await db
          .select({ email: usersTable.email, displayName: profilesTable.displayName })
          .from(usersTable)
          .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
          .where(eq(usersTable.id, cp.userId))
          .limit(1);

        if (!userInfo) return;

        if (parsed.data.decision === "approved") {
          await sendEmailResilient(
            {
              to: userInfo.email,
              subject: "You're approved — welcome to Aced! 🎉",
              html: buildApprovalEmail({
                applicantName: userInfo.displayName ?? "Applicant",
              }),
            },
            "creator_application_decision_approved"
          );
        } else if (parsed.data.decision === "rejected") {
          await sendEmailResilient(
            {
              to: userInfo.email,
              subject: "Update on your Aced creator application",
              html: buildRejectionEmail({
                applicantName: userInfo.displayName ?? "Applicant",
                notes: parsed.data.notes,
              }),
            },
            "creator_application_decision_rejected"
          );
        } else if (parsed.data.decision === "changes_requested") {
          await sendEmailResilient(
            {
              to: userInfo.email,
              subject: "Changes requested on your Aced creator application",
              html: buildChangesRequestedEmail({
                applicantName: userInfo.displayName ?? "Applicant",
                notes: parsed.data.notes ?? "Please review the feedback on your application status page.",
              }),
            },
            "creator_application_decision_changes_requested"
          );
        }
      } catch (err) {
        logger.error({ err }, "Failed to send decision email to applicant");
      }
    })();

    res.json({ data: updated });
  }
);

// GET /api/v1/creator/application/status — SSE endpoint for live applicant status updates
// Polls DB every 15 s and pushes status changes. Closes automatically after 5 minutes.
router.get(
  "/creator/application/status",
  requireAuth,
  async (req, res): Promise<void> => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const userId = req.session.userId!;

    async function fetchStatus() {
      const [cp] = await db
        .select({
          status: creatorProfilesTable.status,
          reviewNotes: creatorProfilesTable.reviewNotes,
        })
        .from(creatorProfilesTable)
        .where(eq(creatorProfilesTable.userId, userId))
        .limit(1);
      return cp ?? null;
    }

    // Send current status immediately
    let lastStatus: string | null = null;
    try {
      const current = await fetchStatus();
      lastStatus = current?.status ?? null;
      res.write(
        `data: ${JSON.stringify({ status: current?.status ?? null, reviewNotes: current?.reviewNotes ?? null })}\n\n`
      );
    } catch (err) {
      logger.error({ err }, "SSE: failed to fetch initial application status");
      res.write(`data: ${JSON.stringify({ error: "Failed to fetch status" })}\n\n`);
    }

    // Poll every 15 seconds; only push when status changes
    const interval = setInterval(async () => {
      try {
        const current = await fetchStatus();
        const newStatus = current?.status ?? null;
        if (newStatus !== lastStatus) {
          lastStatus = newStatus;
          res.write(
            `data: ${JSON.stringify({ status: current?.status ?? null, reviewNotes: current?.reviewNotes ?? null })}\n\n`
          );
        }
      } catch (err) {
        logger.error({ err }, "SSE: poll failed");
      }
    }, 15_000);

    // Close after 5 minutes to prevent connection leaks
    const timeout = setTimeout(() => {
      clearInterval(interval);
      res.write(`data: ${JSON.stringify({ closed: true })}\n\n`);
      res.end();
    }, 5 * 60 * 1000);

    req.on("close", () => {
      clearInterval(interval);
      clearTimeout(timeout);
    });
  }
);

export default router;
