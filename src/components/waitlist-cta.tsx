"use client";

import Link from "next/link";
import { Reveal } from "./ui/reveal";

export function WaitlistCTA() {
  return (
    <section
      id="start"
      aria-labelledby="start-heading"
      className="relative border-t border-zinc-200/80 bg-[#f5f4f0]"
    >
      <div className="relative mx-auto max-w-3xl px-6 py-12 text-center lg:py-16">
        <Reveal>
          <h2
            id="start-heading"
            className="font-[family-name:var(--font-display)] text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-zinc-900"
          >
            Start running outbound from real signals.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-lg text-[clamp(1.0625rem,1.5vw,1.3125rem)] leading-[1.55] text-zinc-600">
            Start free, keep your existing stack, and move from signals to review-ready drafts without guesswork.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="group inline-flex h-[3.5rem] items-center gap-2 rounded-lg bg-violet-600 px-8 text-[1.0625rem] font-semibold tracking-[-0.01em] text-white transition-colors duration-150 hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0]"
          >
            Get started free
            <svg
              className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
        </Reveal>
      </div>
    </section>
  );
}
