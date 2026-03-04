// ---------------------------------------------------------------------------
// Shared types and helpers for hook generation
// ---------------------------------------------------------------------------

import type { EvidenceTier } from "./types";

export type Angle = "trigger" | "risk" | "tradeoff";
export type Confidence = "high" | "med" | "low";

export type Hook = {
  news_item: number;
  angle: Angle;
  hook: string;
  evidence_snippet: string;
  source_title: string;
  source_date: string;
  source_url: string;
  evidence_tier: EvidenceTier;
  confidence: Confidence;
};

export type Source = {
  title: string;
  publisher: string;
  date: string;
  url: string;
  facts: string[];
};

export type ClassifiedSource = Source & {
  tier: EvidenceTier;
  stale?: boolean;
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
  source_date: string;
  source_url: string;
  evidence_tier: string;
  confidence: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const BANNED_WORDS = [
  "curious",
  "worth a quick",
  "just checking in",
  "just checking",
  "hope you're well",
  "hope you are well",
  "touching base",
  "i'd love to",
  "i would love to",
  "quick question",
  "quick chat",
  "i came across",
  "i noticed your company",
  "game-changing",
  "innovative solution",
  "disrupting the space",
  "cutting-edge",
  "interested in",
  "teams like you",
  "on your radar",
];

export const VALID_ANGLES: Angle[] = ["trigger", "risk", "tradeoff"];
export const VALID_CONFIDENCES: Confidence[] = ["high", "med"];
export const MAX_HOOK_CHARS = 240;

const MOCK_HOOKS: string[] = [
  "Noticed {{url}} just revamped the product page — are you seeing the lift you expected in demo requests, or is there still friction in the funnel?",
  "Teams in your space usually lose 20–30% of qualified leads to slow follow-up. Is that something on the radar yet at {{url}}?",
  "Saw you are hiring across sales and CS — usually a sign of strong pipeline but also where outbound messaging starts to fragment. Have you standardized messaging across the new hires?",
];

// Signal keywords for classifying facts as signal vs fundamental
const SIGNAL_KEYWORDS = [
  "announced", "announces", "announcing",
  "launched", "launches", "launching",
  "released", "releases", "releasing",
  "acquired", "acquires", "acquisition",
  "raised", "funding", "series",
  "hired", "hiring", "hires", "job posting",
  "partnered", "partnership", "partners with",
  "expanded", "expands", "expansion",
  "introduced", "introduces", "introducing",
  "updated", "updates", "update",
  "now supports", "added support",
  "migrated", "migration",
  "closed", "closing",
  "won", "awarded",
  "rebranded", "rebrand",
  "merged", "merger",
  "opened", "opening",
  "deprecated", "sunset",
  "Q1", "Q2", "Q3", "Q4",
  "revenue", "ARR", "MRR",
  "customers", "users",
  "headcount", "employees",
  "valuation",
];

// ---------------------------------------------------------------------------
// Company name extraction from URL
// ---------------------------------------------------------------------------

export function extractCompanyName(url: string): string {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    // Remove www. and TLD
    const parts = hostname.replace(/^www\./, "").split(".");
    const name = parts[0] || "";
    // Convert hyphens to spaces, capitalize
    return name
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0].split(".")[0] || url;
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Evidence tier classification
// ---------------------------------------------------------------------------

const TIER_A_URL_PATTERNS = [
  /\/press/i,
  /\/newsroom/i,
  /\/blog\//i,
  /\/changelog/i,
  /\/release-notes/i,
  /\/releases/i,
  /\/investor/i,
  /\/earnings/i,
  /\/case-stud/i,
  /\/careers/i,
  /\/jobs\//i,
  /\/announcements/i,
  /\/whats-new/i,
];

const TIER_A_TITLE_PATTERNS = [
  /press release/i,
  /\bannounces?\b/i,
  /\blaunches?\b/i,
  /\bQ[1-4]\b/,
  /\bearnings\b/i,
  /\bchangelog\b/i,
  /\brelease notes?\b/i,
  /\bcase study\b/i,
  /\bpartnership\b/i,
  /\bhiring\b/i,
  /\braises?\b.*\$\d/i,
  /\bacquires?\b/i,
  /\bacquisition\b/i,
  /\bIPO\b/,
  /\bnew feature\b/i,
  /\bproduct update\b/i,
];

const TIER_C_URL_PATTERNS = [
  /crunchbase\.com/i,
  /zoominfo\.com/i,
  /similarweb\.com/i,
  /owler\.com/i,
  /pitchbook\.com/i,
  /dnb\.com/i,
  /glassdoor\.com/i,
  /wikipedia\.org/i,
];

/** Returns true if the facts contain concrete specifics (numbers, dates, dollar amounts). */
function factsHaveSpecifics(facts: string[]): boolean {
  const joined = facts.join(" ");
  if (/\d/.test(joined)) return true;
  if (/Q[1-4]/i.test(joined)) return true;
  return false;
}

/** Check if a source's date makes it stale (>90 days old). */
function isStale(dateStr: string): boolean {
  if (!dateStr) return false; // Unknown date ≠ stale (handled separately)
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return false;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    return date.getTime() < ninetyDaysAgo;
  } catch {
    return false;
  }
}

