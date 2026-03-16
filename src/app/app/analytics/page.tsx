"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { Flame, Thermometer } from "lucide-react";

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
  trendingAccounts: TrendingAccount[];
};

const tempStyles: Record<string, { color: string; bg: string; label: string }> = {
  hot: { color: "text-orange-500", bg: "bg-orange-500/10", label: "Hot" },
  warm: { color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Warm" },
  cold: { color: "text-blue-400", bg: "bg-blue-400/10", label: "Cold" },
};

function MetricCardSkeleton() {
  return (
    <div className="bg-[#111111] p-5 rounded-xl border border-white/5 animate-pulse">
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
    <div className="bg-[#030014] p-8 space-y-10 min-h-screen text-white font-sans">

      {/* Metric Cards */}
      <div className="grid grid-cols-3 gap-6">
        {loading
          ? [0, 1, 2].map((i) => <MetricCardSkeleton key={i} />)
          : cards.map((card) => (
              <div
                key={card.label}
                className="bg-[#111111] p-5 rounded-xl border border-white/5 hover:border-purple-500/50 transition-all"
              >
                <div className="flex justify-between mb-1 items-start">
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
      </div>

      {/* Trending Accounts */}
      <div className="bg-[#111111] rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2 italic text-purple-400 uppercase tracking-tighter">
            <Flame size={18} fill="currentColor" /> Trending Accounts
          </h3>
          <span className="text-xs text-slate-500">Based on recent signals &amp; freshness</span>
        </div>

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
          <div className="p-12 text-center">
            <p className="text-slate-500 text-sm">
              No scored leads yet. Generate hooks and add leads to start tracking intent signals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
