import { NextResponse } from "next/server";
import { SALES_AGENT_SYSTEM_PROMPT } from "@/lib/sales-agent";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getClaudeApiKey } from "@/lib/env";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatRequest = {
  messages: ChatMessage[];
};

type DemoResult = {
  hooks: Array<{
    hook: string;
    angle: string;
    confidence: string;
    evidence_tier: string;
    evidence_snippet?: string;
    source_url?: string;
    psych_mode?: string;
  }>;
  suggestion?: string;
  lowSignal?: boolean;
};

async function runDemo(url: string): Promise<DemoResult | null> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const res = await fetch(`${baseUrl}/api/generate-hooks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      hooks: data.structured_hooks || [],
      suggestion: data.suggestion,
      lowSignal: data.lowSignal,
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(getClientIp(request), "public:sales-chat");
  if (rateLimited) return rateLimited;

  try {
    const body = (await request.json()) as ChatRequest | null;
    if (!body?.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const claudeApiKey = getClaudeApiKey();
    if (!claudeApiKey) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 },
      );
    }

    // Limit conversation length to prevent abuse
    const recentMessages = body.messages.slice(-20);

    // Call Claude for the response
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SALES_AGENT_SYSTEM_PROMPT,
        messages: recentMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error("Claude API error in sales-chat:", err);
      return NextResponse.json(
        { error: "Failed to generate response" },
        { status: 502 },
      );
    }

    const claudeData = (await claudeRes.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = claudeData.content
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("");

    // Check if the agent requested a demo
    const demoMatch = text.match(/DEMO_REQUEST::(\S+)/);
    if (demoMatch) {
      const demoUrl = demoMatch[1];
      const demoResult = await runDemo(demoUrl);

      if (demoResult && demoResult.hooks.length > 0) {
        // Format hooks for display
        const hookSummary = demoResult.hooks
          .slice(0, 5)
          .map((h, i) => {
            let line = `**Hook ${i + 1}** (${h.angle}, Tier ${h.evidence_tier})\n${h.hook}`;
            if (h.evidence_snippet) line += `\n> Evidence: "${h.evidence_snippet}"`;
            if (h.source_url) line += `\n> Source: ${h.source_url}`;
            return line;
          })
          .join("\n\n");

        const responseText = text.replace(/DEMO_REQUEST::\S+/, "").trim();
        const fullResponse = responseText
          ? `${responseText}\n\nHere are the hooks I generated for **${demoUrl}**:\n\n${hookSummary}\n\n${demoResult.lowSignal ? "Note: this was a low-signal result — the company doesn't have many recent public signals. Better sources (press releases, changelogs, case studies) would improve the output.\n\n" : ""}Want me to walk you through any of these, or try another company?`
          : `Here are the hooks I generated for **${demoUrl}**:\n\n${hookSummary}\n\n${demoResult.lowSignal ? "Note: this was a low-signal result — the company doesn't have many recent public signals.\n\n" : ""}Each hook has a cited source, evidence snippet, and tier rating. Want me to walk you through any of these, or try another URL?`;

        return NextResponse.json({
          message: fullResponse,
          demo: { url: demoUrl, hooks: demoResult.hooks.slice(0, 5) },
        });
      } else {
        const fallback = text.replace(/DEMO_REQUEST::\S+/, "").trim();
        return NextResponse.json({
          message: fallback
            ? `${fallback}\n\nI tried to generate hooks for ${demoUrl} but couldn't find enough public signals. This actually demonstrates one of our features — we tell you when evidence is weak rather than making things up. Try a larger company with more public presence, or sign up for the free trial to test it yourself.`
            : `I tried to generate hooks for ${demoUrl} but couldn't find enough public signals right now. This is actually a feature — we never fabricate hooks. Try a company with more public presence (press releases, blog posts, product updates), or sign up for the free plan to explore at your own pace.`,
        });
      }
    }

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error("Error in sales-chat:", error);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}
