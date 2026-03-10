import { HeroHookPreview } from "./hero-hook-preview";
import { Button } from "./ui/button";

const integrations = ["Apollo", "Clay", "Instantly", "Lattice", "Ramp"];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-60 left-1/2 h-[800px] w-[1100px] -translate-x-1/2 rounded-full bg-violet-600/[0.07] blur-[150px]" />
      <div className="pointer-events-none absolute -top-20 left-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-fuchsia-500/[0.04] blur-[120px]" />

      <div className="relative mx-auto grid max-w-[90rem] gap-12 px-6 pb-20 pt-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-10 lg:pb-28 lg:pt-32">
        <div className="max-w-2xl">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-4 py-1.5 text-[0.8125rem] font-medium text-violet-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            Evidence-backed outbound
          </span>

          <h1 className="text-[clamp(3rem,5.5vw,5.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-white">
            Cold outreach that cites its sources.
          </h1>

          <p className="mt-6 max-w-xl text-[clamp(1.0625rem,1.5vw,1.3125rem)] leading-[1.55] text-zinc-400">
            Paste a company URL, pick a buyer role, and get
            <span className="text-zinc-200"> hooks</span> &mdash; personalized
            conversation starters grounded in real evidence with a quote, source,
            and date attached to every one.
          </p>

          <p className="mt-3 text-[0.875rem] text-zinc-500/80 tracking-[0.01em]">
            No invented facts. No stored URLs. Weak evidence is labeled or skipped.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a href="#demo">
              <Button size="lg">
                Try the live demo
                <svg
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </a>

            <a href="#how-it-works">
              <Button variant="secondary" size="lg">
                See how it works
                <svg
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Button>
            </a>
          </div>

          <div className="mt-14 border-t border-white/[0.06] pt-7">
            <p className="text-[0.8125rem] font-medium text-zinc-500">
              Works on top of
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {integrations.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-full border border-zinc-700/40 bg-zinc-800/30 px-3.5 py-1.5 text-[0.8125rem] font-semibold tracking-[-0.01em] text-zinc-500 transition-colors hover:text-zinc-400 hover:border-zinc-600/50"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <HeroHookPreview />
      </div>
    </section>
  );
}
