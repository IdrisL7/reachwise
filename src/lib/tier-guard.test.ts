import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/db — vi.hoisted ensures these are available inside vi.mock factories
// ---------------------------------------------------------------------------
const { mockSelect, mockUpdate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const schema = {
    users: {
      id: "users.id",
      trialEndsAt: "users.trial_ends_at",
      stripeSubscriptionId: "users.stripe_subscription_id",
      tierId: "users.tier_id",
      hooksUsedThisMonth: "users.hooks_used_this_month",
      hooksResetAt: "users.hooks_reset_at",
    },
  };
  return {
    db: {
      select: mockSelect,
      update: mockUpdate,
    },
    schema,
  };
});

// Mock drizzle-orm helpers so the SQL fragments don't blow up
vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => args,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

import {
  tierError,
  featureError,
  checkFeature,
  getLimits,
  checkTrialActive,
  checkHookQuota,
  checkBatchSize,
} from "./tier-guard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a chainable select mock that resolves to `rows` */
function chainSelect(rows: Record<string, unknown>[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

/** Build a chainable update mock that resolves to `result` */
function chainUpdate(result: { rowsAffected: number }) {
  const setChain = {
    where: vi.fn().mockResolvedValue(result),
  };
  const chain = {
    set: vi.fn().mockReturnValue(setChain),
  };
  mockUpdate.mockReturnValue(chain);
  return { chain, setChain };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tierError", () => {
  it("returns a 402 JSON response with default TIER_LIMIT code", async () => {
    const res = tierError("Limit reached");
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body).toEqual({
      status: "error",
      code: "TIER_LIMIT",
      message: "Limit reached",
    });
  });

  it("accepts a custom error code", async () => {
    const res = tierError("Not found", "USER_NOT_FOUND");
    const body = await res.json();
    expect(body.code).toBe("USER_NOT_FOUND");
  });
});

describe("featureError", () => {
  it("returns a 403 JSON response with FEATURE_NOT_AVAILABLE code", async () => {
    const res = featureError("Follow-up Engine");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("FEATURE_NOT_AVAILABLE");
    expect(body.message).toContain("Follow-up Engine");
  });
});

describe("checkFeature", () => {
  it("returns true when the tier has the flag enabled", () => {
    expect(checkFeature("pro", "followUpEngine")).toBe(true);
    expect(checkFeature("concierge", "doneForYouSetup")).toBe(true);
  });

  it("returns false when the tier does not have the flag", () => {
    expect(checkFeature("starter", "followUpEngine")).toBe(false);
    expect(checkFeature("starter", "intentScoring")).toBe(false);
  });

  it("returns false for an unknown tier id", () => {
    // Cast to bypass TS — runtime guard should still work
    expect(checkFeature("unknown" as any, "hooks")).toBe(false);
  });
});

describe("getLimits", () => {
  it("returns correct limits for starter", () => {
    expect(getLimits("starter")).toEqual({ hooksPerMonth: 200, batchSize: 10 });
  });

  it("returns correct limits for pro", () => {
    expect(getLimits("pro")).toEqual({ hooksPerMonth: 750, batchSize: 75 });
  });

  it("returns correct limits for concierge", () => {
    expect(getLimits("concierge")).toEqual({ hooksPerMonth: 10000, batchSize: 75 });
  });

  it("falls back to starter limits for unknown tier", () => {
    expect(getLimits("unknown" as any)).toEqual({ hooksPerMonth: 200, batchSize: 10 });
  });
});

describe("checkTrialActive", () => {
  it("returns error when user not found", async () => {
    chainSelect([]);
    const res = await checkTrialActive("user-1");
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.code).toBe("USER_NOT_FOUND");
  });

  it("returns null (OK) when user has an active subscription", async () => {
    chainSelect([{ trialEndsAt: null, stripeSubscriptionId: "sub_123" }]);
    const res = await checkTrialActive("user-1");
    expect(res).toBeNull();
  });

  it("returns null (OK) when user has no trialEndsAt (legacy user)", async () => {
    chainSelect([{ trialEndsAt: null, stripeSubscriptionId: null }]);
    const res = await checkTrialActive("user-1");
    expect(res).toBeNull();
  });

  it("returns null (OK) when trial is still active", async () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    chainSelect([{ trialEndsAt: future, stripeSubscriptionId: null }]);
    const res = await checkTrialActive("user-1");
    expect(res).toBeNull();
  });

  it("returns TRIAL_EXPIRED error when trial has ended", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    chainSelect([{ trialEndsAt: past, stripeSubscriptionId: null }]);
    const res = await checkTrialActive("user-1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
    expect(body.upgradeUrl).toBe("/#pricing");
  });

  it("allows access even with expired trial if subscription exists", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    chainSelect([{ trialEndsAt: past, stripeSubscriptionId: "sub_abc" }]);
    const res = await checkTrialActive("user-1");
    expect(res).toBeNull();
  });
});

