import express from "express";
import { mountProductionWeb } from "./artifacts/api-server/src/lib/serveWeb";
import { notFound, errorHandler } from "./artifacts/api-server/src/middlewares/errorHandler";

const app = express();
app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true });
});
mountProductionWeb(app);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(0);
await new Promise((r) => server.once("listening", r));
const addr = server.address();
const port = typeof addr === "object" && addr ? addr.port : 0;
const base = `http://127.0.0.1:${port}`;

const paths = [
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
  "/api/v1/nope",
];

for (const p of paths) {
  const res = await fetch(base + p);
  console.log(
    [
      p.padEnd(34),
      String(res.status).padEnd(4),
      (res.headers.get("content-type") ?? "-").padEnd(32),
      res.headers.get("cache-control") ?? "-",
    ].join(" "),
  );
}

const head = await fetch(base + "/assets/does-not-exist.css", { method: "HEAD" });
console.log("HEAD missing asset:", head.status, head.headers.get("content-type"));

const post = await fetch(base + "/some-page", { method: "POST" });
console.log("POST /some-page:", post.status, post.headers.get("content-type"));

server.close();
