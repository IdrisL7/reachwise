"use client";

const TemplatesView = () => (
  <div className="p-8 bg-[#030014]">
    <h2 className="text-3xl font-bold mb-8">Signal Angles</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[
        { title: 'The Founder "Why"', signal: 'New Funding', color: 'bg-orange-500' },
        { title: 'The Expansion Pivot', signal: 'New Office/Geo', color: 'bg-blue-500' },
        { title: 'The Partnership Hook', signal: 'Press Release', color: 'bg-purple-500' },
        { title: 'The Tech Migration', signal: 'Platform Change', color: 'bg-green-500' },
        { title: 'The Hiring Signal', signal: 'Job Postings', color: 'bg-red-500' },
        { title: 'The Product Launch', signal: 'Feature Release', color: 'bg-cyan-500' }
      ].map((template, i) => (
        <div key={i} className="bg-[#111111] border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
          <div className={`absolute top-0 right-0 w-24 h-24 ${template.color} opacity-5 blur-[40px] group-hover:opacity-20 transition-all`} />
          <h4 className="font-bold mb-2 relative z-10">{template.title}</h4>
          <p className="text-xs text-slate-500 mb-6 relative z-10">Triggered when: <span className="text-white font-mono">{template.signal}</span></p>
          <div className="p-3 bg-black/40 rounded-lg text-[11px] text-slate-400 italic mb-6 relative z-10">
            "I noticed {"{{company}}"} recently {"{{signal}}"}. Usually, this means {"{{outcome}}"} is a priority..."
          </div>
          <button className="w-full py-2 bg-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-white/10 hover:scale-[1.02] active:scale-[0.98] relative z-10">Customize Logic</button>
        </div>
      ))}
    </div>
  </div>
);

export default function TemplatesPage() {
  return <TemplatesView />;
}