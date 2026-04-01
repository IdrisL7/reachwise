"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Inbox as InboxIcon,
  CheckCircle2,
  XCircle,
  Mail,
  Zap,
  CheckCheck,
  Loader2,
  ListChecks,
  Users,
  Search,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { AppPageShell, EmptyStatePanel, SurfaceCard } from "../page-shell";

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
  orchestration?: {
    sequenceType: string | null;
    previousChannel: string | null;
    tone: string | null;
    ctaStyle: string | null;
    wordCountHint: number | null;
    sendWindow: string | null;
    reasoning: string[];
  } | null;
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

function formatChannelLabel(channel: string | null | undefined): string {
  if (!channel) return "Unknown";
  return channel.replace(/_/g, " ");
}

function formatToneLabel(tone: string | null | undefined): string {
  if (!tone) return "Auto";
  return tone;
}

function getFreshnessTone(createdAt: string) {
  const parsed = Date.parse(createdAt);
  if (Number.isNaN(parsed)) {
    return {
      label: "Unknown",
      className: "border-white/10 bg-white/[0.04] text-slate-300",
    };
  }
  const hoursOld = (Date.now() - parsed) / (1000 * 60 * 60);
  if (hoursOld <= 6) {
    return {
      label: "Fresh",
      className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }
  if (hoursOld <= 24) {
    return {
      label: "Today",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }
  return {
    label: "Older",
    className: "border-white/10 bg-white/[0.04] text-slate-300",
  };
}

function normalizeGroupKey(draft: Draft) {
  return draft.companyName || draft.leadCompany || draft.leadName || draft.id;
}

function buildGroupLabel(draft: Draft) {
  return draft.companyName || draft.leadCompany || draft.leadName || "Unknown account";
}

function filterDrafts(
  drafts: Draft[],
  search: string,
  filter: "all" | "watchlist" | "sequence" | "fresh" | "manual",
) {
  const query = search.trim().toLowerCase();
  return drafts.filter((draft) => {
    const haystack = [
      draft.leadName,
      draft.leadEmail,
      draft.leadCompany,
      draft.companyName,
      draft.subject,
      draft.body,
      draft.sequenceName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const matchesSearch = query.length === 0 || haystack.includes(query);
    if (!matchesSearch) return false;

    if (filter === "watchlist") return draft.source === "watchlist";
    if (filter === "manual") return draft.source !== "watchlist";
    if (filter === "sequence") return draft.sequenceStep != null;
    if (filter === "fresh") {
      const parsed = Date.parse(draft.createdAt);
      if (Number.isNaN(parsed)) return false;
      return (Date.now() - parsed) / (1000 * 60 * 60) <= 24;
    }
    return true;
  });
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "watchlist" | "sequence" | "fresh" | "manual">("all");
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

  const visibleDrafts = filterDrafts(drafts, search, filter);
  const groupedDrafts = visibleDrafts.reduce<Array<{ key: string; label: string; drafts: Draft[] }>>((groups, draft) => {
    const key = normalizeGroupKey(draft);
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.drafts.push(draft);
      return groups;
    }
    groups.push({
      key,
      label: buildGroupLabel(draft),
      drafts: [draft],
    });
    return groups;
  }, []);
  const spotlightGroups = groupedDrafts
    .map((group) => ({
      ...group,
      waiting: group.drafts.length,
      sequenceLinked: group.drafts.filter((draft) => draft.sequenceStep != null).length,
      freshest: group.drafts[0],
    }))
    .sort((a, b) => b.waiting - a.waiting)
    .slice(0, 3);
  const filterOptions = [
    { value: "all" as const, label: "All drafts" },
    { value: "manual" as const, label: "Lead workflow" },
    { value: "watchlist" as const, label: "Watchlist" },
    { value: "sequence" as const, label: "Sequence-linked" },
    { value: "fresh" as const, label: "Fresh today" },
  ];

  /* ── Render ───────────────────────────────────────────── */

  return (
    <AppPageShell
      eyebrow="Review queue"
      title="Inbox"
      description="Approve or reject generated drafts before they are queued. When the queue is empty, the fastest next step is usually to create hooks, save a lead, or assign a sequence."
      actions={[
        { href: "/app/hooks", label: "Generate Hooks", icon: Zap, variant: "primary" },
        { href: "/app/leads", label: "Open Leads", icon: Users },
        { href: "/app/sequences", label: "Review Sequences", icon: ListChecks },
      ]}
      stats={[
        { label: "Drafts waiting", value: loading ? "..." : String(drafts.length), tone: "violet" },
        { label: "Watchlist sourced", value: String(drafts.filter((draft) => draft.source === "watchlist").length), tone: "teal" },
        { label: "Sequence-linked", value: String(drafts.filter((draft) => draft.sequenceStep != null).length), tone: "amber" },
      ]}
    >
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
      <SurfaceCard
        title="Approval queue"
        description="Each draft here is ready for a human decision. Group by account, scan why the draft exists now, and approve with a clearer sense of what happens next."
        action={
          drafts.length > 0 ? (
            <button
              onClick={handleApproveAll}
              disabled={approvingAll}
              className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
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
          ) : null
        }
      >
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 flex gap-6 animate-pulse"
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
          <EmptyStatePanel
            icon={InboxIcon}
            title="All caught up"
            description="When AI generates outreach drafts, they land here for approval. If the queue is empty, generate hooks, save the best prospects to Leads, or set up sequences for the next wave."
            actions={[
              { href: "/app/hooks", label: "Generate Hooks", icon: Zap, variant: "primary" },
              { href: "/app/leads", label: "Save Leads", icon: Users },
              { href: "/app/sequences", label: "Set Up Sequences", icon: ListChecks },
            ]}
          />
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <label className="flex-1">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Search drafts
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0B0F1A] px-3 py-3">
                    <Search size={14} className="text-slate-500" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search account, contact, email, sequence, or draft copy"
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                    />
                  </div>
                </label>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFilter(option.value)}
                      className={`rounded-xl border px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition-colors ${
                        filter === option.value
                          ? "border-violet-400/50 bg-violet-500/10 text-violet-200"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {spotlightGroups.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-3">
                {spotlightGroups.map((group) => (
                  <div key={group.key} className="rounded-2xl border border-violet-500/15 bg-[linear-gradient(135deg,rgba(139,92,246,0.12),rgba(11,15,26,0.95))] p-4">
                    <p className="text-sm font-semibold text-white">{group.label}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {group.waiting} draft{group.waiting === 1 ? "" : "s"} waiting
                      {group.sequenceLinked > 0 ? ` • ${group.sequenceLinked} sequence-linked` : ""}
                    </p>
                    <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-violet-200/80">
                      Up next
                    </p>
                    <p className="mt-2 text-sm leading-5 text-slate-200">
                      {group.freshest.subject || truncateBody(group.freshest.body, 2)}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Latest draft {formatRelative(group.freshest.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {visibleDrafts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
                <h3 className="text-lg font-bold text-white">No drafts match this view</h3>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                  Try a broader search or switch filters to review a different slice of the queue.
                </p>
              </div>
            ) : (
              groupedDrafts.map((group) => (
                <div key={group.key} className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">{group.label}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {group.drafts.length} draft{group.drafts.length === 1 ? "" : "s"} waiting in this account thread
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
                        {group.drafts.filter((draft) => draft.sequenceStep != null).length} sequence-linked
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-slate-300">
                        {group.drafts.filter((draft) => draft.source === "watchlist").length} watchlist
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {group.drafts.map((draft) => {
                      const isBusy = busyIds.has(draft.id);
                      const seqLabel = sequenceLabel(draft);
                      const freshness = getFreshnessTone(draft.createdAt);

                      return (
                        <div
                          key={draft.id}
                          className={`rounded-2xl border border-white/5 bg-white/[0.02] p-6 flex gap-6 transition-all group hover:border-violet-500/30 ${
                            isBusy ? "pointer-events-none opacity-50" : ""
                          }`}
                        >
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#151a28] text-sm font-bold text-slate-400">
                            {initials(draft.leadName)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-bold text-white">
                                  {draft.leadName}
                                  {draft.leadCompany && (
                                    <span className="font-normal text-slate-500">
                                      {" "}
                                      @ {draft.leadCompany}
                                    </span>
                                  )}
                                </h4>
                                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${freshness.className}`}>
                                  {freshness.label}
                                </span>
                                {draft.source === "watchlist" && (
                                  <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-teal-400">
                                    Watchlist
                                  </span>
                                )}
                                {seqLabel && (
                                  <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-purple-400">
                                    {seqLabel}
                                  </span>
                                )}
                              </div>
                              <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-600">
                                {formatRelative(draft.createdAt)}
                              </span>
                            </div>

                            {draft.leadEmail && (
                              <div className="mb-2 flex items-center gap-1.5">
                                <Mail size={12} className="text-slate-600" />
                                <span className="font-mono text-xs text-slate-500">{draft.leadEmail}</span>
                              </div>
                            )}

                            {draft.subject && (
                              <p className="mb-1 text-sm font-semibold text-slate-200">{draft.subject}</p>
                            )}

                            <p className="mb-4 text-sm leading-relaxed text-slate-400">{truncateBody(draft.body)}</p>

                            {draft.orchestration && draft.source !== "watchlist" ? (
                              <details className="mb-4 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                                <summary className="list-none cursor-pointer text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                                  Why This Draft
                                </summary>
                                <div className="mt-3 space-y-3">
                                  <div className="flex flex-wrap gap-2">
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                                      Channel: {formatChannelLabel(draft.channel)}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                                      Previous: {formatChannelLabel(draft.orchestration.previousChannel)}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                                      Tone: {formatToneLabel(draft.orchestration.tone)}
                                    </span>
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                                      CTA: {formatChannelLabel(draft.orchestration.ctaStyle)}
                                    </span>
                                    {draft.orchestration.wordCountHint ? (
                                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                                        Length target: {draft.orchestration.wordCountHint} words
                                      </span>
                                    ) : null}
                                    {draft.orchestration.sendWindow ? (
                                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                                        Window: {formatChannelLabel(draft.orchestration.sendWindow)}
                                      </span>
                                    ) : null}
                                  </div>
                                  {draft.orchestration.reasoning.length > 0 ? (
                                    <div>
                                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                        Decision factors
                                      </p>
                                      <div className="space-y-1.5">
                                        {draft.orchestration.reasoning.map((reason) => (
                                          <p key={reason} className="text-xs leading-5 text-slate-400">
                                            {reason}
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </details>
                            ) : null}

                            <div className="mb-4 rounded-xl border border-white/8 bg-[#0B0F1A] px-4 py-3">
                              <div className="flex items-start gap-2">
                                <Sparkles size={14} className="mt-0.5 text-violet-300" />
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                                    What happens after approval
                                  </p>
                                  <p className="mt-2 text-xs leading-5 text-slate-400">
                                    This draft moves from review into the queued workflow. Sequence-linked drafts also advance the lead’s active sequence, so approval here becomes the next real outbound step.
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => handleApprove(draft.id)}
                                disabled={isBusy}
                                className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-green-400 transition-all hover:scale-[1.02] hover:bg-green-500/20 active:scale-[0.98]"
                              >
                                {isBusy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                Approve &amp; Queue
                              </button>
                              <button
                                onClick={() => handleReject(draft.id)}
                                disabled={isBusy}
                                className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-red-500 transition-all hover:scale-[1.02] hover:bg-red-500/20 active:scale-[0.98]"
                              >
                                <XCircle size={12} />
                                Reject
                              </button>
                              <a
                                href={`/app/accounts?q=${encodeURIComponent(draft.companyName || draft.leadCompany || draft.leadName)}`}
                                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-black uppercase text-slate-300 transition-all hover:border-white/20 hover:bg-white/[0.06]"
                              >
                                <ArrowRight size={12} />
                                Open in Accounts
                              </a>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </SurfaceCard>
    </AppPageShell>
  );
}
