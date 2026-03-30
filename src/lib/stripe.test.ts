import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Mock the Stripe SDK
vi.mock("stripe", () => {
  const StripeMock = vi.fn(() => ({
    customers: {
      retrieve: vi.fn(),
      create: vi.fn(),
    },
  }));
  return { default: StripeMock };
});

// Mock the database
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                limit: (...lArgs: unknown[]) => {
                  mockLimit(...lArgs);
                  return mockLimit._result ?? [];
                },
              };
            },
          };
        },
      };
    },
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return {
        set: (...sArgs: unknown[]) => {
          mockSet(...sArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockUpdateWhere(...wArgs);
              return Promise.resolve();
            },
          };
        },
      };
    },
  },
  schema: {
    users: {
      id: "users.id",
      stripeCustomerId: "users.stripeCustomerId",
      tierId: "users.tierId",
      stripeSubscriptionId: "users.stripeSubscriptionId",
      trialEndsAt: "users.trialEndsAt",
    },
  },
}));

// Set env vars before importing module under test
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_PRICE_PRO = "price_pro_456";

import {
  getStripe,
  getTierFromPriceId,
  getPriceId,
  getOrCreateStripeCustomer,
  syncSubscriptionToUser,
  stripe,
} from "./stripe";

// ---------------------------------------------------------------------------
// Helpers to access the mocked stripe instance methods
// ---------------------------------------------------------------------------

function getStripeCustomers() {
  // The `stripe` proxy delegates to getStripe() which returns the Stripe instance
  // We need to access the underlying mock methods through the proxy
  return stripe.customers as unknown as {
    retrieve: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getStripe", () => {
  it("returns a Stripe instance", () => {
    const instance = getStripe();
    expect(instance).toBeDefined();
    expect(instance.customers).toBeDefined();
  });

  it("returns the same instance on subsequent calls (singleton)", () => {
    const a = getStripe();
    const b = getStripe();
    expect(a).toBe(b);
  });
});

describe("getTierFromPriceId", () => {
  it("returns 'pro' for the pro price ID", () => {
    expect(getTierFromPriceId("price_pro_456")).toBe("pro");
  });

  it("defaults to 'free' for an unknown price ID", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getTierFromPriceId("price_unknown_999")).toBe("free");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown Stripe price ID: price_unknown_999"),
    );
    warnSpy.mockRestore();
  });
});

describe("getPriceId", () => {
  it("returns empty string for free tier", () => {
    expect(getPriceId("free")).toBe("");
  });

  it("returns the pro price ID", () => {
    expect(getPriceId("pro")).toBe("price_pro_456");
  });
});

describe("getOrCreateStripeCustomer", () => {
  const customers = () => getStripeCustomers();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the limit result between tests
    (mockLimit as ReturnType<typeof vi.fn> & { _result?: unknown[] })._result =
      undefined;
  });

  it("returns existing customer ID when the customer exists in Stripe", async () => {
    (mockLimit as any)._result = [{ stripeCustomerId: "cus_existing" }];
    customers().retrieve.mockResolvedValue({ id: "cus_existing", deleted: false });

    const result = await getOrCreateStripeCustomer("user_1", "user@test.com");

    expect(result).toBe("cus_existing");
    expect(customers().retrieve).toHaveBeenCalledWith("cus_existing");
    // Should NOT create a new customer
    expect(customers().create).not.toHaveBeenCalled();
  });

  it("creates a new customer when the stored customer is deleted in Stripe", async () => {
    (mockLimit as any)._result = [{ stripeCustomerId: "cus_stale" }];
    customers().retrieve.mockResolvedValue({ id: "cus_stale", deleted: true });
    customers().create.mockResolvedValue({ id: "cus_new_after_deleted" });

    const result = await getOrCreateStripeCustomer("user_2", "stale@test.com");

    expect(result).toBe("cus_new_after_deleted");
    expect(customers().create).toHaveBeenCalledWith({
      email: "stale@test.com",
      metadata: { userId: "user_2" },
    });
    expect(mockSet).toHaveBeenCalledWith({ stripeCustomerId: "cus_new_after_deleted" });
  });

  it("creates a new customer when retrieve throws (stale/missing customer)", async () => {
    (mockLimit as any)._result = [{ stripeCustomerId: "cus_gone" }];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    customers().retrieve.mockRejectedValue(new Error("No such customer"));
    customers().create.mockResolvedValue({ id: "cus_fresh" });

    const result = await getOrCreateStripeCustomer("user_3", "gone@test.com");

    expect(result).toBe("cus_fresh");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Stripe customer cus_gone not found"),
    );
    expect(customers().create).toHaveBeenCalledWith({
      email: "gone@test.com",
      metadata: { userId: "user_3" },
    });
    warnSpy.mockRestore();
  });

  it("creates a new customer when no stripeCustomerId exists in DB", async () => {
    (mockLimit as any)._result = [{ stripeCustomerId: null }];
    customers().create.mockResolvedValue({ id: "cus_brand_new" });

    const result = await getOrCreateStripeCustomer("user_4", "new@test.com");

    expect(result).toBe("cus_brand_new");
    expect(customers().retrieve).not.toHaveBeenCalled();
    expect(customers().create).toHaveBeenCalledWith({
      email: "new@test.com",
      metadata: { userId: "user_4" },
    });
    expect(mockSet).toHaveBeenCalledWith({ stripeCustomerId: "cus_brand_new" });
  });

  it("creates a new customer when user row is not found in DB", async () => {
    (mockLimit as any)._result = [];
    customers().create.mockResolvedValue({ id: "cus_no_row" });

    const result = await getOrCreateStripeCustomer("user_5", "norow@test.com");

    expect(result).toBe("cus_no_row");
    expect(customers().retrieve).not.toHaveBeenCalled();
    expect(customers().create).toHaveBeenCalled();
  });
});

describe("syncSubscriptionToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates user tier and subscription ID based on subscription data", async () => {
    const subscription = {
      id: "sub_123",
      metadata: { userId: "user_1" },
      items: {
        data: [{ price: { id: "price_pro_456" } }],
      },
    } as unknown as import("stripe").default.Subscription;

    await syncSubscriptionToUser(subscription);

    expect(mockSet).toHaveBeenCalledWith({
      tierId: "pro",
      stripeSubscriptionId: "sub_123",
      trialEndsAt: null,
    });
  });

  it("defaults to free when no price ID is present", async () => {
    const subscription = {
      id: "sub_456",
      metadata: { userId: "user_2" },
      items: { data: [] },
    } as unknown as import("stripe").default.Subscription;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await syncSubscriptionToUser(subscription);

    expect(mockSet).toHaveBeenCalledWith({
      tierId: "free",
      stripeSubscriptionId: "sub_456",
      trialEndsAt: null,
    });
    warnSpy.mockRestore();
  });

  it("does nothing when subscription has no userId in metadata", async () => {
    const subscription = {
      id: "sub_789",
      metadata: {},
      items: { data: [{ price: { id: "price_pro_456" } }] },
    } as unknown as import("stripe").default.Subscription;

    await syncSubscriptionToUser(subscription);

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
