"use client";

import { Badge } from "@/components/ui/badge";

interface Hook {
  text: string;
  angle: string;
  confidence: string;
  evidence_tier: string;
  source_snippet?: string;
  source_url?: string;
  source_title?: string;
  source_date?: string;
  psych_mode?: string;
  why_this_works?: string;
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
  onCopyHook: (text: string, index: number) => void;
  onCopyHookWithEvidence: (hook: Hook, index: number) => void;
  onGenerateEmail: (hook: Hook, index: number) => void;
  onCopyEmail: (email: GeneratedEmail, index: number) => void;
}

export function HookCard({
  hook,
  index,
  companyDomain,
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
  onCopyHook,
  onCopyHookWithEvidence,
  onGenerateEmail,
  onCopyEmail,
}: HookCardProps) {
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

  return (
    <div
      className={`bg-zinc-900 border border-zinc-800 rounded-xl p-5 border-l-[3px] ${angleBorderColor[hook.angle] || "border-l-zinc-700"} transition-all duration-200 hover:border-zinc-700 animate-slide-in-bottom`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Badges row */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <Badge variant={tierVariant(hook.evidence_tier)}>Tier {hook.evidence_tier}</Badge>
        {srcType && <Badge variant={srcVariant} className="text-[10px]">{srcType}</Badge>}
        {freshness && <Badge variant={freshness.variant} className="text-[10px]">{freshness.label}</Badge>}
        <Badge variant={angleVariant(hook.angle)}>{hook.angle}</Badge>
        {hook.psych_mode && (
          <Badge
            variant="psych"
            title={hook.why_this_works || psychModeLabels[hook.psych_mode] || hook.psych_mode}
            className="cursor-help"
          >
            {psychModeLabels[hook.psych_mode] || hook.psych_mode}
          </Badge>
        )}
        <span className="text-xs text-zinc-600">{hook.confidence} confidence</span>
        {targetRole && targetRole !== "Not sure / Any role" && targetRole !== "General" && (
          <Badge variant="role" className="text-[10px]">
            {targetRole === "Custom" ? customRoleInput || "Custom" : targetRole}
          </Badge>
        )}
      </div>

      {/* Role sharpening prompt */}
      {(targetRole === "Not sure / Any role" || targetRole === "General") && (
        <p className="text-[11px] text-zinc-600 mb-2 -mt-1">
          Pick a role above to sharpen the question for a specific buyer.
        </p>
      )}

      {/* Channel switcher */}
      {variantEntry && variantEntry.variants.length > 0 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {channels.map((ch) => (
            <button
              key={ch.key}
              onClick={() => setActiveChannel((prev) => ({ ...prev, [index]: ch.key }))}
              className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                active === ch.key
                  ? "bg-emerald-900/40 border-emerald-700 text-emerald-300"
                  : "bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
      )}

      {/* Hook text */}
      <p className="text-zinc-200 mb-3">{displayText}</p>

      {/* Evidence */}
      {hook.source_snippet && (
        <div className="text-xs text-zinc-500 italic border-l-2 border-violet-500/30 pl-3 mb-3 bg-violet-500/[0.03] py-2 rounded-r">
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
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800">
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
      </div>

      {/* Generated email */}
      {generatedEmails[index] && (
        <div className="mt-3 bg-black border border-zinc-800 rounded-lg p-4 animate-slide-in-bottom">
          <p className="text-xs text-zinc-500 mb-1">Subject:</p>
          <p className="text-sm text-zinc-200 font-medium mb-3">{generatedEmails[index].subject}</p>
          <p className="text-xs text-zinc-500 mb-1">Body:</p>
          <p className="text-sm text-zinc-300 whitespace-pre-line">{generatedEmails[index].body}</p>
        </div>
      )}
    </div>
  );
}
