"use client";

import { useEffect, useState } from "react";
import type { DiscoveryCriteria, DiscoveredCompany } from "@/lib/discovery";
import type { CompanyIntelligence } from "@/lib/company-intel";
import { DiscoveryForm } from "./discovery-form";
import { CompanyResultCard } from "./company-result-card";
import { CompanyIntelPanel } from "../hooks/company-intel-panel";

export default function DiscoverPage() {
  const [criteria, setCriteria] = useState<DiscoveryCriteria>({ signals: ["hiring", "funding"] });
  const [results, setResults] = useState<DiscoveredCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tierId, setTierId] = useState<"starter" | "pro" | "concierge">("starter");
  const [intelByDomain, setIntelByDomain] = useState<Record<string, CompanyIntelligence>>({});
  const [intelLoadingDomain, setIntelLoadingDomain] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user-stats")
      .then((res) => res.json())
      .then((data) => setTierId((data.tier || "starter") as "starter" | "pro" | "concierge"))
      .catch(() => {});
  }, []);

  const isDiscoveryLocked = tierId === "starter";

  async function runDiscovery() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Discovery failed");
      setResults(data.companies || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewIntel(company: DiscoveredCompany) {
    const domain = company.domain;
    if (intelByDomain[domain]) {
      setIntelByDomain((prev) => {
        const next = { ...prev };
        delete next[domain];
        return next;
      });
      return;
    }

    setIntelLoadingDomain(domain);
    setError("");
    try {
      const res = await fetch(`/api/company-intel?url=${encodeURIComponent(company.url)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to fetch company intel");
      setIntelByDomain((prev) => ({ ...prev, [domain]: data }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIntelLoadingDomain(null);
    }
  }

  function exportCsv() {
    if (!results.length) return;
    const rows = [
      ["name", "domain", "url", "description", "industry", "size", "location", "matched_signals", "confidence"],
      ...results.map((r) => [
        r.name,
        r.domain,
        r.url,
        r.description,
        r.industry || "",
        r.employeeRange || "",
        r.location || "",
        r.matchingSignals.join("|"),
        String(Math.round(r.confidenceScore * 100)),
      ]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gsh-discovery-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Discover Companies</h1>
      <p className="text-zinc-400 text-sm mb-6">Find prospects matching your ideal customer profile.</p>

      <div className="relative">
        <DiscoveryForm criteria={criteria} setCriteria={setCriteria} onSubmit={runDiscovery} loading={loading || isDiscoveryLocked} />
        {isDiscoveryLocked && (
          <div className="absolute inset-0 bg-[#080808]/85 border border-zinc-800 rounded-xl flex flex-col items-center justify-center p-6 text-center">
            <p className="text-zinc-200 font-medium mb-2">Lead Discovery is available on Pro and Concierge.</p>
            <p className="text-zinc-400 text-sm mb-4">Upgrade to search prospects by industry, tech stack, and growth signals.</p>
            <a href="/#pricing" className="bg-violet-600 hover:bg-violet-500 text-white text-sm px-4 py-2 rounded-lg">Upgrade to Pro</a>
          </div>
        )}
      </div>

      {error && <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-zinc-400">Found {results.length} companies matching your criteria</p>
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800">Export All CSV</button>
          </div>
          {results.map((company) => (
            <div key={company.domain}>
              <CompanyResultCard
                company={company}
                onViewIntel={handleViewIntel}
                intelLoading={intelLoadingDomain === company.domain}
              />
              {intelByDomain[company.domain] && (
                <CompanyIntelPanel
                  intel={intelByDomain[company.domain]}
                  isBasic={tierId === "starter"}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
