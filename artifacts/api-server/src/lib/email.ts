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
