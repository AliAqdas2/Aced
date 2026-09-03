import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import express, { type Express } from "express";
import { getRepoRoot } from "./localFs";
import { logger } from "./logger";

function resolveWebDist(): string | null {
  const indexRel = path.join("artifacts", "aced-web", "dist", "public");
  const candidates = [
    path.join(getRepoRoot(), indexRel),
    path.join(process.cwd(), indexRel),
    // Bundled runtime: artifacts/api-server/dist/index.mjs → ../../aced-web/dist/public
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "aced-web",
      "dist",
      "public",
    ),
  ];

  for (const dir of candidates) {
    if (existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }

  logger.warn(
    { candidates },
    "SPA dist (index.html) not found — not mounting web UI",
  );
  return null;
}

/**
 * Serve the Vite-built SPA from the API process (single container).
 * Mounts whenever the build output exists — not gated solely on NODE_ENV,
 * because production .env files often leave NODE_ENV=development.
 */
export function mountProductionWeb(app: Express): void {
  const webDist = resolveWebDist();
  if (!webDist) {
    return;
  }

  const basePath = process.env.BASE_PATH ?? "/";
  const normalizedBase =
    basePath === "/" ? "/" : basePath.replace(/\/$/, "");

  logger.info({ webDist, basePath: normalizedBase }, "Mounting production web UI");

  app.use(normalizedBase, express.static(webDist, { index: false }));

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(path.join(webDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}
