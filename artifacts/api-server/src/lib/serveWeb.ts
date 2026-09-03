import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import express, { type Express } from "express";
import { getRepoRoot } from "./localFs";
import { logger } from "./logger";

const NEVER_CACHED_FILES = new Set([
  "index.html",
  "sw.js",
  "manifest.webmanifest",
]);

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

  app.use(
    normalizedBase,
    express.static(webDist, {
      index: false,
      setHeaders(res, filePath) {
        const relative = path.relative(webDist, filePath).split(path.sep);
        if (relative[0] === "assets") {
          // Vite emits content-hashed filenames under assets/.
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable",
          );
          return;
        }
        if (NEVER_CACHED_FILES.has(relative[relative.length - 1] ?? "")) {
          res.setHeader("Cache-Control", "no-store");
        }
      },
    }),
  );

  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    // A request with a file extension is an asset, not an SPA navigation.
    // Answering it with index.html (or the JSON error handler) breaks the page
    // with a MIME type mismatch, so fail it plainly instead.
    if (path.extname(req.path) !== "") {
      res.status(404);
      res.setHeader("Cache-Control", "no-store");
      res.type("text/plain").send("Not found");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(webDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}
