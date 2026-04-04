import * as Sentry from "@sentry/nextjs";
import { NextResponse, after } from "next/server";
import {
  getProviderFacingErrorMessage,
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
  type MessagingStyle,
  TARGET_ROLES,
} from "@/lib/hooks";
import type { CompanyResolutionStatus } from "@/lib/types";
import { getCachedHooks, setCachedHooks, RULES_VERSION } from "@/lib/hook-cache";
import { researchIntentSignals, computeIntentScore } from "@/lib/intent";
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
import { buildRetrievalDiagnostics } from "@/lib/retrieval-plan";
import {
  runFastUrlMode,
  type FastUrlModeCitation,
} from "@/lib/generate-hooks/fast-url-mode";
import {
  runResearchMode,
  type ResearchModeResult,
} from "@/lib/generate-hooks/research-mode";
import {
  diagnosePublishGateFinalDrops,
  finalizeGeneratedHooks,
} from "@/lib/generate-hooks/post-process";

// ---------------------------------------------------------------------------
// Enforce current tier rules on citations (works on both cached and fresh)
// ---------------------------------------------------------------------------
type Citation = FastUrlModeCitation;

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

    let sourceDiagnostics: ResearchModeResult["sourceDiagnostics"] = null;

    if (!candidateHooks) {
      try {
        let usedFastPath = false;
        const fastModeResult = await runFastUrlMode({
          rawUrl,
          url,
          companyDomain,
          companyName: companyName || undefined,
          context,
          targetRole,
          customPain,
          customPromise,
          messagingStyle,
          claudeApiKey,
          senderContext: _senderContext,
          traceId,
        });

        if (fastModeResult.handled) {
          timing.sourceFetchMs = fastModeResult.sourceFetchMs;
          usedFastPath = true;

          if (!fastModeResult.success) {
            return NextResponse.json({
              hooks: [],
              structured_hooks: [],
              overflow_hooks: [],
              status: "ok" as CompanyResolutionStatus,
              lowSignal: true,
              suggestion: fastModeResult.suggestion,
              timings: {
                totalMs: Date.now() - requestStartedAt,
                sourceFetchMs: timing.sourceFetchMs,
              },
            });
          }

          timing.claudeMs = fastModeResult.claudeMs;
          candidateHooks = fastModeResult.candidateHooks;
          citations = fastModeResult.citations;
          isLowSignal = fastModeResult.isLowSignal;
          hasAnchored = fastModeResult.hasAnchored;
          tierACount = fastModeResult.tierACount;
          signalCount = fastModeResult.signalCount;
          isFastPath = true;
        }

        if (!usedFastPath) {
          const researchModeResult = await runResearchMode({
            url,
            companyDomain,
            companyName: companyName || undefined,
            context,
            targetRole,
            customPain,
            customPromise,
            messagingStyle,
            traceId,
            exaApiKey: exaApiKey!,
            claudeApiKey,
            tierId,
            isDemo,
            sessionUserId: session?.user?.id,
            senderContext: _senderContext,
          });
          selectorPriors = researchModeResult.selectorPriors;
          retrievalPreferenceSummary = summarizeSelectorRetrievalPreferences(selectorPriors);
          candidateHooks = researchModeResult.candidateHooks;
          citations = researchModeResult.citations;
          signalCount = researchModeResult.signalCount;
          isLowSignal = researchModeResult.isLowSignal;
          hasAnchored = researchModeResult.hasAnchored;
          tierACount = researchModeResult.tierACount;
          highConfidenceIntentCount = researchModeResult.highConfidenceIntentCount;
          intentSignalsLength = researchModeResult.intentSignalsLength;
          sourceDiagnostics = researchModeResult.sourceDiagnostics;
          retrievalDiagnostics = researchModeResult.retrievalDiagnostics;
          prefetchedSignals = researchModeResult.prefetchedSignals;
          prefetchedSignalsPromise = researchModeResult.prefetchedSignalsPromise;
          timing.sourceFetchMs = researchModeResult.timing.sourceFetchMs;
          timing.claudeMs = researchModeResult.timing.claudeMs;
          timing.publishGateMs = researchModeResult.timing.publishGateMs;
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

    const publishDiagnostics = diagnosePublishGateFinalDrops(candidateHooks, companyDomain || undefined, targetRole ?? null, messagingStyle);
    console.log("[generate-hooks] publishGateFinal diagnostics", {
      traceId,
      diagnostics: publishDiagnostics,
      droppedAtDiagnosticStage: publishDiagnostics.filter((d) => d.reason !== "pass").length,
    });

    const finalized = finalizeGeneratedHooks({
      candidateHooks,
      companyDomain: companyDomain || undefined,
      targetRole: targetRole ?? null,
      selectorPriors,
      isFastPath,
      isLowSignal,
      hasAnchored,
      messagingStyle,
    });
    const gated = finalized.gated;
    const roleGated = finalized.roleGated;
    const roleGateDroppedAll = finalized.roleGateDroppedAll;
    let finalTop = finalized.finalTop;
    let finalOverflow = finalized.finalOverflow;
    const suggestion = finalized.suggestion;
    const finalLowSignal = finalized.finalLowSignal;
    timing.publishGateMs += finalized.publishGateMs;
    timing.rankingMs = finalized.rankingMs;

    console.log("[generate-hooks] after publishGateFinal", {
      traceId,
      gatedCount: gated.length,
      droppedByPublishGateFinal: candidateHooks.length - gated.length,
      gatedHooksPreview: gated.slice(0, 10).map((h) => ({ news_item: h.news_item, angle: h.angle, evidence_tier: h.evidence_tier, source_url: h.source_url })),
    });

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
      topCount: finalTop.length,
      conditions: {
        noAnchored: !hasAnchored,
        isLowSignal,
        noHooksAfterPublish: gated.length === 0,
      },
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

    // Cache hooks for next time:
    // - Fresh results: always cache
    // - Stale cached results (wrong rules_version): re-cache with corrected payload
    // Generate multi-channel variants for Pro
    let hookVariants: Array<{ hook_index: number; variants: Array<{ channel: string; text: string }> }> = [];

    if (roleGated.length > 0 && (!cached || cacheStale)) {
      // Skip multi-channel variant generation on the submitted-URL fast path so the
      // response is not blocked by an extra Claude round-trip.
      if (hasFeature(tierId, "multiChannel") && !isFastPath) {
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
