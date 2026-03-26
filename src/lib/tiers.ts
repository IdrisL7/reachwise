// ---------------------------------------------------------------------------
// Tier definitions & feature flags
// ---------------------------------------------------------------------------

export type TierId = "free" | "starter" | "pro" | "concierge";

export interface TierFeature {
  text: string;
  link?: string; // optional link target
}

export interface Tier {
  id: TierId;
  name: string;
  price: { usd: number; gbp: number; eur: number } | null; // null = free
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
    companyIntel: boolean;
    leadDiscovery: boolean;
  };
  cta: string;
  highlighted?: boolean;
}

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    price: null,
    description: "Try evidence-backed hooks with no commitment.",
    bestFor:
      "Anyone curious about evidence-first outbound — no card required, no time limit.",
    features: [
      { text: "10 hooks lifetime (no card required)" },
      { text: "Evidence-backed email hooks (Trigger / Risk / Tradeoff) + receipts" },
      { text: "Role selection (VP Sales / RevOps / Founder / etc.)" },
      { text: "Company intelligence panel" },
    ],
    flags: {
      hooks: true,
      batchHooks: false,
      followUpEngine: false,
      n8nTemplate: false,
      doneForYouSetup: false,
      prioritySupport: false,
      multiChannel: false,
      sequences: false,
      intentScoring: false,
      agenticExecution: false,
      replyAnalysis: false,
      companyIntel: true,
      leadDiscovery: false,
    },
    cta: "Start for free",
  },
  {
    id: "starter",
    name: "Pro",
    price: { usd: 79, gbp: 65, eur: 74 },
    description: "Evidence-backed hooks with CSV export and sequences.",
    bestFor:
      "Founders and solo SDRs running outbound who want research-backed hooks without the hours.",
    features: [
      { text: "50 hooks/month" },
      { text: "Evidence-backed email hooks (Trigger / Risk / Tradeoff) + receipts" },
      { text: "Basic email sequences (3-step)" },
      { text: "CSV export (Apollo, Clay, Instantly)" },
      { text: "Role selection (VP Sales / RevOps / Founder / etc.)" },
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
      companyIntel: true,
      leadDiscovery: false,
    },
    cta: "Start 7-day free trial",
  },
  {
    id: "pro",
    name: "Scale",
    price: { usd: 179, gbp: 149, eur: 169 },
    description: "Multi-channel outbound with intent scoring and guardrails.",
    bestFor:
      "Teams that run outbound daily and want evidence-backed sequences across email, LinkedIn, calls, and video.",
    features: [
      { text: "Everything in Pro" },
      { text: "Unlimited hooks" },
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
      companyIntel: true,
      leadDiscovery: true,
    },
    cta: "Get started",
    highlighted: true,
  },
  {
    id: "concierge",
    name: "Concierge",
    price: { usd: 599, gbp: 499, eur: 559 },
    description: "Set it up and let it run \u2014 we handle execution.",
    bestFor:
      "Teams that want the full platform managed end-to-end: hooks, sequences, intent scoring, and reply handling.",
    features: [
      { text: "Everything in Scale" },
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
      companyIntel: true,
      leadDiscovery: true,
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
