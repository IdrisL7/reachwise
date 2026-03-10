"use client";

import { Badge } from "./ui/badge";

const exampleHooks = [
  {
    angle: "trigger" as const,
    confidence: "high" as const,
    tier: "A" as const,
    text: 'Shopify Editions Summer \'25 shipped over 150 product updates in a single release. Is your integration layer keeping pace with that cadence?',
    evidence: '"Shopify announced over 150 updates across its platform in its Summer \'25 Editions release..."',
    source: "Shopify Editions — Summer '25 Announcement",
    date: "June 2025",
    sourceUrl: "https://www.shopify.com/editions",
  },
  {
    angle: "risk" as const,
    confidence: "high" as const,
    tier: "A" as const,
    text: "Shopify\u2019s B2B channel now supports company-specific pricing + net terms. Are your accounts asking for that yet\u2014or still fine with standard checkout?",
    evidence: '"Shopify launched a dedicated B2B sales channel with company-specific pricing, net payment terms, and custom catalogs..."',
    source: "Shopify B2B Wholesale Channel — Product Blog",
    date: "2025",
    sourceUrl: "https://www.shopify.com/plus/b2b",
  },
  {
    angle: "tradeoff" as const,
    confidence: "med" as const,
    tier: "B" as const,
    text: "It sounds like Shopify Plus is positioning around dedicated APIs and customizable checkout for enterprise. Did I get that right?",
    evidence: '"Shopify Plus powers enterprise commerce for high-volume brands with dedicated APIs and customizable checkout..."',
    source: "Shopify Plus — Platform Overview",
    date: "",
    sourceUrl: "https://www.shopify.com/plus",
  },
];

const angleBadgeVariant = {
  trigger: "trigger" as const,
  risk: "risk" as const,
  tradeoff: "tradeoff" as const,
};

const confidenceBadgeVariant = {
  high: "high" as const,
  med: "med" as const,
  low: "low" as const,
};

const tierBadgeVariant = {
  A: "tier-a" as const,
  B: "tier-b" as const,
  C: "tier-c" as const,
};

export function HeroHookPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
      {/* Floating gradient orb */}
      <div className="pointer-events-none absolute -top-16 right-0 h-[300px] w-[300px] rounded-full bg-violet-600/[0.08] blur-[100px] animate-fade-in" />

      {/* Company URL chip */}
      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700/50 bg-[#111119] px-4 py-2 text-[0.8125rem] font-mono text-zinc-400">
          <svg className="h-3.5 w-3.5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          shopify.com
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[0.625rem] font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live from public data
        </div>
      </div>

      {/* Hook card stack */}
      <div className="space-y-3">
        {exampleHooks.map((hook, i) => (
          <div
            key={i}
            className={`animate-stagger-${i + 1} relative rounded-xl border border-zinc-700/40 bg-[#111119]/90 p-4 transition-all duration-200 hover:border-violet-500/25 hover:shadow-[0_4px_20px_rgba(139,92,246,0.08)] ${
              i === 0 ? "shadow-[0_4px_24px_rgba(0,0,0,0.3)]" : i === 1 ? "shadow-[0_2px_16px_rgba(0,0,0,0.2)]" : "shadow-[0_1px_8px_rgba(0,0,0,0.15)]"
            }`}
          >
            {/* Left border accent by angle */}
            <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${
              hook.angle === "trigger" ? "bg-blue-500/60" : hook.angle === "risk" ? "bg-rose-500/60" : "bg-amber-500/60"
            }`} />

            <div className="pl-2">
              <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                <Badge variant={angleBadgeVariant[hook.angle]}>{hook.angle}</Badge>
                <Badge variant={confidenceBadgeVariant[hook.confidence]}>{hook.confidence}</Badge>
                <Badge variant={tierBadgeVariant[hook.tier]}>Tier {hook.tier}</Badge>
                {hook.tier === "B" && (
                  <Badge
                    variant="verification"
                    title="This hook is based on weaker/secondary evidence. We phrase it as a verification question rather than making claims."
                    className="cursor-help"
                  >
                    Verification hook
                  </Badge>
                )}
                <Badge variant="role">VP Sales</Badge>
              </div>
              <p className="text-[0.8125rem] leading-[1.55] text-zinc-300">
                {hook.text}
              </p>
            </div>
          </div>
        ))}

        {/* Evidence preview for first hook */}
        <div className="animate-stagger-3 rounded-xl border border-violet-500/15 bg-[#12101e] p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-400/60">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Evidence
          </div>
          <div className="border-l-2 border-violet-500/30 pl-3">
            <p className="text-[0.75rem] leading-relaxed text-zinc-400 italic">
              {exampleHooks[0].evidence}
            </p>
            <div className="mt-2 flex flex-col gap-0.5">
              <p className="text-[0.6875rem] text-zinc-500 not-italic">
                {exampleHooks[0].source}
              </p>
              <p className="text-[0.625rem] text-zinc-600">
                {exampleHooks[0].date}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
