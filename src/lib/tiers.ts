// ---------------------------------------------------------------------------
// Tier definitions & feature flags
// ---------------------------------------------------------------------------

export type TierId = "starter" | "pro" | "concierge";

export interface Tier {
  id: TierId;
  name: string;
  price: number; // $/month
  description: string;
  bestFor: string;
  features: string[];
  flags: {
    hooks: boolean;
    batchHooks: boolean;
    followUpEngine: boolean;
    n8nTemplate: boolean;
    doneForYouSetup: boolean;
    prioritySupport: boolean;
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
      "~200 single-URL hook generations / month",
      "Batch mode for up to 10 URLs at a time",
      "Hooks with evidence snippets from company URLs",
      "Works with leads from Apollo, Clay, Sheets, etc.",
    ],
    flags: {
      hooks: true,
      batchHooks: true,
      followUpEngine: false,
      n8nTemplate: false,
      doneForYouSetup: false,
      prioritySupport: false,
    },
    cta: "Get started",
  },
  {
    id: "pro",
    name: "Pro",
    price: 149,
    description: "Hooks + automated follow-up sequences that run on autopilot.",
    bestFor:
      "Teams and agencies that want research-grade hooks plus hands-free follow-up cadences powered by the Follow-Up Engine.",
    features: [
      "Everything in Starter",
      "~750 hook generations / month",
      "Follow-Up Engine — automated multi-step sequences",
      "n8n workflow template & setup guide",
      "Batch mode for up to 75 URLs at a time",
      "AI-generated follow-ups with angle rotation",
    ],
    flags: {
      hooks: true,
      batchHooks: true,
      followUpEngine: true,
      n8nTemplate: true,
      doneForYouSetup: false,
      prioritySupport: false,
    },
    cta: "Get started",
    highlighted: true,
  },
  {
    id: "concierge",
    name: "Concierge",
    price: 499,
    description: "We set it up, run it, and optimize it for you.",
    bestFor:
      "Agencies and teams that want the full system — hooks, follow-ups, and deliverability — managed end-to-end.",
    features: [
      "Everything in Pro",
      "Done-for-you n8n workflow setup & configuration",
      "Sequence strategy & copy review",
      "Deliverability monitoring & warm-up guidance",
      "Priority support with dedicated Slack channel",
      "Monthly performance review call",
    ],
    flags: {
      hooks: true,
      batchHooks: true,
      followUpEngine: true,
      n8nTemplate: true,
      doneForYouSetup: true,
      prioritySupport: true,
    },
    cta: "Book a call",
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
