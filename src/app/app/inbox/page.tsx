"use client";

import { useState, useEffect } from "react";
import { Inbox as InboxIcon } from "lucide-react";

interface Draft {
  id: string;
  leadId: string | null;
  leadName: string;
  leadCompany: string;
  companyName?: string;
  preview: string;
  source?: "manual" | "watchlist";
  createdAt: string;
}

function formatRelative(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function InboxPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/drafts")
      .then((r) => r.json())
      .then((data) => setDrafts(data.drafts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleApprove(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/drafts/${id}/approve`, { method: "POST" });
  }

  async function handleReject(id: string) {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/drafts/${id}/reject`, { method: "POST" });
  }

  return (
    <div className="p-8 bg-[#030014]">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold">
          Inbox <span className="text-slate-600 font-normal text-lg">({loading ? "…" : drafts.length})</span>
        </h2>
        {drafts.length > 0 && (
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-white/5 text-[10px] font-black uppercase rounded-lg border border-white/10 hover:bg-white/10 transition-colors">Select All</button>
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-[10px] font-black uppercase rounded-lg shadow-lg shadow-purple-500/20 transition-colors">Approve All</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 flex gap-6 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-48 bg-white/10 rounded" />
                <div className="h-3 w-full bg-white/10 rounded" />
                <div className="h-3 w-3/4 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : drafts.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl py-32 text-center bg-white/[0.01]">
          <div className="bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
            <InboxIcon size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-300">No drafts to review</h3>
          <p className="text-sm text-slate-500 mt-1">When AI generates hooks, they will appear here for approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drafts.map((draft) => (
            <div key={draft.id} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 flex gap-6 hover:border-purple-500/50 transition-all group">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center font-bold">
                {initials(draft.leadName)}
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold">
                      {draft.leadName}{" "}
                      {draft.leadCompany && <span className="text-slate-500 font-normal">@ {draft.leadCompany}</span>}
                    </h4>
                    {draft.source === "watchlist" && (
                      <span className="text-[9px] font-black uppercase tracking-widest bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">
                        Watchlist
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-600 font-mono shrink-0 ml-2">Drafted {formatRelative(draft.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-400 italic mb-4">&ldquo;{draft.preview}&rdquo;</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(draft.id)}
                    className="bg-green-500/10 text-green-400 text-[10px] font-black uppercase px-3 py-1 rounded border border-green-500/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(draft.id)}
                    className="bg-red-500/10 text-red-500 text-[10px] font-black uppercase px-3 py-1 rounded border border-red-500/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
