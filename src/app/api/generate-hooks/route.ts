import { NextResponse } from "next/server";
import {
  fetchSourcesWithGating,
  buildSystemPrompt,
  buildUserPrompt,
  callClaude,
  publishGate,
  publishGateFinal,
  resolveCompanyByName,
  getDomain,
  type CompanyResolutionResult,
  type ClassifiedSource,
  type Hook,
} from "@/lib/hooks";
import type { CompanyResolutionStatus } from "@/lib/types";
import { getCachedHooks, setCachedHooks } from "@/lib/hook-cache";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      url?: string;
      companyName?: string;
      context?: string;
    } | null;

    const rawUrl = body?.url?.trim();
    const companyName = body?.companyName?.trim();
    const context = body?.context?.trim();

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

    // Check cache first
    let candidateHooks: Hook[] | null = null;
    let citations: Array<{ source_title: string; publisher: string; date: string; url: string; tier: string; anchorScore?: number }> = [];
    let isLowSignal = false;
    let signalCount = 0;
    let hasAnchored = true;
    let cached = false;

    try {
      const cachedResult = await getCachedHooks(url);
      if (cachedResult) {
        candidateHooks = cachedResult.hooks as Hook[];
        citations = (cachedResult.citations || []) as typeof citations;
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
          const systemPrompt = buildSystemPrompt();
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
    // PUBLISH GATE FINAL — runs on ALL hooks (cached or fresh) right before return.
    // This is the LAST step. Nothing bypasses this.
    // Rule A: change verbs without proof → rewrite or drop
    // Rule B: unanchored sources → drop (include_market_context=false)
    // Rule C: forced-choice question → drop if missing
    // Rule D: Tier B cap at 1
    // =========================================================================
    const gated = publishGateFinal(candidateHooks, companyDomain, {
      includeMarketContext: false,
    });

    // Build suggestions
    const noAnchorSuggestion = [
      "Low Signal: no company-specific signals found — only market context available.",
      "For better hooks, provide: the company's press/newsroom, blog/changelog, careers page, LinkedIn, or recent news articles mentioning the company by name.",
    ].join(" ");

    const lowSignalSuggestion = [
      `Low Signal: only ${signalCount} signal fact(s) found — only fundamentals available.`,
      "For better hooks, try: the company's press/newsroom, blog/changelog, careers page, LinkedIn, or recent news articles.",
    ].join(" ");

    // Determine final hook list + metadata
    let finalHooks = gated;
    let suggestion: string | undefined;
    let finalLowSignal = isLowSignal;

    if (!hasAnchored) {
      finalHooks = gated.slice(0, 1);
      suggestion = noAnchorSuggestion;
      finalLowSignal = true;
    } else if (isLowSignal) {
      finalHooks = gated.slice(0, 1);
      suggestion = lowSignalSuggestion;
      finalLowSignal = true;
    } else if (gated.length === 0) {
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

    // Cache gated hooks for next time (fire and forget) — only for fresh (non-cached) results
    if (!cached && finalHooks.length > 0) {
      setCachedHooks(url, finalHooks, citations).catch(() => {});
    }

    return NextResponse.json({
      hooks: finalHooks.map((h) => h.hook),
      structured_hooks: finalHooks,
      citations,
      status: "ok" as CompanyResolutionStatus,
      lowSignal: finalLowSignal,
      signalCount,
      suggestion,
      companyName: companyName ?? undefined,
      resolvedCompany,
      cached,
    });
  } catch (error) {
    console.error("Unexpected error in /api/generate-hooks", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating hooks." },
      { status: 500 },
    );
  }
}
