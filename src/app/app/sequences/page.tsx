"use client";

import { Edit3, Trash2 } from 'lucide-react';

const SequencesView = () => (
  <div className="p-8 bg-[#030014] min-h-screen">
    <div className="flex justify-between items-center mb-8">
      <h2 className="text-3xl font-bold">Sequences</h2>
      <button className="bg-teal-500 hover:bg-teal-400 px-6 py-2 rounded-lg font-bold text-black transition-all hover:scale-[1.02] active:scale-[0.98]">+ New Sequence</button>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {[
        { name: 'Multi-Channel (5-step)', active: 42, open: '48%', tag: 'High Velocity' },
        { name: 'Founder Outreach', active: 12, open: '62%', tag: 'Manual Approval' }
      ].map((seq, i) => (
        <div key={i} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-all group">
          <div className="flex justify-between mb-4">
            <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-1 rounded font-black uppercase tracking-widest">{seq.tag}</span>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Edit3 size={14} className="text-slate-500 cursor-pointer hover:scale-[1.02]" />
              <Trash2 size={14} className="text-red-500/50 cursor-pointer hover:scale-[1.02]" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-6">{seq.name}</h3>
          <div className="flex gap-8 mb-6">
            <div><p className="text-[10px] text-slate-500 uppercase font-black">Active Leads</p><p className="text-lg font-bold">{seq.active}</p></div>
            <div><p className="text-[10px] text-slate-500 uppercase font-black">Open Rate</p><p className="text-lg font-bold text-green-400">{seq.open}</p></div>
          </div>
          <div className="flex gap-1 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            {[...Array(5)].map((_, i) => <div key={i} className={`flex-1 ${i < 3 ? 'bg-purple-600' : 'bg-slate-800'}`} />)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function SequencesPage() {
  return <SequencesView />;
}