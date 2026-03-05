"use client";

import { useState, useEffect } from "react";
import ContextWalletModal from "@/components/context-wallet-modal";

interface Hook {
  text: string;
  angle: string;
  confidence: string;
  evidence_tier: string;
  source_snippet?: string;
  source_url?: string;
  psych_mode?: string;
  why_this_works?: string;
}

export default function HooksPage() {
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [lowSignal, setLowSignal] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showGateModal, setShowGateModal] = useState(false);
  const [copiedEvidence, setCopiedEvidence] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/workspace-profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) setHasProfile(true);
      })
      .catch(() => {});
  }, []);

  async function copyHook(text: string, index: number) {
    if (!hasProfile) {
      setShowGateModal(true);
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyHookWithEvidence(hook: Hook, index: number) {
    if (!hasProfile) {
      setShowGateModal(true);
      return;
    }
    let content = `Hook: ${hook.text}`;
    if (hook.source_snippet) content += `\nEvidence: ${hook.source_snippet}`;
    if (hook.source_url) content += `\nSource: ${hook.source_url}`;
    await navigator.clipboard.writeText(content);
    setCopiedEvidence(index);
    setTimeout(() => setCopiedEvidence(null), 2000);
  }

  async function generateHooks(e: React.FormEvent) {
    e.preventDefault();
    if (!url && !companyName) return;

    setLoading(true);
    setError("");
    setHooks([]);
    setSuggestion("");
    setLowSignal(false);

    try {
      const res = await fetch("/api/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || undefined,
          companyName: companyName || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to generate hooks");

      // Map structured_hooks (with .hook field) to display format, fallback to flat hooks
      const structured = data.structured_hooks as Array<{
        hook: string;
        angle: string;
        confidence: string;
        evidence_tier: string;
        evidence_snippet?: string;
        source_url?: string;
        psych_mode?: string;
        why_this_works?: string;
      }> | undefined;

      if (structured && structured.length > 0) {
        setHooks(structured.map((h) => ({
          text: h.hook,
          angle: h.angle,
          confidence: h.confidence,
          evidence_tier: h.evidence_tier,
          source_snippet: h.evidence_snippet,
          source_url: h.source_url,
          psych_mode: h.psych_mode,
          why_this_works: h.why_this_works,
        })));
      } else if (Array.isArray(data.hooks)) {
        // Flat string hooks (legacy/mock)
        setHooks(data.hooks.map((h: string) => ({
          text: h,
          angle: "trigger",
          confidence: "med",
          evidence_tier: "B",
        })));
      }

      if (data.suggestion) setSuggestion(data.suggestion);
      if (data.lowSignal) setLowSignal(true);
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

  const psychModeLabels: Record<string, string> = {
    relevance: "You-first",
    curiosity_gap: "Curiosity gap",
    symptom: "Symptom",
    tradeoff_frame: "Tradeoff",
    contrarian: "Contrarian",
    benefit: "Benefit",
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

      {!loading && hooks.length === 0 && !error && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <div className="text-4xl mb-4">🎣</div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">
            Generate your first hooks
          </h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Enter a company URL above and we&apos;ll research their public signals — earnings,
            hiring, tech changes — and generate evidence-backed hooks you can drop into any outbound message.
          </p>
        </div>
      )}

      {suggestion && (
        <div className={`border rounded-lg px-4 py-3 mb-6 text-sm ${lowSignal ? "bg-amber-900/30 border-amber-800 text-amber-300" : "bg-blue-900/30 border-blue-800 text-blue-300"}`}>
          {suggestion}
        </div>
      )}

      {hooks.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {hooks.length} hook{hooks.length !== 1 ? "s" : ""} found
            {lowSignal && <span className="text-amber-400 text-sm font-normal ml-2">(low signal)</span>}
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
                {hook.psych_mode && (
                  <span
                    className="text-xs font-medium text-purple-400 bg-purple-900/30 border border-purple-800 px-2 py-0.5 rounded cursor-help"
                    title={hook.why_this_works || psychModeLabels[hook.psych_mode] || hook.psych_mode}
                  >
                    {psychModeLabels[hook.psych_mode] || hook.psych_mode}
                  </span>
                )}
                <span className="text-xs text-zinc-600">
                  {hook.confidence} confidence
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => copyHookWithEvidence(hook, i)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Copy hook with evidence"
                  >
                    {copiedEvidence === i ? "Copied!" : "Copy + Evidence"}
                  </button>
                  <button
                    onClick={() => copyHook(hook.text, i)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Copy hook"
                  >
                    {copied === i ? "Copied!" : "Copy"}
                  </button>
                </div>
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
      {hooks.length > 0 && !hasProfile && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 mt-6 text-sm text-zinc-400">
          Want hooks that connect to your pitch?{" "}
          <button
            onClick={() => setShowProfileModal(true)}
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
          >
            Add your 60-second profile
          </button>
          .
        </div>
      )}

      {showGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">
              Make these hooks about YOU (not generic)
            </h3>
            <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
              Right now we can see the prospect&apos;s signal, but we don&apos;t know what you sell.
              Add your 60-second profile to connect the signal to your offer.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowGateModal(false);
                  setShowProfileModal(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Add profile (60 seconds)
              </button>
              <button
                onClick={() => setShowGateModal(false)}
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <ContextWalletModal
          showClose
          onClose={() => setShowProfileModal(false)}
          onSave={() => {
            setShowProfileModal(false);
            setHasProfile(true);
          }}
        />
      )}
    </div>
  );
}
