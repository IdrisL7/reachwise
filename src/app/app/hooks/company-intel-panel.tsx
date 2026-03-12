"use client";

import { useState } from "react";
import type { CompanyIntelligence } from "@/lib/company-intel";

interface CompanyIntelPanelProps {
  intel: CompanyIntelligence;
  isBasic: boolean;
  onGenerateHooks?: (url: string) => void;
}

export function CompanyIntelPanel({ intel, isBasic, onGenerateHooks }: CompanyIntelPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6 animate-slide-in-bottom">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-200">Company Intelligence</h3>
        <button onClick={() => setOpen((v) => !v)} className="text-xs text-zinc-400 hover:text-zinc-200">
          {open ? "Collapse ↑" : "Expand ↓"}
        </button>
      </div>

      {open && (
        <div className="space-y-3 text-sm">
          <div className="grid sm:grid-cols-3 gap-2 text-zinc-300">
            <div>{intel.companyName || "Unknown company"}</div>
            <div>{intel.industry || "Unknown industry"}</div>
            <div>{intel.employeeRange || "Unknown size"}</div>
          </div>
          <div className="text-zinc-400 text-xs">
            {intel.hqLocation || "HQ unknown"}
            {intel.foundedYear ? ` · Founded ${intel.foundedYear}` : ""}
          </div>
          {intel.description && <p className="text-zinc-300">{intel.description}</p>}

          {!isBasic ? (
            <>
              <div>
                <p className="text-zinc-500 text-xs mb-1">Tech Stack</p>
                <p className="text-zinc-300">{intel.techStack.length ? intel.techStack.join(", ") : "No strong evidence"}</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-zinc-500 text-xs mb-1">Key Roles</p>
                  <p className="text-zinc-300">
                    {intel.decisionMakers.length
                      ? intel.decisionMakers.map((x) => x.title).join(", ")
                      : "No roles found"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs mb-1">Competitors</p>
                  <p className="text-zinc-300">
                    {intel.competitors.length ? intel.competitors.map((x) => x.name).join(", ") : "No competitors found"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400">
              Upgrade to Pro to see tech stack, decision makers, and competitors.
            </div>
          )}

          <div className="text-xs text-zinc-500">Confidence: {Math.round((intel.confidenceScore || 0) * 100)}%</div>

          {onGenerateHooks && intel.companyName && (
            <button
              onClick={() => onGenerateHooks(`https://${intel.companyName}`)}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg"
            >
              Generate hooks
            </button>
          )}
        </div>
      )}
    </div>
  );
}
