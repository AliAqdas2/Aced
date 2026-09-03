import { chromium } from "/Users/Ali/Downloads/Aced-Portal/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs";

const base = "https://acedtutoring.co.uk";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const problems = [];
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text()}`);
});
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("/api/")) {
    problems.push(`http ${r.status()} ${r.url()}`);
  }
});

const state = async () =>
  page.evaluate(async () => ({
    sw: (await navigator.serviceWorker.getRegistrations()).length,
    caches: await caches.keys(),
    rootChildren: document.getElementById("root")?.children.length ?? -1,
    textLen: document.body.innerText.trim().length,
  }));

await page.goto(base + "/", { waitUntil: "networkidle" });
console.log("fresh load:      ", JSON.stringify(await state()));

// Reproduce a stale-PWA browser: register sw.js and seed a Workbox-like cache.
await page.evaluate(async () => {
  const cache = await caches.open("workbox-precache-v2-https://acedtutoring.co.uk/");
  await cache.put("/stale", new Response("stale"));
  await navigator.serviceWorker.register("/sw.js");
  await new Promise((r) => setTimeout(r, 1500));
});
console.log("after register:  ", JSON.stringify(await state()));

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
console.log("after 2 reloads: ", JSON.stringify(await state()));
console.log(
  problems.length ? "problems: " + problems.join(" | ") : "no non-api problems",
);

await page.screenshot({
  path: "/Users/Ali/Downloads/Aced-Portal/tmp-prod-home.png",
  fullPage: false,
});
await browser.close();
