import {
  findRoleTokenHit,
  getDomain,
  getQualityLabel,
  publishGateFinal,
  rankAndCap,
  roleTokenGate,
  scoreHookQuality,
  validateHook,
  type Hook,
  type HookSelectorPriors,
  type MessagingStyle,
  type TargetRole,
} from "@/lib/hooks";

export function diagnosePublishGateFinalDrops(
  hooks: Hook[],
  companyDomain: string | undefined,
  targetRole: TargetRole | null,
  messagingStyle?: MessagingStyle,
): Array<{ idx: number; reason: string; news_item: number; source_url: string; angle: string; evidence_tier: string; roleTokenHit: string | null }> {
  const domainLower = (companyDomain || "").toLowerCase();
  const out: Array<{ idx: number; reason: string; news_item: number; source_url: string; angle: string; evidence_tier: string; roleTokenHit: string | null }> = [];

  hooks.forEach((hook, idx) => {
    let reason = "pass";

    if (domainLower && hook.source_url) {
      const sourceHost = getDomain(hook.source_url).toLowerCase();
      const isOnDomain = sourceHost === domainLower || sourceHost.endsWith(`.${domainLower}`);
      const titleOrSnippet = `${hook.source_title || ""} ${hook.evidence_snippet || ""}`.toLowerCase();
      const mentionsDomain = titleOrSnippet.includes(domainLower);
      const companyName = companyDomain ? new URL(`https://${domainLower}`).hostname.split(".")[0].toLowerCase() : "";
      const mentionsName = companyName.length > 3 && titleOrSnippet.includes(companyName);
      const anchored = isOnDomain || mentionsDomain || mentionsName;
      if (!anchored) reason = "drop:unanchored_source";
    }

    if (reason === "pass") {
      const validated = validateHook({
        news_item: hook.news_item,
        angle: hook.angle,
        hook: hook.hook,
        evidence_snippet: hook.evidence_snippet,
        source_title: hook.source_title,
        source_date: hook.source_date,
        source_url: hook.source_url,
        evidence_tier: hook.evidence_tier,
        confidence: hook.confidence,
        psych_mode: hook.psych_mode,
        why_this_works: hook.why_this_works,
      }, undefined, messagingStyle);
      if (!validated) reason = "drop:validateHook_failed";
    }

    out.push({
      idx,
      reason,
      news_item: hook.news_item,
      source_url: hook.source_url || "",
      angle: hook.angle,
      evidence_tier: hook.evidence_tier,
      roleTokenHit: targetRole ? findRoleTokenHit(hook.hook, targetRole) : null,
    });
  });

  return out;
}

export type FinalizeHooksResult = {
  gated: Hook[];
  roleGated: Hook[];
  roleGateDroppedAll: boolean;
  finalTop: Hook[];
  finalOverflow: Hook[];
  finalLowSignal: boolean;
  suggestion?: string;
  rankingMs: number;
  publishGateMs: number;
};

export function finalizeGeneratedHooks(opts: {
  candidateHooks: Hook[];
  companyDomain?: string;
  targetRole?: TargetRole | null;
  selectorPriors?: HookSelectorPriors;
  isFastPath: boolean;
  isLowSignal: boolean;
  hasAnchored: boolean;
  messagingStyle?: MessagingStyle;
}): FinalizeHooksResult {
  const publishGateStartedAt = Date.now();
  const gated = opts.isFastPath
    ? opts.candidateHooks
    : publishGateFinal(opts.candidateHooks, opts.companyDomain, { includeMarketContext: true }, opts.messagingStyle);
  const publishGateMs = Date.now() - publishGateStartedAt;

  const roleGated = roleTokenGate(gated, opts.targetRole ?? null);
  const roleGateDroppedAll = roleGated.length === 0 && gated.length > 0;
  const rankInput = roleGateDroppedAll ? gated : roleGated;

  const rankingStartedAt = Date.now();
  const { top, overflow } = rankAndCap(rankInput, 3, {
    targetRole: opts.targetRole ?? null,
    selectorPriors: opts.selectorPriors,
  });
  const rankingMs = Date.now() - rankingStartedAt;

  let finalTop = top;
  let finalOverflow = overflow;
  let suggestion: string | undefined;
  let finalLowSignal = opts.isLowSignal;

  if (!opts.hasAnchored) {
    finalLowSignal = true;
  } else if (opts.isLowSignal) {
    finalLowSignal = true;
  } else if (gated.length === 0) {
    finalTop = opts.candidateHooks.slice(0, 3).map((hook) => {
      const quality = scoreHookQuality(hook, opts.companyDomain);
      return { ...hook, evidence_tier: "B" as const, quality_score: quality, quality_label: getQualityLabel(quality) };
    });
    finalOverflow = [];
    finalLowSignal = true;
  }

  finalTop = finalTop
    .map((hook) => {
      const quality = scoreHookQuality(hook, opts.companyDomain);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
    })
    .sort((a, b) => (b.selector_score ?? b.ranking_score ?? b.quality_score ?? 0) - (a.selector_score ?? a.ranking_score ?? a.quality_score ?? 0));

  finalOverflow = finalOverflow
    .map((hook) => {
      const quality = scoreHookQuality(hook, opts.companyDomain);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
    })
    .sort((a, b) => (b.selector_score ?? b.ranking_score ?? b.quality_score ?? 0) - (a.selector_score ?? a.ranking_score ?? a.quality_score ?? 0));

  return {
    gated,
    roleGated,
    roleGateDroppedAll,
    finalTop,
    finalOverflow,
    finalLowSignal,
    suggestion,
    rankingMs,
    publishGateMs,
  };
}
