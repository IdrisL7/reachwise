"use client";

import Link from "next/link";
import { Reveal } from "./ui/reveal";

const stats = [
  {
    value: "100%",
    label: "Cited with source + date",
  },
  {
    value: "0",
    label: "Facts invented",
  },
];

export function SocialProofSection() {
  return (
    <section className="border-t border-white/[0.06] bg-[#0a0a12]">
      <div className="mx-auto max-w-[90rem] px-6 py-12 lg:px-10 lg:py-16">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-3 text-[0.8125rem] font-semibold uppercase tracking-wider text-amber-500/70">
              Now in beta
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-white">
              We&apos;d rather show you than tell you
            </h2>
            <p className="mt-3 text-[1rem] leading-[1.6] text-zinc-400">
              No fake testimonials. Try the demo above &mdash; the output quality is the proof.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mx-auto mt-10 flex max-w-md items-center justify-center gap-12 sm:gap-16">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-[clamp(2rem,4vw,3rem)] font-bold text-white tracking-[-0.02em]">
                  {stat.value}
                </p>
                <p className="mt-1 text-[0.8125rem] text-zinc-500">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.18}>
        <div className="mt-8 flex justify-center">
          <Link
            href="#demo"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-violet-600 px-6 text-[0.875rem] font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.2)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97]"
          >
            Try it free &mdash; no signup
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </Link>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
