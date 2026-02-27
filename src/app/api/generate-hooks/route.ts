import { NextResponse } from "next/server";
import {
  fetchSources,
  buildSystemPrompt,
  buildUserPrompt,
  callClaude,
  validateHook,
  applyUrlToMockHooks,
  type Hook,
} from "@/lib/hooks";

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      url?: string;
      context?: string;
    } | null;

    const url = body?.url?.trim();
    const context = body?.context?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' in request body." },
        { status: 400 },
      );
    }

    const braveApiKey = process.env.BRAVE_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    const fallbackHooks = applyUrlToMockHooks(url);

    if (!braveApiKey || !claudeApiKey) {
      console.warn(
        "generate-hooks: Missing BRAVE_API_KEY or CLAUDE_API_KEY, returning mock hooks.",
      );
      await new Promise((r) => setTimeout(r, 800));
      return NextResponse.json({ hooks: fallbackHooks });
    }

    try {
      // 1. Gather sources from Brave
      const sources = await fetchSources(url, braveApiKey);

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

      return NextResponse.json({
        hooks: flatHooks,
        structured_hooks: validHooks,
        citations,
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
