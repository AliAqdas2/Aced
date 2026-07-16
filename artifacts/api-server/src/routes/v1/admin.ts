import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  ordersTable,
  orderItemsTable,
  paymentsTable,
  ledgerEntriesTable,
  reportsCasesTable,
  auditLogsTable,
  commissionRulesTable,
  listingsTable,
  creatorProfilesTable,
  bookingsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, desc, ilike, gte, lte } from "drizzle-orm";
import { requireRole } from "../../middlewares/auth";
import { logAuditEvent } from "../../lib/auth";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
}

// GET /api/v1/admin/dashboard — overview metrics
router.get(
  "/admin/dashboard",
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const [orderStats] = await db
      .select({
        totalOrders: db.$count(ordersTable.id),
      })
      .from(ordersTable)
      .where(eq(ordersTable.status, "paid"));

    const paidOrders = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.status, "paid"));

    const gmv = paidOrders.reduce((sum, o) => sum + o.totalMinorUnits, 0);
    const platformRevenue = paidOrders.reduce((sum, o) => sum + o.platformFeeMinorUnits, 0);

    const activeCreators = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.status, "approved"));

    const pendingApplications = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.status, "submitted"));

    const pendingListings = await db
      .select()
      .from(listingsTable)
      .where(eq(listingsTable.status, "submitted"));

    const openReports = await db
      .select()
      .from(reportsCasesTable)
      .where(eq(reportsCasesTable.status, "open"));

    res.json({
      data: {
        gmvMinorUnits: gmv,
        platformRevenueMinorUnits: platformRevenue,
        totalOrders: paidOrders.length,
        activeCreators: activeCreators.length,
        pendingApplications: pendingApplications.length,
        pendingListingModeration: pendingListings.length,
        openReports: openReports.length,
      },
    });
  }
);

// GET /api/v1/admin/users
router.get(
  "/admin/users",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const search = req.query["search"] as string | undefined;
    const role = req.query["role"] as string | undefined;
    const status = req.query["status"] as string | undefined;

    let query = db
      .select({
        user: usersTable,
        profile: profilesTable,
      })
      .from(usersTable)
      .leftJoin(profilesTable, eq(profilesTable.userId, usersTable.id))
      .$dynamic();

    if (search) {
      query = query.where(ilike(usersTable.email, `%${search}%`));
    }
    if (role) {
      query = query.where(eq(usersTable.role, role as any));
    }
    if (status) {
      query = query.where(eq(usersTable.status, status as any));
    }

    const users = await query.orderBy(desc(usersTable.createdAt)).limit(50);
    res.json({ data: users });
  }
);

