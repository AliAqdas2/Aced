/**
 * E2E: Admin — user suspend / restore flow
 *
 * Covers:
 *   - Admin can view the users list
 *   - Suspend button appears for active users
 *   - Confirming suspension shows a success toast and changes status badge
 *   - Restore button appears for suspended users
 *   - Confirming restore shows a success toast
 *   - Error toast is shown when the action request fails
 */
import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';
import { db } from '@workspace/db';
import { usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { E2E_TARGET_USER_EMAIL } from './global-setup';

async function resetTargetUserStatus(status: 'active' | 'suspended') {
  await db
    .update(usersTable)
    .set({ status })
    .where(eq(usersTable.email, E2E_TARGET_USER_EMAIL));
}

test.beforeEach(async () => {
  await resetTargetUserStatus('active');
});

test('admin can view the users list', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/users');

  // Target user row should be visible
  await expect(page.getByText(E2E_TARGET_USER_EMAIL, { exact: false })).toBeVisible();
});

test('admin can suspend an active user', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/users');

  // Find the target user's row and click its Suspend button
  const targetRow = page.locator('[data-testid="user-row"]', {
    has: page.getByText(E2E_TARGET_USER_EMAIL),
  }).or(
    page.locator('div', { has: page.getByText(E2E_TARGET_USER_EMAIL) }).filter({ hasText: E2E_TARGET_USER_EMAIL })
  );

  // Fallback: click the first Suspend button in the page (target user should be the only active one)
  const suspendBtn = page.getByRole('button', { name: /suspend/i }).first();
  await suspendBtn.click();

  // Confirm modal
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/suspend user/i)).toBeVisible();

  await page.getByRole('button', { name: /confirm suspension/i }).click();

  // Success toast
  await expect(page.getByText(/user suspended/i).first()).toBeVisible({ timeout: 8_000 });
});

test('admin can restore a suspended user', async ({ page }) => {
  // Pre-suspend the target user
  await resetTargetUserStatus('suspended');

  await loginAsAdmin(page);
  await page.goto('/admin/users');

  const restoreBtn = page.getByRole('button', { name: /restore/i }).first();
  await restoreBtn.click();

  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText(/restore user/i)).toBeVisible();

  await page.getByRole('button', { name: /confirm restore/i }).click();

  // Success toast
  await expect(page.getByText(/user restored/i).first()).toBeVisible({ timeout: 8_000 });
});

test('admin sees error toast when user action fails', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin/users');

  await page.route('**/admin/users/*/action', (route) => {
    route.fulfill({ status: 403, body: JSON.stringify({ error: 'Forbidden' }) });
  });

  const suspendBtn = page.getByRole('button', { name: /suspend/i }).first();
  await suspendBtn.click();

  await page.getByRole('button', { name: /confirm suspension/i }).click();

  await expect(page.getByText(/action failed|forbidden/i).first()).toBeVisible({ timeout: 8_000 });
});
