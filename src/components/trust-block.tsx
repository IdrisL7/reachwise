"use client";

import { Reveal } from "./ui/reveal";

const trustItems = [
  "Every opening line includes a cited snippet, source title, date, and link.",
  "Weak evidence is labeled low-confidence or not generated at all.",
  "Nothing you enter is stored. URLs are processed and discarded.",
  "Signals are verified against public sources — no hearsay, no fabricated context.",
];

export function TrustBlock() {
  return (
    <section aria-label="Trust and transparency" className="border-t border-white/[0.06] bg-[#0c0c14]/50">
      <div className="mx-auto max-w-5xl px-6 py-12 lg:py-16">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((text, i) => (
            <Reveal key={text.slice(0, 24)} delay={i * 0.08}>
              <li className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-violet-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <p className="text-[0.875rem] leading-[1.55] text-zinc-400">{text}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
