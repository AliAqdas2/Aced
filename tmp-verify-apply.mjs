import { chromium } from './node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';
import { randomUUID } from 'node:crypto';
import { UK_UNIVERSITIES } from './scripts/src/data/uk-universities.ts';
import { UK_DEGREE_SUBJECTS } from './scripts/src/data/uk-degree-subjects.ts';

const BASE = 'http://127.0.0.1:24285';

const universities = UK_UNIVERSITIES.map((u) => ({
  id: randomUUID(),
  name: u.name,
  slug: u.slug,
  status: 'active',
}));

const coursesByUniversity = new Map(
  universities.map((u) => [
    u.id,
    UK_DEGREE_SUBJECTS.map((s) => ({ id: randomUUID(), universityId: u.id, name: s.name, slug: s.slug })),
  ]),
);

const submissions = [];

async function main() {
  const browser = await chromium.launch({
    executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (path.endsWith('/auth/me')) {
      return json({ data: { id: 'user-1', email: 'grad@example.com', role: 'learner', displayName: 'Grad User' } });
    }
    if (path.endsWith('/taxonomy/universities')) {
      const search = url.searchParams.get('search');
      const list = search
        ? universities.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()))
        : universities;
      return json({ data: list });
    }
    if (path.endsWith('/taxonomy/courses')) {
      const uniId = url.searchParams.get('universityId');
      return json({ data: coursesByUniversity.get(uniId) ?? [] });
    }
    if (path.endsWith('/creator/applications/config')) {
      return json({ data: { dbsRequired: false } });
    }
    if (path.endsWith('/creator/applications')) {
      submissions.push(route.request().postDataJSON());
      return json({ data: { id: 'app-1', status: 'submitted' } }, 201);
    }
    if (path.endsWith('/creator/verifications') || path.includes('verification')) {
      if (route.request().method() === 'POST' && path.endsWith('/creator/verifications')) {
        return json({ data: { id: 'ver-1' } }, 201);
      }
      return json({ data: { uploadUrl: `${BASE}/mock-upload?mock=1`, storageKey: 'key-1' } });
    }
    return json({ data: [] });
  });

  await page.route('**/mock-upload*', (route) => route.fulfill({ status: 200, body: 'ok' }));

  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  // ── Become a Tutor ─────────────────────────────────────────────────────────
  await page.goto(`${BASE}/become-a-tutor`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tmp-shot-apply-initial.png', fullPage: true });
  console.log('page text head:', (await page.locator('body').innerText()).slice(0, 400).replace(/\n+/g, ' | '));
  console.log('comboboxes found:', await page.locator('button[role="combobox"]').count());

  const courseTrigger = page.locator('button:has-text("Select a university first")');
  console.log('course disabled before uni selected:', await courseTrigger.isDisabled());

  const uniTrigger = page.locator('button[role="combobox"]').first();
  console.log('university trigger text:', (await uniTrigger.textContent())?.trim());
  await uniTrigger.click();
  await page.getByPlaceholder('Search universities…').fill('manchester');
  await page.waitForTimeout(300);
  const options = await page.locator('[cmdk-item]').allTextContents();
  console.log('filtered options:', options);
  await page.screenshot({ path: 'tmp-shot-uni-search.png' });
  await page.locator('[cmdk-item]', { hasText: 'University of Manchester' }).first().click();
  await page.waitForTimeout(300);
  console.log('university selected:', (await uniTrigger.textContent())?.trim());

  const courseSelect = page.locator('button[role="combobox"]').nth(1);
  console.log('course enabled after uni:', await courseSelect.isEnabled());
  await courseSelect.click();
  await page.waitForTimeout(300);
  const courseOptions = await page.locator('[role="option"]').allTextContents();
  console.log('course option count:', courseOptions.length, 'sample:', courseOptions.slice(0, 6));
  await page.screenshot({ path: 'tmp-shot-courses.png' });
  await page.keyboard.type('Computer Science');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  console.log('course selected:', (await courseSelect.textContent())?.trim());

  // Change the university and confirm the course resets
  await uniTrigger.click();
  await page.getByPlaceholder('Search universities…').fill('warwick');
  await page.waitForTimeout(200);
  await page.locator('[cmdk-item]', { hasText: 'University of Warwick' }).first().click();
  await page.waitForTimeout(300);
  console.log('after uni change — uni:', (await uniTrigger.textContent())?.trim(), '| course:', (await courseSelect.textContent())?.trim());
  await page.screenshot({ path: 'tmp-shot-after-uni-change.png' });

  // Fill and submit the rest of the form
  await courseSelect.click();
  await page.waitForTimeout(200);
  await page.keyboard.type('Law');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  console.log('course after reselect:', (await courseSelect.textContent())?.trim());
  await page.locator('button[role="combobox"]').nth(2).click();
  await page.waitForTimeout(200);
  await page.locator('[role="option"]', { hasText: 'First Class (1st)' }).click();
  await page.locator('input[type="number"]').fill('2022');
  await page.getByPlaceholder(/Final year Law student/).fill('Warwick Law graduate — contract law specialist');
  await page.setInputFiles('input[type="file"]', {
    name: 'degree.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 test'),
  });
  await page.locator('input[type="checkbox"]').check();
  await page.screenshot({ path: 'tmp-shot-filled.png', fullPage: true });
  await page.getByRole('button', { name: /Submit Application/i }).click();
  await page.waitForTimeout(1500);
  const payload = submissions[0];
  const warwick = universities.find((u) => u.slug === 'warwick');
  console.log('submitted payload:', JSON.stringify(payload));
  console.log('universityId is Warwick:', payload?.universityId === warwick.id);
  console.log(
    'courseId belongs to Warwick:',
    (coursesByUniversity.get(warwick.id) ?? []).some((c) => c.id === payload?.courseId),
  );
  console.log('url after submit:', page.url());
  await page.screenshot({ path: 'tmp-shot-after-submit.png', fullPage: true });

  // ── Register page copy ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/auth/register`, { waitUntil: 'networkidle' });
  const body = await page.locator('body').innerText();
  console.log('register mentions university email:', /university email/i.test(body));
  console.log('register email placeholder:', await page.locator('input[type="email"]').getAttribute('placeholder'));
  await page.screenshot({ path: 'tmp-shot-register.png', fullPage: true });

  // ── Regression: other surfaces using the same university list ─────────────
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'tmp-shot-search.png' });
  await page.goto(`${BASE}/apply`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'tmp-shot-apply-page.png' });

  // Mobile viewport for the apply form
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/become-a-tutor`, { waitUntil: 'networkidle' });
  await page.locator('button[role="combobox"]').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'tmp-shot-mobile-combobox.png' });

  console.log('console errors:', consoleErrors.filter((e) => !e.includes('favicon')).slice(0, 5));
  await browser.close();
}

main().catch((err) => {
  console.error('verify failed:', err);
  process.exit(1);
});
