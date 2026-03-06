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

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3 lg:mt-20">
          {[
            {
              step: "1",
              title: "Paste a URL or import leads",
              desc: "Drop in a single domain for instant hooks, or upload your lead list from Apollo, Clay, or any CRM to run full sequences.",
            },
            {
              step: "2",
              title: "We research signals & score intent",
              desc: "We scan public sources for evidence you can cite, plus detect buying signals (hiring, funding, tech changes) to score each lead as hot, warm, or cold.",
            },
            {
              step: "3",
              title: "Multi-channel outreach, evidence-backed",
              desc: "Get Trigger / Risk / Tradeoff hooks for email, LinkedIn, cold calls, and video scripts. Each angle includes a quote + source title/date.",
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

        <div className="mx-auto mt-8 grid max-w-5xl gap-5 lg:grid-cols-2">
          <div className="group rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5">
            <h3 className="text-[1.1875rem] font-bold text-white mb-3">
              Sequences run autonomously
            </h3>
            <p className="text-[0.9375rem] leading-[1.6] text-zinc-400">
              Assign a multi-step sequence and the engine handles execution — sending emails, drafting LinkedIn messages for your approval, and auto-pausing on replies or OOO.
            </p>
          </div>

          <div className="group rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5">
            <h3 className="text-[1.1875rem] font-bold text-white mb-3">
              Replies classified, next steps suggested
            </h3>
            <p className="text-[0.9375rem] leading-[1.6] text-zinc-400">
              Inbound replies are auto-classified (interested, objection, OOO, wrong person) and a suggested response is drafted in your inbox — so you can respond in seconds.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
