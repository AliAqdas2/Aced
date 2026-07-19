import { Router, type IRouter } from "express";
import { z } from "zod";
import { syncBookingCreated } from "../../lib/calendar-sync";
import { db } from "@workspace/db";
import {
  availabilityRulesTable,
  availabilityExceptionsTable,
  bookingHoldsTable,
  bookingsTable,
  serviceOffersTable,
  creatorProfilesTable,
  listingsTable,
  priceRecordsTable,
  learnerSubscriptionsTable,
} from "@workspace/db";
import { eq, and, gte, lte, isNull, or, gt } from "drizzle-orm";
import { requireAuth, requireRole } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/v1/services/:id/availability — public availability slots
router.get("/services/:id/availability", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const timezone = (req.query["timezone"] as string) ?? "Europe/London";
  const fromDate = (req.query["from"] as string) ?? new Date().toISOString().split("T")[0];
  const toDate =
    (req.query["to"] as string) ??
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(and(eq(listingsTable.id, id), eq(listingsTable.status, "published")))
    .limit(1);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const [offer] = await db
    .select()
    .from(serviceOffersTable)
    .where(eq(serviceOffersTable.listingId, id))
    .limit(1);

  if (!offer) {
    res.status(404).json({ error: "Service offer not found" });
    return;
  }

  const rules = await db
    .select()
    .from(availabilityRulesTable)
    .where(
      and(
        eq(availabilityRulesTable.creatorId, listing.creatorId),
        eq(availabilityRulesTable.isActive, true)
      )
    );

  const exceptions = await db
    .select()
    .from(availabilityExceptionsTable)
    .where(
      and(
        eq(availabilityExceptionsTable.creatorId, listing.creatorId),
        gte(availabilityExceptionsTable.exceptionDate, fromDate),
        lte(availabilityExceptionsTable.exceptionDate, toDate)
      )
    );

  // Get existing confirmed bookings in the range
  const existingBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.creatorId, listing.creatorId),
        gte(bookingsTable.scheduledStartAt, new Date(fromDate)),
        lte(bookingsTable.scheduledStartAt, new Date(toDate + "T23:59:59Z"))
      )
    );

  // Generate available slots
  const slots = generateSlots({
    rules,
    exceptions,
    existingBookings,
    offer,
    fromDate,
    toDate,
    timezone,
  });

  res.json({
    data: {
      listingId: id,
      serviceOfferId: offer.id,
      durationMinutes: offer.durationMinutes,
      timezone,
      slots,
    },
  });
});

