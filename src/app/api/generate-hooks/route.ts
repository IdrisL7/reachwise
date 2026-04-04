import * as Sentry from "@sentry/nextjs";
import { NextResponse, after } from "next/server";
import {
  fetchSourcesWithGating,
  fetchUserProvidedSourceTurbo,
  generateHookPayloadsFromTrustedSource,
  generateHookPayloadsFromSources,
  getProviderFacingErrorMessage,
  publishGate,
  publishGateFinal,
  roleTokenGate,
  rankAndCap,
  validateHook,
  findRoleTokenHit,
  resolveCompanyByName,
  getDomain,
  isFirstPartySource,
  isReputablePublisher,
  generateChannelVariants,
  scoreHookQuality,
  getQualityLabel,
  type CompanyResolutionResult,
  type ClassifiedSource,
  type Hook,
  type TargetRole,
  type IntentSignalInput,
  type MessagingStyle,
  TARGET_ROLES,
} from "@/lib/hooks";
import type { CompanyResolutionStatus } from "@/lib/types";
import { getCachedHooks, setCachedHooks, RULES_VERSION } from "@/lib/hook-cache";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";
import { getCompanyIntelligence } from "@/lib/company-intel";
import { auth } from "@/lib/auth";
import { resolveWorkspaceId, getWorkspaceProfile, getProfileUpdatedAt } from "@/lib/workspace-helpers";
import { checkHookQuota, incrementHookUsage, tierError } from "@/lib/tier-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { db, schema } from "@/lib/db";
import { getClaudeApiKey } from "@/lib/env";
import { getHookSelectorPriors } from "@/lib/hook-feedback";
import { hasFeature } from "@/lib/tiers";
import {
  ensureAccountV2,
  inferSourceTypeForV2,
  persistHookMessagesV2,
  persistSignalsV2,
} from "@/lib/v2-dual-write";
import {
  buildRetrievalDiagnostics,
  buildRetrievalPlan,
  prioritizeRetrievalSources,
} from "@/lib/retrieval-plan";

// ---------------------------------------------------------------------------
// Enforce current tier rules on citations (works on both cached and fresh)
// ---------------------------------------------------------------------------
type Citation = { source_title: string; publisher: string; date: string; url: string; tier: string; anchorScore?: number };

function summarizeSelectorRetrievalPreferences(selectorPriors?: Awaited<ReturnType<typeof getHookSelectorPriors>>) {
  const topSourcePreferences = Object.entries(selectorPriors?.sourceTypeBoosts ?? {})
    .map(([sourceType, adjustment]) => ({
      sourceType: sourceType as "first_party" | "trusted_news" | "semantic_web" | "fallback_web",
      adjustment: adjustment ?? 0,
      pinned: selectorPriors?.pinnedSourceTypes?.[sourceType as "first_party" | "trusted_news" | "semantic_web" | "fallback_web"] ?? false,
    }))
    .sort((a, b) => b.adjustment - a.adjustment)
    .slice(0, 4);

  const topTriggerPreferences = Object.entries(selectorPriors?.triggerSourceTypeBoosts ?? {})
    .flatMap(([triggerType, boosts]) =>
      Object.entries(boosts ?? {}).map(([sourceType, adjustment]) => ({
        triggerType,
        sourceType: sourceType as "first_party" | "trusted_news" | "semantic_web" | "fallback_web",
        adjustment: adjustment ?? 0,
        pinned: selectorPriors?.pinnedTriggerSourceTypes?.[triggerType]?.[sourceType as "first_party" | "trusted_news" | "semantic_web" | "fallback_web"] ?? false,
      })),
    )
    .sort((a, b) => b.adjustment - a.adjustment)
    .slice(0, 6);

  return {
    topSourcePreferences,
    topTriggerPreferences,
  };
}

function enforceCitationTiers(citations: Citation[], companyDomain: string): Citation[] {
  return citations.map((c) => {
    if (c.tier !== "A") return c;
    const firstParty = isFirstPartySource(c.url, companyDomain);
    const reputable = isReputablePublisher(c.url);
    if (!firstParty && !reputable) {
      return { ...c, tier: "B" };
    }
    return c;
  });
}

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

const INTENT_INLINE_WAIT_MS = 300;

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

