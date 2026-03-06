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
    description: "Evidence-first hooks to sharpen every send.",
    bestFor:
      "Founders doing their own outbound and solo SDRs testing angles without hours of manual research.",
    features: [
      { text: "~200 single-URL hook generations / month" },
      { text: "Batch mode for up to 10 URLs at a time" },
      { text: "Hooks with evidence snippets from company URLs" },
      { text: "Custom sequence builder" },
      { text: "Works with leads from Apollo, Clay, Sheets, etc." },
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
    description: "Autonomous multi-channel outbound with intent scoring and reply intelligence.",
    bestFor:
      "Teams and agencies that want research-grade hooks plus autonomous sequences across email, LinkedIn, calls, and video.",
    features: [
      { text: "Everything in Starter" },
      { text: "~750 hook generations / month" },
      { text: "Multi-channel variants (LinkedIn, cold call, video scripts)" },
      {
        text: "Autonomous Outbound Engine: sequences run on autopilot across channels",
        link: "/followup-engine",
      },
      { text: "Intent scoring & lead prioritization (hot / warm / cold)" },
      { text: "Inbox with draft approval mode" },
      { text: "Reply detection & auto-classification" },
      { text: "Batch mode for up to 75 URLs at a time" },
      { text: "n8n workflow template & setup guide" },
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
    description: "We set up, run, and optimize your autonomous outbound for you.",
    bestFor:
      "Agencies and teams that want the full platform — hooks, multi-channel sequences, intent scoring, and reply handling — managed end-to-end.",
    features: [
      { text: "Everything in Pro" },
      {
        text: "Autonomous Outbound Engine — we run it for you",
        link: "/followup-engine",
      },
      { text: "Unlimited agentic execution across all leads" },
      { text: "Done-for-you n8n workflow setup & configuration" },
      { text: "Sequence strategy & copy review" },
      { text: "Deliverability monitoring & warm-up guidance" },
      { text: "Priority support with dedicated Slack channel" },
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
