"use client";

import { useState } from "react";

interface Hook {
  text: string;
  angle: string;
  confidence: string;
  evidence_tier: string;
  source_snippet?: string;
}

export default function HooksPage() {
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateHooks(e: React.FormEvent) {
    e.preventDefault();
    if (!url && !companyName) return;

    setLoading(true);
    setError("");
    setHooks([]);

    try {
      const res = await fetch("/api/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || undefined,
          company_name: companyName || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to generate hooks");

      setHooks(data.hooks || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const tierColors: Record<string, string> = {
    A: "text-emerald-400 bg-emerald-900/30 border-emerald-800",
    B: "text-amber-400 bg-amber-900/30 border-amber-800",
    C: "text-zinc-400 bg-zinc-800 border-zinc-700",
  };

  const angleColors: Record<string, string> = {
    trigger: "text-blue-400",
    risk: "text-red-400",
    tradeoff: "text-amber-400",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Generate Hooks</h1>

      <form onSubmit={generateHooks} className="mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">
                Company URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://acme.com"
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1.5">
                Company Name (optional)
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Inc"
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || (!url && !companyName)}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Researching..." : "Generate Hooks"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {hooks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {hooks.length} hook{hooks.length !== 1 ? "s" : ""} found
          </h2>
          {hooks.map((hook, i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded border ${tierColors[hook.evidence_tier] || tierColors.C}`}
                >
                  Tier {hook.evidence_tier}
                </span>
                <span
                  className={`text-xs font-medium ${angleColors[hook.angle] || "text-zinc-400"}`}
                >
                  {hook.angle}
                </span>
                <span className="text-xs text-zinc-600 ml-auto">
                  {hook.confidence} confidence
                </span>
              </div>
              <p className="text-zinc-200 mb-2">{hook.text}</p>
              {hook.source_snippet && (
                <p className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3">
                  {hook.source_snippet}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
