import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import {
  fetchSourcesWithGating,
  buildSystemPrompt,
  buildUserPrompt,
  callClaude,
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
  TARGET_ROLES,
} from "@/lib/hooks";
import type { CompanyResolutionStatus } from "@/lib/types";
import { getCachedHooks, setCachedHooks, RULES_VERSION } from "@/lib/hook-cache";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";
import { getCompanyIntelligence } from "@/lib/company-intel";
import { auth } from "@/lib/auth";
import { resolveWorkspaceId, getWorkspaceProfile, getProfileUpdatedAt } from "@/lib/workspace-helpers";
import { checkHookQuota } from "@/lib/tier-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { db, schema } from "@/lib/db";

// ---------------------------------------------------------------------------
// Enforce current tier rules on citations (works on both cached and fresh)
// ---------------------------------------------------------------------------
type Citation = { source_title: string; publisher: string; date: string; url: string; tier: string; anchorScore?: number };

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

function diagnosePublishGateFinalDrops(
  hooks: Hook[],
  companyDomain: string | undefined,
  targetRole: TargetRole | null,
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
      });
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
    const body = (await request.json().catch(() => null)) as {
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

    const traceId = crypto.randomUUID().slice(0, 8);
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

    const tavilyApiKey = process.env.TAVILY_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;

    if (!rawUrl && !companyName) {
      return NextResponse.json(
        { error: "Provide either 'url' or 'companyName' in request body." },
        { status: 400 },
      );
    }

    if (!tavilyApiKey || !claudeApiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration: missing API keys. Please contact support." },
        { status: 500 },
      );
    }

    // Auth — allow unauthenticated demo (3 per day per IP)
    const session = await auth();
    const isDemo = !session?.user?.id;

    if (isDemo) {
      const demoLimited = await checkRateLimit(getClientIp(request), "demo:hooks");
      if (demoLimited) return demoLimited;
    } else {
      const rateLimited = await checkRateLimit(getClientIp(request), "auth:hooks");
      if (rateLimited) return rateLimited;

      // Quota check (trial + monthly limit + increment)
      const quotaError = await checkHookQuota(session.user.id);
      if (quotaError) return quotaError;
    }

    // Resolve workspace profile for cache busting (skip for demo)
    let profileUpdatedAt: string | null = null;
    let _senderContext: Awaited<ReturnType<typeof getWorkspaceProfile>> = null;
    if (!isDemo) {
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
      resolution = await resolveCompanyByName(companyName, tavilyApiKey);

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
    const tierId = isDemo ? "starter" : ((session?.user as any)?.tierId || "starter");

    // Check cache first (keyed by URL + targetRole)
    let candidateHooks: Hook[] | null = null;
    let prefetchedSignals: Awaited<ReturnType<typeof researchIntentSignals>> | null = null;
    let citations: Citation[] = [];
    let isLowSignal = false;
    let signalCount = 0;
    let hasAnchored = true;
    let tierACount = 0;
    let highConfidenceIntentCount = 0;
    let intentSignalsLength = 0;
    let cached = false;
    let cacheStale = false;

    try {
      const cachedResult = await getCachedHooks(url, profileUpdatedAt, targetRole);
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

    if (!candidateHooks) {
      try {
        // 1. Gather and classify sources with signal gating + anchor scoring
        let rawSignals: Awaited<ReturnType<typeof researchIntentSignals>> = [];
        let result: Awaited<ReturnType<typeof fetchSourcesWithGating>>;
        if (tierId === "pro" || tierId === "concierge") {
          try {
            rawSignals = await researchIntentSignals(url, companyName || companyDomain || "", tavilyApiKey!, claudeApiKey);
            prefetchedSignals = rawSignals;
          } catch {
            rawSignals = [];
          }

          const gatingIntentSignals: IntentSignalInput[] = rawSignals
            .filter((s) => s.confidence >= 0.6 && signalToTriggerType(s.type) !== "")
            .map((s) => ({
              triggerType: signalToTriggerType(s.type),
              summary: s.summary,
              confidence: s.confidence,
              sourceUrl: s.sourceUrl,
              tier: s.confidence >= 0.8 ? ("A" as const) : ("B" as const),
            }));

          console.log("[generate-hooks] intent signal mapping for source gating", {
            traceId,
            rawSignalsCount: rawSignals.length,
            gatingIntentSignalsCount: gatingIntentSignals.length,
            gatingIntentSignals: gatingIntentSignals.map((s) => ({ triggerType: s.triggerType, confidence: s.confidence, tier: s.tier, sourceUrl: s.sourceUrl })),
          });

          result = await fetchSourcesWithGating(url, tavilyApiKey!, gatingIntentSignals);
        } else {
          result = await fetchSourcesWithGating(url, tavilyApiKey!);
        }
        const sources = result.sources;
        signalCount = result.signalCount;

        highConfidenceIntentCount = rawSignals.filter((s) => s.confidence >= 0.8).length;
        tierACount = sources.filter((s) => s.tier === "A").length;
        intentSignalsLength = rawSignals.length;
        // Inject high-confidence intent signals into signalCount BEFORE threshold check
        signalCount += rawSignals.filter((s) => s.confidence >= 0.8).length;
        console.log('[threshold-fix] tierACount:', tierACount, 'signalCount after intent injection:', signalCount);
        isLowSignal = signalCount < 2 && tierACount < 2;
        hasAnchored = result.hasAnchoredSources;

        console.log("[generate-hooks] threshold check:", {
          traceId,
          signalCount,
          tierACount,
          highConfidenceIntentCount,
          intentSignalsLength,
          hasAnchored,
          lowSignalFromFetch: result.lowSignal,
          isLowSignal,
          exactMath: "isLowSignal = signalCount < 2 && tierACount < 2",
          tierBreakdown: sources.map((s) => ({ url: s.url, tier: s.tier, anchorScore: s.anchorScore })),
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
          const systemPrompt = buildSystemPrompt(_senderContext, targetRole, customPersona);
          const promptSignals: IntentSignalInput[] = rawSignals
            .filter((s) => s.confidence >= 0.6 && signalToTriggerType(s.type) !== "")
            .map((s) => ({
              triggerType: signalToTriggerType(s.type),
              summary: s.summary,
              confidence: s.confidence,
              sourceUrl: s.sourceUrl,
              tier: s.confidence >= 0.8 ? ("A" as const) : ("B" as const),
            }));

          console.log("[generate-hooks] intent signal mapping for prompt", {
            traceId,
            promptSignalsCount: promptSignals.length,
            promptSignals: promptSignals.map((s) => ({ triggerType: s.triggerType, confidence: s.confidence, tier: s.tier, sourceUrl: s.sourceUrl })),
          });

          const userPrompt = buildUserPrompt(url, sources, context, promptSignals.length > 0 ? promptSignals : undefined);
          const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

          console.log("[generate-hooks] raw hooks from claude", {
            traceId,
            rawHookCount: rawHooks.length,
            rawHooksPreview: rawHooks.slice(0, 5).map((h) => ({ news_item: h.news_item, angle: h.angle, confidence: h.confidence, evidence_tier: h.evidence_tier })),
          });

          // 5. First pass: publishGate with source lookup (anchored-source filtering)
          candidateHooks = publishGate(rawHooks, sourceLookup, {
            includeMarketContext: false,
          });

          console.log("[generate-hooks] candidate hooks after publishGate", {
            traceId,
            candidateHookCount: candidateHooks.length,
          });
        }
      } catch (error) {
        console.error("generate-hooks: Error during external calls", error);
        return NextResponse.json({
          hooks: [],
          structured_hooks: [],
          status: "ok" as CompanyResolutionStatus,
          lowSignal: true,
          suggestion: "Something went wrong during research. Please try again.",
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

    // Also enforce tiers on hook evidence_tier fields (cached hooks may have stale tiers)
    candidateHooks = candidateHooks.map((h) => {
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

    const publishDiagnostics = diagnosePublishGateFinalDrops(candidateHooks, companyDomain || undefined, targetRole ?? null);
    console.log("[generate-hooks] publishGateFinal diagnostics", {
      traceId,
      diagnostics: publishDiagnostics,
      droppedAtDiagnosticStage: publishDiagnostics.filter((d) => d.reason !== "pass").length,
    });

    const gated = publishGateFinal(candidateHooks, companyDomain, {
      includeMarketContext: false,
    });

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
    const { top, overflow } = rankAndCap(rankInput, 3);

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
      console.log("[generate-hooks] showing suggestion: no anchored sources");
      finalTop = top.slice(0, 1);
      finalOverflow = [];
      suggestion = noAnchorSuggestion;
      finalLowSignal = true;
    } else if (isLowSignal) {
      console.log("[generate-hooks] showing suggestion: low signal");
      finalTop = top.slice(0, 1);
      finalOverflow = [];
      suggestion = lowSignalSuggestion;
      finalLowSignal = true;
    } else if (gated.length === 0) {
      console.log("[generate-hooks] showing suggestion: no hooks survived publish gate");
      suggestion = noAnchorSuggestion;
      finalLowSignal = true;
    }

    finalTop = finalTop.map((hook) => {
      const quality = scoreHookQuality(hook, companyDomain || undefined);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
    });

    finalOverflow = finalOverflow.map((hook) => {
      const quality = scoreHookQuality(hook, companyDomain || undefined);
      return { ...hook, quality_score: quality, quality_label: getQualityLabel(quality) };
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
    // Generate multi-channel variants for Pro/Concierge
    let hookVariants: Array<{ hook_index: number; variants: Array<{ channel: string; text: string }> }> = [];

    if (roleGated.length > 0 && (!cached || cacheStale)) {
      // Generate variants for Pro/Concierge before caching
      if (tierId === "pro" || tierId === "concierge") {
        try {
          const withVars = await generateChannelVariants(roleGated, claudeApiKey, targetRole);
          hookVariants = withVars.map((h, i) => ({ hook_index: i, variants: h.variants }));
        } catch {}
      }
      setCachedHooks(url, roleGated, citations, profileUpdatedAt, targetRole, hookVariants.length > 0 ? hookVariants : undefined).catch(() => {});
    } else if (cached && (tierId === "pro" || tierId === "concierge")) {
      // Load variants from cache
      try {
        const cr = await getCachedHooks(url!, profileUpdatedAt, targetRole);
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

    // Intent scoring + company intel
    let intentData = null;
    let companyIntel = null;

    if (tierId === "pro" || tierId === "concierge") {
      const [intentResult, intelResult] = await Promise.allSettled([
        prefetchedSignals !== null
          ? Promise.resolve(prefetchedSignals)
          : researchIntentSignals(url, companyName || companyDomain || "", tavilyApiKey, claudeApiKey),
        getCompanyIntelligence(url, tavilyApiKey, claudeApiKey, true),
      ]);

      if (intentResult.status === "fulfilled") {
        const signals = intentResult.value;
        const score = computeIntentScore(signals);
        intentData = {
          score,
          temperature: getTemperature(score),
          signals: signals.map((s) => ({
            type: s.type,
            summary: s.summary,
            confidence: s.confidence,
            sourceUrl: s.sourceUrl,
            detectedAt: s.detectedAt,
          })),
        };
      }

      if (intelResult.status === "fulfilled") {
        companyIntel = intelResult.value;
      }
    } else {
      try {
        companyIntel = await getCompanyIntelligence(url, tavilyApiKey, claudeApiKey, false);
      } catch {
        // Non-blocking
      }
    }

    let batchId: string | undefined;
    if (!isDemo && session?.user?.id && (finalTop.length > 0 || finalOverflow.length > 0)) {
      try {
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
          })),
        ).returning({ id: schema.generatedHooks.id });

        const topLen = finalTop.length;
        finalTop = finalTop.map((h, i) => ({ ...h, generated_hook_id: inserted[i]?.id }));
        finalOverflow = finalOverflow.map((h, i) => ({ ...h, generated_hook_id: inserted[topLen + i]?.id }));
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
      isBasicIntel: tierId === "starter",
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Unexpected error in /api/generate-hooks", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating hooks." },
      { status: 500 },
    );
  }
}
