"use client";

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

export function HeroHookPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
      {/* Fake browser window frame */}
      <div className="overflow-hidden rounded-xl border border-zinc-700/50 bg-[#0c0c14] shadow-[0_8px_40px_rgba(0,0,0,0.5),0_0_80px_rgba(139,92,246,0.06)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-zinc-800/60 bg-[#0a0a12] px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <div className="ml-3 flex h-6 flex-1 items-center rounded-md bg-[#141420] px-3 text-[0.6875rem] text-zinc-500 font-mono">
            getsignalhooks.com
          </div>
        </div>

        {/* App content */}
        <div className="bg-gradient-to-b from-[#0d0d18] to-[#0a0a12] p-5 sm:p-6">
          {/* URL input */}
          <div className="mb-5">
            <div className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-zinc-500">
              Company URL
            </div>
            <div className="flex h-10 items-center rounded-lg border border-zinc-700/50 bg-[#111119] px-3.5 text-[0.875rem] text-zinc-300 shadow-inner">
              https://shopify.com
            </div>
          </div>

          {/* Sample label */}
          <div className="mb-3 rounded-md border border-zinc-700/30 bg-zinc-800/30 px-3 py-1.5 text-center text-[0.6875rem] text-zinc-500">
            Sample output (with receipts). Enter your own company above for fresh signals.
          </div>

          {/* Hooks header */}
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Generated hooks
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[0.625rem] font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live from public data
            </div>
          </div>

          {/* Hook cards */}
          <div className="space-y-2.5">
            {exampleHooks.map((hook, i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-700/40 bg-[#111119]/80 p-3.5 transition-all duration-200 hover:border-violet-500/20 hover:shadow-[0_2px_12px_rgba(139,92,246,0.06)]"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-violet-400/70">
                    Hook {i + 1}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.5625rem] font-semibold ${
                    hook.angle === "trigger"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : hook.angle === "risk"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {hook.angle}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.5625rem] font-semibold ${
                    hook.confidence === "high"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : "bg-zinc-500/10 text-zinc-400 border border-zinc-600/20"
                  }`}>
                    {hook.confidence}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.5rem] font-bold ${
                    hook.tier === "A"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    Tier {hook.tier}
                  </span>
                  {hook.tier === "B" && (
                    <span
                      className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[0.5rem] font-medium text-amber-400 cursor-help"
                      title="This hook is based on weaker/secondary evidence. We phrase it as a verification question rather than making claims."
                    >
                      Verification hook
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full border border-zinc-600/30 bg-zinc-800/40 px-2 py-0.5 text-[0.5rem] font-medium text-zinc-500">
                    Role: VP Sales
                  </span>
                </div>
                <p className="text-[0.75rem] leading-[1.5] text-zinc-400">
                  {hook.text}
                </p>
              </div>
            ))}

            {/* Evidence preview for first hook */}
            <div className="rounded-lg border border-violet-500/15 bg-[#12101e] p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-violet-400/60">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Evidence
              </div>
              <p className="text-[0.6875rem] leading-relaxed text-zinc-400">
                {exampleHooks[0].evidence}
              </p>
              <div className="mt-1.5 flex flex-col gap-0.5">
                <p className="text-[0.625rem] text-zinc-500">
                  Source: {exampleHooks[0].source}
                </p>
                <p className="text-[0.625rem] text-zinc-600">
                  {exampleHooks[0].date}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
