// ---------------------------------------------------------------------------
// Shared types and helpers for hook generation
// ---------------------------------------------------------------------------

export type Angle = "pain" | "gain" | "contrast";
export type Confidence = "high" | "med" | "low";

export type Hook = {
  news_item: number;
  angle: Angle;
  hook: string;
  evidence_snippet: string;
  source_title: string;
  confidence: Confidence;
};

export type Source = {
  title: string;
  publisher: string;
  date: string;
  url: string;
  facts: string[];
};

export type CompanyCandidate = {
  id: string;
  name: string;
  url: string;
  description?: string;
  source?: string;
};

export type CompanyResolutionStatus = "ok" | "needs_disambiguation" | "no_match";

export type CompanyResolutionResult = {
  status: CompanyResolutionStatus;
  companyName: string;
  candidates: CompanyCandidate[];
};

export type ClaudeHookPayload = {
  news_item: number;
  angle: string;
  hook: string;
  evidence_snippet: string;
  source_title: string;
  confidence: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BANNED_WORDS = [
  "curious",
  "worth a quick",
  "just checking in",
  "hope you're well",
  "hope you are well",
  "touching base",
  "i'd love to",
  "i would love to",
  "quick question",
  "i came across",
  "i noticed your company",
  "game-changing",
  "innovative solution",
  "disrupting the space",
  "cutting-edge",
];

export const VALID_ANGLES: Angle[] = ["pain", "gain", "contrast"];
export const VALID_CONFIDENCES: Confidence[] = ["high", "med"];
export const MAX_HOOK_CHARS = 240;

const MOCK_HOOKS: string[] = [
  "Noticed {{url}} just revamped the product page — are you seeing the lift you expected in demo requests, or is there still friction in the funnel?",
  "Teams in your space usually lose 20–30% of qualified leads to slow follow-up. Is that something on the radar yet at {{url}}?",
  "Saw you are hiring across sales and CS — usually a sign of strong pipeline but also where outbound messaging starts to fragment. Have you standardized messaging across the new hires?",
];

// ---------------------------------------------------------------------------
// Brave search → structured sources
// ---------------------------------------------------------------------------

export async function fetchSources(
  url: string,
  apiKey: string,
): Promise<Source[]> {
  const query = `"${url}" OR site:${url}`;

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      next: { revalidate: 0 },
    } as RequestInit & { next?: { revalidate: number } },
  );

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    web?: {
      results?: BraveWebResult[];
    };
  };

  const webResults = data?.web?.results ?? [];

  const sources: Source[] = webResults
    .map((r) => {
      const facts: string[] = [];
      if (r.description?.trim()) facts.push(r.description.trim());
      if (r.snippet?.trim() && r.snippet.trim() !== r.description?.trim()) {
        facts.push(r.snippet.trim());
      }
      if (facts.length === 0) return null;

      const fallbackUrl = r.url || url;
      let publisher = "";
      try {
        publisher = r.meta_url?.hostname || new URL(fallbackUrl).hostname;
      } catch {
        publisher = r.meta_url?.hostname || fallbackUrl;
      }

      return {
        title: (r.title || "Untitled").trim(),
        publisher,
        date: r.page_age || "",
        url: r.url || "",
        facts,
      };
    })
    .filter((s): s is Source => s !== null)
    .slice(0, 6);

  return sources;
}

// ---------------------------------------------------------------------------
// Brave search → company name resolution
// ---------------------------------------------------------------------------

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
  page_age?: string;
  meta_url?: { hostname?: string };
};

export function computeCompanyResolution(
  companyName: string,
  webResults: BraveWebResult[],
): CompanyResolutionResult {
  const normalizedName = companyName.trim();

  if (!normalizedName) {
    return {
      status: "no_match",
      companyName: "",
      candidates: [],
    };
  }

  const seenHostnames = new Set<string>();

  const candidates: CompanyCandidate[] = [];
  for (let index = 0; index < webResults.length; index++) {
    const r = webResults[index];
    const title = (r.title || "").trim();
    const description = (r.description || r.snippet || "").trim();
    const rawUrl = (r.url || "").trim();
    const hostname = r.meta_url?.hostname || (rawUrl ? (() => {
      try {
        return new URL(rawUrl).hostname;
      } catch {
        return "";
      }
    })() : "");

    if (!rawUrl || !hostname) continue;
    if (seenHostnames.has(hostname)) continue;
    seenHostnames.add(hostname);

    const nameFromTitle = title || hostname;

    candidates.push({
      id: `${index}-${hostname}`,
      name: nameFromTitle,
      url: rawUrl,
      description: description || undefined,
      source: hostname,
    });
  }

  if (candidates.length === 0) {
    return {
      status: "no_match",
      companyName: normalizedName,
      candidates: [],
    };
  }

  if (candidates.length === 1) {
    return {
      status: "ok",
      companyName: normalizedName,
      candidates,
    };
  }

  return {
    status: "needs_disambiguation",
    companyName: normalizedName,
    candidates,
  };
}

