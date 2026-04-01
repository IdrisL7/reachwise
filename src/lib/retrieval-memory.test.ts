import { describe, expect, it } from "vitest";
import {
  inferRetrievalMemoryEvent,
  inferRetrievalSourceType,
  scaleRetrievalMemoryCounts,
  summarizeRetrievalMemoryRows,
} from "./retrieval-memory";

describe("inferRetrievalMemoryEvent", () => {
  it("maps downstream hook events into retrieval memory buckets", () => {
    expect(inferRetrievalMemoryEvent("viewed")).toBe("viewed");
    expect(inferRetrievalMemoryEvent("copied_with_evidence")).toBe("engaged");
    expect(inferRetrievalMemoryEvent("used_in_email")).toBe("email_used");
    expect(inferRetrievalMemoryEvent("reply_win")).toBe("win");
    expect(inferRetrievalMemoryEvent("edited")).toBeNull();
  });
});

describe("inferRetrievalSourceType", () => {
  it("identifies first-party and trusted-news sources", () => {
    expect(
      inferRetrievalSourceType({
        sourceUrl: "https://acme.com/news/launch",
        companyUrl: "https://acme.com",
        evidenceTier: "A",
      }),
    ).toBe("first_party");

    expect(
      inferRetrievalSourceType({
        sourceUrl: "https://www.businesswire.com/news/home/20260401001/en/Acme-Launches-New-Workflow",
        companyUrl: "https://acme.com",
        evidenceTier: "A",
      }),
    ).toBe("trusted_news");
  });
});

describe("summarizeRetrievalMemoryRows", () => {
  it("returns strongest source and trigger-specific learned preferences", () => {
    const summary = summarizeRetrievalMemoryRows([
      {
        sourceType: "first_party",
        triggerType: null,
        viewCount: 6,
        engagementCount: 5,
        emailUseCount: 3,
        winCount: 2,
      },
      {
        sourceType: "fallback_web",
        triggerType: null,
        viewCount: 6,
        engagementCount: 1,
        emailUseCount: 0,
        winCount: 0,
      },
      {
        sourceType: "trusted_news",
        triggerType: "funding",
        viewCount: 4,
        engagementCount: 3,
        emailUseCount: 2,
        winCount: 2,
      },
      {
        sourceType: "semantic_web",
        triggerType: "launch",
        viewCount: 4,
        engagementCount: 1,
        emailUseCount: 0,
        winCount: 0,
      },
    ], {
      pinnedSourceTypes: {
        first_party: true,
      },
      pinnedTriggerSourceTypes: {
        funding: {
          trusted_news: true,
        },
      },
    });

    expect(summary.topSourcePreferences[0]).toMatchObject({
      sourceType: "first_party",
      pinned: true,
    });
    expect(summary.topSourcePreferences.at(-1)).toMatchObject({
      sourceType: "fallback_web",
    });
    expect(summary.topTriggerPreferences[0]).toMatchObject({
      triggerType: "funding",
      sourceType: "trusted_news",
      pinned: true,
    });
  });
});

describe("scaleRetrievalMemoryCounts", () => {
  it("softens learned counts by a factor", () => {
    expect(scaleRetrievalMemoryCounts({
      viewCount: 10,
      engagementCount: 4,
      emailUseCount: 2,
      winCount: 1,
    }, 0.5, "2026-04-01T10:00:00.000Z")).toEqual({
      viewCount: 5,
      engagementCount: 2,
      emailUseCount: 1,
      winCount: 0.5,
      updatedAt: "2026-04-01T10:00:00.000Z",
    });
  });
});
