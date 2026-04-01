"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ContextWalletModal from "@/components/context-wallet-modal";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ChevronDown, CheckCircle, Mail, Users, ListChecks, Inbox, BarChart3 } from 'lucide-react';
import { CompanySearchInput } from "@/components/company-search-input";
import { HookCard } from "./hook-card";
import { IntentSignals } from "./intent-signals";
import { RetrievalDiagnostics } from "./retrieval-diagnostics";
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
  buyer_tension_id?: string;
  selector_score?: number;
}

interface GeneratedEmail {
  subject: string;
  body: string;
}

interface ChannelVariant {
  channel: string;
  text: string;
}

interface RetrievalDiagnosticsState {
  retrievalMode: "first_party" | "hybrid" | "web_only" | "empty";
  sourceMix: {
    firstParty: number;
    trustedNews: number;
    semanticWeb: number;
    fallbackWeb: number;
  };
  newsExpansionUsed: boolean;
  fallbackUsed: boolean;
  recommendedNextPass: "none" | "news_expansion" | "generic_fallback";
  reasons: string[];
  learnedPreferences?: {
    topSourcePreferences: Array<{
      sourceType: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
      adjustment: number;
      pinned?: boolean;
    }>;
    topTriggerPreferences: Array<{
      triggerType: string;
      sourceType: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
      adjustment: number;
      pinned?: boolean;
    }>;
  };
}

