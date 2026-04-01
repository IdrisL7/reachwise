import { describe, expect, it } from "vitest";
import {
  getLeadSegmentKey,
  hasSequenceNoReplyPenalty,
  isEligibleForNoReplyPenalty,
  markSequenceNoReplyPenalty,
} from "./sequence-memory";

describe("getLeadSegmentKey", () => {
  it("builds an executive manual known-domain segment", () => {
    expect(getLeadSegmentKey({
      title: "VP Sales",
      source: "manual",
      companyWebsite: "https://example.com",
    })).toBe("executive|manual|known_domain");
  });

  it("builds an operator import unknown-domain segment", () => {
    expect(getLeadSegmentKey({
      title: "RevOps Manager",
      source: "csv",
      companyWebsite: null,
    })).toBe("manager|import|unknown_domain");
  });
});

describe("no-reply sequence penalties", () => {
  it("marks metadata after a no-reply penalty is applied", () => {
    const metadata = markSequenceNoReplyPenalty({ angle: "risk" }, "2026-04-05T12:00:00.000Z");
    expect(hasSequenceNoReplyPenalty(metadata)).toBe(true);
  });

  it("only penalizes messages after the cooldown with no later inbound reply", () => {
    expect(isEligibleForNoReplyPenalty({
      sentAt: "2026-03-25T09:00:00.000Z",
      hasInboundAfterSend: false,
      alreadyPenalized: false,
      now: new Date("2026-03-31T10:00:00.000Z"),
    })).toBe(true);

    expect(isEligibleForNoReplyPenalty({
      sentAt: "2026-03-29T09:00:00.000Z",
      hasInboundAfterSend: false,
      alreadyPenalized: false,
      now: new Date("2026-03-31T10:00:00.000Z"),
    })).toBe(false);

    expect(isEligibleForNoReplyPenalty({
      sentAt: "2026-03-25T09:00:00.000Z",
      hasInboundAfterSend: true,
      alreadyPenalized: false,
      now: new Date("2026-03-31T10:00:00.000Z"),
    })).toBe(false);
  });
});
