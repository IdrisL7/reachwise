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
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-zinc-400">
            GetSignalHooks is an evidence-first hook layer for outbound. It sits
            on top of your existing tools and turns company URLs into hooks and
            emails grounded in real signals.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3 lg:mt-20">
          {[
            {
              step: "1",
              title: "Paste a URL",
              desc: "Drop in a prospect\u2019s company URL and (optionally) a line about your offer.",
            },
            {
              step: "2",
              title: "Get hooks with evidence",
              desc: "GetSignalHooks scans public sources and returns hooks in Signal \u2192 Implication \u2192 Question format, each with an evidence snippet.",
            },
            {
              step: "3",
              title: "Turn hooks into emails",
              desc: "Pick a hook and generate a full email you can drop into Apollo, Clay, Instantly, or your sequencer in a click.",
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
              The Signal &rarr; Implication &rarr; Question doctrine
            </h3>
            <p className="text-[0.9375rem] leading-[1.6] text-zinc-400 mb-4">
              Every hook follows a simple, strict structure:
            </p>
            <ul className="space-y-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
              <li>
                <span className="font-semibold text-zinc-200">Signal</span>{" "}
                &ndash; a concrete fact about the company.
              </li>
              <li>
                <span className="font-semibold text-zinc-200">
                  Implication
                </span>{" "}
                &ndash; why that signal matters to the prospect.
              </li>
              <li>
                <span className="font-semibold text-zinc-200">Question</span>{" "}
                &ndash; a clear next step that invites a reply.
              </li>
            </ul>
            <p className="mt-4 text-[0.875rem] leading-[1.6] text-zinc-500">
              Hooks are tagged with angle (trigger / risk / tradeoff), confidence
              level, and include the evidence snippet and source title so reps
              can see exactly what the message is based on.
            </p>
          </div>

          <div className="group rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5">
            <h3 className="text-[1.1875rem] font-bold text-white mb-3">
              Fits on top of your stack
            </h3>
            <p className="text-[0.9375rem] leading-[1.6] text-zinc-400">
              GetSignalHooks is not a CRM, not a sequencer, and not a lead
              database. It plugs into your existing lists and tools. Use it
              before you push accounts into Apollo, Clay, Instantly, or your CRM
              to make sure every message starts from a real signal instead of a
              guess.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
