import { chromium } from './node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs';

const BASE = 'http://127.0.0.1:24285';

const universities = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'University of Manchester', slug: 'manchester' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'University of Warwick', slug: 'warwick' },
];

const browser = await chromium.launch({
  executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.route('**/api/v1/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  if (path.endsWith('/auth/me')) return json({ data: { id: 'u1', role: 'learner', email: 'a@b.c' } });
  if (path.endsWith('/taxonomy/universities')) return json({ data: universities });
  return json({ data: [] });
});

await page.goto(`${BASE}/become-a-tutor`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
const trigger = page.locator('button[role="combobox"]').first();
await trigger.click();
await page.waitForTimeout(400);

const triggerBox = await trigger.boundingBox();
const content = page.locator('[data-radix-popper-content-wrapper] > *').first();
const contentBox = await content.boundingBox();
const info = await content.evaluate((el) => ({
  className: el.className,
  width: getComputedStyle(el).width,
  varOnWrapper: getComputedStyle(el.parentElement).getPropertyValue('--radix-popper-anchor-width'),
  varOnEl: getComputedStyle(el).getPropertyValue('--radix-popover-trigger-width'),
}));

console.log('trigger width:', triggerBox?.width);
console.log('content width:', contentBox?.width);
console.log(info);

await browser.close();