describe("checkHookQuota", () => {
  // checkHookQuota calls checkTrialActive first, then its own select + update.
  // We need to handle two sequential db.select() calls.

  function setupQuotaTest(opts: {
    trialUser: Record<string, unknown>;
    quotaUser?: Record<string, unknown>;
    updateResult?: { rowsAffected: number };
  }) {
    // First select: checkTrialActive, Second select: quota user lookup
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      const rows = selectCallCount === 1 ? [opts.trialUser] : [opts.quotaUser ?? {}];
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      };
    });

    if (opts.updateResult) {
      chainUpdate(opts.updateResult);
    }
  }

  it("propagates trial expiration error", async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Only one select call — checkTrialActive returns error before quota check
    chainSelect([{ trialEndsAt: past, stripeSubscriptionId: null }]);
    const res = await checkHookQuota("user-1");
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.code).toBe("TRIAL_EXPIRED");
  });

  it("returns USER_NOT_FOUND when quota user lookup returns empty", async () => {
    // First select: trial check passes (has subscription)
    // Second select: returns no user
    let selectCallCount = 0;
    mockSelect.mockImplementation(() => {
      selectCallCount++;
      const rows = selectCallCount === 1
        ? [{ trialEndsAt: null, stripeSubscriptionId: "sub_x" }]
        : [];
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      };
    });

    const res = await checkHookQuota("user-1");
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.code).toBe("USER_NOT_FOUND");
  });

  it("resets counter and allows when month has rolled over", async () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    setupQuotaTest({
      trialUser: { trialEndsAt: null, stripeSubscriptionId: "sub_x" },
      quotaUser: {
        tierId: "starter",
        hooksUsedThisMonth: 199,
        hooksResetAt: lastMonth.toISOString(),
      },
    });

    // update for the reset path
    const setChain = { where: vi.fn().mockResolvedValue({ rowsAffected: 1 }) };
    mockUpdate.mockReturnValue({ set: vi.fn().mockReturnValue(setChain) });

    const res = await checkHookQuota("user-1");
    expect(res).toBeNull();
    // Verify update was called (counter reset)
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("allows when usage is under the limit (same month)", async () => {
    const now = new Date();
    setupQuotaTest({
      trialUser: { trialEndsAt: null, stripeSubscriptionId: "sub_x" },
      quotaUser: {
        tierId: "pro",
        hooksUsedThisMonth: 100,
        hooksResetAt: now.toISOString(),
      },
      updateResult: { rowsAffected: 1 },
    });

    const res = await checkHookQuota("user-1");
    expect(res).toBeNull();
  });

  it("returns TIER_LIMIT when quota is exceeded (same month)", async () => {
    const now = new Date();
    setupQuotaTest({
      trialUser: { trialEndsAt: null, stripeSubscriptionId: "sub_x" },
      quotaUser: {
        tierId: "starter",
        hooksUsedThisMonth: 200,
        hooksResetAt: now.toISOString(),
      },
      updateResult: { rowsAffected: 0 },
    });

    const res = await checkHookQuota("user-1");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("TIER_LIMIT");
    expect(body.message).toContain("200");
  });

  it("uses starter limits when tierId is missing", async () => {
    const now = new Date();
    setupQuotaTest({
      trialUser: { trialEndsAt: null, stripeSubscriptionId: "sub_x" },
      quotaUser: {
        tierId: null,
        hooksUsedThisMonth: 200,
        hooksResetAt: now.toISOString(),
      },
      updateResult: { rowsAffected: 0 },
    });

    const res = await checkHookQuota("user-1");
    expect(res).not.toBeNull();
    const body = await res!.json();
    // starter limit is 200, so at 200 usage with 0 rows affected => limit
    expect(body.code).toBe("TIER_LIMIT");
    expect(body.message).toContain("200");
  });

  it("concierge tier allows many more hooks", async () => {
    const now = new Date();
    setupQuotaTest({
      trialUser: { trialEndsAt: null, stripeSubscriptionId: "sub_x" },
      quotaUser: {
        tierId: "concierge",
        hooksUsedThisMonth: 5000,
        hooksResetAt: now.toISOString(),
      },
      updateResult: { rowsAffected: 1 },
    });

    const res = await checkHookQuota("user-1");
    expect(res).toBeNull();
  });
});

describe("checkBatchSize", () => {
  it("returns null when batch size is within limit", () => {
    expect(checkBatchSize("starter", 10)).toBeNull();
    expect(checkBatchSize("starter", 5)).toBeNull();
    expect(checkBatchSize("pro", 75)).toBeNull();
    expect(checkBatchSize("concierge", 75)).toBeNull();
  });

  it("returns error when batch size exceeds limit", async () => {
    const res = checkBatchSize("starter", 11);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(402);
    const body = await res!.json();
    expect(body.code).toBe("TIER_LIMIT");
    expect(body.message).toContain("11");
    expect(body.message).toContain("10");
  });

  it("enforces starter batch limit of 10", async () => {
    const res = checkBatchSize("starter", 50);
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.message).toContain("10");
  });

  it("allows pro tier up to 75", () => {
    expect(checkBatchSize("pro", 74)).toBeNull();
    expect(checkBatchSize("pro", 75)).toBeNull();
  });

  it("rejects pro tier above 75", async () => {
    const res = checkBatchSize("pro", 76);
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.message).toContain("75");
  });
});
