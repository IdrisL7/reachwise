"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Inbox as InboxIcon,
  CheckCircle2,
  XCircle,
  Mail,
  Zap,
  CheckCheck,
  Loader2,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────────── */

interface Draft {
  id: string;
  leadId: string | null;
  leadName: string;
  leadEmail: string;
  leadCompany: string;
  companyName?: string;
  subject: string;
  body: string;
  preview: string;
  sequenceStep: number | null;
  sequenceName: string | null;
  sequenceTotalSteps: number | null;
  channel: string;
  source?: "manual" | "watchlist";
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────────────────── */

function formatRelative(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "\u2014";
  }
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function truncateBody(body: string, lines = 3): string {
  const split = body.split("\n").filter(Boolean);
  const preview = split.slice(0, lines).join(" ");
  if (preview.length > 220) return preview.slice(0, 220) + "\u2026";
  if (split.length > lines) return preview + "\u2026";
  return preview;
}

/* ── Toast ────────────────────────────────────────────────── */

function Toast({
  message,
  type,
  onDone,
}: {
  message: string;
  type: "success" | "error";
  onDone: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border transition-all animate-in slide-in-from-bottom-4 ${
        type === "success"
          ? "bg-green-500/10 text-green-400 border-green-500/20"
          : "bg-red-500/10 text-red-400 border-red-500/20"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 size={16} />
      ) : (
        <XCircle size={16} />
      )}
      {message}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────── */

export default function InboxPage() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);
  const [approveProgress, setApproveProgress] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch drafts ─────────────────────────────────────── */

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch("/api/drafts");
      if (!res.ok) return;
      const data = await res.json();
      setDrafts(data.drafts ?? []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchDrafts().finally(() => setLoading(false));

    pollRef.current = setInterval(fetchDrafts, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchDrafts]);

  /* ── Actions ──────────────────────────────────────────── */

  async function handleApprove(id: string) {
    setBusyIds((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/drafts/${id}/approve`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setToast({ message: "Draft approved & queued", type: "success" });
    } catch {
      setToast({ message: "Failed to approve draft", type: "error" });
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  async function handleReject(id: string) {
    setBusyIds((s) => new Set(s).add(id));
    try {
      const res = await fetch(`/api/drafts/${id}/reject`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      setToast({ message: "Draft rejected", type: "success" });
    } catch {
      setToast({ message: "Failed to reject draft", type: "error" });
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  async function handleApproveAll() {
    if (approvingAll || drafts.length === 0) return;
    setApprovingAll(true);
    const total = drafts.length;
    let approved = 0;

    for (const draft of [...drafts]) {
      approved++;
      setApproveProgress(`Approving ${approved}/${total}\u2026`);
      try {
        await fetch(`/api/drafts/${draft.id}/approve`, { method: "POST" });
        setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      } catch {
        /* continue with next */
      }
    }

    setApprovingAll(false);
    setApproveProgress("");
    setToast({
      message: `Approved ${approved} draft${approved !== 1 ? "s" : ""}`,
      type: "success",
    });
  }

  /* ── Sequence label ───────────────────────────────────── */

  function sequenceLabel(draft: Draft): string | null {
    if (draft.sequenceStep == null) return null;
    const step = `Step ${draft.sequenceStep + 1}`;
    if (draft.sequenceName && draft.sequenceTotalSteps) {
      return `${step} of ${draft.sequenceName} (${draft.sequenceTotalSteps}-step)`;
    }
    return step;
  }

  /* ── Render ───────────────────────────────────────────── */

  return (
    <div className="p-8 bg-[#14161a] min-h-screen">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-white">
          Inbox{" "}
          <span className="text-slate-600 font-normal text-lg">
            ({loading ? "\u2026" : drafts.length})
          </span>
        </h2>
        {drafts.length > 0 && (
          <button
            onClick={handleApproveAll}
            disabled={approvingAll}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-black uppercase rounded-lg shadow-lg shadow-purple-500/20 transition-colors"
          >
            {approvingAll ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {approveProgress}
              </>
            ) : (
              <>
                <CheckCheck size={14} />
                Approve All
              </>
            )}
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-[#14161a] border border-[#252830] rounded-2xl p-6 flex gap-6 animate-pulse"
            >
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
        /* ── Empty state ──────────────────────────────────── */
        <div className="border border-dashed border-[#252830] rounded-3xl py-32 text-center bg-white/[0.01]">
          <div className="bg-[#1c1e24] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-600">
            <InboxIcon size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-300">
            All caught up. Your inbox is empty.
          </h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            When AI generates outreach drafts, they will appear here for
            approval.
          </p>
          <Link
            href="/app/hooks"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-sm font-semibold rounded-lg transition-colors"
          >
            <Zap size={16} />
            Generate Hooks
          </Link>
        </div>
      ) : (
        /* ── Draft list ───────────────────────────────────── */
        <div className="space-y-4">
          {drafts.map((draft) => {
            const isBusy = busyIds.has(draft.id);
            const seqLabel = sequenceLabel(draft);

            return (
              <div
                key={draft.id}
                className={`bg-[#14161a] border border-[#252830] rounded-2xl p-6 flex gap-6 hover:border-purple-500/40 transition-all group ${
                  isBusy ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-[#1c1e24] flex-shrink-0 flex items-center justify-center font-bold text-slate-400 text-sm border border-[#252830]">
                  {initials(draft.leadName)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Top row: name, badges, time */}
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-white">
                        {draft.leadName}
                        {draft.leadCompany && (
                          <span className="text-slate-500 font-normal">
                            {" "}
                            @ {draft.leadCompany}
                          </span>
                        )}
                      </h4>
                      {draft.source === "watchlist" && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded-full">
                          Watchlist
                        </span>
                      )}
                      {seqLabel && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-full">
                          {seqLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-600 font-mono shrink-0 ml-2">
                      {formatRelative(draft.createdAt)}
                    </span>
                  </div>

                  {/* Recipient email */}
                  {draft.leadEmail && (
                    <div className="flex items-center gap-1.5 mb-2">
                      <Mail size={12} className="text-slate-600" />
                      <span className="text-xs text-slate-500 font-mono">
                        {draft.leadEmail}
                      </span>
                    </div>
                  )}

                  {/* Subject line */}
                  {draft.subject && (
                    <p className="text-sm font-semibold text-slate-200 mb-1">
                      {draft.subject}
                    </p>
                  )}

                  {/* Body preview */}
                  <p className="text-sm text-slate-400 leading-relaxed mb-4">
                    {truncateBody(draft.body)}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(draft.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 bg-green-500/10 text-green-400 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-green-500/20 hover:bg-green-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      {isBusy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                      Approve &amp; Queue
                    </button>
                    <button
                      onClick={() => handleReject(draft.id)}
                      disabled={isBusy}
                      className="flex items-center gap-1.5 bg-red-500/10 text-red-500 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <XCircle size={12} />
                      Reject
                    </button>
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
