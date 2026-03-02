import Link from "next/link";

const steps = [
  {
    number: "1",
    title: "Import your leads",
    description:
      "Push leads from Apollo, Clay, or any CRM via API. Each lead enters a follow-up sequence automatically.",
  },
  {
    number: "2",
    title: "GetSignalHooks researches each company",
    description:
      "Fresh, evidence-based hooks are generated for every lead using real public signals from their company URL.",
  },
  {
    number: "3",
    title: "AI writes the follow-up",
    description:
      "Each email is crafted with a unique angle — no templates, no repeats. The engine rotates between pain, gain, and contrast hooks.",
  },
  {
    number: "4",
    title: "n8n sends and tracks",
    description:
      "An n8n workflow checks for due follow-ups on a schedule, sends the emails, and records everything. You monitor results from the dashboard.",
  },
];

export function FollowUpEngineSection() {
  return (
    <section className="border-t border-white/[0.06] bg-[#0a0a12]">
      <div className="mx-auto max-w-[90rem] px-6 py-28 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            Follow-Up Engine
          </p>
          <h2 className="text-[clamp(2rem,3vw,3rem)] font-bold leading-[1.08] tracking-[-0.02em] text-white">
            Automated follow-ups that actually sound human
          </h2>
          <p className="mt-5 text-[1.0625rem] leading-[1.6] text-zinc-400">
            Stop writing follow-ups by hand. The Follow-Up Engine watches your
            outbound, generates research-backed emails with fresh angles, and
            sends them on schedule — so you never drop a lead.
          </p>
          <p className="mt-3 text-[0.875rem] text-zinc-500">
            Available on{" "}
            <span className="font-medium text-violet-400">Pro</span> and{" "}
            <span className="font-medium text-violet-400">Concierge</span>{" "}
            plans.
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

        <div className="mt-12 flex justify-center gap-4">
          <Link
            href="/followup-engine"
            className="flex h-11 items-center justify-center rounded-lg bg-violet-600 px-6 text-[0.875rem] font-semibold text-white shadow-[0_0_16px_rgba(139,92,246,0.2)] transition-all duration-200 hover:bg-violet-500 hover:shadow-[0_0_24px_rgba(139,92,246,0.35)] hover:scale-[1.02] active:scale-[0.97]"
          >
            Learn how it works
          </Link>
        </div>
      </div>
    </section>
  );
}
