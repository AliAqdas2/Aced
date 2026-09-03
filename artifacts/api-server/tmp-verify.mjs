// tmp-verify-serveweb.mts
import express2 from "express";

// artifacts/api-server/src/lib/serveWeb.ts
import path2 from "path";
import { existsSync as existsSync2 } from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import express from "express";

// artifacts/api-server/src/lib/localFs.ts
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream, existsSync } from "fs";
function findRepoRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (; ; ) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
function getRepoRoot() {
  return findRepoRoot();
}
var STORAGE_ROOT = path.join(findRepoRoot(), "storage");

// artifacts/api-server/src/lib/logger.ts
import pino from "pino";
var isProduction = process.env.NODE_ENV === "production";
var logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']"
  ],
  ...isProduction ? {} : {
    transport: {
      target: "pino-pretty",
      options: { colorize: true }
    }
  }
});

// artifacts/api-server/src/lib/serveWeb.ts
var NEVER_CACHED_FILES = /* @__PURE__ */ new Set([
  "index.html",
  "sw.js",
  "manifest.webmanifest"
]);
function resolveWebDist() {
  const indexRel = path2.join("artifacts", "aced-web", "dist", "public");
  const candidates = [
    path2.join(getRepoRoot(), indexRel),
    path2.join(process.cwd(), indexRel),
    // Bundled runtime: artifacts/api-server/dist/index.mjs → ../../aced-web/dist/public
    path2.resolve(
      path2.dirname(fileURLToPath2(import.meta.url)),
      "..",
      "..",
      "aced-web",
      "dist",
      "public"
    )
  ];
  for (const dir of candidates) {
    if (existsSync2(path2.join(dir, "index.html"))) {
      return dir;
    }
  }
  logger.warn(
    { candidates },
    "SPA dist (index.html) not found \u2014 not mounting web UI"
  );
  return null;
}
function mountProductionWeb(app2) {
  const webDist = resolveWebDist();
  if (!webDist) {
    return;
  }
  const basePath = process.env.BASE_PATH ?? "/";
  const normalizedBase = basePath === "/" ? "/" : basePath.replace(/\/$/, "");
  logger.info({ webDist, basePath: normalizedBase }, "Mounting production web UI");
  app2.use(
    normalizedBase,
    express.static(webDist, {
      index: false,
      setHeaders(res, filePath) {
        const relative = path2.relative(webDist, filePath).split(path2.sep);
        if (relative[0] === "assets") {
          res.setHeader(
            "Cache-Control",
            "public, max-age=31536000, immutable"
          );
          return;
        }
        if (NEVER_CACHED_FILES.has(relative[relative.length - 1] ?? "")) {
          res.setHeader("Cache-Control", "no-store");
        }
      }
    })
  );
  app2.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    if (path2.extname(req.path) !== "") {
      res.status(404);
      res.setHeader("Cache-Control", "no-store");
      res.type("text/plain").send("Not found");
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path2.join(webDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

// artifacts/api-server/src/middlewares/errorHandler.ts
function notFound(req, res) {
  res.status(404).json({
    error: "Not found",
    code: "NOT_FOUND",
    path: req.path
  });
}
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode ?? 500;
  const traceId = req.id;
  const log = req.log ?? logger;
  if (statusCode >= 500) {
    log.error({ err, traceId }, "Unhandled server error");
  } else {
    log.warn({ err, traceId }, "Request error");
  }
  res.status(statusCode).json({
    error: err.message ?? "Internal server error",
    code: err.code ?? "INTERNAL_ERROR",
    traceId
  });
}

// tmp-verify-serveweb.mts
var app = express2();
app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true });
});
mountProductionWeb(app);
app.use(notFound);
app.use(errorHandler);
var server = app.listen(0);
await new Promise((r) => server.once("listening", r));
var addr = server.address();
var port = typeof addr === "object" && addr ? addr.port : 0;
var base = `http://127.0.0.1:${port}`;
var paths = [
  "/",
  "/browse",
  "/sw.js",
  "/assets/index-Dz60luZ3.css",
  "/assets/index-CJFO1a_a.js",
  "/assets/does-not-exist.css",
  "/assets/index-Dz60luZ3.css.map",
  "/favicon.svg",
  "/robots.txt",
  "/api/healthz",
  "/api/v1/nope"
];
for (const p of paths) {
  const res = await fetch(base + p);
  console.log(
    [
      p.padEnd(34),
      String(res.status).padEnd(4),
      (res.headers.get("content-type") ?? "-").padEnd(32),
      res.headers.get("cache-control") ?? "-"
    ].join(" ")
  );
}
var head = await fetch(base + "/assets/does-not-exist.css", { method: "HEAD" });
console.log("HEAD missing asset:", head.status, head.headers.get("content-type"));
var post = await fetch(base + "/some-page", { method: "POST" });
console.log("POST /some-page:", post.status, post.headers.get("content-type"));
server.close();
