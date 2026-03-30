"use client";

import { useEffect, useState } from "react";
import type { DiscoveryCriteria, DiscoveredCompany } from "@/lib/discovery";
import type { CompanyIntelligence } from "@/lib/company-intel";
import { DiscoveryForm } from "./discovery-form";
import { CompanyResultCard } from "./company-result-card";
import { CompanyIntelPanel } from "../hooks/company-intel-panel";

interface SavedSearch {
  id: string;
  name: string | null;
  criteria: DiscoveryCriteria;
  resultCount: number;
  createdAt: string;
}

export default function DiscoverPage() {
  const [criteria, setCriteria] = useState<DiscoveryCriteria>({ signals: ["hiring", "funding"] });
  const [results, setResults] = useState<DiscoveredCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tierId, setTierId] = useState<"free" | "pro">("free");
  const [intelByDomain, setIntelByDomain] = useState<Record<string, CompanyIntelligence>>({});
  const [intelLoadingDomain, setIntelLoadingDomain] = useState<string | null>(null);
  const [searchId, setSearchId] = useState<string | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string>("");

  useEffect(() => {
    fetch("/api/user-stats")
      .then((res) => res.json())
      .then((data) => setTierId((data.tier || "free") as "free" | "pro"))
      .catch(() => {});
    loadSavedSearches();
  }, []);

  function loadSavedSearches() {
    fetch("/api/discover?saved=1")
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setSavedSearches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  const isDiscoveryLocked = tierId === "free";

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
      setSearchId(data.searchId || null);
      setHasSearched(true);
      setSaveNotice("");
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

  async function saveSearch() {
    if (!searchId) return;
    setSavingSearch(true);
    setSaveNotice("");
    try {
      const labelParts = [criteria.industry, criteria.location].filter(Boolean);
      const generatedName = labelParts.length
        ? `${labelParts.join(" • ")} (${new Date().toLocaleDateString()})`
        : `Search ${new Date().toLocaleDateString()}`;

      const res = await fetch("/api/discover", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchId, name: generatedName }),
      });
      if (!res.ok) throw new Error("Failed to save search");
      loadSavedSearches();
      setSaveNotice("Search saved");
    } catch {
      setSaveNotice("Could not save search");
    }
    setSavingSearch(false);
  }

  function loadSearch(search: SavedSearch) {
    setCriteria(search.criteria);
    setShowSaved(false);
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
    <div className="p-8 bg-[#030014] min-h-screen">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Discover Companies</h1>
        {savedSearches.length > 0 && (
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition-colors"
          >
            {showSaved ? "Hide" : "Saved Searches"} ({savedSearches.length})
          </button>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-6">Find prospects matching your ideal customer profile.</p>

      {showSaved && (
        <div className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-4 mb-6 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Saved Searches</p>
          {savedSearches.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSearch(s)}
              className="w-full text-left flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 group transition-colors"
            >
              <span className="text-sm text-slate-200">{s.name || "Untitled search"}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 group-hover:text-slate-400">
                {s.resultCount} results &middot; {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <DiscoveryForm criteria={criteria} setCriteria={setCriteria} onSubmit={runDiscovery} loading={loading || isDiscoveryLocked} />
        {isDiscoveryLocked && (
          <div className="absolute inset-0 bg-[#030014]/90 border border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
            <p className="text-slate-200 font-bold mb-2">Lead Discovery is available on the Pro plan.</p>
            <p className="text-slate-500 text-sm mb-4">Upgrade to search prospects by industry, tech stack, and growth signals.</p>
            <a href="/#pricing" className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-purple-500/20">Upgrade to Pro</a>
          </div>
        )}
      </div>

      {error && <div className="bg-red-900/30 border border-red-800/50 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm">{error}</div>}
      {saveNotice && <div className="bg-[#0B0F1A] border border-white/10 text-slate-300 px-4 py-2 rounded-xl mb-6 text-sm">{saveNotice}</div>}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {results.length} companies found
            </p>
            <div className="flex gap-2">
              {searchId && (
                <button onClick={saveSearch} disabled={savingSearch} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-purple-500/40 text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 transition-colors">
                  {savingSearch ? "Saving…" : "Save Search"}
                </button>
              )}
              <button onClick={exportCsv} className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition-colors">Export CSV</button>
            </div>
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
                  isBasic={tierId === "free"}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {hasSearched && !loading && results.length === 0 && !error && (
        <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center">
          <p className="text-slate-500 text-sm">No companies found. Try different keywords, a broader industry description, or add a location.</p>
        </div>
      )}
    </div>
  );
}
