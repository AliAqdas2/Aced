import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { sessionMiddleware } from "./middlewares/session";
import { notFound, errorHandler } from "./middlewares/errorHandler";

const app: Express = express();

// Trust proxy (common behind reverse proxies / load balancers)
app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false, // Let the frontend handle CSP
  })
);

// CORS — build allowed origins from env vars
const allowedOrigins: Set<string> = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
]);

// Explicit overrides (comma-separated)
if (process.env.CORS_ORIGINS) {
  for (const o of process.env.CORS_ORIGINS.split(",")) {
    const trimmed = o.trim();
    if (trimmed) allowedOrigins.add(trimmed);
  }
}

// APP_URL (production canonical domain)
if (process.env.APP_URL) {
  try {
    allowedOrigins.add(new URL(process.env.APP_URL).origin);
  } catch { /* ignore malformed */ }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // No origin = same-origin or server-to-server: allow
      if (!origin) return callback(null, true);
      // Non-production: allow everything
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      // Production: check allowlist
      if (allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);

// Structured request logging
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts", code: "RATE_LIMITED" },
  // Skip rate limiting for local development / e2e tests running on localhost
  skip: (req) => process.env.NODE_ENV !== "production" && (req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1"),
});

app.use(globalLimiter);
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/auth/magic-link", authLimiter);
app.use("/api/v1/auth/password-reset", authLimiter);

// Body parsing — raw Buffer for Stripe webhook and local file uploads
// (must come before express.json), then JSON for all other routes.
app.use("/api/v1/webhooks/stripe", express.raw({ type: "*/*" }));
app.use(
  "/api/storage/uploads",
  (req, res, next) => {
    // Only apply raw body parsing to PUT uploads, not POST request-url
    if (req.method === "PUT") {
      return express.raw({ type: "*/*", limit: "50mb" })(req, res, next);
    }
    next();
  },
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(sessionMiddleware);

// Routes
app.use("/api", router);

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

export default app;
