import {
  fetchUserProvidedSourceTurbo,
  generateHookPayloadsFromTrustedSource,
  type Hook,
  type MessagingStyle,
  type TargetRole,
} from "@/lib/hooks";
import type { SenderContext } from "@/lib/workspace";

export type FastUrlModeCitation = {
  source_title: string;
  publisher: string;
  date: string;
  url: string;
  tier: string;
  anchorScore?: number;
};

type FastUrlModeSuccess = {
  handled: true;
  success: true;
  candidateHooks: Hook[];
  citations: FastUrlModeCitation[];
  signalCount: number;
  tierACount: number;
  hasAnchored: boolean;
  isLowSignal: boolean;
  sourceFetchMs: number;
  claudeMs: number;
};

type FastUrlModeFailure = {
  handled: true;
  success: false;
  suggestion: string;
  sourceFetchMs: number;
};

type FastUrlModeSkipped = {
  handled: false;
};

export type FastUrlModeResult = FastUrlModeSuccess | FastUrlModeFailure | FastUrlModeSkipped;

export function shouldUseFastUrlMode(rawUrl: string | undefined, url: string): boolean {
  if (!rawUrl) return false;

  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.pathname.length > 1 && parsed.pathname !== "/";
  } catch {
    return false;
  }
}

export async function runFastUrlMode(opts: {
  rawUrl?: string;
  url: string;
  companyDomain: string;
  companyName?: string;
  context?: string;
  targetRole?: TargetRole;
  customPain?: string;
  customPromise?: string;
  messagingStyle: MessagingStyle;
  claudeApiKey: string;
  senderContext?: SenderContext | null;
  traceId: string;
}): Promise<FastUrlModeResult> {
  if (!shouldUseFastUrlMode(opts.rawUrl, opts.url)) {
    return { handled: false };
  }

  const sourceFetchStartedAt = Date.now();
  const userSrc = await fetchUserProvidedSourceTurbo(opts.url, opts.companyDomain, {
    companyNameHint: opts.companyName || undefined,
    minFacts: opts.companyName ? 1 : 2,
  }).catch(() => null);
  const sourceFetchMs = Date.now() - sourceFetchStartedAt;

  if (!userSrc) {
    console.log("[generate-hooks] userProvidedFastPath extraction_failed", {
      traceId: opts.traceId,
      url: opts.url,
    });
    return {
      handled: true,
      success: false,
      suggestion: "We couldn't extract enough proof from that page. Try a different article URL or use the company homepage for deeper research.",
      sourceFetchMs,
    };
  }

  console.log("[generate-hooks] userProvidedFastPath activated", {
    traceId: opts.traceId,
    url: opts.url,
    factCount: userSrc.facts.length,
  });

  const customPersona = opts.customPain && opts.customPromise
    ? { pain: opts.customPain, promise: opts.customPromise }
    : undefined;

  const claudeStartedAt = Date.now();
  const rawHooks = await generateHookPayloadsFromTrustedSource({
    url: opts.url,
    sources: [userSrc],
    apiKey: opts.claudeApiKey,
    context: opts.context,
    senderContext: opts.senderContext,
    targetRole: opts.targetRole,
    customPersona,
    messagingStyle: opts.messagingStyle,
  });
  const claudeMs = Date.now() - claudeStartedAt;

  const candidateHooks = rawHooks
    .filter((hook) => hook.hook && hook.hook.trim().length > 0 && hook.hook.length <= 600)
    .map((hook): Hook => ({
      news_item: hook.news_item ?? 1,
      angle: (["trigger", "risk", "tradeoff"].includes(hook.angle) ? hook.angle : "trigger") as Hook["angle"],
      hook: hook.hook.trim(),
      evidence_snippet: hook.evidence_snippet || userSrc.facts[0] || "",
      source_title: hook.source_title || userSrc.title,
      source_date: hook.source_date || "",
      source_url: hook.source_url || userSrc.url,
      evidence_tier: (["A", "B"].includes((hook.evidence_tier || "").toUpperCase()) ? (hook.evidence_tier || "").toUpperCase() : "A") as Hook["evidence_tier"],
      confidence: (["high", "med", "low"].includes(hook.confidence) ? hook.confidence : "med") as Hook["confidence"],
      psych_mode: hook.psych_mode as Hook["psych_mode"],
      why_this_works: hook.why_this_works,
      trigger_type: hook.trigger_type as Hook["trigger_type"],
      promise: hook.promise,
      bridge_quality: hook.bridge_quality,
      structural_variant: hook.structural_variant,
      buyer_tension: hook.buyer_tension,
      why_now: hook.why_now,
      affected_metric: hook.affected_metric,
      buyer_tension_id: hook.buyer_tension_id,
      tension_richness_score: hook.tension_richness_score,
      specificity_score: hook.specificity_score,
      interestingness_score: hook.interestingness_score,
    }));

  console.log("[generate-hooks] userProvidedFastPath result", {
    traceId: opts.traceId,
    rawHookCount: rawHooks.length,
    candidateHookCount: candidateHooks.length,
    factCount: userSrc.facts.length,
  });

  return {
    handled: true,
    success: true,
    candidateHooks,
    citations: [{
      source_title: userSrc.title,
      publisher: userSrc.publisher,
      date: userSrc.date,
      url: userSrc.url,
      tier: "A",
      anchorScore: 5,
    }],
    signalCount: 1,
    tierACount: 1,
    hasAnchored: true,
    isLowSignal: false,
    sourceFetchMs,
    claudeMs,
  };
}