function trackEvent(event: string) {
  fetch("/api/track-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

function trackHookFeedback(hookId: string | undefined, event: string, metadata?: Record<string, unknown>) {
  if (!hookId) return;
  fetch("/api/hooks/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hookId, event, metadata }),
  }).catch(() => {});
}

export default function HooksPage() {
  const router = useRouter();
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
  const [userTier, setUserTier] = useState<string>("free");
  const [findingContacts, setFindingContacts] = useState(false);
  const [contactsResult, setContactsResult] = useState<{ created: number; skipped: number } | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [showFirstHookNudge, setShowFirstHookNudge] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("first-hook-seen");
    }
    return false;
  });
  const lowSignalTracked = useRef(false);
  const hooksGeneratedFirstTracked = useRef(false);
  const prevRoleRef = useRef<string | null>(null);
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
  const [retrievalDiagnostics, setRetrievalDiagnostics] = useState<RetrievalDiagnosticsState | null>(null);
  const [managingRetrievalMemory, setManagingRetrievalMemory] = useState(false);
  const [retrievalMemoryAction, setRetrievalMemoryAction] = useState<"dampen" | "reset" | "pin" | "unpin" | null>(null);
  const [rightTab, setRightTab] = useState<"intel" | "intent" | "retrieval">("intel");
  const [upgradePrompt, setUpgradePrompt] = useState<{
    title: string; message: string; cta: string; href: string;
  } | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null);
  const [savedLeadCount, setSavedLeadCount] = useState(0);
  const [sequenceStartedCount, setSequenceStartedCount] = useState(0);
  const [savingWatchlist, setSavingWatchlist] = useState(false);
  const [targetRole, setTargetRole] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("gsh_targetRole");
      return saved === "General" ? "Not sure / Any role" : saved || "Not sure / Any role";
    }
    return "Not sure / Any role";
  });
  const [messagingStyle, setMessagingStyle] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("gsh_messagingStyle") || "evidence";
    }
    return "evidence";
  });
  const prefillAutoRunPendingRef = useRef(false);
  const prefillAutoRunStartedRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefillUrl = params.get("url");
    const prefillCompanyName = params.get("companyName");
    if (prefillUrl || prefillCompanyName) {
      prefillAutoRunPendingRef.current = true;
      prefillAutoRunStartedRef.current = false;
    }
    if (prefillUrl) setUrl(prefillUrl);
    if (prefillCompanyName) setCompanyName(prefillCompanyName);
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
      setUserTier(statsData.tier ?? "free");
      if (used === 0 && !localStorage.getItem("gsh_onboarding_done")) {
        setOnboardingStep(0);
      }
      setCrmConnected(hsStatus.connected || sfStatus.connected);
    });
  }, []);

  // Persist role selection across sessions
  useEffect(() => {
    localStorage.setItem("gsh_targetRole", targetRole);
  }, [targetRole]);

  // Persist messaging style across sessions
  useEffect(() => {
    localStorage.setItem("gsh_messagingStyle", messagingStyle);
  }, [messagingStyle]);

  const prevStyleRef = useRef<string | null>(null);

  // Auto-regenerate when role changes after hooks are already displayed
  useEffect(() => {
    if (prevRoleRef.current === null) {
      prevRoleRef.current = targetRole;
      return;
    }
    if (prevRoleRef.current === targetRole) return;
    prevRoleRef.current = targetRole;

    if (hooks.length === 0 || loading || (!url && !companyName)) return;
    if (targetRole === "Custom" && !customRoleInput.trim()) return;

    doGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRole]);

  // Auto-regenerate when messaging style changes after hooks are already displayed
  useEffect(() => {
    if (prevStyleRef.current === null) {
      prevStyleRef.current = messagingStyle;
      return;
    }
    if (prevStyleRef.current === messagingStyle) return;
    prevStyleRef.current = messagingStyle;

    if (hooks.length === 0 || loading || (!url && !companyName)) return;

    doGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagingStyle]);

  function markCopied() {
    if (!hasCopied) {
      setHasCopied(true);
      trackEvent("hook_copied_first");
    }
  }

  async function addCurrentCompanyToWatchlist() {
    const trimmedCompanyName = companyName.trim();
    const trimmedDomain = companyDomain.trim();
    const fallbackName = trimmedDomain ? trimmedDomain.split(".")[0] : "";

    if (!trimmedCompanyName && !trimmedDomain) {
      router.push("/app/watchlist?source=hooks&status=missing");
      return;
    }

    setSavingWatchlist(true);
    try {
      const body = trimmedDomain
        ? { companyName: trimmedCompanyName || fallbackName, domain: trimmedDomain }
        : { companyName: trimmedCompanyName };

      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);

      const params = new URLSearchParams({
        source: "hooks",
        company: trimmedCompanyName || trimmedDomain || fallbackName,
      });

      if (res.ok) {
        params.set("status", "saved");
      } else if (res.status === 409) {
        params.set("status", "exists");
      } else if (res.status === 403) {
        params.set("status", "locked");
      } else {
        params.set("status", "error");
        if (data?.error) params.set("message", data.error);
      }

      router.push(`/app/watchlist?${params.toString()}`);
    } catch {
      router.push("/app/watchlist?source=hooks&status=error");
    } finally {
      setSavingWatchlist(false);
    }
  }

  async function copyHook(hook: Hook, index: number) {
    const active = activeChannel[index] || "email";
    if (active !== "email") {
      const variantEntry = hookVariants.find((v) => v.hook_index === index);
      const variant = variantEntry?.variants.find((v) => v.channel === active);
      if (variant) {
        await navigator.clipboard.writeText(variant.text);
        setCopied(index); markCopied();
        trackHookFeedback(hook.generated_hook_id, "copied", { channel: active });
        setTimeout(() => setCopied(null), 2000);
        return;
      }
    }
    await navigator.clipboard.writeText(hook.text);
    setCopied(index); markCopied();
    trackHookFeedback(hook.generated_hook_id, "copied", { channel: active });
    setTimeout(() => setCopied(null), 2000);
  }

  async function copyHookWithEvidence(hook: Hook, index: number) {
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
    trackHookFeedback(hook.generated_hook_id, "copied_with_evidence", { channel: active });
    setTimeout(() => setCopiedEvidence(null), 2000);
  }

  async function manageRetrievalMemory(
    action: "dampen" | "reset" | "pin" | "unpin",
    options?: {
      sourceType?: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
      triggerType?: string | null;
    },
  ) {
    if (!retrievalDiagnostics?.learnedPreferences) return;
    setManagingRetrievalMemory(true);
    setRetrievalMemoryAction(action);
    setError("");

    try {
      const res = await fetch("/api/hooks/retrieval-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sourceType: options?.sourceType,
          triggerType: options?.triggerType ?? null,
          targetRole: targetRole === "Not sure / Any role" ? "General" : targetRole,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to update retrieval learning.");
      }

      setRetrievalDiagnostics((current) => current ? {
        ...current,
        learnedPreferences: data?.learnedPreferences ?? {
          topSourcePreferences: [],
          topTriggerPreferences: [],
        },
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update retrieval learning.");
    } finally {
      setManagingRetrievalMemory(false);
      setRetrievalMemoryAction(null);
    }
  }

  async function generateEmail(hook: Hook, index: number) {
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
    const content = `Subject: ${email.subject}\n\n${email.body}`;
    await navigator.clipboard.writeText(content);
    setCopiedEmail(index); markCopied();
    trackHookFeedback(hooks[index]?.generated_hook_id, "email_copied");
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
    doGenerate(newUrl);
  }

  const doGenerate = useCallback(async (urlOverride?: string) => {
    const effectiveUrl = urlOverride ?? url;
    if (!effectiveUrl && !companyName) return;

    setLoading(true);
    setError("");
    setUpgradePrompt(null);
    setHooks([]);
    setBatchId(null);
    setPushedHookIds({});
    setOverflowHooks([]);
    setShowAll(false);
    setGeneratedEmails({});
    setSavedLeadCount(0);
    setSequenceStartedCount(0);
    setHookVariants([]);
    setActiveChannel({});
    setIntentData(null);
    setCompanyIntel(null);
    setIsBasicIntel(false);
    setRetrievalDiagnostics(null);
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
          url: effectiveUrl ? (effectiveUrl.match(/^https?:\/\//) ? effectiveUrl : `https://${effectiveUrl}`) : undefined,
          companyName: companyName || undefined,
          targetRole: targetRole === "Custom"
            ? customRoleInput.trim() || undefined
            : targetRole === "Not sure / Any role"
              ? "General"
              : targetRole || undefined,
          customPain: targetRole === "Custom" && customPain.trim() ? customPain.trim() : undefined,
          customPromise: targetRole === "Custom" && customPromise.trim() ? customPromise.trim() : undefined,
          context: userTier !== "free" && pitchContext.trim() ? pitchContext.trim() : undefined,
          messagingStyle: messagingStyle !== "evidence" ? messagingStyle : undefined,
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
          setUpgradePrompt({ title: "Monthly hook limit reached", message: data.message || "Upgrade your plan for more hooks.", cta: "Upgrade", href: data.upgradeUrl || "/#pricing" });
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
      setRetrievalDiagnostics(data.retrievalDiagnostics || null);
      if (data.suggestion) {
        setSuggestion(data.suggestion);
        // Surface suggestion as a visible error when no hooks were returned
        if ((!structured || structured.length === 0) && (!Array.isArray(data.hooks) || data.hooks.length === 0)) {
          setError(data.suggestion);
        }
      }
      if (data.lowSignal) {
        setLowSignal(true);
        if (!lowSignalTracked.current) { lowSignalTracked.current = true; trackEvent("low_signal_shown"); }
      }
      if (data.linkedinSlug) setLinkedinSlug(data.linkedinSlug);
      if (data.firstPartyUrls) setFirstPartyUrls(data.firstPartyUrls);
      if (data.webUrls) setWebUrls(data.webUrls);
      if (data.companyDomain) setCompanyDomain(data.companyDomain);

      const wasFirstHook = (hooksUsed ?? 0) === 0;
      setHooksUsed((prev) => (prev ?? 0) + 1);
      if (!hooksGeneratedFirstTracked.current && wasFirstHook) {
        hooksGeneratedFirstTracked.current = true;
        trackEvent("hooks_generated_first");
        if (!localStorage.getItem("first-hook-seen")) {
          setShowFirstHookNudge(true);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url, companyName, targetRole, messagingStyle, customRoleInput, customPain, customPromise, pitchContext, userTier, hooksUsed]);

  useEffect(() => {
    if (!prefillAutoRunPendingRef.current || prefillAutoRunStartedRef.current) return;
    if (loading) return;
    if (!url && !companyName) return;
    if (targetRole === "Custom" && !customRoleInput.trim()) return;

    prefillAutoRunStartedRef.current = true;
    void doGenerate();
  }, [url, companyName, loading, targetRole, customRoleInput, doGenerate]);

  async function generateHooks(e: React.FormEvent) {
    e.preventDefault();
    if (!url && !companyName) return;
    if (targetRole === "Custom" && !customRoleInput.trim()) {
      setError("Enter a role name or pick one from the dropdown.");
      return;
    }
    await doGenerate();
  }

  function handleProfileSaved() {
    setShowProfileModal(false);
    setHasProfile(true);
  }

  const EXAMPLE_COMPANIES = [
    { url: "https://www.linkedin.com/company/gong-io/about/", name: "Gong", role: "VP Sales" },
    { url: "https://www.linkedin.com/company/hubspot/about/", name: "HubSpot", role: "Marketing" },
    { url: "https://www.linkedin.com/company/notion/about/", name: "Notion", role: "Founder/CEO" },
  ];

  return (
    <div className="bg-[#030014] min-h-screen text-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header with workflow */}
        <div className="flex flex-col gap-6 mb-10 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-slate-500 font-black mb-3">Hooks Control Center</p>
            <h1 className="text-3xl font-bold mb-2">Generate hooks and move them straight into outbound</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              This is the workflow start point: generate the signal, write the email, save the lead, add the sequence, then approve the draft in Inbox.
            </p>
          </div>
          <div className="grid gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500 sm:grid-cols-5">
            {["Generate hook", "Create email", "Save lead", "Add sequence", "Approve draft"].map((step, index) => (
              <div key={step} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-3 text-center">
                <div className={`mb-1 ${index === 0 ? "text-purple-400" : "text-slate-600"}`}>{`0${index + 1}`}</div>
                <div>{step}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Input Console */}
        <form onSubmit={generateHooks} className="bg-[#0B0F1A] border border-white/5 rounded-2xl p-8 shadow-2xl mb-8">
          <div className="grid grid-cols-12 gap-6 items-end mb-4">
            <div className="col-span-6">
              <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">
                Target Company
              </label>
              <CompanySearchInput
                onSourceSelected={(sourceUrl, name) => {
                  setUrl(sourceUrl);
                  setCompanyName(name);
                }}
                onCompanyNameChange={(name) => {
                  setCompanyName(name);
                  setUrl('');
                }}
              />
            </div>
            <div className="col-span-4">
              <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">
                Buyer Role
              </label>
              <div className="relative">
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-[#030014] border border-white/10 rounded-xl p-4 text-sm appearance-none outline-none focus:border-purple-500"
                >
                  <option value="VP Sales">VP Sales</option>
                  <option value="RevOps">RevOps</option>
                  <option value="SDR Manager">SDR Manager</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Founder/CEO">Founder/CEO</option>
                  <option value="Not sure / Any role">Any role</option>
                </select>
                <ChevronDown className="absolute right-4 top-4 text-slate-600 pointer-events-none" size={18} />
              </div>
            </div>
            <div className="col-span-2">
              <button
                type="submit"
                disabled={loading || (!url && !companyName)}
                className="w-full bg-purple-600 hover:bg-purple-500 py-4 rounded-xl font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-6 items-end">
            <div className="col-span-6 col-start-7">
              <label className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2 block">
                Messaging Style
              </label>
              <div className="relative">
                <select
                  value={messagingStyle}
                  onChange={(e) => setMessagingStyle(e.target.value)}
                  className="w-full bg-[#030014] border border-white/10 rounded-xl p-4 text-sm appearance-none outline-none focus:border-purple-500"
                >
                  <option value="evidence">Evidence — anchor to the signal</option>
                  <option value="challenger">Challenger — reframe their reality</option>
                  <option value="implication">Implication — amplify the consequence</option>
                  <option value="risk">Risk — frame the cost of inaction</option>
                </select>
                <ChevronDown className="absolute right-4 top-4 text-slate-600 pointer-events-none" size={18} />
              </div>
            </div>
          </div>
        </form>

        <div className="grid gap-4 mb-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-black mb-2">Recommended path</p>
            <div className="grid gap-2 sm:grid-cols-5">
              {[
                { icon: Sparkles, label: "Generate hook" },
                { icon: Mail, label: "Create email" },
                { icon: Users, label: "Save lead" },
                { icon: ListChecks, label: "Add sequence" },
                { icon: Inbox, label: "Approve in inbox" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-white/5 bg-[#0B0F1A] px-3 py-3 text-center text-xs text-slate-300">
                  <item.icon size={14} className="mx-auto mb-2 text-violet-400" />
                  {item.label}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 font-black mb-2">After generation</p>
            <p className="text-sm text-slate-400 leading-6">
              The best outcome from this page is not just a copied hook. It is a saved lead, an assigned sequence, and a draft waiting for approval.
            </p>
          </div>
        </div>

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

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-6">
            <div className="space-y-4">
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
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* Immersive Empty State */}
        {!loading && hooks.length === 0 && !error && !upgradePrompt && !suggestion && (
          <div className="border border-dashed border-white/5 rounded-3xl p-20 text-center bg-white/[0.01]">
            <div className="bg-purple-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-400">
              <Sparkles size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-3">Start with one account and one buyer</h2>
            <p className="text-slate-500 mb-8 max-w-xl mx-auto">
              Paste a company URL or search by name, pick the buyer role, and we will turn recent public signals into hooks you can immediately turn into an email, lead, and sequence.
            </p>
            <div className="flex justify-center gap-3">
              {EXAMPLE_COMPANIES.map((example) => (
                <button
                  key={example.name}
                  onClick={() => {
                    setUrl(example.url);
                    setTargetRole(example.role);
                    localStorage.setItem("gsh_targetRole", example.role);
                    doGenerate(example.url);
                  }}
                  className="px-4 py-2 rounded-full border border-white/10 bg-white/5 text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  Try {example.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {suggestion && (
          <div className={`border rounded-xl mb-6 text-sm ${lowSignal ? "bg-amber-900/30 border-amber-800" : "bg-blue-900/30 border-blue-800"}`}>
            <div className="px-4 pt-4 pb-2">
              <p className={`font-semibold mb-1 ${lowSignal ? "text-amber-200" : "text-blue-200"}`}>
                {lowSignal ? "Low signal for this company" : "We need a better source to write your hooks"}
              </p>
              <p className="text-zinc-400 text-xs leading-relaxed">
                {lowSignal
                  ? "We couldn't find recent public signals for this company. Try pasting a direct URL to their blog, press page, or LinkedIn — or try a larger, more public company."
                  : suggestion}
              </p>
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
                      setTimeout(() => generateHooks({ preventDefault: () => {} } as React.FormEvent), 50);
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
                    const input = document.querySelector<HTMLInputElement>("input[placeholder*='Notion']");
                    input?.focus();
                  }}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
                >
                  + Search another company
                </button>
              </div>
            )}
          </div>
        )}

        {hooks.length > 0 && (() => {
          const visibleHooks = showAll ? [...hooks, ...overflowHooks] : hooks;
          const totalCount = hooks.length + overflowHooks.length;
          return (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
              {/* Left: hooks list */}
              <div className="space-y-4">
                {showFirstHookNudge && (
                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-5 py-4 text-sm text-violet-300 flex items-center justify-between gap-4 animate-fade-in">
                    <span>Your first hook. Copy it, paste it into your next email, and see what happens.</span>
                    <button
                      onClick={() => {
                        setShowFirstHookNudge(false);
                        localStorage.setItem("first-hook-seen", "1");
                      }}
                      className="shrink-0 text-violet-400 hover:text-violet-200 transition-colors"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="rounded-2xl border border-violet-500/15 bg-violet-500/[0.05] p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-violet-300/80 mb-2">Next best action</p>
                      <h2 className="text-lg font-semibold text-white mb-2">{generatedEmails[0] ? "Turn the draft into workflow" : "Start with the recommended hook"}</h2>
                      <p className="text-sm text-slate-300 max-w-2xl leading-6">
                        {generatedEmails[0]
                          ? "You have a draft. Save a lead or add the account to a sequence so Inbox becomes your review queue."
                          : "Hook 1 is your strongest starting point. Generate the email first, then save the lead and assign a sequence before you move on."}
                      </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[280px]">
                      <Link href="/app/leads" className="rounded-xl border border-white/10 bg-[#0B0F1A] px-3 py-3 text-sm text-slate-200 hover:border-violet-500/25 transition-colors">Open leads</Link>
                      <Link href="/app/inbox" className="rounded-xl border border-white/10 bg-[#0B0F1A] px-3 py-3 text-sm text-slate-200 hover:border-violet-500/25 transition-colors">Open inbox</Link>
                      <button
                        type="button"
                        onClick={addCurrentCompanyToWatchlist}
                        disabled={savingWatchlist}
                        className="rounded-xl border border-white/10 bg-[#0B0F1A] px-3 py-3 text-sm text-slate-200 hover:border-violet-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-left"
                      >
                        {savingWatchlist ? "Adding to watchlist..." : "Add to watchlist"}
                      </button>
                      <Link href="/app/analytics" className="rounded-xl border border-white/10 bg-[#0B0F1A] px-3 py-3 text-sm text-slate-200 hover:border-violet-500/25 transition-colors">View analytics</Link>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {[
                      { label: "Hooks ready", done: hooks.length > 0 },
                      { label: "Email drafted", done: Object.keys(generatedEmails).length > 0 },
                      { label: "Lead saved", done: savedLeadCount > 0 },
                      { label: "Sequence started", done: sequenceStartedCount > 0 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-white/5 bg-black/20 px-3 py-3 text-xs">
                        <p className={`font-black uppercase tracking-[0.18em] ${item.done ? "text-emerald-400" : "text-slate-600"}`}>{item.done ? "Done" : "Next"}</p>
                        <p className="mt-1 text-slate-300">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

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
                    companyUrl={url || (companyDomain ? `https://${companyDomain}` : undefined)}
                    companyName={companyName || companyDomain}
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
                    isRecommended={i === 0}
                    onLeadSaved={() => setSavedLeadCount((count) => count + 1)}
                    onSequenceStarted={() => setSequenceStartedCount((count) => count + 1)}
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

              {/* Right: sticky intel/intent panel */}
              <div className="lg:sticky lg:top-20 space-y-4">
                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-black mb-2">Control center links</p>
                  <div className="space-y-2 text-sm">
                    <Link href="/app/inbox" className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0B0F1A] px-3 py-2 text-slate-300 hover:border-violet-500/20 transition-colors">Approve drafts <Inbox size={14} /></Link>
                    <Link href="/app/leads" className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0B0F1A] px-3 py-2 text-slate-300 hover:border-violet-500/20 transition-colors">Manage leads <Users size={14} /></Link>
                    <Link href="/app/sequences" className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0B0F1A] px-3 py-2 text-slate-300 hover:border-violet-500/20 transition-colors">Review sequences <ListChecks size={14} /></Link>
                    <Link href="/app/analytics" className="flex items-center justify-between rounded-lg border border-white/5 bg-[#0B0F1A] px-3 py-2 text-slate-300 hover:border-violet-500/20 transition-colors">See hot accounts <BarChart3 size={14} /></Link>
                  </div>
                </div>
                {(companyIntel || intentData || retrievalDiagnostics) ? (
                  <>
                    {(() => {
                      const availableTabs = [
                        companyIntel ? "intel" : null,
                        intentData ? "intent" : null,
                        retrievalDiagnostics ? "retrieval" : null,
                      ].filter(Boolean) as Array<"intel" | "intent" | "retrieval">;
                      const activeTab = availableTabs.includes(rightTab) ? rightTab : availableTabs[0];

                      return (
                        <>
                    <div className="flex gap-0 bg-[#0e0f10] rounded-lg p-0.5 w-fit mb-2">
                      {availableTabs.map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setRightTab(tab)}
                          className={`text-xs px-3 py-1 rounded-md transition-all capitalize ${
                            activeTab === tab ? "bg-[#1c1e20] text-white shadow-inner-glow" : "text-zinc-500"
                          }`}
                        >
                          {tab === "intel" ? "Company" : tab === "intent" ? "Signals" : "Retrieval"}
                        </button>
                      ))}
                    </div>
                    {activeTab === "intel" && companyIntel && <CompanyIntelPanel intel={companyIntel} isBasic={isBasicIntel} />}
                    {activeTab === "intent" && intentData && <IntentSignals data={intentData} />}
                    {activeTab === "retrieval" && retrievalDiagnostics && (
                      <RetrievalDiagnostics
                        data={retrievalDiagnostics}
                        onManageMemory={manageRetrievalMemory}
                        managingMemory={managingRetrievalMemory}
                        memoryAction={retrievalMemoryAction}
                      />
                    )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    {companyIntel && <CompanyIntelPanel intel={companyIntel} isBasic={isBasicIntel} />}
                    {intentData && <IntentSignals data={intentData} />}
                    {retrievalDiagnostics && (
                      <RetrievalDiagnostics
                        data={retrievalDiagnostics}
                        onManageMemory={manageRetrievalMemory}
                        managingMemory={managingRetrievalMemory}
                        memoryAction={retrievalMemoryAction}
                      />
                    )}
                  </>
                )}

                {/* Find contacts */}
                {companyDomain && (
                  <div className="pt-3 border-t border-zinc-800/60">
                    {userTier === "free" ? (
                      <p className="text-xs text-zinc-500">
                        <span className="text-violet-400 font-medium">Pro</span> — Find verified contacts at this company.{" "}
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

                {/* Profile nudge */}
                {!hasProfile && (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-400">
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
              </div>
            </div>
          );
        })()}

        {showProfileModal && (
          <ContextWalletModal
            showClose
            showSkip={false}
            gateMode={false}
            onClose={() => setShowProfileModal(false)}
            onSave={handleProfileSaved}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Onboarding tour
// ---------------------------------------------------------------------------

const ONBOARDING_STEPS: Array<{
  target: string;
  title: string;
  body: string;
  position: "top" | "bottom";
  cta?: { label: string; href: string };
}> = [
  {
    target: "input[placeholder*='Notion']",
    title: "Start here",
    body: "Type a company name and click 'Find sources' \u2014 we'll surface the best URLs to scan for signals.",
    position: "bottom",
  },
  {
    target: "select",
    title: "Pick who you're emailing",
    body: "Choose the buyer's role to get hooks with questions tailored to their priorities. 'VP Sales' gets different hooks than 'Marketing'.",
    position: "bottom",
  },
  {
    target: "button[type='submit']",
    title: "Generate hooks",
    body: "Hit this to research the company and generate 3-5 evidence-backed hooks. Each one includes a real quote, source, and date.",
    position: "top",
  },
  {
    target: "a[href='/app/settings']",
    title: "Personalize your hooks",
    body: "Go to Settings \u2192 AI Context to set your company description, voice tone, and primary KPI. This makes every hook sound like you wrote it.",
    position: "bottom",
    cta: { label: "Set up AI Context \u2192", href: "/app/settings" },
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
          {current.cta ? (
            <>
              <Link
                href={current.cta.href}
                onClick={onNext}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                {current.cta.label}
              </Link>
              <button
                onClick={onDismiss}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Skip for now
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
