"use client";

const InboxView = () => (
  <div className="p-8 bg-[#030014]">
    <div className="flex justify-between items-center mb-8">
      <h2 className="text-3xl font-bold italic">Draft Triage <span className="text-slate-600 font-normal">(12)</span></h2>
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-white/5 text-xs font-bold rounded-lg border border-white/10 hover:bg-white/10 hover:scale-[1.02] active:scale-[0.98]">Select All</button>
        <button className="px-4 py-2 bg-purple-600 text-xs font-bold rounded-lg shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98]">Approve & Send</button>
      </div>
    </div>
    <div className="space-y-4">
      {[
        { initials: 'JD', name: 'John Doe', company: 'Stripe', preview: 'Hey John, saw Stripe just launched support for crypto payouts in the UK. Given your focus on EMEA growth, I thought...', time: '2m ago' },
        { initials: 'SC', name: 'Sarah Chen', company: 'Notion', preview: 'Hi Sarah, noticed Notion just rolled out their new AI writing assistant. As someone leading product at Notion...', time: '5m ago' },
        { initials: 'MR', name: 'Marcus Rodriguez', company: 'Linear', preview: 'Marcus, saw Linear\'s recent Series B announcement. With that kind of momentum, I imagine scaling your eng team is...', time: '8m ago' }
      ].map((draft, i) => (
        <div key={i} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 flex gap-6 hover:border-purple-500/50 transition-all group">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold">{draft.initials}</div>
          <div className="flex-1">
            <div className="flex justify-between mb-2">
              <h4 className="font-bold">{draft.name} <span className="text-slate-500 font-normal">@ {draft.company}</span></h4>
              <span className="text-[10px] text-slate-600 font-mono">Drafted {draft.time}</span>
            </div>
            <p className="text-sm text-slate-400 italic mb-4">"{draft.preview}"</p>
            <div className="flex gap-3">
              <button className="bg-green-500/10 text-green-400 text-[10px] font-black uppercase px-3 py-1 rounded border border-green-500/20 hover:scale-[1.02] active:scale-[0.98]">Approve</button>
              <button className="bg-slate-800 text-slate-400 text-[10px] font-black uppercase px-3 py-1 rounded hover:scale-[1.02] active:scale-[0.98]">Edit</button>
              <button className="bg-red-500/10 text-red-500 text-[10px] font-black uppercase px-3 py-1 rounded border border-red-500/20 hover:scale-[1.02] active:scale-[0.98]">Reject</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function InboxPage() {
  return <InboxView />;
}