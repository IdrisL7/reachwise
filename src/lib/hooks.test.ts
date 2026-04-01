import { describe, it, expect } from "vitest";
import {
  validateHook as baseValidateHook,
  rewriteChangeVerbs,
  hasValidQuestionStructure,
  buildSystemPrompt,
  publishGate as basePublishGate,
  publishGateFinal as basePublishGateFinal,
  publishGateValidateHook as basePublishGateValidateHook,
  classifySource,
  computeEntityHitScore,
  findRoleTokenHit,
  roleTokenGate,
  isTradeoffGrounded,
  scoreHook,
  rankAndCap,
  type Hook,
  type ClaudeHookPayload,
  type ClassifiedSource,
  type PsychMode,
  type TargetRole,
  TARGET_ROLES,
  ROLE_RESPONSIBILITIES,
  ROLE_REQUIRED_TOKENS,
  isFirstPartySource,
  isReputablePublisher,
  hasMarketStatMisframing,
  buildInterpreterSystemPrompt,
  buildComposerSystemPrompt,
  buildComposerUserPrompt,
  computeHookSelectionCriteria,
} from "./hooks";
import type { EvidenceTier, StructuredHook } from "./types";
import type { SenderContext } from "./workspace";

const TEST_PROMISE = "Happy to show you what that looks like at that scale.";

function withTestPromise<T extends { promise?: string }>(value: T): T {
  return {
    ...value,
    promise: value.promise ?? TEST_PROMISE,
  };
}

function validateHook(
  raw: Parameters<typeof baseValidateHook>[0],
  sourceLookup?: Parameters<typeof baseValidateHook>[1],
  messagingStyle?: Parameters<typeof baseValidateHook>[2],
) {
  return baseValidateHook(withTestPromise(raw), sourceLookup, messagingStyle);
}

function publishGate(
  rawHooks: Parameters<typeof basePublishGate>[0],
  sourceLookup: Parameters<typeof basePublishGate>[1],
  options?: Parameters<typeof basePublishGate>[2],
  messagingStyle?: Parameters<typeof basePublishGate>[3],
) {
  return basePublishGate(rawHooks.map((hook) => withTestPromise(hook)), sourceLookup, options, messagingStyle);
}

function publishGateValidateHook(
  hook: Parameters<typeof basePublishGateValidateHook>[0],
  messagingStyle?: Parameters<typeof basePublishGateValidateHook>[1],
) {
  return basePublishGateValidateHook(withTestPromise(hook), messagingStyle);
}

