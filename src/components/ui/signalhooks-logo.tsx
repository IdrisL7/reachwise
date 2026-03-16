import { Zap } from 'lucide-react';

export const SignalHooksLogo = () => (
  <div className="relative w-7 h-7 flex items-center justify-center group cursor-pointer hover:scale-110 transition-transform duration-300">
    {/* Metallic Outer Ring */}
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-400 via-[#0B0F1A] to-slate-600 p-[2px] shadow-xl group-hover:shadow-purple-500/30 group-hover:shadow-2xl transition-shadow duration-300">
      {/* Inner Obsidian Field */}
      <div className="w-full h-full rounded-full bg-[#030014] flex items-center justify-center relative overflow-hidden">
        {/* The Signal Hook Icon */}
        <div className="relative z-10 flex flex-col items-center">
          <Zap size={12} className="text-purple-500 fill-purple-500 drop-shadow-[0_0_8px_#9333ea] group-hover:drop-shadow-[0_0_16px_#9333ea] transition-all duration-300" />
          <div className="h-1 w-[1px] bg-purple-400 group-hover:bg-purple-300 transition-colors duration-300" />
        </div>
        {/* Radial Signal Waves */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent animate-pulse group-hover:from-purple-500/20" />
      </div>
    </div>
  </div>
);

export const SignalHooksLogoCompact = () => (
  <div className="relative w-6 h-6 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-400 via-[#0B0F1A] to-slate-600 p-[1px] shadow-lg">
      <div className="w-full h-full rounded-full bg-[#030014] flex items-center justify-center">
        <Zap size={10} className="text-purple-400 fill-purple-400 drop-shadow-[0_0_4px_#9333ea]" />
      </div>
    </div>
  </div>
);

export const SignalHooksLogoLarge = () => (
  <div className="relative w-24 h-24 flex items-center justify-center">
    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-300 via-[#0B0F1A] to-slate-700 p-[3px] shadow-2xl">
      <div className="w-full h-full rounded-full bg-[#030014] flex items-center justify-center relative overflow-hidden border border-purple-500/20">
        <div className="relative z-10 flex flex-col items-center">
          <Zap size={28} className="text-purple-400 fill-purple-400 drop-shadow-[0_0_12px_#9333ea]" />
          <div className="h-4 w-[2px] bg-purple-400" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle,_var(--tw-gradient-stops))] from-purple-500/20 via-purple-500/5 to-transparent animate-pulse" />
      </div>
    </div>
  </div>
);