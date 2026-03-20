"use client";

import { useState, useEffect } from "react";
import { Eye, Trash2, Plus, X } from "lucide-react";

interface WatchlistEntry {
  id: string;
  companyName: string;
  domain: string;
  addedAt: string;
  lastCheckedAt: string | null;
  lastSignalAt: string | null;
  lastSignalType: string | null;
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "never";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "—";
  }
}

function SignalLabel({ type, at }: { type: string | null; at: string | null }) {
  if (!type || !at) {
    return (
      <span className="text-[10px] uppercase font-black tracking-widest text-slate-600">
        No signals yet
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
      {type} &middot; {formatRelative(at)}
    </span>
  );
}

export default function WatchlistPage() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tierLocked, setTierLocked] = useState(false);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => {
        if (r.status === 403) {
          setTierLocked(true);
          return { entries: [] };
        }
        return r.json();
      })
      .then((data) => setEntries(data.entries ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!input.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const isDomain = input.includes(".");
      const body = isDomain
        ? { domain: input.trim() }
        : { companyName: input.trim() };

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Failed to add company.");
        return;
      }
      setEntries((prev) => [...prev, data.entry]);
      setInput("");
      setShowModal(false);
    } catch {
      setSubmitError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id)); // optimistic
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="p-8 bg-[#030014] min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Eye size={22} className="text-slate-500" />
          <h2 className="text-2xl font-bold">
            Watchlist
          </h2>
          {!loading && (
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-500 px-2 py-0.5 rounded-full">
              {entries.length}
            </span>
          )}
        </div>
      </div>

      {/* Tier gate overlay */}
      {tierLocked && (
        <div className="relative">
          {/* Blurred preview rows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 blur-sm pointer-events-none select-none opacity-40">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6">
                <div className="h-5 w-32 bg-white/10 rounded mb-2" />
                <div className="h-3 w-24 bg-white/5 rounded mb-4" />
                <div className="h-3 w-20 bg-white/5 rounded" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-[#030014]/90 border border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
            <Eye size={36} className="text-slate-600 mb-4" />
            <p className="text-slate-200 font-bold mb-2">Watchlist is available on Pro and Concierge.</p>
            <p className="text-slate-500 text-sm mb-5">Monitor up to 100 companies for fresh signals and auto-generate hooks overnight.</p>
            <a
              href="/#pricing"
              className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/20"
            >
              Upgrade to Pro
            </a>
          </div>
        </div>
      )}

      {/* Main content */}
      {!tierLocked && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 animate-pulse">
                  <div className="h-5 w-40 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-28 bg-white/5 rounded mb-4" />
                  <div className="h-3 w-20 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="border border-dashed border-white/10 rounded-3xl py-32 text-center bg-white/[0.01]">
              <div className="bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
                <Eye size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-300">No companies watched yet</h3>
              <p className="text-sm text-slate-500 mt-1 mb-6">Add companies to monitor for fresh signals. Hooks auto-generate overnight.</p>
              <button
                onClick={() => { setShowModal(true); setSubmitError(null); setInput(""); }}
                className="bg-teal-500 hover:bg-teal-400 px-6 py-2 rounded-lg font-bold text-black text-sm transition-colors"
              >
                + Add Company
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="relative bg-[#0B0F1A] border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-white truncate">{entry.companyName}</p>
                      <p className="text-slate-500 text-sm mt-0.5">{entry.domain}</p>
                      <div className="mt-3">
                        <SignalLabel type={entry.lastSignalType} at={entry.lastSignalAt} />
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemove(entry.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity ml-3 p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 shrink-0"
                      title="Remove from watchlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#0B0F1A] border border-white/10 rounded-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Add to Watchlist</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Company name or domain
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !submitting && handleAdd()}
              placeholder="e.g. Stripe or stripe.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/50 transition-colors"
              autoFocus
            />

            {submitError && (
              <p className="text-red-400 text-xs mt-2">{submitError}</p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-white/5 border border-white/10 text-slate-300 text-sm font-bold px-4 py-2.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={submitting || !input.trim()}
                className="flex-1 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
              >
                {submitting ? "Adding…" : "Add Company"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
