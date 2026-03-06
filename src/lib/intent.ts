// ---------------------------------------------------------------------------
// Intent Signal Research — Brave Search + Claude extraction
// ---------------------------------------------------------------------------

export type IntentSignalType = "hiring" | "funding" | "tech_change" | "growth" | "news";

export type IntentSignal = {
  type: IntentSignalType;
  summary: string;
  confidence: number;
  sourceUrl: string;
  detectedAt: string;
  rawEvidence: string;
};

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

export function buildHiringQuery(companyName: string, domain: string): string {
  return `"${companyName}" (hiring OR careers OR "open roles" OR "we're hiring" OR "job openings") -site:${domain}`;
}

export function buildFundingQuery(companyName: string, domain: string): string {
  return `"${companyName}" (funding OR raised OR "series" OR acquisition OR revenue OR IPO) -site:${domain}`;
}

export function buildTechChangeQuery(companyName: string, domain: string): string {
  return `"${companyName}" (migrated OR switched OR adopted OR integration OR "now using" OR "replaced") -site:${domain}`;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

const SIGNAL_POINTS: Record<IntentSignalType, number> = {
  hiring: 25,
  funding: 20,
  tech_change: 15,
  growth: 15,
  news: 10,
};

const COMPOUND_BONUS = 15;
const RECENCY_BONUS = 10;

export function computeIntentScore(signals: IntentSignal[]): number {
  if (signals.length === 0) return 0;

  let score = 0;

  const byType = new Map<IntentSignalType, IntentSignal>();
  for (const s of signals) {
    const existing = byType.get(s.type);
    if (!existing || s.confidence > existing.confidence) {
      byType.set(s.type, s);
    }
  }

  for (const [type, signal] of byType) {
    score += Math.round(SIGNAL_POINTS[type] * signal.confidence);
  }

  if (byType.size >= 3) {
    score += COMPOUND_BONUS;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const hasRecent = signals.some((s) => {
    const d = new Date(s.detectedAt).getTime();
    return !isNaN(d) && d > sevenDaysAgo;
  });
  if (hasRecent) {
    score += RECENCY_BONUS;
  }

  return Math.min(score, 100);
}

export function getTemperature(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

// ---------------------------------------------------------------------------
// Brave Search → Claude extraction pipeline
// ---------------------------------------------------------------------------

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
  page_age?: string;
};

async function searchBrave(
  query: string,
  apiKey: string,
  count = 5,
): Promise<BraveWebResult[]> {
  const params = new URLSearchParams({
    q: query,
    count: String(count),
    freshness: "pm",
  });

  const res = await fetch(
    `https://api.search.brave.com/res/v1/web/search?${params}`,
    {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
    },
  );

  if (!res.ok) return [];
  const data = await res.json();
  return (data.web?.results || []) as BraveWebResult[];
}

const EXTRACTION_PROMPT = `You are an intent-signal extractor. Given search results about a company, identify buying signals.

For each signal found, return a JSON array of objects:
{
  "type": "hiring" | "funding" | "tech_change" | "growth" | "news",
  "summary": "One sentence describing the signal",
  "confidence": 0.0-1.0,
  "source_url": "URL where signal was found",
  "detected_at": "ISO date when the event occurred (best estimate)",
  "raw_evidence": "The exact text snippet that proves this signal"
}

Rules:
- Only include signals with clear evidence (no speculation)
- Confidence reflects how certain the evidence is (0.9+ = explicit mention, 0.5-0.8 = implied)
- If no signals found, return an empty array: []
- Return ONLY valid JSON array, no markdown or extra text`;

async function extractSignals(
  searchResults: BraveWebResult[],
  companyName: string,
  queryType: string,
  claudeApiKey: string,
): Promise<IntentSignal[]> {
  if (searchResults.length === 0) return [];

  const context = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || r.snippet || ""}`)
    .join("\n\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Company: ${companyName}\nQuery type: ${queryType}\n\nSearch results:\n${context}`,
        },
      ],
    }),
  });

  if (!res.ok) return [];

  const data = await res.json();
  const text = data.content?.[0]?.text || "[]";

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((s: Record<string, unknown>) => ({
      type: (s.type as IntentSignalType) || "news",
      summary: String(s.summary || ""),
      confidence: Number(s.confidence) || 0.5,
      sourceUrl: String(s.source_url || ""),
      detectedAt: String(s.detected_at || new Date().toISOString()),
      rawEvidence: String(s.raw_evidence || ""),
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function researchIntentSignals(
  companyUrl: string,
  companyName: string,
  braveApiKey: string,
  claudeApiKey: string,
): Promise<IntentSignal[]> {
  let domain: string;
  try {
    domain = new URL(companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`).hostname.replace(/^www\./, "");
  } catch {
    domain = companyUrl;
  }

  const [hiringResults, fundingResults, techResults] = await Promise.all([
    searchBrave(buildHiringQuery(companyName, domain), braveApiKey),
    searchBrave(buildFundingQuery(companyName, domain), braveApiKey),
    searchBrave(buildTechChangeQuery(companyName, domain), braveApiKey),
  ]);

  const [hiringSignals, fundingSignals, techSignals] = await Promise.all([
    extractSignals(hiringResults, companyName, "hiring", claudeApiKey),
    extractSignals(fundingResults, companyName, "funding", claudeApiKey),
    extractSignals(techResults, companyName, "tech_change", claudeApiKey),
  ]);

  return [...hiringSignals, ...fundingSignals, ...techSignals];
}