function diagnosePublishGateFinalDrops(
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
      const isOnDomain = sourceHost === domainLower || sourceHost.endsWith("." + domainLower);
      const titleOrSnippet = ((hook.source_title || "") + " " + (hook.evidence_snippet || "")).toLowerCase();
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const requestStartedAt = Date.now();
    const body = (await request.json().catch(() => null)) as {
      url?: string;
      companyName?: string;
      context?: string;
      targetRole?: string;
      customPain?: string;
      customPromise?: string;
      messagingStyle?: MessagingStyle;
    } | null;

    const rawUrl = body?.url?.trim();
    const companyName = body?.companyName?.trim();
    const context = body?.context?.trim();
    const targetRole: TargetRole | undefined =
      body?.targetRole && TARGET_ROLES.includes(body.targetRole as TargetRole)
        ? (body.targetRole as TargetRole)
        : undefined;
    const customPain = body?.customPain?.trim();
    const customPromise = body?.customPromise?.trim();
    const VALID_MESSAGING_STYLES: MessagingStyle[] = ["evidence", "challenger", "implication", "risk"];
    const messagingStyle: MessagingStyle =
      body?.messagingStyle && VALID_MESSAGING_STYLES.includes(body.messagingStyle)
        ? body.messagingStyle
        : "evidence";

    const traceId = crypto.randomUUID().slice(0, 8);
    const timing = {
      cacheLookupMs: 0,
      resolutionMs: 0,
      sourceFetchMs: 0,
      claudeMs: 0,
      publishGateMs: 0,
      rankingMs: 0,
      persistMs: 0,
      backgroundIntentMs: 0,
      backgroundIntelMs: 0,
    };
    console.log("[generate-hooks] request start", {
      traceId,
      rawUrl,
      companyName,
      contextLength: context?.length ?? 0,
      targetRole: targetRole ?? "General",
      hasCustomPain: !!customPain,
      hasCustomPromise: !!customPromise,
    });

    // Validate URL format
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
        if (!parsed.hostname.includes(".")) {
          return NextResponse.json(
            { error: "Invalid URL: must be a valid domain (e.g., https://acme.com)." },
            { status: 400 },
          );
        }

        // LinkedIn posts feed detection — these are inaccessible to automated fetchers
        if (
          parsed.hostname.includes("linkedin.com") &&
          /\/company\/[^/]+\/posts\b/i.test(parsed.pathname)
        ) {
          const slug = parsed.pathname.match(/\/company\/([^/]+)/)?.[1] || "";
          return NextResponse.json({
            hooks: [],
            structured_hooks: [],
            overflow_hooks: [],
            status: "ok" as CompanyResolutionStatus,
            lowSignal: true,
            linkedinSlug: slug || undefined,
            suggestion: "LinkedIn posts feeds are restricted — we can't extract evidence from them.",
          });
        }
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format. Provide a valid company URL (e.g., https://acme.com)." },
          { status: 400 },
        );
      }
    }

    const exaApiKey = process.env.EXA_API_KEY;
    const claudeApiKey = getClaudeApiKey();

    if (!rawUrl && !companyName) {
      return NextResponse.json(
        { error: "Provide either 'url' or 'companyName' in request body." },
        { status: 400 },
      );
    }

    if (!exaApiKey || !claudeApiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: missing API keys. Please contact support." },
        { status: 500 },
      );
    }

    // Internal API key bypass (used by n8n / cron automations)
    const internalKey = request.headers.get("x-api-key");
    const pipelineKey = process.env.PIPELINE_API_KEY;
    const isPipelineKey = !!(pipelineKey && request.headers.get("authorization") === `Bearer ${pipelineKey}`);
    const isInternalCall = isPipelineKey || !!(internalKey && internalKey === process.env.CRON_SECRET);

    // Auth — allow unauthenticated demo (3 per day per IP)
    const session = isInternalCall ? null : await auth();
    const isDemo = !isInternalCall && !session?.user?.id;

    if (isInternalCall) {
      // skip: rate limit, quota, session enforcement
    } else if (isDemo) {
      const demoLimited = await checkRateLimit(getClientIp(request), "demo:hooks");
      if (demoLimited) return demoLimited;
    } else {
      const rateLimited = await checkRateLimit(getClientIp(request), "auth:hooks");
      if (rateLimited) return rateLimited;

      // Quota check (trial + monthly limit)
      const quotaError = await checkHookQuota(session!.user!.id);
      if (quotaError) return quotaError;
    }

    // Resolve workspace profile for cache busting (skip for demo and internal)
    let profileUpdatedAt: string | null = null;
    let _senderContext: Awaited<ReturnType<typeof getWorkspaceProfile>> = null;
    if (!isDemo && !isInternalCall) {
      try {
        const workspaceId = await resolveWorkspaceId(session!.user!.id);
        [_senderContext, profileUpdatedAt] = await Promise.all([
          getWorkspaceProfile(workspaceId),
          getProfileUpdatedAt(workspaceId),
        ]);
      } catch {
        // Non-critical — continue without profile context
      }
    }

    let url = rawUrl;
    let resolution: CompanyResolutionResult | null = null;

    if (!url && companyName) {
      const resolutionStartedAt = Date.now();
      resolution = await resolveCompanyByName(companyName, exaApiKey);
      timing.resolutionMs = Date.now() - resolutionStartedAt;

      if (resolution.status === "no_match") {
        return NextResponse.json({
          hooks: [],
          status: resolution.status as CompanyResolutionStatus,
          companyName: resolution.companyName,
          candidates: resolution.candidates,
        });
      }

      if (resolution.status === "needs_disambiguation") {
        return NextResponse.json({
          hooks: [],
          status: resolution.status as CompanyResolutionStatus,
          companyName: resolution.companyName,
          candidates: resolution.candidates,
        });
      }

      const firstCandidate = resolution.candidates[0];
      url = firstCandidate?.url;
    }

    if (!url) {
      return NextResponse.json(
        { error: "Unable to determine company URL from request." },
        { status: 400 },
      );
    }

    const companyDomain = getDomain(url);
    const tierId = isDemo ? "free" : ((session?.user as any)?.tierId || "free");

    // Check cache first (keyed by URL + targetRole)
    let candidateHooks: Hook[] | null = null;
    let prefetchedSignals: Awaited<ReturnType<typeof researchIntentSignals>> | null = null;
    let prefetchedSignalsPromise: Promise<Awaited<ReturnType<typeof researchIntentSignals>>> | null = null;
    let citations: Citation[] = [];
    let isLowSignal = false;
    let signalCount = 0;
    let hasAnchored = true;
    let tierACount = 0;
    let highConfidenceIntentCount = 0;
    let intentSignalsLength = 0;
    let cached = false;
    let cacheStale = false;
    let isFastPath = false;
    let retrievalDiagnostics = buildRetrievalDiagnostics([], {
      targetDomain: companyDomain || null,
      lowSignal: false,
      hasAnchoredSources: false,
    });

    try {
      const cacheLookupStartedAt = Date.now();
      const cachedResult = await getCachedHooks(url, profileUpdatedAt, targetRole, messagingStyle);
      timing.cacheLookupMs = Date.now() - cacheLookupStartedAt;
      if (cachedResult) {
        // Check rules_version — if stale, treat as cache miss and regenerate fresh
        if (cachedResult.rulesVersion !== RULES_VERSION) {
          cacheStale = true;
          // Do NOT use stale hooks: old versions lack the 4-part structure (no "?"),
          // causing publishGateFinal to drop all hooks and show a false low-signal error.
        } else {
          candidateHooks = cachedResult.hooks as Hook[];
          citations = (cachedResult.citations || []) as Citation[];
          cached = true;
          // Restore signal counts from cached citations so threshold check works correctly.
          // Without this, signalCount and tierACount stay at 0 and isLowSignal always fires.
          tierACount = citations.filter((c) => c.tier === "A").length;
          signalCount = tierACount;
          hasAnchored = tierACount > 0;
        }
      }
    } catch {
      // Cache miss or error — continue to generate
    }

    let selectorPriors: Awaited<ReturnType<typeof getHookSelectorPriors>> | undefined;
    let retrievalPreferenceSummary: ReturnType<typeof summarizeSelectorRetrievalPreferences> | undefined;

    let sourceDiagnostics: Awaited<ReturnType<typeof fetchSourcesWithGating>>["_diagnostics"] | null = null;

    if (!candidateHooks) {
      try {
        const retrievalPlan = buildRetrievalPlan({
          targetDomain: companyDomain || null,
          hasIntentSignals: hasFeature(tierId, "intentScoring"),
          userProvidedUrl: Boolean(rawUrl),
        });
        // -----------------------------------------------------------------------
        // USER-PROVIDED SUBPAGE FAST PATH
        // When the user explicitly provides a subpage URL (e.g. hubspot.com/startups/partners),
        // bypass all tier/signal gating. Fetch the page directly, treat it as Tier A,
        // and call Claude. The auto-discovery pipeline only runs if no subpage or fetch fails.
        // -----------------------------------------------------------------------
        let usedFastPath = false;
        try {
          const parsedInput = new URL(url.startsWith("http") ? url : `https://${url}`);
          const hasSubpath = parsedInput.pathname.length > 1 && parsedInput.pathname !== "/";

          if (rawUrl && hasSubpath) {
            const sourceFetchStartedAt = Date.now();
            const userSrc = await fetchUserProvidedSourceTurbo(url, companyDomain, {
              companyNameHint: companyName || undefined,
              minFacts: companyName ? 1 : 2,
            }).catch(() => null);
            timing.sourceFetchMs = Date.now() - sourceFetchStartedAt;

            if (userSrc) {
              console.log("[generate-hooks] userProvidedFastPath activated", { traceId, url, factCount: userSrc.facts.length });
              const customPersona = customPain && customPromise ? { pain: customPain, promise: customPromise } : undefined;
              const claudeStartedAt = Date.now();
              const rawHooks = await generateHookPayloadsFromTrustedSource({
                url,
                sources: [userSrc],
                apiKey: claudeApiKey,
                context,
                senderContext: _senderContext,
                targetRole,
                customPersona,
                messagingStyle,
              });
              timing.claudeMs = Date.now() - claudeStartedAt;

              // Bypass publishGate (which calls validateHook with strict rules designed for
              // auto-discovered noise). User-provided sources are trusted — convert directly.
              candidateHooks = rawHooks
                .filter((h) => h.hook && h.hook.trim().length > 0 && h.hook.length <= 600)
                .map((h): Hook => ({
                  news_item: h.news_item ?? 1,
                  angle: (["trigger", "risk", "tradeoff"].includes(h.angle) ? h.angle : "trigger") as Hook["angle"],
                  hook: h.hook.trim(),
                  evidence_snippet: h.evidence_snippet || userSrc.facts[0] || "",
                  source_title: h.source_title || userSrc.title,
                  source_date: h.source_date || "",
                  source_url: h.source_url || userSrc.url,
                  evidence_tier: (["A", "B"].includes((h.evidence_tier || "").toUpperCase()) ? (h.evidence_tier || "").toUpperCase() : "A") as Hook["evidence_tier"],
                  confidence: (["high", "med", "low"].includes(h.confidence) ? h.confidence : "med") as Hook["confidence"],
                  psych_mode: h.psych_mode as Hook["psych_mode"],
                  why_this_works: h.why_this_works,
                  trigger_type: h.trigger_type as Hook["trigger_type"],
                  promise: h.promise,
                  bridge_quality: h.bridge_quality,
                }));

              citations = [{
                source_title: userSrc.title,
                publisher: userSrc.publisher,
                date: userSrc.date,
                url: userSrc.url,
                tier: "A",
                anchorScore: 5,
              }];
              isLowSignal = false;
              hasAnchored = true;
              tierACount = 1;
              signalCount = 1;
              isFastPath = true;
              usedFastPath = true;

              console.log("[generate-hooks] userProvidedFastPath result", {
                traceId,
                rawHookCount: rawHooks.length,
                candidateHookCount: candidateHooks.length,
                factCount: userSrc.facts.length,
              });
            } else {
              console.log("[generate-hooks] userProvidedFastPath extraction_failed", { traceId, url });
              return NextResponse.json({
                hooks: [],
                structured_hooks: [],
                overflow_hooks: [],
                status: "ok" as CompanyResolutionStatus,
                lowSignal: true,
                suggestion: "We couldn't extract enough proof from that page. Try a different article URL or use the company homepage for deeper research.",
                timings: {
                  totalMs: Date.now() - requestStartedAt,
                  sourceFetchMs: timing.sourceFetchMs,
                },
              });
            }
          }
        } catch { /* URL parse error — skip fast path */ }

        if (!usedFastPath) {
        selectorPriors = !isDemo && session?.user?.id
          ? await getHookSelectorPriors({
              userId: session.user.id,
              companyUrl: url!,
              targetRole: targetRole ?? null,
            }).catch(() => undefined)
          : undefined;
        retrievalPreferenceSummary = summarizeSelectorRetrievalPreferences(selectorPriors);
        // 1. Gather and classify sources with signal gating + anchor scoring
        let rawSignals: Awaited<ReturnType<typeof researchIntentSignals>> = [];
        let result: Awaited<ReturnType<typeof fetchSourcesWithGating>>;
        if (hasFeature(tierId, "intentScoring")) {
          const apifyToken = process.env.APIFY_API_TOKEN;
          const linkedinSlug = companyDomain ? companyDomain.split(".")[0] : undefined;
          prefetchedSignalsPromise = researchIntentSignals(
            url,
            companyName || companyDomain || "",
            exaApiKey!,
            claudeApiKey,
          )
            .then((signals) => {
              prefetchedSignals = signals;
              return signals;
            })
            .catch(() => []);

          const sourceFetchStartedAt = Date.now();
          result = await fetchSourcesWithGating(url, exaApiKey!, [], apifyToken, linkedinSlug);
          timing.sourceFetchMs = Date.now() - sourceFetchStartedAt;

          rawSignals = await Promise.race([
            prefetchedSignalsPromise,
            new Promise<Awaited<ReturnType<typeof researchIntentSignals>>>((resolve) => {
              setTimeout(() => resolve([]), INTENT_INLINE_WAIT_MS);
            }),
          ]);

          const promptSignals = toIntentSignalInputs(rawSignals);

          console.log("[generate-hooks] intent signal overlap", {
            traceId,
            rawSignalsCount: rawSignals.length,
            promptSignalsCount: promptSignals.length,
            usedInlineIntent: rawSignals.length > 0,
          });
        } else {
          const sourceFetchStartedAt = Date.now();
          result = await fetchSourcesWithGating(url, exaApiKey!);
          timing.sourceFetchMs = Date.now() - sourceFetchStartedAt;
        }
        const sources = prioritizeRetrievalSources(result.sources, companyDomain || null);
        signalCount = result.signalCount;
        sourceDiagnostics = result._diagnostics;

        highConfidenceIntentCount = rawSignals.filter((s) => s.confidence >= 0.8).length;
        tierACount = sources.filter((s) => s.tier === "A").length;
        intentSignalsLength = rawSignals.length;
        // Inject high-confidence intent signals into signalCount BEFORE threshold check
        signalCount += rawSignals.filter((s) => s.confidence >= 0.8).length;
        console.log('[threshold-fix] tierACount:', tierACount, 'signalCount after intent injection:', signalCount);
        isLowSignal = result.lowSignal; // RV18: respect hasUserProvidedSignal bypass from fetchSourcesWithGating
        hasAnchored = result.hasAnchoredSources;

        console.log("[generate-hooks] threshold check:", {
          traceId,
          retrievalPlan,
          signalCount,
          tierACount,
          highConfidenceIntentCount,
          intentSignalsLength,
          hasAnchored,
          lowSignalFromFetch: result.lowSignal,
          isLowSignal,
          exactMath: "isLowSignal = tierACount < 1",
          tierBreakdown: sources.map((s) => ({ url: s.url, tier: s.tier, anchorScore: s.anchorScore })),
        });

        retrievalDiagnostics = buildRetrievalDiagnostics(sources, {
          targetDomain: companyDomain || null,
          lowSignal: result.lowSignal,
          hasAnchoredSources: result.hasAnchoredSources,
          recoveryAttempted: result._diagnostics.recoveryAttempted,
          newsExpansionAttempted: result._diagnostics.newsExpansionAttempted,
        });

        citations = sources.map((s) => ({
          source_title: s.title,
          publisher: s.publisher,
          date: s.date,
          url: s.url,
          tier: s.tier,
          anchorScore: s.anchorScore,
        }));

        // 2. Check if all sources are Tier C (insufficient evidence)
        const usableSources = sources.filter((s) => s.tier !== "C");
        if (usableSources.length === 0) {
          candidateHooks = [];
        } else {
          // 3. Build source lookup for validation
          const sourceLookup = new Map<number, ClassifiedSource>();
          usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

          // 4. Build prompts and call Claude
          const customPersona = customPain && customPromise ? { pain: customPain, promise: customPromise } : undefined;
          const promptSignals = toIntentSignalInputs(rawSignals);

          console.log("[generate-hooks] intent signal mapping for prompt", {
            traceId,
            promptSignalsCount: promptSignals.length,
            promptSignals: promptSignals.map((s) => ({ triggerType: s.triggerType, confidence: s.confidence, tier: s.tier, sourceUrl: s.sourceUrl })),
          });

          const claudeStartedAt = Date.now();
          const { rawHooks } = await generateHookPayloadsFromSources({
            url,
            sources,
            apiKey: claudeApiKey,
            context,
            senderContext: _senderContext,
            targetRole,
            customPersona,
            messagingStyle,
            intentSignals: promptSignals.length > 0 ? promptSignals : undefined,
            retrievalLibrary: selectorPriors?.retrievalLibrary,
          });
          timing.claudeMs = Date.now() - claudeStartedAt;

          console.log("[generate-hooks] raw hooks from claude", {
            traceId,
            rawHookCount: rawHooks.length,
            rawHooksPreview: rawHooks.slice(0, 5).map((h) => ({ news_item: h.news_item, angle: h.angle, confidence: h.confidence, evidence_tier: h.evidence_tier })),
          });

          // 5. First pass: publishGate with source lookup (anchored-source filtering)
          const publishGateStartedAt = Date.now();
          candidateHooks = publishGate(rawHooks, sourceLookup, {
            includeMarketContext: false,
          }, messagingStyle);
          timing.publishGateMs = Date.now() - publishGateStartedAt;

          console.log("[generate-hooks] candidate hooks after publishGate", {
            traceId,
            candidateHookCount: candidateHooks.length,
          });
        }
        } // end if (!usedFastPath)
      } catch (error) {
        console.error("generate-hooks: Error during external calls", error);
        const providerError = getProviderFacingErrorMessage(error);
        return NextResponse.json({
          hooks: [],
          structured_hooks: [],
          status: "ok" as CompanyResolutionStatus,
          lowSignal: true,
          suggestion: providerError.message,
          code: providerError.code,
        });
      }
    }

    // =========================================================================
    // ENFORCE TIER RULES ON CITATIONS — always, regardless of cache
    // Non-first-party + non-reputable Tier A → Tier B
    // =========================================================================
    if (companyDomain) {
      citations = enforceCitationTiers(citations, companyDomain);
    }

    if (citations.length > 0) {
      retrievalDiagnostics = buildRetrievalDiagnostics(
        citations.map((citation) => ({
          url: citation.url,
          tier: citation.tier as ClassifiedSource["tier"],
          anchorScore: citation.anchorScore,
          entity_hit_score: undefined,
          stale: false,
        })),
        {
          targetDomain: companyDomain || null,
          lowSignal: isLowSignal,
          hasAnchoredSources: hasAnchored,
          recoveryAttempted: sourceDiagnostics?.recoveryAttempted,
          newsExpansionAttempted: sourceDiagnostics?.newsExpansionAttempted,
          usedCachedResult: cached,
        },
      );
    }

    // Also enforce tiers on hook evidence_tier fields (cached hooks may have stale tiers)
    candidateHooks = (candidateHooks ?? []).map((h) => {
      if (h.evidence_tier !== "A") return h;
      if (!h.source_url || !companyDomain) return h;
      const firstParty = isFirstPartySource(h.source_url, companyDomain);
      const reputable = isReputablePublisher(h.source_url);
      if (!firstParty && !reputable) {
        return { ...h, evidence_tier: "B" as const };
      }
      return h;
    });

    // =========================================================================
    // PUBLISH GATE FINAL — runs on ALL hooks (cached or fresh) right before return.
    // Rule A: change verbs without proof → rewrite or drop
    // Rule B: unanchored sources → drop (include_market_context=false)
    // Rule C: forced-choice question → drop if missing
    // Rule D: Tier B cap at 1
    // Rule E: tradeoff grounding (inside validateHook)
    // =========================================================================
    console.log("[generate-hooks] pre publishGateFinal", {
      traceId,
      candidateHooksCount: candidateHooks.length,
      candidateHooksPreview: candidateHooks.slice(0, 10).map((h) => ({
        news_item: h.news_item,
        angle: h.angle,
        evidence_tier: h.evidence_tier,
        confidence: h.confidence,
        source_url: h.source_url,
      })),
    });

    const publishGateFinalStartedAt = Date.now();
    const publishDiagnostics = diagnosePublishGateFinalDrops(candidateHooks, companyDomain || undefined, targetRole ?? null, messagingStyle);
    console.log("[generate-hooks] publishGateFinal diagnostics", {
      traceId,
      diagnostics: publishDiagnostics,
      droppedAtDiagnosticStage: publishDiagnostics.filter((d) => d.reason !== "pass").length,
    });

    // Fast path: user vouched for the source — skip validateHook inside publishGateFinal.
    // Only keep the unanchored-source check (Rule B), which already passes since source
    // URL is on the company domain.
    const gated = isFastPath ? candidateHooks : publishGateFinal(candidateHooks, companyDomain, {
      includeMarketContext: true,
    }, messagingStyle);
    timing.publishGateMs += Date.now() - publishGateFinalStartedAt;

    console.log("[generate-hooks] after publishGateFinal", {
      traceId,
      gatedCount: gated.length,
      droppedByPublishGateFinal: candidateHooks.length - gated.length,
      gatedHooksPreview: gated.slice(0, 10).map((h) => ({ news_item: h.news_item, angle: h.angle, evidence_tier: h.evidence_tier, source_url: h.source_url })),
    });

    // =========================================================================
    // ROLE TOKEN GATE — enforce persona framing (skip for General)
    // =========================================================================
    const roleGated = roleTokenGate(gated, targetRole ?? null);
    const roleGateDroppedAll = roleGated.length === 0 && gated.length > 0;
    const rankInput = roleGateDroppedAll ? gated : roleGated;

    console.log("[generate-hooks] role gate decision", {
      traceId,
      targetRole: targetRole ?? "General",
      gatedCount: gated.length,
      roleGatedCount: roleGated.length,
      roleGateDroppedAll,
      roleTokenHits: gated.map((h) => ({ news_item: h.news_item, hit: (targetRole ? findRoleTokenHit(h.hook, targetRole) : null) })),
    });

    if (roleGateDroppedAll) {
      console.warn("[generate-hooks] role token gate removed all hooks, falling back to publish-gated hooks", {
        traceId,
        targetRole: targetRole ?? "General",
        gatedCount: gated.length,
        roleGatedCount: roleGated.length,
      });
    }

    // =========================================================================
    // RANK + CAP — score and return top 3 (overflow available via showAll)
    // =========================================================================
    const rankingStartedAt = Date.now();
    const { top, overflow } = rankAndCap(rankInput, 3, {
      targetRole: targetRole ?? null,
      selectorPriors,
    });
    timing.rankingMs = Date.now() - rankingStartedAt;

    // Build suggestions — short headline, details handled by UI
    const noAnchorSuggestion = "We couldn't confirm these sources are specifically about this company. Paste a URL directly from their press page or newsroom — that gives us verified content to write from.";
    const lowSignalSuggestion = "We found this company but couldn't find enough recent news to write a strong, evidence-backed hook. Paste a URL from their press page, newsroom, or a recent announcement to continue.";

    // Determine final hook list + metadata
    let finalTop = top;
    let finalOverflow = overflow;
    let suggestion: string | undefined;
    let finalLowSignal = isLowSignal;

    console.log("[generate-hooks] suggestion gate pre-check:", {
      traceId,
      tierACount,
      signalCount,
      lowSignal: isLowSignal,
      intentSignalsLength,
      highConfidenceIntentCount,
      hasAnchored,
      gatedCount: gated.length,
      roleGatedCount: roleGated.length,
      roleGateDroppedAll,
      topCount: top.length,
      conditions: {
        noAnchored: !hasAnchored,
        isLowSignal,
        noHooksAfterPublish: gated.length === 0,
      },
    });

    if (!hasAnchored) {
      console.log("[generate-hooks] low signal: no anchored sources — showing hooks with low signal badge");
      // Do NOT cap hooks or show the blocking suggestion.
      // lowSignal badge communicates quality instead.
      finalLowSignal = true;
    } else if (isLowSignal) {
      // Show all hooks — just flag as low signal so the badge renders
      finalLowSignal = true;
    } else if (gated.length === 0) {
      // No hooks survived publish gate — fall back to candidateHooks with lowered quality
      // (avoids blank screen when all hooks were dropped by anchor check)
      console.log("[generate-hooks] no hooks survived publish gate — falling back to candidateHooks");
      finalTop = candidateHooks.slice(0, 3).map((hook) => {
        const quality = scoreHookQuality(hook, companyDomain || undefined);
        return { ...hook, evidence_tier: "B" as const, quality_score: quality, quality_label: getQualityLabel(quality) };
      });
      finalOverflow = [];
      finalLowSignal = true;
    }

    finalTop = finalTop.map((hook) => {
      const quality = scoreHookQuality(hook, companyDomain || undefined);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
    }).sort((a, b) => (b.selector_score ?? b.ranking_score ?? b.quality_score ?? 0) - (a.selector_score ?? a.ranking_score ?? a.quality_score ?? 0));

    finalOverflow = finalOverflow.map((hook) => {
      const quality = scoreHookQuality(hook, companyDomain || undefined);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
    }).sort((a, b) => (b.selector_score ?? b.ranking_score ?? b.quality_score ?? 0) - (a.selector_score ?? a.ranking_score ?? a.quality_score ?? 0));

    const resolvedCompany = resolution && resolution.candidates[0]
      ? {
          id: resolution.candidates[0].id,
          name: resolution.candidates[0].name,
          url: resolution.candidates[0].url,
          description: resolution.candidates[0].description,
          source: resolution.candidates[0].source,
        }
      : null;

    // Cache hooks for next time:
    // - Fresh results: always cache
    // - Stale cached results (wrong rules_version): re-cache with corrected payload
    // Generate multi-channel variants for Pro
    let hookVariants: Array<{ hook_index: number; variants: Array<{ channel: string; text: string }> }> = [];

    if (roleGated.length > 0 && (!cached || cacheStale)) {
      // Generate variants for Pro before caching
      if (hasFeature(tierId, "multiChannel")) {
        try {
          const withVars = await generateChannelVariants(roleGated, claudeApiKey, targetRole);
          hookVariants = withVars.map((h, i) => ({ hook_index: i, variants: h.variants }));
        } catch {}
      }
      setCachedHooks(url, roleGated, citations, profileUpdatedAt, targetRole, hookVariants.length > 0 ? hookVariants : undefined, messagingStyle).catch(() => {});
    } else if (cached && hasFeature(tierId, "multiChannel")) {
      // Load variants from cache
      try {
        const cr = await getCachedHooks(url!, profileUpdatedAt, targetRole, messagingStyle);
        if (cr?.variants) hookVariants = cr.variants as typeof hookVariants;
      } catch {}
    }

    // Split discovered URLs into first-party and web results
    const allDiscovered = citations
      .filter((c) => c.tier !== "C" && c.url)
      .map((c) => ({ title: c.source_title, url: c.url, tier: c.tier }))
      .filter((v, i, arr) => arr.findIndex((a) => a.url === v.url) === i);

    const firstPartyUrls = allDiscovered
      .filter((d) => companyDomain && isFirstPartySource(d.url, companyDomain))
      .slice(0, 6);

    const webUrls = allDiscovered
      .filter((d) => !companyDomain || !isFirstPartySource(d.url, companyDomain))
      .map((d) => ({
        ...d,
        // Cap non-reputable third-party to Tier B in display
        tier: d.tier === "A" && !isReputablePublisher(d.url) ? "B" : d.tier,
      }))
      .slice(0, 6);

    // Intent scoring + company intel — fire-and-forget via after()
    // These are returned separately; don't block hook delivery.
    const intentData = null;
    const companyIntel = null;

    // Schedule enrichment to run after response is sent (Vercel waitUntil under the hood)
    after(async () => {
      try {
        if (hasFeature(tierId, "intentScoring")) {
          const intentStartedAt = Date.now();
          const intelStartedAt = Date.now();
          const [intentResult, intelResult] = await Promise.allSettled([
            (
              prefetchedSignals !== null
                ? Promise.resolve(prefetchedSignals)
                : prefetchedSignalsPromise
                  ? prefetchedSignalsPromise
                  : researchIntentSignals(url!, companyName || companyDomain || "", exaApiKey!, claudeApiKey!)
            ).then((signals) => {
              timing.backgroundIntentMs = Date.now() - intentStartedAt;
              return signals;
            }),
            getCompanyIntelligence(url!, exaApiKey!, claudeApiKey!, true, companyName || undefined).then((intel) => {
              timing.backgroundIntelMs = Date.now() - intelStartedAt;
              return intel;
            }),
          ]);

          if (intentResult.status === "fulfilled") {
            const signals = intentResult.value;
            const score = computeIntentScore(signals);
            console.log("[generate-hooks] background enrichment (pro) complete", {
              traceId,
              intentScore: score,
              signalCount: signals.length,
              intelSuccess: intelResult.status === "fulfilled",
              backgroundIntentMs: timing.backgroundIntentMs,
              backgroundIntelMs: timing.backgroundIntelMs,
            });
          }
        } else {
          const intelStartedAt = Date.now();
          await getCompanyIntelligence(url!, exaApiKey!, claudeApiKey!, false, companyName || undefined).catch(() => {});
          timing.backgroundIntelMs = Date.now() - intelStartedAt;
        }
      } catch (err) {
        console.error("[generate-hooks] background enrichment failed", { traceId, error: err });
      }
    });

    let batchId: string | undefined;
    if (!isDemo && !cached && session?.user?.id && (finalTop.length > 0 || finalOverflow.length > 0)) {
      // Increment hook quota AFTER successful generation (not before)
      try {
        const incremented = await incrementHookUsage(session.user.id);
        if (!incremented) {
          return tierError("Monthly hook limit reached. Upgrade to Pro for more hooks.");
        }
      } catch (quotaErr) {
        console.error("Failed to increment hook usage:", quotaErr);
        return tierError("Unable to record hook usage right now. Please try again.", "USAGE_WRITE_FAILED");
      }

      try {
        const persistStartedAt = Date.now();
        batchId = crypto.randomUUID();
        const allHooks = [...finalTop, ...finalOverflow];
        const inserted = await db.insert(schema.generatedHooks).values(
          allHooks.map((h) => ({
            userId: session.user.id,
            batchId: batchId!,
            companyUrl: url!,
            companyName: companyName || resolvedCompany?.name || null,
            hookText: h.hook,
            angle: h.angle,
            confidence: h.confidence,
            evidenceTier: h.evidence_tier,
            qualityScore: h.quality_score ?? scoreHookQuality(h, companyDomain || undefined),
            sourceSnippet: h.evidence_snippet || null,
            sourceUrl: h.source_url || null,
            sourceTitle: h.source_title || null,
            sourceDate: h.source_date || null,
            triggerType: h.trigger_type || null,
            promise: h.promise || null,
            bridgeQuality: h.bridge_quality || null,
            buyerTensionId: h.buyer_tension_id || null,
            structuralVariant: h.structural_variant || null,
            targetRole: targetRole ?? null,
            selectorScore: h.selector_score ?? null,
            rankingScore: h.ranking_score ?? null,
            roleFitScore: h.role_fit_score ?? null,
            nonOverlapScore: h.non_overlap_score ?? null,
          })),
        ).returning({ id: schema.generatedHooks.id });

        const topLen = finalTop.length;
        finalTop = finalTop.map((h, i) => ({ ...h, generated_hook_id: inserted[i]?.id }));
        finalOverflow = finalOverflow.map((h, i) => ({ ...h, generated_hook_id: inserted[topLen + i]?.id }));

        try {
          const accountId = await ensureAccountV2({
            userId: session.user.id,
            companyUrl: url!,
            companyName: companyName || resolvedCompany?.name || null,
          });

          await persistSignalsV2({
            accountId,
            signals: allHooks.map((h, index) => ({
              sourceUrl: h.source_url || null,
              sourceType: inferSourceTypeForV2({
                companyUrl: url!,
                sourceUrl: h.source_url || null,
                evidenceTier: h.evidence_tier,
              }),
              triggerType: h.trigger_type || null,
              title: h.source_title || null,
              snippet: h.evidence_snippet || null,
              publishedAt: h.source_date || null,
              evidenceTier: h.evidence_tier,
              metadata: {
                generatedHookId: inserted[index]?.id ?? null,
                batchId,
                angle: h.angle,
              },
            })),
          });

          await persistHookMessagesV2({
            accountId,
            hooks: allHooks.map((h, index) => ({
              generatedHookId: inserted[index]?.id ?? null,
              body: h.hook,
              channel: "email",
              rationale: h.why_this_works || null,
              sourceUrl: h.source_url || null,
              sourceTitle: h.source_title || null,
              sourceSnippet: h.evidence_snippet || null,
              sourceDate: h.source_date || null,
              triggerType: h.trigger_type || null,
              targetRole: targetRole ?? null,
              angle: h.angle,
            })),
          });
        } catch (dualWriteErr) {
          console.error("[generate-hooks] failed to dual-write v2 signals", dualWriteErr);
        }
        timing.persistMs = Date.now() - persistStartedAt;
      } catch (persistErr) {
        console.error("Failed to persist generated hooks:", persistErr);
        batchId = undefined;
      }
    }

    console.log("[generate-hooks] response summary", {
      traceId,
      finalTopCount: finalTop.length,
      finalOverflowCount: finalOverflow.length,
      finalLowSignal,
      suggestion,
      signalCount,
      cached,
      tierId,
      targetRole: targetRole || "General",
      totalMs: Date.now() - requestStartedAt,
      timings: {
        cacheLookupMs: timing.cacheLookupMs,
        resolutionMs: timing.resolutionMs,
        sourceFetchMs: timing.sourceFetchMs,
        claudeMs: timing.claudeMs,
        publishGateMs: timing.publishGateMs,
        rankingMs: timing.rankingMs,
        persistMs: timing.persistMs,
      },
    });

    return NextResponse.json({
      hooks: finalTop.map((h) => h.hook),
      structured_hooks: finalTop,
      overflow_hooks: finalOverflow,
      citations,
      status: "ok" as CompanyResolutionStatus,
      lowSignal: finalLowSignal,
      signalCount,
      suggestion,
      companyName: companyName ?? undefined,
      companyDomain: companyDomain || undefined,
      batchId,
      resolvedCompany,
      firstPartyUrls: finalLowSignal ? firstPartyUrls : undefined,
      webUrls: finalLowSignal ? webUrls : undefined,
      cached,
      targetRole: targetRole || "General",
      hookVariants,
      intent: intentData,
      companyIntel,
      isBasicIntel: tierId === "free",
      retrievalDiagnostics: {
        ...retrievalDiagnostics,
        learnedPreferences: retrievalPreferenceSummary,
      },
      _diagnostics: sourceDiagnostics ?? undefined,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Unexpected error in /api/generate-hooks", error);
    const providerError = getProviderFacingErrorMessage(error);
    return NextResponse.json(
      { error: providerError.message, code: providerError.code },
      { status: providerError.status === 429 ? 429 : 500 },
    );
  }
}
