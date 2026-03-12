"use client";

import Link from "next/link";
import type { DiscoveredCompany } from "@/lib/discovery";

interface CompanyResultCardProps {
  company: DiscoveredCompany;
  onViewIntel: (company: DiscoveredCompany) => void;
  intelLoading?: boolean;
}

export function CompanyResultCard({ company, onViewIntel, intelLoading = false }: CompanyResultCardProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-100">{company.name}</h3>
          <p className="text-xs text-zinc-500">{company.domain}</p>
        </div>
        <div className="text-xs text-zinc-400">{Math.round(company.confidenceScore * 100)}%</div>
      </div>
      <p className="text-sm text-zinc-300 mt-2">{company.description || "No description"}</p>
      <div className="text-xs text-zinc-500 mt-2">
        {(company.industry || "Unknown")} · {(company.employeeRange || "Unknown size")} · {(company.location || "Unknown location")}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onViewIntel(company)}
          className="text-xs px-2 py-1 border border-violet-700 text-violet-300 hover:bg-violet-900/30 rounded"
          disabled={intelLoading}
        >
          {intelLoading ? "Loading intel..." : "View Intel"}
        </button>
        <Link href={`/app/hooks?url=${encodeURIComponent(company.url)}`} className="text-xs px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded">
          Generate Hooks
        </Link>
        <a href={company.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 border border-zinc-700 rounded text-zinc-300">Visit</a>
      </div>
    </div>
  );
}
