import { describe, expect, it } from "vitest";
import {
  buildSequenceOrchestrationPlan,
  computeSequenceHookFit,
  extractPreviousHookMetadata,
  extractPreviousSequenceMetadata,
  pickBestHook,
  type PreviousMessage,
} from "./generate";
import type { Hook } from "@/lib/hooks";

function makeHook(overrides: Partial<Hook>): Hook {
  return {
    news_item: 1,
    angle: "trigger",
    hook: "Noticed the product launch. Is that changing how pipeline gets prioritized right now?",
    evidence_snippet: "Launched workflow orchestration for enterprise teams",
    source_title: "Product launch",
    source_date: "2026-03-12",
    source_url: "https://example.com/product-launch",
    evidence_tier: "A",
    confidence: "high",
    quality_score: 7,
    selector_score: 9,
    ranking_score: 8,
    ...overrides,
  };
}

describe("Phase 7 sequence-aware hook selection", () => {
  it("prefers a fresh tension and angle for bump emails", () => {
    const previousMessages: PreviousMessage[] = [
      {
        direction: "outbound",
        sequenceStep: 0,
        channel: "email",
        body: "Earlier touch",
        metadata: {
          angle: "trigger",
          buyerTensionId: "tension-1",
          structuralVariant: "signal-mirror",
          hookText: "Earlier touch",
        },
      },
    ];

    const repeated = makeHook({
      angle: "trigger",
      hook: "Noticed the product launch. Is that changing how pipeline gets prioritized right now?",
      buyer_tension_id: "tension-1",
      structural_variant: "signal-mirror",
      selector_score: 11.5,
    });

    const fresh = makeHook({
      angle: "risk",
      hook: "Your rollout looks fast. Is RevOps now spending more time reconciling handoff noise or forecast drift?",
      buyer_tension_id: "tension-2",
      structural_variant: "hidden-cost",
      selector_score: 10.2,
      non_overlap_score: 3,
    });

    const chosen = pickBestHook([repeated, fresh], previousMessages, {
      sequenceType: "bump",
      channel: "email",
    });

    expect(chosen.hook).toBe(fresh.hook);
  });

  it("prefers short connection-friendly hooks for LinkedIn connection steps", () => {
    const shortHook = makeHook({
      angle: "trigger",
      hook: "Saw the launch into healthcare. Is expansion changing which accounts your team can prioritize fastest?",
      selector_score: 8.6,
    });
    const longHook = makeHook({
      angle: "risk",
      hook: "Saw the launch into healthcare and the workflow orchestration push for enterprise teams. Curious whether that is creating more downstream complexity for pipeline reviews, handoffs, and the way forecast confidence gets managed across regions right now?",
      selector_score: 9.4,
    });

    const chosen = pickBestHook([longHook, shortHook], [], {
      sequenceType: "first",
      channel: "linkedin_connection",
    });

    expect(chosen.hook).toBe(shortHook.hook);
  });

  it("scores breakup-step tradeoff hooks above long trigger hooks", () => {
    const breakupHook = makeHook({
      angle: "tradeoff",
      hook: "Last note from me. As the rollout expands, are you optimizing for speed of coverage or cleaner forecast inspection across reps?",
      selector_score: 8.4,
      structural_variant: "proof-to-problem",
    });
    const longTrigger = makeHook({
      angle: "trigger",
      hook: "Saw the new workflow orchestration launch for enterprise teams and the healthcare expansion on top of that. Is the bigger issue now prioritizing new account coverage, or keeping downstream pipeline inspection and handoff discipline from getting messy as more teams get involved at once?",
      selector_score: 8.8,
      structural_variant: "signal-mirror",
    });

    const breakupFit = computeSequenceHookFit(breakupHook, {
      previousMessages: [],
      sequenceType: "breakup",
      channel: "email",
    });
    const triggerFit = computeSequenceHookFit(longTrigger, {
      previousMessages: [],
      sequenceType: "breakup",
      channel: "email",
    });

    expect(breakupFit.total).toBeGreaterThan(triggerFit.total);
  });
});

