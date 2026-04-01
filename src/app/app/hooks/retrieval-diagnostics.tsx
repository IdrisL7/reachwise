"use client";

interface RetrievalDiagnosticsData {
  retrievalMode: "first_party" | "hybrid" | "web_only" | "empty";
  sourceMix: {
    firstParty: number;
    trustedNews: number;
    semanticWeb: number;
    fallbackWeb: number;
  };
  newsExpansionUsed: boolean;
  fallbackUsed: boolean;
  recommendedNextPass: "none" | "news_expansion" | "generic_fallback";
  reasons: string[];
  learnedPreferences?: {
    topSourcePreferences: Array<{
      sourceType: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
      adjustment: number;
      pinned?: boolean;
    }>;
    topTriggerPreferences: Array<{
      triggerType: string;
      sourceType: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
      adjustment: number;
      pinned?: boolean;
    }>;
  };
}

const sourceTypeLabels = {
  first_party: "First-party",
  trusted_news: "Trusted news",
  semantic_web: "Semantic web",
  fallback_web: "Fallback web",
} as const;

function formatAdjustment(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatModeLabel(mode: RetrievalDiagnosticsData["retrievalMode"]): string {
  if (mode === "first_party") return "First-party";
  if (mode === "hybrid") return "Hybrid";
  if (mode === "web_only") return "Web only";
  return "Empty";
}

function formatNextPass(pass: RetrievalDiagnosticsData["recommendedNextPass"]): string {
  if (pass === "news_expansion") return "News expansion";
  if (pass === "generic_fallback") return "Generic fallback";
  return "None";
}

export function RetrievalDiagnostics({
  data,
  onManageMemory,
  managingMemory = false,
  memoryAction = null,
}: {
  data: RetrievalDiagnosticsData;
  onManageMemory?: (
    action: "dampen" | "reset" | "pin" | "unpin",
    options?: {
      sourceType?: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
      triggerType?: string | null;
    },
  ) => void;
  managingMemory?: boolean;
  memoryAction?: "dampen" | "reset" | "pin" | "unpin" | null;
}) {
  const modeTone =
    data.retrievalMode === "first_party"
      ? "text-emerald-300 border-emerald-500/20 bg-emerald-500/10"
      : data.retrievalMode === "hybrid"
        ? "text-sky-300 border-sky-500/20 bg-sky-500/10"
        : "text-amber-300 border-amber-500/20 bg-amber-500/10";

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-slide-in-bottom">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Retrieval</h3>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${modeTone}`}>
          {formatModeLabel(data.retrievalMode)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "First-party", value: data.sourceMix.firstParty },
          { label: "Trusted news", value: data.sourceMix.trustedNews },
          { label: "Semantic web", value: data.sourceMix.semanticWeb },
          { label: "Fallback web", value: data.sourceMix.fallbackWeb },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-zinc-200">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
          News expansion: {data.newsExpansionUsed ? "Used" : "Not used"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
          Recovery fallback: {data.fallbackUsed ? "Used" : "Not used"}
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-zinc-300">
          Next pass: {formatNextPass(data.recommendedNextPass)}
        </span>
      </div>

      {data.reasons.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-black">
            Retrieval notes
          </p>
          {data.reasons.slice(0, 4).map((reason) => (
            <p key={reason} className="text-xs leading-5 text-zinc-400">
              {reason}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">No retrieval diagnostics available yet.</p>
      )}

      {(data.learnedPreferences?.topSourcePreferences.length || data.learnedPreferences?.topTriggerPreferences.length) ? (
        <div className="mt-5 space-y-4 border-t border-white/5 pt-4">
          {onManageMemory ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onManageMemory("dampen")}
                disabled={managingMemory}
                className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1.5 text-[10px] font-semibold text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {managingMemory && memoryAction === "dampen" ? "Softening..." : "Soften learning"}
              </button>
              <button
                type="button"
                onClick={() => onManageMemory("reset")}
                disabled={managingMemory}
                className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-semibold text-amber-300 transition hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {managingMemory && memoryAction === "reset" ? "Resetting..." : "Reset learning"}
              </button>
            </div>
          ) : null}

          {data.learnedPreferences?.topSourcePreferences.length ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-black">
                Learned source preferences
              </p>
              {data.learnedPreferences.topSourcePreferences.slice(0, 3).map((row) => (
                <div key={row.sourceType} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200">
                      {sourceTypeLabels[row.sourceType]}{row.pinned ? " (Pinned)" : ""}
                    </p>
                    <p className="text-[11px] text-zinc-500">Broad ranking lift from recent outcomes</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {onManageMemory ? (
                      <button
                        type="button"
                        onClick={() => onManageMemory(row.pinned ? "unpin" : "pin", { sourceType: row.sourceType })}
                        disabled={managingMemory}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-zinc-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {managingMemory && memoryAction === (row.pinned ? "unpin" : "pin") ? "Saving..." : row.pinned ? "Unpin" : "Pin"}
                      </button>
                    ) : null}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.adjustment >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
                      {formatAdjustment(row.adjustment)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {data.learnedPreferences?.topTriggerPreferences.length ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 font-black">
                Learned trigger pairings
              </p>
              {data.learnedPreferences.topTriggerPreferences.slice(0, 3).map((row) => (
                <div key={`${row.triggerType}-${row.sourceType}`} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-zinc-200 capitalize">
                      {row.triggerType} + {sourceTypeLabels[row.sourceType]}{row.pinned ? " (Pinned)" : ""}
                    </p>
                    <p className="text-[11px] text-zinc-500">Trigger-specific retrieval lift</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {onManageMemory ? (
                      <button
                        type="button"
                        onClick={() => onManageMemory(row.pinned ? "unpin" : "pin", { sourceType: row.sourceType, triggerType: row.triggerType })}
                        disabled={managingMemory}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-zinc-300 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {managingMemory && memoryAction === (row.pinned ? "unpin" : "pin") ? "Saving..." : row.pinned ? "Unpin" : "Pin"}
                      </button>
                    ) : null}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${row.adjustment >= 0 ? "border-sky-500/20 bg-sky-500/10 text-sky-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
                      {formatAdjustment(row.adjustment)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
