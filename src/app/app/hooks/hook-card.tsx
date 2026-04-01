"use client";

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Sequence {
  id: string;
  name: string;
}

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

const psychModeLabels: Record<string, string> = {
  relevance: "You-first",
  curiosity_gap: "Curiosity gap",
  symptom: "Symptom",
  tradeoff_frame: "Tradeoff",
  contrarian: "Contrarian",
  benefit: "Benefit",
};

const REPUTABLE_DOMAINS = [
  "reuters.com", "bloomberg.com", "wsj.com", "ft.com", "cnbc.com",
  "techcrunch.com", "theverge.com", "wired.com", "arstechnica.com",
  "forbes.com", "inc.com", "hbr.org", "businessinsider.com",
  "sec.gov", "crunchbase.com", "glassdoor.com", "g2.com",
  "linkedin.com", "github.com", "pitchbook.com",
];

function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function getSourceType(sourceUrl: string, companyDomain: string): "First-party" | "Reputable" | "Web" {
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

function qualityVariant(label?: string) {
  if (label === "Excellent") return "fresh" as const;
  if (label === "Strong") return "recent" as const;
  if (label === "Decent") return "older" as const;
  return "stale" as const;
}
const tierVariant = (t: string) => t === "A" ? "tier-a" as const : t === "B" ? "tier-b" as const : "tier-c" as const;
const angleVariant = (a: string) => a === "trigger" ? "trigger" as const : a === "risk" ? "risk" as const : "tradeoff" as const;
const angleBorderColor: Record<string, string> = {
  trigger: "border-l-blue-500/60",
  risk: "border-l-rose-500/60",
  tradeoff: "border-l-amber-500/60",
};

interface HookCardProps {
  hook: Hook;
  index: number;
  companyDomain: string;
  companyUrl?: string;
  companyName?: string;
  targetRole: string;
  customRoleInput: string;
  hookVariants: Array<{ hook_index: number; variants: ChannelVariant[] }>;
  activeChannel: Record<number, string>;
  setActiveChannel: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  copied: number | null;
  copiedEvidence: number | null;
  generatingEmail: number | null;
  generatedEmails: Record<number, GeneratedEmail>;
  copiedEmail: number | null;
  pushingCrm?: boolean;
  pushedToCrm?: boolean;
  showCrmPush?: boolean;
  userTierId?: string;
  isRecommended?: boolean;
  onCopyHook: (hook: Hook, index: number) => void;
  onCopyHookWithEvidence: (hook: Hook, index: number) => void;
  onGenerateEmail: (hook: Hook, index: number) => void;
  onCopyEmail: (email: GeneratedEmail, index: number) => void;
  onPushToCrm?: (hook: Hook, index: number) => void;
  onLeadSaved?: () => void;
  onSequenceStarted?: () => void;
}

export function HookCard({
  hook,
  index,
  companyDomain,
  companyUrl,
  companyName,
  targetRole,
  customRoleInput,
  hookVariants,
  activeChannel,
  setActiveChannel,
  copied,
  copiedEvidence,
  generatingEmail,
  generatedEmails,
  copiedEmail,
  pushingCrm,
  pushedToCrm,
  showCrmPush,
  userTierId,
  isRecommended,
  onCopyHook,
  onCopyHookWithEvidence,
  onGenerateEmail,
  onCopyEmail,
  onPushToCrm,
  onLeadSaved,
  onSequenceStarted,
}: HookCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [sharingHook, setSharingHook] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share");
  const [wonReply, setWonReply] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState<"idle" | "saving" | "saved">("idle");
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadForm, setLeadForm] = useState({ email: "", name: "" });

  // Send Sequence modal state
  const [seqModalOpen, setSeqModalOpen] = useState(false);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [seqLoading, setSeqLoading] = useState(false);
  const [seqSubmitting, setSeqSubmitting] = useState(false);
  const [seqError, setSeqError] = useState<string | null>(null);
  const [seqSuccess, setSeqSuccess] = useState(false);
  const [seqForm, setSeqForm] = useState({ email: "", name: "", sequenceId: "" });

  function trackHookFeedback(event: string, metadata?: Record<string, unknown>) {
    if (!hook.generated_hook_id) return;
    fetch("/api/hooks/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hookId: hook.generated_hook_id, event, metadata }),
    }).catch(() => {});
  }

  async function handleShare() {
    if (!hook.generated_hook_id) return;
    setSharingHook(true);
    try {
      const res = await fetch("/api/hooks/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hookId: hook.generated_hook_id }),
      });
      const data = await res.json().catch(() => null);
      if (data?.shareUrl) {
        await navigator.clipboard.writeText(data.shareUrl).catch(() => {});
        setShareLabel("Copied link ✓");
        setTimeout(() => setShareLabel("Share"), 2000);
      }
    } catch {
      // ignore
    } finally {
      setSharingHook(false);
    }
  }

  async function handleWin() {
    if (!hook.generated_hook_id || wonReply) return;
    setWonReply(true);
    setShowSharePrompt(true);
    fetch("/api/hooks/win", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hookId: hook.generated_hook_id }),
    }).catch(() => {});
  }

  async function handleSaveLead(e: React.FormEvent) {
    e.preventDefault();
    if (!leadForm.email.trim()) return;
    setLeadSubmitting(true);
    setLeadError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [{
            email: leadForm.email.trim(),
            name: leadForm.name.trim() || undefined,
            company_website: companyUrl || (companyDomain ? `https://${companyDomain}` : undefined),
            company_name: companyName || companyDomain || undefined,
            source: "hook_saved_lead",
          }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to save lead");
      setLeadSuccess(true);
      trackHookFeedback("saved_lead");
      onLeadSaved?.();
    } catch (err: any) {
      setLeadError(err?.message || "Failed to save lead");
    } finally {
      setLeadSubmitting(false);
    }
  }

  async function saveAsTemplate() {
    setSavedTemplate("saving");
    try {
      const signal = hook.source_title || companyName || companyDomain || "Saved hook";
      const trigger = hook.trigger_type || hook.angle || "signal";
      const titleBase = companyName || companyDomain || "Saved hook";
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${titleBase} — ${trigger}`,
          signal,
          trigger,
          hook: hook.text,
          promise: hook.promise,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save template");
      }
      setSavedTemplate("saved");
      trackHookFeedback("saved");
    } catch {
      setSavedTemplate("idle");
    }
  }

  // Fetch sequences when modal opens
  useEffect(() => {
    if (!seqModalOpen) return;
    setSeqLoading(true);
    setSeqError(null);
    setSeqSuccess(false);
    setSeqForm({ email: "", name: "", sequenceId: "" });
    fetch("/api/sequences")
      .then((r) => r.json())
      .then((data) => {
        const seqs = data.sequences || [];
        setSequences(seqs);
        if (seqs.length > 0) setSeqForm((f) => ({ ...f, sequenceId: seqs[0].id }));
      })
      .catch(() => setSeqError("Failed to load sequences"))
      .finally(() => setSeqLoading(false));
  }, [seqModalOpen]);

  async function handleSendSequence(e: React.FormEvent) {
    e.preventDefault();
    if (!seqForm.email.trim() || !seqForm.sequenceId) return;
    setSeqSubmitting(true);
    setSeqError(null);
    try {
      // 1. Create lead
      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leads: [
            {
              email: seqForm.email.trim(),
              name: seqForm.name.trim() || undefined,
              company_website: companyUrl || (companyDomain ? `https://${companyDomain}` : undefined),
              company_name: companyName || companyDomain || undefined,
              source: "hook_sequence",
            },
          ],
        }),
      });
      const leadData = await leadRes.json();
      if (!leadRes.ok) throw new Error(leadData?.message || "Failed to create lead");
      const leadId = leadData.leads?.[0]?.id;
      if (!leadId) throw new Error("Lead was not created — the email may already exist.");
      onLeadSaved?.();

      // 2. Assign lead to sequence
      const assignRes = await fetch("/api/lead-sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          sequenceId: seqForm.sequenceId,
          approvalMode: true,
        }),
      });
      const assignData = await assignRes.json();
      if (!assignRes.ok) throw new Error(assignData?.error || "Failed to assign sequence");

      setSeqSuccess(true);
      onSequenceStarted?.();
    } catch (err: any) {
      setSeqError(err?.message || "Something went wrong");
    } finally {
      setSeqSubmitting(false);
    }
  }

  const variantEntry = hookVariants.find((v) => v.hook_index === index);
  const active = activeChannel[index] || "email";

  const displayText = (() => {
    if (active === "email") return hook.text;
    const variant = variantEntry?.variants.find((v) => v.channel === active);
    return variant?.text || hook.text;
  })();

  // Source type badge
  const srcType = hook.source_url ? getSourceType(hook.source_url, companyDomain) : null;
  const srcVariant = srcType === "First-party" ? "first-party" as const : srcType === "Reputable" ? "reputable" as const : "web" as const;

  // Freshness badge
  const freshness = hook.source_date ? (() => {
    const age = daysSince(hook.source_date);
    if (age <= 7) return { label: "Fresh", variant: "fresh" as const };
    if (age <= 30) return { label: "Recent", variant: "recent" as const };
    if (age <= 90) return { label: "Older", variant: "older" as const };
    return { label: "Stale", variant: "stale" as const };
  })() : null;

  const channels = [
    { key: "email", label: "Email" },
    { key: "linkedin_connection", label: "LinkedIn" },
    { key: "linkedin_message", label: "LinkedIn DM" },
    { key: "cold_call", label: "Call" },
    { key: "video_script", label: "Video" },
  ];

  // Confidence dot color
  const confColor = hook.confidence === "high"
    ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]"
    : hook.confidence === "med"
    ? "bg-amber-400"
    : "bg-rose-400";

  return (
    <div
      className={`bg-[#14161a] border border-[#252830] rounded-xl p-5 border-l-[3px] ${angleBorderColor[hook.angle] || "border-l-zinc-700"} transition-all duration-200 hover:border-[#353840] animate-slide-in-bottom`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Badges row — always visible: Quality label, Angle, Freshness, Role */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {isRecommended && (
          <Badge variant="fresh">Recommended</Badge>
        )}
        {hook.quality_label && (
          <Badge variant={qualityVariant(hook.quality_label)}>{hook.quality_label}</Badge>
        )}
        <Badge variant={angleVariant(hook.angle)}>{hook.angle}</Badge>
        {freshness && <Badge variant={freshness.variant} className="text-[10px]">{freshness.label}</Badge>}
        {targetRole && targetRole !== "Not sure / Any role" && targetRole !== "General" && (
          <Badge variant="role" className="text-[10px]">
            {targetRole === "Custom" ? customRoleInput || "Custom" : targetRole}
          </Badge>
        )}
        <button
          onClick={() => setShowDetails(v => !v)}
          aria-expanded={showDetails}
          aria-controls={`hook-details-${index}`}
          className="flex items-center gap-0.5 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors ml-auto"
        >
          <span>{showDetails ? "Hide details" : "Show details"}</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Collapsible detail badges */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: showDetails ? "1fr" : "0fr",
          transition: "grid-template-rows 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          id={`hook-details-${index}`}
          style={{ overflow: "hidden" }}
          className="mb-3"
        >
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <Badge
              variant={tierVariant(hook.evidence_tier)}
              title={
                hook.evidence_tier === "A"
                  ? "Tier A — first-party or reputable source with a recent date"
                  : hook.evidence_tier === "B"
                  ? "Tier B — moderate confidence, secondary or undated source"
                  : "Tier C — low confidence, weak or unverifiable source"
              }
              className="cursor-help text-[10px]"
            >
              Tier {hook.evidence_tier}
            </Badge>
            {srcType && <Badge variant={srcVariant} className="text-[10px]">{srcType}</Badge>}
            <span className="flex items-center gap-1 text-xs text-zinc-500">
              <span className={`w-2 h-2 rounded-full shrink-0 ${confColor}`} />
              <span className="sr-only">
                {hook.confidence === "high" ? "High" : hook.confidence === "med" ? "Medium" : "Low"} confidence
              </span>
              <span aria-hidden="true">{hook.confidence}</span>
            </span>
            {typeof hook.quality_score === "number" && (
              <Badge variant={qualityVariant(hook.quality_label)} className="text-[10px]">
                {hook.quality_score}/100
              </Badge>
            )}
            {hook.psych_mode && (
              <Badge
                variant="psych"
                title={hook.why_this_works || psychModeLabels[hook.psych_mode] || hook.psych_mode}
                className="cursor-help"
              >
                {psychModeLabels[hook.psych_mode] || hook.psych_mode}
              </Badge>
            )}
            {hook.trigger_type && (
              <Badge variant="trigger" className="text-[10px]">
                {hook.trigger_type.replace(/_/g, " ")}
              </Badge>
            )}
            {hook.bridge_quality === "weak" && (
              <Badge variant="older" className="text-[10px]" title="Bridge has weak connection to evidence">
                weak bridge
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Role sharpening prompt */}
      {(targetRole === "Not sure / Any role" || targetRole === "General") && (
        <p className="text-[11px] text-zinc-600 mb-2 -mt-1">
          Pick a role above to sharpen the question for a specific buyer.
        </p>
      )}

      {/* Channel switcher — pill segmented control */}
      {variantEntry && variantEntry.variants.length > 0 && (
        <div className="flex gap-0 mb-3 bg-[#0e0f10] rounded-lg p-0.5 w-fit">
          {channels.map((ch) => (
            <button
              key={ch.key}
              onClick={() => setActiveChannel((prev) => ({ ...prev, [index]: ch.key }))}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
                active === ch.key
                  ? "bg-[#1c1e20] text-white shadow-inner-glow"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      )}

      {/* Hook text */}
      <p className="text-zinc-200 mb-3">{displayText}</p>

      {hook.promise && (
        <p className="text-xs text-[#878a8f] mt-1 mb-3 flex items-center gap-1.5">
          <span className="font-medium text-[#eceae6]">Promise:</span> {hook.promise}
        </p>
      )}

      {/* Evidence */}
      {hook.source_snippet && (
        <div className="mb-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2 text-[10px] uppercase tracking-[0.16em] text-amber-300/80">
            <span>Why it passed</span>
            <span className="text-zinc-600">•</span>
            <span>Quoted evidence</span>
            {hook.evidence_tier && <><span className="text-zinc-600">•</span><span>Tier {hook.evidence_tier}</span></>}
            {freshness && <><span className="text-zinc-600">•</span><span>{freshness.label}</span></>}
          </div>
          <p className="text-sm italic leading-6 text-[#d5d1c7]">{hook.source_snippet}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            {hook.source_title && <span>{hook.source_title}</span>}
            {hook.source_date && <span>{hook.source_date}</span>}
            {hook.source_url && (
              <a
                href={hook.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
              >
                Open source
              </a>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#252830]">
        <button
          onClick={() => onCopyHook(hook, index)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
        >
          {copied === index ? "Copied!" : "Copy Hook"}
        </button>
        <button
          onClick={() => onCopyHookWithEvidence(hook, index)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
        >
          {copiedEvidence === index ? "Copied!" : "Copy + Evidence"}
        </button>
        {hook.generated_hook_id && (
          <button
            onClick={handleShare}
            disabled={sharingHook}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50 transition-colors"
          >
            {sharingHook ? "Sharing..." : shareLabel}
          </button>
        )}
        <button
          onClick={() => onGenerateEmail(hook, index)}
          disabled={generatingEmail === index}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-800/60 bg-violet-900/20 text-violet-400 hover:bg-violet-900/40 hover:text-violet-300 disabled:opacity-50 transition-colors"
        >
          {generatingEmail === index ? "Writing..." : generatedEmails[index] ? "Regenerate Email" : "Generate Email"}
        </button>
        <button
          onClick={() => {
            setLeadModalOpen(true);
            setLeadError(null);
            setLeadSuccess(false);
          }}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-sky-800/60 bg-sky-900/20 text-sky-300 hover:bg-sky-900/40 hover:text-sky-200 transition-colors"
        >
          {leadSuccess ? "Lead Saved" : "Save Lead"}
        </button>
        {generatedEmails[index] && (
          <button
            onClick={() => onCopyEmail(generatedEmails[index], index)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-violet-800/60 bg-violet-900/20 text-violet-400 hover:bg-violet-900/40 hover:text-violet-300 transition-colors"
          >
            {copiedEmail === index ? "Copied!" : "Copy Email"}
          </button>
        )}
        {onPushToCrm && showCrmPush && hook.generated_hook_id && (
          <button
            onClick={() => onPushToCrm(hook, index)}
            disabled={pushingCrm}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-800/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 disabled:opacity-50 transition-colors"
          >
            {pushingCrm ? "Pushing..." : pushedToCrm ? "Pushed" : "Push to CRM"}
          </button>
        )}
        {userTierId === "pro" && (
          <button
            onClick={() => setSeqModalOpen(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-800/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 hover:text-emerald-300 transition-colors"
          >
            Add to Sequence
          </button>
        )}
        {hook.generated_hook_id && !wonReply && (
          <button
            onClick={handleWin}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-zinc-700/60 bg-transparent text-zinc-600 hover:text-emerald-400 hover:border-emerald-700/50 transition-colors"
          >
            Got a reply?
          </button>
        )}
        {wonReply && (
          <span className="text-xs text-emerald-400">Nice work!</span>
        )}
        <button
          onClick={saveAsTemplate}
          disabled={savedTemplate !== "idle"}
          title="Save this hook to My Templates"
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:cursor-default ml-auto ${
            savedTemplate === "saved"
              ? "border-violet-700 bg-violet-900/20 text-violet-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-60"
          }`}
        >
          {savedTemplate === "saved" ? "Template Saved" : savedTemplate === "saving" ? "Saving..." : "Save Template"}
        </button>
      </div>

      {/* Reply win share prompt */}
      {showSharePrompt && hook.generated_hook_id && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-800/30 bg-emerald-900/10 px-3 py-2 animate-slide-in-bottom">
          <p className="text-xs text-emerald-300">Want to share this hook with your team?</p>
          <button
            onClick={() => { handleShare(); setShowSharePrompt(false); }}
            className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md border border-emerald-700/50 bg-emerald-900/20 text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Share link
          </button>
        </div>
      )}

      {(generatedEmails[index] || leadSuccess || seqSuccess) && (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-[#a3a7ad]">
          <span className="font-medium text-white">Next step:</span>{" "}
          {seqSuccess
            ? "Open Inbox to approve the first draft from this sequence."
            : generatedEmails[index]
              ? "Save a lead or add this account to a sequence so the draft turns into workflow, not just copy."
              : "Use this hook to create the next workflow step."}
        </div>
      )}

      {/* Generated email */}
      {generatedEmails[index] && (
        <div className="mt-3 bg-[#0e0f10] border border-[#252830] rounded-lg p-4 animate-slide-in-bottom">
          <p className="text-xs text-[#878a8f] mb-1">Subject:</p>
          <p className="text-sm text-[#eceae6] font-medium mb-3">{generatedEmails[index].subject}</p>
          <p className="text-xs text-[#878a8f] mb-1">Body:</p>
          <p className="text-sm text-[#eceae6] whitespace-pre-line">{generatedEmails[index].body}</p>
          <p className="mt-3 text-[11px] text-[#878a8f]">
            Generated emails stay on this page until you copy them or turn them into workflow by saving a lead and sending them into a sequence. `Save Template` stores the hook in Templates, not the email draft.
          </p>
        </div>
      )}

      {/* Upgrade nudge for free users */}
      {userTierId === "free" && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2">
          <p className="text-[11px] text-zinc-500">
            Export to Apollo / Clay &mdash; available on Pro
          </p>
          <a
            href="/#pricing"
            className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors shrink-0 ml-3"
          >
            Upgrade →
          </a>
        </div>
      )}

      {leadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setLeadModalOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-md mx-4 bg-[#14161a] border border-[#252830] rounded-xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-zinc-100">Save lead</h3>
              <button onClick={() => setLeadModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none">&times;</button>
            </div>
            {leadSuccess ? (
              <div className="text-center py-4">
                <p className="text-sm text-emerald-400 mb-3">Lead saved successfully.</p>
                <p className="text-xs text-zinc-500 mb-4">You can now manage this contact in Leads or add them to a sequence from this hook.</p>
                <div className="flex gap-2 justify-center">
                  <a href="/app/leads" className="text-xs font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">Open Leads</a>
                  <button onClick={() => setLeadModalOpen(false)} className="text-xs font-medium px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors">Close</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveLead}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Lead email *</label>
                    <input
                      type="email"
                      required
                      value={leadForm.email}
                      onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="jane@company.com"
                      className="w-full text-sm px-3 py-2 rounded-lg bg-[#0e0f10] border border-[#252830] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-700 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Lead name</label>
                    <input
                      type="text"
                      value={leadForm.name}
                      onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Jane Smith"
                      className="w-full text-sm px-3 py-2 rounded-lg bg-[#0e0f10] border border-[#252830] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-700 transition-colors"
                    />
                  </div>
                </div>
                {leadError && <p className="mt-3 text-xs text-rose-400">{leadError}</p>}
                <button
                  type="submit"
                  disabled={leadSubmitting}
                  className="w-full mt-5 text-sm font-medium px-4 py-2.5 rounded-lg bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {leadSubmitting ? "Saving..." : "Save lead"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Send Sequence Modal */}
      {seqModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSeqModalOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Modal */}
          <div
            className="relative w-full max-w-md mx-4 bg-[#14161a] border border-[#252830] rounded-xl p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-zinc-100">Send Sequence</h3>
              <button
                onClick={() => setSeqModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {seqSuccess ? (
              <div className="text-center py-4">
                <p className="text-sm text-emerald-400 mb-3">Sequence started successfully!</p>
                <p className="text-xs text-zinc-500 mb-4">Drafts will appear in your Inbox for review before sending.</p>
                <div className="flex gap-2 justify-center">
                  <a
                    href="/app/inbox"
                    className="text-xs font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                  >
                    Go to Inbox
                  </a>
                  <button
                    onClick={() => setSeqModalOpen(false)}
                    className="text-xs font-medium px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : seqLoading ? (
              <div className="text-center py-6">
                <p className="text-xs text-zinc-500">Loading sequences...</p>
              </div>
            ) : (
              <form onSubmit={handleSendSequence}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Recipient email *</label>
                    <input
                      type="email"
                      required
                      value={seqForm.email}
                      onChange={(e) => setSeqForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="jane@company.com"
                      className="w-full text-sm px-3 py-2 rounded-lg bg-[#0e0f10] border border-[#252830] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-700 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Recipient name</label>
                    <input
                      type="text"
                      value={seqForm.name}
                      onChange={(e) => setSeqForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Jane Smith"
                      className="w-full text-sm px-3 py-2 rounded-lg bg-[#0e0f10] border border-[#252830] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-700 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1.5">Sequence</label>
                    <select
                      value={seqForm.sequenceId}
                      onChange={(e) => setSeqForm((f) => ({ ...f, sequenceId: e.target.value }))}
                      required
                      className="w-full text-sm px-3 py-2 rounded-lg bg-[#0e0f10] border border-[#252830] text-zinc-200 focus:outline-none focus:border-emerald-700 transition-colors appearance-none"
                    >
                      {sequences.length === 0 && <option value="">No sequences available</option>}
                      {sequences.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {seqError && (
                  <p className="mt-3 text-xs text-rose-400">{seqError}</p>
                )}

                <button
                  type="submit"
                  disabled={seqSubmitting || sequences.length === 0}
                  className="w-full mt-5 text-sm font-medium px-4 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {seqSubmitting ? "Starting..." : "Start Sequence"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
