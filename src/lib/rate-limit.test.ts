import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- mock DB layer ------------------------------------------------
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimitFn = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/lib/db", () => {
  const rateLimits = {
    key: "key",
    count: "count",
    resetAt: "reset_at",
  };

  return {
    db: {
      select: (...a: unknown[]) => {
        mockSelect(...a);
        return {
          from: (...b: unknown[]) => {
            mockFrom(...b);
            return {
              where: (...c: unknown[]) => {
                mockWhere(...c);
                return {
                  limit: (...d: unknown[]) => {
                    mockLimitFn(...d);
                    // default: return empty array (no existing record)
                    return mockLimitFn.getMockImplementation()?.(...d) ?? [];
                  },
                };
              },
            };
          },
        };
      },
      insert: (...a: unknown[]) => {
        mockInsert(...a);
        return {
          values: (...b: unknown[]) => {
            mockValues(...b);
            return {
              onConflictDoUpdate: (...c: unknown[]) => {
                mockOnConflictDoUpdate(...c);
              },
            };
          },
        };
      },
      update: (...a: unknown[]) => {
        mockUpdate(...a);
        return {
          set: (...b: unknown[]) => {
            mockSet(...b);
            return {
              where: (...c: unknown[]) => {
                mockUpdateWhere(...c);
              },
            };
          },
        };
      },
    },
    schema: { rateLimits },
  };
});

// Must import after vi.mock so the mock is in place
import { checkRateLimit, getClientIp } from "./rate-limit";

// ---- helpers ------------------------------------------------------
function setExistingRecord(record: { key: string; count: number; resetAt: string } | null) {
  mockLimitFn.mockImplementation(() => (record ? [record] : []));
}

beforeEach(() => {
  vi.clearAllMocks();
  // default: no existing record
  mockLimitFn.mockImplementation(() => []);
});

// ---- checkRateLimit -----------------------------------------------
describe("checkRateLimit", () => {
  it("returns null for an unknown endpoint (no config)", async () => {
    const result = await checkRateLimit("127.0.0.1", "nonexistent:endpoint");
    expect(result).toBeNull();
    // DB should not be called at all
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("allows first request when no existing record", async () => {
    setExistingRecord(null);
    const result = await checkRateLimit("127.0.0.1", "auth:hooks");
    expect(result).toBeNull();
    // Should insert a new record with count=1
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
    );
  });

  it("allows request within the limit and increments count", async () => {
    const futureReset = new Date(Date.now() + 30_000).toISOString();
    setExistingRecord({ key: "auth:hooks:127.0.0.1", count: 5, resetAt: futureReset });

    const result = await checkRateLimit("127.0.0.1", "auth:hooks");
    expect(result).toBeNull();
    // Should update count to 6
    expect(mockSet).toHaveBeenCalledWith({ count: 6 });
  });

  it("returns 429 when at the limit", async () => {
    const futureReset = new Date(Date.now() + 30_000).toISOString();
    setExistingRecord({ key: "auth:hooks:127.0.0.1", count: 60, resetAt: futureReset });

    const result = await checkRateLimit("127.0.0.1", "auth:hooks");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);

    const body = await result!.json();
    expect(body.code).toBe("RATE_LIMITED");
    expect(body.retry_after).toBeGreaterThan(0);
    expect(result!.headers.get("Retry-After")).toBeTruthy();
  });

  it("resets when the window has expired", async () => {
    const pastReset = new Date(Date.now() - 10_000).toISOString();
    setExistingRecord({ key: "demo:hooks:127.0.0.1", count: 3, resetAt: pastReset });

    const result = await checkRateLimit("127.0.0.1", "demo:hooks");
    expect(result).toBeNull();
    // Should upsert with count=1 (reset)
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1 }),
    );
  });

  it("returns 503 when the database throws", async () => {
    mockLimitFn.mockImplementation(() => {
      throw new Error("DB connection failed");
    });

    const result = await checkRateLimit("127.0.0.1", "auth:hooks");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);

    const body = await result!.json();
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
  });
});

// ---- endpoint configs ---------------------------------------------
describe("endpoint rate limit configs", () => {
  it("demo:hooks allows only 3 per day", async () => {
    const futureReset = new Date(Date.now() + 60_000).toISOString();
    setExistingRecord({ key: "demo:hooks:1.2.3.4", count: 3, resetAt: futureReset });

    const result = await checkRateLimit("1.2.3.4", "demo:hooks");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });

  it("auth:hooks allows up to 60 per minute", async () => {
    const futureReset = new Date(Date.now() + 30_000).toISOString();
    setExistingRecord({ key: "auth:hooks:ip", count: 59, resetAt: futureReset });

    const result = await checkRateLimit("ip", "auth:hooks");
    expect(result).toBeNull();
    // 59 < 60, so allowed and incremented to 60
    expect(mockSet).toHaveBeenCalledWith({ count: 60 });
  });

  it("auth:register allows only 3 per 10 minutes", async () => {
    const futureReset = new Date(Date.now() + 300_000).toISOString();
    setExistingRecord({ key: "auth:register:ip", count: 3, resetAt: futureReset });

    const result = await checkRateLimit("ip", "auth:register");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);
  });
});

// ---- getClientIp --------------------------------------------------
describe("getClientIp", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(request)).toBe("1.2.3.4");
  });

  it("trims whitespace from x-forwarded-for", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "  10.0.0.1 , 10.0.0.2" },
    });
    expect(getClientIp(request)).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("https://example.com", {
      headers: { "x-real-ip": "9.8.7.6" },
    });
    expect(getClientIp(request)).toBe("9.8.7.6");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const request = new Request("https://example.com");
    expect(getClientIp(request)).toBe("unknown");
  });
});
