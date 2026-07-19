/**
 * E2E: Admin — creator application approval flow
 *
 * Covers:
 *   - Admin can log in and reach /admin/applications
 *   - Pending applications appear in the list
 *   - Clicking Approve opens the confirm modal
 *   - Confirming sends the decision and shows a success toast
 *   - The approved application disappears from the pending list
 *
 *   - Clicking Reject opens the modal, reviewer note is optional
 *   - Confirming rejection shows a success toast
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { db } from '@workspace/db';
import { creatorProfilesTable, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { E2E_APPLICANT_EMAIL } from './global-setup';

async function resetApplicationStatus(status: 'submitted' | 'approved' | 'closed') {
  const [applicant] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, E2E_APPLICANT_EMAIL))
    .limit(1);
  if (!applicant) return;
  await db
    .update(creatorProfilesTable)
    .set({ status })
    .where(eq(creatorProfilesTable.userId, applicant.id));
}

test.beforeEach(async () => {
  // Reset to "submitted" so every test starts fresh
  await resetApplicationStatus('submitted');
});

test('admin can view pending creator applications', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/applications');

  // The applicant row should be visible
  await expect(page.getByText('E2E Applicant', { exact: false })).toBeVisible();
});

test('admin can approve a creator application', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/applications');

  // Click Approve on the e2e applicant row
  const approveBtn = page.getByRole('button', { name: /approve/i }).first();
  await approveBtn.click();

  // Confirm modal should appear
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/approve application/i)).toBeVisible();

  // Submit the decision
  await page.getByRole('button', { name: /send & approve/i }).click();

  // Success toast
  await expect(page.getByText(/application approved/i).first()).toBeVisible({ timeout: 8_000 });

  // The application should no longer appear in the pending list
  await page.waitForTimeout(500); // let the list re-fetch
  const rows = page.getByText('E2E Applicant', { exact: false });
  await expect(rows).toHaveCount(0, { timeout: 8_000 });
});

test('admin can reject a creator application with a note', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/applications');

  const rejectBtn = page.getByRole('button', { name: /reject/i }).first();
  await rejectBtn.click();

  await expect(page.getByRole('dialog')).toBeVisible();

  // Fill in a reviewer note
  await page.getByPlaceholder(/reason for rejection/i).fill('E2E rejection note — missing DBS evidence');

  await page.getByRole('button', { name: /send & reject/i }).click();

  // Success toast
  await expect(page.getByText(/application rejected/i).first()).toBeVisible({ timeout: 8_000 });

  // Reset back to submitted so other tests are not affected
  await resetApplicationStatus('submitted');
});

test('admin sees error toast when decision request fails', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/applications');

  // Intercept the decision endpoint and force a failure
  await page.route('**/admin/applications/*/decision', (route) => {
    route.fulfill({ status: 500, body: JSON.stringify({ error: 'Simulated server error' }) });
  });

  const approveBtn = page.getByRole('button', { name: /approve/i }).first();
  await approveBtn.click();

  await page.getByRole('button', { name: /send & approve/i }).click();

  // Error should surface — either as toast or inline
  await expect(page.getByText(/simulated server error|action failed/i).first()).toBeVisible({ timeout: 8_000 });
});