describe("Phase 10 sequence orchestration", () => {
  it("chooses a lighter non-email bump channel after repeated email touches", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 1,
      maxSteps: 3,
      previousMessages: [
        {
          direction: "outbound",
          sequenceStep: 0,
          channel: "email",
          body: "First email",
        },
        {
          direction: "outbound",
          sequenceStep: 0,
          channel: "email",
          body: "Reminder draft",
        },
      ],
    });

    expect(plan.channel).toBe("linkedin_message");
    expect(plan.ctaStyle).toBe("problem_question");
    expect(plan.reasoning.join(" ")).toContain("linkedin_message");
  });

  it("keeps an explicit channel override but still orchestrates tone and CTA style", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 2,
      maxSteps: 3,
      previousMessages: [],
      preferredChannel: "cold_call",
    });

    expect(plan.channel).toBe("cold_call");
    expect(plan.ctaStyle).toBe("permission_check");
    expect(plan.tone).toBe("direct");
  });

  it("uses a softer breakup orchestration for final email steps", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 2,
      maxSteps: 3,
      previousMessages: [
        {
          direction: "outbound",
          sequenceStep: 0,
          channel: "email",
          body: "Initial note",
        },
      ],
      preferredChannel: "email",
    });

    expect(plan.sequenceType).toBe("breakup");
    expect(plan.channel).toBe("email");
    expect(plan.ctaStyle).toBe("soft_breakup");
    expect(plan.wordCountHint).toBeLessThanOrEqual(45);
  });

  it("avoids call-first orchestration outside business hours", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 1,
      maxSteps: 3,
      previousMessages: [],
      now: new Date("2026-03-31T19:30:00Z"),
    });

    expect(plan.sendWindow).toBe("weekday_evening");
    expect(plan.channel).not.toBe("cold_call");
    expect(plan.wordCountHint).toBeLessThanOrEqual(60);
  });

  it("uses learned channel and tone preferences when they fit the step", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 1,
      maxSteps: 3,
      previousMessages: [
        {
          direction: "outbound",
          sequenceStep: 0,
          channel: "email",
          body: "Initial note",
        },
      ],
      learnedPreferredChannel: "video_script",
      learnedPreferredTone: "warm",
      now: new Date("2026-03-31T13:00:00Z"),
    });

    expect(plan.channel).toBe("video_script");
    expect(plan.tone).toBe("warm");
    expect(plan.reasoning.join(" ")).toContain("learned channel preference");
  });

  it("leans toward async channels when outside the learned send window", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 1,
      maxSteps: 3,
      previousMessages: [
        {
          direction: "outbound",
          sequenceStep: 0,
          channel: "linkedin_message",
          body: "Initial note",
        },
      ],
      learnedPreferredSendWindow: "weekend",
      now: new Date("2026-03-31T09:30:00Z"),
    });

    expect(plan.sendWindow).toBe("weekday_morning");
    expect(plan.channel).toBe("video_script");
    expect(plan.reasoning.join(" ")).toContain("learned send window");
  });

  it("uses sequence outcome priors to avoid historically weak channels", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 1,
      maxSteps: 3,
      previousMessages: [],
      learnedSequencePriors: {
        adjustments: {
          first: {},
          bump: {
            cold_call: -1.8,
            linkedin_message: 1.1,
          },
          breakup: {},
        },
      },
      now: new Date("2026-03-31T10:00:00Z"),
    });

    expect(plan.channel).toBe("linkedin_message");
    expect(plan.reasoning.join(" ")).toContain("historically successful sequence pattern");
  });

  it("uses path priors to prefer better channel transitions", () => {
    const plan = buildSequenceOrchestrationPlan({
      currentStep: 1,
      maxSteps: 3,
      previousMessages: [
        {
          direction: "outbound",
          sequenceStep: 0,
          channel: "email",
          body: "First touch",
        },
      ],
      learnedSequencePriors: {
        adjustments: {
          first: {},
          bump: {},
          breakup: {},
        },
        pathAdjustments: {
          first: {},
          bump: {
            email: {
              linkedin_message: 1.4,
              cold_call: -1.2,
            },
          },
          breakup: {},
        },
      },
    });

    expect(plan.channel).toBe("linkedin_message");
    expect(plan.previousChannel).toBe("email");
    expect(plan.reasoning.join(" ")).toContain("prior channel");
  });
});

describe("follow-up metadata extraction", () => {
  it("extracts hook attribution from stored message metadata", () => {
    const metadata = extractPreviousHookMetadata({
      hookId: "hook-123",
      angle: "risk",
      buyerTensionId: "tension-9",
      structuralVariant: "proof-to-problem",
      hookText: "Hook body",
      evidenceSnippet: "Evidence body",
    });

    expect(metadata).toEqual({
      hookId: "hook-123",
      angle: "risk",
      buyerTensionId: "tension-9",
      structuralVariant: "proof-to-problem",
      hookText: "Hook body",
      evidenceSnippet: "Evidence body",
    });
  });

  it("falls back to nested hookUsed metadata for generated messages", () => {
    const metadata = extractPreviousHookMetadata({
      hookUsed: {
        generatedHookId: "hook-456",
        angle: "tradeoff",
        buyerTensionId: "tension-10",
        structuralVariant: "signal-mirror",
        hookText: "Nested hook body",
        evidence: "Nested evidence",
      },
    });

    expect(metadata).toEqual({
      hookId: "hook-456",
      angle: "tradeoff",
      buyerTensionId: "tension-10",
      structuralVariant: "signal-mirror",
      hookText: "Nested hook body",
      evidenceSnippet: "Nested evidence",
    });
  });

  it("extracts sequence metadata from orchestration payloads", () => {
    expect(extractPreviousSequenceMetadata({
      orchestration: {
        sequenceType: "breakup",
        tone: "concise",
        previousChannel: "email",
      },
    })).toEqual({
      sequenceType: "breakup",
      tone: "concise",
      previousChannel: "email",
    });
  });
});
