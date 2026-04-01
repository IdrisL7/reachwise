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
    description: "Prove you can open better conversations before paying for workflow automation.",
    bestFor:
      "Founders or reps validating that better signals can improve first-touch quality without changing the rest of their stack yet.",
    features: [
      { text: "10 hook generations/month to validate message-market fit" },
      { text: "Evidence-backed email hooks with receipts and evidence tiers" },
      { text: "Role-aware positioning for VP Sales, RevOps, founders, and more" },
      { text: "Company intelligence panel for fast account context" },
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
    description: "Turn signals into a repeatable outbound workflow instead of a one-off copywriting tool.",
    bestFor:
      "Teams running outbound weekly or daily who want better prioritisation, faster follow-up, and less manual stitching between tools.",
    features: [
      { text: "750 hook generations/month for ongoing prospecting" },
      { text: "Everything in Free" },
      { text: "Multi-channel variants so one signal becomes email, LinkedIn, call, and video angles" },
      { text: "Custom sequences to turn saved leads into queued follow-up drafts" },
      { text: "Intent scoring and watchlist monitoring to focus reps on accounts warming up" },
      { text: "Lead discovery for filling the top of funnel without another sourcing tool" },
      { text: "CSV export for Apollo, Clay, and Instantly handoff" },
      { text: "Follow-up engine and reply analysis to keep momentum after first touch" },
      { text: "Priority support when the workflow becomes revenue-critical" },
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
    cta: "Start Pro",
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
