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

interface HookFormProps {
  onSourceSelected: (url: string, companyName: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  targetRole: string;
  setTargetRole: (v: string) => void;
  showCustomRole: boolean;
  setShowCustomRole: (v: boolean) => void;
  customRoleInput: string;
  setCustomRoleInput: (v: string) => void;
  customPain: string;
  setCustomPain: (v: string) => void;
  customPromise: string;
  setCustomPromise: (v: string) => void;
  pitchContext: string;
  setPitchContext: (v: string) => void;
  isPaidUser: boolean;
  loading: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}

const loadingSteps = [
  "Finding signals...",
  "Analyzing evidence...",
  "Drafting hooks...",
];

function LoadingText() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % loadingSteps.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  return <span className="animate-fade-in">{loadingSteps[step]}</span>;
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

export function HookForm({
  onSourceSelected,
  companyName,
  setCompanyName,
  targetRole,
  setTargetRole,
  showCustomRole,
  setShowCustomRole,
  customRoleInput,
  setCustomRoleInput,
  customPain,
  setCustomPain,
  customPromise,
  setCustomPromise,
  pitchContext,
  setPitchContext,
  isPaidUser,
  loading,
  error,
  onSubmit,
}: HookFormProps) {
  const [showPitchContext, setShowPitchContext] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SourceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [directUrl, setDirectUrl] = useState("");
  const [selectedSource, setSelectedSource] = useState<SelectedSource | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [debouncing, setDebouncing] = useState(false);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [placeholderVisible, setPlaceholderVisible] = useState(true);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
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
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-search debounce
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
    }, 420);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  function saveRecentSearch(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const updated = [
      trimmed,
      ...recentSearches.filter((s) => s !== trimmed),
    ].slice(0, MAX_RECENT);
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
      const res = await fetch("/api/search-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: query.trim() }),
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
    const name = searchQuery.trim() || companyName;
    setCompanyName(name);
    saveRecentSearch(name);
    setSelectedSource({
      url: source.url,
      label: source.label,
      domain: source.domain,
      companyName: name,
    });
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
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const showDropdown =
    isFocused &&
    !selectedSource &&
    ((searchQuery === "" && recentSearches.length > 0) ||
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
    <form id="hooks-form" onSubmit={onSubmit} className="mb-8">
      <div className="bg-[#14161a] border border-[#252830] rounded-xl p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {/* Search-first company input */}
          <div className="sm:col-span-2">
            <label className="block text-sm text-zinc-400 mb-1.5">
              Who are you targeting?
            </label>

            {/* Selected source chip */}
            {selectedSource ? (
              <div className="animate-fade-in flex items-center gap-2 bg-[#0e0f10] border border-violet-500/30 rounded-lg px-3 py-2.5">
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap ${getSourceBadgeStyle(selectedSource.label)}`}
                >
                  {selectedSource.label}
                </span>
                <span className="text-sm text-zinc-300 truncate flex-1">
                  {selectedSource.domain}
                </span>
                <button
                  type="button"
                  onClick={resetSearch}
                  className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
                  aria-label="Clear selection"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <div
                ref={containerRef}
                className={`relative transition-all duration-200 ${isFocused ? "pb-1" : ""}`}
              >
                {/* Input row */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    {/* Rotating placeholder overlay */}
                    {!searchQuery && (
                      <div
                        className="absolute inset-y-0 left-4 flex items-center pointer-events-none"
                        style={{
                          transition: "opacity 0.3s ease, transform 0.3s ease",
                          opacity: placeholderVisible ? 1 : 0,
                          transform: placeholderVisible
                            ? "translateY(0)"
                            : "translateY(4px)",
                        }}
                      >
                        <span className="text-[#52555a] text-sm">
                          {PLACEHOLDER_COMPANIES[placeholderIdx]}
                        </span>
                      </div>
                    )}
                    {/* Debounce pulse dot */}
                    {debouncing && (
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                      </div>
                    )}
                    <input
                      ref={inputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchResults([]);
                        setSearchError(null);
                        setActiveIndex(-1);
                      }}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setIsFocused(true)}
                      className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-4 py-2.5 text-[#eceae6] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => runSearch(searchQuery)}
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2.5 rounded-lg bg-zinc-800 border border-[#252830] text-zinc-300 hover:border-violet-500/40 hover:text-white transition-all disabled:opacity-50 text-sm font-medium whitespace-nowrap"
                  >
                    {searching ? "Searching..." : "Find sources"}
                  </button>
                </div>

                {/* Dropdown panel */}
                {showDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 z-20 animate-slide-in-bottom rounded-xl border border-[#252830] bg-[#14161a]/95 backdrop-blur-sm shadow-2xl overflow-hidden">
                    {/* Recent searches — shown only when query is empty */}
                    {searchQuery === "" && recentSearches.length > 0 && (
                      <div className="p-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
                          <svg
                            className="h-3 w-3 text-zinc-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-[0.6875rem] text-zinc-600 font-medium uppercase tracking-wider">
                            Recent
                          </span>
                        </div>
                        {recentSearches.map((name) => (
                          <div key={name} className="flex items-center gap-2 group">
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery(name);
                                setIsFocused(true);
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
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
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

                    {/* Results */}
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
                              <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors truncate flex-1">
                                {source.domain}
                              </span>
                              <svg
                                className="h-3.5 w-3.5 text-zinc-600 group-hover:text-violet-400 shrink-0 transition-colors"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                                />
                              </svg>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No results empty state */}
                    {!searching && searchError === "no_results" && (
                      <div className="p-6 text-center">
                        <svg
                          className="h-10 w-10 text-zinc-700 mx-auto mb-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0z"
                          />
                        </svg>
                        <p className="text-sm text-zinc-400 mb-1">
                          No sources found for{" "}
                          <span className="text-zinc-200">
                            &ldquo;{searchQuery}&rdquo;
                          </span>
                        </p>
                        <p className="text-xs text-zinc-600 mb-3">
                          Try a different spelling or paste a URL directly
                        </p>
                        {!showUrlInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowUrlInput(true);
                              setIsFocused(false);
                            }}
                            className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
                          >
                            Paste a URL directly →
                          </button>
                        )}
                      </div>
                    )}

                    {/* Generic search error */}
                    {!searching && searchError && searchError !== "no_results" && (
                      <div className="p-4">
                        <p className="text-sm text-red-400">{searchError}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Escape hatch */}
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
                          onSourceSelected(directUrl.trim(), companyName);
                        }
                      }}
                      onBlur={() => {
                        if (directUrl.trim()) {
                          onSourceSelected(directUrl.trim(), companyName);
                        }
                      }}
                      className="mt-1 w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-3 py-2 text-sm text-[#eceae6] placeholder:text-[#52555a] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1.5">
              Who are you emailing?
            </label>
            <select
              value={targetRole === "Custom" ? "Custom" : targetRole}
              onChange={(e) => {
                const val = e.target.value;
                setTargetRole(val);
                setShowCustomRole(val === "Custom");
                if (val !== "Custom") {
                  setCustomRoleInput("");
                  localStorage.setItem("gsh_targetRole", val);
                }
              }}
              className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-4 py-2.5 text-[#eceae6] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors appearance-none"
            >
              <option value="Not sure / Any role">Not sure / Any role</option>
              <option value="VP Sales">VP Sales</option>
              <option value="RevOps">RevOps</option>
              <option value="SDR Manager">SDR Manager</option>
              <option value="Marketing">Marketing</option>
              <option value="Founder/CEO">Founder/CEO</option>
              <option value="Custom">Custom...</option>
            </select>
            {showCustomRole && (
              <>
                <div className="mt-2">
                  <input
                    type="text"
                    value={customRoleInput}
                    onChange={(e) =>
                      setCustomRoleInput(e.target.value.slice(0, 30))
                    }
                    placeholder="e.g. Head of Partnerships"
                    className={`w-full bg-[#0e0f10] border rounded-lg px-4 py-2.5 text-[#eceae6] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors ${
                      error && targetRole === "Custom" && !customRoleInput.trim()
                        ? "border-red-500/60"
                        : "border-[#252830]"
                    }`}
                  />
                  {error &&
                    targetRole === "Custom" &&
                    !customRoleInput.trim() && (
                      <p className="text-xs text-red-400 mt-1">
                        Enter a role name to continue
                      </p>
                    )}
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-[#878a8f] mb-1">
                    What pain does this role feel?
                  </label>
                  <textarea
                    value={customPain}
                    onChange={(e) =>
                      setCustomPain(e.target.value.slice(0, 200))
                    }
                    placeholder="e.g. Spends too much time on unqualified leads"
                    maxLength={200}
                    rows={2}
                    className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-3 py-2 text-sm text-[#eceae6] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors resize-none"
                  />
                  <span className="text-[10px] text-zinc-600">
                    {customPain.length}/200
                  </span>
                </div>
                <div className="mt-2">
                  <label className="block text-xs text-[#878a8f] mb-1">
                    What outcome can you promise?
                  </label>
                  <input
                    type="text"
                    value={customPromise}
                    onChange={(e) =>
                      setCustomPromise(e.target.value.slice(0, 80))
                    }
                    placeholder="e.g. A 10-min audit of your outbound signals"
                    maxLength={80}
                    className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-3 py-2 text-sm text-[#eceae6] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors"
                  />
                  <span className="text-[10px] text-zinc-600">
                    {customPromise.length}/80
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pitch context */}
        {isPaidUser ? (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowPitchContext((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-[#878a8f] hover:text-[#eceae6] transition-colors mb-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${showPitchContext ? "rotate-90" : ""}`}
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
              Pitch context
              {pitchContext.trim() && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-violet-500 inline-block" />
              )}
            </button>
            {showPitchContext && (
              <div className="animate-fade-in">
                <textarea
                  value={pitchContext}
                  onChange={(e) =>
                    setPitchContext(e.target.value.slice(0, 300))
                  }
                  placeholder="e.g. We help B2B sales teams book more demos — targeting VP Sales at Series B+ companies. Our angle: reduce time spent on unqualified leads."
                  maxLength={300}
                  rows={3}
                  className="w-full bg-[#0e0f10] border border-[#252830] rounded-lg px-3 py-2 text-sm text-[#eceae6] placeholder:text-[#52555a] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[10px] text-[#52555a]">
                    Describe your offer and campaign angle. Hooks will reflect
                    your pitch.
                  </span>
                  <span className="text-[10px] text-[#52555a]">
                    {pitchContext.length}/300
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-[#52555a]">Pitch context</span>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-medium">
              Growth+
            </span>
            <a
              href="/#pricing"
              className="text-[11px] text-violet-400 hover:text-violet-300 transition-colors"
            >
              Upgrade →
            </a>
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            (!searchQuery.trim() && !directUrl.trim() && !companyName)
          }
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 hover:scale-[1.02]"
        >
          {loading && (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {loading ? <LoadingText /> : "Generate Hooks"}
        </button>
      </div>
    </form>
  );
}
