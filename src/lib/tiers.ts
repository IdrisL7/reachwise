// ---------------------------------------------------------------------------
// Tier definitions & feature flags
// ---------------------------------------------------------------------------

export type TierId = "free" | "pro";

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
      { text: "10 hooks/month (no card required)" },
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
    cta: "Get started",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: { usd: 79, gbp: 65, eur: 74 },
    description: "Full-power outbound with intent scoring, sequences, and multi-channel.",
    bestFor:
      "Founders and teams running outbound daily who want evidence-backed hooks, sequences, and lead discovery.",
    features: [
      { text: "750 hooks/month" },
      { text: "Everything in Free" },
      { text: "Multi-channel variants (email + LinkedIn + call + video)" },
      { text: "Custom sequence builder + templates" },
      { text: "Intent scoring + lead temperature badges" },
      { text: "Lead discovery (50 searches/month)" },
      { text: "CSV export (Apollo, Clay, Instantly)" },
      { text: "Follow-up engine + reply analysis" },
      { text: "Priority support" },
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
    cta: "Upgrade",
    highlighted: true,
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
