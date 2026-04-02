"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./ui/reveal";

export function WaitlistCTA() {
  return (
    <section
      id="start"
      aria-labelledby="start-heading"
      className="relative overflow-hidden border-t border-zinc-200/70 bg-[#f5f4f0]"
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.08),transparent_58%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="relative mx-auto max-w-3xl px-6 py-14 text-center lg:py-18">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">
            Ready when you are
          </p>
          <h2
            id="start-heading"
            className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.03em] text-zinc-900"
          >
            Try it on your next target account.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-xl text-[clamp(1.0625rem,1.5vw,1.3125rem)] leading-[1.65] text-zinc-600">
            Start free, keep your existing stack, and see whether signal-backed outreach improves the quality of what your team sends next.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/register"
              className="group inline-flex h-[3.5rem] items-center gap-2 rounded-full border border-violet-400/30 bg-violet-600 px-8 text-[1.0625rem] font-semibold tracking-[-0.01em] text-white shadow-[0_12px_36px_rgba(139,92,246,0.2)] transition-colors duration-150 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0]"
            >
              Get started free
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