export async function resolveCompanyByName(
  companyName: string,
  apiKey: string,
): Promise<CompanyResolutionResult> {
  const query = companyName.trim();

  if (!query) {
    return {
      status: "no_match",
      companyName: "",
      candidates: [],
    };
  }

  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      next: { revalidate: 0 },
    } as RequestInit & { next?: { revalidate: number } },
  );

  if (!response.ok) {
    throw new Error(`Brave API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    web?: { results?: BraveWebResult[] };
  };

  const webResults = data?.web?.results ?? [];
  return computeCompanyResolution(companyName, webResults);
}

// ---------------------------------------------------------------------------
// Build the Claude prompt
// ---------------------------------------------------------------------------

export function buildSystemPrompt(): string {
  return [
    "You are an elite SDR copywriter. You turn structured company research into cold email opening hooks.",
    "",
    "## Hook structure",
    "Every hook MUST follow the Signal → Implication → Question pattern:",
    "1. Signal: a concrete, factual observation drawn from the provided sources.",
    "2. Implication: what that signal means for the prospect (pain if ignored, gain if acted on, or a contrast between current and possible state).",
    "3. Question: end with a binary (yes/no) or specific question.",
    "",
    "## Three angles per news item",
    "For EACH news item / source you are given, produce exactly 3 hooks:",
    "- pain: Signal → negative implication if ignored → binary question.",
    "- gain: Signal → upside if acted on → specific question.",
    "- contrast: Signal → gap between current and possible state → binary question.",
    "",
    "## Quality rules (HARD constraints — violating any one means the hook is rejected)",
    "- Max 240 characters per hook. 1–2 sentences.",
    "- Must include at least one concrete detail: a number, named initiative, product term, partner name, location, or timeline from the source facts.",
    "- Must end with a question mark.",
    "- BANNED phrases (never use any of these, even paraphrased):",
    "  curious, worth a quick, just checking in, hope you're well, touching base,",
    "  I'd love to, quick question, I came across, I noticed your company,",
    "  game-changing, innovative solution, disrupting the space, cutting-edge.",
    "- Do not invent facts. Only reference details present in the provided source facts.",
    "",
    "## Confidence scoring",
    "- high: the source fact is specific and recent (named event, metric, date within last 6 months).",
    "- med: fact is real but somewhat generic or older.",
    "- low: you are stretching or inferring beyond what the facts state.",
    "Only output hooks where confidence is high or med. Never output low-confidence hooks.",
    "",
    "## Output format",
    "Return ONLY a JSON array. No markdown fences, no commentary. Each element:",
    '{  "news_item": <1-indexed source number>,',
    '   "angle": "pain" | "gain" | "contrast",',
    '   "hook": "<the hook text>",',
    '   "evidence_snippet": "<the source fact you drew from>",',
    '   "source_title": "<title of the source>",',
    '   "confidence": "high" | "med"',
    "}",
  ].join("\n");
}

export function buildUserPrompt(
  url: string,
  sources: Source[],
  context?: string,
): string {
  const sourcesBlock = sources
    .map(
      (s, i) =>
        [
          `### Source ${i + 1}: ${s.title}`,
          `Publisher: ${s.publisher}`,
          s.date ? `Date: ${s.date}` : null,
          `URL: ${s.url}`,
          "Facts:",
          ...s.facts.map((f) => `- ${f}`),
        ]
          .filter(Boolean)
          .join("\n"),
    )
    .join("\n\n");

  const contextBlock = context
    ? `\n\n### Salesperson context\n${context}`
    : "";

  return [
    `Prospect URL: ${url}`,
    "",
    "### Sources",
    sourcesBlock || "(No sources found — generate hooks only if you can rely on well-known public facts about this company. Otherwise return an empty array.)",
    contextBlock,
    "",
    `Generate hooks now. Return a JSON array and nothing else.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Call Claude Messages API
// ---------------------------------------------------------------------------

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<ClaudeHookPayload[]> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Strip markdown fences if Claude added them despite instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error("Claude did not return a JSON array");
  }

  return parsed as ClaudeHookPayload[];
}

// ---------------------------------------------------------------------------
// Call Claude for freeform text (emails, etc.)
// ---------------------------------------------------------------------------

export async function callClaudeText(
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
  maxTokens = 1500,
): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Anthropic API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as {
    content: { type: string; text: string }[];
  };

  return data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
}

// ---------------------------------------------------------------------------
// Quality gate — post-generation validation
// ---------------------------------------------------------------------------

export function containsBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_WORDS) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

export function validateHook(raw: ClaudeHookPayload): Hook | null {
  // Angle check
  const angle = raw.angle?.toLowerCase() as Angle;
  if (!VALID_ANGLES.includes(angle)) return null;

  // Confidence filter (high or med only)
  const confidence = raw.confidence?.toLowerCase() as Confidence;
  if (!VALID_CONFIDENCES.includes(confidence)) return null;

  const hook = (raw.hook || "").trim();

  // Length check
  if (hook.length === 0 || hook.length > MAX_HOOK_CHARS) return null;

  // Must end with a question
  if (!hook.endsWith("?")) return null;

  // Banned phrase check
  if (containsBannedPhrase(hook) !== null) return null;

  return {
    news_item: typeof raw.news_item === "number" ? raw.news_item : 1,
    angle,
    hook,
    evidence_snippet: (raw.evidence_snippet || "").trim(),
    source_title: (raw.source_title || "").trim(),
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Fallback mock hooks
// ---------------------------------------------------------------------------

export function applyUrlToMockHooks(url: string): string[] {
  return MOCK_HOOKS.map((h) => h.replace(/{{url}}/g, url));
}

// ---------------------------------------------------------------------------
// High-level: generate hooks for a single URL (used by batch route)
// ---------------------------------------------------------------------------

export async function generateHooksForUrl(opts: {
  url: string;
  pitchContext?: string;
  count?: number;
}): Promise<Hook[]> {
  const braveApiKey = process.env.BRAVE_API_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;

  if (!braveApiKey || !claudeApiKey) {
    throw new Error("Missing BRAVE_API_KEY or CLAUDE_API_KEY");
  }

  const sources = await fetchSources(opts.url, braveApiKey);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(opts.url, sources, opts.pitchContext);
  const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

  const validHooks: Hook[] = [];
  for (const raw of rawHooks) {
    const validated = validateHook(raw);
    if (validated) validHooks.push(validated);
  }

  const limit = opts.count ?? validHooks.length;
  return validHooks.slice(0, limit);
}
