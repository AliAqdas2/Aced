/**
 * Public site URL used for Stripe return/success/cancel links.
 * Live Stripe keys and production require https:// and reject localhost.
 */

export class AppUrlError extends Error {
  readonly code = "APP_URL_INVALID" as const;

  constructor(message: string) {
    super(message);
    this.name = "AppUrlError";
  }
}

function requiresStrictPublicUrl(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
  return stripeKey.startsWith("sk_live_");
}

/**
 * Returns APP_URL with no trailing slash.
 * Throws AppUrlError when missing/malformed, or when live/production forbids http/localhost.
 */
export function getPublicAppUrl(): string {
  const raw = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new AppUrlError(
      "APP_URL is not set. Set APP_URL=https://acedtutoring.co.uk (no trailing slash).",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppUrlError(
      `APP_URL is not a valid URL: "${raw}". Example: https://acedtutoring.co.uk`,
    );
  }

  if (requiresStrictPublicUrl()) {
    if (parsed.protocol !== "https:") {
      throw new AppUrlError(
        `APP_URL must use https:// when NODE_ENV=production or STRIPE_SECRET_KEY is live. Got: ${raw}`,
      );
    }
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") {
      throw new AppUrlError(
        "APP_URL cannot be localhost when using live Stripe keys or production. Set APP_URL=https://acedtutoring.co.uk",
      );
    }
  }

  return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
}

/** Join a path onto the public app URL (path should start with /). */
export function publicPath(path: string): string {
  const base = getPublicAppUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
