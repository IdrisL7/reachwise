"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { BarChart3, Flame, Target, Thermometer, Users, Zap, Mail, AlertTriangle, ListChecks } from "lucide-react";
import { AppPageShell, EmptyStatePanel, SurfaceCard } from "../page-shell";

type SparkPoint = { day: string; count: number };

type TrendingAccount = {
  companyName: string;
  score: number;
  temperature: "hot" | "warm" | "cold";
  lastScoredAt: string;
};

type AnalyticsData = {
  hooksTotal: number;
  hooksThisMonth: number;
  hooksLastMonth: number;
  deltaPercent: number | null;
  avgQuality: number | null;
  tierACount: number;
  sparkline: SparkPoint[];
  retrieval: {
    windowDays: number;
    total: number;
    mode: "hybrid" | "web_only" | "empty";
    mix: {
      firstParty: number;
      trustedNews: number;
      semanticWeb: number;
      fallbackWeb: number;
    };
    outcomes: {
      firstParty: { hooks: number; copies: number; emailsUsed: number; wins: number };
      trustedNews: { hooks: number; copies: number; emailsUsed: number; wins: number };
      semanticWeb: { hooks: number; copies: number; emailsUsed: number; wins: number };
      fallbackWeb: { hooks: number; copies: number; emailsUsed: number; wins: number };
    };
    memory: {
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
  };
  workflow: {
    totalLeads: number;
    activeSequences: number;
    draftsWaiting: number;
    queuedMessages: number;
    stalledLeads: Array<{
      leadId: string;
      leadName: string;
      companyName: string;
      sequenceName: string;
      currentStep: number;
      lastContactedAt: string | null;
      startedAt: string;
    }>;
    topChannels: Array<{
      channel: string;
      attempts: number;
      positiveReplies: number;
      wins: number;
      noReply: number;
      positiveRate: number;
      winRate: number;
    }>;
  };
  trendingAccounts: TrendingAccount[];
};

const tempStyles: Record<string, { color: string; bg: string; label: string }> = {
  hot: { color: "text-orange-500", bg: "bg-orange-500/10", label: "Hot" },
  warm: { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Warm" },
  cold: { color: "text-blue-400", bg: "bg-blue-400/10", label: "Cold" },
};

const sourceTypeLabels = {
  first_party: "First-party",
  trusted_news: "Trusted news",
  semantic_web: "Semantic web",
  fallback_web: "Fallback web",
} as const;

function formatAdjustment(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatChannel(channel: string) {
  return channel.replace(/_/g, " ");
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "—";
  }
}

function MetricCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 animate-pulse">
      <div className="h-3 w-24 bg-white/10 rounded mb-2" />
      <div className="h-7 w-20 bg-white/10 rounded mb-3" />
      <div className="h-6 w-full bg-white/5 rounded" />
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const sparklineData = data?.sparkline.map((p) => ({ v: p.count })) ?? [];

  const cards = data
    ? [
        {
          label: "Hooks Generated",
          val: data.hooksTotal.toLocaleString(),
          delta:
            data.deltaPercent != null
              ? `${data.deltaPercent >= 0 ? "+" : ""}${data.deltaPercent}% this month`
              : null,
          positive: (data.deltaPercent ?? 0) >= 0,
          color: "#9333ea",
          sub: `${data.hooksThisMonth} this month`,
        },
        {
          label: "Avg Quality Score",
          val: data.avgQuality != null ? `${data.avgQuality}/100` : "—",
          delta: null,
          positive: true,
          color: data.avgQuality != null && data.avgQuality >= 80 ? "#10b981" : "#3b82f6",
          sub: data.avgQuality != null && data.avgQuality >= 80 ? "Above target" : "Building up",
        },
        {
          label: "Tier A Hooks",
          val: data.tierACount.toLocaleString(),
          delta: null,
          positive: true,
          color: "#f59e0b",
          sub: "High-confidence sources",
        },
      ]
    : [];

  return (
    <AppPageShell
      eyebrow="Pipeline intelligence"
      title="Analytics"
      description="Track whether hook generation is turning into prioritised accounts. Use this view to spot momentum, then move straight into leads, watchlist, or inbox approvals."
      actions={[
        { href: "/app/hooks", label: "Generate Hooks", icon: Zap, variant: "primary" },
        { href: "/app/leads", label: "Manage Leads", icon: Users },
        { href: "/app/watchlist", label: "Open Watchlist", icon: Target },
      ]}
      stats={[
        { label: "Hooks generated", value: loading ? "..." : data?.hooksTotal.toLocaleString() ?? "0", tone: "violet" },
        { label: "Avg quality", value: loading ? "..." : data?.avgQuality != null ? `${data.avgQuality}/100` : "—", tone: "teal" },
        { label: "Tier A hooks", value: loading ? "..." : data?.tierACount.toLocaleString() ?? "0", tone: "amber" },
        { label: "Hot accounts", value: loading ? "..." : String(data?.trendingAccounts.length ?? 0), tone: "slate" },
      ]}
    >
      <section className="grid gap-6 lg:grid-cols-3">
        {loading
          ? [0, 1, 2].map((i) => <MetricCardSkeleton key={i} />)
          : cards.map((card) => (
              <div
                key={card.label}
                className="rounded-3xl border border-white/5 bg-[#0B0F1A] p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)] transition-all hover:border-violet-500/30"
              >
                <div className="flex justify-between mb-1 items-start gap-3">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                    {card.label}
                  </span>
                  {card.delta && (
                    <span
                      className={`text-[10px] font-bold ${card.positive ? "text-green-400" : "text-red-400"}`}
                    >
                      {card.delta}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold mb-1">{card.val}</div>
                <div className="text-[11px] text-slate-500 mb-3">{card.sub}</div>
                <div className="h-6 w-full opacity-40">
                  <ResponsiveContainer>
                    <LineChart data={sparklineData}>
                      <Line
                        type="monotone"
                        dataKey="v"
                        stroke={card.color}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
      </section>

      <SurfaceCard
        title="Workflow Scorecard"
        description="A business-facing view of active lead coverage, queue pressure, and where execution is starting to stall."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
            <ListChecks size={14} />
            Live workflow state
          </div>
        }
      >
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 animate-pulse">
                <div className="h-3 w-28 bg-white/10 rounded mb-3" />
                <div className="space-y-2">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-10 rounded bg-white/5" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Total leads", value: data.workflow.totalLeads, tone: "border-white/10 bg-white/[0.03] text-slate-200" },
                { label: "Active sequences", value: data.workflow.activeSequences, tone: "border-violet-500/20 bg-violet-500/10 text-violet-200" },
                { label: "Drafts waiting", value: data.workflow.draftsWaiting, tone: "border-amber-500/20 bg-amber-500/10 text-amber-200" },
                { label: "Queued to send", value: data.workflow.queuedMessages, tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200" },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl border p-4 ${item.tone}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-inherit/70">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-[#0B0F1A] p-5">
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Channel performance memory
                </p>
                {data.workflow.topChannels.length > 0 ? (
                  <div className="space-y-3">
                    {data.workflow.topChannels.map((row) => (
                      <div key={row.channel} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{formatChannel(row.channel)}</p>
                            <p className="text-[11px] text-slate-500">{row.attempts} attempts • {row.noReply} no reply</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">{row.positiveRate}% positive</p>
                            <p className="text-[11px] text-slate-500">{row.winRate}% win rate</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No sequence performance memory yet.</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/5 bg-[#0B0F1A] p-5">
                <p className="mb-4 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Stalled sequence leads
                </p>
                {data.workflow.stalledLeads.length > 0 ? (
                  <div className="space-y-3">
                    {data.workflow.stalledLeads.map((lead) => (
                      <div key={lead.leadId} className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{lead.leadName}</p>
                            <p className="text-[11px] text-slate-500">{lead.companyName} • {lead.sequenceName}</p>
                          </div>
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-amber-300">
                            <AlertTriangle size={12} />
                            Step {lead.currentStep + 1}
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">
                          Last contacted {formatRelative(lead.lastContactedAt)} • started {formatRelative(lead.startedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No stalled active sequence leads right now.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard
        title="Retrieval Quality"
        description="How recent hook evidence has been sourced over the last 30 days. This makes it easier to see whether results are leaning on first-party proof, trusted news, or noisier web coverage."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
            <BarChart3 size={14} />
            Last {data?.retrieval.windowDays ?? 30} days
          </div>
        }
      >
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 animate-pulse">
                <div className="h-3 w-20 bg-white/10 rounded mb-2" />
                <div className="h-6 w-12 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        ) : data && data.retrieval.total > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-sky-300">
                Mode: {data.retrieval.mode === "hybrid" ? "Hybrid" : data.retrieval.mode === "web_only" ? "Web only" : "Empty"}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
                {data.retrieval.total} sourced hooks sampled
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "First-party", value: data.retrieval.mix.firstParty, tone: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10" },
                { label: "Trusted news", value: data.retrieval.mix.trustedNews, tone: "text-sky-300 border-sky-500/20 bg-sky-500/10" },
                { label: "Semantic web", value: data.retrieval.mix.semanticWeb, tone: "text-violet-300 border-violet-500/20 bg-violet-500/10" },
                { label: "Fallback web", value: data.retrieval.mix.fallbackWeb, tone: "text-amber-300 border-amber-500/20 bg-amber-500/10" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/5 bg-[#0B0F1A] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                  <p className="mt-2 text-2xl font-bold text-white">{item.value}</p>
                  <div className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold ${item.tone}`}>
                    {data.retrieval.total > 0 ? Math.round((item.value / data.retrieval.total) * 100) : 0}% of recent mix
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#0B0F1A] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 mb-4">
                Outcome by retrieval type
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                {[
                  { label: "First-party", key: "firstParty" as const },
                  { label: "Trusted news", key: "trustedNews" as const },
                  { label: "Semantic web", key: "semanticWeb" as const },
                  { label: "Fallback web", key: "fallbackWeb" as const },
                ].map((item) => {
                  const row = data.retrieval.outcomes[item.key];
                  const copyRate = row.hooks > 0 ? Math.round((row.copies / row.hooks) * 100) : 0;
                  const emailRate = row.hooks > 0 ? Math.round((row.emailsUsed / row.hooks) * 100) : 0;
                  const winRate = row.hooks > 0 ? Math.round((row.wins / row.hooks) * 100) : 0;

                  return (
                    <div key={item.key} className="rounded-xl border border-white/5 bg-black/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                          {row.hooks} hook{row.hooks !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Copies</p>
                          <p className="mt-1 text-lg font-bold text-slate-100">{row.copies}</p>
                          <p className="text-[11px] text-slate-500">{copyRate}% rate</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Emails</p>
                          <p className="mt-1 text-lg font-bold text-slate-100">{row.emailsUsed}</p>
                          <p className="text-[11px] text-slate-500">{emailRate}% rate</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Wins</p>
                          <p className="mt-1 text-lg font-bold text-slate-100">{row.wins}</p>
                          <p className="text-[11px] text-slate-500">{winRate}% rate</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <EmptyStatePanel
            icon={BarChart3}
            title="No retrieval analytics yet"
            description="Generate more hooks first. Once recent evidence starts flowing through the system, this section will show whether your best hooks are leaning on first-party proof, trusted news, or broader web coverage."
            actions={[
              { href: "/app/hooks", label: "Generate Hooks", icon: Zap, variant: "primary" },
              { href: "/app/watchlist", label: "Open Watchlist", icon: Target },
            ]}
          />
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Learned Retrieval Preferences"
        description="What the system has learned from your recent hook outcomes. These preferences now feed back into ranking, so this is the quickest way to inspect whether the model is leaning toward the right source patterns."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
            <Target size={14} />
            Outcome-weighted memory
          </div>
        }
      >
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 animate-pulse">
                <div className="h-3 w-28 bg-white/10 rounded mb-3" />
                <div className="space-y-2">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-10 rounded bg-white/5" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : data && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/5 bg-[#0B0F1A] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 mb-4">
                Top source preferences
              </p>
              {data.retrieval.memory.topSourcePreferences.length > 0 ? (
                <div className="space-y-3">
                  {data.retrieval.memory.topSourcePreferences.map((row) => (
                    <div key={row.sourceType} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {sourceTypeLabels[row.sourceType]}{row.pinned ? " (Pinned)" : ""}
                        </p>
                        <p className="text-[11px] text-slate-500">Broad retrieval bias from recent outcomes</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${row.adjustment >= 0 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
                        {formatAdjustment(row.adjustment)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No learned source preferences yet.</p>
              )}
            </div>

            <div className="rounded-2xl border border-white/5 bg-[#0B0F1A] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 mb-4">
                Top trigger-specific pairings
              </p>
              {data.retrieval.memory.topTriggerPreferences.length > 0 ? (
                <div className="space-y-3">
                  {data.retrieval.memory.topTriggerPreferences.map((row) => (
                    <div key={`${row.triggerType}-${row.sourceType}`} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-white capitalize">
                          {row.triggerType} + {sourceTypeLabels[row.sourceType]}{row.pinned ? " (Pinned)" : ""}
                        </p>
                        <p className="text-[11px] text-slate-500">Learned preference for this trigger/source combination</p>
                      </div>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${row.adjustment >= 0 ? "border-sky-500/20 bg-sky-500/10 text-sky-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"}`}>
                        {formatAdjustment(row.adjustment)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No trigger-specific retrieval patterns learned yet.</p>
              )}
            </div>
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard
        title="Trending accounts"
        description="Based on recent signals and lead freshness. Use this as the bridge from Analytics back into Accounts, Leads, and Inbox."
        action={
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
            <BarChart3 size={14} />
            Prioritise hot accounts first
          </div>
        }
      >
        {loading ? (
          <div className="divide-y divide-white/5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="p-4 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white/5" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-28 bg-white/10 rounded" />
                    <div className="h-2.5 w-20 bg-white/5 rounded" />
                  </div>
                </div>
                <div className="h-6 w-16 bg-white/5 rounded-full" />
              </div>
            ))}
          </div>
        ) : data && data.trendingAccounts.length > 0 ? (
          <div className="divide-y divide-white/5">
            {data.trendingAccounts.map((account) => {
              const style = tempStyles[account.temperature] ?? tempStyles.cold;
              return (
                <div
                  key={account.companyName}
                  className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-sm">
                      {account.companyName[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{account.companyName}</p>
                      <p className="text-xs text-slate-500">Score: {account.score}</p>
                    </div>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${style.bg} ${style.color}`}
                  >
                    <Thermometer size={12} /> {style.label}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyStatePanel
            icon={Flame}
            title="No scored leads yet"
            description="Generate hooks, save the best prospects into Leads, and monitor key accounts in Watchlist so this view has real buying-signal movement to rank."
            actions={[
              { href: "/app/hooks", label: "Generate Hooks", icon: Zap, variant: "primary" },
              { href: "/app/leads", label: "Add Leads", icon: Users },
              { href: "/app/watchlist", label: "Build Watchlist", icon: Target },
            ]}
          />
        )}
      </SurfaceCard>
    </AppPageShell>
  );
}