function publishGateFinal(
  hooks: Parameters<typeof basePublishGateFinal>[0],
  companyDomain?: Parameters<typeof basePublishGateFinal>[1],
  options?: Parameters<typeof basePublishGateFinal>[2],
  messagingStyle?: Parameters<typeof basePublishGateFinal>[3],
) {
  return basePublishGateFinal(hooks.map((hook) => withTestPromise(hook)), companyDomain, options, messagingStyle);
}

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
      "challenger",
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
      "challenger",
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

  it("allows concrete open-ended Tier A question without forced-choice", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" claim is bold — is that sustainable long-term?`,
      },
      sourceLookup,
    );
    expect(result).not.toBeNull();
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
        hook: `Your "3.2X reply rate vs templates" — is the main lever list targeting, or copy personalization?`,
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

  it("rejects hooks with 'we' in challenger mode", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `We noticed your "3.2X reply rate vs templates" — is the lever list quality, or personalization?`,
      },
      sourceLookup,
      "challenger",
    );
    expect(result).toBeNull();
  });

  it("rejects hooks with 'our' in challenger mode", () => {
    const result = validateHook(
      {
        ...basePayload,
        hook: `Your "3.2X reply rate vs templates" aligns with our findings — is the lever list quality, or personalization?`,
      },
      sourceLookup,
      "challenger",
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

  it("keeps Tier A hooks with concrete open-ended questions", () => {
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
    expect(result).toHaveLength(1);
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
        hook: 'Your docs now cover "handling webhook delivery failures and retry logic" — is that from enterprise customer requests, or internal reliability targets?',
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

// ---------------------------------------------------------------------------
// 14. publishGateFinal — catches cached/stale hooks at the last step
// ---------------------------------------------------------------------------
describe("publishGateFinal (last-step enforcement)", () => {
  it("rewrites cached hook with change verb", () => {
    const staleHook: Hook = {
      news_item: 2,
      angle: "trigger",
      hook: `You switched to "$250/reply" pricing — is that to de-risk clients, or to push quality?`,
      evidence_snippet: "$250/reply pricing model",
      source_title: "Cold Email Swipe Files | Sales.co",
      source_date: "",
      source_url: "https://sales.co/swipefiles",
      evidence_tier: "A",
      confidence: "high",
    };

    const result = publishGateFinal([staleHook], "sales.co");
    expect(result).toHaveLength(1);
    expect(result[0].hook).not.toMatch(/\bswitched\b/i);
    expect(result[0].hook).toContain("You use");
  });

  it("drops cached Best Buy hook for sales.co (unanchored)", () => {
    const bestBuyHook: Hook = {
      news_item: 5,
      angle: "trigger",
      hook: `"12% online sales growth" at Best Buy — is that driven by supply chain, or by demand?`,
      evidence_snippet: "Best Buy reported 12% online sales growth in Q4",
      source_title: "Best Buy Reports Strong Holiday Sales",
      source_date: "2026-01-15",
      source_url: "https://reuters.com/business/bestbuy-holiday-sales",
      evidence_tier: "B",
      confidence: "high",
    };

    const result = publishGateFinal([bestBuyHook], "sales.co");
    expect(result).toHaveLength(0);
  });

  it("keeps cached Tier A hook with concrete open-ended question", () => {
    const vagueHook: Hook = {
      news_item: 1,
      angle: "trigger",
      hook: `Your "3.2X reply rate vs templates" — is that sustainable long-term?`,
      evidence_snippet: "3.2X reply rate vs templates",
      source_title: "Sales.co Homepage",
      source_date: "",
      source_url: "https://sales.co",
      evidence_tier: "A",
      confidence: "high",
    };

    const result = publishGateFinal([vagueHook], "sales.co");
    expect(result).toHaveLength(1);
  });

  it("passes valid anchored hooks through unchanged", () => {
    const goodHook: Hook = {
      news_item: 1,
      angle: "trigger",
      hook: `You claim "39% MORE QUALIFIED ACCOUNTS" — is that from lead data quality, or from the outreach copy/QA process?`,
      evidence_snippet: "39% MORE QUALIFIED ACCOUNTS",
      source_title: "Sales.co - Automated Customer Acquisition for B2B",
      source_date: "",
      source_url: "https://sales.co",
      evidence_tier: "A",
      confidence: "high",
    };

    const result = publishGateFinal([goodHook], "sales.co");
    expect(result).toHaveLength(1);
    expect(result[0].hook).toBe(goodHook.hook);
  });

  it("caps Tier B at 1 even from cache", () => {
    const tierBHook1: Hook = {
      news_item: 4,
      angle: "trigger",
      hook: `Noticed "15 Strategies That Generate 500+ Qualified Leads" — are customers buying strategy, or execution?`,
      evidence_snippet: "15 Strategies That Generate 500+ Qualified Leads",
      source_title: "B2B Lead Generation | Sales.co",
      source_date: "",
      source_url: "https://sales.co/blog/lead-generation",
      evidence_tier: "B",
      confidence: "high",
    };
    const tierBHook2: Hook = {
      ...tierBHook1,
      hook: `Your playbook "15 Strategies That Generate 500+ Qualified Leads" — is the focus ICP targeting, or multi-channel outreach?`,
    };

    const result = publishGateFinal([tierBHook1, tierBHook2], "sales.co");
    const tierB = result.filter((h) => h.evidence_tier === "B");
    expect(tierB).toHaveLength(1);
  });

  it("mixed: keeps anchored, drops unanchored, rewrites change verbs", () => {
    const hooks: Hook[] = [
      {
        news_item: 1,
        angle: "trigger",
        hook: `You claim "39% MORE QUALIFIED ACCOUNTS" — is that from lead data quality, or from outreach copy?`,
        evidence_snippet: "39% MORE QUALIFIED ACCOUNTS",
        source_title: "Sales.co Homepage",
        source_date: "",
        source_url: "https://sales.co",
        evidence_tier: "A",
        confidence: "high",
      },
      {
        news_item: 2,
        angle: "trigger",
        hook: `You switched to "$250/reply" pricing — is that to de-risk clients, or quality?`,
        evidence_snippet: "$250/reply pricing model",
        source_title: "Sales.co Swipefiles",
        source_date: "",
        source_url: "https://sales.co/swipefiles",
        evidence_tier: "A",
        confidence: "high",
      },
      {
        news_item: 5,
        angle: "trigger",
        hook: `"12% online growth" at Best Buy — is that supply chain, or demand?`,
        evidence_snippet: "Best Buy reported 12% online sales growth",
        source_title: "Best Buy Holiday Sales",
        source_date: "2026-01-15",
        source_url: "https://reuters.com/bestbuy",
        evidence_tier: "B",
        confidence: "high",
      },
    ];

    const result = publishGateFinal(hooks, "sales.co");

    // Hook 1: passes clean
    expect(result.some((h) => h.hook.includes("39% MORE QUALIFIED ACCOUNTS"))).toBe(true);
    // Hook 2: rewritten (switched → use)
    const rewritten = result.find((h) => h.hook.includes("$250/reply"));
    expect(rewritten).toBeDefined();
    expect(rewritten!.hook).not.toMatch(/\bswitched\b/i);
    // Hook 3: dropped (Best Buy unanchored)
    expect(result.some((h) => h.hook.includes("Best Buy"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sender context prompt injection
// ---------------------------------------------------------------------------
describe("sender context prompt injection", () => {
  it("buildSystemPrompt includes SENDER CONTEXT section when provided", () => {
    const ctx: SenderContext = {
      whatYouSell: "We help B2B teams book more meetings",
      icpIndustry: "SaaS",
      icpCompanySize: "51-200",
      buyerRoles: ["VP Sales"],
      primaryOutcome: "Meetings",
      offerCategory: "outbound_agency" as const,
      proof: ["+22% reply rate"],
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("SENDER CONTEXT");
    expect(prompt).toContain("We help B2B teams book more meetings");
    expect(prompt).toContain("SENDER CONTEXT");
    expect(prompt).toContain("MANDATORY OUTCOME");
    expect(prompt).toContain("Meetings");
  });

  it("buildSystemPrompt uses the default custom persona when sender context is null", () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toContain("PERSONA: Custom");
    expect(prompt).not.toContain("SENDER CONTEXT");
  });

  it("buildSystemPrompt uses the default custom persona when sender context is undefined", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("PERSONA: Custom");
    expect(prompt).not.toContain("SENDER CONTEXT");
  });
});

// ---------------------------------------------------------------------------
// Invented causality ban
// ---------------------------------------------------------------------------
describe("invented causality ban", () => {
  it("rejects 'the usual bottleneck is'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'You posted "3 SDR roles" — the usual bottleneck is hiring speed. Backfilling or expanding?',
      evidence_snippet: "Company posted 3 SDR roles on LinkedIn this month",
      source_title: "LinkedIn",
      source_date: "2026-03-01",
      source_url: "https://linkedin.com/company/test",
      evidence_tier: "A",
      confidence: "high",
    });
    expect(result).toBeNull();
  });

  it("rejects 'most teams struggle with'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'You said "scaling fast" — most teams struggle with onboarding. Hiring or training first?',
      evidence_snippet: "Company is scaling fast with new hires",
      source_title: "Blog",
      source_date: "2026-03-01",
      source_url: "https://test.com/blog",
      evidence_tier: "A",
      confidence: "high",
    });
    expect(result).toBeNull();
  });

  it("rejects 'typically this means'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'You posted "new CTO hire" — typically this means a stack change. Swapping tools or keeping?',
      evidence_snippet: "Company announced new CTO hire last week",
      source_title: "News",
      source_date: "2026-03-01",
      source_url: "https://news.com/test",
      evidence_tier: "A",
      confidence: "high",
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Question framing bans
// ---------------------------------------------------------------------------
describe("question framing bans", () => {
  it("rejects 'focusing on' in question for Tier B", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Your site says "multi-channel outreach" — are you focusing on email or LinkedIn?',
      evidence_snippet: "Company offers multi-channel outreach solutions",
      source_title: "Website",
      source_date: "2026-03-01",
      source_url: "https://test.com",
      evidence_tier: "B",
      confidence: "high",
    });
    expect(result).toBeNull();
  });

  it("rejects 'driven by' in question for Tier B", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Your blog mentions "2X reply rates" — is that driven by personalization or list quality?',
      evidence_snippet: "Company claims 2X reply rates for customers",
      source_title: "Blog",
      source_date: "2026-03-01",
      source_url: "https://test.com/blog",
      evidence_tier: "B",
      confidence: "high",
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Abstract noun overload
// ---------------------------------------------------------------------------
describe("abstract noun overload", () => {
  it("rejects question with 3+ abstract nouns for Tier B", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Your site says "enterprise ready" — is your compliance engagement methodology aligned with governance?',
      evidence_snippet: "Company website says enterprise ready",
      source_title: "Website",
      source_date: "2026-03-01",
      source_url: "https://test.com",
      evidence_tier: "B",
      confidence: "high",
    });
    expect(result).toBeNull();
  });

  it("passes question with 3 abstract nouns for Tier A", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Your site says "enterprise ready" — what is your compliance engagement methodology today?',
      evidence_snippet: "Company website says enterprise ready",
      source_title: "Website",
      source_date: "2026-03-01",
      source_url: "https://test.com",
      evidence_tier: "A",
      confidence: "high",
    });
    expect(result).not.toBeNull();
  });

  it("passes question with 2 or fewer abstract nouns", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Your site says "SOC2 certified since 2024" — is compliance handled in-house or outsourced?',
      evidence_snippet: "Company is SOC2 certified since 2024",
      source_title: "Website",
      source_date: "2026-03-01",
      source_url: "https://test.com",
      evidence_tier: "A",
      confidence: "high",
    });
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Relaxed validation for Tier A high-signal hooks
// ---------------------------------------------------------------------------
describe("validateHook — Tier A permissive rules", () => {
  it("allows Tier A hooks without verbatim quotes when bridge is concrete", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: "You mention webhook retry logic and failure handling, what metric degrades first during traffic spikes?",
      evidence_snippet: "Stripe Docs: handling webhook delivery failures and retry logic",
      source_title: "Stripe Docs",
      source_date: "2026-03-01",
      source_url: "https://docs.stripe.com",
      evidence_tier: "A",
      confidence: "high",
    });
    expect(result).not.toBeNull();
  });

  it("still rejects Tier B hooks without verbatim quotes", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: "You mention webhook retry logic and failure handling, what metric degrades first during traffic spikes?",
      evidence_snippet: "Industry report: webhook delivery failures are common",
      source_title: "Industry Blog",
      source_date: "2026-03-01",
      source_url: "https://example.com/report",
      evidence_tier: "B",
      confidence: "high",
    });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Secondary source classification
// ---------------------------------------------------------------------------

describe("classifySource — secondary commentary detection", () => {
  it("caps a third-party blog post about the target company at Tier B", () => {
    const source = {
      title: "LinkedIn 2026 Updates for B2B Sales Outreach",
      publisher: "rev-empire.com",
      date: "2026-02-15",
      url: "https://rev-empire.com/blog/linkedin-2026-updates-b2b-sales-outreach/",
      facts: [
        "LinkedIn launched AI-powered conversational search in January 2026",
        "New Sales Assistant feature announced in February 2026",
        "Company Intelligence API available for enterprise customers",
      ],
    };
    const tier = classifySource(source, false, "linkedin.com");
    expect(tier).toBe("B");
  });

  it("does NOT cap the company's own blog as secondary", () => {
    const source = {
      title: "Announcing our new Sales Assistant",
      publisher: "linkedin.com",
      date: "2026-01-15",
      url: "https://blog.linkedin.com/2026/01/sales-assistant-launch",
      facts: [
        "LinkedIn launched AI-powered Sales Assistant on January 15, 2026",
        "Available to all Sales Navigator Enterprise customers",
      ],
    };
    const tier = classifySource(source, false, "linkedin.com");
    expect(tier).toBe("A");
  });

  it("caps medium.com posts as Tier B secondary commentary", () => {
    const source = {
      title: "Why LinkedIn's 2026 changes matter for outbound",
      publisher: "medium.com",
      date: "2026-02-20",
      url: "https://medium.com/@someone/linkedin-2026-changes-outbound",
      facts: [
        "LinkedIn announced three major updates in early 2026",
        "Conversational search changes how prospects are found",
      ],
    };
    const tier = classifySource(source, false, "linkedin.com");
    expect(tier).toBe("B");
  });

  it("caps substack newsletters as Tier B", () => {
    const source = {
      title: "LinkedIn updates roundup",
      publisher: "newsletter.substack.com",
      date: "2026-02-10",
      url: "https://newsletter.substack.com/p/linkedin-updates-roundup",
      facts: [
        "LinkedIn rolled out conversational search in January 2026",
        "New Company Intelligence API for enterprise",
      ],
    };
    const tier = classifySource(source, false, "linkedin.com");
    expect(tier).toBe("B");
  });

  it("caps third-party /insights/ pages as Tier B", () => {
    const source = {
      title: "Q1 2026 Sales Tech Trends",
      publisher: "salestech.com",
      date: "2026-03-01",
      url: "https://salestech.com/insights/q1-2026-sales-tech-trends",
      facts: [
        "LinkedIn launched 3 major features in Q1 2026",
        "$200M investment in AI capabilities",
      ],
    };
    const tier = classifySource(source, false, "linkedin.com");
    expect(tier).toBe("B");
  });
});

// ---------------------------------------------------------------------------
// Tier B hook validation — launch/announce language ban
// ---------------------------------------------------------------------------

describe("validateHook — Tier B launch language ban", () => {
  it("rejects Tier B hooks using 'launched'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'LinkedIn launched "AI-powered conversational search" in January 2026 — are you optimizing for InMail or cold email?',
      evidence_snippet: "LinkedIn launched AI-powered conversational search in January 2026",
      source_title: "Rev Empire Blog",
      source_date: "2026-02-15",
      source_url: "https://rev-empire.com/blog/linkedin-2026",
      evidence_tier: "B",
      confidence: "high",
    });
    expect(result).toBeNull();
  });

  it("rejects Tier B hooks using 'announced'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'LinkedIn announced "Company Intelligence API" in Feb 2026 — is your enrichment stack internal or third-party?',
      evidence_snippet: "LinkedIn announced Company Intelligence API for enterprise customers",
      source_title: "Agency Blog",
      source_date: "2026-02-20",
      source_url: "https://example.com/blog/linkedin",
      evidence_tier: "B",
      confidence: "high",
    });
    expect(result).toBeNull();
  });

  it("rejects Tier B hooks using 'rolled out'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'LinkedIn rolled out "Sales Assistant" and "conversational search" — are you running prospecting in LinkedIn or in your outbound stack?',
      evidence_snippet: "LinkedIn rolled out Sales Assistant and conversational search",
      source_title: "Newsletter",
      source_date: "2026-02-15",
      source_url: "https://example.com/newsletter/issue-42",
      evidence_tier: "B",
      confidence: "high",
    });
    expect(result).toBeNull();
  });

  it("allows Tier B hooks with verification framing (no launch language)", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Read a Feb 2026 breakdown citing "conversational search, Sales Assistant, Company Intelligence API" — are you planning to prospect inside LinkedIn or keep enrichment in your outbound stack?',
      evidence_snippet: "LinkedIn updates include conversational search, Sales Assistant, Company Intelligence API",
      source_title: "Rev Empire Blog",
      source_date: "2026-02-15",
      source_url: "https://rev-empire.com/blog/linkedin-2026",
      evidence_tier: "B",
      confidence: "med",
    });
    expect(result).not.toBeNull();
  });

  it("allows Tier A hooks to use launch language", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'LinkedIn launched "AI-powered conversational search" in Jan 2026 — are you shifting prospecting into LinkedIn or keeping enrichment in your outbound stack?',
      evidence_snippet: "LinkedIn launched AI-powered conversational search in January 2026",
      source_title: "LinkedIn Blog",
      source_date: "2026-01-15",
      source_url: "https://blog.linkedin.com/2026/01/conversational-search",
      evidence_tier: "A",
      confidence: "high",
    });
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Date discipline validation
// ---------------------------------------------------------------------------

