"use client";

import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Flame, Thermometer, MousePointerClick } from 'lucide-react';

const sparkData = [{ v: 5 }, { v: 12 }, { v: 10 }, { v: 25 }, { v: 22 }, { v: 30 }];

export default function AnalyticsPage() {
  return (
    <div className="bg-[#030014] p-8 space-y-10 min-h-screen text-white font-sans">
      
      {/* 1. Metric Cards with Momentum */}
      <div className="grid grid-cols-4 gap-6">
        {[
          { label: 'Hooks Generated', val: '1,284', delta: '+12%', color: '#9333ea' },
          { label: 'Open Rate', val: '42.8%', delta: '+4%', color: '#10b981' },
          { label: 'Reply Rate', val: '8.1%', delta: '-2%', color: '#f43f5e' },
          { label: 'Avg Quality', val: '88/100', delta: '+5%', color: '#3b82f6' }
        ].map((s) => (
          <div key={s.label} className="bg-[#111111] p-5 rounded-xl border border-white/5 hover:border-purple-500/50 transition-all">
            <div className="flex justify-between mb-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{s.label}</span>
              <span className={`text-[10px] font-bold ${s.delta.includes('+') ? 'text-green-400' : 'text-red-400'}`}>{s.delta}</span>
            </div>
            <div className="text-2xl font-bold mb-3">{s.val}</div>
            <div className="h-6 w-full opacity-40">
              <ResponsiveContainer>
                <LineChart data={sparkData}>
                  <Line type="monotone" dataKey="v" stroke={s.color} strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Hot Leads / Intent Scoring Section */}
      <div className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2 italic text-purple-400 uppercase tracking-tighter">
            <Flame size={18} fill="currentColor" /> Trending Accounts
          </h3>
          <span className="text-xs text-slate-500">Based on recent signals & freshness</span>
        </div>
        <div className="divide-y divide-white/5">
          {[
            { name: 'Shopify', temp: 'Burning', color: 'text-orange-500', bg: 'bg-orange-500/10', signal: 'Summer Editions Launch' },
            { name: 'Stripe', temp: 'Warm', color: 'text-yellow-500', bg: 'bg-yellow-500/10', signal: 'Revenue Recognition Update' },
            { name: 'Lattice', temp: 'Active', color: 'text-blue-400', bg: 'bg-blue-400/10', signal: 'New HR Tech Partnership' }
          ].map((lead) => (
            <div key={lead.name} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold">{lead.name[0]}</div>
                <div>
                  <p className="font-semibold text-sm">{lead.name}</p>
                  <p className="text-xs text-slate-500">{lead.signal}</p>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${lead.bg} ${lead.color}`}>
                <Thermometer size={12} /> {lead.temp}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Empty State Logic: Reply Classification */}
      <div className="bg-[#111111] border border-dashed border-white/10 rounded-2xl p-16 text-center">
        <div className="bg-purple-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-400 ring-8 ring-purple-500/5">
          <MousePointerClick size={40} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Automated Reply Classification</h3>
        <p className="text-slate-500 max-w-sm mx-auto mb-8">
          We'll tag replies based on sentiment. Start a sequence to see this in action.
        </p>
        <button className="bg-white text-black px-6 py-3 rounded-lg font-bold hover:bg-slate-200 transition-colors">
          Connect Email & Get Started
        </button>
      </div>
    </div>
  );
}
