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
  platformConfigTable,
  universitiesTable,
  creatorExpertiseTable,
  failedEmailsTable,
} from "@workspace/db";
import { eq, and, desc, ilike, gte, lt, inArray, sql, isNull, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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

// GET /api/v1/admin/config — read platform settings
router.get(
  "/admin/config",
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const configs = await db.select().from(platformConfigTable);
    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    res.json({
      data: {
        approvalEmail: map["APPROVAL_EMAIL"] ?? "AcedApprovals@creativecloud.ai",
        dbsRequired: map["DBS_REQUIRED"] === "true",
        commissionRate: parseFloat(map["COMMISSION_RATE"] ?? "15"),
      },
    });
  }
);

// PATCH /api/v1/admin/config — update platform settings (upsert)
router.patch(
  "/admin/config",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      approvalEmail: z.string().email().optional(),
      dbsRequired: z.boolean().optional(),
      commissionRate: z.number().min(0).max(100).optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const updates: Record<string, string> = {};
    if (parsed.data.approvalEmail !== undefined) updates["APPROVAL_EMAIL"] = parsed.data.approvalEmail;
    if (parsed.data.dbsRequired !== undefined) updates["DBS_REQUIRED"] = String(parsed.data.dbsRequired);
    if (parsed.data.commissionRate !== undefined) updates["COMMISSION_RATE"] = String(parsed.data.commissionRate);

    const userId = req.session.userId!;
    for (const [key, value] of Object.entries(updates)) {
      await db
        .insert(platformConfigTable)
        .values({ key, value, updatedBy: userId })
        .onConflictDoUpdate({
          target: platformConfigTable.key,
          set: { value, updatedBy: userId, updatedAt: new Date() },
        });
    }

    await logAuditEvent({
      actorId: userId,
      actorRole: req.session.role,
      action: "platform_config.update",
      targetType: "platform_config",
      summary: Object.keys(updates).join(", "),
    });

    const configs = await db.select().from(platformConfigTable);
    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    res.json({
      data: {
        approvalEmail: map["APPROVAL_EMAIL"] ?? "AcedApprovals@creativecloud.ai",
        dbsRequired: map["DBS_REQUIRED"] === "true",
        commissionRate: parseFloat(map["COMMISSION_RATE"] ?? "15"),
      },
    });
  }
);

// GET /api/v1/admin/platform-stats — financial + user overview
router.get(
  "/admin/platform-stats",
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const allUniversities = await db.select({ id: universitiesTable.id }).from(universitiesTable);

    const allUsers = await db.select({ role: usersTable.role }).from(usersTable);
    const studentCount = allUsers.filter((u) => u.role === "learner").length;
    const creatorCount = allUsers.filter((u) => u.role === "creator").length;

    const paidOrders = await db
      .select({ total: ordersTable.totalMinorUnits, fee: ordersTable.platformFeeMinorUnits })
      .from(ordersTable)
      .where(eq(ordersTable.status, "paid"));
    const gmvMinorUnits = paidOrders.reduce((s, o) => s + o.total, 0);
    // Use actual persisted platform fees — not a synthetic rate × GMV estimate
    const commissionEarnedMinorUnits = paidOrders.reduce((s, o) => s + o.fee, 0);

    const [commCfg] = await db
      .select()
      .from(platformConfigTable)
      .where(eq(platformConfigTable.key, "COMMISSION_RATE"))
      .limit(1);
    const commissionRatePct = parseFloat(commCfg?.value ?? "15");

    res.json({
      data: {
        totalUniversities: allUniversities.length,
        totalStudents: studentCount,
        totalCreators: creatorCount,
        gmvMinorUnits,
        commissionEarnedMinorUnits,
        commissionRatePct,
      },
    });
  }
);

