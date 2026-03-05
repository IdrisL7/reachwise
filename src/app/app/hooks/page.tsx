"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ContextWalletModal from "@/components/context-wallet-modal";

interface Hook {
  text: string;
  angle: string;
  confidence: string;
  evidence_tier: string;
  source_snippet?: string;
  source_url?: string;
  source_title?: string;
  psych_mode?: string;
  why_this_works?: string;
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

function trackEvent(event: string) {
  fetch("/api/track-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
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
  const [generatingEmail, setGeneratingEmail] = useState<number | null>(null);
  const [generatedEmails, setGeneratedEmails] = useState<Record<number, GeneratedEmail>>({});
  const [copiedEmail, setCopiedEmail] = useState<number | null>(null);
  const [overflowHooks, setOverflowHooks] = useState<Hook[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [linkedinSlug, setLinkedinSlug] = useState<string | null>(null);
  const [firstPartyUrls, setFirstPartyUrls] = useState<Array<{ title: string; url: string; tier: string }>>([]);
  const [webUrls, setWebUrls] = useState<Array<{ title: string; url: string; tier: string }>>([]);
  const [companyDomain, setCompanyDomain] = useState<string>("");
  const [discovering, setDiscovering] = useState(false);
  const [hooksUsed, setHooksUsed] = useState<number | null>(null); // null = loading
  const [skippedGate, setSkippedGate] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const pendingGenerate = useRef(false);
  const lowSignalTracked = useRef(false);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [showCustomRole, setShowCustomRole] = useState(false);
  const [upgradePrompt, setUpgradePrompt] = useState<{
    title: string; message: string; cta: string; href: string;
  } | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [targetRole, setTargetRole] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gsh_targetRole");
      return saved === "General" ? "Not sure / Any role" : saved || "Not sure / Any role";
    }
    return "Not sure / Any role";
  });

  useEffect(() => {
    // Fetch profile status and hooks used count in parallel
    Promise.all([
      fetch("/api/workspace-profile").then((r) => r.json()).catch(() => ({})),
      fetch("/api/user-stats").then((r) => r.json()).catch(() => ({})),
    ]).then(([profileData, statsData]) => {
      if (profileData.profile) setHasProfile(true);
      const used = statsData.hooksUsed ?? 0;
      setHooksUsed(used);
      // Show onboarding tips for brand-new users who haven't dismissed them
      if (used === 0 && !localStorage.getItem("gsh_onboarding_done")) {
        setOnboardingStep(0);
      }
    });
  }, []);

  // Whether the JIT gate should trigger: no profile, first-ever generation, hasn't skipped yet
  const shouldGate = !hasProfile && hooksUsed === 0 && !skippedGate;

  // Whether profile is required (skipped once before, still no profile)
  const profileRequired = !hasProfile && skippedGate;

  function markCopied() {
    if (!hasCopied) {
      setHasCopied(true);
      trackEvent("hook_copied_first");
    }
  }

