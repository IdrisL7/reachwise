"use client";

export function LockedDataField({ label, upgradeText = "Upgrade to Pro to unlock" }: { label: string; upgradeText?: string }) {
  return (
    <div className="relative group overflow-hidden rounded-md border border-white/5 p-3 bg-white/[0.02]">
      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-2">{label}</span>
      <div className="blur-[5px] select-none pointer-events-none opacity-50 space-y-1">
        <div className="h-2 w-3/4 bg-zinc-700 rounded" />
        <div className="h-2 w-1/2 bg-zinc-700 rounded" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
        <a href="/#pricing" className="bg-brand text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-accent-glow">
          {upgradeText}
        </a>
      </div>
    </div>
  );
}
