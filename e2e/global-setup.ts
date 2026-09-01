/**
 * Playwright global setup — seeds a minimal set of test fixtures into the DB.
 *
 * Creates:
 *   - E2E admin user   (admin@aced-e2e.test / E2eTestPass123!)
 *   - E2E applicant    (applicant@aced-e2e.test) with a "submitted" creator profile
 *   - E2E listing      in "submitted" status owned by the applicant
 *   - E2E target user  (target@aced-e2e.test) to test suspend/restore flows
 *
 * All fixture records share a UUID namespace so teardown can wipe them reliably.
 */

import '@workspace/db/load-env';
import { db } from '@workspace/db';
import {
  usersTable,
  profilesTable,
  creatorProfilesTable,
  creatorExpertiseTable,
  storefrontsTable,
  listingsTable,
  universitiesTable,
  coursesTable,
} from '@workspace/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const E2E_ADMIN_EMAIL = 'admin@aced-e2e.test';
export const E2E_APPLICANT_EMAIL = 'applicant@aced-e2e.test';
export const E2E_TARGET_USER_EMAIL = 'target@aced-e2e.test';
export const E2E_PASSWORD = 'E2eTestPass123!';

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function upsertUser(opts: {
  email: string;
  displayName: string;
  role: string;
  status?: string;
}) {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, opts.email))
    .limit(1);

  if (existing) {
    // Reset status and ensure email is verified in case a prior test mutated state
    const [updated] = await db
      .update(usersTable)
      .set({ role: opts.role as any, status: (opts.status ?? 'active') as any, emailVerified: true })
      .where(eq(usersTable.id, existing.id))
      .returning();
    return updated;
  }

  const passwordHash = await hashPassword(E2E_PASSWORD);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: opts.email,
      passwordHash,
      role: opts.role as any,
      status: (opts.status ?? 'active') as any,
      emailVerified: true, // skip email verification gate
    })
    .returning();

  await db.insert(profilesTable).values({
    userId: user.id,
    displayName: opts.displayName,
  });

  return user;
}

export default async function globalSetup() {
  console.log('\n[e2e] Seeding test fixtures…');

  // ── Admin user ──────────────────────────────────────────────────────────────
  await upsertUser({
    email: E2E_ADMIN_EMAIL,
    displayName: 'E2E Admin',
    role: 'admin',
  });

  // ── Target user (to be suspended) ───────────────────────────────────────────
  await upsertUser({
    email: E2E_TARGET_USER_EMAIL,
    displayName: 'E2E Target User',
    role: 'learner',
    status: 'active', // reset each run
  });

  // ── Applicant with a pending creator application ─────────────────────────────
  const applicant = await upsertUser({
    email: E2E_APPLICANT_EMAIL,
    displayName: 'E2E Applicant',
    role: 'creator_applicant',
  });

  // Ensure a university and course exist for the expertise row
  let [uni] = await db
    .select()
    .from(universitiesTable)
    .limit(1);

  if (!uni) {
    [uni] = await db
      .insert(universitiesTable)
      .values({ name: 'E2E University', slug: 'e2e-university', status: 'active' })
      .returning();
  }

  let [course] = await db
    .select()
    .from(coursesTable)
    .where(eq(coursesTable.universityId, uni.id))
    .limit(1);

  if (!course) {
    [course] = await db
      .insert(coursesTable)
      .values({ universityId: uni.id, name: 'E2E Course', code: 'E2E101' })
      .returning();
  }

  // Creator profile — upsert so re-runs work
  let [cp] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.userId, applicant.id))
    .limit(1);

  if (!cp) {
    [cp] = await db
      .insert(creatorProfilesTable)
      .values({
        userId: applicant.id,
        headline: 'E2E test applicant — please approve',
        status: 'submitted',
      })
      .returning();
  } else {
    [cp] = await db
      .update(creatorProfilesTable)
      .set({ status: 'submitted', headline: 'E2E test applicant — please approve' })
      .where(eq(creatorProfilesTable.id, cp.id))
      .returning();
  }

  // Expertise row
  await db
    .insert(creatorExpertiseTable)
    .values({
      creatorId: cp.id,
      universityId: uni.id,
      courseId: course.id,
      graduationYear: 2023,
      academicResult: '2:1',
      isPrimary: true,
    })
    .onConflictDoUpdate({
      target: creatorExpertiseTable.creatorId,
      set: {
        universityId: uni.id,
        courseId: course.id,
        graduationYear: 2023,
        academicResult: '2:1',
        isPrimary: true,
      },
    });

  // Storefront required to have a submitted listing
  let [storefront] = await db
    .select()
    .from(storefrontsTable)
    .where(eq(storefrontsTable.creatorId, cp.id))
    .limit(1);

  if (!storefront) {
    [storefront] = await db
      .insert(storefrontsTable)
      .values({ creatorId: cp.id, slug: `e2e-creator-${cp.id.slice(0, 8)}`, displayName: 'E2E Creator' })
      .returning();
  }

  // ── Submitted listing for moderation ─────────────────────────────────────────
  const [existingListing] = await db
    .select()
    .from(listingsTable)
    .where(eq(listingsTable.creatorId, cp.id))
    .limit(1);

  if (!existingListing) {
    await db.insert(listingsTable).values({
      creatorId: cp.id,
      storefrontId: storefront.id,
      title: 'E2E Test Listing — pending moderation',
      description: 'Created by the e2e global setup for listing moderation tests.',
      type: 'service_offer',
      status: 'submitted',
      currency: 'gbp',
    });
  } else {
    await db
      .update(listingsTable)
      .set({ status: 'submitted', title: 'E2E Test Listing — pending moderation' })
      .where(eq(listingsTable.id, existingListing.id));
  }

  console.log('[e2e] Fixtures ready.');

  // ── Pre-obtain session cookie ─────────────────────────────────────────────────
  // Log in once here so all tests can reuse the same session (avoids hitting the
  // auth rate limiter and speeds up each test).
  const apiBase = `http://localhost:${process.env.API_PORT ?? '8080'}`;
  const loginRes = await fetch(`${apiBase}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: E2E_ADMIN_EMAIL, password: E2E_PASSWORD }),
  });

  if (!loginRes.ok) {
    throw new Error(`[e2e] Admin login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  const cookieMatch = setCookie.match(/^([^=]+)=([^;]+)/);
  if (!cookieMatch) {
    throw new Error(`[e2e] No session cookie in login response: ${setCookie}`);
  }

  const { writeFileSync } = await import('fs');
  writeFileSync(
    '.tmp-e2e-session.json',
    JSON.stringify({ name: cookieMatch[1], value: cookieMatch[2] }),
  );

  console.log('[e2e] Session cookie cached.\n');
}
