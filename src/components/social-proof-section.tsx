"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Reveal } from "./ui/reveal";

const proofPoints = [
  { label: "Source context stays attached", detail: "Quote, URL, publication date, and evidence quality stay visible from signal to message." },
  { label: "Weak signals are labeled, not dressed up", detail: "Tier A = first-party and fresh. Tier B = secondary. Low confidence is flagged." },
  { label: "Built around workflow, not just copy", detail: "Accounts, Leads, Inbox, and Analytics stay connected so the signal does not disappear after generation." },
  { label: "Verified against public sources", detail: "No hearsay, no fabricated context — every signal traces to a real, checkable URL." },
];

export function SocialProofSection() {
  return (
    <section
      aria-labelledby="social-proof-heading"
      className="relative overflow-hidden border-t border-zinc-200/70 bg-[#f5f4f0]"
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.08),transparent_58%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/20 to-transparent" />

      <div className="relative mx-auto max-w-[90rem] px-6 py-14 lg:px-10 lg:py-18">
        <Reveal>
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-600">
              Why it holds up
            </p>
            <h2
              id="social-proof-heading"
              className="max-w-2xl font-[family-name:var(--font-display)] text-[clamp(2rem,3.4vw,3rem)] font-bold leading-[1.05] tracking-[-0.03em] text-zinc-900"
            >
              Built for teams that need outbound to hold up under scrutiny.
            </h2>
            <p className="mt-4 max-w-2xl text-[1rem] leading-7 text-zinc-600">
              The value here is not just nicer copy. It is the ability to trace each message back to a real signal, see how strong the evidence is, and keep that context attached as work moves forward.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {proofPoints.map((p, i) => (
            <Reveal key={p.label} delay={i * 0.08}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="group h-full rounded-[1.5rem] border border-zinc-200/80 bg-white/70 p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm"
              >
                <div className="mb-4 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-violet-500/80" />
                  <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Signal-safe
                  </span>
                </div>
                <p className="text-[0.95rem] font-semibold leading-[1.45] text-zinc-800">
                  {p.label}
                </p>
                <p className="mt-3 text-[0.875rem] leading-[1.65] text-zinc-600">{p.detail}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <div className="mt-10">
            <Link
              href="#pricing"
              className="inline-flex items-center rounded-full border border-zinc-300/80 bg-white/80 px-4 py-2 text-[0.875rem] font-medium text-zinc-700 transition-colors hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f5f4f0]"
            >
              See pricing →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
