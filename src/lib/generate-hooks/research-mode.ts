import {
  fetchSourcesWithGating,
  generateHookPayloadsFromSources,
  publishGate,
  type ClassifiedSource,
  type Hook,
  type IntentSignalInput,
  type MessagingStyle,
  type TargetRole,
} from "@/lib/hooks";
import { getHookSelectorPriors } from "@/lib/hook-feedback";
import { hasFeature, type TierId } from "@/lib/tiers";
import { researchIntentSignals } from "@/lib/intent";
import {
  buildRetrievalDiagnostics,
  buildRetrievalPlan,
  prioritizeRetrievalSources,
} from "@/lib/retrieval-plan";
import type { SenderContext } from "@/lib/workspace";

const INTENT_INLINE_WAIT_MS = 300;

function signalToTriggerType(type: string): string {
  switch (type) {
    case "funding": return "funding";
    case "tech_change": return "stat";
    case "hiring": return "hiring";
    case "growth": return "expansion";
    case "ipo": return "ipo";
    default: return "";
  }
}

function toIntentSignalInputs(
  signals: Awaited<ReturnType<typeof researchIntentSignals>>,
): IntentSignalInput[] {
  return signals
    .filter((signal) => signal.confidence >= 0.6 && signalToTriggerType(signal.type) !== "")
    .map((signal) => ({
      triggerType: signalToTriggerType(signal.type),
      summary: signal.summary,
      confidence: signal.confidence,
      sourceUrl: signal.sourceUrl,
      tier: signal.confidence >= 0.8 ? ("A" as const) : ("B" as const),
    }));
}

export type ResearchModeCitation = {
  source_title: string;
  publisher: string;
  date: string;
  url: string;
  tier: string;
  anchorScore?: number;
};

export type ResearchModeResult = {
  candidateHooks: Hook[];
  citations: ResearchModeCitation[];
  signalCount: number;
  isLowSignal: boolean;
  hasAnchored: boolean;
  tierACount: number;
  highConfidenceIntentCount: number;
  intentSignalsLength: number;
  sourceDiagnostics: Awaited<ReturnType<typeof fetchSourcesWithGating>>["_diagnostics"] | null;
  retrievalDiagnostics: ReturnType<typeof buildRetrievalDiagnostics>;
  selectorPriors?: Awaited<ReturnType<typeof getHookSelectorPriors>>;
  prefetchedSignals: Awaited<ReturnType<typeof researchIntentSignals>> | null;
  prefetchedSignalsPromise: Promise<Awaited<ReturnType<typeof researchIntentSignals>>> | null;
  timing: {
    sourceFetchMs: number;
    claudeMs: number;
    publishGateMs: number;
  };
};