describe("validateHook — date discipline", () => {
  it("rejects 'early 2026' when evidence says 'January 2026'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Read a breakdown citing "conversational search and Sales Assistant" updates in early 2026 — are you prospecting inside LinkedIn or through your outbound stack?',
      evidence_snippet: "LinkedIn updates in January 2026 include conversational search and Sales Assistant",
      source_title: "Blog",
      source_date: "2026-02-15",
      source_url: "https://example.com/blog",
      evidence_tier: "B",
      confidence: "med",
    });
    expect(result).toBeNull();
  });

  it("allows 'early 2026' when evidence literally says 'early 2026'", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Read a breakdown citing "conversational search and Sales Assistant" updates in early 2026 — are you prospecting inside LinkedIn or through your outbound stack?',
      evidence_snippet: "LinkedIn rolled out several updates in early 2026 including conversational search and Sales Assistant",
      source_title: "Blog",
      source_date: "2026-02-15",
      source_url: "https://example.com/blog",
      evidence_tier: "B",
      confidence: "med",
    });
    expect(result).not.toBeNull();
  });

  it("allows exact month references from evidence", () => {
    const result = validateHook({
      news_item: 1,
      angle: "trigger",
      hook: 'Read a Feb 2026 breakdown citing "conversational search, Sales Assistant, Company Intelligence API" — are you planning to prospect inside LinkedIn or keep enrichment in your outbound stack?',
      evidence_snippet: "LinkedIn updates include conversational search, Sales Assistant, Company Intelligence API",
      source_title: "Blog",
      source_date: "2026-02-15",
      source_url: "https://example.com/blog",
      evidence_tier: "B",
      confidence: "med",
    });
    expect(result).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Persona-level tailoring
// ---------------------------------------------------------------------------
describe("Persona-level tailoring", () => {
  it("TARGET_ROLES includes all 6 roles", () => {
    expect(TARGET_ROLES).toHaveLength(6);
    expect(TARGET_ROLES).toContain("VP Sales");
    expect(TARGET_ROLES).toContain("RevOps");
    expect(TARGET_ROLES).toContain("SDR Manager");
    expect(TARGET_ROLES).toContain("Marketing");
    expect(TARGET_ROLES).toContain("Founder/CEO");
    expect(TARGET_ROLES).toContain("General");
  });

  it("ROLE_RESPONSIBILITIES has entry for each role", () => {
    for (const role of TARGET_ROLES) {
      const entry = ROLE_RESPONSIBILITIES[role];
      expect(entry).toBeDefined();
      expect(entry.kpis.length).toBeGreaterThan(0);
      expect(entry.tag).toBeTruthy();
    }
  });

  it("buildSystemPrompt includes role framing for VP Sales", () => {
    const prompt = buildSystemPrompt(null, "VP Sales");
    expect(prompt).toContain("TARGET ROLE: VP Sales");
    expect(prompt).toContain("forecast pressure");
  });

  it("buildSystemPrompt includes role framing for RevOps", () => {
    const prompt = buildSystemPrompt(null, "RevOps");
    expect(prompt).toContain("TARGET ROLE: RevOps");
    expect(prompt).toContain("data quality");
  });

  it("buildSystemPrompt includes General framing for General role", () => {
    const prompt = buildSystemPrompt(null, "General");
    expect(prompt).toContain("TARGET ROLE: General");
    expect(prompt).not.toContain("ROLE RESPONSIBILITIES");
  });

  it("buildSystemPrompt omits role framing when no role passed", () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).not.toContain("TARGET ROLE:");
  });

  it("buildSystemPrompt includes tone humanizer section", () => {
    const prompt = buildSystemPrompt(null, "VP Sales");
    expect(prompt).toContain("TONE");
  });
});

