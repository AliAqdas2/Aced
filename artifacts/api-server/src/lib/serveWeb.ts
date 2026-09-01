import path from "path";
import { existsSync } from "fs";
import express, { type Express } from "express";
import { getRepoRoot } from "./localFs";

/**
 * In production, serve the Vite-built SPA from the API process (single container).
 */
export function mountProductionWeb(app: Express): void {
  const webDist = path.join(
    getRepoRoot(),
    "artifacts",
    "aced-web",
    "dist",
    "public",
  );

  if (!existsSync(webDist)) {
    return;
  }

  const basePath = process.env.BASE_PATH ?? "/";
  const normalizedBase =
    basePath === "/" ? "/" : basePath.replace(/\/$/, "");

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
