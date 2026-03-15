"use client";

import { Badge } from "@/components/ui/badge";

interface IntentData {
  score: number;
  temperature: string;
  signals: Array<{
    type: string;
    summary: string;
    confidence: number;
    sourceUrl: string;
    detectedAt: string;
  }>;
}

const typeVariants: Record<string, "high" | "tier-a" | "psych" | "warm" | "cold"> = {
  hiring: "high",
  funding: "tier-a",
  tech_change: "psych",
  growth: "warm",
  news: "cold",
};

export function IntentSignals({ data }: { data: IntentData }) {
  const tempVariant = data.temperature === "hot" ? "hot" as const : data.temperature === "warm" ? "warm" as const : "cold" as const;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-slide-in-bottom">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Intent Signals</h3>
        <Badge variant={tempVariant} className="text-[10px]">
          Score: {data.score} — {data.temperature === "hot" ? "Hot" : data.temperature === "warm" ? "Warm" : "Cold"}
        </Badge>
      </div>
      {data.signals.length === 0 ? (
        <p className="text-xs text-zinc-500">No buying signals detected for this company.</p>
      ) : (
        <div className="space-y-2">
          {data.signals.map((signal, i) => {
            const typeColors: Record<string, string> = {
              hiring: "text-blue-400 bg-blue-900/30 border-blue-800",
              funding: "text-emerald-400 bg-emerald-900/30 border-emerald-800",
              tech_change: "text-purple-400 bg-purple-900/30 border-purple-800",
              growth: "text-orange-400 bg-orange-900/30 border-orange-800",
              news: "text-zinc-400 bg-zinc-800 border-zinc-700",
            };
            return (
              <div key={i} className="flex items-start gap-2 bg-black/30 rounded-lg px-4 py-3">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${typeColors[signal.type] || typeColors.news}`}>
                  {signal.type.replace("_", " ")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-300">{signal.summary}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-zinc-600">
                      {Math.round(signal.confidence * 100)}% confidence
                    </span>
                    {signal.sourceUrl && (
                      <a href={signal.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2 truncate">
                        Source
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
