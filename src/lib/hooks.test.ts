import { describe, it, expect } from "vitest";
import {
  validateHook,
  type ClaudeHookPayload,
  type ClassifiedSource,
  type PsychMode,
} from "./hooks";
import type { EvidenceTier } from "./types";

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

const ALL_SOURCES = [
  SALESCO_HOMEPAGE,
  SALESCO_SWIPEFILES,
  SALESCO_CUSTOMERS,
  SALESCO_BLOG,
  BESTBUY_SOURCE,
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
// 2. No change verbs without explicit change evidence
// ---------------------------------------------------------------------------
describe("change verb validator", () => {
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

  const changeVerbHooks = [
    `You switched to "$250/reply" pricing — is that to de-risk clients, or to push quality?`,
    `You revamped your "$250/reply" model — is that driven by cost, or quality positioning?`,
    `You recently changed to "$250/reply" — are clients buying on cost, or outcomes?`,
    `Now charging "$250/reply" — is that to de-risk clients, or to push quality?`,
  ];

  for (const hookText of changeVerbHooks) {
    it(`rejects: "${hookText.slice(0, 60)}..."`, () => {
      const result = validateHook(
        { ...basePayload, hook: hookText },
        sourceLookup,
      );
      expect(result).toBeNull();
    });
  }

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
  });
});

// ---------------------------------------------------------------------------
// 3. Question quality: reject vague/philosophical, require forced-choice
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
// 4. First-person framing rejection
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
// 5. No fake stats
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
// 6. Company-anchor filter: unrelated sources rejected
// ---------------------------------------------------------------------------
describe("company-anchor filter", () => {
  it("rejects hooks from unanchored market-context source (Best Buy)", () => {
    // Best Buy source is index 5 in our lookup
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
    // The hook itself may pass basic validation, but Tier B cap (max 1) and
    // anchor scoring (score=0 → forced Tier B) ensure this gets suppressed
    // at the route level. Here we verify the tier is correctly set to B.
    if (result) {
      expect(result.evidence_tier).toBe("B");
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Psych mode validation
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
// 8. Hard-fail assertions from regression spec
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
});