// GET /api/v1/admin/universities — all universities with creator counts
router.get(
  "/admin/universities",
  requireRole("admin"),
  async (_req, res): Promise<void> => {
    const universities = await db
      .select()
      .from(universitiesTable)
      .orderBy(universitiesTable.name);

    const expertises = await db
      .select({ universityId: creatorExpertiseTable.universityId })
      .from(creatorExpertiseTable)
      .where(eq(creatorExpertiseTable.isPrimary, true));

    const creatorsByUni = expertises.reduce<Record<string, number>>((acc, e) => {
      if (e.universityId) acc[e.universityId] = (acc[e.universityId] ?? 0) + 1;
      return acc;
    }, {});

    const result = universities.map((u) => ({
      ...u,
      creatorCount: creatorsByUni[u.id] ?? 0,
    }));

    res.json({ data: result });
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
    const creatorIdParam = req.query["creatorId"] as string | undefined;
    const buyerEmailParam = req.query["buyerEmail"] as string | undefined;
    const limitParam = req.query["limit"] as string | undefined;
    const offsetParam = req.query["offset"] as string | undefined;

    const PAGE_SIZE = 50;
    const limit = Math.min(Math.max(parseInt(limitParam ?? "50", 10) || PAGE_SIZE, 1), 200);
    const offset = Math.max(parseInt(offsetParam ?? "0", 10) || 0, 0);

    const conditions: ReturnType<typeof eq>[] = [];
    if (status) conditions.push(eq(ordersTable.status, status as any));
    if (creatorIdParam) conditions.push(eq(orderItemsTable.creatorIdSnapshot, creatorIdParam));

    // Resolve buyer email to user IDs before building the query
    if (buyerEmailParam) {
      const matchingBuyers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(ilike(usersTable.email, buyerEmailParam));
      const buyerIds = matchingBuyers.map((u) => u.id);
      if (buyerIds.length === 0) {
        res.json({ data: [], hasMore: false });
        return;
      }
      conditions.push(inArray(ordersTable.buyerId, buyerIds) as any);
    }

    // Join path for the live fallback:
    //   order_items.creator_id_snapshot → creator_profiles.id
    //   → creator_profiles.user_id → profiles.user_id → display_name
    // COALESCE prefers the snapshot (populated at checkout for new orders) and
    // falls back to the live profile for orders created before the snapshot was added.
    const creatorUserProfile = alias(profilesTable, "creator_user_profile");

    // Fetch one extra row to detect whether more pages exist without a COUNT query.
    const rows = await db
      .select({
        orderId: ordersTable.id,
        status: ordersTable.status,
        currency: ordersTable.currency,
        totalMinorUnits: ordersTable.totalMinorUnits,
        platformFeeMinorUnits: ordersTable.platformFeeMinorUnits,
        createdAt: ordersTable.createdAt,
        listingTitle: orderItemsTable.listingTitleSnapshot,
        creatorId: orderItemsTable.creatorIdSnapshot,
        creatorName: sql<string | null>`COALESCE(${orderItemsTable.creatorNameSnapshot}, ${creatorUserProfile.displayName})`,
        unitAmountMinorUnits: orderItemsTable.unitAmountMinorUnits,
        creatorProceedsMinorUnits: orderItemsTable.creatorProceedsMinorUnits,
        commissionRateBasisPoints: orderItemsTable.commissionRateBasisPoints,
      })
      .from(ordersTable)
      .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
      .leftJoin(creatorProfilesTable, eq(creatorProfilesTable.id, orderItemsTable.creatorIdSnapshot))
      .leftJoin(creatorUserProfile, eq(creatorUserProfile.userId, creatorProfilesTable.userId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ordersTable.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    res.json({ data, hasMore });
  }
);

// Maximum rows returned by the CSV export. Requests exceeding this will be
// truncated and the response will carry X-Export-Truncated: true.
const EXPORT_ROW_LIMIT = 10_000;

// GET /api/v1/admin/orders/export — download paid orders as CSV (optional ?from=&to= ISO date filters, ?creatorId=, ?buyerEmail=)
// Pass ?countOnly=true to get a lightweight { data: { count: N } } estimate instead of the full CSV.
router.get(
  "/admin/orders/export",
  requireRole("finance"),
  async (req, res): Promise<void> => {
    const fromParam = req.query["from"] as string | undefined;
    const toParam = req.query["to"] as string | undefined;
    const creatorIdParam = req.query["creatorId"] as string | undefined;
    const buyerEmailParam = req.query["buyerEmail"] as string | undefined;
    const countOnly = req.query["countOnly"] === "true";

    // Validate date params when provided
    const fromDate = fromParam ? new Date(fromParam) : undefined;
    const toDate = toParam ? new Date(toParam) : undefined;

    if (fromDate && isNaN(fromDate.getTime())) {
      res.status(400).json({ error: "Invalid 'from' date" });
      return;
    }
    if (toDate && isNaN(toDate.getTime())) {
      res.status(400).json({ error: "Invalid 'to' date" });
      return;
    }
    if (fromDate && toDate && fromDate > toDate) {
      res.status(400).json({ error: "'from' must not be later than 'to'" });
      return;
    }

    // Build where conditions
    const conditions = [eq(ordersTable.status, "paid")];
    if (fromDate) conditions.push(gte(ordersTable.createdAt, fromDate));
    // Treat 'to' as end-of-day inclusive: use strict-less-than the next day's
    // midnight so that a record at exactly 00:00:00 on (toDate + 1) is excluded.
    if (toDate) {
      const nextDayStart = new Date(toDate);
      nextDayStart.setDate(nextDayStart.getDate() + 1);
      conditions.push(lt(ordersTable.createdAt, nextDayStart));
    }
    if (creatorIdParam) {
      conditions.push(eq(orderItemsTable.creatorIdSnapshot, creatorIdParam));
    }
    if (buyerEmailParam) {
      // Resolve the buyer's userId from their email first, then filter orders
      const matchingBuyers = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(ilike(usersTable.email, buyerEmailParam));
      const buyerIds = matchingBuyers.map((u) => u.id);
      if (buyerIds.length === 0) {
        if (countOnly) {
          res.json({ data: { count: 0 } });
          return;
        }
        // No matching buyer — return empty CSV
        res.setHeader("Content-Type", "text/csv");
        const filename = `aced-transactions-no-results.csv`;
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(
          [
            "Order ID,Date,Buyer Email,Creator ID,Creator Name,Listing Title,Gross Amount (£),Platform Fee (£),Creator Proceeds (£),Commission Rate",
          ].join("\r\n")
        );
        return;
      }
      conditions.push(inArray(ordersTable.buyerId, buyerIds));
    }

    // countOnly: run a lightweight COUNT query and return the estimate
    if (countOnly) {
      const countRows = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
        .where(and(...conditions));
      res.json({ data: { count: countRows.length } });
      return;
    }

    // COALESCE prefers the snapshot (set at checkout for new orders) and falls
    // back to the live profile join for orders created before the snapshot column existed.
    const creatorExportProfile = alias(profilesTable, "creator_export_profile");

    // Fetch one extra row so we can detect truncation without a separate COUNT query
    const rows = await db
      .select({
        orderId: ordersTable.id,
        createdAt: ordersTable.createdAt,
        buyerEmail: usersTable.email,
        listingTitle: orderItemsTable.listingTitleSnapshot,
        creatorId: orderItemsTable.creatorIdSnapshot,
        creatorName: sql<string | null>`COALESCE(${orderItemsTable.creatorNameSnapshot}, ${creatorExportProfile.displayName})`,
        grossMinorUnits: orderItemsTable.unitAmountMinorUnits,
        platformFeeMinorUnits: orderItemsTable.platformFeeMinorUnits,
        creatorProceedsMinorUnits: orderItemsTable.creatorProceedsMinorUnits,
        commissionRateBasisPoints: orderItemsTable.commissionRateBasisPoints,
      })
      .from(ordersTable)
      .innerJoin(usersTable, eq(usersTable.id, ordersTable.buyerId))
      .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
      .leftJoin(creatorProfilesTable, eq(creatorProfilesTable.id, orderItemsTable.creatorIdSnapshot))
      .leftJoin(creatorExportProfile, eq(creatorExportProfile.userId, creatorProfilesTable.userId))
      .where(and(...conditions))
      .orderBy(desc(ordersTable.createdAt))
      .limit(EXPORT_ROW_LIMIT + 1);

    const truncated = rows.length > EXPORT_ROW_LIMIT;
    const exportRows = truncated ? rows.slice(0, EXPORT_ROW_LIMIT) : rows;

    const headers = [
      "Order ID",
      "Date",
      "Buyer Email",
      "Creator ID",
      "Creator Name",
      "Listing Title",
      "Gross Amount (£)",
      "Platform Fee (£)",
      "Creator Proceeds (£)",
      "Commission Rate",
    ];

    // Neutralize CSV formula injection: prefix values starting with formula
    // characters (=, +, -, @, TAB, CR) with a tab so spreadsheet apps treat
    // the cell as plain text rather than a formula.
    const sanitize = (v: string): string => {
      const s = String(v);
      return /^[=+\-@\t\r]/.test(s) ? `\t${s}` : s;
    };
    const escape = (v: string) => `"${sanitize(v).replace(/"/g, '""')}"`;
    const toGBP = (minor: number) => (minor / 100).toFixed(2);

    const csvRows = [
      headers.map(escape).join(","),
      ...exportRows.map((r) =>
        [
          r.orderId,
          r.createdAt.toISOString(),
          r.buyerEmail,
          r.creatorId,
          r.creatorName ?? "",
          r.listingTitle,
          toGBP(r.grossMinorUnits),
          toGBP(r.platformFeeMinorUnits),
          toGBP(r.creatorProceedsMinorUnits),
          `${(r.commissionRateBasisPoints / 100).toFixed(1)}%`,
        ]
          .map(escape)
          .join(",")
      ),
    ].join("\r\n");

    // Build a descriptive filename reflecting the chosen filters
    const parts: string[] = [];
    if (fromParam || toParam) {
      const fromStr = fromParam ?? "all";
      const toStr = toParam ?? "time";
      parts.push(`${fromStr}_${toStr}`);
    }
    if (creatorIdParam) parts.push(`creator-${creatorIdParam.slice(0, 8)}`);
    if (buyerEmailParam) parts.push(`buyer-${buyerEmailParam.replace(/[^a-z0-9]/gi, "_")}`);

    const filename =
      parts.length > 0
        ? `aced-transactions-${parts.join("-")}.csv`
        : `aced-transactions-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("X-Export-Row-Count", String(exportRows.length));
    res.setHeader("X-Export-Truncated", String(truncated));
    // Expose custom headers to browser JS (required for cross-origin fetch; harmless for same-origin)
    res.setHeader("Access-Control-Expose-Headers", "X-Export-Row-Count, X-Export-Truncated");
    res.send(csvRows);
  }
);

// GET /api/v1/admin/creators/search?q= — typeahead for creator name in export filter
router.get(
  "/admin/creators/search",
  requireRole("finance"),
  async (req, res): Promise<void> => {
    const q = (req.query["q"] as string | undefined)?.trim() ?? "";
    if (q.length < 2) {
      res.json({ data: [] });
      return;
    }

    const results = await db
      .select({
        id: creatorProfilesTable.id,
        displayName: profilesTable.displayName,
        email: usersTable.email,
      })
      .from(creatorProfilesTable)
      .innerJoin(usersTable, eq(usersTable.id, creatorProfilesTable.userId))
      .leftJoin(profilesTable, eq(profilesTable.userId, creatorProfilesTable.userId))
      .where(
        ilike(profilesTable.displayName, `%${q}%`)
      )
      .orderBy(profilesTable.displayName)
      .limit(10);

    res.json({ data: results });
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

// GET /api/v1/admin/failed-emails — list emails that failed all delivery attempts
// Admins use this to identify applicants who were never notified so they can follow up manually.
router.get(
  "/admin/failed-emails",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const showResolved = req.query["resolved"] === "true";

    const rows = await db
      .select({
        id: failedEmailsTable.id,
        toEmail: failedEmailsTable.toEmail,
        subject: failedEmailsTable.subject,
        context: failedEmailsTable.context,
        errorMessage: failedEmailsTable.errorMessage,
        attempts: failedEmailsTable.attempts,
        resolvedAt: failedEmailsTable.resolvedAt,
        resolvedBy: failedEmailsTable.resolvedBy,
        createdAt: failedEmailsTable.createdAt,
      })
      .from(failedEmailsTable)
      .where(showResolved ? isNotNull(failedEmailsTable.resolvedAt) : isNull(failedEmailsTable.resolvedAt))
      .orderBy(desc(failedEmailsTable.createdAt))
      .limit(200);

    res.json({ data: rows, total: rows.length });
  }
);

// PATCH /api/v1/admin/failed-emails/:id/resolve — mark a failed email as manually resolved
router.patch(
  "/admin/failed-emails/:id/resolve",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [row] = await db
      .select()
      .from(failedEmailsTable)
      .where(eq(failedEmailsTable.id, id))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Failed email record not found" });
      return;
    }

    const [updated] = await db
      .update(failedEmailsTable)
      .set({
        resolvedAt: new Date(),
        resolvedBy: req.session.userId,
      })
      .where(eq(failedEmailsTable.id, id))
      .returning();

    await logAuditEvent({
      actorId: req.session.userId,
      actorRole: req.session.role,
      action: "failed_email.resolved",
      targetId: id,
      targetType: "failed_email",
      summary: `Resolved failed email to ${row.toEmail} (${row.context})`,
    });

    res.json({ data: updated });
  }
);

export default router;
