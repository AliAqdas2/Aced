/**
 * E2E: Admin — listing moderation (approve / reject)
 *
 * Covers:
 *   - Admin can view the listing moderation queue
 *   - Submitted listings appear in the queue
 *   - Clicking Approve opens the confirm modal
 *   - Confirming approval shows a success toast and removes the listing from queue
 *   - Clicking Reject opens the modal with an optional moderation note
 *   - Confirming rejection shows a success toast
 *   - Error toast is shown when the moderation request fails
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { db } from '@workspace/db';
import { listingsTable, creatorProfilesTable, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { E2E_APPLICANT_EMAIL } from './global-setup';

async function resetListingStatus(status: 'submitted' | 'approved' | 'rejected') {
  const [applicant] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, E2E_APPLICANT_EMAIL))
    .limit(1);
  if (!applicant) return;

  const [cp] = await db
    .select()
    .from(creatorProfilesTable)
    .where(eq(creatorProfilesTable.userId, applicant.id))
    .limit(1);
  if (!cp) return;

  await db
    .update(listingsTable)
    .set({ status })
    .where(eq(listingsTable.creatorId, cp.id));
}

test.beforeEach(async () => {
  await resetListingStatus('submitted');
});

test('admin can view submitted listings in the moderation queue', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/listings');

  await expect(page.getByText(/E2E Test Listing/i)).toBeVisible();
});

test('admin can approve a submitted listing', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/listings');

  const approveBtn = page.getByRole('button', { name: /approve/i }).first();
  await approveBtn.click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/approve listing/i)).toBeVisible();

  await page.getByRole('button', { name: /confirm approval/i }).click();

  // Success toast
  await expect(page.getByText(/listing approved/i).first()).toBeVisible({ timeout: 8_000 });

  // Listing should leave the pending queue
  await page.waitForTimeout(500);
  await expect(page.getByText(/E2E Test Listing/i)).toHaveCount(0, { timeout: 8_000 });
});

test('admin can reject a listing with a moderation note', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/listings');

  const rejectBtn = page.getByRole('button', { name: /reject/i }).first();
  await rejectBtn.click();

  await expect(page.getByRole('dialog')).toBeVisible();

  // Optionally fill in a moderation note
  const noteArea = page.getByPlaceholder(/reason for rejection/i);
  await noteArea.fill('E2E rejection: listing content does not meet guidelines.');

  await page.getByRole('button', { name: /confirm rejection/i }).click();

  await expect(page.getByText(/listing rejected/i).first()).toBeVisible({ timeout: 8_000 });
});

test('admin sees error toast when listing moderation fails', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/listings');

  await page.route('**/admin/listings/*/decision', (route) => {
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Internal error' }) });
  });

  const approveBtn = page.getByRole('button', { name: /approve/i }).first();
  await approveBtn.click();

  await page.getByRole('button', { name: /confirm approval/i }).click();

  await expect(page.getByText(/action failed|internal error/i).first()).toBeVisible({ timeout: 8_000 });
});