// POST /api/v1/admin/users/:id/action
router.post(
  "/admin/users/:id/action",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({
      action: z.enum(["suspend", "restore", "close"]),
      reason: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const statusMap: Record<string, string> = {
      suspend: "suspended",
      restore: "active",
      close: "closed",
    };

    const [updated] = await db
      .update(usersTable)
      .set({ status: statusMap[parsed.data.action] as any })
      .where(eq(usersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await logAuditEvent({
      actorId: req.session.userId,
      actorRole: req.session.role,
      action: `user.${parsed.data.action}`,
      targetId: id,
      targetType: "user",
      summary: parsed.data.reason,
    });

    res.json({ data: updated });
  }
);

// GET /api/v1/admin/orders
router.get(
  "/admin/orders",
  requireRole("finance"),
  async (req, res): Promise<void> => {
    const status = req.query["status"] as string | undefined;

    let orders;
    if (status) {
      orders = await db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.status, status as any))
        .orderBy(desc(ordersTable.createdAt))
        .limit(50);
    } else {
      orders = await db
        .select()
        .from(ordersTable)
        .orderBy(desc(ordersTable.createdAt))
        .limit(50);
    }

    res.json({ data: orders });
  }
);

// POST /api/v1/admin/orders/:id/refund
router.post(
  "/admin/orders/:id/refund",
  requireRole("finance"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({
      amountMinorUnits: z.number().int().positive().optional(),
      reason: z.string().min(5),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .limit(1);

    if (!order || !order.stripePaymentIntentId) {
      res.status(404).json({ error: "Order not found or not chargeable" });
      return;
    }

    const stripe = getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: order.stripePaymentIntentId,
      ...(parsed.data.amountMinorUnits
        ? { amount: parsed.data.amountMinorUnits }
        : {}),
      reason: "requested_by_customer",
      metadata: { orderId: id, adminId: req.session.userId!, adminReason: parsed.data.reason },
    });

    await logAuditEvent({
      actorId: req.session.userId,
      actorRole: req.session.role,
      action: "order.refund",
      targetId: id,
      targetType: "order",
      summary: `Refunded ${parsed.data.amountMinorUnits ?? "full"} — ${parsed.data.reason}`,
    });

    res.json({ data: { refundId: refund.id, status: refund.status } });
  }
);

// GET /api/v1/admin/reports
router.get(
  "/admin/reports",
  requireRole("moderator"),
  async (req, res): Promise<void> => {
    const status = (req.query["status"] as string) ?? "open";
    const reports = await db
      .select()
      .from(reportsCasesTable)
      .where(eq(reportsCasesTable.status, status as any))
      .orderBy(reportsCasesTable.createdAt)
      .limit(50);

    res.json({ data: reports });
  }
);

// POST /api/v1/admin/reports/:id/decision
router.post(
  "/admin/reports/:id/decision",
  requireRole("moderator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({
      status: z.enum(["resolved", "dismissed"]),
      resolution: z.string().min(5),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [updated] = await db
      .update(reportsCasesTable)
      .set({
        status: parsed.data.status,
        resolution: parsed.data.resolution,
        resolvedAt: new Date(),
        assignedTo: req.session.userId,
      })
      .where(eq(reportsCasesTable.id, id))
      .returning();

    await logAuditEvent({
      actorId: req.session.userId,
      actorRole: req.session.role,
      action: `report.${parsed.data.status}`,
      targetId: id,
      targetType: "report",
      summary: parsed.data.resolution,
    });

    res.json({ data: updated });
  }
);

// GET /api/v1/admin/audit-logs
router.get(
  "/admin/audit-logs",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const actorId = req.query["actorId"] as string | undefined;
    const action = req.query["action"] as string | undefined;

    let logs;
    if (actorId) {
      logs = await db
        .select()
        .from(auditLogsTable)
        .where(eq(auditLogsTable.actorId, actorId))
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(100);
    } else {
      logs = await db
        .select()
        .from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(100);
    }

    res.json({ data: logs });
  }
);

// GET /api/v1/admin/commission-rules
router.get(
  "/admin/commission-rules",
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const rules = await db
      .select()
      .from(commissionRulesTable)
      .where(eq(commissionRulesTable.isActive, true))
      .orderBy(commissionRulesTable.createdAt);

    res.json({ data: rules });
  }
);

// POST /api/v1/admin/commission-rules
router.post(
  "/admin/commission-rules",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      scope: z.enum(["global", "creator", "category"]),
      scopeId: z.string().uuid().optional(),
      offerType: z.string().optional(),
      rateBasisPoints: z.number().int().min(0).max(10000),
      description: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [rule] = await db
      .insert(commissionRulesTable)
      .values({ ...parsed.data, createdBy: req.session.userId })
      .returning();

    await logAuditEvent({
      actorId: req.session.userId,
      actorRole: req.session.role,
      action: "commission_rule.create",
      targetId: rule.id,
      targetType: "commission_rule",
      summary: `${parsed.data.scope} rate ${parsed.data.rateBasisPoints}bps`,
    });

    res.status(201).json({ data: rule });
  }
);

// POST /api/v1/reports — user reports content
router.post("/reports", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const Body = z.object({
    subjectType: z.enum(["user", "listing", "review", "message", "asset"]),
    subjectId: z.string().uuid(),
    category: z.enum([
      "academic_misconduct",
      "copyright_infringement",
      "spam",
      "harassment",
      "fraud",
      "inappropriate_content",
      "other",
    ]),
    description: z.string().min(20).max(2000),
  });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const [report] = await db
    .insert(reportsCasesTable)
    .values({
      reporterId: req.session.userId,
      ...parsed.data,
      priority: "medium",
      status: "open",
    })
    .returning();

  res.status(201).json({ data: report });
});

export default router;
