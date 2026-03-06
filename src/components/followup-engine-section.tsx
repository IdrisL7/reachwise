import Link from "next/link";

const steps = [
  {
    number: "1",
    title: "Import leads & assign sequences",
    description:
      "Push leads from Apollo, Clay, or any CRM via API. Assign multi-channel sequences (email, LinkedIn, cold call, video) or use a pre-built template.",
  },
  {
    number: "2",
    title: "Intent scoring prioritizes your pipeline",
    description:
      "We detect buying signals — hiring, funding, tech changes — and score each lead as hot, warm, or cold so you focus on the right prospects first.",
  },
  {
    number: "3",
    title: "AI generates channel-specific outreach",
    description:
      "Each touchpoint gets a unique message crafted for its channel. Email follow-ups, LinkedIn connection requests, call openers, and video scripts — all evidence-backed.",
  },
  {
    number: "4",
    title: "Autonomous execution with smart safeguards",
    description:
      "The engine sends emails automatically, saves non-email content as drafts for your approval, auto-pauses on OOO or bounces, and classifies replies so you never miss a signal.",
  },
];

const transparency = [
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    title: "What it reads from",
    description:
      "Lead list, outbound history, sequence config, and public company signals (hiring pages, funding news, tech updates). We integrate via CSV/CRM exports and n8n, not by taking over your stack.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: "What triggers the next step",
    description:
      "When a lead's delay window passes and they haven't replied or been paused, the engine generates the next touchpoint — email, LinkedIn message, call script, or video — based on the sequence you defined.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
      </svg>
    ),
    title: "What gets logged where",
    description:
      "Every message is logged with lead ID, step, channel, subject, and body. Replies are classified (interested, objection, OOO, etc.) and surfaced in your inbox. Sync everything back to your CRM via n8n.",
  },
  {
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    ),
    title: "Security & data handling",
    description:
      "We store lead email, company URL, and sequence state. No inbox access. No CRM write-back without your explicit n8n workflow. Approval mode lets you review every message before it sends.",
  },
];

export function FollowUpEngineSection() {
  return (
    <section className="border-t border-white/[0.06] bg-[#0a0a12]">
      <div className="mx-auto max-w-[90rem] px-6 py-28 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            Autonomous Outbound Engine
          </p>
          <h2 className="text-[clamp(2rem,3vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white">
            Multi-channel sequences that run on autopilot
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-zinc-400">
            Import leads, assign a sequence, and let the engine handle the rest.
            It scores intent, generates channel-specific outreach, sends or
            queues for approval, and classifies replies — so you never drop a lead.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-2 lg:mt-20">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
            >
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/15 text-[0.875rem] font-bold text-violet-400">
                {step.number}
              </div>
              <h3 className="text-[1.0625rem] font-semibold text-white">
                {step.title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* What it actually touches (RevOps transparency) */}
        <div className="mx-auto mt-20 max-w-3xl">
          <div className="mb-10 text-center">
            <h3 className="text-[1.5rem] font-bold tracking-[-0.01em] text-white">
              What the Outbound Engine actually does (and doesn&apos;t do)
            </h3>
          </div>

          <div className="flex flex-col gap-5">
            {transparency.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-zinc-700/20 bg-gradient-to-br from-[#111120]/50 to-[#0d0d16]/30 p-6"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/10 text-violet-400">
                    {item.icon}
                  </div>
                  <h4 className="text-[1rem] font-semibold text-zinc-100">
                    {item.title}
                  </h4>
                </div>
                <p className="text-[0.9375rem] leading-[1.65] text-zinc-400">
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
            Learn how it works
          </Link>
        </div>

        {/* Availability */}
        <div className="mx-auto mt-16 max-w-lg rounded-xl border border-zinc-700/20 bg-[#0c0c16]/60 px-6 py-5 text-center">
          <p className="text-[0.9375rem] text-zinc-400">
            The Autonomous Outbound Engine is included in:
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
            Pro — multi-channel sequences, intent scoring, and reply intelligence on autopilot.
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
