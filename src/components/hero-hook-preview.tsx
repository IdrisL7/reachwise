"use client";

import { Search, Zap } from 'lucide-react';

export function HeroHookPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
      {/* Floating gradient orb */}
      <div className="pointer-events-none absolute -top-16 right-0 h-[300px] w-[300px] rounded-full bg-violet-600/[0.08] blur-[100px] animate-fade-in" />

      {/* Interactive UI Preview */}
      <div className="bg-[#0B0F1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex justify-between bg-white/5">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-xs">
            <Search size={14}/>
            shopify.com
          </div>
          <div className="px-2 py-1 bg-purple-500/20 rounded border border-purple-500/30 text-[10px] text-purple-300 font-bold flex items-center gap-1">
            <Zap size={10} fill="currentColor" />
            Lead Score: 98
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-purple-500/10 border-l-4 border-purple-500 rounded-r-lg">
            <p className="text-sm text-zinc-300">
              "Shopify Editions Summer '25 shipped 150+ updates. Is your integration layer keeping pace?"
            </p>
          </div>
          <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex justify-between items-center">
            <span className="text-xs text-slate-500 italic">Source: Shopify Newsroom</span>
            <span className="text-[10px] text-slate-600 uppercase font-bold">Verified ✅</span>
          </div>
        </div>
      </div>
    </div>
  );
}
