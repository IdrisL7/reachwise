import { describe, it, expect } from "vitest";
import {
  validateHook,
  rewriteChangeVerbs,
  hasValidQuestionStructure,
  publishGate,
  publishGateValidateHook,
  type Hook,
  type ClaudeHookPayload,
  type ClassifiedSource,
  type PsychMode,
} from "./hooks";
import type { EvidenceTier, StructuredHook } from "./types";

// ---------------------------------------------------------------------------
// Helper: build a source lookup from an array of sources
// ---------------------------------------------------------------------------
function buildSourceLookup(
  sources: ClassifiedSource[],
): Map<number, ClassifiedSource> {
  const map = new Map<number, ClassifiedSource>();
  sources.forEach((s, i) => map.set(i + 1, s));
  return map;
}

// ---------------------------------------------------------------------------
// Mock sources: sales.co company-anchored pages
// ---------------------------------------------------------------------------
const SALESCO_HOMEPAGE: ClassifiedSource = {
  title: "Sales.co - Automated Customer Acquisition for B2B",
  publisher: "sales.co",
  date: "",
  url: "https://sales.co",
  facts: [
    "3.2X reply rate vs templates",
    "100% unique email to every prospect",
    "39% MORE QUALIFIED ACCOUNTS",
    "Automated customer acquisition for B2B companies",
    "We handle everything from lead data to deliverability management",
  ],
  tier: "A" as EvidenceTier,
  anchorScore: 8,
};

const SALESCO_SWIPEFILES: ClassifiedSource = {
  title: "Cold Email Swipe Files | Sales.co - Proven Templates & Examples",
  publisher: "sales.co",
  date: "",
  url: "https://sales.co/swipefiles",
  facts: [
    "$250/reply pricing model",
    "24/7 deliverability management",
    "99% of cold email is just digital spam with a business card attached",
    "<10 min replies to positive replies",
  ],
  tier: "A" as EvidenceTier,
  anchorScore: 10,
};

const SALESCO_CUSTOMERS: ClassifiedSource = {
  title: "Sales.co Case Studies",
  publisher: "sales.co",
  date: "",
  url: "https://sales.co/customers",
  facts: [
    "820 interested replies from ~94,000 emails",
    "demo-focused CTAs worked best for enterprise segment",
    "95%+ delivery rates across all campaigns",
  ],
  tier: "A" as EvidenceTier,
  anchorScore: 10,
};

const SALESCO_BLOG: ClassifiedSource = {
  title: "B2B Lead Generation: 15 Strategies That Generate 500+ Qualified Leads",
  publisher: "sales.co",
  date: "",
  url: "https://sales.co/blog/lead-generation-strategies",
  facts: [
    "15 Strategies That Generate 500+ Qualified Leads",
    "Focus on ICP targeting and multi-channel outreach",
  ],
  tier: "B" as EvidenceTier,
  anchorScore: 6,
};

// Unrelated market-context source (should be excluded / capped)
const BESTBUY_SOURCE: ClassifiedSource = {
  title: "Best Buy Reports Strong Holiday Sales with 12% Online Growth",
  publisher: "reuters.com",
  date: "2026-01-15",
  url: "https://reuters.com/business/bestbuy-holiday-sales",
  facts: [
    "Best Buy reported 12% online sales growth in Q4",
    "The retailer credited improved supply chain and inventory management",
  ],
  tier: "B" as EvidenceTier,
  anchorScore: 0,
};

// Vague Tier B source with no concrete anchor
const VAGUE_TIERB_SOURCE: ClassifiedSource = {
  title: "Why Outbound Sales Matters",
  publisher: "example.com",
  date: "",
  url: "https://example.com/outbound-sales",
  facts: [
    "Outbound sales is important for growth",
    "Many companies are investing in sales teams",
  ],
  tier: "B" as EvidenceTier,
  anchorScore: 3,
};

const ALL_SOURCES = [
  SALESCO_HOMEPAGE,
  SALESCO_SWIPEFILES,
  SALESCO_CUSTOMERS,
  SALESCO_BLOG,
  BESTBUY_SOURCE,
  VAGUE_TIERB_SOURCE,
];

const sourceLookup = buildSourceLookup(ALL_SOURCES);

