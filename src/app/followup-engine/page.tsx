import type { Metadata } from "next";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Follow-Up Engine — GetSignalHooks",
  description:
    "Automate multi-channel follow-ups with guardrails. Import leads, generate signal-backed sequences, and execute safely with approvals, caps, and stop-on-reply.",
  alternates: {
    canonical: "https://www.getsignalhooks.com/followup-engine",
  },
};

const steps = [
  {
    number: "1",
    title: "Import leads via API",
    description:
      "Push leads from Apollo, Clay, Google Sheets, or any CRM into GetSignalHooks with a single API call. Each lead is assigned to a follow-up sequence and tracked automatically — no spreadsheets, no manual list management.",
  },
  {
    number: "2",
    title: "Research-backed hook generation",
    description:
      "For every lead, GetSignalHooks crawls the company's public web presence and generates signal-backed opening lines anchored on real signals — recent news, product launches, job postings, case studies, and more. Each follow-up gets a fresh angle so your sequence never feels repetitive.",
  },
  {
    number: "3",
    title: "AI-generated follow-up emails",
    description:
      "The Follow-Up Engine takes the best hook and writes a complete follow-up email — subject line and body — tailored to the lead's company and role. It automatically rotates between trigger, risk, and tradeoff angles across the sequence, and applies quality gates to block generic copy.",
  },
  {
    number: "4",
    title: "Automated sending, tracking, and reporting",
    description:
      "Emails go out on schedule, automatically. Each send is logged, replies are detected and stop the sequence, and your dashboard updates in real time — no manual intervention needed.",
  },
];

export default function FollowUpEnginePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0b] text-zinc-100 font-[family-name:var(--font-body)]">
      <Navbar />

      <main className="mx-auto max-w-3xl px-6 pb-28 pt-32 lg:pt-40">
        {/* Header */}
        <div className="mb-16">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            Follow-Up Engine
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(2.25rem,4vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white">
            Automated follow-ups, powered by real research
          </h1>
          <p className="mt-5 text-[1.0625rem] leading-[1.7] text-zinc-400">
            Most follow-up sequences blast the same template with a different
            subject line. The Follow-Up Engine is different: every email is
            backed by fresh evidence from the lead's company, with a new angle
            each time. It plugs into your existing workflow and runs hands-free.
          </p>
          <p className="mt-4 text-[0.9375rem] text-zinc-500">
            Available on the{" "}
            <span className="font-medium text-violet-400">Pro</span>{" "}
            plan.
          </p>
        </div>

        {/* How it works */}
        <h2 className="mb-8 text-[1.5rem] font-bold text-white">
          How it works
        </h2>

        <div className="space-y-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-6 shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-[0.9375rem] font-bold text-violet-400">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-[1.0625rem] font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[0.9375rem] leading-[1.7] text-zinc-400">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Powered by */}
        <div className="mt-16 rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)]">
          <h3 className="mb-4 text-[1.0625rem] font-bold text-white">
            Powered by
          </h3>
          <ul className="space-y-3 text-[0.9375rem] leading-[1.6] text-zinc-400">
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              <span>
                <span className="font-medium text-zinc-300">
                  GetSignalHooks
                </span>{" "}
                — evidence-based hook generation from real public signals
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              <span>
                <span className="font-medium text-zinc-300">
                  Follow-Up Engine API
                </span>{" "}
                — lead tracking, sequence state, and AI email generation
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
              <span>
                <span className="font-medium text-zinc-300">n8n</span> —
                workflow automation for scheduling, sending, and recording
              </span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/#pricing"
            className="flex h-11 items-center justify-center rounded-lg bg-violet-600 px-6 text-[0.875rem] font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.2)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97]"
          >
            See plans
          </Link>
          <Link
            href="/contact"
            className="flex h-11 items-center justify-center rounded-lg border border-zinc-600/40 px-6 text-[0.875rem] font-semibold text-zinc-300 transition-all duration-200 hover:border-violet-500/40 hover:text-white hover:scale-[1.02] hover:shadow-[0_2px_12px_rgba(139,92,246,0.06)]"
          >
            Talk to us
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
