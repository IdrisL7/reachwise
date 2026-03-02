import { NextResponse } from "next/server";
import {
  fetchSources,
  buildSystemPrompt,
  buildUserPrompt,
  callClaude,
  validateHook,
  applyUrlToMockHooks,
  resolveCompanyByName,
  type Hook,
  type CompanyResolutionResult,
  type ClassifiedSource,
} from "@/lib/hooks";
import type { CompanyResolutionStatus } from "@/lib/types";

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

    const braveApiKey = process.env.BRAVE_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;

    if (!rawUrl && !companyName) {
      return NextResponse.json(
        { error: "Provide either 'url' or 'companyName' in request body." },
        { status: 400 },
      );
    }

    if (!braveApiKey || !claudeApiKey) {
      if (rawUrl) {
        const fallbackHooks = applyUrlToMockHooks(rawUrl);
        console.warn(
          "generate-hooks: Missing BRAVE_API_KEY or CLAUDE_API_KEY, returning mock hooks.",
        );
        await new Promise((r) => setTimeout(r, 800));
        return NextResponse.json({ hooks: fallbackHooks });
      }

      return NextResponse.json(
        {
          error:
            "Server misconfiguration: cannot resolve companyName without BRAVE_API_KEY and CLAUDE_API_KEY.",
        },
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

    const fallbackHooks = applyUrlToMockHooks(url);

    try {
      // 1. Gather and classify sources from Brave
      const sources = await fetchSources(url, braveApiKey!);

      // 2. Check if all sources are Tier C (insufficient evidence)
      const usableSources = sources.filter((s) => s.tier !== "C");
      if (usableSources.length === 0) {
        return NextResponse.json({
          hooks: [],
          structured_hooks: [],
          citations: sources.map((s) => ({
            source_title: s.title,
            publisher: s.publisher,
            date: s.date,
            url: s.url,
            tier: s.tier,
          })),
          status: "ok" as CompanyResolutionStatus,
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

      // 5. Quality gate
      const validHooks: Hook[] = [];
      for (const raw of rawHooks) {
        const validated = validateHook(raw, sourceLookup);
        if (validated) validHooks.push(validated);
      }

      // 6. If nothing survived validation, fall back
      if (validHooks.length === 0) {
        console.warn("generate-hooks: No hooks passed quality gate, returning mock hooks.");
        return NextResponse.json({ hooks: fallbackHooks });
      }

      // 7. Build response
      const flatHooks = validHooks.map((h) => h.hook);

      const citations = sources.map((s) => ({
        source_title: s.title,
        publisher: s.publisher,
        date: s.date,
        url: s.url,
        tier: s.tier,
      }));

      const resolvedCompany = resolution && resolution.candidates[0]
        ? {
            id: resolution.candidates[0].id,
            name: resolution.candidates[0].name,
            url: resolution.candidates[0].url,
            description: resolution.candidates[0].description,
            source: resolution.candidates[0].source,
          }
        : null;

      return NextResponse.json({
        hooks: flatHooks,
        structured_hooks: validHooks,
        citations,
        status: "ok" as CompanyResolutionStatus,
        companyName: companyName ?? undefined,
        resolvedCompany,
      });
    } catch (error) {
      console.error("generate-hooks: Error during external calls", error);
      await new Promise((r) => setTimeout(r, 800));
      return NextResponse.json({ hooks: fallbackHooks });
    }
  } catch (error) {
    console.error("Unexpected error in /api/generate-hooks", error);
    return NextResponse.json(
      { error: "Unexpected server error while generating hooks." },
      { status: 500 },
    );
  }
}
