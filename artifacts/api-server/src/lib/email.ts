import { logger } from "./logger";
import { db, failedEmailsTable } from "@workspace/db";
import { ReplitConnectors } from "@replit/connectors-sdk";

export interface EmailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Sends a transactional email. In development, logs to console.
 * In production, uses the configured email provider (nodemailer/Resend/etc).
 */
/**
 * Retry helper with exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 2000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastErr;
}

/**
 * Resilient send — retries up to 3 times with exponential backoff.
 * On total failure:
 *   1. Writes a structured JSON error line to stderr for log aggregators.
 *   2. Persists a record to the `failed_emails` table so admins can see
 *      which applicants/users were never notified and manually follow up.
 *
 * @param context  Short label identifying the call-site (e.g. "creator_application_decision")
 */
export async function sendEmailResilient(
  payload: EmailPayload,
  context = "unknown"
): Promise<void> {
  const maxAttempts = 3;
  try {
    await retryWithBackoff(() => sendEmail(payload), maxAttempts, 2000);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Structured stderr entry for log aggregators / ops dashboards
    process.stderr.write(
      JSON.stringify({
        event: "email_failed",
        context,
        to: payload.to,
        subject: payload.subject,
        error: errorMessage,
      }) + "\n"
    );

    // Persist to dead-letter table so the retry worker can re-attempt delivery
    // and admins can see which recipients were never notified.
    try {
      // Schedule first retry attempt 5 minutes from now
      const nextRetryAt = new Date(Date.now() + 5 * 60 * 1000);
      await db.insert(failedEmailsTable).values({
        toEmail: payload.to,
        subject: payload.subject,
        htmlBody: payload.html,
        textBody: payload.text ?? null,
        context,
        errorMessage,
        attempts: maxAttempts + 1,
        nextRetryAt,
      });
    } catch (dbErr) {
      // Don't throw — DB write failure must not mask the original email failure
      process.stderr.write(
        JSON.stringify({
          event: "failed_email_record_write_failed",
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        }) + "\n"
      );
    }
  }
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    logger.info(
      { to: payload.to, subject: payload.subject },
      "DEV: email would be sent"
    );
    return;
  }

  try {
    const connectors = new ReplitConnectors();

    const body: Record<string, unknown> = {
      from: process.env.EMAIL_FROM ?? "Aced <noreply@acedtutoring.co.uk>",
      to: [payload.to],
      subject: payload.subject,
      html: payload.html,
      ...(payload.text ? { text: payload.text } : {}),
    };

    // Resend expects attachments as base64-encoded content
    if (payload.attachments && payload.attachments.length > 0) {
      body["attachments"] = payload.attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
      }));
    }

    const res = await connectors.proxy("resend", "/emails", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend API error ${res.status}: ${text}`);
    }

    logger.info({ to: payload.to, subject: payload.subject }, "Email sent via Resend");
  } catch (err) {
    logger.error({ err, to: payload.to }, "Failed to send email via Resend");
    throw err;
  }
}

export function buildMagicLinkEmail(link: string): EmailPayload["html"] {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">Sign in to Aced</h2>
      <p>Click the link below to sign in. This link expires in 15 minutes.</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;">Sign In</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

export function buildPasswordResetEmail(link: string): EmailPayload["html"] {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">Reset your Aced password</h2>
      <p>Click the link below to reset your password. This link expires in 60 minutes.</p>
      <a href="${link}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;
}

export function buildCreatorApplicationEmail(opts: {
  applicantName: string;
  applicantEmail: string;
  grade: string;
  graduationYear: number;
  headline: string;
  creatorProfileId: string;
  appUrl?: string;
}): EmailPayload["html"] {
  const adminUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://acedtutoring.co.uk"}/admin/applications`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">New Creator Application — Aced</h2>
      <p>A new applicant has submitted a creator application and requires review.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Name</td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.applicantName}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Email</td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.applicantEmail}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Grade</td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.grade}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Graduation Year</td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.graduationYear}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Headline</td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.headline}</td></tr>
      </table>
      <p style="color:#666;">Verification documents (degree certificate, DBS check) are uploaded separately by the applicant and will appear in the admin panel.</p>
      <a href="${adminUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Review Application</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">Creator Profile ID: ${opts.creatorProfileId}</p>
    </div>
  `;
}

/** #14 — Confirmation email sent to applicant on submission */
export function buildApplicationReceivedEmail(opts: {
  applicantName: string;
  headline: string;
  grade: string;
  appUrl?: string;
}): EmailPayload["html"] {
  const statusUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://acedtutoring.co.uk"}/apply/status`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">We've received your Aced application</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Thanks for applying to become a creator on Aced! We've received your application and our team will review it within <strong>48 hours</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;width:140px;">Your headline</td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.headline}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Academic grade</td><td style="padding:8px;border:1px solid #e5e7eb;">${opts.grade}</td></tr>
      </table>
      <p>You don't need to do anything else right now — we'll send you another email as soon as a decision has been made. <strong>Please don't resubmit your application</strong> as this may delay the review process.</p>
      <p>You can check your application status at any time using the button below.</p>
      <a href="${statusUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">View Application Status</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you have any questions, reply to this email and our team will be happy to help.</p>
    </div>
  `;
}

export function buildApprovalEmail(opts: {
  applicantName: string;
  appUrl?: string;
}): EmailPayload["html"] {
  const studioUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://acedtutoring.co.uk"}/studio`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">You're Approved — Welcome to Aced! 🎉</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Congratulations! Your creator application has been approved. You're now ready to start sharing your expertise and earning on Aced.</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-weight:bold;color:#15803d;">Get started:</p>
        <ol style="margin:8px 0 0;padding-left:20px;color:#166534;">
          <li>Set up your Stripe account to receive payouts</li>
          <li>Customise your tutor studio and showcase</li>
          <li>Create your first listing and go live</li>
        </ol>
      </div>
      <a href="${studioUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Go to My Studio</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">Welcome to the Aced community. If you have questions, reply to this email and our team will be happy to help.</p>
    </div>
  `;
}

export function buildRejectionEmail(opts: {
  applicantName: string;
  notes?: string;
}): EmailPayload["html"] {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">Your Aced Application Update</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Thank you for taking the time to apply to become a creator on Aced. After reviewing your application, we are unable to approve it at this time.</p>
      ${opts.notes ? `
      <div style="background:#f9fafb;border-left:4px solid #6b7280;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-weight:bold;">Reviewer note:</p>
        <p style="margin:8px 0 0;">${opts.notes}</p>
      </div>` : ""}
      <p>This is usually due to academic credential requirements not being met. You may re-apply once you have additional supporting credentials.</p>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you have questions, reply to this email and our team will be happy to help.</p>
    </div>
  `;
}

