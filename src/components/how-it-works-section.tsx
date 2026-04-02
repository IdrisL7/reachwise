"use client";

import { motion } from "framer-motion";
import { Reveal } from "./ui/reveal";

const steps = [
  {
    num: "01",
    title: "Find a real signal",
    desc: "Paste any company URL. We pull evidence from first-party sources and reputable coverage — funding rounds, new hires, product launches — each with a quote, source, and date.",
    visual: (
      <div className="mt-5 rounded-xl border border-white/[0.07] bg-[#0a0a0b] px-4 py-3 flex items-center gap-3">
        <svg className="h-4 w-4 shrink-0 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z" />
        </svg>
        <span className="text-sm text-zinc-500">e.g. Gong</span>
        <span className="ml-auto flex items-center gap-1.5 text-[0.6875rem] text-zinc-600">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-500 motion-safe:animate-pulse" />
          Searching…
        </span>
      </div>
    ),
  },
  {
    num: "02",
    title: "Generate the right message for the buyer",
    desc: "Pick the role you're targeting. We generate hooks, email drafts, and buyer-aware follow-up angles around what changed, what is at risk, and what trade-off they are facing.",
    visual: (
      <div className="mt-4 space-y-2">
        {[
          { label: "trigger", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", text: "Noticed Gong just shipped AI forecasting…" },
          { label: "risk",    color: "bg-rose-500/10  text-rose-400  border-rose-500/20",  text: "Most teams we talk to lose deals when…"  },
        ].map((h) => (
          <div key={h.label} className="rounded-lg border border-[#252830] bg-[#14161a] px-3 py-2.5 flex items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[0.5625rem] font-semibold border ${h.color}`}>{h.label}</span>
            <p className="text-xs text-zinc-400 leading-[1.5] truncate">{h.text}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "03",
    title: "Move it into workflow",
    desc: "Turn a strong signal into a lead, queue sequence drafts, review them in Inbox, and keep the source context attached from first hook through follow-up.",
    visual: (
      <div aria-hidden="true" className="mt-4 flex flex-wrap gap-2">
        {["Save Lead", "Start Sequence", "Review Inbox"].map((label) => (
          <span
            key={label}
            className="text-[0.6875rem] font-medium px-2.5 py-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/60 text-zinc-400"
          >
            {label}
          </span>
        ))}
      </div>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="relative overflow-hidden border-t border-white/[0.04] bg-[#0a0a0b]"
    >
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.18),transparent_55%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/35 to-transparent" />

      <div className="relative mx-auto max-w-[90rem] px-6 py-18 lg:px-10 lg:py-24">

        <Reveal>
          <div className="mb-12 max-w-3xl lg:mb-16">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-violet-200/75">
              From signal to sequence
            </p>
            <h2
              id="how-it-works-heading"
              className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2rem,3.5vw,3.25rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white"
            >
              Find the signal. Create the message. Run the workflow.
            </h2>
            <p className="mt-4 max-w-2xl text-[0.98rem] leading-7 text-zinc-400">
              See how a live company signal becomes a usable outbound workflow, with the source context still attached at every step.
            </p>
          </div>
        </Reveal>

        {/* Bento grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-rows-2 gap-4 lg:min-h-[560px]">

          {/* Large tile — step 01, spans 2 rows */}
          <Reveal delay={0} className="lg:row-span-2">
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="group relative h-full overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,30,0.98),rgba(12,12,18,0.98))] p-7 shadow-[0_20px_60px_rgba(0,0,0,0.24)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.16),transparent_36%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex h-full flex-col">
                <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-200/65">
                  {steps[0].num}
                </p>
                <h3 className="text-[1.25rem] font-bold text-white leading-[1.2]">
                  {steps[0].title}
                </h3>
                <p className="mt-3 text-[0.9375rem] leading-[1.65] text-zinc-400">
                  {steps[0].desc}
                </p>
                <div className="mt-auto pt-6" aria-hidden="true">
                  {steps[0].visual}
                  <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#14161a]/80 p-3 space-y-2">
                    {[
                      { badge: "Funding", color: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", domain: "techcrunch.com", title: "Gong raises $250M Series E…" },
                      { badge: "Press", color: "bg-violet-600/10 border-violet-500/20 text-violet-400", domain: "gong.io", title: "Gong launches AI deal forecasting" },
                    ].map((r) => (
                      <div key={r.domain} className="flex items-center gap-2.5">
                        <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.5625rem] font-semibold whitespace-nowrap ${r.color}`}>{r.badge}</span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-xs text-zinc-400">{r.domain}</span>
                          <span className="truncate text-[10px] text-zinc-600">{r.title}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </Reveal>

          {/* Step 02 — top right */}
          <Reveal delay={0.12}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="group relative h-full overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,30,0.98),rgba(12,12,18,0.98))] p-7 shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.14),transparent_34%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex h-full flex-col">
                <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-200/65">
                  {steps[1].num}
                </p>
                <h3 className="text-[1.125rem] font-bold text-white leading-[1.2]">
                  {steps[1].title}
                </h3>
                <p className="mt-2 text-[0.875rem] leading-[1.6] text-zinc-400">
                  {steps[1].desc}
                </p>
                <div className="mt-auto pt-4" aria-hidden="true">
                  {steps[1].visual}
                </div>
              </div>
            </motion.div>
          </Reveal>

          {/* Step 03 — bottom right */}
          <Reveal delay={0.24}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="group relative h-full overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,30,0.98),rgba(12,12,18,0.98))] p-7 shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_34%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative flex h-full flex-col">
                <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-200/65">
                  {steps[2].num}
                </p>
                <h3 className="text-[1.125rem] font-bold text-white leading-[1.2]">
                  {steps[2].title}
                </h3>
                <p className="mt-2 text-[0.875rem] leading-[1.6] text-zinc-400">
                  {steps[2].desc}
                </p>
                <div className="mt-auto pt-4" aria-hidden="true">
                  {steps[2].visual}
                </div>
              </div>
            </motion.div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}
