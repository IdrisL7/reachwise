"use client";

import { useState } from "react";
import Link from "next/link";

interface Hook {
  hook: string;
  angle: string;
  confidence: string;
  evidence_tier: string;
  evidence_snippet?: string;
  source_url?: string;
  source_title?: string;
}

interface BatchResult {
  url: string;
  hooks: Hook[];
  error: string | null;
  suggestion?: string;
  lowSignal?: boolean;
}

export default function BatchPage() {
  const [urlsText, setUrlsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<BatchResult[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<{
    title: string; message: string; cta: string; href: string;
  } | null>(null);

  const urls = urlsText
    .split(/[\n,]/)
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (urls.length === 0) return;

    setLoading(true);
    setError("");
    setUpgradePrompt(null);
    setResults([]);

    try {
      const res = await fetch("/api/generate-hooks-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: urls.map((url) => ({ url })) }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = data.code as string | undefined;
        if (code === "TRIAL_EXPIRED") {
          setUpgradePrompt({
            title: "Your free trial has ended",
            message: "Subscribe to keep generating hooks.",
            cta: "View plans",
            href: "/#pricing",
          });
          return;
        }
        if (code === "TIER_LIMIT") {
          setUpgradePrompt({
            title: data.message || "Batch limit reached",
            message: "Upgrade your plan for larger batches or more hooks.",
            cta: "Upgrade",
            href: "/#pricing",
          });
          return;
        }
        throw new Error(data.error || data.message || "Batch generation failed");
      }

      setResults(data.results || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function copyAllHooks(result: BatchResult, idx: number) {
    const text = result.hooks
      .map((h) => {
        let line = h.hook;
        if (h.evidence_snippet) line += `\nEvidence: ${h.evidence_snippet}`;
        if (h.source_url) line += `\nSource: ${h.source_url}`;
        return line;
      })
      .join("\n\n---\n\n");

    await navigator.clipboard.writeText(text);
    setCopiedIdx(`all-${idx}`);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  async function copySingleHook(hook: Hook, key: string) {
    let text = hook.hook;
    if (hook.evidence_snippet) text += `\nEvidence: ${hook.evidence_snippet}`;
    if (hook.source_url) text += `\nSource: ${hook.source_url}`;
    await navigator.clipboard.writeText(text);
    setCopiedIdx(key);
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  async function exportCsv() {
    const rows = [["URL", "Hook", "Angle", "Tier", "Evidence", "Source URL"]];
    for (const r of results) {
      if (r.error) {
        rows.push([r.url, `ERROR: ${r.error}`, "", "", "", ""]);
        continue;
      }
      for (const h of r.hooks) {
        rows.push([
          r.url,
          h.hook,
          h.angle,
          h.evidence_tier,
          h.evidence_snippet || "",
          h.source_url || "",
        ]);
      }
    }
    const csv = rows.map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    await navigator.clipboard.writeText(csv);
    setCopiedIdx("csv");
    setTimeout(() => setCopiedIdx(null), 2000);
  }

  const totalHooks = results.reduce((sum, r) => sum + r.hooks.length, 0);
  const successCount = results.filter((r) => !r.error).length;
  const errorCount = results.filter((r) => r.error).length;

  const tierColors: Record<string, string> = {
    A: "text-emerald-400 bg-emerald-900/30 border-emerald-800",
    B: "text-amber-400 bg-amber-900/30 border-amber-800",
    C: "text-zinc-400 bg-zinc-800 border-zinc-700",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Batch Generate</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Generate hooks for multiple companies at once. Paste URLs separated by newlines or commas.
          </p>
        </div>
        <Link
          href="/app/hooks"
          className="text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          Single mode
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <label className="block text-sm text-zinc-400 mb-1.5">
            Company URLs (one per line, or comma-separated)
          </label>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder={"https://gong.io\nhttps://hubspot.com\nhttps://stripe.com"}
            rows={6}
            className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 font-mono text-sm resize-y"
          />
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-zinc-500">
              {urls.length} URL{urls.length !== 1 ? "s" : ""} detected
            </p>
            <button
              type="submit"
              disabled={loading || urls.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              {loading ? `Researching ${urls.length} companies...` : `Generate Hooks (${urls.length})`}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {upgradePrompt && (
        <div className="bg-violet-900/30 border border-violet-800 rounded-lg px-5 py-4 mb-6">
          <h3 className="text-sm font-semibold text-violet-200 mb-1">{upgradePrompt.title}</h3>
          <p className="text-sm text-violet-300/80 mb-3">{upgradePrompt.message}</p>
          <Link
            href={upgradePrompt.href}
            className="inline-block bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {upgradePrompt.cta}
          </Link>
        </div>
      )}

      {results.length > 0 && (
        <div>
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-zinc-300">
                <strong className="text-emerald-400">{totalHooks}</strong> hooks from{" "}
                <strong>{successCount}</strong> companies
              </span>
              {errorCount > 0 && (
                <span className="text-red-400">{errorCount} failed</span>
              )}
            </div>
            <button
              onClick={exportCsv}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              {copiedIdx === "csv" ? "Copied CSV!" : "Copy as CSV"}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-4">
            {results.map((result, idx) => (
              <div
                key={idx}
                className={`bg-zinc-900 border rounded-lg p-5 ${
                  result.error ? "border-red-800/50" : "border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-zinc-200 truncate">
                      {result.url}
                    </span>
                    {result.lowSignal && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border text-amber-400 bg-amber-900/20 border-amber-800/50 shrink-0">
                        Low signal
                      </span>
                    )}
                  </div>
                  {result.hooks.length > 0 && (
                    <button
                      onClick={() => copyAllHooks(result, idx)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors shrink-0 ml-2"
                    >
                      {copiedIdx === `all-${idx}` ? "Copied!" : `Copy all (${result.hooks.length})`}
                    </button>
                  )}
                </div>

                {result.error && (
                  <p className="text-sm text-red-400">{result.error}</p>
                )}

                {result.suggestion && (
                  <p className="text-xs text-amber-400/80 mb-2">{result.suggestion}</p>
                )}

                {result.hooks.length > 0 && (
                  <div className="space-y-2">
                    {result.hooks.map((hook, hi) => (
                      <div key={hi} className="bg-black/50 border border-zinc-800 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierColors[hook.evidence_tier] || tierColors.C}`}
                          >
                            Tier {hook.evidence_tier}
                          </span>
                          <span className="text-[10px] text-zinc-500">{hook.angle}</span>
                        </div>
                        <p className="text-sm text-zinc-200 mb-1.5">{hook.hook}</p>
                        {hook.evidence_snippet && (
                          <p className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-2 mb-1.5">
                            {hook.evidence_snippet}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          {hook.source_url && (
                            <a
                              href={hook.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-zinc-600 hover:text-zinc-400 underline underline-offset-2 truncate"
                            >
                              {hook.source_title || hook.source_url}
                            </a>
                          )}
                          <button
                            onClick={() => copySingleHook(hook, `${idx}-${hi}`)}
                            className="text-[10px] font-medium px-2 py-1 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors shrink-0 ml-auto"
                          >
                            {copiedIdx === `${idx}-${hi}` ? "Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!result.error && result.hooks.length === 0 && (
                  <p className="text-xs text-zinc-500">No hooks generated</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !loading && !error && !upgradePrompt && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <div className="text-4xl mb-4">&#x1F4E6;</div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">
            Batch hook generation
          </h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Paste a list of company URLs to generate hooks for all of them at once.
            Results include evidence and sources for every hook.
          </p>
          <p className="text-xs text-zinc-600 mt-3">
            Starter: up to 10 URLs &middot; Pro: up to 75 URLs
          </p>
        </div>
      )}
    </div>
  );
}
