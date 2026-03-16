"use client";

import Link from "next/link";
import { ExternalLink, Zap } from "lucide-react";
import type { DiscoveredCompany } from "@/lib/discovery";

interface CompanyResultCardProps {
  company: DiscoveredCompany;
  onViewIntel: (company: DiscoveredCompany) => void;
  intelLoading?: boolean;
}

export function CompanyResultCard({ company, onViewIntel, intelLoading = false }: CompanyResultCardProps) {
  const confidence = Math.round(company.confidenceScore * 100);

  return (
    <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-5 hover:border-purple-500/20 transition-all group mb-3">
      <div className="flex items-start justify-between gap-4">
        {/* Left: name + domain + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-slate-100 truncate">{company.name}</h3>
            <a
              href={company.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-600 hover:text-slate-400 transition-colors shrink-0"
            >
              <ExternalLink size={13} />
            </a>
          </div>
          <p className="text-xs text-slate-500 font-mono mb-2">{company.domain}</p>
          <p className="text-sm text-slate-400 leading-relaxed mb-3">
            {company.description || "No description available."}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
            {company.industry && <span>{company.industry}</span>}
            {company.employeeRange && <span>{company.employeeRange}</span>}
            {company.location && <span>{company.location}</span>}
          </div>
        </div>

        {/* Right: confidence score */}
        <div className="shrink-0 flex flex-col items-center gap-1 pt-0.5">
          <span className={`text-lg font-black tabular-nums ${confidence >= 75 ? "text-teal-400" : confidence >= 50 ? "text-purple-400" : "text-slate-500"}`}>
            {confidence}%
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Match</span>
        </div>
      </div>

      {/* Signal badges */}
      {company.matchingSignals?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/5">
          <Zap size={11} className="text-slate-600 mt-0.5 shrink-0" />
          {company.matchingSignals.map((signal) => (
            <span
              key={signal}
              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20"
            >
              {signal}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onViewIntel(company)}
          disabled={intelLoading}
          className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 disabled:opacity-50 transition-colors"
        >
          {intelLoading ? "Loading…" : "View Intel"}
        </button>
        <Link
          href={`/app/hooks?url=${encodeURIComponent(company.url)}`}
          className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition-colors shadow-md shadow-purple-500/20"
        >
          Generate Hooks
        </Link>
      </div>
    </div>
  );
}
