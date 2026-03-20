"use client";

import Link from "next/link";
import { Reveal } from "./ui/reveal";

const proofPoints = [
  { label: "Source cited on every hook", detail: "Quote, URL, publication date — included by default." },
  { label: "Weak signals are labeled, not dressed up", detail: "Tier A = first-party and fresh. Tier B = secondary. Low confidence is flagged." },
  { label: "Your URLs are never stored", detail: "Processed, used to generate, then discarded." },
  { label: "Verified against public sources", detail: "No hearsay, no fabricated context — every signal traces to a real, checkable URL." },
];

export function SocialProofSection() {
  return (
    <section
      aria-labelledby="social-proof-heading"
      className="border-t border-zinc-200/80 bg-[#f5f4f0]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-12 lg:px-10 lg:py-16">
        <Reveal>
          <p className="mb-5 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-zinc-600">
            How it&apos;s different
          </p>
          <h2
            id="social-proof-heading"
            className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-zinc-900 max-w-2xl"
          >
            Built for reps who get called out on bad outreach.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {proofPoints.map((p, i) => (
            <Reveal key={p.label} delay={i * 0.08}>
              <div className="border-t border-zinc-300/70 pt-5">
                <p className="text-[0.9375rem] font-semibold text-zinc-800 leading-[1.4]">{p.label}</p>
                <p className="mt-2 text-[0.875rem] leading-[1.55] text-zinc-600">{p.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="mt-10">
            <Link
              href="#pricing"
              className="text-[0.875rem] font-medium text-zinc-700 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0] rounded-sm"
            >
              See pricing →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