export function buildChangesRequestedEmail(opts: {
  applicantName: string;
  notes: string;
  appUrl?: string;
}): EmailPayload["html"] {
  const statusUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://acedtutoring.co.uk"}/creator/apply/status`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">Changes Requested on Your Aced Application</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Our team has reviewed your creator application and is asking you to make some changes before we can proceed.</p>
      <div style="background:#f9fafb;border-left:4px solid #7B2FF7;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-weight:bold;">Reviewer note:</p>
        <p style="margin:8px 0 0;">${opts.notes}</p>
      </div>
      <p>Please visit your application status page to review the feedback and resubmit when you're ready.</p>
      <a href="${statusUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">View Application Status</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you have questions, reply to this email and our team will be happy to help.</p>
    </div>
  `;
}

export function buildApprovedEmail(opts: {
  applicantName: string;
  appUrl?: string;
}): EmailPayload["html"] {
  const dashboardUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://acedtutoring.co.uk"}/creator/dashboard`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">🎉 Welcome to Aced — You're Approved!</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Congratulations! Your creator application has been <strong>approved</strong>. You're now part of the Aced community and can start sharing your knowledge with students.</p>
      <p>Here's what to do next:</p>
      <ul style="line-height:1.8;">
        <li>Complete your creator profile and add a bio</li>
        <li>Connect your Stripe account to receive payments</li>
        <li>Create your first listing — a session, course, or subscription plan</li>
      </ul>
      <a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Go to Your Creator Dashboard</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you have any questions, reply to this email and we'll be happy to help.</p>
    </div>
  `;
}

export function buildRejectedEmail(opts: {
  applicantName: string;
  notes?: string;
  appUrl?: string;
}): EmailPayload["html"] {
  const appUrl = opts.appUrl ?? process.env.APP_URL ?? "https://acedtutoring.co.uk";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">Update on Your Aced Creator Application</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Thank you for taking the time to apply to become a creator on Aced. After careful review, we're unable to approve your application at this time.</p>
      ${opts.notes ? `
      <div style="background:#f9fafb;border-left:4px solid #e5e7eb;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-weight:bold;">Reviewer note:</p>
        <p style="margin:8px 0 0;">${opts.notes}</p>
      </div>` : ""}
      <p>We appreciate your interest in Aced and wish you all the best. If you believe this decision was made in error or have further questions, please don't hesitate to reach out.</p>
      <a href="${appUrl}" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7B2FF7,#00D4FF);color:white;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Visit Aced</a>
      <p style="color:#666;font-size:12px;margin-top:24px;">If you have questions, reply to this email and our team will be happy to help.</p>
    </div>
  `;
}

export function buildBookingConfirmationEmail(opts: {
  learnerName: string;
  creatorName: string;
  startAt: string;
  meetingLink?: string;
}): EmailPayload["html"] {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">Booking Confirmed</h2>
      <p>Hi ${opts.learnerName},</p>
      <p>Your session with <strong>${opts.creatorName}</strong> is confirmed.</p>
      <p><strong>When:</strong> ${opts.startAt}</p>
      ${opts.meetingLink ? `<p><strong>Meeting link:</strong> <a href="${opts.meetingLink}">${opts.meetingLink}</a></p>` : ""}
      <p>You can view your booking in your <a href="${process.env.APP_URL ?? "https://acedtutoring.co.uk"}/dashboard">Aced dashboard</a>.</p>
    </div>
  `;
}
