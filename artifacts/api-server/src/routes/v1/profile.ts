import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  usersTable,
  profilesTable,
  universitiesTable,
  ordersTable,
  orderItemsTable,
  listingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

// PATCH /api/v1/profile — update the logged-in learner's profile
router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const Body = z.object({
    displayName: z.string().min(1).max(100).optional(),
    bio: z.string().max(500).optional(),
    avatarUrl: z.string().url().optional().nullable(),
    universityId: z.string().uuid().optional().nullable(),
  });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const userId = req.session.userId!;
  const updates: Record<string, unknown> = {};
  if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
  if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio;
  if (parsed.data.avatarUrl !== undefined) updates.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.universityId !== undefined) updates.universityId = parsed.data.universityId;

  // Upsert — create profile if it doesn't exist yet
  const [existing] = await db
    .select({ id: profilesTable.id })
    .from(profilesTable)
    .where(eq(profilesTable.userId, userId))
    .limit(1);

  let profile;
  if (existing) {
    [profile] = await db
      .update(profilesTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(profilesTable.userId, userId))
      .returning();
  } else {
    [profile] = await db
      .insert(profilesTable)
      .values({
        userId,
        displayName: (parsed.data.displayName ?? ""),
        ...updates,
      })
      .returning();
  }

  res.json({ data: profile });
});

// GET /api/v1/students/:id — public student profile
router.get("/students/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [user] = await db
    .select({
      id: usersTable.id,
      createdAt: usersTable.createdAt,
      role: usersTable.role,
      status: usersTable.status,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user || user.status !== "active") {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const [profile] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.userId, id))
    .limit(1);

  if (!profile) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  // Fetch university name if set
  let universityName: string | null = null;
  if (profile.universityId) {
    const [uni] = await db
      .select({ name: universitiesTable.name })
      .from(universitiesTable)
      .where(eq(universitiesTable.id, profile.universityId))
      .limit(1);
    universityName = uni?.name ?? null;
  }

  // Fetch purchased listing titles (from paid orders)
  const purchases = await db
    .select({
      listingTitle: orderItemsTable.listingTitleSnapshot,
      listingId: orderItemsTable.listingId,
    })
    .from(ordersTable)
    .innerJoin(orderItemsTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(eq(ordersTable.buyerId, id), eq(ordersTable.status, "paid")));

  // Deduplicate by listingId
  const seen = new Set<string>();
  const uniquePurchases = purchases.filter((p) => {
    if (seen.has(p.listingId)) return false;
    seen.add(p.listingId);
    return true;
  });

  res.json({
    data: {
      id: user.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
      bio: profile.bio ?? null,
      universityName,
      universityId: profile.universityId ?? null,
      memberSince: user.createdAt,
      purchases: uniquePurchases.map((p) => ({
        listingId: p.listingId,
        title: p.listingTitle,
      })),
    },
  });
});

export default router;