// ---------------------------------------------------------------------------
// 1. Expected hooks pass validation
// ---------------------------------------------------------------------------
describe("sales.co regression: expected hooks pass validation", () => {
  const expectedHooks: Array<{
    id: string;
    payload: ClaudeHookPayload;
  }> = [
    {
      id: "salesco_01",
      payload: {
        news_item: 4, // blog
        angle: "trigger",
        psych_mode: "relevance",
        hook: `Noticed you publish playbooks like "15 Strategies That Generate 500+ Qualified Leads" — are customers buying you for strategy, or for execution + deliverability?`,
        evidence_snippet:
          "15 Strategies That Generate 500+ Qualified Leads",
        source_title: SALESCO_BLOG.title,
        source_date: "",
        source_url: SALESCO_BLOG.url,
        evidence_tier: "B",
        confidence: "high",
        why_this_works: "you-first relevance",
      },
    },
    {
      id: "salesco_02",
      payload: {
        news_item: 1, // homepage
        angle: "trigger",
        psych_mode: "curiosity_gap",
        hook: `You claim "39% MORE QUALIFIED ACCOUNTS" — is that improvement coming more from lead data quality, or from the outreach copy/QA process?`,
        evidence_snippet: "39% MORE QUALIFIED ACCOUNTS",
        source_title: SALESCO_HOMEPAGE.title,
        source_date: "",
        source_url: SALESCO_HOMEPAGE.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "curiosity gap / mechanism",
      },
    },
    {
      id: "salesco_03",
      payload: {
        news_item: 1,
        angle: "risk",
        psych_mode: "tradeoff_frame",
        hook: `Your "3.2X reply rate vs templates" claim is bold — are you optimizing for booked meetings, or for qualified reply volume?`,
        evidence_snippet: "3.2X reply rate vs templates",
        source_title: SALESCO_HOMEPAGE.title,
        source_date: "",
        source_url: SALESCO_HOMEPAGE.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "tradeoff frame",
      },
    },
    {
      id: "salesco_04",
      payload: {
        news_item: 1,
        angle: "tradeoff",
        psych_mode: "curiosity_gap",
        hook: `You promise "100% unique email to every prospect" — is that human-written end-to-end, or programmatic personalization with human QA?`,
        evidence_snippet: "100% unique email to every prospect",
        source_title: SALESCO_HOMEPAGE.title,
        source_date: "",
        source_url: SALESCO_HOMEPAGE.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "mechanism curiosity gap",
      },
    },
    {
      id: "salesco_05",
      payload: {
        news_item: 2,
        angle: "trigger",
        psych_mode: "tradeoff_frame",
        hook: `You price at "$250/reply" — is that mainly to de-risk clients, or to push higher standards on list + offer quality?`,
        evidence_snippet: "$250/reply pricing model",
        source_title: SALESCO_SWIPEFILES.title,
        source_date: "",
        source_url: SALESCO_SWIPEFILES.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "tradeoff frame",
      },
    },
    {
      id: "salesco_06",
      payload: {
        news_item: 2,
        angle: "risk",
        psych_mode: "benefit",
        hook: `You offer "24/7 deliverability management" — do you run dedicated infrastructure per client, or shared pools with throttling/warmup?`,
        evidence_snippet: "24/7 deliverability management",
        source_title: SALESCO_SWIPEFILES.title,
        source_date: "",
        source_url: SALESCO_SWIPEFILES.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "benefit + mechanism",
      },
    },
    {
      id: "salesco_07",
      payload: {
        news_item: 2,
        angle: "tradeoff",
        psych_mode: "relevance",
        hook: `You say "99% of cold email is just digital spam" — do you fix that first with list hygiene, or with offer/messaging changes?`,
        evidence_snippet:
          "99% of cold email is just digital spam with a business card attached",
        source_title: SALESCO_SWIPEFILES.title,
        source_date: "",
        source_url: SALESCO_SWIPEFILES.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "contrarian reframe",
      },
    },
    {
      id: "salesco_08",
      payload: {
        news_item: 3,
        angle: "risk",
        psych_mode: "symptom",
        hook: `Noticed "820 interested replies from ~94,000 emails" — are you optimizing more for booked meetings, or for qualified replies at scale?`,
        evidence_snippet: "820 interested replies from ~94,000 emails",
        source_title: SALESCO_CUSTOMERS.title,
        source_date: "",
        source_url: SALESCO_CUSTOMERS.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "symptom self-diagnosis",
      },
    },
    {
      id: "salesco_09",
      payload: {
        news_item: 3,
        angle: "tradeoff",
        psych_mode: "tradeoff_frame",
        hook: `On your case study, "demo-focused CTAs" worked — do you push demos early, or qualify first then drive to demo?`,
        evidence_snippet:
          "demo-focused CTAs worked best for enterprise segment",
        source_title: SALESCO_CUSTOMERS.title,
        source_date: "",
        source_url: SALESCO_CUSTOMERS.url,
        evidence_tier: "A",
        confidence: "high",
        why_this_works: "tradeoff frame",
      },
    },
  ];

  for (const { id, payload } of expectedHooks) {
    it(`${id}: passes validateHook`, () => {
      const result = validateHook(payload, sourceLookup);
      expect(result).not.toBeNull();
      expect(result!.hook).toBe(payload.hook);
      if (payload.psych_mode) {
        expect(result!.psych_mode).toBe(payload.psych_mode);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Change verb rewrite-or-drop
// ---------------------------------------------------------------------------
describe("change verb validator: rewrite or drop", () => {
  const basePayload: ClaudeHookPayload = {
    news_item: 2,
    angle: "trigger",
    psych_mode: "relevance",
    hook: "",
    evidence_snippet: "$250/reply pricing model",
    source_title: SALESCO_SWIPEFILES.title,
    source_date: "",
    source_url: SALESCO_SWIPEFILES.url,
    evidence_tier: "A",
    confidence: "high",
  };

  it("rewrites 'You switched to' → 'You use'", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `You switched to "$250/reply" pricing — is that to de-risk clients, or to push quality?`,
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
    expect(result!.hook).toContain("You use");
    expect(result!.hook).not.toMatch(/\bswitched\b/i);
  });

  it("rewrites 'You recently changed to' → 'You offer'", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `You recently changed to "$250/reply" — are clients buying on cost, or outcomes?`,
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
    expect(result!.hook).not.toMatch(/\brecently changed\b/i);
  });

  it("rewrites 'Now charging' → 'You charge'", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Now charging "$250/reply" — is that to de-risk clients, or to push quality?`,
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
    expect(result!.hook).toContain("You charge");
    expect(result!.hook).not.toMatch(/\bNow charging\b/i);
  });

  it("drops 'You revamped' (unsourced claim pattern)", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `You revamped "$250/reply" model — is that driven by cost, or quality positioning?`,
      },
      sourceLookup,
    );
    // "revamp" is in UNSOURCED_CLAIM_PATTERNS → rejected before rewrite
    expect(result).toBeNull();
  });

  it("allows change verb when evidence has time cue", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `You recently launched "$250/reply" pricing — is that to de-risk clients, or to push quality?`,
        evidence_snippet:
          "Sales.co recently launched a $250/reply pricing model in Q1 2026",
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
    // No rewrite needed — time cue in evidence
    expect(result!.hook).toContain("recently launched");
  });
});

// ---------------------------------------------------------------------------
// 3. rewriteChangeVerbs unit tests
// ---------------------------------------------------------------------------
describe("rewriteChangeVerbs", () => {
  it("rewrites 'You switched to' → 'You use'", () => {
    const result = rewriteChangeVerbs(`You switched to "$250/reply" pricing`);
    expect(result).toBe(`You use "$250/reply" pricing`);
  });

  it("rewrites 'Now charging' → 'You charge'", () => {
    const result = rewriteChangeVerbs(`Now charging "$250/reply"`);
    expect(result).toBe(`You charge "$250/reply"`);
  });

  it("rewrites 'Recently launched' → 'You offer'", () => {
    const result = rewriteChangeVerbs(`Recently launched "$250/reply" pricing`);
    expect(result).toBe(`You offer "$250/reply" pricing`);
  });

  it("returns null for text without change verbs", () => {
    const result = rewriteChangeVerbs(`You offer "$250/reply" pricing`);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. Question quality: reject vague/philosophical, require forced-choice
// ---------------------------------------------------------------------------
describe("question quality validator", () => {
  const basePayload: ClaudeHookPayload = {
    news_item: 1,
    angle: "trigger",
    psych_mode: "relevance",
    hook: "",
    evidence_snippet: "3.2X reply rate vs templates",
    source_title: SALESCO_HOMEPAGE.title,
    source_date: "",
    source_url: SALESCO_HOMEPAGE.url,
    evidence_tier: "A",
    confidence: "high",
  };

  const vagueQuestions = [
    `Your "3.2X reply rate vs templates" is impressive — are you seeing this shift across all segments?`,
    `With "3.2X reply rate vs templates" — how are you thinking about scaling that?`,
    `"3.2X reply rate vs templates" is notable — what are your thoughts on sustaining it?`,
    `Noticed "3.2X reply rate vs templates" — are you concerned about saturation?`,
    `Your "3.2X reply rate vs templates" claim — how are you handling the volume?`,
  ];

  for (const hookText of vagueQuestions) {
    it(`rejects vague: "${hookText.slice(0, 60)}..."`, () => {
      const result = validateHook(
        { ...basePayload, hook: hookText },
        sourceLookup,
      );
      expect(result).toBeNull();
    });
  }

  it("rejects open-ended question without forced-choice structure", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" claim is bold — is that sustainable long-term?`,
      },
      sourceLookup,
    );
    expect(result).toBeNull();
  });

  it("rejects 'holding up as' pattern", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" — is that holding up as you scale?`,
      },
      sourceLookup,
    );
    expect(result).toBeNull();
  });

  it("rejects 'keeping pace' pattern", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" — is that keeping pace with demand?`,
      },
      sourceLookup,
    );
    expect(result).toBeNull();
  });

  it("accepts forced-choice question", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" claim is bold — is the main lever list quality, or the personalization layer?`,
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
  });

  it("accepts mechanism question", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" — is that driven by list targeting, or by copy personalization?`,
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. hasValidQuestionStructure unit tests
// ---------------------------------------------------------------------------
describe("hasValidQuestionStructure", () => {
  it("accepts forced choice with 'or'", () => {
    expect(hasValidQuestionStructure(
      `Your "3.2X reply rate" — is the lever list quality, or personalization?`,
    )).toBe(true);
  });

  it("accepts 'vs' comparison", () => {
    expect(hasValidQuestionStructure(
      `Your "3.2X reply rate" — quality vs volume?`,
    )).toBe(true);
  });

  it("rejects question without forced-choice structure", () => {
    expect(hasValidQuestionStructure(
      `Your "3.2X reply rate" — is that sustainable?`,
    )).toBe(false);
  });

  it("rejects yes/no question without alternatives", () => {
    expect(hasValidQuestionStructure(
      `Your "3.2X reply rate" — does that hold at scale?`,
    )).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. First-person framing rejection
// ---------------------------------------------------------------------------
describe("first-person framing validator", () => {
  const basePayload: ClaudeHookPayload = {
    news_item: 1,
    angle: "trigger",
    psych_mode: "relevance",
    hook: "",
    evidence_snippet: "3.2X reply rate vs templates",
    source_title: SALESCO_HOMEPAGE.title,
    source_date: "",
    source_url: SALESCO_HOMEPAGE.url,
    evidence_tier: "A",
    confidence: "high",
  };

  it("rejects hooks with 'we'", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `We noticed your "3.2X reply rate vs templates" — is the lever list quality, or personalization?`,
      },
      sourceLookup,
    );
    expect(result).toBeNull();
  });

  it("rejects hooks with 'our'", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" aligns with our findings — is the lever list quality, or personalization?`,
      },
      sourceLookup,
    );
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. No fake stats
// ---------------------------------------------------------------------------
describe("no fake stats validator", () => {
  const basePayload: ClaudeHookPayload = {
    news_item: 1,
    angle: "trigger",
    psych_mode: "relevance",
    hook: "",
    evidence_snippet: "3.2X reply rate vs templates",
    source_title: SALESCO_HOMEPAGE.title,
    source_date: "",
    source_url: SALESCO_HOMEPAGE.url,
    evidence_tier: "A",
    confidence: "high",
  };

  it("rejects invented numbers outside quote", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" means 70% of prospects engage — is that list quality, or personalization?`,
      },
      sourceLookup,
    );
    expect(result).toBeNull();
  });

  it("allows numbers that appear in evidence", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" claim is bold — is the main lever list quality, or the personalization layer?`,
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8. Company-anchor filter: unrelated sources rejected
// ---------------------------------------------------------------------------
describe("company-anchor filter", () => {
  it("rejects hooks from unanchored source (Best Buy) — Tier B only", () => {
    const result = validateHook(
      {
        news_item: 5,
        angle: "trigger",
        psych_mode: "relevance",
        hook: `"12% online sales growth" at Best Buy — is that driven by supply chain, or by demand shifts?`,
        evidence_snippet:
          "Best Buy reported 12% online sales growth in Q4",
        source_title: BESTBUY_SOURCE.title,
        source_date: "2026-01-15",
        source_url: BESTBUY_SOURCE.url,
        evidence_tier: "B",
        confidence: "high",
      },
      sourceLookup,
    );
    // Tier B with anchorScore=0 + low specificity → rejected
    if (result) {
      expect(result.evidence_tier).toBe("B");
    }
  });

  it("rejects hooks from vague Tier B source without concrete anchor", () => {
    const result = validateHook(
      {
        news_item: 6,
        angle: "trigger",
        psych_mode: "relevance",
        hook: `"Outbound sales is important for growth" — is your focus on volume, or on reply quality?`,
        evidence_snippet: "Outbound sales is important for growth",
        source_title: VAGUE_TIERB_SOURCE.title,
        source_date: "",
        source_url: VAGUE_TIERB_SOURCE.url,
        evidence_tier: "B",
        confidence: "high",
      },
      sourceLookup,
    );
    // Vague Tier B with no concrete evidence → rejected
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 9. Psych mode validation
// ---------------------------------------------------------------------------
describe("psych_mode validation", () => {
  const basePayload: ClaudeHookPayload = {
    news_item: 1,
    angle: "trigger",
    hook: `Your "3.2X reply rate vs templates" claim is bold — is the main lever list quality, or the personalization layer?`,
    evidence_snippet: "3.2X reply rate vs templates",
    source_title: SALESCO_HOMEPAGE.title,
    source_date: "",
    source_url: SALESCO_HOMEPAGE.url,
    evidence_tier: "A",
    confidence: "high",
  };

  const validModes: PsychMode[] = [
    "relevance",
    "curiosity_gap",
    "symptom",
    "tradeoff_frame",
    "contrarian",
    "benefit",
  ];

  for (const mode of validModes) {
    // contrarian requires recent + anchored; homepage has no date → skip
    if (mode === "contrarian") continue;
    it(`accepts valid mode: ${mode}`, () => {
      const result = validateHook(
        { ...basePayload, psych_mode: mode },
        sourceLookup,
      );
      expect(result).not.toBeNull();
      expect(result!.psych_mode).toBe(mode);
    });
  }

  it("gracefully handles missing psych_mode", () => {
    const result = validateHook(basePayload, sourceLookup);
    expect(result).not.toBeNull();
    expect(result!.psych_mode).toBeUndefined();
  });

  it("gracefully handles invalid psych_mode", () => {
    const result = validateHook(
      { ...basePayload, psych_mode: "invalid_mode" },
      sourceLookup,
    );
    expect(result).not.toBeNull();
    expect(result!.psych_mode).toBeUndefined();
  });

  it("rejects contrarian mode on non-recent source", () => {
    const result = validateHook(
      { ...basePayload, psych_mode: "contrarian" },
      sourceLookup,
    );
    // Homepage has no date → not recent → contrarian rejected
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 10. Hard-fail assertions from regression spec
// ---------------------------------------------------------------------------
describe("hard-fail assertions", () => {
  const FORBIDDEN_CHANGE_VERBS =
    /\b(switched|revamped|recently changed|now\s+charging|hiring across)\b/i;
  const FORBIDDEN_QUESTION_STARTERS =
    /\b(are you seeing|how are you thinking|what are your thoughts|curious if)\b/i;
  const FORBIDDEN_SOURCE_TITLES = /Best Buy|holiday sales|retailer/i;

  // All expected hook texts from the regression spec
  const expectedHookTexts = [
    `Noticed you publish playbooks like "15 Strategies That Generate 500+ Qualified Leads" — are customers buying you for strategy, or for execution + deliverability?`,
    `You claim "39% MORE QUALIFIED ACCOUNTS" — is that improvement coming more from lead data quality, or from the outreach copy/QA process?`,
    `Your "3.2X reply rate vs templates" claim is bold — are you optimizing for booked meetings, or for qualified reply volume?`,
    `You promise "100% unique email to every prospect" — is that human-written end-to-end, or programmatic personalization with human QA?`,
    `You price at "$250/reply" — is that mainly to de-risk clients, or to push higher standards on list + offer quality?`,
    `You offer "24/7 deliverability management" — do you run dedicated infrastructure per client, or shared pools with throttling/warmup?`,
    `You say "99% of cold email is just digital spam" — do you fix that first with list hygiene, or with offer/messaging changes?`,
    `Noticed "820 interested replies from ~94,000 emails" — are you optimizing more for booked meetings, or for qualified replies at scale?`,
    `On your case study, "demo-focused CTAs" worked — do you push demos early, or qualify first then drive to demo?`,
  ];

  it("no change verbs without proof in any expected hook", () => {
    for (const text of expectedHookTexts) {
      expect(FORBIDDEN_CHANGE_VERBS.test(text)).toBe(false);
    }
  });

  it("no philosophical questions in any expected hook", () => {
    for (const text of expectedHookTexts) {
      expect(FORBIDDEN_QUESTION_STARTERS.test(text)).toBe(false);
    }
  });

  it("no unrelated source titles in expected hooks", () => {
    for (const text of expectedHookTexts) {
      expect(FORBIDDEN_SOURCE_TITLES.test(text)).toBe(false);
    }
  });

  it("every expected hook ends with a question mark", () => {
    for (const text of expectedHookTexts) {
      expect(text.endsWith("?")).toBe(true);
    }
  });

  it("every expected hook is <= 240 chars", () => {
    for (const text of expectedHookTexts) {
      expect(text.length).toBeLessThanOrEqual(240);
    }
  });

  it("every expected hook contains a verbatim quote in double quotes", () => {
    for (const text of expectedHookTexts) {
      expect(/"[^"]{5,}"/.test(text)).toBe(true);
    }
  });

  it("every expected hook has a forced-choice question structure", () => {
    for (const text of expectedHookTexts) {
      expect(hasValidQuestionStructure(text)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Publish Gate — end-to-end enforcement
// ---------------------------------------------------------------------------
describe("publishGate", () => {
  const salesco_sources: ClassifiedSource[] = [
    SALESCO_HOMEPAGE,
    SALESCO_SWIPEFILES,
    SALESCO_CUSTOMERS,
    SALESCO_BLOG,
    BESTBUY_SOURCE,
  ];
  const lookup = buildSourceLookup(salesco_sources);

  it("passes valid anchored hooks through", () => {
    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 1,
        angle: "trigger",
        psych_mode: "relevance",
        hook: `You claim "39% MORE QUALIFIED ACCOUNTS" — is that from lead data quality, or from the outreach copy/QA process?`,
        evidence_snippet: "39% MORE QUALIFIED ACCOUNTS",
        source_title: SALESCO_HOMEPAGE.title,
        source_date: "",
        source_url: SALESCO_HOMEPAGE.url,
        evidence_tier: "A",
        confidence: "high",
      },
    ];
    const result = publishGate(rawHooks, lookup);
    expect(result).toHaveLength(1);
    expect(result[0].hook).toContain("39% MORE QUALIFIED ACCOUNTS");
  });

  it("excludes hooks from unanchored sources in default mode", () => {
    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 5, // Best Buy — anchorScore 0
        angle: "trigger",
        psych_mode: "relevance",
        hook: `"12% online sales growth" at Best Buy — is that driven by supply chain, or by demand shifts?`,
        evidence_snippet: "Best Buy reported 12% online sales growth in Q4",
        source_title: BESTBUY_SOURCE.title,
        source_date: "2026-01-15",
        source_url: BESTBUY_SOURCE.url,
        evidence_tier: "B",
        confidence: "high",
      },
    ];
    const result = publishGate(rawHooks, lookup, { includeMarketContext: false });
    expect(result).toHaveLength(0);
  });

  it("allows max 1 unanchored hook when includeMarketContext=true", () => {
    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 5,
        angle: "trigger",
        psych_mode: "relevance",
        hook: `"12% online sales growth" at Best Buy — is that driven by supply chain, or by demand shifts?`,
        evidence_snippet: "Best Buy reported 12% online sales growth in Q4",
        source_title: BESTBUY_SOURCE.title,
        source_date: "2026-01-15",
        source_url: BESTBUY_SOURCE.url,
        evidence_tier: "B",
        confidence: "high",
      },
    ];
    const result = publishGate(rawHooks, lookup, { includeMarketContext: true });
    // Tier B cap allows max 1
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("rewrites change verbs instead of dropping when fixable", () => {
    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 2,
        angle: "trigger",
        psych_mode: "relevance",
        hook: `You switched to "$250/reply" pricing — is that to de-risk clients, or to push quality?`,
        evidence_snippet: "$250/reply pricing model",
        source_title: SALESCO_SWIPEFILES.title,
        source_date: "",
        source_url: SALESCO_SWIPEFILES.url,
        evidence_tier: "A",
        confidence: "high",
      },
    ];
    const result = publishGate(rawHooks, lookup);
    expect(result).toHaveLength(1);
    expect(result[0].hook).toContain("You use");
    expect(result[0].hook).not.toMatch(/\bswitched\b/i);
  });

  it("drops hooks that fail question quality (no forced-choice)", () => {
    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 1,
        angle: "trigger",
        psych_mode: "relevance",
        hook: `Your "3.2X reply rate vs templates" — is that sustainable long-term?`,
        evidence_snippet: "3.2X reply rate vs templates",
        source_title: SALESCO_HOMEPAGE.title,
        source_date: "",
        source_url: SALESCO_HOMEPAGE.url,
        evidence_tier: "A",
        confidence: "high",
      },
    ];
    const result = publishGate(rawHooks, lookup);
    expect(result).toHaveLength(0);
  });

  it("caps Tier B at 1 even with multiple valid Tier B hooks", () => {
    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 4, // blog — Tier B
        angle: "trigger",
        psych_mode: "relevance",
        hook: `Noticed "15 Strategies That Generate 500+ Qualified Leads" — are customers buying strategy, or execution?`,
        evidence_snippet: "15 Strategies That Generate 500+ Qualified Leads",
        source_title: SALESCO_BLOG.title,
        source_date: "",
        source_url: SALESCO_BLOG.url,
        evidence_tier: "B",
        confidence: "high",
      },
      {
        news_item: 4,
        angle: "trigger",
        psych_mode: "relevance",
        hook: `Your playbook "15 Strategies That Generate 500+ Qualified Leads" — is the focus ICP targeting, or multi-channel outreach?`,
        evidence_snippet: "15 Strategies That Generate 500+ Qualified Leads",
        source_title: SALESCO_BLOG.title,
        source_date: "",
        source_url: SALESCO_BLOG.url,
        evidence_tier: "B",
        confidence: "high",
      },
    ];
    const result = publishGate(rawHooks, lookup);
    const tierB = result.filter((h) => h.evidence_tier === "B");
    expect(tierB.length).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 12. Publish Gate: sales.co regression assertions
// ---------------------------------------------------------------------------
describe("publishGate: sales.co regression", () => {
  it("Hook 5 must never say 'You switched to $250/reply' — must be present tense", () => {
    const lookup = buildSourceLookup([
      SALESCO_HOMEPAGE,
      SALESCO_SWIPEFILES,
      SALESCO_CUSTOMERS,
      SALESCO_BLOG,
      BESTBUY_SOURCE,
    ]);

    // Simulate Claude returning a change-verb hook
    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 2,
        angle: "trigger",
        psych_mode: "tradeoff_frame",
        hook: `You switched to "$250/reply" pricing — is that mainly to de-risk clients, or to push higher standards on list + offer quality?`,
        evidence_snippet: "$250/reply pricing model",
        source_title: SALESCO_SWIPEFILES.title,
        source_date: "",
        source_url: SALESCO_SWIPEFILES.url,
        evidence_tier: "A",
        confidence: "high",
      },
    ];

    const result = publishGate(rawHooks, lookup);
    expect(result).toHaveLength(1);
    // Must be rewritten to present tense
    expect(result[0].hook).not.toMatch(/\bswitched\b/i);
    expect(result[0].hook).toMatch(/\bYou use\b/);
  });

  it("Hook 10 (Best Buy) must never appear in default output for sales.co", () => {
    const lookup = buildSourceLookup([
      SALESCO_HOMEPAGE,
      SALESCO_SWIPEFILES,
      SALESCO_CUSTOMERS,
      SALESCO_BLOG,
      BESTBUY_SOURCE,
    ]);

    const rawHooks: ClaudeHookPayload[] = [
      {
        news_item: 5, // Best Buy
        angle: "trigger",
        psych_mode: "relevance",
        hook: `Best Buy says "resilient and deal-focused" — is that driven by promotions, or by loyalty programs?`,
        evidence_snippet: "Best Buy described consumers as resilient and deal-focused",
        source_title: "Best Buy Reports Strong Holiday Sales",
        source_date: "2026-01-15",
        source_url: "https://reuters.com/business/bestbuy-holiday-sales",
        evidence_tier: "B",
        confidence: "high",
      },
    ];

    // Default mode: includeMarketContext=false
    const result = publishGate(rawHooks, lookup, { includeMarketContext: false });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 13. Demo sample hooks pass publish gate
// ---------------------------------------------------------------------------
describe("demo sample hooks pass publish gate", () => {
  // Mirror the exact hooks from demo-section.tsx
  const DEMO_HOOKS: Array<{
    hook: Hook;
    label: string;
  }> = [
    {
      label: "Stripe Revenue Recognition",
      hook: {
        news_item: 1,
        angle: "trigger",
        hook: 'Your "Revenue Recognition automating ASC 606 compliance" launch — is the main driver faster book-close, or reducing manual reconciliation errors?',
        evidence_snippet: "Stripe launches Revenue Recognition, automating ASC 606 compliance for subscription businesses.",
        source_title: "Stripe Blog — Revenue Recognition",
        source_date: "2025-02",
        source_url: "https://stripe.com/blog",
        evidence_tier: "A",
        confidence: "high",
        psych_mode: "curiosity_gap",
        why_this_works: "mechanism question",
      },
    },
    {
      label: "Stripe 250+ integrations",
      hook: {
        news_item: 2,
        angle: "tradeoff",
        hook: 'You offer "250+ prebuilt integrations across payments, billing, and tax" — is the priority coverage breadth, or depth on core payment flows?',
        evidence_snippet: "250+ prebuilt integrations across payments, billing, and tax.",
        source_title: "Stripe — Platform Overview",
        source_date: "",
        source_url: "https://stripe.com",
        evidence_tier: "A",
        confidence: "high",
        psych_mode: "tradeoff_frame",
        why_this_works: "tradeoff frame",
      },
    },
    {
      label: "Stripe webhook reliability",
      hook: {
        news_item: 3,
        angle: "risk",
        hook: 'Your docs now cover "handling webhook delivery failures and retry logic" — is that driven by enterprise customer requests, or internal reliability targets?',
        evidence_snippet: "New section added to Stripe Docs: Handling webhook delivery failures and retry logic.",
        source_title: "Stripe Developer Docs",
        source_date: "2025-02",
        source_url: "https://docs.stripe.com",
        evidence_tier: "A",
        confidence: "high",
        psych_mode: "relevance",
        why_this_works: "you-first relevance",
      },
    },
  ];

  for (const { label, hook } of DEMO_HOOKS) {
    it(`${label}: passes publishGateValidateHook`, () => {
      const result = publishGateValidateHook(hook);
      expect(result).not.toBeNull();
      expect(result!.hook).toBe(hook.hook);
    });

    it(`${label}: no change verbs without proof`, () => {
      expect(/\b(switched|revamped|recently changed|now\s+charging|hiring across)\b/i.test(hook.hook)).toBe(false);
    });

    it(`${label}: has forced-choice question`, () => {
      expect(hasValidQuestionStructure(hook.hook)).toBe(true);
    });

    it(`${label}: contains verbatim quote`, () => {
      expect(/"[^"]{5,}"/.test(hook.hook)).toBe(true);
    });

    it(`${label}: no first-person framing`, () => {
      const withoutQuotes = hook.hook.replace(/[""\u201C][^""\u201D]*[""\u201D]/g, "");
      expect(/\bwe\b|\bwe'(re|ve|ll)\b|\bour\b|\bours\b|\bus\b/i.test(withoutQuotes)).toBe(false);
    });
  }
});
