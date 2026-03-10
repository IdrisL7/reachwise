type BadgeVariant =
  | "tier-a" | "tier-b" | "tier-c"
  | "trigger" | "risk" | "tradeoff"
  | "high" | "med" | "low"
  | "first-party" | "reputable" | "web"
  | "fresh" | "recent" | "older" | "stale"
  | "role" | "psych" | "verification"
  | "hot" | "warm" | "cold";

const variantStyles: Record<BadgeVariant, string> = {
  "tier-a": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "tier-b": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "tier-c": "text-zinc-400 bg-zinc-500/10 border-zinc-700/20",
  trigger: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  risk: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  tradeoff: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  high: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  med: "text-zinc-400 bg-zinc-500/10 border-zinc-600/20",
  low: "text-zinc-400 bg-zinc-500/10 border-zinc-600/20 opacity-70",
  "first-party": "text-emerald-400 bg-emerald-900/20 border-emerald-800/50",
  reputable: "text-blue-400 bg-blue-900/20 border-blue-800/50",
  web: "text-zinc-400 bg-zinc-800/50 border-zinc-700/50",
  fresh: "text-emerald-400 bg-emerald-900/30 border-emerald-800",
  recent: "text-blue-400 bg-blue-900/30 border-blue-800",
  older: "text-amber-400 bg-amber-900/30 border-amber-800",
  stale: "text-zinc-500 bg-zinc-800 border-zinc-700",
  role: "text-sky-400 bg-sky-900/20 border-sky-800/50",
  psych: "text-purple-400 bg-purple-900/30 border-purple-800",
  verification: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  hot: "bg-red-900/30 text-red-400 border-red-800",
  warm: "bg-amber-900/30 text-amber-400 border-amber-800",
  cold: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Badge({ variant, children, className = "", title }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.5625rem] font-semibold ${variantStyles[variant]} ${className}`}
      title={title}
    >
      {children}
    </span>
  );
}

// Helper to get the right tier variant
export function tierVariant(tier: string): BadgeVariant {
  if (tier === "A") return "tier-a";
  if (tier === "B") return "tier-b";
  return "tier-c";
}

// Helper to get the right angle variant
export function angleVariant(angle: string): BadgeVariant {
  if (angle === "trigger") return "trigger";
  if (angle === "risk") return "risk";
  return "tradeoff";
}

// Helper to get the right confidence variant
export function confidenceVariant(confidence: string): BadgeVariant {
  if (confidence === "high") return "high";
  if (confidence === "med") return "med";
  return "low";
}
