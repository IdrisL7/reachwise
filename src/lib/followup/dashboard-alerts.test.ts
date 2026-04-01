import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
  },
  schema: {
    auditLog: {
      createdAt: "audit_log.created_at",
      event: "audit_log.event",
      metadata: "audit_log.metadata",
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (...args: unknown[]) => args,
  and: (...args: unknown[]) => args,
  or: (...args: unknown[]) => args,
  gt: (...args: unknown[]) => args,
  gte: (...args: unknown[]) => args,
  desc: (...args: unknown[]) => args,
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  isNotNull: (...args: unknown[]) => args,
  lte: (...args: unknown[]) => args,
}));

import { getAlertAcknowledgementState } from "./dashboard";

function queueSelectResults(rowsByCall: Array<Array<Record<string, unknown>>>) {
  let index = 0;
  mockSelect.mockImplementation(() => {
    const rows = rowsByCall[index] ?? [];
    index += 1;
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (resolve: (rows: Array<Record<string, unknown>>) => unknown) =>
        Promise.resolve(resolve(rows)),
    };
    return chain;
  });
}

describe("getAlertAcknowledgementState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null timestamps when there is no current primary reason", async () => {
    await expect(getAlertAcknowledgementState(null)).resolves.toEqual({
      latestAlertAt: null,
      latestAcknowledgedAt: null,
    });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it("looks up the latest alert and acknowledgement for the current reason directly", async () => {
    queueSelectResults([
      [{ createdAt: "2026-03-31T10:00:00.000Z" }],
      [{ createdAt: "2026-03-31T11:00:00.000Z" }],
    ]);

    await expect(
      getAlertAcknowledgementState("A large share of recent sequence messages were sent without orchestration metadata."),
    ).resolves.toEqual({
      latestAlertAt: "2026-03-31T10:00:00.000Z",
      latestAcknowledgedAt: "2026-03-31T11:00:00.000Z",
    });

    expect(mockSelect).toHaveBeenCalledTimes(2);
  });

  it("does not depend on the dashboard history window and handles missing acknowledgement rows", async () => {
    queueSelectResults([
      [{ createdAt: "2026-03-29T08:00:00.000Z" }],
      [],
    ]);

    await expect(
      getAlertAcknowledgementState("40 cooled-off sends still need no-reply learning."),
    ).resolves.toEqual({
      latestAlertAt: "2026-03-29T08:00:00.000Z",
      latestAcknowledgedAt: null,
    });
  });
});
