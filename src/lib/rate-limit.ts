import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

interface CounterOptions {
  limit: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "public:hooks": { limit: 10, windowSeconds: 60 },
  "public:hooks-batch": { limit: 3, windowSeconds: 60 },
  "auth:hooks": { limit: 60, windowSeconds: 60 },
  "auth:hooks-batch": { limit: 20, windowSeconds: 60 },
  "auth:leads": { limit: 100, windowSeconds: 60 },
  "auth:followups": { limit: 30, windowSeconds: 60 },
  "auth:discover": { limit: 10, windowSeconds: 60 },
  "auth:company-intel": { limit: 30, windowSeconds: 60 },
  "public:sales-chat": { limit: 10, windowSeconds: 60 },
  "public:search-sources": { limit: 10, windowSeconds: 60 },
  "auth:login": { limit: 5, windowSeconds: 300 },
  "auth:register": { limit: 3, windowSeconds: 600 },
  "auth:forgot-password": { limit: 3, windowSeconds: 600 },
  "auth:reset-password": { limit: 5, windowSeconds: 600 },
  "public:email": { limit: 5, windowSeconds: 60 },
  "auth:email": { limit: 20, windowSeconds: 60 },
  "demo:hooks": { limit: 3, windowSeconds: 86400 },
};

/**
 * Check rate limit using DB-backed storage (works across Vercel instances).
 * Returns null if OK, or 429 response if exceeded.
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
): Promise<NextResponse | null> {
  const config = RATE_LIMITS[endpoint];
  if (!config) return null;

  const key = `${endpoint}:${identifier}`;
  const now = new Date();
  const resetAt = new Date(
    now.getTime() + config.windowSeconds * 1000,
  ).toISOString();

  try {
    const [existing] = await db
      .select()
      .from(schema.rateLimits)
      .where(eq(schema.rateLimits.key, key))
      .limit(1);

    if (!existing || new Date(existing.resetAt) < now) {
      await db
        .insert(schema.rateLimits)
        .values({ key, count: 1, resetAt })
        .onConflictDoUpdate({
          target: schema.rateLimits.key,
          set: { count: 1, resetAt },
        });
      return null;
    }

    if (existing.count >= config.limit) {
      const retryAfter = Math.ceil(
        (new Date(existing.resetAt).getTime() - now.getTime()) / 1000,
      );
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

    await db
      .update(schema.rateLimits)
      .set({ count: existing.count + 1 })
      .where(eq(schema.rateLimits.key, key));
    return null;
  } catch (err) {
    // Fail closed — if DB is down, reject the request
    console.error("Rate limit check failed:", err);
    return NextResponse.json(
      { status: "error", code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function readCounter(key: string) {
  const [existing] = await db
    .select()
    .from(schema.rateLimits)
    .where(eq(schema.rateLimits.key, key))
    .limit(1);

  return existing ?? null;
}

async function writeCounter(key: string, count: number, resetAt: string) {
  await db
    .insert(schema.rateLimits)
    .values({ key, count, resetAt })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: { count, resetAt },
    });
}

export async function getFailedAuthLockout(
  identifier: string,
  scope = "auth:login-lockout",
): Promise<number | null> {
  if (!identifier) return null;

  const key = `${scope}:${identifier}`;
  const now = new Date();

  try {
    const existing = await readCounter(key);
    if (!existing) return null;
    if (new Date(existing.resetAt) < now) return null;
    if (existing.count < 5) return null;

    return Math.ceil(
      (new Date(existing.resetAt).getTime() - now.getTime()) / 1000,
    );
  } catch (err) {
    console.error("Failed auth lockout check failed:", err);
    return null;
  }
}

export async function recordFailedAuthAttempt(
  identifier: string,
  options: CounterOptions = { limit: 5, windowSeconds: 900 },
  scope = "auth:login-lockout",
) {
  if (!identifier) return;

  const key = `${scope}:${identifier}`;
  const now = new Date();
  const nextResetAt = new Date(
    now.getTime() + options.windowSeconds * 1000,
  ).toISOString();

  try {
    const existing = await readCounter(key);

    if (!existing || new Date(existing.resetAt) < now) {
      await writeCounter(key, 1, nextResetAt);
      return;
    }

    await writeCounter(key, existing.count + 1, existing.resetAt);
  } catch (err) {
    console.error("Failed auth attempt recording failed:", err);
  }
}

export async function clearFailedAuthAttempts(
  identifier: string,
  scope = "auth:login-lockout",
) {
  if (!identifier) return;

  try {
    await db.delete(schema.rateLimits).where(eq(schema.rateLimits.key, `${scope}:${identifier}`));
  } catch (err) {
    console.error("Failed auth attempt clear failed:", err);
  }
}
