import {
  isFirstPartySource,
  isReputablePublisher,
  type ClassifiedSource,
} from "@/lib/hooks";

type SourceLike = Pick<
  ClassifiedSource,
  "url" | "tier" | "anchorScore" | "entity_hit_score" | "stale"
>;

export type RetrievalSourceType =
  | "first_party"
  | "trusted_news"
  | "semantic_web"
  | "fallback_web";

export type RetrievalPlan = {
  shouldRunPrimary: true;
  shouldRunNewsExpansion: boolean;
  shouldRunGenericFallback: boolean;
  preferredSourceOrder: RetrievalSourceType[];
  reasons: string[];
};

export type RetrievalSourceMix = {
  firstParty: number;
  trustedNews: number;
  semanticWeb: number;
  fallbackWeb: number;
};

export type RetrievalDiagnostics = {
  retrievalMode: "first_party" | "hybrid" | "web_only" | "empty";
  sourceMix: RetrievalSourceMix;
  newsExpansionUsed: boolean;
  fallbackUsed: boolean;
  recommendedNextPass: "none" | "news_expansion" | "generic_fallback";
  reasons: string[];
};

export function buildRetrievalPlan({
  targetDomain,
  hasIntentSignals,
  userProvidedUrl,
}: {
  targetDomain?: string | null;
  hasIntentSignals?: boolean;
  userProvidedUrl?: boolean;
}): RetrievalPlan {
  const reasons: string[] = [];

  if (userProvidedUrl) {
    reasons.push("user provided a specific URL, so first-party evidence should be prioritized");
  }
  if (targetDomain) {
    reasons.push("first-party and trusted-news sources should outrank generic web results");
  }
  if (hasIntentSignals) {
    reasons.push("intent signals are available to support trigger-specific retrieval");
  }

  return {
    shouldRunPrimary: true,
    shouldRunNewsExpansion: false,
    shouldRunGenericFallback: false,
    preferredSourceOrder: [
      "first_party",
      "trusted_news",
      "semantic_web",
      "fallback_web",
    ],
    reasons,
  };
}

export function classifyRetrievalSourceType(
  source: SourceLike,
  targetDomain?: string | null,
): RetrievalSourceType {
  if (targetDomain && isFirstPartySource(source.url, targetDomain)) {
    return "first_party";
  }
  if (isReputablePublisher(source.url)) {
    return "trusted_news";
  }
  if (
    source.tier === "A" ||
    source.tier === "B" ||
    (source.anchorScore ?? 0) >= 3 ||
    (source.entity_hit_score ?? 0) >= 1
  ) {
    return "semantic_web";
  }
  return "fallback_web";
}

export function scoreRetrievalSource(
  source: SourceLike,
  targetDomain?: string | null,
): number {
  const sourceType = classifyRetrievalSourceType(source, targetDomain);
  const typeWeight =
    sourceType === "first_party"
      ? 40
      : sourceType === "trusted_news"
        ? 30
        : sourceType === "semantic_web"
          ? 18
          : 8;
  const tierWeight =
    source.tier === "A" ? 14 : source.tier === "B" ? 8 : source.tier === "C" ? 0 : 0;
  const anchorWeight = Math.max(0, source.anchorScore ?? 0);
  const entityWeight = Math.max(0, source.entity_hit_score ?? 0) * 2;
  const freshnessPenalty = source.stale ? -6 : 0;

  return typeWeight + tierWeight + anchorWeight + entityWeight + freshnessPenalty;
}

export function prioritizeRetrievalSources<T extends SourceLike>(
  sources: T[],
  targetDomain?: string | null,
): T[] {
  return [...sources].sort((a, b) => {
    const scoreDiff = scoreRetrievalSource(b, targetDomain) - scoreRetrievalSource(a, targetDomain);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.anchorScore ?? 0) - (a.anchorScore ?? 0);
  });
}

export function buildRetrievalDiagnostics(
  sources: SourceLike[],
  options: {
    targetDomain?: string | null;
    lowSignal: boolean;
    hasAnchoredSources: boolean;
    recoveryAttempted?: boolean;
    newsExpansionAttempted?: boolean;
    usedCachedResult?: boolean;
  },
): RetrievalDiagnostics {
  const sourceMix = sources.reduce<RetrievalSourceMix>(
    (acc, source) => {
      const sourceType = classifyRetrievalSourceType(source, options.targetDomain);
      if (sourceType === "first_party") acc.firstParty += 1;
      else if (sourceType === "trusted_news") acc.trustedNews += 1;
      else if (sourceType === "semantic_web") acc.semanticWeb += 1;
      else acc.fallbackWeb += 1;
      return acc;
    },
    { firstParty: 0, trustedNews: 0, semanticWeb: 0, fallbackWeb: 0 },
  );

  const retrievalMode =
    sources.length === 0
      ? "empty"
      : sourceMix.firstParty > 0 && sourceMix.trustedNews === 0 && sourceMix.semanticWeb === 0 && sourceMix.fallbackWeb === 0
        ? "first_party"
        : sourceMix.firstParty > 0 || sourceMix.trustedNews > 0
          ? "hybrid"
          : "web_only";

  const reasons: string[] = [];
  if (options.usedCachedResult) {
    reasons.push("cached evidence was reused for this request");
  }
  if (sourceMix.firstParty > 0) {
    reasons.push(`${sourceMix.firstParty} first-party source${sourceMix.firstParty === 1 ? "" : "s"} contributed to retrieval`);
  }
  if (sourceMix.trustedNews > 0) {
    reasons.push(`${sourceMix.trustedNews} trusted news source${sourceMix.trustedNews === 1 ? "" : "s"} contributed to retrieval`);
  }
  if (options.lowSignal) {
    reasons.push("retrieval remained low-signal after the primary pass");
  }
  if (!options.hasAnchoredSources && sources.length > 0) {
    reasons.push("retrieval did not surface a strong anchored source");
  }
  if (options.recoveryAttempted) {
    reasons.push("first-party recovery was attempted during retrieval");
  }
  if (options.newsExpansionAttempted) {
    reasons.push("recent-news expansion was attempted to improve retrieval coverage");
  }

  const recommendedNextPass = options.lowSignal
    ? sourceMix.trustedNews === 0
      ? "news_expansion"
      : "generic_fallback"
    : "none";

  return {
    retrievalMode,
    sourceMix,
    newsExpansionUsed: Boolean(options.newsExpansionAttempted),
    fallbackUsed: Boolean(options.recoveryAttempted),
    recommendedNextPass,
    reasons,
  };
}
