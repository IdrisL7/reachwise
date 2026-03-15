"use client";

import { Building, Tag, Users, MapPin, Calendar } from "lucide-react";
import { LockedDataField } from "@/components/ui/locked-data-field";
import type { CompanyIntelligence } from "@/lib/company-intel";

interface CompanyIntelPanelProps {
  intel: CompanyIntelligence;
  isBasic: boolean;
  onGenerateHooks?: (url: string) => void;
}

export function CompanyIntelPanel({ intel, isBasic }: CompanyIntelPanelProps) {
  const cells = [
    { icon: <Building size={14} strokeWidth={1.5} />, label: "Company", value: intel.companyName },
    { icon: <Tag size={14} strokeWidth={1.5} />, label: "Industry", value: intel.industry },
    { icon: <Users size={14} strokeWidth={1.5} />, label: "Size", value: intel.employeeRange },
    { icon: <MapPin size={14} strokeWidth={1.5} />, label: "HQ", value: intel.hqLocation },
    { icon: <Calendar size={14} strokeWidth={1.5} />, label: "Founded", value: intel.foundedYear ? String(intel.foundedYear) : null },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 animate-slide-in-bottom">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">Company Intelligence</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {cells.map((cell) => (
          <div key={cell.label} className="flex items-start gap-2">
            <span className="text-zinc-600 mt-0.5 shrink-0">{cell.icon}</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{cell.label}</p>
              <p className="text-sm text-zinc-300">{cell.value || "—"}</p>
            </div>
          </div>
        ))}
      </div>

      {intel.description && (
        <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{intel.description}</p>
      )}

      {isBasic ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <LockedDataField label="Tech Stack" />
          <LockedDataField label="Key Roles" />
          <LockedDataField label="Competitors" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Tech Stack</p>
            <p className="text-sm text-zinc-300">{intel.techStack.length ? intel.techStack.join(", ") : "No strong evidence"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Key Roles</p>
            <p className="text-sm text-zinc-300">
              {intel.decisionMakers.length ? intel.decisionMakers.map((x) => x.title).join(", ") : "No roles found"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-1">Competitors</p>
            <p className="text-sm text-zinc-300">
              {intel.competitors.length ? intel.competitors.map((x) => x.name).join(", ") : "No competitors found"}
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="flex justify-between text-[10px] text-zinc-600 mb-1">
          <span>Data confidence</span>
          <span>{Math.round((intel.confidenceScore || 0) * 100)}%</span>
        </div>
        <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500/70 rounded-full transition-all"
            style={{ width: `${Math.round((intel.confidenceScore || 0) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
