import Link from "next/link";

export function WaitlistCTA() {
  return (
    <section
      id="waitlist"
      className="relative overflow-hidden border-t border-white/[0.06]"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/[0.05] blur-[120px]" />

      <div className="relative mx-auto max-w-3xl px-6 py-28 text-center lg:py-40">
        <h2 className="text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
          GetSignalHooks is in early access.
        </h2>
        <p className="mx-auto mt-6 max-w-md text-[clamp(1.0625rem,1.5vw,1.3125rem)] leading-[1.55] text-zinc-400">
          First 50 users get founder-level support and pricing that never moves
          on them.
        </p>

        <Link
          href="/contact"
          className="group mt-12 inline-flex h-[3.5rem] items-center gap-2 rounded-lg bg-violet-600 px-8 text-[1.0625rem] font-semibold tracking-[-0.01em] text-white shadow-[0_0_24px_rgba(139,92,246,0.25)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_36px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080808]"
        >
          Request early access
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
        </Link>
      </div>
    </section>
  );
}
