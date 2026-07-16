import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  countriesTable,
  universitiesTable,
  universityAliasesTable,
  coursesTable,
  modulesTable,
  moduleProposalsTable,
} from "@workspace/db";
import { eq, like, and, ilike } from "drizzle-orm";
import { requireRole } from "../../middlewares/auth";

const router: IRouter = Router();

// GET /api/v1/taxonomy/countries
router.get("/taxonomy/countries", async (_req, res): Promise<void> => {
  const countries = await db.select().from(countriesTable).orderBy(countriesTable.name);
  res.json({ data: countries });
});

// GET /api/v1/taxonomy/universities
router.get("/taxonomy/universities", async (req, res): Promise<void> => {
  const search = req.query["search"] as string | undefined;
  const countryId = req.query["countryId"] as string | undefined;

  let query = db
    .select()
    .from(universitiesTable)
    .where(eq(universitiesTable.status, "active"))
    .$dynamic();

  if (search) {
    query = query.where(ilike(universitiesTable.name, `%${search}%`));
  }
  if (countryId) {
    query = query.where(eq(universitiesTable.countryId, countryId));
  }

  const universities = await query.orderBy(universitiesTable.name).limit(100);
  res.json({ data: universities });
});

// GET /api/v1/taxonomy/universities/:slug
router.get("/taxonomy/universities/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [university] = await db
    .select()
    .from(universitiesTable)
    .where(eq(universitiesTable.slug, slug))
    .limit(1);

  if (!university) {
    res.status(404).json({ error: "University not found" });
    return;
  }

  const courses = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.universityId, university.id))
    .orderBy(coursesTable.name);

  res.json({ data: { ...university, courses } });
});

// GET /api/v1/taxonomy/courses/:id/modules
router.get("/taxonomy/courses/:id/modules", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const modules = await db
    .select()
    .from(modulesTable)
    .where(eq(modulesTable.courseId, id))
    .orderBy(modulesTable.name);

  res.json({ data: modules });
});

// --- Admin-only taxonomy management ---

// POST /api/v1/admin/taxonomy/universities
router.post(
  "/admin/taxonomy/universities",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      countryId: z.string().uuid(),
      name: z.string().min(2),
      slug: z.string().min(2),
      website: z.string().url().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [university] = await db
      .insert(universitiesTable)
      .values(parsed.data)
      .returning();
    res.status(201).json({ data: university });
  }
);

// PATCH /api/v1/admin/taxonomy/universities/:id
router.patch(
  "/admin/taxonomy/universities/:id",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const Body = z.object({
      name: z.string().min(2).optional(),
      slug: z.string().min(2).optional(),
      website: z.string().url().optional(),
      status: z.enum(["active", "retired"]).optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [updated] = await db
      .update(universitiesTable)
      .set(parsed.data)
      .where(eq(universitiesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ data: updated });
  }
);

// POST /api/v1/admin/taxonomy/courses
router.post(
  "/admin/taxonomy/courses",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      universityId: z.string().uuid(),
      name: z.string().min(2),
      slug: z.string().min(2),
      faculty: z.string().optional(),
      level: z.string().optional(),
      durationYears: z.number().int().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [course] = await db.insert(coursesTable).values(parsed.data).returning();
    res.status(201).json({ data: course });
  }
);

// POST /api/v1/admin/taxonomy/modules
router.post(
  "/admin/taxonomy/modules",
  requireRole("admin"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      courseId: z.string().uuid(),
      name: z.string().min(2),
      slug: z.string().min(2),
      code: z.string().optional(),
      academicYear: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [module] = await db.insert(modulesTable).values(parsed.data).returning();
    res.status(201).json({ data: module });
  }
);

// POST /api/v1/creator/taxonomy/modules/propose
router.post(
  "/creator/taxonomy/modules/propose",
  requireRole("creator"),
  async (req, res): Promise<void> => {
    const Body = z.object({
      courseId: z.string().uuid(),
      proposedName: z.string().min(2),
      code: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
      return;
    }

    const [proposal] = await db
      .insert(moduleProposalsTable)
      .values({
        proposedByCreatorId: req.session.userId!,
        courseId: parsed.data.courseId,
        proposedName: parsed.data.proposedName,
        code: parsed.data.code,
      })
      .returning();

    res.status(201).json({ data: proposal });
  }
);

export default router;
