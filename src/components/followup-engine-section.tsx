import Link from "next/link";

const featured = {
  icon: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v2.25A2.25 2.25 0 006 10.5zm0 9.75h2.25A2.25 2.25 0 0010.5 18v-2.25a2.25 2.25 0 00-2.25-2.25H6a2.25 2.25 0 00-2.25 2.25V18A2.25 2.25 0 006 20.25zm9.75-9.75H18a2.25 2.25 0 002.25-2.25V6A2.25 2.25 0 0018 3.75h-2.25A2.25 2.25 0 0013.5 6v2.25a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  title: "Works on top of Apollo / CRM / Sheets",
  description:
    "Export hooks + evidence anywhere. We layer on top of your existing stack — no migration, no lock-in. Connect via CSV export, API, or direct integrations with tools you already use.",
};

const others = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
    title: "Role-aware questions",
    description:
      "VP Sales vs RevOps vs Founder — pick the role and hooks are framed for that buyer's priorities.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "Receipts attached to every hook",
    description:
      "Quote + source + date on every message. SDRs can defend what they send.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Guardrailed automation",
    description:
      "Approvals, daily caps, stop-on-reply, auto-pause on OOO/bounce, and a full audit trail.",
  },
];

export function FollowUpEngineSection() {
  return (
    <section className="border-t border-white/[0.06] bg-[#0a0a12]">
      <div className="mx-auto max-w-[90rem] px-6 py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            Platform
          </p>
          <h2 className="text-[clamp(2rem,3vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white">
            What you get (without replacing your stack)
          </h2>
        </div>

        {/* Asymmetric layout: 1 large + 3 stacked */}
        <div className="mx-auto mt-16 max-w-5xl grid gap-5 lg:grid-cols-[1.2fr_1fr] lg:mt-20">
          {/* Featured large card */}
          <div className="rounded-xl border border-zinc-700/20 bg-gradient-to-br from-[#111120]/50 to-[#0d0d16]/30 p-8 flex flex-col justify-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/10 text-violet-400">
              {featured.icon}
            </div>
            <h3 className="text-[1.25rem] font-bold text-zinc-100 mb-2">
              {featured.title}
            </h3>
            <p className="text-[0.9375rem] leading-[1.65] text-zinc-400">
              {featured.description}
            </p>
          </div>

          {/* 3 stacked smaller cards */}
          <div className="space-y-4">
            {others.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-zinc-700/20 bg-gradient-to-br from-[#111120]/50 to-[#0d0d16]/30 p-5"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400 shrink-0">
                    {item.icon}
                  </div>
                  <h3 className="text-[1rem] font-semibold text-zinc-100">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[0.875rem] leading-[1.55] text-zinc-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-4">
          <Link
            href="/followup-engine"
            className="flex h-11 items-center justify-center rounded-lg bg-violet-600 px-6 text-[0.875rem] font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.2)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97]"
          >
            Learn how execution works
          </Link>
        </div>

        {/* Availability */}
        <div className="mx-auto mt-16 max-w-lg rounded-xl border border-zinc-700/20 bg-[#0c0c16]/60 px-6 py-5 text-center">
          <p className="text-[0.9375rem] text-zinc-400">
            Autonomous execution with guardrails is included in:
          </p>
          <div className="mt-3 flex items-center justify-center gap-4">
            <span className="rounded-full border border-violet-500/30 bg-violet-600/10 px-4 py-1.5 text-[0.875rem] font-semibold text-violet-300">
              Pro
            </span>
            <span className="text-[0.8125rem] text-zinc-600">&</span>
            <span className="rounded-full border border-violet-500/30 bg-violet-600/10 px-4 py-1.5 text-[0.875rem] font-semibold text-violet-300">
              Concierge
            </span>
          </div>
          <p className="mt-3 text-[0.8125rem] text-zinc-500">
            Pro — multi-channel sequences, intent scoring, and reply intelligence with guardrails.
            <br />
            Concierge — we set it up, run it, and optimize it with you.
          </p>
          <Link
            href="#pricing"
            className="mt-4 inline-flex items-center gap-1.5 text-[0.875rem] font-medium text-violet-400 transition-colors duration-200 hover:text-violet-300"
          >
            See plans
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
