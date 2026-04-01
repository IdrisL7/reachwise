"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, Trash2, Plus, X, Inbox, Users, Zap } from "lucide-react";
import { AppPageShell, EmptyStatePanel, SurfaceCard } from "../page-shell";

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
  const searchParams = useSearchParams();
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tierLocked, setTierLocked] = useState(false);

  const watchlistStatus = searchParams.get("status");
  const watchlistSource = searchParams.get("source");
  const watchlistCompany = searchParams.get("company");
  const watchlistMessage = searchParams.get("message");

  const watchlistNotice = (() => {
    if (watchlistSource !== "hooks") return null;

    if (watchlistStatus === "saved") {
      return {
        tone: "teal" as const,
        title: watchlistCompany ? `${watchlistCompany} is now on your watchlist.` : "Company added to watchlist.",
        body: "New hooks you generate do not disappear anymore in this flow. The account is now saved for future watchlist monitoring.",
      };
    }

    if (watchlistStatus === "exists") {
      return {
        tone: "amber" as const,
        title: watchlistCompany ? `${watchlistCompany} is already on your watchlist.` : "This company is already on your watchlist.",
        body: "Nothing was lost. You can keep monitoring the account from here.",
      };
    }

    if (watchlistStatus === "locked") {
      return {
        tone: "amber" as const,
        title: "Watchlist is locked on your current plan.",
        body: "The company could not be saved because watchlist access is only available on Pro.",
      };
    }

    if (watchlistStatus === "missing") {
      return {
        tone: "amber" as const,
        title: "We could not tell which company to save.",
        body: "Generate hooks for a company first, then try adding it to the watchlist again.",
      };
    }

    if (watchlistStatus === "error") {
      return {
        tone: "rose" as const,
        title: "We could not add that company to your watchlist.",
        body: watchlistMessage || "Try again in a moment.",
      };
    }

    return null;
  })();

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
    <AppPageShell
      eyebrow="Signal monitoring"
      title="Watchlist"
      description="Track target accounts so fresh company signals keep feeding hooks and drafts back into the workflow. When an account moves, this page should push you toward Inbox, Leads, or the next outbound action."
      actions={[
        { label: "Add Company", icon: Plus, variant: "primary", onClick: () => { setShowModal(true); setSubmitError(null); setInput(""); } },
        { href: "/app/leads", label: "Open Leads", icon: Users },
        { href: "/app/inbox", label: "Review Inbox", icon: Inbox },
      ]}
      stats={[
        { label: "Tracked accounts", value: loading ? "..." : String(entries.length), tone: "violet" },
        { label: "With signals", value: String(entries.filter((entry) => entry.lastSignalAt).length), tone: "teal" },
        { label: "Awaiting first signal", value: String(entries.filter((entry) => !entry.lastSignalAt).length), tone: "amber" },
      ]}
    >
      {watchlistNotice && (
        <div
          className={[
            "rounded-2xl border px-5 py-4 text-sm",
            watchlistNotice.tone === "teal"
              ? "border-teal-500/25 bg-teal-500/10 text-teal-100"
              : watchlistNotice.tone === "rose"
                ? "border-rose-500/25 bg-rose-500/10 text-rose-100"
                : "border-amber-500/25 bg-amber-500/10 text-amber-100",
          ].join(" ")}
        >
          <p className="font-semibold">{watchlistNotice.title}</p>
          <p className="mt-1 text-sm opacity-90">{watchlistNotice.body}</p>
        </div>
      )}

      {tierLocked && (
        <SurfaceCard
          title="Watchlist preview"
          description="Upgrade when you want automatic overnight monitoring to keep feeding fresh opportunities into the rest of the app."
        >
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
            <p className="text-slate-200 font-bold mb-2">Watchlist is available on the Pro plan.</p>
            <p className="text-slate-500 text-sm mb-5">Monitor up to 100 companies for fresh signals and keep your hook queue warm without manual checking.</p>
            <Link
              href="/#pricing"
              className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/20"
            >
              Upgrade to Pro
            </Link>
          </div>
          </div>
        </SurfaceCard>
      )}

      {!tierLocked && (
        <SurfaceCard
          title="Tracked accounts"
          description="Add companies you want to monitor, then use signals here to decide whether to generate hooks, save leads, or approve drafts."
        >
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
            <EmptyStatePanel
              icon={Eye}
              title="No companies watched yet"
              description="Add target accounts here, then use the signals that come in to generate hooks, save leads, or review the next draft in Inbox."
              actions={[
                { label: "Add Company", icon: Plus, variant: "primary", onClick: () => { setShowModal(true); setSubmitError(null); setInput(""); } },
                { href: "/app/leads", label: "Open Leads", icon: Users },
                { href: "/app/hooks", label: "Generate Hooks", icon: Zap },
              ]}
            />
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
        </SurfaceCard>
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
    </AppPageShell>
  );
}