/**
 * Classify a source into evidence tiers with recency awareness.
 * Company-site sources from prong C are NOT auto Tier A — they need
 * dated + specific change/intent to earn Tier A.
 */
export function classifySource(source: Source, isCompanySite = false): EvidenceTier {
  // Tier C: aggregator/scraper sites
  for (const pattern of TIER_C_URL_PATTERNS) {
    if (pattern.test(source.url)) return "C";
  }

  // Tier C: no facts or trivially short
  if (source.facts.length === 0) return "C";
  if (source.facts.every((f) => f.trim().length < 20)) return "C";

  // Homepage or generic marketing pages → always B or C
  const urlLower = source.url.toLowerCase();
  const isHomepage = /^https?:\/\/[^/]+\/?$/.test(urlLower);
  const isGenericPage = /\/(about|solutions|platform|products|features|pricing|why-|overview)\b/i.test(urlLower);
  if (isHomepage || isGenericPage) return "B";

  // For company-site sources (prong C): require date + signal content for Tier A
  if (isCompanySite) {
    const hasDate = !!source.date;
    const hasSignalContent = factsContainSignals(source.facts);
    if (hasDate && hasSignalContent && factsHaveSpecifics(source.facts)) return "A";
    return "B";
  }

  // Tier A: URL pattern match
  for (const pattern of TIER_A_URL_PATTERNS) {
    if (pattern.test(source.url)) return "A";
  }

  // Tier A: title pattern match
  for (const pattern of TIER_A_TITLE_PATTERNS) {
    if (pattern.test(source.title)) return "A";
  }

  // Tier A: has date + concrete specifics
  if (source.date && factsHaveSpecifics(source.facts)) return "A";

  // Tier C: no date and no specifics
  if (!source.date && !factsHaveSpecifics(source.facts)) return "C";

  // Default: B
  return "B";
}

/**
 * Apply stale downgrade: A→B, B→C for sources older than 90 days.
 * Sources with no date get capped at Tier B.
 */
function applyRecencyDowngrade(source: ClassifiedSource): ClassifiedSource {
  const stale = isStale(source.date);
  const noDate = !source.date;

  if (stale) {
    const downgraded: EvidenceTier = source.tier === "A" ? "B" : "C";
    return { ...source, tier: downgraded, stale: true };
  }

  // No date and no specifics → don't assume recency, cap at B
  if (noDate && source.tier === "A") {
    return { ...source, tier: "B" };
  }

  return source;
}

// ---------------------------------------------------------------------------
// Signal vs Fundamental classification
// ---------------------------------------------------------------------------

/** Check if facts contain signal keywords (change/intent/event). */
function factsContainSignals(facts: string[]): boolean {
  const joined = facts.join(" ").toLowerCase();
  return SIGNAL_KEYWORDS.some((kw) => joined.includes(kw.toLowerCase()));
}

export type FactClassification = "signal" | "fundamental";

/** Classify a single fact as signal or fundamental. */
export function classifyFact(fact: string): FactClassification {
  const lower = fact.toLowerCase();
  if (SIGNAL_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()))) {
    return "signal";
  }
  return "fundamental";
}

