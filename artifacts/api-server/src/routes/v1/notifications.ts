import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  notificationsTable,
  conversationsTable,
  messagesTable,
} from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/v1/me/notifications
router.get("/me/notifications", requireAuth, async (req, res): Promise<void> => {
  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, req.session.userId!))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(30);

  res.json({ data: notifications });
});

// GET /api/v1/me/notifications/unread-count
router.get("/me/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const [result] = await db
    .select({ count: count() })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.userId, req.session.userId!),
        eq(notificationsTable.isRead, false)
      )
    );

  res.json({ data: { count: result?.count ?? 0 } });
});

// POST /api/v1/me/notifications/:id/read
router.post("/me/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(
      and(
        eq(notificationsTable.id, id),
        eq(notificationsTable.userId, req.session.userId!)
      )
    );

  res.json({ data: { success: true } });
});

// POST /api/v1/me/notifications/mark-all-read
router.post("/me/notifications/mark-all-read", requireAuth, async (req, res): Promise<void> => {
  await db
    .update(notificationsTable)
    .set({ isRead: true })
    .where(eq(notificationsTable.userId, req.session.userId!));

  res.json({ data: { success: true } });
});

// --- Messaging ---

// GET /api/v1/me/conversations
router.get("/me/conversations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { or } = await import("drizzle-orm");

  const conversations = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        eq(conversationsTable.participantA, userId),
        eq(conversationsTable.participantB, userId)
      )
    )
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(20);

  res.json({ data: conversations });
});

// GET /api/v1/me/conversations/:id/messages
router.get("/me/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.session.userId!;

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id))
    .limit(1);

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  if (conv.participantA !== userId && conv.participantB !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(messagesTable.createdAt)
    .limit(100);

  res.json({ data: messages });
});

// POST /api/v1/me/conversations/:id/messages
router.post("/me/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const userId = req.session.userId!;

  const Body = z.object({ body: z.string().min(1).max(5000) });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id))
    .limit(1);

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  if (conv.participantA !== userId && conv.participantB !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const isBlocked =
    (conv.participantA === userId && conv.isBlockedByA) ||
    (conv.participantB === userId && conv.isBlockedByB);

  if (isBlocked) {
    res.status(403).json({ error: "Conversation is blocked", code: "BLOCKED" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({ conversationId: id, senderId: userId, body: parsed.data.body })
    .returning();

  await db
    .update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, id));

  res.status(201).json({ data: message });
});

// POST /api/v1/me/conversations — start new conversation
router.post("/me/conversations", requireAuth, async (req, res): Promise<void> => {
  const Body = z.object({
    recipientId: z.string().uuid(),
    listingId: z.string().uuid().optional(),
    orderId: z.string().uuid().optional(),
    firstMessage: z.string().min(1).max(5000),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const userId = req.session.userId!;
  const { or } = await import("drizzle-orm");

  // Find existing conversation between these two users
  const [existing] = await db
    .select()
    .from(conversationsTable)
    .where(
      or(
        and(
          eq(conversationsTable.participantA, userId),
          eq(conversationsTable.participantB, parsed.data.recipientId)
        ),
        and(
          eq(conversationsTable.participantA, parsed.data.recipientId),
          eq(conversationsTable.participantB, userId)
        )
      )
    )
    .limit(1);

  let conv = existing;
  if (!conv) {
    const [newConv] = await db
      .insert(conversationsTable)
      .values({
        participantA: userId,
        participantB: parsed.data.recipientId,
        listingId: parsed.data.listingId ?? null,
        orderId: parsed.data.orderId ?? null,
      })
      .returning();
    conv = newConv;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({
      conversationId: conv.id,
      senderId: userId,
      body: parsed.data.firstMessage,
    })
    .returning();

  await db
    .update(conversationsTable)
    .set({ lastMessageAt: new Date() })
    .where(eq(conversationsTable.id, conv.id));

  res.status(201).json({ data: { conversation: conv, message } });
});

export default router;
