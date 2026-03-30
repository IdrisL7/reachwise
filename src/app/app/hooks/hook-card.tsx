"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  onCopyHook: (text: string, index: number) => void;
  onCopyHookWithEvidence: (hook: Hook, index: number) => void;
  onGenerateEmail: (hook: Hook, index: number) => void;
  onCopyEmail: (email: GeneratedEmail, index: number) => void;
  onPushToCrm?: (hook: Hook, index: number) => void;
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
  onCopyHook,
  onCopyHookWithEvidence,
  onGenerateEmail,
  onCopyEmail,
  onPushToCrm,
}: HookCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [sharingHook, setSharingHook] = useState(false);
  const [shareLabel, setShareLabel] = useState("Share");
  const [wonReply, setWonReply] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState<"idle" | "saving" | "saved">("idle");

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

  async function saveAsTemplate() {
    setSavedTemplate("saving");
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hookText: hook.text,
          angle: hook.angle,
          promise: hook.promise,
          companyUrl: companyUrl || (companyDomain ? `https://${companyDomain}` : undefined),
          companyName: companyName || companyDomain,
        }),
      });
      setSavedTemplate("saved");
    } catch {
      setSavedTemplate("idle");
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
        <div className="text-xs text-[#878a8f] italic border-l-2 border-amber-500/30 pl-3 mb-3 bg-amber-500/[0.03] py-2 rounded-r">
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

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#252830]">
        <button
          onClick={() => onCopyHook(hook.text, index)}
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
          title="Save to My Templates"
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:cursor-default ml-auto ${
            savedTemplate === "saved"
              ? "border-violet-700 bg-violet-900/20 text-violet-400"
              : "border-zinc-700 bg-zinc-800 text-zinc-500 hover:text-zinc-300 disabled:opacity-60"
          }`}
        >
          {savedTemplate === "saved" ? "Saved" : savedTemplate === "saving" ? "Saving..." : "Save"}
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

      {/* Generated email */}
      {generatedEmails[index] && (
        <div className="mt-3 bg-[#0e0f10] border border-[#252830] rounded-lg p-4 animate-slide-in-bottom">
          <p className="text-xs text-[#878a8f] mb-1">Subject:</p>
          <p className="text-sm text-[#eceae6] font-medium mb-3">{generatedEmails[index].subject}</p>
          <p className="text-xs text-[#878a8f] mb-1">Body:</p>
          <p className="text-sm text-[#eceae6] whitespace-pre-line">{generatedEmails[index].body}</p>
        </div>
      )}

      {/* Upgrade nudge for free/starter users */}
      {(userTierId === "starter" || userTierId === "free") && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2">
          <p className="text-[11px] text-zinc-500">
            Export to Apollo / Clay &mdash; available on Scale
          </p>
          <a
            href="/#pricing"
            className="text-[11px] font-semibold text-violet-400 hover:text-violet-300 transition-colors shrink-0 ml-3"
          >
            Upgrade →
          </a>
        </div>
      )}
    </div>
  );
}
