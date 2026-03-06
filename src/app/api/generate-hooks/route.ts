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
  resolveCompanyByName,
  getDomain,
  isFirstPartySource,
  isReputablePublisher,
  generateChannelVariants,
  type CompanyResolutionResult,
  type ClassifiedSource,
  type Hook,
  type TargetRole,
  TARGET_ROLES,
} from "@/lib/hooks";
import type { CompanyResolutionStatus } from "@/lib/types";
import { getCachedHooks, setCachedHooks, RULES_VERSION } from "@/lib/hook-cache";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";
import { auth } from "@/lib/auth";
import { resolveWorkspaceId, getWorkspaceProfile, getProfileUpdatedAt } from "@/lib/workspace-helpers";
import { checkHookQuota } from "@/lib/tier-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
    } | null;

    const rawUrl = body?.url?.trim();
    const companyName = body?.companyName?.trim();
    const context = body?.context?.trim();
    const targetRole: TargetRole | undefined =
      body?.targetRole && TARGET_ROLES.includes(body.targetRole as TargetRole)
        ? (body.targetRole as TargetRole)
        : undefined;

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

    const braveApiKey = process.env.BRAVE_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;

    if (!rawUrl && !companyName) {
      return NextResponse.json(
        { error: "Provide either 'url' or 'companyName' in request body." },
        { status: 400 },
      );
    }

    if (!braveApiKey || !claudeApiKey) {
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
      resolution = await resolveCompanyByName(companyName, braveApiKey);

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

    // Check cache first (keyed by URL + targetRole)
    let candidateHooks: Hook[] | null = null;
    let citations: Citation[] = [];
    let isLowSignal = false;
    let signalCount = 0;
    let hasAnchored = true;
    let cached = false;
    let cacheStale = false;

    try {
      const cachedResult = await getCachedHooks(url, profileUpdatedAt, targetRole);
      if (cachedResult) {
        // Check rules_version — if stale, still use hooks but flag for re-caching
        if (cachedResult.rulesVersion !== RULES_VERSION) {
          cacheStale = true;
        }
        candidateHooks = cachedResult.hooks as Hook[];
        citations = (cachedResult.citations || []) as Citation[];
        cached = true;
      }
    } catch {
      // Cache miss or error — continue to generate
    }

    if (!candidateHooks) {
      try {
        // 1. Gather and classify sources with signal gating + anchor scoring
        const result = await fetchSourcesWithGating(url, braveApiKey!);
        const sources = result.sources;
        signalCount = result.signalCount;
        isLowSignal = result.lowSignal;
        hasAnchored = result.hasAnchoredSources;

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
          const systemPrompt = buildSystemPrompt(_senderContext, targetRole);
          const userPrompt = buildUserPrompt(url, sources, context);
          const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

          // 5. First pass: publishGate with source lookup (anchored-source filtering)
          candidateHooks = publishGate(rawHooks, sourceLookup, {
            includeMarketContext: false,
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
    const gated = publishGateFinal(candidateHooks, companyDomain, {
      includeMarketContext: false,
    });

    // =========================================================================
    // ROLE TOKEN GATE — enforce persona framing (skip for General)
    // =========================================================================
    const roleGated = roleTokenGate(gated, targetRole ?? null);

    // =========================================================================
    // RANK + CAP — score and return top 3 (overflow available via showAll)
    // =========================================================================
    const { top, overflow } = rankAndCap(roleGated, 3);

    // Build suggestions — short headline, details handled by UI
    const noAnchorSuggestion = "Need one more source to generate strong hooks.";
    const lowSignalSuggestion = "Need one more source to generate strong hooks.";

    // Determine final hook list + metadata
    let finalTop = top;
    let finalOverflow = overflow;
    let suggestion: string | undefined;
    let finalLowSignal = isLowSignal;

    if (!hasAnchored) {
      finalTop = top.slice(0, 1);
      finalOverflow = [];
      suggestion = noAnchorSuggestion;
      finalLowSignal = true;
    } else if (isLowSignal) {
      finalTop = top.slice(0, 1);
      finalOverflow = [];
      suggestion = lowSignalSuggestion;
      finalLowSignal = true;
    } else if (roleGated.length === 0) {
      suggestion = noAnchorSuggestion;
      finalLowSignal = true;
    }

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
    const tierId = isDemo ? "starter" : ((session!.user as any).tierId || "starter");

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

    // Intent scoring for Pro/Concierge users
    let intentData = null;
    if (tierId === "pro" || tierId === "concierge") {
      try {
        if (braveApiKey && claudeApiKey) {
          const signals = await researchIntentSignals(
            url, companyName || companyDomain || "", braveApiKey, claudeApiKey
          );
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
      } catch {
        // Non-blocking — intent scoring failure should not affect hook generation
      }
    }

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
      resolvedCompany,
      firstPartyUrls: finalLowSignal ? firstPartyUrls : undefined,
      webUrls: finalLowSignal ? webUrls : undefined,
      cached,
      targetRole: targetRole || "General",
      hookVariants,
      intent: intentData,
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
