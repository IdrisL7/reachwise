import { Zap } from 'lucide-react';

export const SignalHooksLogo = () => (
  <div className="relative w-7 h-7 flex items-center justify-center group cursor-pointer hover:scale-110 transition-transform duration-300">
    {/* Metallic Outer Ring */}
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-400 via-[#0B0F1A] to-slate-600 p-[2px] shadow-xl group-hover:shadow-violet-500/30 group-hover:shadow-2xl transition-shadow duration-300">
      {/* Inner Obsidian Field */}
      <div className="w-full h-full rounded-full bg-[#0a0a0b] flex items-center justify-center relative overflow-hidden">
        {/* The Signal Hook Icon */}
        <div className="relative z-10 flex flex-col items-center">
          <Zap size={12} className="text-violet-500 fill-violet-500" />
          <div className="h-1 w-[1px] bg-violet-400" />
        </div>
      </div>
    </div>
  </div>
);

export const SignalHooksLogoCompact = () => (
  <div className="relative w-6 h-6 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-400 via-[#0B0F1A] to-slate-600 p-[1px] shadow-lg">
      <div className="w-full h-full rounded-full bg-[#0a0a0b] flex items-center justify-center">
        <Zap size={10} className="text-violet-400 fill-violet-400 drop-shadow-[0_0_4px_#7c3aed]" />
      </div>
    </div>
  </div>
);

export const SignalHooksLogoLarge = () => (
  <div className="relative w-24 h-24 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-300 via-[#0B0F1A] to-slate-700 p-[3px] shadow-2xl">
      <div className="w-full h-full rounded-full bg-[#0a0a0b] flex items-center justify-center relative overflow-hidden border border-violet-500/20">
        <div className="relative z-10 flex flex-col items-center">
          <Zap size={28} className="text-violet-400 fill-violet-400 drop-shadow-[0_0_12px_#7c3aed]" />
          <div className="h-4 w-[2px] bg-violet-400" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-violet-500/20 via-violet-500/5 to-transparent animate-pulse" />
      </div>
    </div>
  </div>
);