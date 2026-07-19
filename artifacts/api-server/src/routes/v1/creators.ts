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
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";
import { generateUploadUrl } from "../../lib/storage";
import { logAuditEvent } from "../../lib/auth";
import { sendEmail, buildCreatorApplicationEmail, buildChangesRequestedEmail } from "../../lib/email";
import { logger } from "../../lib/logger";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

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

    // Add/replace expertise — on resubmission delete the old primary row first
    if (isResubmission) {
      await db
        .delete(creatorExpertiseTable)
        .where(
          and(
            eq(creatorExpertiseTable.creatorId, creatorProfile.id),
            eq(creatorExpertiseTable.isPrimary, true)
          )
        );
    }
    await db.insert(creatorExpertiseTable).values({
      creatorId: creatorProfile.id,
      universityId: parsed.data.universityId,
      courseId: parsed.data.courseId,
      graduationYear: parsed.data.graduationYear,
      academicResult: parsed.data.academicResult,
      isPrimary: true,
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

    // Send approval notification email (fire and forget — don't block response)
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

        await sendEmail({
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
        });
      } catch (err) {
        logger.error({ err }, "Failed to send creator application approval email");
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

    // Notify applicant by email when changes are requested (fire-and-forget)
    if (parsed.data.decision === "changes_requested") {
      (async () => {
        try {
          const [userInfo] = await db
            .select({ email: usersTable.email, displayName: profilesTable.displayName })
            .from(usersTable)
            .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
            .where(eq(usersTable.id, cp.userId))
            .limit(1);

          await sendEmail({
            to: userInfo.email,
            subject: "Changes requested on your Aced creator application",
            html: buildChangesRequestedEmail({
              applicantName: userInfo?.displayName ?? "Applicant",
              notes: parsed.data.notes ?? "Please review the feedback on your application status page.",
            }),
          });
        } catch (err) {
          logger.error({ err }, "Failed to send changes_requested email to applicant");
        }
      })();
    }

    res.json({ data: updated });
  }
);

export default router;
