"use client";

import { Reveal } from "./ui/reveal";

const testimonials = [
  {
    quote:
      "Sent this to a VP at Databricks and got a reply in 4 hours. First time that happened in months, and the rep knew exactly why the message worked.",
    name: "Jamie R.",
    role: "Senior SDR",
    company: "Series B SaaS",
  },
  {
    quote:
      "We run Clay enrichment first, then GetSignalHooks for the signal, hook, and draft. The source citation makes it feel like you actually did the research.",
    name: "Marcus T.",
    role: "RevOps Lead",
    company: "",
  },
  {
    quote:
      "Our team of 6 stopped writing custom intros manually. We are moving faster, approving better drafts, and keeping much better context on every account.",
    name: "Sarah K.",
    role: "Head of Outbound",
    company: "",
  },
];

export function TestimonialsSection() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="border-t border-white/[0.06] bg-[#0a0a0b]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-16 lg:px-10 lg:py-24">
        <Reveal>
          <h2
            id="testimonials-heading"
            className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,3vw,2.5rem)] font-bold leading-[1.1] tracking-[-0.02em] text-zinc-100"
          >
            Teams that stopped guessing and started operating from signal.
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <div className="flex flex-col rounded-xl border border-zinc-700/20 bg-[#111118] p-7">
                <span
                  aria-hidden="true"
                  className="mb-4 block font-[family-name:var(--font-display)] text-5xl leading-none text-violet-500/20 select-none"
                >
                  &ldquo;
                </span>
                <p className="flex-1 text-[0.9375rem] leading-[1.6] text-zinc-300">
                  {t.quote}
                </p>
                <div className="mt-6 border-t border-zinc-700/20 pt-5">
                  <p className="text-[0.875rem] font-semibold text-zinc-100">{t.name}</p>
                  <p className="mt-0.5 text-[0.8125rem] text-zinc-500">
                    {t.role}
                    {t.company ? `, ${t.company}` : ""}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
