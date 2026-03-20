import { Reveal } from "./ui/reveal";

const featured = {
  title: "Drop into Apollo, Clay, Outreach, or any CRM via CSV",
  description:
    "Export personalised openers + evidence anywhere. Single-company or batch mode (up to 20 URLs), full CSV with opener text, evidence snippet, source, date, and tier.",
};

const others = [
  {
    title: "Role-aware opening lines",
    description:
      "VP Sales vs RevOps vs Founder — pick the role and opening lines are framed for that buyer's priorities.",
  },
  {
    title: "Sources cited on every message",
    description:
      "Quote + source + date on every message. SDRs can defend what they send.",
  },
  {
    title: "Confidence scoring on every hook",
    description:
      "Tier A = first-party, fresh, anchored to the company. Tier B = secondary. Weak signals are labeled or skipped — never dressed up as strong ones.",
  },
];

export function FollowUpEngineSection() {
  return (
    <section
      aria-labelledby="features-heading"
      className="border-t border-white/[0.06] bg-[#0a0a0b]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="features-heading"
              className="font-[family-name:var(--font-display)] text-[clamp(2rem,3vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white"
            >
              What you get — without replacing your stack.
            </h2>
          </div>
        </Reveal>

        {/* Asymmetric layout: 1 large + 3 stacked */}
        <div className="mx-auto mt-16 max-w-5xl grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:mt-20">
          {/* Featured large card */}
          <Reveal delay={0.08}>
            <div className="h-full rounded-xl border border-zinc-700/20 bg-[#111118] p-8 flex flex-col justify-center">
              <h3 className="text-[1.25rem] font-bold text-zinc-100 mb-2">
                {featured.title}
              </h3>
              <p className="text-[0.9375rem] leading-[1.65] text-zinc-400">
                {featured.description}
              </p>
            </div>
          </Reveal>

          {/* 3 stacked smaller cards */}
          <div className="space-y-4">
            {others.map((item, i) => (
              <Reveal key={item.title} delay={0.16 + i * 0.08}>
                <div className="rounded-xl border border-zinc-700/20 bg-[#111118] p-5">
                  <h3 className="text-[1rem] font-semibold text-zinc-100 mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-[0.875rem] leading-[1.55] text-zinc-400">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
