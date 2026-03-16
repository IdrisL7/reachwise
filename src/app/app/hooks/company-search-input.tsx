"use client";

import { useState, useEffect, useRef } from "react";

type SourceResult = {
  url: string;
  title: string;
  label: string;
  domain: string;
  priority: number;
};

type SelectedSource = {
  url: string;
  label: string;
  domain: string;
  companyName: string;
};

interface Props {
  onSourceSelected: (url: string, companyName: string) => void;
  onCompanyNameChange: (name: string) => void;
}

const PLACEHOLDER_COMPANIES = [
  "e.g. Gong",
  "e.g. Shopify",
  "e.g. Salesforce",
  "e.g. HubSpot",
  "e.g. Notion",
];

const RECENT_SEARCHES_KEY = "gsh_recent_searches";
const MAX_RECENT = 3;

function getSourceBadgeStyle(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("linkedin"))
    return "bg-[#0077b5]/10 border-[#0077b5]/30 text-[#38aee6]";
  if (lower.includes("news"))
    return "bg-amber-500/10 border-amber-500/30 text-amber-400";
  if (lower.includes("press"))
    return "bg-violet-600/10 border-violet-500/20 text-violet-400";
  if (lower.includes("funding"))
    return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
  if (lower.includes("revenue"))
    return "bg-rose-500/10 border-rose-500/30 text-rose-400";
  return "bg-zinc-600/10 border-zinc-500/20 text-zinc-400";
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 w-full rounded-lg border border-[#252830] bg-[#0e0f10] px-4 py-2.5">
      <div className="relative overflow-hidden h-5 w-20 rounded bg-[#1e2025] shrink-0">
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-zinc-700/20 to-transparent" />
      </div>
      <div className="relative overflow-hidden h-4 flex-1 rounded bg-[#1e2025]">
        <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-zinc-700/20 to-transparent" />
      </div>
    </div>
  );
}