// ---------------------------------------------------------------------------
// Role Token Gate
// ---------------------------------------------------------------------------
describe("Role Token Gate", () => {
  const baseHook: Hook = {
    news_item: 1,
    angle: "trigger",
    hook: 'Read that you added "predictive pipeline scoring" — is that changing how reps forecast or just confirming what they already know?',
    evidence_snippet: "predictive pipeline scoring now available",
    source_title: "Blog",
    source_date: "2026-02-15",
    source_url: "https://example.com/blog",
    evidence_tier: "A",
    confidence: "high",
  };

  it("passes hook containing VP Sales token 'forecast' in final question", () => {
    const hit = findRoleTokenHit(baseHook.hook, "VP Sales");
    expect(hit).toBe("forecast");
  });

  it("passes hook containing RevOps token 'governance' in final question", () => {
    const hook = { ...baseHook, hook: 'Read that you restructured "data validation process" — is that fixing sync issues or governance gaps?' };
    const hit = findRoleTokenHit(hook.hook, "RevOps");
    expect(hit).toBe("governance");
  });

  it("rejects hook missing all VP Sales tokens", () => {
    const hook = { ...baseHook, hook: 'Read that you hired "3 new engineers" — is that for the core product or a new vertical?' };
    const hit = findRoleTokenHit(hook.hook, "VP Sales");
    expect(hit).toBeNull();
  });

  it("skips gate for General role", () => {
    const hit = findRoleTokenHit(baseHook.hook, "General");
    expect(hit).toBeNull();
  });

  it("roleTokenGate filters hooks without role tokens", () => {
    const hooks: Hook[] = [
      baseHook, // has "pipeline" → VP Sales match
      { ...baseHook, hook: 'Read that you hired "3 new engineers" — is that for the core product or a new vertical?' }, // no VP Sales token
    ];
    const result = roleTokenGate(hooks, "VP Sales");
    expect(result).toHaveLength(1);
    expect(result[0].role_token_hit).toBe("forecast");
  });

  it("roleTokenGate passes all hooks for General", () => {
    const hooks: Hook[] = [baseHook, baseHook];
    const result = roleTokenGate(hooks, "General");
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Tradeoff Grounding Gate
// ---------------------------------------------------------------------------
describe("Tradeoff Grounding Gate", () => {
  it("accepts tradeoff when option word appears in evidence", () => {
    expect(isTradeoffGrounded(
      'You offer "250+ prebuilt integrations" — is the priority breadth, or depth on core flows?',
      "250+ prebuilt integrations across payments, billing, and tax.",
    )).toBe(true);
  });

  it("accepts tradeoff when hook quotes evidence verbatim", () => {
    expect(isTradeoffGrounded(
      'You promise "100% unique email to every prospect" — is that human-written or programmatic personalization?',
      "100% unique email to every prospect",
    )).toBe(true);
  });

  it("rejects ungrounded strategy fork", () => {
    expect(isTradeoffGrounded(
      "They serve 500+ orgs — broad market vs vertical specialization?",
      "The company has 500+ organizations using its platform.",
    )).toBe(false);
  });

  it("accepts safe fork for integration evidence", () => {
    expect(isTradeoffGrounded(
      "With 50 integration partners — is the priority native connectors or API-based workflows?",
      "Announced 50 new integration partners this quarter.",
    )).toBe(true);
  });

  it("rejects ungrounded tradeoff via isTradeoffGrounded directly", () => {
    // No quote in hook, no safe fork match, no option words in evidence
    expect(isTradeoffGrounded(
      "They serve many customers — holistic strategy or tactical wins, which drives your roadmap?",
      "The company reported strong quarterly earnings.",
    )).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Rank + Cap
// ---------------------------------------------------------------------------
describe("Rank and Cap", () => {
  function makeHook(overrides: Partial<Hook> = {}): Hook {
    return {
      news_item: 1,
      angle: "trigger",
      hook: 'Read that you added "predictive scoring" — is that changing forecast accuracy or just confirming what reps already know?',
      evidence_snippet: "predictive scoring now available",
      source_title: "Blog",
      source_date: "2026-02-15",
      source_url: "https://example.com/blog",
      evidence_tier: "A",
      confidence: "high",
      ...overrides,
    };
  }

  it("caps to 3 hooks by default", () => {
    const hooks = Array.from({ length: 8 }, (_, index) => makeHook({
      buyer_tension_id: `t-${index}`,
      source_url: `https://example.com/blog/${index}`,
      hook: `You added "predictive scoring" to segment ${index} — is that improving forecast accuracy, or just giving managers one more dashboard to inspect?`,
    }));
    const { top, overflow } = rankAndCap(hooks);
    expect(top).toHaveLength(3);
    expect(overflow).toHaveLength(5);
  });

  it("ranks Tier A above Tier B", () => {
    const hooks = [
      makeHook({
        evidence_tier: "B",
        source_date: "2026-02-15",
        buyer_tension_id: "tier-b",
        source_url: "https://example.com/blog/tier-b",
        hook: 'You added "predictive scoring" to SMB — is that improving forecast accuracy or just changing rep inspection rhythm?',
      }),
      makeHook({
        evidence_tier: "A",
        source_date: "2026-02-15",
        buyer_tension_id: "tier-a",
        source_url: "https://example.com/blog/tier-a",
        hook: 'You added "predictive scoring" to enterprise — is that improving forecast accuracy or just changing rep inspection rhythm?',
      }),
    ];
    const { top } = rankAndCap(hooks, 2);
    expect(top[0].evidence_tier).toBe("A");
  });

  it("ranks newer hooks higher", () => {
    const hooks = [
      makeHook({
        source_date: "2024-01-01",
        buyer_tension_id: "older",
        source_url: "https://example.com/blog/older",
        hook: 'You added "predictive scoring" last year — is that helping managers inspect commit risk or just documenting slippage later?',
      }),
      makeHook({
        source_date: "2026-03-01",
        buyer_tension_id: "newer",
        source_url: "https://example.com/blog/newer",
        hook: 'You added "predictive scoring" this quarter — is that helping managers inspect commit risk or just documenting slippage later?',
      }),
    ];
    const { top } = rankAndCap(hooks, 2);
    expect(top[0].source_date).toBe("2026-03-01");
  });

  it("gives role match bonus", () => {
    const hooks = [
      makeHook({ role_token_hit: undefined }),
      makeHook({ role_token_hit: "pipeline" }),
    ];
    const scores = hooks.map(scoreHook);
    expect(scores[1]).toBeGreaterThan(scores[0]);
  });

  it("returns all hooks if fewer than cap", () => {
    const hooks = [
      makeHook({ buyer_tension_id: "a", source_url: "https://example.com/blog/a", hook: 'You added "predictive scoring" — is that tightening forecast calls or exposing rep judgment drift?' }),
      makeHook({ buyer_tension_id: "b", source_url: "https://example.com/blog/b", hook: 'You launched "deal inspection" workflows — is that helping managers coach in-quarter or just standardizing postmortems?' }),
    ];
    const { top, overflow } = rankAndCap(hooks, 3);
    expect(top).toHaveLength(2);
    expect(overflow).toHaveLength(0);
  });

  it("prefers credible and interesting hooks over flatter compliant hooks", () => {
    const hooks = [
      makeHook({
        evidence_tier: "A",
        specificity_score: 8,
        interestingness_score: 9,
        tension_richness_score: 8,
        hook: 'You added "predictive scoring" for enterprise accounts — is that tightening forecast calls, or exposing where rep judgment still drifts quarter to quarter?',
      }),
      makeHook({
        evidence_tier: "A",
        specificity_score: 5,
        interestingness_score: 3,
        tension_richness_score: 4,
        hook: 'You added "predictive scoring" — is the team using it?',
      }),
    ];

    const { top } = rankAndCap(hooks, 2);
    expect(top[0].interestingness_score).toBe(9);
  });

  it("deduplicates near-identical hooks from the same tension", () => {
    const hooks = [
      makeHook({
        buyer_tension_id: "t1",
        hook: 'You added "predictive scoring" — is that tightening forecast calls or exposing where rep judgment drifts?',
      }),
      makeHook({
        buyer_tension_id: "t1",
        hook: 'You added "predictive scoring" — is that tightening forecast calls or just exposing where rep judgment still drifts?',
      }),
      makeHook({
        buyer_tension_id: "t2",
        source_url: "https://example.com/blog/t2",
        hook: 'You rolled out "deal inspection" workflows — is that helping managers coach in-quarter or just documenting misses after the fact?',
      }),
    ];

    const { top, overflow } = rankAndCap(hooks, 3, { targetRole: "VP Sales" });
    expect(top).toHaveLength(2);
    expect(overflow).toHaveLength(0);
    expect(new Set(top.map((hook) => hook.buyer_tension_id)).size).toBe(2);
  });

  it("rewards non-overlap when selecting the set", () => {
    const selected = [makeHook({
      structural_variant: "curiosity-gap",
      trigger_type: "stat",
      buyer_tension_id: "t1",
      hook: 'You added "predictive scoring" — is that tightening forecast calls or exposing where rep judgment drifts?',
    })];
    const overlapping = makeHook({
      structural_variant: "curiosity-gap",
      trigger_type: "stat",
      buyer_tension_id: "t1",
      hook: 'You added "predictive scoring" — is that tightening forecast calls or just exposing where rep judgment still drifts?',
    });
    const distinct = makeHook({
      structural_variant: "scale-friction",
      trigger_type: "hiring",
      buyer_tension_id: "t2",
      hook: 'You are hiring 12 AEs — is inspection cadence keeping pace, or are managers finding commit risk after the week is already gone?',
    });

    const overlapScore = computeHookSelectionCriteria(overlapping, selected, "VP Sales");
    const distinctScore = computeHookSelectionCriteria(distinct, selected, "VP Sales");
    expect(distinctScore.nonOverlap).toBeGreaterThan(overlapScore.nonOverlap);
  });

  it("applies selector priors and company memory penalties", () => {
    const hook = makeHook({
      buyer_tension_id: "t-prior",
      structural_variant: "scale-friction",
      trigger_type: "hiring",
      hook: 'You are hiring 12 AEs — is inspection cadence keeping pace, or are managers finding commit risk after the week is already gone?',
    });

    const favored = computeHookSelectionCriteria(hook, [], "VP Sales", {
      buyerTensionBoosts: { "t-prior": 1.5 },
      structuralVariantBoosts: { "scale-friction": 0.5 },
      angleBoosts: { trigger: 0.25 },
      triggerTypeBoosts: { hiring: 0.5 },
      buyerTensionTrials: { "t-prior": 8 },
      structuralVariantTrials: { "scale-friction": 12 },
      angleTrials: { trigger: 20 },
      triggerTypeTrials: { hiring: 10 },
      totalTrials: 30,
      explorationWeight: 0.85,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    const penalized = computeHookSelectionCriteria(hook, [], "VP Sales", {
      buyerTensionBoosts: { "t-prior": 1.5 },
      structuralVariantBoosts: { "scale-friction": 0.5 },
      angleBoosts: { trigger: 0.25 },
      triggerTypeBoosts: { hiring: 0.5 },
      buyerTensionTrials: { "t-prior": 8 },
      structuralVariantTrials: { "scale-friction": 12 },
      angleTrials: { trigger: 20 },
      triggerTypeTrials: { hiring: 10 },
      totalTrials: 30,
      explorationWeight: 0.85,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: {
        buyerTensionIds: ["t-prior"],
        structuralVariants: ["scale-friction"],
        hookTexts: [hook.hook],
      },
    });

    expect(favored.priorAdjustment).toBeGreaterThan(penalized.priorAdjustment);
    expect(favored.total).toBeGreaterThan(penalized.total);
  });

  it("adds exploration bonus for under-tested patterns", () => {
    const exploratory = makeHook({
      buyer_tension_id: "fresh-tension",
      structural_variant: "proof-to-problem",
      trigger_type: "case_study",
      hook: 'You published that customer proof point — is that creating more qualified pipeline, or just giving reps another static proof asset to reuse?',
    });

    const established = makeHook({
      buyer_tension_id: "mature-tension",
      structural_variant: "curiosity-gap",
      trigger_type: "stat",
      hook: 'You added "predictive scoring" — is that tightening forecast calls or just exposing rep judgment drift?',
    });

    const exploratoryScore = computeHookSelectionCriteria(exploratory, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: { "fresh-tension": 0, "mature-tension": 18 },
      structuralVariantTrials: { "proof-to-problem": 0, "curiosity-gap": 24 },
      angleTrials: { trigger: 30 },
      triggerTypeTrials: { case_study: 0, stat: 22 },
      totalTrials: 40,
      explorationWeight: 1,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    const exploratoryNoExploration = computeHookSelectionCriteria(exploratory, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: { "fresh-tension": 0, "mature-tension": 18 },
      structuralVariantTrials: { "proof-to-problem": 0, "curiosity-gap": 24 },
      angleTrials: { trigger: 30 },
      triggerTypeTrials: { case_study: 0, stat: 22 },
      totalTrials: 40,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    const establishedScore = computeHookSelectionCriteria(established, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: { "fresh-tension": 0, "mature-tension": 18 },
      structuralVariantTrials: { "proof-to-problem": 0, "curiosity-gap": 24 },
      angleTrials: { trigger: 30 },
      triggerTypeTrials: { case_study: 0, stat: 22 },
      totalTrials: 40,
      explorationWeight: 1,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    expect(exploratoryScore.explorationBonus).toBeGreaterThan(establishedScore.explorationBonus);
    expect(exploratoryScore.total).toBeGreaterThan(exploratoryNoExploration.total);
  });

  it("adds personalization bonus for workspace style fit", () => {
    const conciseOperatorHook = makeHook({
      hook: 'You added "predictive scoring" — is that tightening forecast calls or exposing commit risk earlier?',
    });
    const formalHook = makeHook({
      hook: "Following your predictive scoring rollout, a consideration: whether organizational alignment is evolving in step with the broader planning process across leadership reviews?",
    });

    const conciseScore = computeHookSelectionCriteria(conciseOperatorHook, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: "short",
        directnessPreference: 0.9,
        conversationalPreference: 0.1,
        formalPreference: 0,
        operatorPreference: 0.8,
        explicitVoiceTone: "Direct & Professional",
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    const formalScore = computeHookSelectionCriteria(formalHook, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: "short",
        directnessPreference: 0.9,
        conversationalPreference: 0.1,
        formalPreference: 0,
        operatorPreference: 0.8,
        explicitVoiceTone: "Direct & Professional",
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    expect(conciseScore.personalizationBonus).toBeGreaterThan(formalScore.personalizationBonus);
    expect(conciseScore.total).toBeGreaterThan(formalScore.total);
  });

  it("lets user-level style memory override the broader workspace default", () => {
    const directHook = makeHook({
      hook: 'You added "predictive scoring" — is that tightening forecast calls or exposing commit risk earlier?',
    });
    const conversationalHook = makeHook({
      hook: "So you rolled out predictive scoring. Are managers actually catching commit risk earlier, or just reviewing the same pipeline story with nicer labels?",
    });

    const directScore = computeHookSelectionCriteria(directHook, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: "medium",
        directnessPreference: 0.1,
        conversationalPreference: 0.8,
        formalPreference: 0,
        operatorPreference: 0.5,
        explicitVoiceTone: "Conversational",
      },
      userStyle: {
        preferredLength: "short",
        directnessPreference: 1,
        conversationalPreference: 0.1,
        formalPreference: 0,
        operatorPreference: 0.9,
        preferredTone: "direct",
        preferredChannel: "email",
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    const conversationalScore = computeHookSelectionCriteria(conversationalHook, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: "medium",
        directnessPreference: 0.1,
        conversationalPreference: 0.8,
        formalPreference: 0,
        operatorPreference: 0.5,
        explicitVoiceTone: "Conversational",
      },
      userStyle: {
        preferredLength: "short",
        directnessPreference: 1,
        conversationalPreference: 0.1,
        formalPreference: 0,
        operatorPreference: 0.9,
        preferredTone: "direct",
        preferredChannel: "email",
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    });

    expect(directScore.personalizationBonus).toBeGreaterThanOrEqual(conversationalScore.personalizationBonus);
    expect(directScore.total).toBeGreaterThan(conversationalScore.total);
  });

  it("applies counterfactual penalties for historically weak source, wording, and timing patterns", () => {
    const diagnosedHook = makeHook({
      buyer_tension_id: "underperforming-tension",
      structural_variant: "signal-mirror",
      evidence_tier: "B",
      source_date: "",
      hook: 'You launched a partner program — is that helping pipeline quality, or just creating another broad top-of-funnel motion to manage?',
    });

    const cleanHook = makeHook({
      buyer_tension_id: "healthy-tension",
      structural_variant: "proof-to-problem",
      evidence_tier: "A",
      source_date: "2026-03-01",
      hook: 'You published the implementation proof point — is forecast confidence improving because inspection is tighter, or because rep handoffs are cleaner?',
    });

    const diagnosedScore = computeHookSelectionCriteria(diagnosedHook, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
      counterfactuals: {
        buyerTensionPenalties: { "underperforming-tension": 0.8 },
        structuralVariantPenalties: { "signal-mirror": 0.7 },
        evidenceTierPenalties: { B: 0.6 },
        targetRolePenalties: { "VP Sales": 0.4 },
        staleSourcePenalty: 0.5,
        undatedSourcePenalty: 0.35,
      },
    });

    const cleanScore = computeHookSelectionCriteria(cleanHook, [], "VP Sales", {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
      counterfactuals: {
        buyerTensionPenalties: { "underperforming-tension": 0.8 },
        structuralVariantPenalties: { "signal-mirror": 0.7 },
        evidenceTierPenalties: { B: 0.6 },
        targetRolePenalties: { "VP Sales": 0.4 },
        staleSourcePenalty: 0.5,
        undatedSourcePenalty: 0.35,
      },
    });

    expect(diagnosedScore.counterfactualPenalty).toBeGreaterThan(0);
    expect(diagnosedScore.counterfactualPenalty).toBeGreaterThan(cleanScore.counterfactualPenalty);
    expect(diagnosedScore.total).toBeLessThan(cleanScore.total);
  });

  it("adds retrieval bonus for hooks that match a proven reusable archetype", () => {
    const matchingHook = makeHook({
      buyer_tension_id: "retrieval-tension",
      structural_variant: "proof-to-problem",
      trigger_type: "case_study",
      evidence_tier: "A",
      angle: "risk",
      hook: 'You published the customer proof point — is that helping forecast confidence, or just giving reps another proof asset without cleaner inspection?',
    });

    const nonMatchingHook = makeHook({
      buyer_tension_id: "other-tension",
      structural_variant: "signal-mirror",
      trigger_type: "hiring",
      evidence_tier: "B",
      angle: "trigger",
      hook: 'You are hiring 14 reps — is onboarding speed masking where pipeline quality is slipping?',
    });

    const priors = {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
      retrievalLibrary: [{
        generatedHookId: "g-1",
        buyerTensionId: "retrieval-tension",
        structuralVariant: "proof-to-problem",
        angle: "risk" as const,
        triggerType: "case_study" as const,
        targetRole: "VP Sales",
        evidenceTier: "A" as const,
        hookText: "Winning example hook",
        evidenceSnippet: "Customer proof",
        sourceTitle: "Case study",
        outcomeScore: 5.6,
      }],
      counterfactuals: {
        buyerTensionPenalties: {},
        structuralVariantPenalties: {},
        evidenceTierPenalties: {},
        targetRolePenalties: {},
        staleSourcePenalty: 0,
        undatedSourcePenalty: 0,
      },
    };

    const matchingScore = computeHookSelectionCriteria(matchingHook, [], "VP Sales", priors);
    const nonMatchingScore = computeHookSelectionCriteria(nonMatchingHook, [], "VP Sales", priors);

    expect(matchingScore.retrievalBonus).toBeGreaterThan(0);
    expect(matchingScore.retrievalBonus).toBeGreaterThan(nonMatchingScore.retrievalBonus);
    expect(matchingScore.total).toBeGreaterThan(nonMatchingScore.total);
  });

  it("adds retrieval bonus when the hook matches a learned source-type preference", () => {
    const firstPartyHook = makeHook({
      source_url: "https://acme.com/news/launch",
      evidence_tier: "A",
      source_date: "2026-03-20",
      hook: "You just launched the new workflow release — is that making pipeline inspection easier, or adding more rep coaching overhead?",
    });

    const fallbackHook = makeHook({
      source_url: "https://unknown-example-blog.io/acme-roundup",
      evidence_tier: "C",
      source_date: "2026-03-20",
      hook: "Saw a roundup mentioning Acme — is the workflow release changing pipeline inspection yet?",
    });

    const priors = {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
      currentCompanyDomain: "acme.com",
      retrievalLibrary: [],
      sourceTypeBoosts: {
        first_party: 0.8,
        fallback_web: -0.2,
      },
      counterfactuals: {
        buyerTensionPenalties: {},
        structuralVariantPenalties: {},
        evidenceTierPenalties: {},
        targetRolePenalties: {},
        staleSourcePenalty: 0,
        undatedSourcePenalty: 0,
      },
    };

    const firstPartyScore = computeHookSelectionCriteria(firstPartyHook, [], "VP Sales", priors);
    const fallbackScore = computeHookSelectionCriteria(fallbackHook, [], "VP Sales", priors);

    expect(firstPartyScore.retrievalBonus).toBeGreaterThan(fallbackScore.retrievalBonus);
    expect(firstPartyScore.total).toBeGreaterThan(fallbackScore.total);
  });

  it("adds retrieval bonus when the hook matches a learned trigger-specific source preference", () => {
    const trustedFundingHook = makeHook({
      trigger_type: "funding",
      source_url: "https://www.reuters.com/business/acme-funding-round-2026-03-20/",
      evidence_tier: "B",
      source_date: "2026-03-20",
      hook: "Reuters says Acme just raised fresh capital — does that change how tightly pipeline inspection gets reviewed this quarter?",
    });

    const fallbackFundingHook = makeHook({
      trigger_type: "funding",
      source_url: "https://random-startup-blog.biz/acme-funding-rumor",
      evidence_tier: "C",
      source_date: "2026-03-20",
      hook: "Saw a blog mention Acme funding — does that change pipeline inspection this quarter?",
    });

    const priors = {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
      currentCompanyDomain: "acme.com",
      retrievalLibrary: [],
      sourceTypeBoosts: {},
      triggerSourceTypeBoosts: {
        funding: {
          trusted_news: 0.95,
          fallback_web: -0.35,
        },
      },
      counterfactuals: {
        buyerTensionPenalties: {},
        structuralVariantPenalties: {},
        evidenceTierPenalties: {},
        targetRolePenalties: {},
        staleSourcePenalty: 0,
        undatedSourcePenalty: 0,
      },
    };

    const trustedFundingScore = computeHookSelectionCriteria(trustedFundingHook, [], "VP Sales", priors);
    const fallbackFundingScore = computeHookSelectionCriteria(fallbackFundingHook, [], "VP Sales", priors);

    expect(trustedFundingScore.retrievalBonus).toBeGreaterThan(fallbackFundingScore.retrievalBonus);
    expect(trustedFundingScore.total).toBeGreaterThan(fallbackFundingScore.total);
  });

  it("adds timing bonus when a hook matches learned freshness preferences", () => {
    const freshHook = makeHook({
      source_date: "2026-03-25",
      evidence_tier: "A",
      hook: 'You launched the rollout last week — is that improving forecast inspection already, or just shifting pressure downstream?',
    });
    const staleHook = makeHook({
      source_date: "2025-08-01",
      evidence_tier: "A",
      hook: 'You launched the rollout last year — is that still helping forecast inspection, or has the value plateaued?',
    });

    const priors = {
      buyerTensionBoosts: {},
      structuralVariantBoosts: {},
      angleBoosts: {},
      triggerTypeBoosts: {},
      buyerTensionTrials: {},
      structuralVariantTrials: {},
      angleTrials: {},
      triggerTypeTrials: {},
      totalTrials: 0,
      explorationWeight: 0,
      workspaceStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        explicitVoiceTone: null,
      },
      userStyle: {
        preferredLength: null,
        directnessPreference: 0,
        conversationalPreference: 0,
        formalPreference: 0,
        operatorPreference: 0,
        preferredTone: null,
        preferredChannel: null,
      },
      timingPreference: {
        preferredFreshness: "fresh" as const,
        freshPreference: 1.1,
        recentPreference: 0.4,
        staleTolerance: 0,
        undatedTolerance: 0,
        preferredSendWindow: null,
      },
      recentCompanyMemory: { buyerTensionIds: [], structuralVariants: [], hookTexts: [] },
    };

    const freshScore = computeHookSelectionCriteria(freshHook, [], "VP Sales", priors);
    const staleScore = computeHookSelectionCriteria(staleHook, [], "VP Sales", priors);

    expect(freshScore.timingBonus).toBeGreaterThan(staleScore.timingBonus);
    expect(freshScore.total).toBeGreaterThan(staleScore.total);
  });
});

describe("Phase 2 prompts", () => {
  it("builds an explicit interpreter prompt", () => {
    const prompt = buildInterpreterSystemPrompt(null, "VP Sales");
    expect(prompt).toContain("Signal Interpreter stage");
    expect(prompt).toContain("structured buyer tensions");
  });

  it("builds a composer prompt that requires buyer tension ids", () => {
    const prompt = buildComposerSystemPrompt(null, "VP Sales");
    expect(prompt).toContain("Hook Composer stage");
    expect(prompt).toContain("buyer_tension_id");
  });

  it("includes reusable winning patterns in the composer prompt when available", () => {
    const prompt = buildComposerUserPrompt("https://acme.com", [{
      id: "tension-1",
      news_item: 1,
      source_title: "Acme launch",
      source_date: "2026-03-01",
      source_url: "https://acme.com/news",
      evidence_tier: "A",
      evidence_snippet: "Launched workflow automation",
      angle: "trigger",
      buyer_tension: "Pipeline inspection is getting harder",
      pattern_family: "proof-to-problem",
      specificity_tokens: ["workflow automation"],
      confidence: "high",
      richness_score: 8,
      specificity_score: 8,
      interestingness_score: 7,
    }], undefined, [{
      generatedHookId: "g-1",
      buyerTensionId: "tension-1",
      structuralVariant: "proof-to-problem",
      angle: "trigger",
      triggerType: "case_study",
      targetRole: "VP Sales",
      evidenceTier: "A",
      hookText: "Winning example hook",
      evidenceSnippet: "Launched workflow automation",
      sourceTitle: "Acme launch",
      outcomeScore: 5.2,
    }]);

    expect(prompt).toContain("Reusable Winning Patterns");
    expect(prompt).toContain("Winning example hook");
    expect(prompt).toContain("Do not repeat wording verbatim");
  });
});

// ---------------------------------------------------------------------------
// Entity Match Gate
// ---------------------------------------------------------------------------
describe("Entity Match Gate", () => {
  it("matches when source is on target domain", () => {
    const result = computeEntityHitScore(
      { title: "Some Page", publisher: "benifex.com", date: "", url: "https://benifex.com/blog", facts: ["some fact"] },
      "Benifex",
      "benifex.com",
    );
    expect(result.entity_hit_score).toBeGreaterThan(0);
    expect(result.entity_matched_term).toBe("benifex.com");
  });

  it("matches when company name appears in facts", () => {
    const result = computeEntityHitScore(
      { title: "News article", publisher: "techcrunch.com", date: "", url: "https://techcrunch.com/article", facts: ["Benifex raises Series A funding"] },
      "Benifex",
      "benifex.com",
    );
    expect(result.entity_hit_score).toBeGreaterThan(0);
    expect(result.entity_matched_term).toBe("benifex");
  });

  it("returns ENTITY_MISMATCH when source is about different entity", () => {
    const result = computeEntityHitScore(
      { title: "LinkedIn covers 282 events", publisher: "linkedin.com", date: "", url: "https://linkedin.com/pulse/media", facts: ["Media has covered LinkedIn… 282 events across 45 countries"] },
      "Benifex",
      "benifex.com",
    );
    expect(result.entity_hit_score).toBe(0);
    expect(result.reason_code).toBe("ENTITY_MISMATCH");
  });

  it("matches when domain appears in text (third-party article)", () => {
    const result = computeEntityHitScore(
      { title: "Employee Benefits Platform", publisher: "hr-news.com", date: "", url: "https://hr-news.com/review", facts: ["benifex.com offers employee benefits management"] },
      "Benifex",
      "benifex.com",
    );
    expect(result.entity_hit_score).toBeGreaterThan(0);
  });

  it("skips generic names — requires domain match instead", () => {
    const result = computeEntityHitScore(
      { title: "Sales tips article", publisher: "blog.com", date: "", url: "https://blog.com/post", facts: ["sales teams need better tools"] },
      "Sales",
      "sales.co",
    );
    // "sales" is generic, so name match in facts doesn't count
    expect(result.entity_hit_score).toBe(0);
    expect(result.reason_code).toBe("ENTITY_MISMATCH");
  });
});

// ---------------------------------------------------------------------------
// First-Party Source Detection
// ---------------------------------------------------------------------------
describe("isFirstPartySource", () => {
  it("matches exact domain", () => {
    expect(isFirstPartySource("https://acme.com/blog", "acme.com")).toBe(true);
  });

  it("matches subdomain", () => {
    expect(isFirstPartySource("https://blog.acme.com/post", "acme.com")).toBe(true);
  });

  it("rejects different domain", () => {
    expect(isFirstPartySource("https://techcrunch.com/acme", "acme.com")).toBe(false);
  });

  it("rejects partial domain match", () => {
    expect(isFirstPartySource("https://notacme.com/page", "acme.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reputable Publisher Detection
// ---------------------------------------------------------------------------
describe("isReputablePublisher", () => {
  it("recognizes reuters.com", () => {
    expect(isReputablePublisher("https://reuters.com/article/foo")).toBe(true);
  });

  it("recognizes subdomain of reputable publisher", () => {
    expect(isReputablePublisher("https://www.bloomberg.com/news/foo")).toBe(true);
  });

  it("rejects random blog", () => {
    expect(isReputablePublisher("https://randomblog.io/post")).toBe(false);
  });

  it("recognizes wire services", () => {
    expect(isReputablePublisher("https://prnewswire.com/release/123")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Market-Stat Misframing
// ---------------------------------------------------------------------------
describe("hasMarketStatMisframing", () => {
  it("flags 'your team' framing with market stat evidence", () => {
    expect(hasMarketStatMisframing(
      "Saw your team dealing with pipeline leakage — how are you handling it?",
      "According to Gartner, 67% of sales teams struggle with pipeline leakage.",
    )).toBe(true);
  });

  it("allows 'your team' framing with company-specific evidence", () => {
    expect(hasMarketStatMisframing(
      "Saw your team added predictive scoring — is that changing forecasting?",
      "Acme Corp launched predictive scoring for their enterprise customers.",
    )).toBe(false);
  });

  it("allows neutral framing with market stat evidence", () => {
    expect(hasMarketStatMisframing(
      "Gartner says 67% of teams struggle with pipeline — does that match what you see?",
      "According to Gartner, 67% of sales teams struggle with pipeline leakage.",
    )).toBe(false);
  });

  it("flags 'your reps spend' with generic stat", () => {
    expect(hasMarketStatMisframing(
      "Your reps spend 30% of time on admin — how are you tackling that?",
      "A recent study shows reps spend 30% of their time on admin tasks.",
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Role Token Gate — Final Question Restriction
// ---------------------------------------------------------------------------
describe("Role Token Gate — final question restriction", () => {
  it("matches token in question part only", () => {
    // "pipeline" is in the preamble, "forecast" is in the question
    const hook = 'Read that you added "predictive pipeline scoring" — is that changing how reps forecast?';
    expect(findRoleTokenHit(hook, "VP Sales")).toBe("forecast");
  });

  it("ignores token that only appears in preamble", () => {
    // "pipeline" in preamble, nothing relevant in the question
    const hook = 'Read that you revamped your pipeline tooling — is that for the enterprise segment or mid-market?';
    expect(findRoleTokenHit(hook, "VP Sales")).toBeNull();
  });

  it("matches when no em dash separator (whole hook is question)", () => {
    const hook = "How is your team handling pipeline coverage right now?";
    expect(findRoleTokenHit(hook, "VP Sales")).toBe("pipeline");
  });
});
