"use client";

import { motion } from "framer-motion";
import { Reveal } from "./ui/reveal";

const featured = {
  title: "Turn one signal into a usable pipeline workflow",
  description:
    "Generate the hook, turn it into a message, move the account into leads and sequences, then review drafts in Inbox with the evidence still attached. GetSignalHooks fits into Apollo, Clay, Outreach, Salesloft, or your CRM without replacing your stack.",
};

const others = [
  {
    title: "Role-aware hooks and follow-ups",
    description:
      "VP Sales vs RevOps vs Founder — the hook, message, and follow-up copy stay framed for that buyer's priorities.",
  },
  {
    title: "Sources cited through the workflow",
    description:
      "Quote + source + date stay attached from the first hook through the email draft, so reps can defend what they send.",
  },
  {
    title: "Queue next actions, not just ideas",
    description:
      "Move from signal discovery to leads, drafts, approvals, and next steps without bouncing between tools or losing the account context.",
  },
];

export function FollowUpEngineSection() {
  return (
    <section
      aria-labelledby="features-heading"
      className="relative overflow-hidden border-t border-white/[0.04] bg-[#0a0a0b]"
    >
      <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(124,58,237,0.12),transparent_58%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/25 to-transparent" />

      <div className="relative mx-auto max-w-[90rem] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-200/70">
              After the first touch
            </p>
            <h2
              id="features-heading"
              className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2rem,3vw,3.1rem)] font-bold leading-[1.08] tracking-[-0.03em] text-white"
            >
              What you get after the hook is written.
            </h2>
            <p className="mt-4 text-[1rem] leading-7 text-zinc-400">
              The value compounds when the signal does not disappear after copy generation. Keep the context attached through leads, sequences, approvals, and follow-up.
            </p>
          </div>
        </Reveal>

        {/* Asymmetric layout: 1 large + 3 stacked */}
        <div className="mx-auto mt-16 max-w-5xl grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:mt-20">
          {/* Featured large card */}
          <Reveal delay={0.08}>
            <motion.div
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="group relative flex h-full flex-col justify-center overflow-hidden rounded-[1.75rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,30,0.98),rgba(12,12,18,0.98))] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.16),transparent_38%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="relative">
                <p className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-violet-200/65">
                  Workflow layer
                </p>
                <h3 className="mb-2 text-[1.25rem] font-bold text-zinc-100">
                  {featured.title}
                </h3>
                <p className="text-[0.9375rem] leading-[1.75] text-zinc-400">
                  {featured.description}
                </p>
              </div>
            </motion.div>
          </Reveal>

          {/* 3 stacked smaller cards */}
          <div className="space-y-4">
            {others.map((item, i) => (
              <Reveal key={item.title} delay={0.16 + i * 0.08}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="group relative overflow-hidden rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(18,18,30,0.98),rgba(12,12,18,0.98))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.12),transparent_34%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="relative">
                    <h3 className="mb-1.5 text-[1rem] font-semibold text-zinc-100">
                      {item.title}
                    </h3>
                    <p className="text-[0.875rem] leading-[1.65] text-zinc-400">
                      {item.description}
                    </p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
