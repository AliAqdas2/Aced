import { logger } from "./logger";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
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
 * On total failure, logs a structured error to stderr for log aggregators.
 */
export async function sendEmailResilient(payload: EmailPayload): Promise<void> {
  try {
    await retryWithBackoff(() => sendEmail(payload), 3, 2000);
  } catch (err) {
    process.stderr.write(
      JSON.stringify({
        event: "email_failed",
        to: payload.to,
        subject: payload.subject,
        error: err instanceof Error ? err.message : String(err),
      }) + "\n"
    );
  }
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction || !process.env.SMTP_HOST) {
    logger.info(
      { to: payload.to, subject: payload.subject },
      "DEV: email would be sent"
    );
    return;
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? "noreply@aced.co.uk",
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    });

    logger.info({ to: payload.to, subject: payload.subject }, "Email sent");
  } catch (err) {
    logger.error({ err, to: payload.to }, "Failed to send email");
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
  const adminUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://aced.co.uk"}/admin/applications`;
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
  appUrl?: string;
}): EmailPayload["html"] {
  const statusUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://aced.co.uk"}/apply/status`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">We've received your Aced application</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Thanks for applying to become a creator on Aced! We've received your application and our team will review it within <strong>3–5 working days</strong>.</p>
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
  const studioUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://aced.co.uk"}/studio`;
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #7B2FF7;">You're Approved — Welcome to Aced! 🎉</h2>
      <p>Hi ${opts.applicantName},</p>
      <p>Congratulations! Your creator application has been approved. You're now ready to start sharing your expertise and earning on Aced.</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:16px 0;border-radius:4px;">
        <p style="margin:0;font-weight:bold;color:#15803d;">Get started:</p>
        <ol style="margin:8px 0 0;padding-left:20px;color:#166534;">
          <li>Set up your Stripe account to receive payouts</li>
          <li>Customise your creator studio and storefront</li>
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
  const statusUrl = `${opts.appUrl ?? process.env.APP_URL ?? "https://aced.co.uk"}/creator/apply/status`;
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
      <p>You can view your booking in your <a href="${process.env.APP_URL ?? "https://aced.co.uk"}/dashboard">Aced dashboard</a>.</p>
    </div>
  `;
}