  async function copyHook(text: string, index: number) {
    if (profileRequired) {
      setShowGateModal(true);
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(index);
    markCopied();
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyHookWithEvidence(hook: Hook, index: number) {
    if (profileRequired) {
      setShowGateModal(true);
      return;
    }
    let content = `Hook: ${hook.text}`;
    if (hook.source_snippet) content += `\nEvidence: ${hook.source_snippet}`;
    if (hook.source_url) content += `\nSource: ${hook.source_url}`;
    await navigator.clipboard.writeText(content);
    setCopiedEvidence(index);
    markCopied();
    setTimeout(() => setCopiedEvidence(null), 2000);
  }

  async function generateEmail(hook: Hook, index: number) {
    if (profileRequired) {
      setShowGateModal(true);
      return;
    }
    setGeneratingEmail(index);
    try {
      const res = await fetch("/api/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyUrl: url || companyName,
          hook: {
            hook: hook.text,
            angle: hook.angle,
            confidence: hook.confidence,
            evidence_tier: hook.evidence_tier,
            evidence_snippet: hook.source_snippet || "",
            source_title: hook.source_title || hook.source_url || "",
            source_url: hook.source_url || "",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate email");
      setGeneratedEmails((prev) => ({ ...prev, [index]: data.email }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGeneratingEmail(null);
    }
  }

  async function copyEmail(email: GeneratedEmail, index: number) {
    if (profileRequired) {
      setShowGateModal(true);
      return;
    }
    const content = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(content);
    setCopiedEmail(index);
    markCopied();
    setTimeout(() => setCopiedEmail(null), 2000);
  }

  function runWithUrl(newUrl: string) {
    setUrl(newUrl);
    // Use setTimeout to ensure state update before submit
    setTimeout(() => {
      const form = document.getElementById("hooks-form") as HTMLFormElement;
      form?.requestSubmit();
    }, 50);
  }

  const doGenerate = useCallback(async () => {
    if (!url && !companyName) return;

    setLoading(true);
    setError("");
    setUpgradePrompt(null);
    setHooks([]);
    setOverflowHooks([]);
    setShowAll(false);
    setGeneratedEmails({});
    setSuggestion("");
    setLowSignal(false);
    setLinkedinSlug(null);
    setFirstPartyUrls([]);
    setWebUrls([]);
    setCompanyDomain("");

    try {
      const res = await fetch("/api/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || undefined,
          companyName: companyName || undefined,
          targetRole: targetRole !== "Not sure / Any role" && targetRole !== "General"
            ? (targetRole === "Custom" ? customRoleInput.trim() || undefined : targetRole)
            : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // Surface structured error codes with specific CTAs
        const code = data.code as string | undefined;
        if (code === "TRIAL_EXPIRED") {
          setUpgradePrompt({
            title: "Your free trial has ended",
            message: "Subscribe to keep generating hooks.",
            cta: "View plans",
            href: "/#pricing",
          });
          setLoading(false);
          return;
        }
        if (code === "TIER_LIMIT") {
          setUpgradePrompt({
            title: "Monthly hook limit reached",
            message: data.message || "Upgrade your plan for more hooks.",
            cta: "Upgrade",
            href: "/#pricing",
          });
          setLoading(false);
          return;
        }
        if (code === "RATE_LIMITED") {
          setError(`Slow down — ${data.message || "too many requests. Try again in a moment."}`);
          setLoading(false);
          return;
        }
        throw new Error(data.error || data.message || "Failed to generate hooks");
      }

      // Map structured_hooks (with .hook field) to display format, fallback to flat hooks
      type RawHook = {
        hook: string;
        angle: string;
        confidence: string;
        evidence_tier: string;
        evidence_snippet?: string;
        source_url?: string;
        source_title?: string;
        psych_mode?: string;
        why_this_works?: string;
      };

      const mapHook = (h: RawHook): Hook => ({
        text: h.hook,
        angle: h.angle,
        confidence: h.confidence,
        evidence_tier: h.evidence_tier,
        source_snippet: h.evidence_snippet,
        source_url: h.source_url,
        source_title: h.source_title,
        psych_mode: h.psych_mode,
        why_this_works: h.why_this_works,
      });

      const structured = data.structured_hooks as RawHook[] | undefined;
      const overflow = data.overflow_hooks as RawHook[] | undefined;

      if (structured && structured.length > 0) {
        setHooks(structured.map(mapHook));
        if (overflow && overflow.length > 0) {
          setOverflowHooks(overflow.map(mapHook));
        }
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
      if (data.lowSignal) {
        setLowSignal(true);
        if (!lowSignalTracked.current) {
          lowSignalTracked.current = true;
          trackEvent("low_signal_shown");
        }
      }
      if (data.linkedinSlug) setLinkedinSlug(data.linkedinSlug);
      if (data.firstPartyUrls) setFirstPartyUrls(data.firstPartyUrls);
      if (data.webUrls) setWebUrls(data.webUrls);
      if (data.companyDomain) setCompanyDomain(data.companyDomain);

      // Update hooksUsed locally so the gate doesn't re-trigger
      setHooksUsed((prev) => {
        const next = (prev ?? 0) + 1;
        if (next === 1) trackEvent("hooks_generated_first");
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, companyName, targetRole, customRoleInput]);

  async function generateHooks(e: React.FormEvent) {
    e.preventDefault();
    if (!url && !companyName) return;

    // Validate custom role has text
    if (targetRole === "Custom" && !customRoleInput.trim()) {
      setError("Enter a role name or pick one from the dropdown.");
      return;
    }

    // JIT Context Wallet gate: first generation + no profile
    if (shouldGate) {
      pendingGenerate.current = true;
      setShowProfileModal(true);
      trackEvent("jit_profile_shown");
      return;
    }

    // If profile is required (skipped before), block generate too
    if (profileRequired) {
      pendingGenerate.current = true;
      setShowGateModal(true);
      return;
    }

    await doGenerate();
  }

  function handleProfileSaved() {
    setShowProfileModal(false);
    setHasProfile(true);
    trackEvent("jit_profile_saved");

    // Auto-continue the pending generation
    if (pendingGenerate.current) {
      pendingGenerate.current = false;
      doGenerate();
    }
  }

  function handleGateSkipped() {
    setShowProfileModal(false);
    setSkippedGate(true);
    trackEvent("jit_profile_skipped");

    // Allow this one generation to proceed
    if (pendingGenerate.current) {
      pendingGenerate.current = false;
      doGenerate();
    }
  }

  function handleGateModalSave() {
    setShowGateModal(false);
    setShowProfileModal(true);
    pendingGenerate.current = true;
  }

  const REPUTABLE_DOMAINS = [
    "reuters.com", "bloomberg.com", "wsj.com", "ft.com", "cnbc.com",
    "techcrunch.com", "theverge.com", "wired.com", "arstechnica.com",
    "forbes.com", "inc.com", "hbr.org", "businessinsider.com",
    "sec.gov", "crunchbase.com", "glassdoor.com", "g2.com",
    "linkedin.com", "github.com", "pitchbook.com",
  ];

  function getSourceType(sourceUrl: string): "First-party" | "Reputable" | "Web" {
    if (companyDomain && sourceUrl.toLowerCase().includes(companyDomain.toLowerCase())) {
      return "First-party";
    }
    try {
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
      if (REPUTABLE_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
        return "Reputable";
      }
    } catch { /* ignore */ }
    return "Web";
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

  // Progress bar steps
  const hasGenerated = (hooksUsed ?? 0) > 0 || hooks.length > 0;
  const progressSteps = [
    { label: "Profile", done: hasProfile },
    { label: "Generate", done: hasGenerated },
    { label: "Copy", done: hasCopied },
  ];

  const EXAMPLE_COMPANIES = [
    { url: "https://gong.io", name: "Gong", role: "VP Sales" },
    { url: "https://hubspot.com", name: "HubSpot", role: "Marketing" },
    { url: "https://stripe.com", name: "Stripe", role: "Founder/CEO" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Generate Hooks</h1>
        {/* 3-step progress bar */}
        {hooksUsed !== null && (
          <div className="flex items-center gap-1.5">
            {progressSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                      step.done
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {step.done ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <span className={`text-xs hidden sm:block ${step.done ? "text-zinc-300" : "text-zinc-600"}`}>
                    {step.label}
                  </span>
                </div>
                {i < progressSteps.length - 1 && (
                  <div className={`w-6 h-px ${step.done ? "bg-emerald-600" : "bg-zinc-800"}`} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <form id="hooks-form" onSubmit={generateHooks} className="mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
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
                className="w-full bg-black border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-600 appearance-none"
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
                <input
                  type="text"
                  value={customRoleInput}
                  onChange={(e) => setCustomRoleInput(e.target.value.slice(0, 30))}
                  placeholder="e.g. Head of Partnerships"
                  className="w-full mt-2 bg-black border border-zinc-700 rounded-lg px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 text-sm"
                />
              )}
            </div>
          </div>
          <p className="text-xs text-zinc-500 mb-4">
            Best results: paste the company homepage + pick who you&apos;re emailing. Every hook includes receipts (quote + source + date).
          </p>
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

      {!loading && hooks.length === 0 && !error && !upgradePrompt && !suggestion && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center">
          <div className="text-4xl mb-4">🎣</div>
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">
            Generate your first hooks
          </h2>
          <p className="text-sm text-zinc-500 max-w-md mx-auto mb-5">
            Paste a company URL, pick a role, and we&apos;ll turn public signals into evidence-backed hooks you can copy into outbound.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-zinc-600">Try an example:</span>
            {EXAMPLE_COMPANIES.map((ex) => (
              <button
                key={ex.url}
                type="button"
                onClick={() => {
                  setUrl(ex.url);
                  setTargetRole(ex.role);
                  localStorage.setItem("gsh_targetRole", ex.role);
                  setTimeout(() => {
                    const form = document.getElementById("hooks-form") as HTMLFormElement;
                    form?.requestSubmit();
                  }, 50);
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-emerald-400 transition-colors"
              >
                {ex.name} <span className="text-zinc-500">({ex.role})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {suggestion && (
        <div className={`border rounded-lg mb-6 text-sm ${lowSignal ? "bg-amber-900/30 border-amber-800" : "bg-blue-900/30 border-blue-800"}`}>
          {/* Headline */}
          <div className={`px-4 pt-4 pb-2 font-semibold ${lowSignal ? "text-amber-200" : "text-blue-200"}`}>
            {suggestion}
          </div>

          {/* LinkedIn auto-fix */}
          {linkedinSlug && (
            <div className="px-4 pb-3">
              <button
                onClick={() => runWithUrl(`https://www.linkedin.com/company/${linkedinSlug}/about/`)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Use LinkedIn About page instead
              </button>
            </div>
          )}

          {/* Found on their site (first-party verified) */}
          {firstPartyUrls.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Found on their site:</p>
              <div className="space-y-1">
                {firstPartyUrls.map((d, i) => (
                  <a
                    key={i}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-emerald-400 hover:text-emerald-300 truncate"
                  >
                    {d.title || d.url}
                    <span className={`ml-1.5 ${d.tier === "A" ? "text-emerald-600" : "text-zinc-600"}`}>Tier {d.tier}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Found on the web (not first-party) */}
          {webUrls.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Found on the web <span className="text-zinc-600">(not verified as first-party)</span>:</p>
              <div className="space-y-1">
                {webUrls.map((d, i) => (
                  <a
                    key={i}
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-zinc-400 hover:text-zinc-300 truncate"
                  >
                    {d.title || d.url}
                    <span className="text-zinc-600 ml-1.5">Tier {d.tier}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Common pages to try (unverified patterns) */}
          {lowSignal && !linkedinSlug && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Common pages to try:</p>
              <div className="text-xs text-zinc-500 space-y-0.5">
                <p>{companyDomain ? `${companyDomain}` : "company"}/press · /newsroom · /news</p>
                <p>{companyDomain ? `${companyDomain}` : "company"}/blog · /changelog · /resources</p>
                <p>{companyDomain ? `${companyDomain}` : "company"}/careers · /jobs</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {lowSignal && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {companyDomain && (
                <button
                  onClick={async () => {
                    setDiscovering(true);
                    trackEvent("sources_found_clicked");
                    runWithUrl(`https://${companyDomain}`);
                    setDiscovering(false);
                  }}
                  disabled={discovering || loading}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 transition-colors"
                >
                  {discovering ? "Searching..." : "Find sources on their site"}
                </button>
              )}
              {(companyName || companyDomain) && (
                <button
                  onClick={() => {
                    const name = companyName || companyDomain.split(".")[0];
                    setCompanyName(name);
                    setUrl("");
                    setTimeout(() => {
                      const form = document.getElementById("hooks-form") as HTMLFormElement;
                      form?.requestSubmit();
                    }, 50);
                  }}
                  disabled={loading}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 transition-colors"
                >
                  Search recent news for &ldquo;{companyName || companyDomain.split(".")[0]}&rdquo;
                </button>
              )}
              <button
                onClick={() => {
                  setUrl("");
                  setCompanyName("");
                  setSuggestion("");
                  setLowSignal(false);
                  setLinkedinSlug(null);
                  setFirstPartyUrls([]);
                  setWebUrls([]);
                  // Focus the URL input
                  const input = document.querySelector<HTMLInputElement>("input[type='url']");
                  input?.focus();
                }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
              >
                + Add another URL
              </button>
            </div>
          )}
        </div>
      )}

      {hooks.length > 0 && (() => {
        const visibleHooks = showAll ? [...hooks, ...overflowHooks] : hooks;
        const totalCount = hooks.length + overflowHooks.length;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">
                Top {visibleHooks.length} hook{visibleHooks.length !== 1 ? "s" : ""}
                {totalCount > hooks.length && !showAll && (
                  <span className="text-zinc-500 text-sm font-normal ml-1">of {totalCount}</span>
                )}
                {lowSignal && <span className="text-amber-400 text-sm font-normal ml-2">(low signal)</span>}
              </h2>
            </div>
            {visibleHooks.map((hook, i) => (
              <div
                key={i}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-5"
              >
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded border ${tierColors[hook.evidence_tier] || tierColors.C}`}
                  >
                    Tier {hook.evidence_tier}
                  </span>
                  {/* Trust badge: source type */}
                  {hook.source_url && (() => {
                    const srcType = getSourceType(hook.source_url);
                    const cls = srcType === "First-party"
                      ? "text-emerald-400 bg-emerald-900/20 border-emerald-800/50"
                      : srcType === "Reputable"
                        ? "text-blue-400 bg-blue-900/20 border-blue-800/50"
                        : "text-zinc-400 bg-zinc-800/50 border-zinc-700/50";
                    return (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${cls}`}>
                        {srcType}
                      </span>
                    );
                  })()}
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
                  {/* Role badge */}
                  {targetRole && targetRole !== "Not sure / Any role" && targetRole !== "General" && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border text-sky-400 bg-sky-900/20 border-sky-800/50">
                      {targetRole === "Custom" ? customRoleInput || "Custom" : targetRole}
                    </span>
                  )}
                </div>
                {/* Role sharpening prompt */}
                {(targetRole === "Not sure / Any role" || targetRole === "General") && (
                  <p className="text-[11px] text-zinc-600 mb-2 -mt-1">
                    Pick a role above to sharpen the question for a specific buyer.
                  </p>
                )}
                <p className="text-zinc-200 mb-3">{hook.text}</p>
                {hook.source_snippet && (
                  <div className="text-xs text-zinc-500 italic border-l-2 border-zinc-700 pl-3 mb-3">
                    <p>{hook.source_snippet}</p>
                    {hook.source_url && (
                      <a
                        href={hook.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="not-italic text-zinc-600 hover:text-zinc-400 underline underline-offset-2 transition-colors mt-1 block truncate"
                      >
                        {hook.source_title || hook.source_url}
                      </a>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => copyHook(hook.text, i)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                  >
                    {copied === i ? "Copied!" : "Copy Hook"}
                  </button>
                  <button
                    onClick={() => copyHookWithEvidence(hook, i)}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                  >
                    {copiedEvidence === i ? "Copied!" : "Copy + Evidence"}
                  </button>
                  <button
                    onClick={() => generateEmail(hook, i)}
                    disabled={generatingEmail === i}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-800 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                  >
                    {generatingEmail === i ? "Writing..." : generatedEmails[i] ? "Regenerate Email" : "Generate Email"}
                  </button>
                  {generatedEmails[i] && (
                    <button
                      onClick={() => copyEmail(generatedEmails[i], i)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-800 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 hover:text-emerald-300 transition-colors"
                    >
                      {copiedEmail === i ? "Copied!" : "Copy Email"}
                    </button>
                  )}
                </div>
                {generatedEmails[i] && (
                  <div className="mt-3 bg-black border border-zinc-800 rounded-lg p-4">
                    <p className="text-xs text-zinc-500 mb-1">Subject:</p>
                    <p className="text-sm text-zinc-200 font-medium mb-3">{generatedEmails[i].subject}</p>
                    <p className="text-xs text-zinc-500 mb-1">Body:</p>
                    <p className="text-sm text-zinc-300 whitespace-pre-line">{generatedEmails[i].body}</p>
                  </div>
                )}
              </div>
            ))}
            {overflowHooks.length > 0 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
              >
                Show {overflowHooks.length} more hook{overflowHooks.length !== 1 ? "s" : ""}
              </button>
            )}
            {showAll && overflowHooks.length > 0 && (
              <button
                onClick={() => setShowAll(false)}
                className="w-full py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Show less
              </button>
            )}
          </div>
        );
      })()}
      {hooks.length > 0 && !hasProfile && !shouldGate && (
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

      {/* Profile-required gate modal (after skip, on copy/export/generate) */}
      {showGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">
              Add your profile to continue
            </h3>
            <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
              To copy, export, or generate more hooks, add your 60-second profile so we can connect the signal to your offer.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGateModalSave}
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

      {/* Context Wallet modal — JIT gate mode or standard settings mode */}
      {showProfileModal && (
        <ContextWalletModal
          showClose={!shouldGate}
          showSkip={shouldGate}
          gateMode={shouldGate || pendingGenerate.current}
          onClose={() => {
            setShowProfileModal(false);
            pendingGenerate.current = false;
          }}
          onSave={handleProfileSaved}
          onSkip={handleGateSkipped}
        />
      )}

      {/* Onboarding tour */}
      {onboardingStep !== null && <OnboardingTooltip step={onboardingStep} onNext={() => {
        if (onboardingStep >= ONBOARDING_STEPS.length - 1) {
          setOnboardingStep(null);
          localStorage.setItem("gsh_onboarding_done", "1");
        } else {
          setOnboardingStep(onboardingStep + 1);
        }
      }} onDismiss={() => {
        setOnboardingStep(null);
        localStorage.setItem("gsh_onboarding_done", "1");
      }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding tour
// ---------------------------------------------------------------------------

const ONBOARDING_STEPS = [
  {
    target: "input[type='url']",
    title: "Start here",
    body: "Paste any company URL — their homepage works best. We'll scan public signals like earnings, hiring, and tech changes.",
    position: "bottom" as const,
  },
  {
    target: "select",
    title: "Pick who you're emailing",
    body: "Choose the buyer's role to get hooks with questions tailored to their priorities. 'VP Sales' gets different hooks than 'Marketing'.",
    position: "bottom" as const,
  },
  {
    target: "button[type='submit']",
    title: "Generate hooks",
    body: "Hit this to research the company and generate 3-5 evidence-backed hooks. Each one includes a real quote, source, and date.",
    position: "top" as const,
  },
];

function OnboardingTooltip({
  step,
  onNext,
  onDismiss,
}: {
  step: number;
  onNext: () => void;
  onDismiss: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const current = ONBOARDING_STEPS[step];
  const isLast = step >= ONBOARDING_STEPS.length - 1;

  useEffect(() => {
    function measure() {
      const el = document.querySelector(current.target);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({ top: rect.top + window.scrollY, left: rect.left + window.scrollX, width: rect.width });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [current.target]);

  if (!pos) return null;

  const tooltipTop = current.position === "bottom"
    ? pos.top + 52
    : pos.top - 12;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onDismiss}>
      {/* Spotlight cutout highlight */}
      <div
        className="absolute border-2 border-emerald-500 rounded-lg pointer-events-none transition-all duration-300"
        style={{
          top: pos.top - 4,
          left: pos.left - 4,
          width: pos.width + 8,
          height: 48,
        }}
      />
      {/* Tooltip card */}
      <div
        className="absolute w-72 bg-zinc-900 border border-emerald-800 rounded-xl p-4 shadow-2xl shadow-emerald-900/20"
        style={{
          top: tooltipTop,
          left: Math.min(pos.left, window.innerWidth - 304),
          transform: current.position === "top" ? "translateY(-100%)" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow */}
        <div
          className={`absolute w-3 h-3 bg-zinc-900 border-emerald-800 rotate-45 ${
            current.position === "bottom"
              ? "-top-1.5 left-6 border-l border-t"
              : "-bottom-1.5 left-6 border-r border-b"
          }`}
        />
        <p className="text-xs font-semibold text-emerald-400 mb-1">
          Step {step + 1} of {ONBOARDING_STEPS.length}
        </p>
        <p className="text-sm font-medium text-zinc-100 mb-1">{current.title}</p>
        <p className="text-xs text-zinc-400 leading-relaxed mb-3">{current.body}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={onNext}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {isLast ? "Got it" : "Next"}
          </button>
          {!isLast && (
            <button
              onClick={onDismiss}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
