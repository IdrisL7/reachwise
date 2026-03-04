import { NextResponse } from "next/server";

/**
 * Simple in-memory sliding window rate limiter.
 * For production with multiple instances, swap for Redis-based.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Public endpoints (no auth required)
  "public:hooks": { limit: 10, windowSeconds: 60 },
  "public:hooks-batch": { limit: 3, windowSeconds: 60 },

  // Authenticated endpoints (per API key)
  "auth:hooks": { limit: 60, windowSeconds: 60 },
  "auth:hooks-batch": { limit: 20, windowSeconds: 60 },
  "auth:leads": { limit: 100, windowSeconds: 60 },
  "auth:followups": { limit: 30, windowSeconds: 60 },

  // Auth attempts
  "auth:login": { limit: 5, windowSeconds: 300 },
  "auth:register": { limit: 3, windowSeconds: 600 },
};

/**
 * Check rate limit. Returns null if OK, or 429 response if exceeded.
 * @param identifier - IP address, API key prefix, or user ID
 * @param endpoint - Key from RATE_LIMITS
 */
export function checkRateLimit(
  identifier: string,
  endpoint: string,
): NextResponse | null {
  const config = RATE_LIMITS[endpoint];
  if (!config) return null; // No limit configured

  const key = `${endpoint}:${identifier}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return null;
  }

  if (entry.count >= config.limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      {
        status: "error",
        code: "RATE_LIMITED",
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
        retry_after: retryAfter,
      },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }

  entry.count++;
  return null;
}

/** Get client IP from request */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
