import { HeroHookPreview } from "./hero-hook-preview";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-60 left-1/2 h-[800px] w-[1100px] -translate-x-1/2 rounded-full bg-violet-600/[0.07] blur-[150px]" />
      <div className="pointer-events-none absolute -top-20 left-1/3 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-fuchsia-500/[0.04] blur-[120px]" />

      <div className="relative mx-auto grid max-w-[90rem] gap-12 px-6 pb-24 pt-20 lg:grid-cols-2 lg:items-center lg:gap-20 lg:px-10 lg:pb-36 lg:pt-32">
        <div className="max-w-2xl">
          <span className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.08] px-4 py-1.5 text-[0.8125rem] font-medium text-violet-400">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
            Autonomous outbound platform
          </span>

          <h1 className="text-[clamp(3rem,5.5vw,5.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-white">
            Evidence-backed outbound that runs itself.
          </h1>

          <p className="mt-8 max-w-lg text-[clamp(1.0625rem,1.5vw,1.3125rem)] leading-[1.55] text-zinc-400">
            Research-backed hooks, multi-channel sequences, intent scoring,
            and reply intelligence — so your outbound runs on autopilot
            with evidence SDRs can actually defend.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <a
              href="#demo"
              className="group inline-flex h-[3.5rem] items-center gap-2 rounded-lg bg-violet-600 px-8 text-[1.0625rem] font-semibold tracking-[-0.01em] text-white shadow-[0_0_24px_rgba(139,92,246,0.25)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_36px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
            >
              Generate hooks from a URL
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </a>

            <a
              href="/contact"
              className="group inline-flex h-[3.5rem] items-center gap-2 rounded-lg border border-zinc-700/50 bg-transparent px-8 text-[1.0625rem] font-semibold tracking-[-0.01em] text-zinc-200 transition-all duration-200 hover:border-violet-500/40 hover:text-white hover:scale-[1.02] active:scale-[0.97]"
            >
              Get full access
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </a>
          </div>

          <div className="mt-16 border-t border-white/[0.06] pt-8">
            <p className="text-[0.8125rem] font-medium text-zinc-500">
              Built for outbound teams who are done sending generic openers.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
              {["Lattice", "Ramp", "Clay", "Instantly", "Apollo"].map(
                (name) => (
                  <span
                    key={name}
                    className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-zinc-600"
                  >
                    {name}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>

        <HeroHookPreview />
      </div>
    </section>
  );
}
