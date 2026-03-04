import { NextResponse } from "next/server";
import {
  fetchSourcesWithGating,
  buildSystemPrompt,
  buildUserPrompt,
  callClaude,
  validateHook,
  resolveCompanyByName,
  type Hook,
  type CompanyResolutionResult,
  type ClassifiedSource,
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

    // Check cache first
    try {
      const cached = await getCachedHooks(url);
      if (cached) {
        return NextResponse.json({
          hooks: (cached.hooks as any[]).map((h: any) => h.hook || h),
          structured_hooks: cached.hooks,
          citations: cached.citations,
          status: "ok" as CompanyResolutionStatus,
          cached: true,
        });
      }
    } catch {
      // Cache miss or error — continue to generate
    }

    try {
      // 1. Gather and classify sources with signal gating
      const { sources, signalCount, lowSignal } = await fetchSourcesWithGating(url, braveApiKey!);

      const citations = sources.map((s) => ({
        source_title: s.title,
        publisher: s.publisher,
        date: s.date,
        url: s.url,
        tier: s.tier,
      }));

      // 2. Check if all sources are Tier C (insufficient evidence)
      const usableSources = sources.filter((s) => s.tier !== "C");
      if (usableSources.length === 0) {
        return NextResponse.json({
          hooks: [],
          structured_hooks: [],
          citations,
          status: "ok" as CompanyResolutionStatus,
          lowSignal: true,
          suggestion:
            "Insufficient evidence. Try providing a press release, changelog, case study, or job posting URL for this company.",
        });
      }

      // 3. Build source lookup for validation
      const sourceLookup = new Map<number, ClassifiedSource>();
      usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

      // 4. Build prompts and call Claude
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(url, sources, context);
      const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

      // 5. Quality gate (includes verbatim quote check + unsourced claim check)
      const validHooks: Hook[] = [];
      for (const raw of rawHooks) {
        const validated = validateHook(raw, sourceLookup);
        if (validated) validHooks.push(validated);
      }

      // 6. Enforce Tier B cap: max 1 hook per Tier B source
      const tierBSeen = new Set<number>();
      const cappedHooks: Hook[] = [];
      for (const hook of validHooks) {
        if (hook.evidence_tier === "B") {
          if (tierBSeen.has(hook.news_item)) continue;
          tierBSeen.add(hook.news_item);
        }
        cappedHooks.push(hook);
      }

      const lowSignalSuggestion = [
        `Low Signal: only ${signalCount} signal fact(s) found — only fundamentals available.`,
        "For better hooks, try fetching from:",
        `the company's press/newsroom page, blog/changelog, careers page, LinkedIn, or recent news articles.`,
      ].join(" ");

      // 7. Signal vs Fundamental gate: if low signal, return max 1 verification hook
      if (lowSignal) {
        const result = cappedHooks.slice(0, 1);
        return NextResponse.json({
          hooks: result.map((h) => h.hook),
          structured_hooks: result,
          citations,
          status: "ok" as CompanyResolutionStatus,
          lowSignal: true,
          signalCount,
          suggestion: lowSignalSuggestion,
          companyName: companyName ?? undefined,
        });
      }

      // 8. If nothing survived validation, return low signal
      if (cappedHooks.length === 0) {
        return NextResponse.json({
          hooks: [],
          structured_hooks: [],
          citations,
          status: "ok" as CompanyResolutionStatus,
          lowSignal: true,
          signalCount,
          suggestion: lowSignalSuggestion,
          companyName: companyName ?? undefined,
        });
      }

      // 9. Build response
      const flatHooks = cappedHooks.map((h) => h.hook);

      const resolvedCompany = resolution && resolution.candidates[0]
        ? {
            id: resolution.candidates[0].id,
            name: resolution.candidates[0].name,
            url: resolution.candidates[0].url,
            description: resolution.candidates[0].description,
            source: resolution.candidates[0].source,
          }
        : null;

      // Cache for next time (fire and forget)
      setCachedHooks(url, cappedHooks, citations).catch(() => {});

      return NextResponse.json({
        hooks: flatHooks,
        structured_hooks: cappedHooks,
        citations,
        status: "ok" as CompanyResolutionStatus,
        lowSignal: false,
        signalCount,
        companyName: companyName ?? undefined,
        resolvedCompany,
      });
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
  } catch (error) {
    console.error("Unexpected error in /api/generate-hooks", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating hooks." },
      { status: 500 },
    );
  }
}
