import { chromium } from './node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:24285';
const EXE = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

async function run(label, { universitiesStatus = 200, delayMs = 0, universities = [], courses = [] }) {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const json = (data, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (path.endsWith('/auth/me')) return json({ data: { id: 'u1', role: 'learner', email: 'a@b.c' } });
    if (path.endsWith('/taxonomy/universities')) {
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      if (universitiesStatus !== 200) return json({ error: 'boom' }, universitiesStatus);
      return json({ data: universities });
    }
    if (path.endsWith('/taxonomy/courses')) return json({ data: courses });
    if (path.endsWith('/creator/applications/config')) return json({ data: { dbsRequired: false } });
    return json({ data: [] });
  });

  await page.goto(`${BASE}/become-a-tutor`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(delayMs ? 800 : universitiesStatus !== 200 ? 12000 : 2500);

  const trigger = page.locator('button[role="combobox"]').first();
  console.log(`[${label}] trigger text:`, (await trigger.textContent())?.trim());
  console.log(`[${label}] trigger disabled:`, await trigger.isDisabled());
  const bodyText = await page.locator('body').innerText();
  console.log(`[${label}] shows load error:`, /couldn't load the university list/i.test(bodyText));
  await page.screenshot({ path: `tmp-shot-state-${label}.png` });

  if (universitiesStatus === 200 && !delayMs && universities.length === 0) {
    await trigger.click();
    await page.waitForTimeout(300);
    console.log(`[${label}] empty popover text:`, (await page.locator('[cmdk-list]').innerText()).trim());
    await page.screenshot({ path: `tmp-shot-state-${label}-open.png` });
  }

  await browser.close();
}

await run('loading', { delayMs: 4000 });
await run('error', { universitiesStatus: 500 });
await run('empty', { universities: [] });
