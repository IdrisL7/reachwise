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
      className="border-t border-white/[0.06] bg-[#0a0a0b]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-20 lg:px-10 lg:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="features-heading"
              className="font-[family-name:var(--font-display)] text-[clamp(2rem,3vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white"
            >
              What you get after the hook is written.
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