export async function runResearchMode(opts: {
  url: string;
  companyDomain: string;
  companyName?: string;
  context?: string;
  targetRole?: TargetRole;
  customPain?: string;
  customPromise?: string;
  messagingStyle: MessagingStyle;
  traceId: string;
  exaApiKey: string;
  claudeApiKey: string;
  tierId: TierId;
  isDemo: boolean;
  sessionUserId?: string;
  senderContext?: SenderContext | null;
}): Promise<ResearchModeResult> {
  const retrievalPlan = buildRetrievalPlan({
    targetDomain: opts.companyDomain || null,
    hasIntentSignals: hasFeature(opts.tierId, "intentScoring"),
    userProvidedUrl: Boolean(opts.url),
  });

  const selectorPriors = !opts.isDemo && opts.sessionUserId
    ? await getHookSelectorPriors({
        userId: opts.sessionUserId,
        companyUrl: opts.url,
        targetRole: opts.targetRole ?? null,
      }).catch(() => undefined)
    : undefined;

  let prefetchedSignals: Awaited<ReturnType<typeof researchIntentSignals>> | null = null;
  let prefetchedSignalsPromise: Promise<Awaited<ReturnType<typeof researchIntentSignals>>> | null = null;

  let rawSignals: Awaited<ReturnType<typeof researchIntentSignals>> = [];
  let result: Awaited<ReturnType<typeof fetchSourcesWithGating>>;

  if (hasFeature(opts.tierId, "intentScoring")) {
    const apifyToken = process.env.APIFY_API_TOKEN;
    const linkedinSlug = opts.companyDomain ? opts.companyDomain.split(".")[0] : undefined;
    prefetchedSignalsPromise = researchIntentSignals(
      opts.url,
      opts.companyName || opts.companyDomain || "",
      opts.exaApiKey,
      opts.claudeApiKey,
    )
      .then((signals) => {
        prefetchedSignals = signals;
        return signals;
      })
      .catch(() => []);

    const sourceFetchStartedAt = Date.now();
    result = await fetchSourcesWithGating(opts.url, opts.exaApiKey, [], apifyToken, linkedinSlug);
    const sourceFetchMs = Date.now() - sourceFetchStartedAt;

    rawSignals = await Promise.race([
      prefetchedSignalsPromise,
      new Promise<Awaited<ReturnType<typeof researchIntentSignals>>>((resolve) => {
        setTimeout(() => resolve([]), INTENT_INLINE_WAIT_MS);
      }),
    ]);

    const promptSignals = toIntentSignalInputs(rawSignals);

    console.log("[generate-hooks] intent signal overlap", {
      traceId: opts.traceId,
      rawSignalsCount: rawSignals.length,
      promptSignalsCount: promptSignals.length,
      usedInlineIntent: rawSignals.length > 0,
    });

    return completeResearchMode({
      ...opts,
      retrievalPlan,
      selectorPriors,
      result,
      rawSignals,
      sourceFetchMs,
      prefetchedSignals,
      prefetchedSignalsPromise,
    });
  }

  const sourceFetchStartedAt = Date.now();
  result = await fetchSourcesWithGating(opts.url, opts.exaApiKey);
  const sourceFetchMs = Date.now() - sourceFetchStartedAt;

  return completeResearchMode({
    ...opts,
    retrievalPlan,
    selectorPriors,
    result,
    rawSignals,
    sourceFetchMs,
    prefetchedSignals,
    prefetchedSignalsPromise,
  });
}

