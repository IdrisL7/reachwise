"use client";

import { useRouter } from "next/navigation";

const TEMPLATES = [
  {
    title: 'The Funding Moment',
    signal: 'New Funding',
    color: 'bg-orange-500',
    trigger: 'Company closes a funding round',
    hook: 'Saw [Company] close their [round] — congrats. Every post-raise team I\'ve worked with faces the same pressure: show pipeline growth before the board\'s next check-in. Mind if I share how we helped a similar team 3x their reply rate in the first 60 days post-raise?',
    promise: 'I\'ll send you the exact playbook we used within 24 hours.',
  },
  {
    title: 'The Expansion Pivot',
    signal: 'New Office / Geo',
    color: 'bg-blue-500',
    trigger: 'Company announces a new market or office',
    hook: 'Noticed [Company] just opened a [City] office — entering a new market means you need to fill pipeline fast before local competitors dig in. We helped a fintech entering EMEA generate 40 qualified meetings in their first quarter. Worth a quick look at how?',
    promise: 'I\'ll send you the 5-step sequence we used, no strings attached.',
  },
  {
    title: 'The Partnership Hook',
    signal: 'Press Release',
    color: 'bg-purple-500',
    trigger: 'Company announces a notable partnership',
    hook: 'Saw the [Company] × [Partner] announcement — partnerships like that usually mean you\'re moving upmarket or trying to reach a buyer segment you couldn\'t access alone. I help BD-heavy teams turn partner press into outbound sequences before the hype fades. Worth 15 minutes?',
    promise: 'I can have a 3-email sequence built off your announcement in 48 hours.',
  },
  {
    title: 'The Tech Migration',
    signal: 'Platform Change',
    color: 'bg-green-500',
    trigger: 'Company migrates to a new stack or platform',
    hook: 'Spotted [Company] moved from [OldStack] to [NewStack] — infra changes like that almost always open a 90-day window where teams are re-evaluating every adjacent vendor. I help sales teams identify and reach those accounts before competitors do. Curious if your ICP has any in that window right now?',
    promise: 'I\'ll map your top accounts against active migration signals and send it over.',
  },
  {
    title: 'The Hiring Signal',
    signal: 'Job Postings',
    color: 'bg-red-500',
    trigger: 'Company posts roles that reveal intent',
    hook: 'Noticed [Company] posted [N] [Role] roles in the last 30 days — that pattern is one of the clearest signals that a specific initiative is already funded and on the roadmap. We used this exact trigger to book 14 meetings for a client before their competitors even noticed the postings. Want to see how?',
    promise: 'I\'ll show you which of your ICP accounts are in active hiring cycles right now.',
  },
  {
    title: 'The Product Launch',
    signal: 'Feature Release',
    color: 'bg-cyan-500',
    trigger: 'Company ships a notable new product or feature',
    hook: 'Saw [Company] just shipped [Feature] — product launches are the clearest signal a team is doubling down on a specific customer segment. I help growth teams turn launch moments into targeted outreach that reaches the exact buyers the feature was built for. Worth mapping yours?',
    promise: 'I\'ll identify your highest-conversion ICP segment for this launch and build the sequence.',
  },
];

const TemplatesView = () => {
  const router = useRouter();
  return (
  <div className="p-8 bg-[#030014]">
    <h2 className="text-3xl font-bold mb-2">Signal Angles</h2>
    <p className="text-sm text-slate-500 mb-8">Six proven hooks — each triggered by a buying signal, each ending with a concrete promise.</p>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {TEMPLATES.map((template, i) => (
        <div key={i} className="bg-[#111111] border border-white/5 rounded-2xl p-6 relative overflow-hidden group flex flex-col">
          <div className={`absolute top-0 right-0 w-24 h-24 ${template.color} opacity-5 blur-[40px] group-hover:opacity-20 transition-all`} />

          {/* Header */}
          <div className="relative z-10 mb-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h4 className="font-bold leading-snug">{template.title}</h4>
              <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400`}>
                {template.signal}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">Fires when: <span className="text-slate-500">{template.trigger}</span></p>
          </div>

          {/* Hook preview */}
          <div className="relative z-10 flex-1 p-3 bg-black/40 rounded-lg mb-3">
            <p className="text-[11px] text-slate-300 leading-relaxed italic">
              &ldquo;{template.hook}&rdquo;
            </p>
          </div>

          {/* Promise callout */}
          <div className={`relative z-10 px-3 py-2 rounded-lg border border-white/5 bg-white/[0.02] mb-4`}>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 mb-0.5">Promise</p>
            <p className="text-[11px] text-slate-400">{template.promise}</p>
          </div>

          <button
            onClick={() => router.push("/app/hooks")}
            className="w-full py-2 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 hover:scale-[1.02] active:scale-[0.98] relative z-10 transition-transform"
          >
            Use This Angle
          </button>
        </div>
      ))}
    </div>
  </div>
  );
};

export default function TemplatesPage() {
  return <TemplatesView />;
}
