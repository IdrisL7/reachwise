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

    // If a URL is provided, we behave as before and skip name resolution.
    // If only a company name is provided, we try to resolve it to a URL
    // using Brave Search and return disambiguation metadata when needed.

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
      // 1. Gather sources from Brave
      const sources = await fetchSources(url, braveApiKey!);

      // 2. Build prompts and call Claude
      const systemPrompt = buildSystemPrompt();
      const userPrompt = buildUserPrompt(url, sources, context);
      const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

      // 3. Quality gate
      const validHooks: Hook[] = [];
      for (const raw of rawHooks) {
        const validated = validateHook(raw);
        if (validated) validHooks.push(validated);
      }

      // 4. If nothing survived validation, fall back
      if (validHooks.length === 0) {
        console.warn("generate-hooks: No hooks passed quality gate, returning mock hooks.");
        return NextResponse.json({ hooks: fallbackHooks });
      }

      // 5. Build response — flattened hooks: string[] for frontend compat,
      //    plus structured_hooks and citations for future use
      const flatHooks = validHooks.map((h) => h.hook);

      const citations = sources.map((s) => ({
        source_title: s.title,
        publisher: s.publisher,
        date: s.date,
        url: s.url,
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