async function completeResearchMode(opts: {
  url: string;
  companyDomain: string;
  companyName?: string;
  context?: string;
  targetRole?: TargetRole;
  customPain?: string;
  customPromise?: string;
  messagingStyle: MessagingStyle;
  traceId: string;
  claudeApiKey: string;
  senderContext?: SenderContext | null;
  retrievalPlan: ReturnType<typeof buildRetrievalPlan>;
  selectorPriors?: Awaited<ReturnType<typeof getHookSelectorPriors>>;
  result: Awaited<ReturnType<typeof fetchSourcesWithGating>>;
  rawSignals: Awaited<ReturnType<typeof researchIntentSignals>>;
  sourceFetchMs: number;
  prefetchedSignals: Awaited<ReturnType<typeof researchIntentSignals>> | null;
  prefetchedSignalsPromise: Promise<Awaited<ReturnType<typeof researchIntentSignals>>> | null;
}): Promise<ResearchModeResult> {
  const sources = prioritizeRetrievalSources(opts.result.sources, opts.companyDomain || null);
  let signalCount = opts.result.signalCount;
  const sourceDiagnostics = opts.result._diagnostics;

  const highConfidenceIntentCount = opts.rawSignals.filter((signal) => signal.confidence >= 0.8).length;
  const tierACount = sources.filter((source) => source.tier === "A").length;
  const intentSignalsLength = opts.rawSignals.length;
  signalCount += highConfidenceIntentCount;
  console.log("[threshold-fix] tierACount:", tierACount, "signalCount after intent injection:", signalCount);

  const isLowSignal = opts.result.lowSignal;
  const hasAnchored = opts.result.hasAnchoredSources;

  console.log("[generate-hooks] threshold check:", {
    traceId: opts.traceId,
    retrievalPlan: opts.retrievalPlan,
    signalCount,
    tierACount,
    highConfidenceIntentCount,
    intentSignalsLength,
    hasAnchored,
    lowSignalFromFetch: opts.result.lowSignal,
    isLowSignal,
    exactMath: "isLowSignal = tierACount < 1",
    tierBreakdown: sources.map((source) => ({ url: source.url, tier: source.tier, anchorScore: source.anchorScore })),
  });

  const retrievalDiagnostics = buildRetrievalDiagnostics(sources, {
    targetDomain: opts.companyDomain || null,
    lowSignal: opts.result.lowSignal,
    hasAnchoredSources: opts.result.hasAnchoredSources,
    recoveryAttempted: opts.result._diagnostics.recoveryAttempted,
    newsExpansionAttempted: opts.result._diagnostics.newsExpansionAttempted,
  });

  const citations = sources.map((source) => ({
    source_title: source.title,
    publisher: source.publisher,
    date: source.date,
    url: source.url,
    tier: source.tier,
    anchorScore: source.anchorScore,
  }));

  const usableSources = sources.filter((source) => source.tier !== "C");
  if (usableSources.length === 0) {
    return {
      candidateHooks: [],
      citations,
      signalCount,
      isLowSignal,
      hasAnchored,
      tierACount,
      highConfidenceIntentCount,
      intentSignalsLength,
      sourceDiagnostics,
      retrievalDiagnostics,
      selectorPriors: opts.selectorPriors,
      prefetchedSignals: opts.prefetchedSignals,
      prefetchedSignalsPromise: opts.prefetchedSignalsPromise,
      timing: {
        sourceFetchMs: opts.sourceFetchMs,
        claudeMs: 0,
        publishGateMs: 0,
      },
    };
  }

  const sourceLookup = new Map<number, ClassifiedSource>();
  usableSources.forEach((source, index) => sourceLookup.set(index + 1, source));

  const customPersona = opts.customPain && opts.customPromise
    ? { pain: opts.customPain, promise: opts.customPromise }
    : undefined;
  const promptSignals = toIntentSignalInputs(opts.rawSignals);

  console.log("[generate-hooks] intent signal mapping for prompt", {
    traceId: opts.traceId,
    promptSignalsCount: promptSignals.length,
    promptSignals: promptSignals.map((signal) => ({
      triggerType: signal.triggerType,
      confidence: signal.confidence,
      tier: signal.tier,
      sourceUrl: signal.sourceUrl,
    })),
  });

  const claudeStartedAt = Date.now();
  const { rawHooks } = await generateHookPayloadsFromSources({
    url: opts.url,
    sources,
    apiKey: opts.claudeApiKey,
    context: opts.context,
    senderContext: opts.senderContext,
    targetRole: opts.targetRole,
    customPersona,
    messagingStyle: opts.messagingStyle,
    intentSignals: promptSignals.length > 0 ? promptSignals : undefined,
    retrievalLibrary: opts.selectorPriors?.retrievalLibrary,
  });
  const claudeMs = Date.now() - claudeStartedAt;

  console.log("[generate-hooks] raw hooks from claude", {
    traceId: opts.traceId,
    rawHookCount: rawHooks.length,
    rawHooksPreview: rawHooks.slice(0, 5).map((hook) => ({
      news_item: hook.news_item,
      angle: hook.angle,
      confidence: hook.confidence,
      evidence_tier: hook.evidence_tier,
    })),
  });

  const publishGateStartedAt = Date.now();
  const candidateHooks = publishGate(rawHooks, sourceLookup, {
    includeMarketContext: false,
  }, opts.messagingStyle);
  const publishGateMs = Date.now() - publishGateStartedAt;

  console.log("[generate-hooks] candidate hooks after publishGate", {
    traceId: opts.traceId,
    candidateHookCount: candidateHooks.length,
  });

  return {
    candidateHooks,
    citations,
    signalCount,
    isLowSignal,
    hasAnchored,
    tierACount,
    highConfidenceIntentCount,
    intentSignalsLength,
    sourceDiagnostics,
    retrievalDiagnostics,
    selectorPriors: opts.selectorPriors,
    prefetchedSignals: opts.prefetchedSignals,
    prefetchedSignalsPromise: opts.prefetchedSignalsPromise,
    timing: {
      sourceFetchMs: opts.sourceFetchMs,
      claudeMs,
      publishGateMs,
    },
  };
}
