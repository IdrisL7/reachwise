export function PricingSection() {
  return (
    <section
      id="pricing"
      className="border-t border-white/[0.06] bg-[#0b0b10]"
    >
      <div className="mx-auto max-w-[90rem] px-6 py-28 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            Pricing
          </p>
          <h2 className="text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
            Pricing that fits how you already do outbound
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-zinc-400">
            Keep your existing lists and tools. Use GetSignalHooks as the
            evidence-first layer that makes your messages worth sending.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3 lg:mt-20">
          {/* Starter */}
          <div className="group rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5">
            <h3 className="text-[1.1875rem] font-bold text-white">
              Starter
            </h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-[2.75rem] font-bold tracking-tight text-white">
                $29
              </span>
              <span className="text-[0.875rem] text-zinc-500">/month</span>
            </div>
            <p className="mt-3 text-[0.9375rem] leading-[1.6] text-zinc-400">
              For founders and solo reps sharpening every send.
            </p>
            <ul className="mt-6 space-y-3 text-[0.875rem] leading-[1.5] text-zinc-400">
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                ~200 single-URL generations per month
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Batch mode for up to 10 URLs at a time
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Hooks with evidence snippets from company URLs
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Works with leads from Apollo, Clay, Sheets, etc.
              </li>
            </ul>
            <p className="mt-6 text-[0.8125rem] leading-[1.5] text-zinc-500">
              Best for founders doing their own outbound and solo SDRs testing
              angles without hours of manual research.
            </p>
            <a
              href="#waitlist"
              className="mt-6 flex h-11 items-center justify-center rounded-lg border border-zinc-600/40 text-[0.875rem] font-semibold text-zinc-300 transition-all duration-200 hover:border-violet-500/40 hover:text-white hover:scale-[1.02] hover:shadow-[0_2px_12px_rgba(139,92,246,0.06)]"
            >
              Get started
            </a>
          </div>

          {/* Team (highlighted) */}
          <div className="group rounded-xl border border-violet-500/30 bg-gradient-to-br from-[#15132a]/80 to-[#0f0f18]/60 p-7 shadow-[0_2px_24px_rgba(139,92,246,0.08)] transition-all duration-300 hover:border-violet-500/50 hover:shadow-[0_4px_32px_rgba(139,92,246,0.12)] hover:-translate-y-0.5 relative">
            <div className="absolute -top-3 left-7 rounded-full bg-violet-600 px-3 py-0.5 text-[0.6875rem] font-bold text-white shadow-[0_0_12px_rgba(139,92,246,0.3)]">
              Popular
            </div>
            <h3 className="text-[1.1875rem] font-bold text-white">Team</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-[2.75rem] font-bold tracking-tight text-white">
                $79
              </span>
              <span className="text-[0.875rem] text-zinc-500">/month</span>
            </div>
            <p className="mt-3 text-[0.9375rem] leading-[1.6] text-zinc-400">
              For small teams that want research-grade hooks without slowing
              down.
            </p>
            <ul className="mt-6 space-y-3 text-[0.875rem] leading-[1.5] text-zinc-400">
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                ~750 single-URL generations per month
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Batch mode for up to 75 URLs at a time
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                URL to hooks to email subjects in minutes
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Export-friendly output for Apollo, Clay, sequencers
              </li>
            </ul>
            <p className="mt-6 text-[0.8125rem] leading-[1.5] text-zinc-500">
              Best for SDR / BDR teams and boutiques or agencies running
              outbound for a few clients.
            </p>
            <a
              href="#waitlist"
              className="mt-6 flex h-11 items-center justify-center rounded-lg bg-violet-600 text-[0.875rem] font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.2)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97]"
            >
              Get started
            </a>
          </div>

          {/* Pro */}
          <div className="group rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5">
            <h3 className="text-[1.1875rem] font-bold text-white">Pro</h3>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-[2.75rem] font-bold tracking-tight text-white">
                $149
              </span>
              <span className="text-[0.875rem] text-zinc-500">/month</span>
            </div>
            <p className="mt-3 text-[0.9375rem] leading-[1.6] text-zinc-400">
              For teams that live in outbound.
            </p>
            <ul className="mt-6 space-y-3 text-[0.875rem] leading-[1.5] text-zinc-400">
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Effectively unlimited single-URL generations (fair use)
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Higher-volume batch features as they roll out
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Always-on URL to hooks to emails for your funnel
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
                Best access to new features and richer exports
              </li>
            </ul>
            <p className="mt-6 text-[0.8125rem] leading-[1.5] text-zinc-500">
              Best for agencies running outbound across many clients and
              high-volume SDR orgs that need consistent, researched hooks every
              day.
            </p>
            <a
              href="#waitlist"
              className="mt-6 flex h-11 items-center justify-center rounded-lg border border-zinc-600/40 text-[0.875rem] font-semibold text-zinc-300 transition-all duration-200 hover:border-violet-500/40 hover:text-white hover:scale-[1.02] hover:shadow-[0_2px_12px_rgba(139,92,246,0.06)]"
            >
              Get started
            </a>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-5xl rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)]">
          <h3 className="text-[1.0625rem] font-bold text-white mb-3">
            All plans include
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Evidence-first hooks anchored on real public signals
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Signal, Implication, Question structure baked in
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Angle tags (pain / gain / contrast) and confidence levels
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              Evidence snippets and source titles for every hook
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
