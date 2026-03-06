export function WhoItsForSection() {
  return (
    <section className="border-t border-white/[0.06] bg-[#0b0b10]">
      <div className="mx-auto max-w-[90rem] px-6 py-28 lg:px-10 lg:py-40">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-[0.9375rem] font-semibold text-violet-400">
            Who it is for
          </p>
          <h2 className="text-[clamp(2.25rem,3.5vw,3.75rem)] font-bold leading-[1.04] tracking-[-0.02em] text-white">
            Built for people who live in the inbox
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 sm:grid-cols-3 lg:mt-20">
          {[
            {
              title: "SDRs & BDRs",
              desc: "Evidence-backed hooks across email, LinkedIn, and calls. Approve drafts in your inbox or let sequences run fully autonomous.",
            },
            {
              title: "Agency owners",
              desc: "Multi-channel sequences with intent scoring across all your clients. Scale personalized outreach without sinking hours into research.",
            },
            {
              title: "Founders",
              desc: "Autonomous outbound that prioritizes hot leads and runs multi-step sequences while you focus on closing.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group relative overflow-hidden rounded-xl border border-zinc-700/30 bg-gradient-to-br from-[#131320]/60 to-[#0f0f16]/40 p-7 shadow-[0_2px_16px_rgba(0,0,0,0.2)] transition-all duration-300 hover:border-violet-500/20 hover:shadow-[0_4px_24px_rgba(139,92,246,0.06)] hover:-translate-y-0.5"
            >
              <h3 className="text-[clamp(1.125rem,1.5vw,1.3125rem)] font-bold leading-[1.2] text-white">
                {item.title}
              </h3>
              <p className="mt-2 text-[0.9375rem] leading-[1.6] text-zinc-400">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
