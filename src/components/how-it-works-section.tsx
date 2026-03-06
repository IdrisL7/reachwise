export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-t border-white/[0.06] bg-[#0b0b10]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-28 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            How it works
          </p>
          <h2 className="text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
            How GetSignalHooks works
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-2 lg:mt-20">
          {[
            {
              step: "1",
              title: "Find real signals (with freshness)",
              desc: "We pull company-specific evidence from first-party sources and reputable coverage. Each signal includes a quote, source, date, and freshness badge.",
            },
            {
              step: "2",
              title: "Draft outreach that matches the buyer\u2019s job",
              desc: "Pick who you\u2019re emailing (VP Sales, RevOps, Founder, etc.). We generate Trigger / Risk / Tradeoff hooks and draft messages that stay grounded in evidence\u2014no invented claims.",
            },
            {
              step: "3",
              title: "Build multi-channel sequences (optional)",
              desc: "Turn hooks into sequences across email, LinkedIn, calls, and video. Start from templates (Email-only, Multi-channel, LinkedIn-first) or build your own in the sequence builder.",
            },
            {
              step: "4",
              title: "Prioritize + execute safely",
              desc: "Intent scoring highlights which accounts are heating up. Then your follow-ups run with guardrails: draft approval (optional), daily caps, quiet hours, stop-on-reply, auto-pause on OOO, and full audit logs.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="group relative overflow-hidden rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5"
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 text-[0.875rem] font-bold text-violet-400 transition-colors duration-300 group-hover:bg-violet-600/15">
                {item.step}
              </div>
              <h3 className="text-[clamp(1.125rem,1.5vw,1.3125rem)] font-bold leading-[1.2] text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-5xl">
          <div className="group rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5">
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 text-[0.875rem] font-bold text-violet-400">
              5
            </div>
            <h3 className="text-[clamp(1.125rem,1.5vw,1.3125rem)] font-bold leading-[1.2] text-white">
              Learn what works
            </h3>
            <p className="mt-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
              Reply classification and analytics show what hooks, angles, and sequences drive replies — so teams improve without guessing.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