function generateSlots(opts: {
  rules: any[];
  exceptions: any[];
  existingBookings: any[];
  offer: any;
  fromDate: string;
  toDate: string;
  timezone: string;
}): Array<{ startAt: string; endAt: string; available: boolean }> {
  const slots: Array<{ startAt: string; endAt: string; available: boolean }> = [];
  const { rules, exceptions, existingBookings, offer } = opts;

  const from = new Date(opts.fromDate + "T00:00:00Z");
  const to = new Date(opts.toDate + "T23:59:59Z");
  const minNoticeMs = offer.minNoticeHours * 60 * 60 * 1000;
  const now = new Date();

  const current = new Date(from);
  while (current <= to) {
    const dayOfWeek = current.getUTCDay();
    const dateStr = current.toISOString().split("T")[0];

    // Check exceptions
    const exception = exceptions.find((e) => e.exceptionDate === dateStr);
    if (exception?.isBlocked) {
      current.setUTCDate(current.getUTCDate() + 1);
      continue;
    }

    // Find rules for this day
    const dayRules = rules.filter((r) => r.dayOfWeek === dayOfWeek);

    for (const rule of dayRules) {
      // Parse time "HH:MM"
      const [sh, sm] = rule.startTimeUtc.split(":").map(Number);
      const [eh, em] = rule.endTimeUtc.split(":").map(Number);

      const slotStart = new Date(current);
      slotStart.setUTCHours(sh, sm, 0, 0);

      const windowEnd = new Date(current);
      windowEnd.setUTCHours(eh, em, 0, 0);

      while (slotStart < windowEnd) {
        const slotEnd = new Date(slotStart.getTime() + offer.durationMinutes * 60 * 1000);
        if (slotEnd > windowEnd) break;

        // Skip slots too soon
        const available =
          slotStart.getTime() - now.getTime() >= minNoticeMs &&
          !existingBookings.some(
            (b) =>
              ["confirmed", "held", "pending_payment", "in_progress"].includes(b.status) &&
              b.scheduledStartAt < slotEnd &&
              b.scheduledEndAt > slotStart
          );

        slots.push({
          startAt: slotStart.toISOString(),
          endAt: slotEnd.toISOString(),
          available,
        });

        // Move to next slot (add duration + buffer)
        const nextStart = new Date(
          slotEnd.getTime() + offer.bufferMinutesAfter * 60 * 1000
        );
        slotStart.setTime(nextStart.getTime());
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return slots.slice(0, 200); // cap response size
}

// POST /api/v1/bookings/holds — atomic slot reservation
router.post("/bookings/holds", requireAuth, async (req, res): Promise<void> => {
  const Body = z.object({
    listingId: z.string().uuid(),
    serviceOfferId: z.string().uuid(),
    startAt: z.string().datetime(),
    timezone: z.string().default("Europe/London"),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { listingId, serviceOfferId, startAt, timezone } = parsed.data;
  const learnerId = req.session.userId!;

  const [offer] = await db
    .select()
    .from(serviceOffersTable)
    .where(eq(serviceOffersTable.id, serviceOfferId))
    .limit(1);

  if (!offer) {
    res.status(404).json({ error: "Service offer not found" });
    return;
  }

  const startDate = new Date(startAt);
  const endDate = new Date(startDate.getTime() + offer.durationMinutes * 60 * 1000);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min hold

  // Canonical interval-overlap check: A overlaps B when A.start < B.end && A.end > B.start.
  // Fetch all bookings for this service offer that touch the new slot's time range.
  const overlappingBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.serviceOfferId, serviceOfferId),
        // existing.start < newEnd AND existing.end > newStart
        lte(bookingsTable.scheduledStartAt, endDate),
        gte(bookingsTable.scheduledEndAt, startDate)
      )
    );

  const conflicting = overlappingBookings.filter((b) =>
    ["confirmed", "held", "pending_payment", "in_progress"].includes(b.status)
  );

  if (conflicting.length > 0) {
    res.status(409).json({ error: "Slot no longer available", code: "SLOT_TAKEN" });
    return;
  }

  // Check active holds using the same canonical overlap logic.
  const now = new Date();
  const overlappingHolds = await db
    .select()
    .from(bookingHoldsTable)
    .where(
      and(
        eq(bookingHoldsTable.serviceOfferId, serviceOfferId),
        eq(bookingHoldsTable.status, "active"),
        gte(bookingHoldsTable.expiresAt, now),
        // existing.holdStart < newEnd AND existing.holdEnd > newStart
        lte(bookingHoldsTable.holdStartsAt, endDate),
        gte(bookingHoldsTable.holdEndsAt, startDate)
      )
    );

  if (overlappingHolds.length > 0) {
    res.status(409).json({ error: "Slot is held by another user", code: "SLOT_HELD" });
    return;
  }

  const [hold] = await db
    .insert(bookingHoldsTable)
    .values({
      listingId,
      serviceOfferId,
      learnerId,
      holdStartsAt: startDate,
      holdEndsAt: endDate,
      expiresAt,
      status: "active",
    })
    .returning();

  res.status(201).json({ data: hold });
});

// POST /api/v1/bookings/confirm — confirm a free booking immediately (no Stripe)
router.post("/bookings/confirm", requireAuth, async (req, res): Promise<void> => {
  const Body = z.object({
    listingId: z.string().uuid(),
    serviceOfferId: z.string().uuid(),
    startAt: z.string().datetime(),
    timezone: z.string().default("Europe/London"),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { listingId, serviceOfferId, startAt, timezone } = parsed.data;
  const learnerId = req.session.userId!;

  // Fetch listing and service offer first (needed to determine pricingMode)
  const [listing] = await db
    .select()
    .from(listingsTable)
    .where(and(eq(listingsTable.id, listingId), eq(listingsTable.status, "published")))
    .limit(1);

  if (!listing) {
    res.status(404).json({ error: "Listing not found" });
    return;
  }

  const [offer] = await db
    .select()
    .from(serviceOffersTable)
    .where(eq(serviceOffersTable.id, serviceOfferId))
    .limit(1);

  if (!offer) {
    res.status(404).json({ error: "Service offer not found" });
    return;
  }

  // Access check: free listing or active subscription with credits
  let activeSubscription: { id: string; sessionsRemaining: number } | null = null;

  if (offer.pricingMode === "subscription") {
    const [activeSub] = await db
      .select()
      .from(learnerSubscriptionsTable)
      .where(
        and(
          eq(learnerSubscriptionsTable.learnerId, learnerId),
          eq(learnerSubscriptionsTable.serviceOfferId, serviceOfferId),
          eq(learnerSubscriptionsTable.status, "active"),
          gt(learnerSubscriptionsTable.sessionsRemaining, 0),
          gt(learnerSubscriptionsTable.currentPeriodEnd, new Date())
        )
      )
      .limit(1);

    if (!activeSub) {
      res.status(402).json({ error: "No active subscription credits for this plan", code: "NO_CREDITS" });
      return;
    }
    activeSubscription = { id: activeSub.id, sessionsRemaining: activeSub.sessionsRemaining };
  } else {
    // Per-session listing: must be free
    const [priceRecord] = await db
      .select()
      .from(priceRecordsTable)
      .where(and(eq(priceRecordsTable.listingId, listingId), eq(priceRecordsTable.isActive, true)))
      .limit(1);

    if (priceRecord && priceRecord.amountMinorUnits > 0) {
      res.status(400).json({ error: "Listing is not free", code: "PAID_LISTING" });
      return;
    }
  }

  const startDate = new Date(startAt);
  const endDate = new Date(startDate.getTime() + offer.durationMinutes * 60 * 1000);
  const now = new Date();

  // Minimum notice check
  const minNoticeMs = offer.minNoticeHours * 60 * 60 * 1000;
  if (startDate.getTime() - now.getTime() < minNoticeMs) {
    res.status(409).json({ error: "Insufficient notice for this booking", code: "TOO_SOON" });
    return;
  }

  // Overlap check: bookings
  const overlappingBookings = await db
    .select()
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.serviceOfferId, serviceOfferId),
        lte(bookingsTable.scheduledStartAt, endDate),
        gte(bookingsTable.scheduledEndAt, startDate)
      )
    );

  const conflicting = overlappingBookings.filter((b) =>
    ["confirmed", "held", "pending_payment", "in_progress"].includes(b.status)
  );

  if (conflicting.length > 0) {
    res.status(409).json({ error: "Slot no longer available", code: "SLOT_TAKEN" });
    return;
  }

  // Overlap check: active holds
  const overlappingHolds = await db
    .select()
    .from(bookingHoldsTable)
    .where(
      and(
        eq(bookingHoldsTable.serviceOfferId, serviceOfferId),
        eq(bookingHoldsTable.status, "active"),
        gte(bookingHoldsTable.expiresAt, now),
        lte(bookingHoldsTable.holdStartsAt, endDate),
        gte(bookingHoldsTable.holdEndsAt, startDate)
      )
    );

  if (overlappingHolds.length > 0) {
    res.status(409).json({ error: "Slot is held by another user", code: "SLOT_HELD" });
    return;
  }

  // Create hold (immediately converted)
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
  const [hold] = await db
    .insert(bookingHoldsTable)
    .values({
      listingId,
      serviceOfferId,
      learnerId,
      holdStartsAt: startDate,
      holdEndsAt: endDate,
      expiresAt,
      status: "converted",
    })
    .returning();

  // Confirm booking immediately
  const [booking] = await db
    .insert(bookingsTable)
    .values({
      holdId: hold.id,
      learnerId,
      creatorId: listing.creatorId,
      serviceOfferId,
      listingId,
      scheduledStartAt: startDate,
      scheduledEndAt: endDate,
      status: "confirmed",
      learnerTimezone: timezone,
    })
    .returning();

  // Decrement subscription credit now that booking is confirmed
  if (activeSubscription) {
    await db
      .update(learnerSubscriptionsTable)
      .set({ sessionsRemaining: activeSubscription.sessionsRemaining - 1 })
      .where(eq(learnerSubscriptionsTable.id, activeSubscription.id));
  }

  // Fire-and-forget calendar sync
  const [cp] = await db
    .select({ userId: creatorProfilesTable.userId, videoCallLink: creatorProfilesTable.videoCallLink })
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.id, listing.creatorId))
    .limit(1);

  // Populate meeting link from creator's video call settings
  const meetingLink = cp?.videoCallLink ?? null;
  if (meetingLink) {
    await db
      .update(bookingsTable)
      .set({ meetingLink })
      .where(eq(bookingsTable.id, booking.id));
  }

  if (cp) {
    syncBookingCreated({
      bookingId: booking.id,
      listingTitle: listing.title,
      scheduledStartAt: startDate,
      scheduledEndAt: endDate,
      meetingLink,
      learnerId,
      creatorUserId: cp.userId,
    }).catch(() => {});
  }

  res.status(201).json({ data: { bookingId: booking.id, status: "confirmed" } });
});

