"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Reveal } from "./ui/reveal";

const integrations = ["Apollo", "Clay", "Instantly", "Outreach", "Salesloft"];

function StaticSearchInput() {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0b] px-4 py-3 flex items-center gap-3">
      <svg className="h-4 w-4 shrink-0 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z" />
      </svg>
      <span className="text-sm text-zinc-500">e.g. Gong</span>
    </div>
  );
}

function StaticHookCard() {
  return (
    <div className="rounded-xl border border-[#252830] bg-[#14161a] p-5">
      {/* Badges */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.5625rem] font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Tier A</span>
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.5625rem] font-medium border bg-violet-500/10 text-violet-300 border-violet-500/20">First-party</span>
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[0.5625rem] font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">trigger</span>
        <span className="flex items-center gap-1 text-xs text-zinc-500 ml-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
          high
        </span>
      </div>

      {/* Hook text */}
      <p className="text-sm text-zinc-200 leading-[1.6] mb-3">
        "Noticed Gong just shipped AI deal forecasting — curious whether your team is rethinking how you weight pipeline signals, or doubling down on the existing model."
      </p>

      {/* Evidence */}
      <div className="text-xs text-[#878a8f] italic border-l-2 border-amber-500/30 pl-3 mb-3 bg-amber-500/[0.03] py-2 rounded-r">
        <p>"Gong Revenue Intelligence now includes AI-powered deal forecasting..."</p>
        <span className="not-italic text-zinc-600 mt-1 block truncate">gong.io/blog/ai-deal-forecasting</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#252830]">
        <span className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300">Copy Hook</span>
        <span className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-800/60 bg-violet-900/20 text-violet-400">Generate Email</span>
      </div>
    </div>
  );
}

export function HeroSection() {
  const reduced = useReducedMotion();
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div className="relative mx-auto max-w-[90rem] px-6 py-28 lg:px-10 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 lg:gap-16 items-center">

          {/* Left — text */}
          <div>
            <Reveal delay={0}>
              <h1 id="hero-heading" className="font-[family-name:var(--font-display)] text-[clamp(2.75rem,5vw,5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-white">
                Cold outreach that cites its sources.
              </h1>
            </Reveal>

            <Reveal delay={0.08}>
              <p className="mt-6 max-w-xl text-[clamp(1.0625rem,1.5vw,1.25rem)] leading-[1.55] text-zinc-400">
                Type a company name. We find a real signal &mdash; a funding round, a new hire, an expansion &mdash; and write a personalised opening line with the source cited.
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <div className="mt-10">
                <Link
                  href="#demo"
                  className="inline-flex h-[3.5rem] items-center justify-center gap-2 rounded-lg bg-violet-600 px-8 text-[1.0625rem] font-semibold tracking-[-0.01em] text-white transition-colors duration-150 hover:bg-violet-600/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
                >
                  Try the live demo
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-12 border-t border-white/[0.06] pt-7">
                <p className="text-[0.8125rem] text-zinc-500">
                  Works with your existing stack —{" "}
                  <span className="text-zinc-400">{integrations.join(", ")}</span>
                </p>
              </div>
            </Reveal>
          </div>

          {/* Product preview — single grid cell, responsive variants */}
          <div>
            {/* Mobile: static, no animation */}
            <Reveal delay={0.32}>
              <div className="block lg:hidden" aria-hidden="true">
                <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d10]/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] space-y-4">
                  <StaticSearchInput />
                  <StaticHookCard />
                </div>
              </div>
            </Reveal>

            {/* Desktop: floating animation */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.32 }}
              className="hidden lg:block"
              aria-hidden="true"
            >
              <motion.div
                animate={reduced ? { y: 0 } : { y: [0, -6, 0] }}
                transition={{ repeat: reduced ? 0 : Infinity, duration: 3, ease: [0.45, 0, 0.55, 1] }}
                className="rounded-2xl border border-white/[0.07] bg-[#0d0d10]/80 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.4)] space-y-4"
              >
                {/* Mini toolbar */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-zinc-700/80" />
                  <span className="ml-3 text-[0.6875rem] text-zinc-600">GetSignalHooks · Generate</span>
                </div>
                <StaticSearchInput />
                <StaticHookCard />
              </motion.div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
