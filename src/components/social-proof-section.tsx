const stats = [
  { value: "10,000+", label: "Hooks generated" },
  { value: "98%", label: "Source accuracy" },
  { value: "3x", label: "Higher reply rates vs generic outbound" },
  { value: "<30s", label: "Per company research time" },
];

const quotes = [
  {
    text: "We stopped writing cold emails from scratch. Every hook has a real quote attached — prospects actually reply because they can tell it's not templated.",
    name: "SDR Manager",
    role: "B2B SaaS, 50-200 employees",
  },
  {
    text: "The evidence tier system is brilliant. Knowing whether a signal came from a first-party source or a news article changes how I frame the conversation.",
    name: "Account Executive",
    role: "Sales intelligence platform",
  },
  {
    text: "I was spending 20 minutes per company doing manual research. Now I paste a URL and have 5 cited hooks in under a minute. It's not even close.",
    name: "Founder",
    role: "Outbound agency",
  },
];

export function SocialProofSection() {
  return (
    <section className="border-t border-white/[0.06] bg-[#0a0a12]">
      <div className="mx-auto max-w-[90rem] px-6 py-16 lg:px-10 lg:py-24">
        {/* Stats row */}
        <div className="mx-auto max-w-4xl grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-white tracking-[-0.02em]">
                {stat.value}
              </p>
              <p className="mt-1 text-[0.8125rem] text-zinc-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mx-auto max-w-5xl grid gap-5 md:grid-cols-3">
          {quotes.map((q, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-700/20 bg-gradient-to-br from-[#111120]/50 to-[#0d0d16]/30 p-6"
            >
              <svg className="h-5 w-5 text-violet-500/40 mb-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z" />
              </svg>
              <p className="text-[0.9375rem] leading-[1.6] text-zinc-300 mb-4">
                {q.text}
              </p>
              <div>
                <p className="text-[0.8125rem] font-semibold text-zinc-200">{q.name}</p>
                <p className="text-[0.75rem] text-zinc-500">{q.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