// --- Creator availability management ---

// GET /api/v1/creator/availability/rules
router.get(
  "/creator/availability/rules",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const rules = await db
      .select()
      .from(availabilityRulesTable)
      .where(eq(availabilityRulesTable.creatorId, cp.id))
      .orderBy(availabilityRulesTable.dayOfWeek);

    res.json({ data: rules });
  }
);

// POST /api/v1/creator/availability/rules
router.post(
  "/creator/availability/rules",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTimeUtc: z.string().regex(/^\d{2}:\d{2}$/),
      endTimeUtc: z.string().regex(/^\d{2}:\d{2}$/),
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

    const [rule] = await db
      .insert(availabilityRulesTable)
      .values({ creatorId: cp.id, ...parsed.data })
      .returning();

    res.status(201).json({ data: rule });
  }
);

// DELETE /api/v1/creator/availability/rules/:id
router.delete(
  "/creator/availability/rules/:id",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    await db
      .delete(availabilityRulesTable)
      .where(
        and(
          eq(availabilityRulesTable.id, id),
          eq(availabilityRulesTable.creatorId, cp.id)
        )
      );

    res.json({ data: { success: true } });
  }
);

// GET /api/v1/creator/availability/exceptions
router.get(
  "/creator/availability/exceptions",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    const exceptions = await db
      .select()
      .from(availabilityExceptionsTable)
      .where(eq(availabilityExceptionsTable.creatorId, cp.id))
      .orderBy(availabilityExceptionsTable.exceptionDate);

    res.json({ data: exceptions });
  }
);

// POST /api/v1/creator/availability/exceptions
router.post(
  "/creator/availability/exceptions",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isBlocked: z.boolean().default(true),
      reason: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request" });
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

    const [exception] = await db
      .insert(availabilityExceptionsTable)
      .values({ creatorId: cp.id, ...parsed.data })
      .returning();

    res.status(201).json({ data: exception });
  }
);

// DELETE /api/v1/creator/availability/exceptions/:id
router.delete(
  "/creator/availability/exceptions/:id",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [cp] = await db
      .select()
      .from(creatorProfilesTable)
      .where(eq(creatorProfilesTable.userId, req.session.userId!))
      .limit(1);

    if (!cp) {
      res.status(404).json({ error: "Creator profile not found" });
      return;
    }

    await db
      .delete(availabilityExceptionsTable)
      .where(
        and(
          eq(availabilityExceptionsTable.id, id),
          eq(availabilityExceptionsTable.creatorId, cp.id)
        )
      );

    res.json({ data: { success: true } });
  }
);

export default router;
