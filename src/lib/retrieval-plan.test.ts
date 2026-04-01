import { describe, expect, it } from "vitest";
import {
  buildRetrievalDiagnostics,
  buildRetrievalPlan,
  classifyRetrievalSourceType,
  prioritizeRetrievalSources,
} from "./retrieval-plan";
import type { ClassifiedSource } from "./hooks";

function makeSource(
  overrides: Partial<ClassifiedSource> = {},
): ClassifiedSource {
  return {
    title: "Example source",
    publisher: "Example",
    date: "2026-03-31",
    url: "https://example.com/post",
    facts: ["Example fact"],
    tier: "B",
    anchorScore: 2,
    entity_hit_score: 1,
    ...overrides,
  };
}

describe("buildRetrievalPlan", () => {
  it("prefers first-party and trusted news ahead of generic web", () => {
    const plan = buildRetrievalPlan({
      targetDomain: "federato.com",
      hasIntentSignals: true,
      userProvidedUrl: true,
    });

    expect(plan.shouldRunPrimary).toBe(true);
    expect(plan.preferredSourceOrder).toEqual([
      "first_party",
      "trusted_news",
      "semantic_web",
      "fallback_web",
    ]);
    expect(plan.reasons.join(" ")).toContain("first-party");
  });
});

describe("classifyRetrievalSourceType", () => {
  it("labels company-domain sources as first-party", () => {
    expect(
      classifyRetrievalSourceType(
        makeSource({ url: "https://news.federato.com/series-d" }),
        "federato.com",
      ),
    ).toBe("first_party");
  });

  it("labels reputable publishers as trusted news", () => {
    expect(
      classifyRetrievalSourceType(
        makeSource({ url: "https://www.businesswire.com/news/home/20260331001/en/Federato-Raises-100-Million" }),
        "federato.com",
      ),
    ).toBe("trusted_news");
  });

  it("keeps generic but still relevant sources as semantic web", () => {
    expect(
      classifyRetrievalSourceType(
        makeSource({ url: "https://www.example-analyst.io/federato-growth-story", tier: "B", anchorScore: 4 }),
        "federato.com",
      ),
    ).toBe("semantic_web");
  });
});

describe("prioritizeRetrievalSources", () => {
  it("ranks first-party ahead of trusted news and generic web", () => {
    const ranked = prioritizeRetrievalSources(
      [
        makeSource({ url: "https://www.randomblog.io/federato-overview", tier: "B", anchorScore: 3 }),
        makeSource({ url: "https://www.businesswire.com/news/home/20260331001/en/Federato-Raises-100-Million", tier: "A", anchorScore: 4 }),
        makeSource({ url: "https://federato.com/news/series-d", tier: "A", anchorScore: 5 }),
      ],
      "federato.com",
    );

    expect(ranked[0]?.url).toContain("federato.com/news");
    expect(ranked[1]?.url).toContain("businesswire.com");
  });
});

describe("buildRetrievalDiagnostics", () => {
  it("summarizes a hybrid retrieval mix and recommends news expansion when low-signal", () => {
    const diagnostics = buildRetrievalDiagnostics(
      [
        makeSource({ url: "https://federato.com/news/series-d", tier: "A" }),
        makeSource({ url: "https://www.businesswire.com/news/home/20260331001/en/Federato-Raises-100-Million", tier: "A" }),
        makeSource({ url: "https://www.randomblog.io/federato-overview", tier: "B" }),
      ],
      {
        targetDomain: "federato.com",
        lowSignal: true,
        hasAnchoredSources: true,
        recoveryAttempted: true,
      },
    );

    expect(diagnostics.retrievalMode).toBe("hybrid");
    expect(diagnostics.sourceMix).toEqual({
      firstParty: 1,
      trustedNews: 1,
      semanticWeb: 1,
      fallbackWeb: 0,
    });
    expect(diagnostics.fallbackUsed).toBe(true);
    expect(diagnostics.recommendedNextPass).toBe("generic_fallback");
  });

  it("recommends news expansion when no trusted-news source exists yet", () => {
    const diagnostics = buildRetrievalDiagnostics(
      [makeSource({ url: "https://federato.com/news/series-d", tier: "A" })],
      {
        targetDomain: "federato.com",
        lowSignal: true,
        hasAnchoredSources: true,
      },
    );

    expect(diagnostics.recommendedNextPass).toBe("news_expansion");
  });
});
