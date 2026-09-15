import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { sendEmail } from "./email";
import { logger } from "./logger";

export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_reminder"
  | "booking_completed"
  | "payment_received"
  | "product_access_granted"
  | "review_received"
  | "review_response"
  | "application_approved"
  | "application_rejected"
  | "application_changes_requested"
  | "listing_approved"
  | "listing_rejected"
  | "dispute_opened"
  | "refund_processed";

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  subject: string;
  body: string;
  email?: string;
  metadata?: Record<string, string>;
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // Always create in-app notification
  try {
    await db.insert(notificationsTable).values({
      userId: payload.userId,
      type: payload.type,
      channel: "in_app",
      subject: payload.subject,
      body: payload.body,
      isRead: false,
      status: "sent",
      sentAt: new Date(),
      metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to create in-app notification");
  }

  // Send email if address provided
  if (payload.email) {
    try {
      await sendEmail({
        to: payload.email,
        subject: payload.subject,
        html: `<div style="font-family: Arial, sans-serif; max-width:600px; margin: 0 auto;">
          <div style="background:linear-gradient(135deg,#7B2FF7,#00D4FF);padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="color:white;margin:0;">Aced Notification</h2>
          </div>
          <div style="padding:24px;border:1px solid #eee;border-top:0;border-radius:0 0 8px 8px;">
            <h3>${payload.subject}</h3>
            <p>${payload.body}</p>
          </div>
        </div>`,
      });

      await db
        .insert(notificationsTable)
        .values({
          userId: payload.userId,
          type: payload.type,
          channel: "email",
          subject: payload.subject,
          body: payload.body,
          isRead: false,
          status: "sent",
          sentAt: new Date(),
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
        });
    } catch (err) {
      logger.error({ err }, "Failed to send email notification");
    }
  }
}
