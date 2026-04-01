/**
 * OPTIMIZED Generate Hooks API Route
 * Performance improvements:
 * 1. Early cache lookup with memory cache
 * 2. Timeout management for external APIs  
 * 3. Parallelized independent operations
 * 4. Compressed Claude prompts
 * 5. Intermediate result caching
 */

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import {
  fetchSourcesWithGating,
  generateHookPayloadsFromSources,
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
  getProviderFacingErrorMessage,
  scoreHookQuality,
  getQualityLabel,
  type CompanyResolutionResult,
  type ClassifiedSource,
  type Hook,
  type TargetRole,
  type IntentSignalInput,
  TARGET_ROLES,
} from "@/lib/hooks";

// Import optimized modules
import { PerformanceMonitor, callExternalAPI } from "@/lib/performance-utils";
import { EnhancedCache } from "@/lib/enhanced-cache";

import type { CompanyResolutionStatus } from "@/lib/types";
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
// Helper Functions (optimized versions)
// ---------------------------------------------------------------------------

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

function enforceCitationTiers(citations: any[], companyDomain: string): any[] {
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

// ---------------------------------------------------------------------------
// OPTIMIZED Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const traceId = crypto.randomUUID().slice(0, 8);
  PerformanceMonitor.start(`generate-hooks-${traceId}`);
  
  try {
    console.log(`[${traceId}] Starting optimized hook generation`);

    // Parse request body early
    const body = await callExternalAPI(
      () => request.json().catch(() => null),
      { name: 'parse-request', timeout: 2000 }
    ) as {
      url?: string;
      companyName?: string;
      context?: string;
      targetRole?: string;
      customPain?: string;
      customPromise?: string;
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

    console.log(`[${traceId}] Request parsed:`, {
      rawUrl: !!rawUrl,
      companyName: !!companyName,
      targetRole: targetRole || 'General',
    });

    // URL validation
    if (rawUrl) {
      try {
        const parsed = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
        if (!parsed.hostname.includes(".")) {
          return NextResponse.json(
            { error: "Invalid URL: must be a valid domain (e.g., https://acme.com)." },
            { status: 400 },
          );
        }

      } catch {
        return NextResponse.json(
          { error: "Invalid URL format. Provide a valid company URL (e.g., https://acme.com)." },
          { status: 400 },
        );
      }
    }

    // Check required env vars
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
        { error: "Server misconfiguration: missing API keys." },
        { status: 500 },
      );
    }

    // Auth and rate limiting  
    PerformanceMonitor.start(`auth-${traceId}`);
    const session = await auth();
    const isDemo = !session?.user?.id;

    if (isDemo) {
      const demoLimited = await checkRateLimit(getClientIp(request), "demo:hooks");
      if (demoLimited) return demoLimited;
    } else {
      const rateLimited = await checkRateLimit(getClientIp(request), "auth:hooks");
      if (rateLimited) return rateLimited;

      const quotaError = await checkHookQuota(session.user.id);
      if (quotaError) return quotaError;
    }
    PerformanceMonitor.end(`auth-${traceId}`);

    // **EARLY CACHE LOOKUP** - moved to front of pipeline
    let url = rawUrl;
    let resolution: CompanyResolutionResult | null = null;

    // Resolve company name to URL if needed
    if (!url && companyName) {
      PerformanceMonitor.start(`company-resolution-${traceId}`);
      resolution = await callExternalAPI(
        () => resolveCompanyByName(companyName, exaApiKey),
        { name: 'company-resolution', timeout: 5000, retries: 1 }
      );
      PerformanceMonitor.end(`company-resolution-${traceId}`);

      if (resolution.status === "no_match" || resolution.status === "needs_disambiguation") {
        return NextResponse.json({
          hooks: [],
          status: resolution.status as CompanyResolutionStatus,
          companyName: resolution.companyName,
          candidates: resolution.candidates,
        });
      }

      url = resolution.candidates[0]?.url;
    }

    if (!url) {
      return NextResponse.json(
        { error: "Unable to determine company URL from request." },
        { status: 400 },
      );
    }

    const companyDomain = getDomain(url);
    const tierId = isDemo ? "free" : ((session?.user as any)?.tierId || "free");

    // **CHECK CACHE FIRST** (with new enhanced cache)
    PerformanceMonitor.start(`cache-lookup-${traceId}`);
    let profileUpdatedAt: string | null = null;
    let senderContext: any = null;

    // Get profile data in parallel with cache check
    const [cacheResult, profileData] = await Promise.all([
      EnhancedCache.getHooks(url, undefined, targetRole),
      !isDemo ? (async () => {
        try {
          const workspaceId = await resolveWorkspaceId(session!.user!.id);
          const [ctx, updatedAt] = await Promise.all([
            getWorkspaceProfile(workspaceId),
            getProfileUpdatedAt(workspaceId),
          ]);
          return { ctx, updatedAt };
        } catch { return { ctx: null, updatedAt: null }; }
      })() : Promise.resolve({ ctx: null, updatedAt: null })
    ]);

    senderContext = profileData.ctx;
    profileUpdatedAt = profileData.updatedAt;

    // Re-check cache with profile data
    const cachedHooks = profileData.updatedAt 
      ? await EnhancedCache.getHooks(url, profileData.updatedAt, targetRole)
      : cacheResult;

    PerformanceMonitor.end(`cache-lookup-${traceId}`);

    let candidateHooks: Hook[] = [];
    let citations: any[] = [];
    let isLowSignal = false;
    let signalCount = 0;
    let hasAnchored = true;
    let hookVariants: any[] = [];
    let cached = false;
    let retrievalDiagnostics = buildRetrievalDiagnostics([], {
      targetDomain: companyDomain || null,
      lowSignal: false,
      hasAnchoredSources: false,
    });
    const selectorPriors = !isDemo && session?.user?.id
      ? await getHookSelectorPriors({
          userId: session.user.id,
          companyUrl: url,
          targetRole: targetRole ?? null,
        }).catch(() => undefined)
      : undefined;
    const retrievalPreferenceSummary = summarizeSelectorRetrievalPreferences(selectorPriors);

    if (cachedHooks) {
      console.log(`[${traceId}] Cache HIT - returning cached hooks`);
      candidateHooks = cachedHooks.hooks as Hook[];
      citations = cachedHooks.citations as any[];
      hookVariants = cachedHooks.variants || [];
      cached = true;
      
      // Restore counts for response consistency
      const tierACount = citations.filter(c => c.tier === 'A').length;
      signalCount = tierACount;
      hasAnchored = tierACount > 0;
      isLowSignal = tierACount === 0;
    } else {
      console.log(`[${traceId}] Cache MISS - generating fresh hooks`);

      // **PARALLEL OPERATIONS** - run independent operations in parallel
      PerformanceMonitor.start(`parallel-operations-${traceId}`);
      const retrievalPlan = buildRetrievalPlan({
        targetDomain: companyDomain || null,
        hasIntentSignals: hasFeature(tierId, "intentScoring"),
        userProvidedUrl: Boolean(rawUrl),
      });
      
      const parallelOps = [
        // Core source fetching
        callExternalAPI(
          () => fetchSourcesWithGating(
            url, 
            exaApiKey,
            [], // Intent signals added later
            process.env.APIFY_API_TOKEN,
            companyDomain ? companyDomain.split(".")[0] : undefined
          ),
          { name: 'source-fetching', timeout: 15000, retries: 1 }
        ),
        
        // Intent signals for Pro (run in parallel)
        hasFeature(tierId, "intentScoring")
          ? EnhancedCache.getIntentSignals(url, companyName || companyDomain || "") ||
            callExternalAPI(
              () => researchIntentSignals(url, companyName || companyDomain || "", exaApiKey, claudeApiKey),
              { name: 'intent-signals', timeout: 8000, retries: 1 }
            ).then(signals => {
              EnhancedCache.setIntentSignals(url, companyName || companyDomain || "", signals);
              return signals;
            }).catch(() => [])
          : Promise.resolve([]),

        // Company intelligence (run in parallel)  
        EnhancedCache.getCompanyIntel(url) ||
        callExternalAPI(
          () => getCompanyIntelligence(url, exaApiKey, claudeApiKey, hasFeature(tierId, "companyIntel")),
          { name: 'company-intel', timeout: 8000, retries: 1 }
        ).then(intel => {
          EnhancedCache.setCompanyIntel(url, intel);
          return intel;
        }).catch(() => null)
      ];

      const [sourceResult, intentSignals, companyIntel] = await Promise.all(parallelOps);
      PerformanceMonitor.end(`parallel-operations-${traceId}`);

      const sources = prioritizeRetrievalSources(
        sourceResult.sources as ClassifiedSource[],
        companyDomain || null,
      );
      signalCount = sourceResult.signalCount;
      hasAnchored = sourceResult.hasAnchoredSources;
      isLowSignal = sourceResult.lowSignal;

      console.log(`[${traceId}] Parallel operations complete:`, {
        retrievalPlan,
        sources: sources.length,
        intentSignals: intentSignals.length,
        hasCompanyIntel: !!companyIntel,
        hasAnchored,
        isLowSignal,
      });

      retrievalDiagnostics = buildRetrievalDiagnostics(sources, {
        targetDomain: companyDomain || null,
        lowSignal: sourceResult.lowSignal,
        hasAnchoredSources: sourceResult.hasAnchoredSources,
        recoveryAttempted: sourceResult._diagnostics.recoveryAttempted,
        newsExpansionAttempted: sourceResult._diagnostics.newsExpansionAttempted,
      });

      // Check if we have usable sources
      const usableSources = sources.filter((s: ClassifiedSource) => s.tier !== "C");
      if (usableSources.length === 0) {
        console.log(`[${traceId}] No usable sources found`);
        return NextResponse.json({
          hooks: [], structured_hooks: [], overflow_hooks: [],
          status: "ok" as CompanyResolutionStatus, lowSignal: true,
          suggestion: "We couldn't find enough recent news to write a strong hook. Try pasting a URL from their press page or newsroom.",
        });
      }

      // **OPTIMIZED CLAUDE CALL**
      PerformanceMonitor.start(`claude-call-${traceId}`);
      
      const sourceLookup = new Map<number, ClassifiedSource>();
      usableSources.forEach((s: any, i: number) => sourceLookup.set(i + 1, s));

      const customPersona = customPain && customPromise ? { pain: customPain, promise: customPromise } : undefined;
      
      const intentSignalInputs: IntentSignalInput[] = intentSignals
        .filter((s: any) => s.confidence >= 0.6 && signalToTriggerType(s.type) !== "")
        .map((s: any) => ({
          triggerType: signalToTriggerType(s.type),
          summary: s.summary,
          confidence: s.confidence,
          sourceUrl: s.sourceUrl,
          tier: s.confidence >= 0.8 ? ("A" as const) : ("B" as const),
        }));

      console.log(`[${traceId}] Calling Claude with interpreter/composer pipeline:`, {
        sources: sources.length,
        intentSignals: intentSignalInputs.length,
      });

      const { rawHooks } = await generateHookPayloadsFromSources({
        url,
        sources,
        apiKey: claudeApiKey,
        context,
        senderContext,
        targetRole,
        customPersona,
        intentSignals: intentSignalInputs.length > 0 ? intentSignalInputs : undefined,
        retrievalLibrary: selectorPriors?.retrievalLibrary,
      });

      PerformanceMonitor.end(`claude-call-${traceId}`);

      console.log(`[${traceId}] Claude returned ${rawHooks.length} raw hooks`);

      // Apply gates
      const gated = publishGate(rawHooks, sourceLookup, { includeMarketContext: false });
      const finalGated = publishGateFinal(gated, companyDomain, { includeMarketContext: false });
      const roleGated = roleTokenGate(finalGated, targetRole ?? null);
      
      candidateHooks = roleGated.length === 0 && finalGated.length > 0 ? finalGated : roleGated;

      console.log(`[${traceId}] Gating complete:`, {
        raw: rawHooks.length,
        gated: gated.length,
        finalGated: finalGated.length,
        roleGated: roleGated.length,
        final: candidateHooks.length,
      });

      citations = sources.map((s: ClassifiedSource) => ({
        source_title: s.title,
        publisher: s.publisher,
        date: s.date,
        url: s.url,
        tier: s.tier,
        anchorScore: s.anchorScore,
      }));

      // Generate variants for Pro (async, don't block response)
      if (candidateHooks.length > 0 && hasFeature(tierId, "multiChannel")) {
        generateChannelVariants(candidateHooks, claudeApiKey, targetRole)
          .then(withVars => {
            hookVariants = withVars.map((h, i) => ({ hook_index: i, variants: h.variants }));
          })
          .catch(() => {}); // Non-blocking
      }

      // **CACHE THE RESULTS** (async, don't block response)  
      if (candidateHooks.length > 0) {
        EnhancedCache.setHooks(url, candidateHooks, citations, profileUpdatedAt, targetRole, hookVariants)
          .catch(() => {}); // Non-blocking
      }
    }

    // Enforce citation tiers
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
          newsExpansionAttempted: false,
          usedCachedResult: cached,
        },
      );
    }

    candidateHooks = candidateHooks.map((h: Hook) => {
      if (h.evidence_tier !== "A") return h;
      if (!h.source_url || !companyDomain) return h;
      const firstParty = isFirstPartySource(h.source_url, companyDomain);
      const reputable = isReputablePublisher(h.source_url);
      if (!firstParty && !reputable) {
        return { ...h, evidence_tier: "B" as const };
      }
      return h;
    });

    // Rank and cap hooks
    const { top, overflow } = rankAndCap(candidateHooks, 3, {
      targetRole: targetRole ?? null,
      selectorPriors,
    });

    // Apply quality scoring
    let finalTop = top.map((hook: Hook) => {
      const quality = scoreHookQuality(hook, companyDomain);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
    }).sort((a, b) => (b.selector_score ?? b.ranking_score ?? b.quality_score ?? 0) - (a.selector_score ?? a.ranking_score ?? a.quality_score ?? 0));

    let finalOverflow = overflow.map((hook: Hook) => {
      const quality = scoreHookQuality(hook, companyDomain);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
    }).sort((a, b) => (b.selector_score ?? b.ranking_score ?? b.quality_score ?? 0) - (a.selector_score ?? a.ranking_score ?? a.quality_score ?? 0));

    // Determine suggestions
    let suggestion: string | undefined;
    let finalLowSignal = isLowSignal;

    if (!hasAnchored) {
      suggestion = "We couldn't confirm these sources are specifically about this company. Paste a URL directly from their press page or newsroom.";
      finalLowSignal = true;
    } else if (isLowSignal) {
      suggestion = "We found this company but couldn't find enough recent news to write a strong hook. Try pasting a URL from their press page.";
      finalLowSignal = true;
    } else if (candidateHooks.length === 0) {
      suggestion = "We couldn't find enough recent news to write a strong hook. Try pasting a URL from their press page.";
      finalLowSignal = true;
    }

    const totalTime = PerformanceMonitor.end(`generate-hooks-${traceId}`);
    
    console.log(`[${traceId}] Generation complete:`, {
      totalTime,
      hooks: finalTop.length,
      overflow: finalOverflow.length,
      cached,
      lowSignal: finalLowSignal,
    });

    const resolvedCompany = resolution && resolution.candidates[0]
      ? {
          id: resolution.candidates[0].id,
          name: resolution.candidates[0].name,
          url: resolution.candidates[0].url,
          description: resolution.candidates[0].description,
          source: resolution.candidates[0].source,
        }
      : null;

    // Increment hook quota AFTER successful generation (not before)
    if (!isDemo && !cached && session?.user?.id && (finalTop.length > 0 || finalOverflow.length > 0)) {
      try {
        const incremented = await incrementHookUsage(session.user.id);
        if (!incremented) {
          return tierError("Monthly hook limit reached. Upgrade to Pro for more hooks.");
        }
      } catch (quotaErr) {
        console.error(`[${traceId}] Failed to increment hook usage:`, quotaErr);
        return tierError("Unable to record hook usage right now. Please try again.", "USAGE_WRITE_FAILED");
      }

      try {
        const batchId = crypto.randomUUID();
        const allHooks = [...finalTop, ...finalOverflow];
        const inserted = await db.insert(schema.generatedHooks).values(
          allHooks.map((h) => ({
            userId: session.user.id,
            batchId,
            companyUrl: url,
            companyName: companyName || resolvedCompany?.name || null,
            hookText: h.hook,
            angle: h.angle,
            confidence: h.confidence,
            evidenceTier: h.evidence_tier,
            qualityScore: h.quality_score ?? scoreHookQuality(h, companyDomain),
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
            companyUrl: url,
            companyName: companyName || resolvedCompany?.name || null,
          });

          await persistSignalsV2({
            accountId,
            signals: allHooks.map((h, index) => ({
              sourceUrl: h.source_url || null,
              sourceType: inferSourceTypeForV2({
                companyUrl: url,
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
          console.error(`[${traceId}] Failed to dual-write v2 signals:`, dualWriteErr);
        }
      } catch (persistErr) {
        console.error(`[${traceId}] Failed to persist generated hooks:`, persistErr);
      }
    }

    return NextResponse.json({
      hooks: finalTop.map((h: Hook) => h.hook),
      structured_hooks: finalTop,
      overflow_hooks: finalOverflow,
      citations,
      status: "ok" as CompanyResolutionStatus,
      lowSignal: finalLowSignal,
      signalCount,
      suggestion,
      companyName: companyName ?? undefined,
      companyDomain: companyDomain || undefined,
      resolvedCompany,
      cached,
      targetRole: targetRole || "General",
      hookVariants,
      retrievalDiagnostics: {
        ...retrievalDiagnostics,
        learnedPreferences: retrievalPreferenceSummary,
      },
      _performance: {
        totalTime,
        cached,
        traceId,
      },
    });

  } catch (error) {
    const totalTime = PerformanceMonitor.end(`generate-hooks-${traceId}`);
    
    Sentry.captureException(error);
    console.error(`[${traceId}] Error after ${totalTime}ms:`, error);
    const providerError = getProviderFacingErrorMessage(error);
    
    return NextResponse.json(
      { error: providerError.message, code: providerError.code },
      { status: providerError.status === 429 ? 429 : 500 },
    );
  }
}
