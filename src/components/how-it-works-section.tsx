const steps = [
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
    title: "Generate a full email from any hook in one click",
    desc: "Every hook comes with a \u201cDraft email\u201d button. One click turns the hook and its evidence into a short, ready-to-send cold email you can copy straight into your outbound tool.",
  },
  {
    step: "4",
    title: "Export hooks + evidence to CSV, Apollo, Clay, or your CRM",
    desc: "Single-company or batch mode (up to 20 URLs at once). Export the full set\u2014hook text, evidence snippet, source, date, and tier\u2014as a CSV you can drop into any tool you already use.",
  },
  {
    step: "5",
    title: "Send with receipts \u2014 and defend every message you send",
    desc: "Every hook ships with a quote, source, and date attached. Your reps know exactly what they\u2019re citing and why it\u2019s relevant. No invented claims, no hallucinations, no awkward follow-ups.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="border-t border-white/[0.06] bg-[#0b0b10]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            How it works
          </p>
          <h2 className="text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
            How GetSignalHooks works
          </h2>
        </div>

        {/* Vertical timeline layout */}
        <div className="mx-auto mt-16 max-w-2xl lg:mt-20">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-violet-500/40 via-violet-500/20 to-transparent" />

            <div className="space-y-8">
              {steps.map((item, i) => (
                <div
                  key={item.step}
                  className="relative pl-14 group"
                >
                  {/* Numbered circle */}
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-violet-500/30 bg-[#0b0b10] text-[0.875rem] font-bold text-violet-400 transition-all duration-300 group-hover:border-violet-500/60 group-hover:bg-violet-600/10 group-hover:shadow-[0_0_16px_rgba(139,92,246,0.15)]">
                    {item.step}
                  </div>

                  {/* Content */}
                  <div className="rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)]">
                    <h3 className="text-[clamp(1.125rem,1.5vw,1.3125rem)] font-bold leading-[1.2] text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
                      {item.desc}
                    </p>
                  </div>

                  {/* Connector dot on the line */}
                  {i < steps.length - 1 && (
                    <div className="absolute left-[18px] bottom-[-16px] h-1.5 w-1.5 rounded-full bg-violet-500/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
