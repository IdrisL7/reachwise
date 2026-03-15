"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ContextWalletModal from "@/components/context-wallet-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { HookCard } from "./hook-card";
import { HookForm } from "./hook-form";
import { EmptyState } from "./empty-state";
import { IntentSignals } from "./intent-signals";
import { UpgradePrompt } from "./upgrade-prompt";
import { CompanyIntelPanel } from "./company-intel-panel";
import type { CompanyIntelligence } from "@/lib/company-intel";

interface Hook {
  text: string;
  angle: string;
  confidence: string;
  evidence_tier: string;
  quality_score?: number;
  quality_label?: "Excellent" | "Strong" | "Decent" | "Weak";
  generated_hook_id?: string;
  source_snippet?: string;
  source_url?: string;
  source_title?: string;
  source_date?: string;
  psych_mode?: string;
  why_this_works?: string;
  promise?: string;
  trigger_type?: string;
  bridge_quality?: string;
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

interface ChannelVariant {
  channel: string;
  text: string;
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
  const [batchId, setBatchId] = useState<string | null>(null);
  const [pushingBatch, setPushingBatch] = useState(false);
  const [pushingHook, setPushingHook] = useState<string | null>(null);
  const [pushedHookIds, setPushedHookIds] = useState<Record<string, boolean>>({});
  const [crmConnected, setCrmConnected] = useState(false);
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
  const [hooksUsed, setHooksUsed] = useState<number | null>(null);
  const [userTier, setUserTier] = useState<string>("starter");
  const [findingContacts, setFindingContacts] = useState(false);
  const [contactsResult, setContactsResult] = useState<{ created: number; skipped: number } | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [skippedGate, setSkippedGate] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const pendingGenerate = useRef(false);
  const lowSignalTracked = useRef(false);
  const hooksGeneratedFirstTracked = useRef(false);
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [showCustomRole, setShowCustomRole] = useState(false);
  const [customPain, setCustomPain] = useState("");
  const [customPromise, setCustomPromise] = useState("");
  const [pitchContext, setPitchContext] = useState("");
  const [hookVariants, setHookVariants] = useState<Array<{ hook_index: number; variants: ChannelVariant[] }>>([]);
  const [intentData, setIntentData] = useState<{
    score: number;
    temperature: string;
    signals: Array<{
      type: string;
      summary: string;
      confidence: number;
      sourceUrl: string;
      detectedAt: string;
    }>;
  } | null>(null);
  const [companyIntel, setCompanyIntel] = useState<CompanyIntelligence | null>(null);
  const [isBasicIntel, setIsBasicIntel] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Record<number, string>>({});
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
    const params = new URLSearchParams(window.location.search);
    const prefillUrl = params.get("url");
    if (prefillUrl) setUrl(prefillUrl);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/workspace-profile").then((r) => r.json()).catch(() => ({})),
      fetch("/api/user-stats").then((r) => r.json()).catch(() => ({})),
      Promise.all([
        fetch("/api/integrations/hubspot/status").then((r) => r.json()).catch(() => ({ connected: false })),
        fetch("/api/integrations/salesforce/status").then((r) => r.json()).catch(() => ({ connected: false })),
      ]),
    ]).then(([profileData, statsData, [hsStatus, sfStatus]]) => {
      if (profileData.profile) setHasProfile(true);
      const used = statsData.hooksUsed ?? 0;
      setHooksUsed(used);
      setUserTier(statsData.tier ?? "starter");
      if (used === 0 && !localStorage.getItem("gsh_onboarding_done")) {
        setOnboardingStep(0);
      }
      setCrmConnected(hsStatus.connected || sfStatus.connected);
    });
  }, []);

  const shouldGate = !hasProfile && hooksUsed === 0 && !skippedGate;
  const profileRequired = !hasProfile && skippedGate;

  function markCopied() {
    if (!hasCopied) {
      setHasCopied(true);
      trackEvent("hook_copied_first");
    }
  }

  async function copyHook(text: string, index: number) {
    if (profileRequired) { setShowGateModal(true); return; }
    const active = activeChannel[index] || "email";
    if (active !== "email") {
      const variantEntry = hookVariants.find((v) => v.hook_index === index);
      const variant = variantEntry?.variants.find((v) => v.channel === active);
      if (variant) {
        await navigator.clipboard.writeText(variant.text);
        setCopied(index); markCopied();
        setTimeout(() => setCopied(null), 2000);
        return;
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(index); markCopied();
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyHookWithEvidence(hook: Hook, index: number) {
    if (profileRequired) { setShowGateModal(true); return; }
    const active = activeChannel[index] || "email";
    const hookText = (() => {
      if (active === "email") return hook.text;
      const variantEntry = hookVariants.find((v) => v.hook_index === index);
      return variantEntry?.variants.find((v) => v.channel === active)?.text || hook.text;
    })();
    let content = `Hook: ${hookText}`;
    if (hook.source_snippet) content += `\nEvidence: ${hook.source_snippet}`;
    if (hook.source_url) content += `\nSource: ${hook.source_url}`;
    await navigator.clipboard.writeText(content);
    setCopiedEvidence(index); markCopied();
    setTimeout(() => setCopiedEvidence(null), 2000);
  }

  async function generateEmail(hook: Hook, index: number) {
    if (profileRequired) { setShowGateModal(true); return; }
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
            promise: hook.promise || "",
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
    if (profileRequired) { setShowGateModal(true); return; }
    const content = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(content);
    setCopiedEmail(index); markCopied();
    setTimeout(() => setCopiedEmail(null), 2000);
  }

  async function pushSingleHookToCrm(hook: Hook, _index: number) {
    if (!hook.generated_hook_id) return;
    setPushingHook(hook.generated_hook_id);
    setError("");
    try {
      const res = await fetch("/api/hooks/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookId: hook.generated_hook_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to push hook to CRM");
      setPushedHookIds((prev) => ({ ...prev, [hook.generated_hook_id!]: true }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPushingHook(null);
    }
  }

  async function findContacts() {
    if (!companyDomain) return;
    setFindingContacts(true);
    setContactsResult(null);
    setContactsError(null);
    try {
      const res = await fetch("/api/find-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: companyDomain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setContactsError(data.error || "Something went wrong.");
      } else {
        setContactsResult({ created: data.created, skipped: data.skipped });
        trackEvent("contacts_found");
      }
    } catch {
      setContactsError("Network error — please try again.");
    } finally {
      setFindingContacts(false);
    }
  }

  async function pushBatchToCrm() {
    if (!batchId) return;
    setPushingBatch(true);
    setError("");
    try {
      const res = await fetch("/api/hooks/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to push hooks to CRM");
      setPushedHookIds((prev) => {
        const next = { ...prev };
        for (const id of data.pushedHookIds || []) next[id] = true;
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPushingBatch(false);
    }
  }

  function runWithUrl(newUrl: string) {
    setUrl(newUrl);
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
    setBatchId(null);
    setPushedHookIds({});
    setOverflowHooks([]);
    setShowAll(false);
    setGeneratedEmails({});
    setHookVariants([]);
    setActiveChannel({});
    setIntentData(null);
    setCompanyIntel(null);
    setIsBasicIntel(false);
    setSuggestion("");
    setLowSignal(false);
    setLinkedinSlug(null);
    setFirstPartyUrls([]);
    setWebUrls([]);
    setCompanyDomain("");
    setContactsResult(null);
    setContactsError(null);

    try {
      const res = await fetch("/api/generate-hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url ? (url.match(/^https?:\/\//) ? url : `https://${url}`) : undefined,
          companyName: companyName || undefined,
          targetRole: targetRole !== "Not sure / Any role" && targetRole !== "General"
            ? (targetRole === "Custom" ? customRoleInput.trim() || undefined : targetRole)
            : undefined,
          customPain: targetRole === "Custom" && customPain.trim() ? customPain.trim() : undefined,
          customPromise: targetRole === "Custom" && customPromise.trim() ? customPromise.trim() : undefined,
          context: userTier !== "starter" && pitchContext.trim() ? pitchContext.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const code = data.code as string | undefined;
        if (code === "TRIAL_EXPIRED") {
          setUpgradePrompt({ title: "Your free trial has ended", message: "Subscribe to keep generating hooks.", cta: "View plans", href: "/#pricing" });
          setLoading(false); return;
        }
        if (code === "TIER_LIMIT") {
          setUpgradePrompt({ title: "Monthly hook limit reached", message: data.message || "Upgrade your plan for more hooks.", cta: "Upgrade", href: "/#pricing" });
          setLoading(false); return;
        }
        if (code === "RATE_LIMITED") {
          setError(`Slow down — ${data.message || "too many requests. Try again in a moment."}`);
          setLoading(false); return;
        }
        throw new Error(data.error || data.message || "Failed to generate hooks");
      }

      type RawHook = {
        hook: string; angle: string; confidence: string; evidence_tier: string;
        quality_score?: number; quality_label?: "Excellent" | "Strong" | "Decent" | "Weak";
        generated_hook_id?: string;
        evidence_snippet?: string; source_url?: string; source_title?: string;
        source_date?: string; psych_mode?: string; why_this_works?: string;
        trigger_type?: string; promise?: string; bridge_quality?: string;
      };

      const mapHook = (h: RawHook): Hook => ({
        text: h.hook, angle: h.angle, confidence: h.confidence, evidence_tier: h.evidence_tier,
        quality_score: h.quality_score, quality_label: h.quality_label, generated_hook_id: h.generated_hook_id,
        source_snippet: h.evidence_snippet, source_url: h.source_url, source_title: h.source_title,
        source_date: h.source_date, psych_mode: h.psych_mode, why_this_works: h.why_this_works,
        promise: h.promise, trigger_type: h.trigger_type, bridge_quality: h.bridge_quality,
      });

      const structured = data.structured_hooks as RawHook[] | undefined;
      const overflow = data.overflow_hooks as RawHook[] | undefined;

      if (structured && structured.length > 0) {
        setHooks(structured.map(mapHook));
        if (overflow && overflow.length > 0) setOverflowHooks(overflow.map(mapHook));
      } else if (Array.isArray(data.hooks)) {
        setHooks(data.hooks.map((h: string) => ({ text: h, angle: "trigger", confidence: "med", evidence_tier: "B" })));
      }

      if (data.hookVariants) setHookVariants(data.hookVariants);
      if (data.batchId) setBatchId(data.batchId);
      setIntentData(data.intent || null);
      setCompanyIntel(data.companyIntel || null);
      setIsBasicIntel(!!data.isBasicIntel);
      if (data.suggestion) setSuggestion(data.suggestion);
      if (data.lowSignal) {
        setLowSignal(true);
        if (!lowSignalTracked.current) { lowSignalTracked.current = true; trackEvent("low_signal_shown"); }
      }
      if (data.linkedinSlug) setLinkedinSlug(data.linkedinSlug);
      if (data.firstPartyUrls) setFirstPartyUrls(data.firstPartyUrls);
      if (data.webUrls) setWebUrls(data.webUrls);
      if (data.companyDomain) setCompanyDomain(data.companyDomain);

      setHooksUsed((prev) => (prev ?? 0) + 1);
      if (!hooksGeneratedFirstTracked.current && (hooksUsed ?? 0) === 0) {
        hooksGeneratedFirstTracked.current = true;
        trackEvent("hooks_generated_first");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, companyName, targetRole, customRoleInput, customPain, customPromise, pitchContext, userTier]);

  async function generateHooks(e: React.FormEvent) {
    e.preventDefault();
    if (!url && !companyName) return;
    if (targetRole === "Custom" && !customRoleInput.trim()) {
      setError("Enter a role name or pick one from the dropdown.");
      return;
    }
    if (shouldGate) {
      pendingGenerate.current = true;
      setShowProfileModal(true);
      trackEvent("jit_profile_shown");
      return;
    }
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
    if (pendingGenerate.current) { pendingGenerate.current = false; doGenerate(); }
  }

  function handleGateSkipped() {
    setShowProfileModal(false);
    setSkippedGate(true);
    trackEvent("jit_profile_skipped");
    if (pendingGenerate.current) { pendingGenerate.current = false; doGenerate(); }
  }

  function handleGateModalSave() {
    setShowGateModal(false);
    setShowProfileModal(true);
    pendingGenerate.current = true;
  }

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">Generate Hooks</h1>
        {hooksUsed !== null && (
          <div className="flex items-center gap-1.5">
            {progressSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1.5">
                <div className="flex items-center gap-1">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                      step.done ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {step.done ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : i + 1}
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

      <HookForm
        url={url}
        setUrl={setUrl}
        companyName={companyName}
        setCompanyName={setCompanyName}
        targetRole={targetRole}
        setTargetRole={setTargetRole}
        showCustomRole={showCustomRole}
        setShowCustomRole={setShowCustomRole}
        customRoleInput={customRoleInput}
        setCustomRoleInput={setCustomRoleInput}
        customPain={customPain}
        setCustomPain={setCustomPain}
        customPromise={customPromise}
        setCustomPromise={setCustomPromise}
        pitchContext={pitchContext}
        setPitchContext={setPitchContext}
        isPaidUser={userTier !== "starter"}
        loading={loading}
        error={error}
        onSubmit={generateHooks}
      />

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 px-4 py-3 rounded-xl mb-6 text-sm animate-scale-in">
          {error}
        </div>
      )}

      {upgradePrompt && (
        <UpgradePrompt
          title={upgradePrompt.title}
          message={upgradePrompt.message}
          cta={upgradePrompt.cta}
          href={upgradePrompt.href}
        />
      )}

      {companyIntel && (
        <CompanyIntelPanel
          intel={companyIntel}
          isBasic={isBasicIntel}
        />
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 border-l-[3px] border-l-zinc-700">
              <div className="flex items-center gap-1.5 mb-3">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-4/5 mb-3" />
              <Skeleton className="h-12 w-full rounded mb-3" />
              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <Skeleton className="h-7 w-20 rounded-lg" />
                <Skeleton className="h-7 w-28 rounded-lg" />
                <Skeleton className="h-7 w-28 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && hooks.length === 0 && !error && !upgradePrompt && !suggestion && (
        <EmptyState
          examples={EXAMPLE_COMPANIES}
          onTryExample={(exUrl, role) => {
            setUrl(exUrl);
            setTargetRole(role);
            localStorage.setItem("gsh_targetRole", role);
            setTimeout(() => {
              const form = document.getElementById("hooks-form") as HTMLFormElement;
              form?.requestSubmit();
            }, 50);
          }}
        />
      )}

      {suggestion && (
        <div className={`border rounded-xl mb-6 text-sm ${lowSignal ? "bg-amber-900/30 border-amber-800" : "bg-blue-900/30 border-blue-800"}`}>
          <div className="px-4 pt-4 pb-2">
            <p className={`font-semibold mb-1 ${lowSignal ? "text-amber-200" : "text-blue-200"}`}>
              We need a better source to write your hooks
            </p>
            <p className="text-zinc-400 text-xs leading-relaxed">{suggestion}</p>
          </div>

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

          {firstPartyUrls.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Pages we found on their site — click one to try it:</p>
              <div className="space-y-1">
                {firstPartyUrls.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => runWithUrl(d.url)}
                    className="block w-full text-left text-xs text-emerald-400 hover:text-emerald-300 truncate"
                  >
                    {d.title || d.url}
                  </button>
                ))}
              </div>
            </div>
          )}

          {webUrls.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-zinc-500 mb-1.5">Other sources we found — may need verification:</p>
              <div className="space-y-1">
                {webUrls.map((d, i) => (
                  <button
                    key={i}
                    onClick={() => runWithUrl(d.url)}
                    className="block w-full text-left text-xs text-zinc-400 hover:text-zinc-300 truncate"
                  >
                    {d.title || d.url}
                  </button>
                ))}
              </div>
            </div>
          )}

          {lowSignal && !linkedinSlug && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-zinc-400 mb-1.5">Try pasting one of these URLs into the field above:</p>
              <div className="text-xs text-zinc-500 space-y-0.5">
                <p>{companyDomain ? companyDomain : "theirdomain.com"}/press</p>
                <p>{companyDomain ? companyDomain : "theirdomain.com"}/newsroom</p>
                <p>{companyDomain ? companyDomain : "theirdomain.com"}/blog</p>
              </div>
              <p className="text-xs text-zinc-600 mt-2">Or copy the URL of any recent news article about them.</p>
            </div>
          )}

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
                  setUrl(""); setCompanyName(""); setSuggestion(""); setLowSignal(false);
                  setLinkedinSlug(null); setFirstPartyUrls([]); setWebUrls([]);
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
            <div className="flex items-center gap-3 justify-between">
              <h2 className="text-lg font-semibold">
                Top {visibleHooks.length} hook{visibleHooks.length !== 1 ? "s" : ""}
                {totalCount > hooks.length && !showAll && (
                  <span className="text-zinc-500 text-sm font-normal ml-1">of {totalCount}</span>
                )}
                {lowSignal && <span className="text-amber-400 text-sm font-normal ml-2">(low signal)</span>}
              </h2>
              {batchId && crmConnected && (
                <button
                  onClick={pushBatchToCrm}
                  disabled={pushingBatch}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-800/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                >
                  {pushingBatch ? "Pushing all..." : "Push batch to CRM"}
                </button>
              )}
            </div>
            {visibleHooks.map((hook, i) => (
              <HookCard
                key={i}
                hook={hook}
                index={i}
                companyDomain={companyDomain}
                targetRole={targetRole}
                customRoleInput={customRoleInput}
                hookVariants={hookVariants}
                activeChannel={activeChannel}
                setActiveChannel={setActiveChannel}
                copied={copied}
                copiedEvidence={copiedEvidence}
                generatingEmail={generatingEmail}
                generatedEmails={generatedEmails}
                copiedEmail={copiedEmail}
                pushingCrm={!!hook.generated_hook_id && pushingHook === hook.generated_hook_id}
                pushedToCrm={!!(hook.generated_hook_id && pushedHookIds[hook.generated_hook_id])}
                showCrmPush={crmConnected}
                onCopyHook={copyHook}
                onCopyHookWithEvidence={copyHookWithEvidence}
                onGenerateEmail={generateEmail}
                onCopyEmail={copyEmail}
                onPushToCrm={pushSingleHookToCrm}
              />
            ))}
            {overflowHooks.length > 0 && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-2.5 text-sm font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800 rounded-xl bg-zinc-900/50 hover:bg-zinc-900 transition-colors"
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

      {hooks.length > 0 && companyDomain && (
        <div className="mt-2 pt-4 border-t border-zinc-800/60">
          {userTier === "starter" ? (
            <p className="text-xs text-zinc-500">
              <span className="text-violet-400 font-medium">Pro/Concierge</span> — Find verified contacts at this company and save them to your leads list.{" "}
              <a href="/#pricing" className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">Upgrade</a>
            </p>
          ) : contactsResult ? (
            <p className="text-xs text-zinc-400">
              Saved <span className="text-emerald-400 font-medium">{contactsResult.created}</span> new contact{contactsResult.created !== 1 ? "s" : ""} to your leads
              {contactsResult.skipped > 0 && <span className="text-zinc-600"> ({contactsResult.skipped} already in list)</span>}
              {" — "}
              <a href="/app/leads" className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">View leads</a>
            </p>
          ) : (
            <button
              onClick={findContacts}
              disabled={findingContacts}
              aria-busy={findingContacts}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {findingContacts ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Finding contacts…
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Find contacts at {companyDomain}
                </>
              )}
            </button>
          )}
          {contactsError && (
            <p className="text-xs text-red-400 mt-1">{contactsError}</p>
          )}
        </div>
      )}

      {intentData && <IntentSignals data={intentData} />}

      {hooks.length > 0 && !hasProfile && !shouldGate && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 mt-6 text-sm text-zinc-400">
          Want hooks that connect to your pitch?{" "}
          <button
            onClick={() => setShowProfileModal(true)}
            className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors"
          >
            Add your 60-second profile
          </button>
          .
        </div>
      )}

      {/* Profile-required gate modal */}
      {showGateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl animate-scale-in">
            <h3 className="text-lg font-semibold text-zinc-100 mb-3">
              Add your profile to continue
            </h3>
            <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
              To copy, export, or generate more hooks, add your 60-second profile so we can connect the signal to your offer.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={handleGateModalSave}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium px-4 py-2 rounded-lg text-sm shadow-[0_0_16px_rgba(139,92,246,0.2)] transition-all duration-200"
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
          showClose={!shouldGate}
          showSkip={shouldGate}
          gateMode={shouldGate || pendingGenerate.current}
          onClose={() => { setShowProfileModal(false); pendingGenerate.current = false; }}
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

  const tooltipTop = current.position === "bottom" ? pos.top + 52 : pos.top - 12;

  return (
    <div className="fixed inset-0 z-[60]" onClick={onDismiss}>
      <div
        className="absolute border-2 border-emerald-500 rounded-lg pointer-events-none transition-all duration-300"
        style={{ top: pos.top - 4, left: pos.left - 4, width: pos.width + 8, height: 48 }}
      />
      <div
        className="absolute w-72 bg-zinc-900 border border-emerald-800 rounded-xl p-4 shadow-2xl shadow-emerald-900/20 animate-scale-in"
        style={{
          top: tooltipTop,
          left: Math.min(pos.left, window.innerWidth - 304),
          transform: current.position === "top" ? "translateY(-100%)" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
