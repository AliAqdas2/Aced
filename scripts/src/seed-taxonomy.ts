/**
 * Taxonomy seed — every recognised UK university plus a shared set of common
 * degree subjects, so the creator application form always has options.
 *
 * Safe to re-run against a populated database: universities are matched on
 * their unique slug and courses on (universityId, slug).
 *
 * Run: pnpm --filter @workspace/scripts run seed:taxonomy
 */
import "@workspace/db/load-env";
import { db } from "@workspace/db";
import { countriesTable, universitiesTable, coursesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UK_UNIVERSITIES } from "./data/uk-universities";
import { UK_DEGREE_SUBJECTS } from "./data/uk-degree-subjects";

export interface TaxonomySeedResult {
  universitiesCreated: number;
  coursesCreated: number;
}

async function ensureUnitedKingdom(): Promise<string> {
  const [existing] = await db
    .select({ id: countriesTable.id })
    .from(countriesTable)
    .where(eq(countriesTable.code, "GB"))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(countriesTable)
    .values({ name: "United Kingdom", code: "GB" })
    .onConflictDoNothing()
    .returning({ id: countriesTable.id });
  if (created) return created.id;

  const [raced] = await db
    .select({ id: countriesTable.id })
    .from(countriesTable)
    .where(eq(countriesTable.code, "GB"))
    .limit(1);
  if (!raced) throw new Error("Could not create or find the United Kingdom country row");
  return raced.id;
}

export async function seedTaxonomy(): Promise<TaxonomySeedResult> {
  const countryId = await ensureUnitedKingdom();

  const existingUniversities = await db
    .select({ id: universitiesTable.id, slug: universitiesTable.slug })
    .from(universitiesTable);
  const universityIdBySlug = new Map(existingUniversities.map((u) => [u.slug, u.id]));

  const missingUniversities = UK_UNIVERSITIES.filter((u) => !universityIdBySlug.has(u.slug));
  if (missingUniversities.length > 0) {
    const inserted = await db
      .insert(universitiesTable)
      .values(
        missingUniversities.map((u) => ({
          countryId,
          name: u.name,
          slug: u.slug,
          status: "active" as const,
        }))
      )
      .onConflictDoNothing()
      .returning({ id: universitiesTable.id, slug: universitiesTable.slug });
    for (const row of inserted) universityIdBySlug.set(row.slug, row.id);
  }

  const existingCourses = await db
    .select({ universityId: coursesTable.universityId, slug: coursesTable.slug })
    .from(coursesTable);
  const existingCourseKeys = new Set(existingCourses.map((c) => `${c.universityId}:${c.slug}`));

  const courseRows = [];
  for (const uni of UK_UNIVERSITIES) {
    const universityId = universityIdBySlug.get(uni.slug);
    if (!universityId) continue;
    for (const subject of UK_DEGREE_SUBJECTS) {
      if (existingCourseKeys.has(`${universityId}:${subject.slug}`)) continue;
      courseRows.push({
        universityId,
        name: subject.name,
        slug: subject.slug,
        level: subject.level,
      });
    }
  }

  // Chunked so a full first run (thousands of rows) stays within parameter limits.
  const CHUNK_SIZE = 500;
  for (let i = 0; i < courseRows.length; i += CHUNK_SIZE) {
    await db.insert(coursesTable).values(courseRows.slice(i, i + CHUNK_SIZE));
  }

  return {
    universitiesCreated: missingUniversities.length,
    coursesCreated: courseRows.length,
  };
}

const isDirectRun = process.argv[1]?.includes("seed-taxonomy");

if (isDirectRun) {
  seedTaxonomy()
    .then((result) => {
      console.log(
        `Taxonomy seed complete — ${result.universitiesCreated} universities and ${result.coursesCreated} courses added.`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Taxonomy seed failed:", err);
      process.exit(1);
    });
}
