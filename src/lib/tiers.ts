// ---------------------------------------------------------------------------
// Tier definitions & feature flags
// ---------------------------------------------------------------------------

export type TierId = "starter" | "pro" | "concierge";

export interface TierFeature {
  text: string;
  link?: string; // optional link target
}

export interface Tier {
  id: TierId;
  name: string;
  price: number; // £/month
  description: string;
  bestFor: string;
  features: TierFeature[];
  flags: {
    hooks: boolean;
    batchHooks: boolean;
    followUpEngine: boolean;
    n8nTemplate: boolean;
    doneForYouSetup: boolean;
    prioritySupport: boolean;
    multiChannel: boolean;
    sequences: boolean;
    intentScoring: boolean;
    agenticExecution: boolean;
    replyAnalysis: boolean;
  };
  cta: string;
  highlighted?: boolean;
}

export const TIERS: Tier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 29,
    description: "Evidence-backed hooks with receipts for every send.",
    bestFor:
      "Individuals and light outbound — founders testing angles and solo SDRs who want research without the hours.",
    features: [
      { text: "Evidence-backed email hooks (Trigger / Risk / Tradeoff) + receipts" },
      { text: "Basic email sequences (3-step)" },
      { text: "Role selection (VP Sales / RevOps / Founder / etc.)" },
      { text: "3 generations/day demo + starter usage limits" },
    ],
    flags: {
      hooks: true,
      batchHooks: true,
      followUpEngine: false,
      n8nTemplate: false,
      doneForYouSetup: false,
      prioritySupport: false,
      multiChannel: false,
      sequences: true,
      intentScoring: false,
      agenticExecution: false,
      replyAnalysis: false,
    },
    cta: "Start 7-day free trial",
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    description: "Multi-channel outbound with intent scoring and guardrails.",
    bestFor:
      "Teams that run outbound daily and want evidence-backed sequences across email, LinkedIn, calls, and video.",
    features: [
      { text: "Everything in Starter" },
      { text: "Multi-channel variants (email + LinkedIn + call + video)" },
      { text: "Custom sequence builder + templates" },
      { text: "Intent scoring + lead temperature badges" },
      { text: "Inbox for drafts + approvals (optional)" },
    ],
    flags: {
      hooks: true,
      batchHooks: true,
      followUpEngine: true,
      n8nTemplate: true,
      doneForYouSetup: false,
      prioritySupport: false,
      multiChannel: true,
      sequences: true,
      intentScoring: true,
      agenticExecution: true,
      replyAnalysis: true,
    },
    cta: "Get started",
    highlighted: true,
  },
  {
    id: "concierge",
    name: "Concierge",
    price: 499,
    description: "Set it up and let it run \u2014 we handle execution.",
    bestFor:
      "Teams that want the full platform managed end-to-end: hooks, sequences, intent scoring, and reply handling.",
    features: [
      { text: "Everything in Pro" },
      {
        text: "Autonomous execution via n8n templates (guardrails + logging included)",
        link: "/followup-engine",
      },
      { text: "Advanced reply analysis + suggested responses" },
      { text: "White-glove onboarding + integration support" },
    ],
    flags: {
      hooks: true,
      batchHooks: true,
      followUpEngine: true,
      n8nTemplate: true,
      doneForYouSetup: true,
      prioritySupport: true,
      multiChannel: true,
      sequences: true,
      intentScoring: true,
      agenticExecution: true,
      replyAnalysis: true,
    },
    cta: "Get started",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getTier(id: TierId): Tier | undefined {
  return TIERS.find((t) => t.id === id);
}

export function hasFeature(
  tierId: TierId,
  flag: keyof Tier["flags"],
): boolean {
  const tier = getTier(tierId);
  return tier?.flags[flag] ?? false;
}
