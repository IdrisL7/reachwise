import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, sql } from "drizzle-orm";
import { getTier, type TierId, type Tier } from "@/lib/tiers";

interface TierLimits {
  hooksPerMonth: number;
  batchSize: number;
}

const TIER_LIMITS: Record<TierId, TierLimits> = {
  starter: { hooksPerMonth: 200, batchSize: 10 },
  pro: { hooksPerMonth: 750, batchSize: 75 },
  concierge: { hooksPerMonth: 10000, batchSize: 75 },
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

  // Reset counter if new month
  const resetDate = new Date(user.hooksResetAt);
  const now = new Date();
  if (
    resetDate.getMonth() !== now.getMonth() ||
    resetDate.getFullYear() !== now.getFullYear()
  ) {
    await db
      .update(schema.users)
      .set({
        hooksUsedThisMonth: 0,
        hooksResetAt: now.toISOString(),
      })
      .where(eq(schema.users.id, userId));

    user.hooksUsedThisMonth = 0;
  }

  if (user.hooksUsedThisMonth >= limits.hooksPerMonth) {
    return tierError(
      `Monthly hook limit reached (${limits.hooksPerMonth}). Upgrade your plan for more.`,
    );
  }

  // Increment counter
  await db
    .update(schema.users)
    .set({
      hooksUsedThisMonth: sql`${schema.users.hooksUsedThisMonth} + 1`,
    })
    .where(eq(schema.users.id, userId));

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
