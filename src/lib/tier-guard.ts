import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { getTier, type TierId, type Tier } from "@/lib/tiers";

interface TierLimits {
  hooksPerMonth: number;
  batchSize: number;
  discoverySearchesPerMonth: number;
}

const TIER_LIMITS: Record<TierId, TierLimits> = {
  free: { hooksPerMonth: 10, batchSize: 3, discoverySearchesPerMonth: 0 },
  starter: { hooksPerMonth: 200, batchSize: 10, discoverySearchesPerMonth: 0 },
  pro: { hooksPerMonth: 750, batchSize: 75, discoverySearchesPerMonth: 50 },
  concierge: { hooksPerMonth: 10000, batchSize: 75, discoverySearchesPerMonth: 200 },
};

export function tierError(message: string, code = "TIER_LIMIT") {
  return NextResponse.json(
    { status: "error", code, message },
    { status: 402 },
  );
}

export function featureError(feature: string) {
  return NextResponse.json(
    {
      status: "error",
      code: "FEATURE_NOT_AVAILABLE",
      message: `${feature} is not available on your current plan. Upgrade to access this feature.`,
    },
    { status: 403 },
  );
}

/** Check if user has a specific feature flag enabled */
export function checkFeature(
  tierId: TierId,
  flag: keyof Tier["flags"],
): boolean {
  const tier = getTier(tierId);
  if (!tier) return false;
  return tier.flags[flag];
}

/** Get tier limits for a user */
export function getLimits(tierId: TierId): TierLimits {
  return TIER_LIMITS[tierId] || TIER_LIMITS.starter;
}

/** Check if the user's trial has expired and they have no active subscription */
export async function checkTrialActive(userId: string): Promise<NextResponse | null> {
  const [user] = await db
    .select({
      trialEndsAt: schema.users.trialEndsAt,
      stripeSubscriptionId: schema.users.stripeSubscriptionId,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return tierError("User not found.", "USER_NOT_FOUND");

  // If user has an active Stripe subscription, they're good
  if (user.stripeSubscriptionId) return null;

  // If no trial end date set (legacy user), allow access
  if (!user.trialEndsAt) return null;

  // Check if trial has expired
  if (new Date(user.trialEndsAt) < new Date()) {
    return NextResponse.json(
      {
        status: "error",
        code: "TRIAL_EXPIRED",
        message: "Your free trial has ended. Subscribe to continue using GetSignalHooks.",
        upgradeUrl: "/#pricing",
      },
      { status: 402 },
    );
  }

  return null;
}

/** Check and increment hook usage. Returns null if OK, or error response if limit hit. */
export async function checkHookQuota(userId: string): Promise<NextResponse | null> {
  // First check trial status
  const trialCheck = await checkTrialActive(userId);
  if (trialCheck) return trialCheck;

  const [user] = await db
    .select({
      tierId: schema.users.tierId,
      hooksUsedThisMonth: schema.users.hooksUsedThisMonth,
      hooksResetAt: schema.users.hooksResetAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return tierError("User not found.", "USER_NOT_FOUND");

  const tierId = (user.tierId as TierId) || "starter";
  const limits = getLimits(tierId);

  const now = new Date();
  const resetDate = user.hooksResetAt ? new Date(user.hooksResetAt) : new Date(0);
  const isNewMonth =
    resetDate.getMonth() !== now.getMonth() ||
    resetDate.getFullYear() !== now.getFullYear();

  if (isNewMonth) {
    // New month — reset counter to 1 (this request)
    await db
      .update(schema.users)
      .set({
        hooksUsedThisMonth: 1,
        hooksResetAt: now.toISOString(),
      })
      .where(eq(schema.users.id, userId));
    return null;
  }

  // Same month — atomic increment with WHERE guard against exceeding limit
  const result = await db
    .update(schema.users)
    .set({
      hooksUsedThisMonth: sql`${schema.users.hooksUsedThisMonth} + 1`,
    })
    .where(
      sql`${schema.users.id} = ${userId} AND ${schema.users.hooksUsedThisMonth} < ${limits.hooksPerMonth}`,
    );

  // If no rows were updated, the WHERE guard blocked it (quota exceeded)
  // Drizzle returns { rowsAffected } or similar — check if update affected 0 rows
  // For libsql/Turso, check result.rowsAffected
  if ((result as any).rowsAffected === 0) {
    return tierError(
      `Monthly hook limit reached (${limits.hooksPerMonth}). Upgrade your plan for more.`,
    );
  }

  return null;
}

/** Check batch size against tier limit */
export function checkBatchSize(tierId: TierId, requestedSize: number): NextResponse | null {
  const limits = getLimits(tierId);
  if (requestedSize > limits.batchSize) {
    return tierError(
      `Batch size ${requestedSize} exceeds your plan limit of ${limits.batchSize}. Upgrade for larger batches.`,
    );
  }
  return null;
}

/** Check monthly discovery quota by counting discovery searches in current month */
export async function checkDiscoveryQuota(userId: string): Promise<NextResponse | null> {
  const trialCheck = await checkTrialActive(userId);
  if (trialCheck) return trialCheck;

  const [user] = await db
    .select({ tierId: schema.users.tierId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return tierError("User not found.", "USER_NOT_FOUND");

  const tierId = (user.tierId as TierId) || "starter";
  const limits = getLimits(tierId);

  if (limits.discoverySearchesPerMonth <= 0) {
    return tierError("Discovery is not available on your current plan.", "FEATURE_NOT_AVAILABLE");
  }

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();

  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.discoverySearches)
    .where(
      and(
        eq(schema.discoverySearches.userId, userId),
        gte(schema.discoverySearches.createdAt, start),
        lt(schema.discoverySearches.createdAt, end),
      ),
    );

  const used = Number(countRow?.count ?? 0);
  if (used >= limits.discoverySearchesPerMonth) {
    return tierError(
      `Monthly discovery search limit reached (${limits.discoverySearchesPerMonth}). Upgrade your plan for more.`,
    );
  }

  return null;
}
