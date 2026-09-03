import express from "express";
import { chromium } from "/Users/Ali/Downloads/Aced-Portal/node_modules/.pnpm/playwright@1.61.1/node_modules/playwright/index.mjs";
import { mountProductionWeb } from "./tmp-serveweb.mjs";

const app = express();
mountProductionWeb(app);
const server = app.listen(4599);
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:4599";

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
const failures = [];
page.on("console", (m) => {
  if (m.type() === "error") failures.push(`console: ${m.text()}`);
});
page.on("requestfailed", (r) => failures.push(`failed: ${r.url()}`));
page.on("response", (r) => {
  if (r.status() >= 400) failures.push(`http ${r.status()}: ${r.url()}`);
});

for (const route of ["/", "/browse", "/login"]) {
  failures.length = 0;
  await page.goto(base + route, { waitUntil: "networkidle" });
  const bodyLen = (await page.locator("body").innerText()).trim().length;
  const rootChildren = await page.evaluate(
    () => document.getElementById("root")?.children.length ?? -1,
  );
  const swCount = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return -1;
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.length;
  });
  const cacheCount = await page.evaluate(async () =>
    "caches" in window ? (await caches.keys()).length : -1,
  );
  console.log(
    `${route.padEnd(9)} rootChildren=${rootChildren} textLen=${bodyLen} sw=${swCount} caches=${cacheCount}`,
  );
  const relevant = failures.filter((f) => !f.includes("/api/") && !f.startsWith("console:"));
  console.log("  all:", failures.join(" | ") || "none");
  console.log(
    relevant.length ? `  non-api issues: ${relevant.join(" | ")}` : "  no non-api issues",
  );
}

await page.screenshot({ path: "/Users/Ali/Downloads/Aced-Portal/tmp-home.png", fullPage: false });
await page.goto(base + "/");
await page.screenshot({ path: "/Users/Ali/Downloads/Aced-Portal/tmp-home.png" });
await browser.close();
server.close();