export function CompanySearchInput({ onSourceSelected, onCompanyNameChange }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SourceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [selectedSource, setSelectedSource] = useState<SelectedSource | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [leadsCompanies, setLeadsCompanies] = useState<Array<{ name: string; domain: string }>>([]);
  const [icpKeywords, setIcpKeywords] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches, leads companies, and ICP context on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}

    // Load leads companies for autocomplete
    fetch("/api/leads?limit=200")
      .then((r) => r.json())
      .then((data) => {
        if (!data.leads) return;
        const seen = new Set<string>();
        const companies: Array<{ name: string; domain: string }> = [];
        for (const lead of data.leads) {
          const name = lead.companyName?.trim();
          if (!name || seen.has(name.toLowerCase())) continue;
          seen.add(name.toLowerCase());
          let domain = "";
          try {
            if (lead.companyWebsite) domain = new URL(lead.companyWebsite).hostname.replace("www.", "");
          } catch {}
          companies.push({ name, domain });
        }
        setLeadsCompanies(companies);
      })
      .catch(() => {});

    // Load ICP keywords from workspace profile
    fetch("/api/workspace-profile")
      .then((r) => r.json())
      .then((data) => {
        const industry = data.profile?.icpIndustry?.trim();
        if (industry) setIcpKeywords(industry);
      })
      .catch(() => {});
  }, []);

  // Rotating placeholder
  useEffect(() => {
    const cycle = setInterval(() => {
      setPlaceholderVisible(false);
      setTimeout(() => {
        setPlaceholderIdx((i) => (i + 1) % PLACEHOLDER_COMPANIES.length);
        setPlaceholderVisible(true);
      }, 300);
    }, 2500);
    return () => clearInterval(cycle);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-search debounce (350ms)
  useEffect(() => {
    if (searchQuery.length < 2) {
      setDebouncing(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    setDebouncing(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncing(false);
      runSearch(searchQuery);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  function saveRecentSearch(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...recentSearches.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  }

  function removeRecentSearch(name: string) {
    const updated = recentSearches.filter((s) => s !== name);
    setRecentSearches(updated);
    try {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {}
  }

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setActiveIndex(-1);
    try {
      const enrichedQuery = icpKeywords
        ? `${query.trim()} ${icpKeywords} news funding press`
        : `${query.trim()} news funding press`;
      const res = await fetch("/api/search-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: enrichedQuery }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setSearchResults(data.sources ?? []);
      if (!data.sources?.length) setSearchError("no_results");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function selectSource(source: SourceResult) {
    const name = searchQuery.trim();
    saveRecentSearch(name);
    setSelectedSource({ url: source.url, label: source.label, domain: source.domain, companyName: name });
    setSearchResults([]);
    setIsFocused(false);
    onSourceSelected(source.url, name);
  }

  function resetSearch() {
    setSelectedSource(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setActiveIndex(-1);
    onCompanyNameChange("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // Leads companies filtered by prefix
  const leadsMatches = searchQuery.length >= 1
    ? leadsCompanies.filter((c) =>
        c.name.toLowerCase().startsWith(searchQuery.toLowerCase()) ||
        c.domain.toLowerCase().startsWith(searchQuery.toLowerCase())
      ).slice(0, 3)
    : [];

  const showDropdown =
    isFocused &&
    !selectedSource &&
    ((searchQuery === "" && recentSearches.length > 0) ||
      leadsMatches.length > 0 ||
      searching ||
      searchResults.length > 0 ||
      searchError !== null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < searchResults.length) {
        selectSource(searchResults[activeIndex]);
      } else {
        runSearch(searchQuery);
      }
      return;
    }
    if (e.key === "Escape") {
      setIsFocused(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
      return;
    }
  }

  return (
    <div>
      {/* Selected source chip */}
      {selectedSource ? (
        <div className="animate-fade-in flex items-center gap-2 bg-[#030014] border border-violet-500/30 rounded-xl px-3 py-3">
          <span
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap ${getSourceBadgeStyle(selectedSource.label)}`}
          >
            {selectedSource.label}
          </span>
          <span className="text-sm text-zinc-300 truncate flex-1">{selectedSource.domain}</span>
          <button
            type="button"
            onClick={resetSearch}
            className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
            aria-label="Clear selection"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          {/* Input row */}
          <div className="relative">
            {/* Rotating placeholder overlay */}
            {!searchQuery && (
              <div
                className="absolute inset-y-0 left-12 flex items-center pointer-events-none"
                style={{
                  transition: "opacity 0.3s ease, transform 0.3s ease",
                  opacity: placeholderVisible ? 1 : 0,
                  transform: placeholderVisible ? "translateY(0)" : "translateY(4px)",
                }}
              >
                <span className="text-slate-600 text-sm">{PLACEHOLDER_COMPANIES[placeholderIdx]}</span>
              </div>
            )}
            {/* Debounce pulse dot */}
            {debouncing && (
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
              </div>
            )}
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"
              width={18}
              height={18}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                setSearchResults([]);
                setSearchError(null);
                setActiveIndex(-1);
                onCompanyNameChange(val);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              className="w-full bg-[#030014] border border-white/10 rounded-xl p-4 pl-12 text-sm focus:border-purple-500 outline-none transition-all"
            />
          </div>

          {/* Dropdown panel */}
          {showDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-20 animate-slide-in-bottom rounded-xl border border-[#252830] bg-[#14161a]/95 backdrop-blur-sm shadow-2xl overflow-hidden">
              {/* Recent searches — shown when query is empty */}
              {searchQuery === "" && recentSearches.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
                    <svg className="h-3 w-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[0.6875rem] text-zinc-600 font-medium uppercase tracking-wider">Recent</span>
                  </div>
                  {recentSearches.map((name) => (
                    <div key={name} className="flex items-center gap-2 group">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery(name);
                          setIsFocused(true);
                          onCompanyNameChange(name);
                          runSearch(name);
                        }}
                        className="flex-1 text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1c22] transition-colors"
                      >
                        {name}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecentSearch(name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-zinc-400 transition-all mr-1"
                        aria-label="Remove from recent"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Leads company suggestions */}
              {searchQuery.length >= 1 && leadsMatches.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
                    <svg className="h-3 w-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                    </svg>
                    <span className="text-[0.6875rem] text-zinc-600 font-medium uppercase tracking-wider">Your Leads</span>
                  </div>
                  {leadsMatches.map((company) => (
                    <button
                      key={company.name}
                      type="button"
                      onClick={() => {
                        setSearchQuery(company.name);
                        onCompanyNameChange(company.name);
                        setIsFocused(true);
                        runSearch(company.name);
                      }}
                      className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1c22] transition-colors"
                    >
                      <span className="text-zinc-300">{company.name}</span>
                      {company.domain && (
                        <span className="text-zinc-600 text-xs">{company.domain}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Skeleton rows while searching */}
              {searching && (
                <div className="p-2 flex flex-col gap-1.5">
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              )}

              {/* Source results */}
              {!searching && searchResults.length > 0 && (
                <div className="p-2">
                  <p className="text-[0.6875rem] text-zinc-600 font-medium uppercase tracking-wider px-2 py-1 mb-0.5">
                    Sources — ranked by signal quality
                  </p>
                  <div className="flex flex-col gap-1">
                    {searchResults.map((source, i) => (
                      <button
                        key={source.url}
                        type="button"
                        onClick={() => selectSource(source)}
                        style={{ animationDelay: `${i * 50}ms` }}
                        className={`animate-fade-in flex items-center gap-3 w-full rounded-lg border px-4 py-2.5 text-left transition-all group ${
                          activeIndex === i
                            ? "border-violet-500/40 bg-violet-500/5 ring-1 ring-inset ring-violet-500/20"
                            : "border-[#252830] bg-[#0e0f10] hover:border-violet-500/40 hover:bg-[#111319]"
                        }`}
                      >
                        <span
                          className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap ${getSourceBadgeStyle(source.label)}`}
                        >
                          {source.label}
                        </span>
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">
                            {source.domain}
                          </span>
                          {source.title && (
                            <span className="text-[11px] text-zinc-600 group-hover:text-zinc-500 transition-colors truncate">
                              {source.title}
                            </span>
                          )}
                        </span>
                        <svg
                          className="h-3.5 w-3.5 text-zinc-600 group-hover:text-violet-400 shrink-0 transition-colors"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No results */}
              {!searching && searchError === "no_results" && (
                <div className="p-6 text-center">
                  <svg className="h-10 w-10 text-zinc-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z" />
                  </svg>
                  <p className="text-sm text-zinc-400 mb-1">
                    No sources found for <span className="text-zinc-200">&ldquo;{searchQuery}&rdquo;</span>
                  </p>
                  <p className="text-xs text-zinc-600 mb-3">Try a different spelling or paste a URL directly</p>
                  {!showUrlInput && (
                    <button
                      type="button"
                      onClick={() => { setShowUrlInput(true); setIsFocused(false); }}
                      className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
                    >
                      Paste a URL directly →
                    </button>
                  )}
                </div>
              )}

              {/* Generic error */}
              {!searching && searchError && searchError !== "no_results" && (
                <div className="p-4">
                  <p className="text-sm text-red-400">{searchError}</p>
                </div>
              )}
            </div>
          )}

          {/* URL escape hatch */}
          <div className="mt-2">
            {!showUrlInput ? (
              <button
                type="button"
                onClick={() => setShowUrlInput(true)}
                className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors underline underline-offset-2"
              >
                Already have a URL? Paste it directly
              </button>
            ) : (
              <input
                type="text"
                placeholder="https://techcrunch.com/..."
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && directUrl.trim()) {
                    e.preventDefault();
                    onSourceSelected(directUrl.trim(), searchQuery.trim());
                  }
                }}
                onBlur={() => {
                  if (directUrl.trim()) onSourceSelected(directUrl.trim(), searchQuery.trim());
                }}
                className="mt-1 w-full bg-[#030014] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-purple-500 outline-none transition-all"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
