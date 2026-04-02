"use client";

import Link from "next/link";
import { Reveal } from "./ui/reveal";

const proofNotes = [
  "Every hook includes source context, so you can judge the reasoning instead of trusting a claim.",
  "The demo shows the real workflow: signal, hook, evidence, and follow-up path in one place.",
  "Once beta users start sharing feedback, this section can turn into real operator quotes with receipts.",
];

export function TestimonialsSection() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="relative overflow-hidden border-t border-white/[0.04] bg-[#0a0a0b]"
    >
      <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_58%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />

      <div className="relative mx-auto max-w-[90rem] px-6 py-16 lg:px-10 lg:py-24">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200/70">
              Early stage
            </p>
            <h2
              id="testimonials-heading"
              className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2rem,3.6vw,3.35rem)] font-bold leading-[1.04] tracking-[-0.03em] text-zinc-100"
            >
              No made-up praise. Try it now and let the evidence speak for itself.
            </h2>
            <p className="mt-4 max-w-2xl text-[1rem] leading-7 text-zinc-400">
              We are keeping this section honest until real beta feedback comes in. For now, the best proof is the product itself and the source-backed workflow you can test on the page.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal delay={0.08}>
            <div className="rounded-[1.75rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(19,19,28,0.96),rgba(11,11,17,0.98))] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-violet-300/75">
                What you can verify now
              </p>
              <div className="mt-5 space-y-4">
                {proofNotes.map((note) => (
                  <div
                    key={note}
                    className="rounded-[1.1rem] border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-[0.95rem] leading-7 text-zinc-300"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.16}>
            <div className="rounded-[1.75rem] border border-violet-500/15 bg-[linear-gradient(180deg,rgba(26,19,42,0.9),rgba(12,11,20,0.96))] p-8 shadow-[0_18px_50px_rgba(0,0,0,0.22)]">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-violet-300/75">
                Best next proof
              </p>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em] text-white">
                Run the demo on a real company.
              </h3>
              <p className="mt-4 text-[0.95rem] leading-7 text-zinc-300">
                If the hook, evidence, and workflow hold up on an account you actually care about, that is more valuable than placeholder logos or invented testimonials.
              </p>
              <div className="mt-8">
                <Link
                  href="#demo"
                  className="inline-flex items-center rounded-full border border-violet-400/35 bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_36px_rgba(139,92,246,0.26)] transition-all duration-200 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]"
                >
                  Try it now
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