/** Count signal facts across all sources. */
export function countSignalFacts(sources: ClassifiedSource[]): number {
  let count = 0;
  for (const source of sources) {
    for (const fact of source.facts) {
      if (classifyFact(fact) === "signal") count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Brave API helpers
// ---------------------------------------------------------------------------

type BraveWebResult = {
  title?: string;
  url?: string;
  description?: string;
  snippet?: string;
  page_age?: string;
  meta_url?: { hostname?: string };
};

type BraveNewsResult = {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  meta_url?: { hostname?: string };
};

function braveHeaders(apiKey: string) {
  return {
    Accept: "application/json",
    "Accept-Encoding": "gzip",
    "X-Subscription-Token": apiKey,
  };
}

function webResultToSource(r: BraveWebResult, fallbackUrl: string): Source | null {
  const facts: string[] = [];
  if (r.description?.trim()) facts.push(r.description.trim());
  if (r.snippet?.trim() && r.snippet.trim() !== r.description?.trim()) {
    facts.push(r.snippet.trim());
  }
  if (facts.length === 0) return null;

  let publisher = "";
  try {
    publisher = r.meta_url?.hostname || new URL(r.url || fallbackUrl).hostname;
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
}

function newsResultToSource(r: BraveNewsResult): Source | null {
  if (!r.description?.trim() && !r.title?.trim()) return null;

  const facts: string[] = [];
  if (r.description?.trim()) facts.push(r.description.trim());

  let publisher = "";
  try {
    publisher = r.meta_url?.hostname || (r.url ? new URL(r.url).hostname : "");
  } catch {
    publisher = r.meta_url?.hostname || "";
  }

  return {
    title: (r.title || "Untitled").trim(),
    publisher,
    date: r.age || "",
    url: r.url || "",
    facts,
  };
}

// ---------------------------------------------------------------------------
// Prong A: Brave News Search
// ---------------------------------------------------------------------------

async function fetchNewsSignals(
  companyName: string,
  domain: string,
  apiKey: string,
): Promise<ClassifiedSource[]> {
  const query = `("${companyName}" OR "${domain}") -site:${domain}`;
  const freshnessList = ["pm", "pq", "py"]; // month → quarter → year

  for (const freshness of freshnessList) {
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=15&freshness=${freshness}`,
        { headers: braveHeaders(apiKey) },
      );

      if (!response.ok) continue;

      const data = (await response.json()) as {
        results?: BraveNewsResult[];
      };

      const results = data?.results ?? [];
      const sources = results
        .map((r) => newsResultToSource(r))
        .filter((s): s is Source => s !== null)
        .map((s) => applyRecencyDowngrade({ ...s, tier: classifySource(s) }));

      if (sources.length >= 3 || freshness === "py") return sources;
      // Expand freshness if too few results
    } catch {
      continue;
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Prong B: Improved Web Search (event-focused, excludes company site)
// ---------------------------------------------------------------------------

async function fetchWebSignals(
  companyName: string,
  domain: string,
  apiKey: string,
): Promise<ClassifiedSource[]> {
  const eventVerbs = [
    "announced", "launches", "launched", "release", "released",
    "changelog", '"release notes"', "partnership", "partners",
    "hires", "hiring", '"job posting"', "funding",
    "acquired", "acquisition", '"now supports"', "introduces",
  ].join(" OR ");

  const query = `("${companyName}" OR "${domain}") (${eventVerbs}) -site:${domain}`;
  const freshnessList = ["pm", "pq"];

  for (const freshness of freshnessList) {
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=${freshness}`,
        { headers: braveHeaders(apiKey) },
      );

      if (!response.ok) continue;

      const data = (await response.json()) as { web?: { results?: BraveWebResult[] } };
      const results = data?.web?.results ?? [];

      const sources = results
        .map((r) => webResultToSource(r, domain))
        .filter((s): s is Source => s !== null)
        .map((s) => applyRecencyDowngrade({ ...s, tier: classifySource(s) }));

      if (sources.length >= 3 || freshness === "pq") return sources;
    } catch {
      continue;
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// Prong C: Company's Own Signals (blog, press, changelog, careers)
// ---------------------------------------------------------------------------

async function fetchCompanyOwnSignals(
  domain: string,
  apiKey: string,
): Promise<ClassifiedSource[]> {
  const signalPaths = [
    "changelog", '"release notes"', "press", "newsroom",
    "blog", "careers", "jobs", "partners", "integrations", '"case study"',
  ].join(" OR ");

  const query = `site:${domain} (${signalPaths})`;

  try {
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10&freshness=pm`,
      { headers: braveHeaders(apiKey) },
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { web?: { results?: BraveWebResult[] } };
    const results = data?.web?.results ?? [];

    return results
      .map((r) => webResultToSource(r, domain))
      .filter((s): s is Source => s !== null)
      .map((s) => applyRecencyDowngrade({
        ...s,
        tier: classifySource(s, true), // isCompanySite=true → stricter Tier A rules
      }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Merge & Deduplicate
// ---------------------------------------------------------------------------

function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Strip tracking params
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "ref", "source"];
    trackingParams.forEach((p) => u.searchParams.delete(p));
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/$/, "") + u.search;
  } catch {
    return url;
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateSources(sources: ClassifiedSource[]): ClassifiedSource[] {
  const seen = new Map<string, ClassifiedSource>();
  const seenTitles = new Set<string>();
  const seenDomainPaths = new Set<string>();

  for (const source of sources) {
    const canonUrl = canonicalizeUrl(source.url);
    const normTitle = normalizeTitle(source.title);
    const domainPath = canonUrl.split("?")[0]; // URL without query string

    // Skip if we've seen this URL, title, or domain+path
    if (seen.has(canonUrl)) continue;
    if (normTitle.length > 10 && seenTitles.has(normTitle)) continue;
    if (seenDomainPaths.has(domainPath)) continue;

    seen.set(canonUrl, source);
    if (normTitle.length > 10) seenTitles.add(normTitle);
    seenDomainPaths.add(domainPath);
  }

  return Array.from(seen.values());
}

/** Score a source for ranking (higher = better). */
function scoreSource(source: ClassifiedSource): number {
  let score = 0;

  // Tier
  if (source.tier === "A") score += 30;
  else if (source.tier === "B") score += 10;

  // Recency
  if (!source.stale) score += 20;

  // Signal content
  const signalCount = source.facts.filter((f) => classifyFact(f) === "signal").length;
  score += signalCount * 10;

  // Specificity (numbers, named products)
  if (factsHaveSpecifics(source.facts)) score += 5;

  return score;
}

// ---------------------------------------------------------------------------
// Main fetchSources: three-pronged, merged, deduplicated, gated
// ---------------------------------------------------------------------------

export type FetchSourcesResult = {
  sources: ClassifiedSource[];
  signalCount: number;
  lowSignal: boolean;
};

export async function fetchSources(
  url: string,
  apiKey: string,
): Promise<ClassifiedSource[]> {
  const result = await fetchSourcesWithGating(url, apiKey);
  return result.sources;
}

export async function fetchSourcesWithGating(
  url: string,
  apiKey: string,
): Promise<FetchSourcesResult> {
  const domain = getDomain(url);
  const companyName = extractCompanyName(url);

  // Run all three prongs in parallel
  const [newsResults, webResults, companyResults] = await Promise.all([
    fetchNewsSignals(companyName, domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchWebSignals(companyName, domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchCompanyOwnSignals(domain, apiKey).catch(() => [] as ClassifiedSource[]),
  ]);

  // Merge all sources
  const allSources = [...newsResults, ...webResults, ...companyResults];

  // Deduplicate
  const deduped = deduplicateSources(allSources);

  // Rank by score and take top 10
  const ranked = deduped
    .sort((a, b) => scoreSource(b) - scoreSource(a))
    .slice(0, 10);

  // Count signal facts for gating
  const signalCount = countSignalFacts(ranked);

  return {
    sources: ranked,
    signalCount,
    lowSignal: signalCount < 2,
  };
}

// ---------------------------------------------------------------------------
// Brave search → company name resolution (unchanged)
// ---------------------------------------------------------------------------

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
      headers: braveHeaders(apiKey),
    },
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
    "1. Signal: a concrete, factual observation drawn ONLY from the provided source facts.",
    "2. Implication: what that signal means for the prospect.",
    "3. Question: end with a binary (yes/no) or highly specific question (answerable in under 5 seconds).",
    "",
    "## Evidence tier rules",
    "Each source is classified into a tier. Follow these rules strictly:",
    "",
    "### Tier A sources (strong evidence)",
    "Generate exactly 3 hooks per source, one for each angle:",
    "- trigger: what changed (launch, hire, announcement, product update, funding) → question about timing or readiness.",
    "- risk: what breaks, leaks, or degrades if the change is ignored (cost, speed, quality, compliance, conversion) → binary question.",
    "- tradeoff: two valid paths the company could take (platform shift vs point tools; centralize vs federate; speed vs accuracy) → specific question about which direction.",
    "",
    "### Tier B sources (weak/generic evidence)",
    "Generate exactly 1 verification hook per source using the 'trigger' angle only.",
    "Verification hooks are soft and non-assertive:",
    '- Format: "It sounds like [observation from source]. Did I get that right?" or similar.',
    "- Do NOT assert pain or problems. Only verify what the source says.",
    "- Still must include a specificity token (see below).",
    "",
    "### Tier C sources",
    "Do NOT generate any hooks. Skip entirely.",
    "",
    "## No-assumptions rule (HARD constraint)",
    "- NEVER assert internal problems ('disconnected systems', 'fragmented touchpoints',",
    "  'your team struggles with...', 'your prospects struggle...') unless the source EXPLICITLY describes them.",
    "- If a claim is not directly supported by the evidence, either:",
    "  a) Convert it into a verification question: 'Did I get it right that...?'",
    "  b) Remove it entirely.",
    "- Do not use discovery-call bait or generic fluff.",
    "- Do not imply you know what's happening inside the company. Stick to what the source says.",
    "",
    "## Quality rules (HARD constraints — violating any one means the hook is rejected)",
    "- Max 240 characters per hook. 1–2 sentences.",
    "- Must end with a question mark.",
    "- No raw URLs in hook text.",
    "- BANNED phrases (never use any of these, even paraphrased):",
    "  curious, worth a quick, just checking in, just checking, hope you're well, touching base,",
    "  I'd love to, quick question, quick chat, I came across, I noticed your company,",
    "  game-changing, innovative solution, disrupting the space, cutting-edge,",
    "  interested in, teams like you, on your radar.",
    "- No generic benchmarking like 'X% better than peers' without explicit proof from the source.",
    "",
    "## Specificity token rule (MANDATORY)",
    "Each hook MUST include at least ONE of the following from the source evidence:",
    "- A number (e.g. '3 new SKUs', 'Q4', '2024')",
    "- A date or timeframe",
    "- A named product or module",
    "- A named initiative (e.g. 'Customer 360')",
    "- A named partner or customer",
    '- A quoted phrase from the source in double quotes',
    "- A concrete workflow term (e.g. lead routing, identity resolution, case deflection)",
    "",
    "If you cannot include any specificity token from the evidence, do NOT generate a hook for that source.",
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
    '   "angle": "trigger" | "risk" | "tradeoff",',
    '   "hook": "<the hook text>",',
    '   "evidence_snippet": "<the exact source fact you drew from>",',
    '   "source_title": "<title of the source>",',
    '   "source_date": "<date of the source, or empty string if unknown>",',
    '   "source_url": "<URL of the source>",',
    '   "evidence_tier": "A" | "B",',
    '   "confidence": "high" | "med"',
    "}",
  ].join("\n");
}

export function buildUserPrompt(
  url: string,
  sources: ClassifiedSource[],
  context?: string,
): string {
  // Filter out Tier C sources before sending to Claude
  const usableSources = sources.filter((s) => s.tier !== "C");

  const sourcesBlock = usableSources
    .map(
      (s, i) =>
        [
          `### Source ${i + 1}: ${s.title} [Tier ${s.tier}]${s.stale ? " [STALE]" : ""}`,
          `Publisher: ${s.publisher}`,
          s.date ? `Date: ${s.date}` : "Date: unknown",
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

  const allTierC = usableSources.length === 0;

  if (allTierC) {
    return [
      `Prospect URL: ${url}`,
      "",
      "### Sources",
      "No usable sources found. All sources were classified as Tier C (insufficient evidence).",
      "Return an empty JSON array: []",
      contextBlock,
    ].join("\n");
  }

  return [
    `Prospect URL: ${url}`,
    "",
    "### Sources",
    sourcesBlock,
    contextBlock,
    "",
    "Generate hooks now following the tier rules. Return a JSON array and nothing else.",
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

/** Check that a hook contains at least one specificity token from evidence. */
export function hasSpecificityToken(hook: string): boolean {
  if (/\d+/.test(hook)) return true;
  if (/\bQ[1-4]\b/i.test(hook)) return true;
  if (/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(hook)) return true;
  if (/"[^"]{3,}"/.test(hook)) return true;

  const workflowTerms = [
    "lead routing", "identity resolution", "case deflection",
    "revenue recognition", "pipeline", "onboarding",
    "churn", "retention", "upsell", "cross-sell",
    "reconciliation", "compliance", "migration",
    "integration", "SSO", "API", "SDK", "webhook",
    "self-serve", "checkout", "billing",
  ];
  const lower = hook.toLowerCase();
  for (const term of workflowTerms) {
    if (lower.includes(term)) return true;
  }

  if (/(?:^.+?\s)[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/.test(hook)) return true;

  return false;
}

export function validateHook(
  raw: ClaudeHookPayload,
  sourceLookup?: Map<number, ClassifiedSource>,
): Hook | null {
  const angle = raw.angle?.toLowerCase() as Angle;
  if (!VALID_ANGLES.includes(angle)) return null;

  const confidence = raw.confidence?.toLowerCase() as Confidence;
  if (!VALID_CONFIDENCES.includes(confidence)) return null;

  const hook = (raw.hook || "").trim();
  if (hook.length === 0 || hook.length > MAX_HOOK_CHARS) return null;
  if (!hook.endsWith("?")) return null;
  if (containsBannedPhrase(hook) !== null) return null;
  if (!hasSpecificityToken(hook)) return null;

  const tier = (raw.evidence_tier || "").toUpperCase() as EvidenceTier;
  const validTier = tier === "A" || tier === "B" ? tier : (
    sourceLookup?.get(raw.news_item)?.tier ?? "B"
  );

  return {
    news_item: typeof raw.news_item === "number" ? raw.news_item : 1,
    angle,
    hook,
    evidence_snippet: (raw.evidence_snippet || "").trim(),
    source_title: (raw.source_title || "").trim(),
    source_date: (raw.source_date || "").trim(),
    source_url: (raw.source_url || "").trim(),
    evidence_tier: validTier,
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
}): Promise<{ hooks: Hook[]; suggestion?: string; lowSignal?: boolean }> {
  const braveApiKey = process.env.BRAVE_API_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;

  if (!braveApiKey || !claudeApiKey) {
    throw new Error("Missing BRAVE_API_KEY or CLAUDE_API_KEY");
  }

  const { sources, signalCount, lowSignal } = await fetchSourcesWithGating(opts.url, braveApiKey);

  // Check if all sources are Tier C
  const usableSources = sources.filter((s) => s.tier !== "C");
  if (usableSources.length === 0) {
    return {
      hooks: [],
      suggestion: "Insufficient evidence. Try providing a press release, changelog, case study, or job posting URL for this company.",
      lowSignal: true,
    };
  }

  // Signal vs Fundamental gate
  if (lowSignal) {
    // Generate only 1 verification hook
    const sourceLookup = new Map<number, ClassifiedSource>();
    usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(opts.url, sources, opts.pitchContext);
    const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

    const validHooks: Hook[] = [];
    for (const raw of rawHooks) {
      const validated = validateHook(raw, sourceLookup);
      if (validated) validHooks.push(validated);
    }

    return {
      hooks: validHooks.slice(0, 1), // Only 1 verification hook
      suggestion: `Low signal: only ${signalCount} signal fact(s) found. For better hooks, try these sources: the company's press page, changelog, careers page, or partner announcements.`,
      lowSignal: true,
    };
  }

  // Normal generation
  const sourceLookup = new Map<number, ClassifiedSource>();
  usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(opts.url, sources, opts.pitchContext);
  const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

  const validHooks: Hook[] = [];
  for (const raw of rawHooks) {
    const validated = validateHook(raw, sourceLookup);
    if (validated) validHooks.push(validated);
  }

  const limit = opts.count ?? validHooks.length;
  return { hooks: validHooks.slice(0, limit), lowSignal: false };
}
