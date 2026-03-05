// ---------------------------------------------------------------------------
// Shared types and helpers for hook generation
// ---------------------------------------------------------------------------

import type { EvidenceTier } from "./types";
import type { SenderContext } from "./workspace";

export type Angle = "trigger" | "risk" | "tradeoff";
export type Confidence = "high" | "med" | "low";
export type PsychMode = "relevance" | "curiosity_gap" | "symptom" | "tradeoff_frame" | "contrarian" | "benefit";

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
  psych_mode?: PsychMode;
  why_this_works?: string;
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
  anchorScore?: number;
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
  psych_mode?: string;
  why_this_works?: string;
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
  // Unsourced-claim blocklist — these are only allowed if literally in the evidence
  "teams lose",
  "teams in your space",
  "usually lose",
  "% of qualified",
  "% better than",
  "% faster than",
  "% more than",
  "industry average",
  "industry benchmark",
  "peers in your space",
  "compared to peers",
];

// Claims that are ONLY allowed if the exact phrase appears in source evidence.
// If the hook contains these but the evidence_snippet does not, the hook is rejected.
const UNSOURCED_CLAIM_PATTERNS = [
  /revamp/i,
  /redesign/i,
  /\bhiring\b/i,
  /performance lift/i,
  /pipeline strength/i,
  /strong pipeline/i,
  /\d+%\s*(better|faster|more|less|higher|lower|improvement|increase|decrease|lift|drop)/i,
  /benchmark/i,
  /outperform/i,
];

// Change verbs that imply a company action/transition. These are ONLY allowed
// if the evidence contains an explicit time marker or change statement.
const CHANGE_VERB_PATTERNS = [
  /\bswitched\b/i, /\brevamped\b/i, /\brecently changed\b/i,
  /\bnow (doing|charging|offering|using|running|building|selling)\b/i,
  /\bhiring across\b/i, /\bmoved to\b/i,
  /\bjust launched\b/i, /\bjust started\b/i, /\bjust added\b/i,
  /\brecently (launched|started|added|introduced|adopted|moved|shifted|pivoted)\b/i,
  /\bstarted (using|offering|doing|building)\b/i,
  /\bshifted (to|from|toward)\b/i, /\bpivoted (to|from|toward)\b/i,
  /\badopted\b/i, /\btransitioned (to|from)\b/i,
];

// Time/change cues that justify using a change verb.
const CHANGE_TIME_CUES = [
  /\b(Q[1-4])\s*\d{4}/i, /\b20\d{2}\b/, /\blast (month|quarter|year|week)\b/i,
  /\brecently\b/i, /\bjust\b/i, /\bnew(ly)?\b/i,
  /\bannounced\b/i, /\blaunched\b/i, /\bintroduced\b/i,
  /\breleased\b/i, /\bmigrat/i, /\bupgrad/i, /\bswitch/i,
  /\bpivot/i, /\btransition/i, /\bshift/i, /\badopt/i,
  /\bJanuary|February|March|April|May|June|July|August|September|October|November|December\b/i,
];

export const VALID_ANGLES: Angle[] = ["trigger", "risk", "tradeoff"];
export const VALID_CONFIDENCES: Confidence[] = ["high", "med"];
export const VALID_PSYCH_MODES: PsychMode[] = [
  "relevance", "curiosity_gap", "symptom", "tradeoff_frame", "contrarian", "benefit",
];
export const MAX_HOOK_CHARS = 240;

// Vague/philosophical question patterns that get rejected.
// Hooks must ask forced-choice, ownership, timing, or mechanism questions.
const VAGUE_QUESTION_PATTERNS = [
  /\bare you seeing\b/i,
  /\bhow are you thinking about\b/i,
  /\bhow do you think about\b/i,
  /\bwhat are your thoughts\b/i,
  /\bwhat do you think\b/i,
  /\bhow does that (feel|land|sit)\b/i,
  /\bhave you considered\b/i,
  /\bis (this|that) something\b/i,
  /\bis (this|that) on your radar\b/i,
  /\bare you looking (at|into)\b/i,
  /\bhow are you (handling|managing|approaching|dealing)\b/i,
  /\bhow does your team (feel|think) about\b/i,
  /\bwhat's your (take|view|stance|perspective)\b/i,
  /\bwhat are you doing about\b/i,
  /\bare you exploring\b/i,
  /\bare you concerned\b/i,
  /\bholding up as\b/i,
  /\bkeeping pace\b/i,
  /\bcurious if\b/i,
  /\bconverting to pipeline\b/i,
];

// Invented causality: ungrounded causal claims that sound authoritative but aren't evidence-based
const INVENTED_CAUSALITY_PATTERNS = [
  /\bthe usual bottleneck is\b/i,
  /\btypically this means\b/i,
  /\bmost teams struggle with\b/i,
  /\bdisconnected systems\b/i,
  /\bthe challenge is\b/i,
  /\bthe problem is usually\b/i,
  /\bcommonly leads to\b/i,
  /\boften results in\b/i,
];

// Abstract nouns that signal consultant-speak when overloaded in questions
const ABSTRACT_NOUNS = [
  "compliance", "engagement", "methodology", "positioning", "strategy",
  "alignment", "optimization", "transformation", "enablement", "governance",
  "framework", "paradigm", "synergy", "ecosystem", "philosophy",
];

// Question framing bans: consultant-speak question patterns
const QUESTION_FRAMING_BANS = [
  /\bfocusing on\b/i,
  /\bdriven by\b/i,
  /\bwhat'?s your (approach|strategy|philosophy)\b/i,
  /\bhow are you (thinking|approaching)\b/i,
];

// No mock/template hooks — every hook must be sourced from real evidence.
const MOCK_HOOKS: string[] = [];

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

export function getDomain(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Company anchor scoring
// ---------------------------------------------------------------------------

const SIGNAL_PAGE_PATTERNS = [
  /\/press/i, /\/newsroom/i, /\/blog\b/i, /\/changelog/i,
  /\/release-notes/i, /\/careers/i, /\/jobs\b/i, /\/partners/i,
  /\/announcements/i, /\/whats-new/i, /\/swipefiles?\b/i,
  /\/customers?\b/i, /\/case-stud/i, /\/success-stor/i,
  /\/results?\b/i, /\/roi\b/i,
];

// Common English words that happen to be company names.
// When the extracted name matches one of these, we require domain-level anchoring
// (not just the word appearing in text) to avoid false positives.
const GENERIC_NAME_WORDS = new Set([
  "sales", "data", "cloud", "app", "apps", "tech", "digital", "web",
  "smart", "fast", "go", "get", "one", "hub", "link", "open", "next",
  "base", "core", "flow", "snap", "pay", "trade", "market", "shop",
  "code", "mail", "lead", "leads", "signal", "boost", "click", "bit",
  "box", "plan", "crew", "team", "work", "build", "launch", "scale",
  "guide", "track", "start", "stack", "source", "point", "key",
  "spring", "pulse", "spark", "bridge", "path", "nest", "wave",
]);

/**
 * Compute how strongly a source is anchored to the target company.
 * Score >= 3 → company-specific (eligible for Tier A).
 * Score < 3 → market context only (forced to Tier B).
 */
export function computeAnchorScore(
  source: Source,
  companyName: string,
  domain: string,
): number {
  let score = 0;
  const titleAndFacts = (source.title + " " + source.facts.join(" ")).toLowerCase();
  const nameLower = companyName.toLowerCase();
  const domainLower = domain.toLowerCase();
  const sourceHost = getDomain(source.url).toLowerCase();

  // Check if the company name is a common word — if so, only domain match counts
  const isGenericName = GENERIC_NAME_WORDS.has(nameLower) || nameLower.length <= 3;

  // +3 if company name appears in title or facts
  // But skip this for generic names (the word "sales" appears in every business article)
  if (!isGenericName && nameLower.length >= 2 && titleAndFacts.includes(nameLower)) {
    score += 3;
  }

  // For generic names, require exact domain or "domain.tld" in text
  if (isGenericName && nameLower.length >= 2) {
    // Only count if the full domain (e.g. "sales.co") appears, not just the word
    if (titleAndFacts.includes(domainLower)) {
      score += 3;
    }
  }

  // +3 if source is on the company domain
  if (sourceHost === domainLower || sourceHost.endsWith("." + domainLower)) {
    score += 3;
  }

  // +3 if domain string appears in title/facts (for third-party articles mentioning the domain)
  if (titleAndFacts.includes(domainLower) && sourceHost !== domainLower) {
    score += 3;
  }

  // +2 if source is on company domain AND path is a signal page
  if (sourceHost === domainLower || sourceHost.endsWith("." + domainLower)) {
    if (SIGNAL_PAGE_PATTERNS.some((p) => p.test(source.url))) {
      score += 2;
    }
  }

  // +2 if source is on company domain AND has specific claims (numbers, pricing, integrations, SLA)
  if (sourceHost === domainLower || sourceHost.endsWith("." + domainLower)) {
    const joined = source.facts.join(" ");
    const hasSpecific =
      /\$[\d,.]+|\d+\s*\/\s*mo/i.test(joined) ||           // pricing
      /\d+%/.test(joined) ||                                 // percentages
      /\d+[,.]?\d*\s*(users|customers|teams|companies)/i.test(joined) || // user counts
      /\b(Salesforce|HubSpot|Slack|Zapier|Gong|Outreach|Marketo|Pardot|Segment|Snowflake)\b/i.test(joined) || // named integrations
      /\b(uptime|SLA|SOC\s*2|GDPR|HIPAA|guarantee)\b/i.test(joined); // SLA/compliance
    if (hasSpecific) score += 2;
  }

  // +1 if source is within 90 days
  if (source.date && !isStale(source.date)) {
    score += 1;
  }

  return score;
}

// ---------------------------------------------------------------------------
// Evidence tier classification
// ---------------------------------------------------------------------------

const TIER_A_URL_PATTERNS = [
  /\/press/i,
  /\/newsroom/i,
  /\/blog\b/i,
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

  // Homepage or generic marketing pages → B, unless they have highly specific claims
  const urlLower = source.url.toLowerCase();
  const isHomepage = /^https?:\/\/[^/]+\/?$/.test(urlLower);
  const isGenericPage = /\/(about|solutions|platform|products|features|pricing|why-|overview)\b/i.test(urlLower);
  if (isHomepage || isGenericPage) {
    // Exception: company-site pages with strong specificity (numbers, pricing, integrations)
    // can reach Tier B (they'll get boosted by anchor scoring later)
    return "B";
  }

  // For company-site sources (prong C): require date + signal content for Tier A
  if (isCompanySite) {
    const hasDate = !!source.date;
    const hasSignalContent = factsContainSignals(source.facts);
    if (hasDate && hasSignalContent && factsHaveSpecifics(source.facts)) return "A";
    return "B";
  }

  // Generic SEO blog post guard: listicle/guide titles like "15 strategies to..."
  // only qualify for Tier A if on company domain AND have concrete quoteable claims
  const isGenericBlogPost = /\b\d+\s+(strategies|tips|ways|steps|tools|tactics|ideas|methods|techniques|examples|templates)\b/i.test(source.title)
    || /\bhow to\b.*\b(generate|get|build|create|increase|boost|grow|improve)\b/i.test(source.title)
    || /\b(ultimate|complete|definitive)\s+guide\b/i.test(source.title);
  if (isGenericBlogPost) {
    // Only usable if on company domain with concrete claims; otherwise force B
    if (sourceHasConcreteEvidence(source.facts)) return "B"; // B, not A — capped at 1 hook
    return "C";
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
// Prong D: Direct Company Page Fetcher
// ---------------------------------------------------------------------------

/** Strip HTML tags and decode entities to get plain text. */
function stripHtml(html: string): string {
  return html
    // Remove script/style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    // Replace block elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Clean up whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

/** Patterns for signal-rich subpage paths to discover from homepage links. */
const SIGNAL_SUBPAGE_PATTERNS = [
  /\/swipefiles?\b/i,
  /\/case-stud/i,
  /\/customers?\b/i,
  /\/success-stor/i,
  /\/results?\b/i,
  /\/roi\b/i,
  /\/integrations?\b/i,
  /\/partners?\b/i,
  /\/changelog\b/i,
  /\/whats-new\b/i,
  /\/release-notes?\b/i,
  /\/press\b/i,
  /\/newsroom\b/i,
  /\/blog\b/i,
  /\/announcements?\b/i,
];

/** Extract claim-rich sentences from plain text (sentences with numbers, pricing, named tools, etc.). */
function extractClaimSentences(text: string, maxFacts = 15): string[] {
  // Split into sentences (period, newline, or semicolon boundaries)
  const rawSentences = text
    .split(/(?<=[.!?])\s+|\n/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 300);

  const claims: string[] = [];
  const seen = new Set<string>();

  for (const sentence of rawSentences) {
    if (claims.length >= maxFacts) break;
    const norm = sentence.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(norm)) continue;

    // Prioritize sentences with quantified claims, integrations, pricing, SLA
    const hasNumber = /\d/.test(sentence);
    const hasPrice = /\$[\d,.]+|\d+\s*\/\s*mo/i.test(sentence);
    const hasPercent = /\d+%/.test(sentence);
    const hasIntegration = /\b(integrat|connect|sync|import|export|API|webhook|Salesforce|HubSpot|Slack|Zapier|CRM|Gong|Outreach|Marketo|Pardot)\b/i.test(sentence);
    const hasSLA = /\b(uptime|SLA|guarantee|compliance|SOC|GDPR|HIPAA|security)\b/i.test(sentence);
    const hasOperational = /\b(automat|eliminat|reduc|increas|improv|sav|acceler|streamlin|consolidat|replac)\b/i.test(sentence);

    if (hasNumber || hasPrice || hasPercent || hasIntegration || hasSLA || hasOperational) {
      seen.add(norm);
      claims.push(sentence);
    }
  }

  // If very few claims found, also include descriptive sentences that aren't boilerplate
  if (claims.length < 3) {
    const boilerplatePatterns = [
      /cookie/i, /privacy policy/i, /terms of service/i, /sign up/i,
      /log in/i, /subscribe/i, /newsletter/i, /copyright/i,
      /all rights reserved/i, /contact us/i,
    ];
    for (const sentence of rawSentences) {
      if (claims.length >= maxFacts) break;
      const norm = sentence.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(norm)) continue;
      if (boilerplatePatterns.some((p) => p.test(sentence))) continue;
      // Must have some substance (>40 chars, not just navigation text)
      if (sentence.length > 40) {
        seen.add(norm);
        claims.push(sentence);
      }
    }
  }

  return claims;
}

/** Discover signal-rich subpage URLs from HTML link hrefs. */
function discoverSignalPages(html: string, baseUrl: string): string[] {
  const linkRegex = /href=["']([^"']+)["']/gi;
  const found = new Set<string>();
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) continue;

    try {
      const resolved = new URL(href, baseUrl).href;
      // Only same-domain links
      const resolvedHost = new URL(resolved).hostname.replace(/^www\./, "");
      const baseHost = new URL(baseUrl).hostname.replace(/^www\./, "");
      if (resolvedHost !== baseHost) continue;

      // Check against signal subpage patterns
      if (SIGNAL_SUBPAGE_PATTERNS.some((p) => p.test(resolved))) {
        found.add(resolved);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return Array.from(found).slice(0, 5); // Max 5 subpages
}

/**
 * Fetch a single page directly and convert to a Source.
 * Returns null if fetch fails or page has no useful content.
 */
async function fetchPageAsSource(pageUrl: string, domain: string): Promise<Source | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ReachWise/1.0; +https://getsignalhooks.com)",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;

    // Limit body size to 500KB
    const text = await response.text();
    const html = text.slice(0, 500_000);

    const plainText = stripHtml(html);
    if (plainText.length < 50) return null;

    // Extract title from <title> tag
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : `${domain} page`;

    // Extract claim-rich sentences as facts
    const facts = extractClaimSentences(plainText);
    if (facts.length === 0) return null;

    return {
      title,
      publisher: domain,
      date: "", // Marketing page — no publication date (not "fresh news")
      url: pageUrl,
      facts,
    };
  } catch {
    return null;
  }
}

/**
 * Prong D: Directly fetch the company's homepage and signal-rich subpages.
 * This captures actual claims, numbers, and product details that Brave Search misses.
 */
async function fetchDirectCompanyPages(
  domain: string,
): Promise<ClassifiedSource[]> {
  const baseUrl = `https://${domain}`;
  const sources: ClassifiedSource[] = [];

  // 1. Fetch homepage
  let homepageHtml = "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(baseUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ReachWise/1.0; +https://getsignalhooks.com)",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (response.ok) {
      const text = await response.text();
      homepageHtml = text.slice(0, 500_000);

      const plainText = stripHtml(homepageHtml);
      if (plainText.length >= 50) {
        const titleMatch = homepageHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : `${domain} homepage`;
        const facts = extractClaimSentences(plainText);
        if (facts.length > 0) {
          const src: Source = {
            title,
            publisher: domain,
            date: new Date().toISOString().split("T")[0],
            url: baseUrl,
            facts,
          };
          // Homepage with specific claims → classify with isCompanySite=true
          sources.push(applyRecencyDowngrade({
            ...src,
            tier: classifySource(src, true),
          }));
        }
      }
    }
  } catch {
    // Homepage fetch failed, continue
  }

  // 2. Discover signal-rich subpages from homepage links + well-known paths
  const signalPages = homepageHtml ? discoverSignalPages(homepageHtml, baseUrl) : [];

  // Also try well-known signal paths that may not be linked from homepage
  const wellKnownPaths = ["/swipefiles", "/customers", "/case-studies", "/changelog", "/press"];
  for (const path of wellKnownPaths) {
    const fullUrl = `${baseUrl}${path}`;
    if (!signalPages.includes(fullUrl)) {
      signalPages.push(fullUrl);
    }
  }

  // 3. Fetch discovered subpages in parallel (max 5)
  if (signalPages.length > 0) {
    const subpageSources = await Promise.all(
      signalPages.slice(0, 5).map((pageUrl) => fetchPageAsSource(pageUrl, domain)),
    );

    for (const src of subpageSources) {
      if (src) {
        sources.push(applyRecencyDowngrade({
          ...src,
          tier: classifySource(src, true),
        }));
      }
    }
  }

  return sources;
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

/** Compute specificity score for a source's facts. Higher = more specific claims. */
function computeSpecificityScore(facts: string[]): number {
  let score = 0;
  const joined = facts.join(" ");

  // +2 for numbers (quantified claims)
  if (/\d/.test(joined)) score += 2;

  // +2 for named tools/integrations/products
  if (/\b(Salesforce|HubSpot|Slack|Zapier|Gong|Outreach|Marketo|Pardot|Segment|Snowflake|Stripe|Shopify|Zendesk|Intercom|Drift|LinkedIn|Gmail|Outlook|API|SDK|webhook|CRM|ERP)\b/i.test(joined)) {
    score += 2;
  }

  // +2 for pricing/monetary claims
  if (/\$[\d,.]+|\d+\s*\/\s*mo|\bfree\s+tier\b|\bpricing\b/i.test(joined)) score += 2;

  // +1 for operational/outcome claims
  if (/\b(automat|eliminat|reduc|increas|improv|sav|acceler|streamlin|consolidat|replac|deliver|achiev|generat)\b/i.test(joined)) {
    score += 1;
  }

  // +1 for SLA/compliance claims
  if (/\b(uptime|SLA|SOC|GDPR|HIPAA|guarantee|compliance|security)\b/i.test(joined)) score += 1;

  return score;
}

/** Score a source for ranking (higher = better). */
function scoreSource(source: ClassifiedSource): number {
  let score = 0;

  // Tier
  if (source.tier === "A") score += 30;
  else if (source.tier === "B") score += 10;

  // Anchor score — company-specific sources rank higher
  score += (source.anchorScore ?? 0) * 3;

  // Recency
  if (!source.stale) score += 20;

  // Signal content
  const signalCount = source.facts.filter((f) => classifyFact(f) === "signal").length;
  score += signalCount * 10;

  // Specificity score — prefer sources with quantified, named, operational claims
  score += computeSpecificityScore(source.facts) * 3;

  // Company-owned pages with specific claims get extra boost
  const sourceHost = getDomain(source.url).toLowerCase();
  const isOwnPage = source.url && (source.publisher === sourceHost || source.facts.length >= 3);
  if (isOwnPage && computeSpecificityScore(source.facts) >= 3) {
    score += 15; // Strong boost for company pages with specific content
  }

  return score;
}

// ---------------------------------------------------------------------------
// Main fetchSources: three-pronged, merged, deduplicated, gated
// ---------------------------------------------------------------------------

export type FetchSourcesResult = {
  sources: ClassifiedSource[];
  signalCount: number;
  lowSignal: boolean;
  hasAnchoredSources: boolean;
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

  // Run all four prongs in parallel
  const [newsResults, webResults, companyResults, directPageResults] = await Promise.all([
    fetchNewsSignals(companyName, domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchWebSignals(companyName, domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchCompanyOwnSignals(domain, apiKey).catch(() => [] as ClassifiedSource[]),
    fetchDirectCompanyPages(domain).catch(() => [] as ClassifiedSource[]),
  ]);

  // Merge all sources (direct pages first for dedup priority)
  const allSources = [...directPageResults, ...newsResults, ...webResults, ...companyResults];

  // Deduplicate
  const deduped = deduplicateSources(allSources);

  // Compute anchor scores and reclassify
  const anchored = deduped.map((source) => {
    const anchorScore = computeAnchorScore(source, companyName, domain);
    // If anchor score < 3, force to Tier B (market context) regardless of previous tier
    if (anchorScore < 3 && source.tier === "A") {
      return { ...source, tier: "B" as EvidenceTier, anchorScore };
    }
    // Promote company-owned pages with high anchor score + specificity from B to A
    // This allows homepage/swipefile pages with quantified claims to generate full hook sets
    const sourceHost = getDomain(source.url).toLowerCase();
    const isOnCompanyDomain = sourceHost === domain.toLowerCase() || sourceHost.endsWith("." + domain.toLowerCase());
    if (isOnCompanyDomain && anchorScore >= 5 && source.tier === "B" && computeSpecificityScore(source.facts) >= 3) {
      return { ...source, tier: "A" as EvidenceTier, anchorScore };
    }
    return { ...source, anchorScore };
  });

  // Rank by score and take top 10
  const ranked = anchored
    .sort((a, b) => scoreSource(b) - scoreSource(a))
    .slice(0, 10);

  // Count signal facts for gating
  const signalCount = countSignalFacts(ranked);
  const hasAnchoredSources = ranked.some((s) => (s.anchorScore ?? 0) >= 3 && s.tier === "A");

  return {
    sources: ranked,
    signalCount,
    lowSignal: signalCount < 2,
    hasAnchoredSources,
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

export function buildSystemPrompt(senderContext?: SenderContext | null): string {
  return [
    "You are an elite SDR copywriter who uses sales psychology to craft cold email opening hooks.",
    "Your hooks earn attention fast, center the prospect (never 'we/us'), create productive tension,",
    "and ask questions that are easy to answer — all backed by real evidence.",
    "",
    "## MANDATORY: Verbatim Evidence Quote Rule",
    "Every hook MUST include a verbatim quote of 5–12 words copied directly from the source facts.",
    'Wrap the quote in double quotes inside the hook text.',
    "If you cannot find a quoteable phrase of 5–12 words in the source facts, do NOT generate a hook for that source.",
    'The "evidence_snippet" field must contain the EXACT full sentence/fact from which you pulled the quote.',
    "",
    "## Psychology Mode Framework",
    "For each Tier A source, generate exactly 3 hooks using 3 DIFFERENT psychology modes from the 6 below.",
    "Rotate modes across sources so the output set has variety. Each hook uses ONE mode.",
    "",
    "### Mode A — relevance (you-first framing)",
    "Center the prospect with second-person framing. No self-references (we/our/us).",
    'Pattern: Saw your "{QUOTE}" — is your team optimizing for [A] or [B]?',
    'Example: Saw your "3.2X reply rate vs templates" claim — is the main lever list quality, or the 1:1 personalization layer?',
    "",
    "### Mode B — curiosity_gap (credible knowledge gap)",
    "Create a gap between a claim and the underlying mechanism. Make them want to explain.",
    'Pattern: "{QUOTE}" is a bold claim — is that driven by [lever1] or [lever2]?',
    'Example: "100% unique email to every prospect" is a bold claim — is that human-written end-to-end, or programmatic personalization with human QA?',
    "",
    "### Mode C — symptom (buyer self-diagnosis)",
    "Ask about a symptom tied to the signal. Make it fast to answer (binary or specific).",
    'Pattern: When "{QUOTE}" shows up, the usual bottleneck is [X]. Is that true for you, or is it [Y]?',
    'Example: When "820 interested replies from ~94,000 emails" shows up, the usual bottleneck is booking rate. Are you optimizing for booked meetings, or qualified reply volume?',
    "",
    "### Mode D — tradeoff_frame (decision, not discussion)",
    "Force a real operational choice. Speed vs quality, breadth vs accuracy, automation vs control.",
    'Pattern: With "{QUOTE}" — do you prioritize [A], or [B]?',
    'Example: You price at "$250/reply" — is that mainly to de-risk clients, or to push higher standards on list + offer quality?',
    "",
    "### Mode E — contrarian (pattern interrupt)",
    "Go against the grain, but must be defensible from the evidence. No unsourced claims.",
    'Pattern: Most teams assume [common belief]. "{QUOTE}" suggests the opposite — is that how you approach it?',
    `Example: Most outreach tools optimize for volume. You say "99% of cold email is digital spam" — do you fix that first with list hygiene, or with offer/messaging changes?`,
    "CONSTRAINT: The contrarian statement must be derivable from the evidence. If not, use a different mode.",
    "",
    "### Mode F — benefit (what's in it for them)",
    "Tie the signal to a concrete business benefit. Make the upside specific.",
    'Pattern: If "{QUOTE}" holds, the upside is [benefit]. Is your priority [benefit1] or [benefit2] this quarter?',
    'Example: If "24/7 deliverability management" holds, the upside is inbox-rate stability. Is infra dedicated per client, or shared pools with strict throttling?',
    "",
    "## Evidence tier rules",
    "Each source is classified into a tier. Follow strictly:",
    "",
    "### Tier A sources (company-anchored, strong evidence)",
    "Generate exactly 3 hooks per source using 3 DIFFERENT psychology modes (A–F).",
    "Each hook must also specify one of these angles:",
    "- trigger: a SPECIFIC company action/change. HARD RULE: if no action exists in evidence, skip this angle.",
    "- risk: what breaks if something is ignored → forced-choice question.",
    "- tradeoff: two valid paths → specific question about direction.",
    "Each hook MUST contain a verbatim quote from the source.",
    "",
    "### Tier B sources (market context / unanchored)",
    "Generate exactly 1 hook per source. Rules:",
    "- Angle MUST be 'trigger'. Psychology mode MUST be 'relevance' (mode A).",
    '- Format: "It sounds like [verbatim quote from source]. Did I get that right?"',
    "- Do NOT assert pain or implications. ONLY verify.",
    "- If no quoteable phrase exists, skip this source entirely.",
    "",
    "### Tier C sources",
    "Skip entirely. Generate nothing.",
    "",
    "## Question quality (HARD constraint — hooks rejected if violated)",
    "Every hook must end with an ANSWERABLE question. Acceptable types:",
    "- Forced choice: [A] or [B]? (two specific, operational, mutually exclusive alternatives)",
    "- Ownership: is this owned by [team X] or [team Y]?",
    "- Timing: is this a priority now, or next quarter?",
    "- Mechanism: is that driven by [X] or [Y]?",
    "",
    "REJECTED question types (hook will be filtered out):",
    "- Vague: 'Are you seeing this shift?', 'Is this on your radar?'",
    "- Philosophical: 'How are you thinking about…?', 'What's your take on…?'",
    "- Open-ended: 'What are you doing about…?', 'How are you handling…?'",
    "- Yes/no without specificity: 'Have you considered…?', 'Are you concerned?'",
    "",
    "## Emotion modifiers (safe, evidence-gated)",
    "Apply these ONLY when evidence supports them:",
    "- Curiosity: use mechanism questions (driven by X or Y?) — always safe",
    "- Urgency: ONLY when evidence includes a time-bound trigger (launch date, deadline, Q1 target)",
    "- Social proof: ONLY when evidence names specific customers, partners, or case studies",
    "- Humor: OFF — do not use humor in hooks",
    "",
    "## Newsjacking (gated)",
    "When a source is dated within 90 days AND the company is named in the source:",
    'Pattern: Saw the news on "{QUOTE}" — does this change your priority between [A] and [B]?',
    "Only use for actual news events (launches, funding, partnerships, hires). Not for marketing pages.",
    "",
    "## Unsourced Claims Blocklist (HARD constraint)",
    "NEVER include these claims unless the EXACT words appear in the source facts:",
    "- redesign / revamp / hiring / job postings",
    "- performance lift / conversion lift / pipeline strength",
    "- any percentage stat (X% better/faster/more)",
    "- any benchmark or industry comparison",
    "If generated without source backing, drop the hook entirely.",
    "",
    "## No implied-change verbs (HARD constraint)",
    "NEVER use verbs that imply a company change/transition (switched, revamped, recently changed,",
    "moved to, pivoted, adopted, shifted, transitioned, started using) UNLESS the source evidence",
    "contains an explicit time marker or change statement (a date, 'announced', 'launched', etc.).",
    "If the source describes a CURRENT state, use present-tense neutral framing:",
    "  BAD: 'You switched to $250/reply pricing'",
    "  GOOD: 'You price at $250/reply'",
    "",
    "## No-assumptions rule (HARD constraint)",
    "- NEVER assert internal problems unless the source EXPLICITLY says so.",
    "- NEVER use generic benchmarks ('teams lose 20–30%...', 'X% of companies...').",
    "- If a claim is not in the evidence, drop the hook.",
    "",
    "## No fake stats (HARD constraint)",
    "Numbers in hooks are ONLY allowed if they appear in the evidence snippet.",
    "Do NOT invent, round, or extrapolate statistics. If the evidence says '820 replies',",
    "you may say '820 replies' — not '~800 replies' or 'hundreds of replies'.",
    "",
    "## Quality rules (violating any one = hook rejected)",
    "- Max 240 characters per hook. 1–2 sentences.",
    "- Must end with a question mark.",
    "- No raw URLs in hook text.",
    "- Always use second-person (you/your). Never first-person (we/our/us/I).",
    "- BANNED phrases: curious, worth a quick, just checking in, hope you're well, touching base,",
    "  I'd love to, quick question, quick chat, I came across, I noticed your company,",
    "  game-changing, innovative solution, disrupting the space, cutting-edge,",
    "  interested in, teams like you, on your radar, teams lose, usually lose,",
    "  industry average, industry benchmark, compared to peers.",
    "",
    "## Skip vague sources (HARD constraint)",
    "If a source's facts do NOT contain at least one of: a number, a named tool/integration,",
    "a named customer/partner, or a concrete feature/offer term, skip it entirely.",
    "",
    "## Confidence scoring",
    "- high: source fact is specific and recent (named event, metric, date within 6 months).",
    "- med: fact is real but generic or older.",
    "Only output hooks where confidence is high or med.",
    "",
    ...(senderContext
      ? [
          "## SENDER CONTEXT",
          `The sender sells: ${senderContext.whatYouSell}`,
          `ICP: ${senderContext.icpIndustry}, ${senderContext.icpCompanySize} employees, targeting ${senderContext.buyerRoles.join(", ")}`,
          `Primary outcome: ${senderContext.primaryOutcome}`,
          `Category: ${senderContext.offerCategory}`,
          ...(senderContext.proof ? [`Proof points: ${senderContext.proof.join("; ")}`] : []),
          "",
          "## RELEVANCE BRIDGE RULES (only when sender context is provided)",
          "- Add at most ONE sentence tying the prospect's signal to the sender's outcome.",
          '- Template: "[Signal verb] + [prospect noun] — [sender outcome] for [buyer role]. [Binary question]?"',
          "- Max 80 characters for the bridge portion. Total hook still max 240 characters.",
          "- Never name the sender's product directly. Reference their outcome category only.",
          '- Never claim "we help teams like you" or similar generic framing.',
          "- The bridge must follow logically from the evidence. If no natural connection exists, omit it.",
          "",
        ]
      : [
          "## VERIFICATION-ONLY MODE",
          "Do NOT reference the sender's product or offer. Generate signal-verification hooks only.",
          "Do NOT attempt a relevance bridge sentence.",
          "Hooks should verify the prospect's signal and ask a narrow operational question.",
          "",
        ]),
    "## Output format",
    "Return ONLY a JSON array. No markdown fences, no commentary. Each element:",
    '{  "news_item": <1-indexed source number>,',
    '   "angle": "trigger" | "risk" | "tradeoff",',
    '   "psych_mode": "relevance" | "curiosity_gap" | "symptom" | "tradeoff_frame" | "contrarian" | "benefit",',
    '   "hook": "<the hook text — MUST contain a verbatim quote in double quotes>",',
    '   "evidence_snippet": "<the EXACT full fact/sentence you quoted from>",',
    '   "source_title": "<title of the source>",',
    '   "source_date": "<date of the source, or empty string>",',
    '   "source_url": "<URL of the source>",',
    '   "evidence_tier": "A" | "B",',
    '   "confidence": "high" | "med",',
    '   "why_this_works": "<1 short phrase: e.g. curiosity gap, tradeoff frame, symptom self-diagnosis>"',
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
      (s, i) => {
        const anchorLabel = (s.anchorScore ?? 0) >= 3 ? "COMPANY-ANCHORED" : "MARKET-CONTEXT";
        const vagueLabel = sourceHasConcreteEvidence(s.facts) ? "" : " [LOW-SIGNAL — SKIP]";
        return [
          `### Source ${i + 1}: ${s.title} [Tier ${s.tier}] [${anchorLabel}]${s.stale ? " [STALE]" : ""}${vagueLabel}`,
          `Publisher: ${s.publisher}`,
          s.date ? `Date: ${s.date}` : "Date: unknown",
          `URL: ${s.url}`,
          "Facts:",
          ...s.facts.map((f) => `- ${f}`),
        ]
          .filter(Boolean)
          .join("\n");
      },
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
      max_tokens: 4096,
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

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Truncation recovery: try to find the last complete JSON object in the array
    // by finding the last "}]" or "}" and closing the array
    const lastCompleteObj = cleaned.lastIndexOf("}");
    if (lastCompleteObj > 0) {
      const truncated = cleaned.slice(0, lastCompleteObj + 1);
      // Ensure it ends as a valid array
      const asArray = truncated.endsWith("]") ? truncated : truncated + "]";
      try {
        parsed = JSON.parse(asArray);
      } catch {
        // Last resort: extract individual complete objects
        const objects: unknown[] = [];
        const objRegex = /\{[^{}]*\}/g;
        let match;
        while ((match = objRegex.exec(cleaned)) !== null) {
          try {
            objects.push(JSON.parse(match[0]));
          } catch {
            // skip malformed object
          }
        }
        parsed = objects.length > 0 ? objects : [];
      }
    } else {
      parsed = [];
    }
  }

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

/**
 * Extract the verbatim quote from hook text (text inside double quotes).
 * Returns the quoted phrase or null if none found.
 */
function extractQuoteFromHook(hook: string): string | null {
  // Match text inside double quotes (straight or curly)
  const match = hook.match(/["\u201C]([^"\u201D]{5,})["\u201D]/);
  return match ? match[1] : null;
}

/**
 * Check if a quoted phrase actually appears (fuzzy) in the evidence snippet.
 * We lowercase both and check substring containment.
 */
function quoteExistsInEvidence(quote: string, evidenceSnippet: string): boolean {
  if (!quote || !evidenceSnippet) return false;
  const normQuote = quote.toLowerCase().replace(/\s+/g, " ").trim();
  const normEvidence = evidenceSnippet.toLowerCase().replace(/\s+/g, " ").trim();
  // Check if at least 80% of the quote words appear in sequence in the evidence
  if (normEvidence.includes(normQuote)) return true;
  // Fallback: check if most words from the quote appear in the evidence
  const quoteWords = normQuote.split(" ");
  const matchingWords = quoteWords.filter((w) => normEvidence.includes(w));
  return matchingWords.length >= Math.ceil(quoteWords.length * 0.8);
}

/**
 * Check if hook contains unsourced claims that aren't backed by evidence.
 * Returns the offending pattern if found without evidence backing, null otherwise.
 */
function containsUnsourcedClaim(hook: string, evidenceSnippet: string): boolean {
  const hookLower = hook.toLowerCase();
  const evidenceLower = (evidenceSnippet || "").toLowerCase();
  for (const pattern of UNSOURCED_CLAIM_PATTERNS) {
    if (pattern.test(hookLower) && !pattern.test(evidenceLower)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if hook uses change/transition verbs without evidence containing a
 * matching time marker or explicit change statement.
 */
function containsUnsupportedChangeVerb(hook: string, evidenceSnippet: string): boolean {
  const hookLower = hook.toLowerCase();
  const evidenceLower = (evidenceSnippet || "").toLowerCase();
  const hasChangeVerb = CHANGE_VERB_PATTERNS.some((p) => p.test(hookLower));
  if (!hasChangeVerb) return false;
  // Evidence must contain at least one time/change cue to justify the verb
  return !CHANGE_TIME_CUES.some((p) => p.test(evidenceLower));
}

/**
 * Attempt to rewrite change verbs to present-tense / observation form.
 * Returns the rewritten hook text, or null if rewrite still implies change.
 */
const CHANGE_VERB_REWRITES: Array<[RegExp, string]> = [
  [/\bYou switched to\b/gi, "You use"],
  [/\bYou revamped\b/gi, "You offer"],
  [/\bYou redesigned\b/gi, "You have"],
  [/\bYou recently changed to\b/gi, "You offer"],
  [/\bYou recently changed\b/gi, "You have"],
  [/\bNow charging\b/gi, "You charge"],
  [/\bNow offering\b/gi, "You offer"],
  [/\bNow using\b/gi, "You use"],
  [/\bNow doing\b/gi, "You do"],
  [/\bNow running\b/gi, "You run"],
  [/\bNow building\b/gi, "You build"],
  [/\bNow selling\b/gi, "You sell"],
  [/\bHiring across\b/gi, "Growing across"],
  [/\bYou moved to\b/gi, "You use"],
  [/\bJust launched\b/gi, "You offer"],
  [/\bJust started\b/gi, "You"],
  [/\bJust added\b/gi, "You offer"],
  [/\bRecently launched\b/gi, "You offer"],
  [/\bRecently started\b/gi, "You"],
  [/\bRecently added\b/gi, "You offer"],
  [/\bRecently introduced\b/gi, "You offer"],
  [/\bRecently adopted\b/gi, "You use"],
  [/\bRecently moved\b/gi, "You use"],
  [/\bRecently shifted\b/gi, "You focus on"],
  [/\bRecently pivoted\b/gi, "You focus on"],
  [/\bStarted using\b/gi, "You use"],
  [/\bStarted offering\b/gi, "You offer"],
  [/\bStarted doing\b/gi, "You do"],
  [/\bStarted building\b/gi, "You build"],
  [/\bShifted to\b/gi, "You focus on"],
  [/\bShifted from\b/gi, "You moved from"],
  [/\bPivoted to\b/gi, "You focus on"],
  [/\bPivoted from\b/gi, "You moved from"],
  [/\bAdopted\b/gi, "You use"],
  [/\bTransitioned to\b/gi, "You use"],
  [/\bTransitioned from\b/gi, "You moved from"],
];

export function rewriteChangeVerbs(hook: string): string | null {
  let text = hook;
  let changed = false;
  for (const [pattern, replacement] of CHANGE_VERB_REWRITES) {
    const before = text;
    text = text.replace(pattern, replacement);
    if (text !== before) changed = true;
  }
  if (!changed) return null;
  // Verify rewrite removed all change verbs
  if (CHANGE_VERB_PATTERNS.some((p) => p.test(text))) return null;
  return text;
}

/**
 * Reject hooks with vague, philosophical, or open-ended questions.
 * Returns true if the question is low-quality (should be rejected).
 */
function hasVagueQuestion(hook: string): boolean {
  return VAGUE_QUESTION_PATTERNS.some((p) => p.test(hook));
}

/**
 * Positive question structure validator: hook must end with a forced-choice,
 * mechanism, ownership, or timing question containing "or" or "vs".
 * Returns true if the question structure is valid.
 */
export function hasValidQuestionStructure(hook: string): boolean {
  // Extract question portion (after last em-dash, or the whole hook)
  const parts = hook.split(/\s*—\s*/);
  const questionPart = parts.length > 1 ? parts[parts.length - 1] : hook;
  // Forced choice / mechanism / ownership: contains "or"
  if (/\bor\b/i.test(questionPart)) return true;
  // Comparison: contains "vs"
  if (/\bvs\.?\b/i.test(questionPart)) return true;
  return false;
}

/**
 * Reject hooks that use first-person framing (we/our/us/I).
 * Hooks should always center the prospect with second-person framing.
 */
function hasFirstPersonFraming(hook: string): boolean {
  // Match standalone first-person words, not inside quotes
  // Remove quoted sections first to avoid false positives on evidence quotes
  const withoutQuotes = hook.replace(/[""\u201C][^""\u201D]*[""\u201D]/g, "");
  return /\bwe\b|\bwe'(re|ve|ll)\b|\bour\b|\bours\b|\bus\b|(?:^|\.\s+)I\s/i.test(withoutQuotes);
}

/**
 * Check whether a source has concrete, quoteable evidence.
 * Returns true if facts contain at least one of: a number, a named tool/integration,
 * a named customer/partner, or a concrete feature/offer term.
 * Sources that fail this check are Low Signal and should not produce hooks.
 */
function sourceHasConcreteEvidence(facts: string[]): boolean {
  const joined = facts.join(" ");
  // Number (quantified claim)
  if (/\d/.test(joined)) return true;
  // Named tool/integration/product
  if (/\b(Salesforce|HubSpot|Slack|Zapier|Gong|Outreach|Marketo|Pardot|Segment|Snowflake|Stripe|Shopify|Zendesk|Intercom|Drift|LinkedIn|Gmail|Outlook|API|SDK|webhook|CRM|ERP)\b/i.test(joined)) return true;
  // Named customer/partner (capitalized proper nouns following "with" or "for" or standalone)
  if (/\b(partnered with|working with|trusted by|used by|chosen by|powering|for companies like)\b/i.test(joined)) return true;
  // Concrete feature/offer term (pricing, deliverability, specific product terms)
  if (/\$[\d,.]+|\d+\s*\/\s*(mo|month|reply|lead|email)|\bfree\s+tier\b|\bpricing\b/i.test(joined)) return true;
  if (/\b(deliverability|personalization|warmup|throttling|list hygiene|unique emails?|cold email)\b/i.test(joined)) return true;
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

  let hook = (raw.hook || "").trim();
  if (hook.length === 0 || hook.length > MAX_HOOK_CHARS) return null;
  if (!hook.endsWith("?")) return null;
  if (containsBannedPhrase(hook) !== null) return null;
  if (!hasSpecificityToken(hook)) return null;

  // Question quality: reject vague/philosophical/open-ended questions
  if (hasVagueQuestion(hook)) return null;

  // Invented causality ban: reject hooks with ungrounded causal claims
  if (INVENTED_CAUSALITY_PATTERNS.some((p) => p.test(hook))) return null;

  // Question framing bans: reject consultant-speak question patterns
  const questionPart = hook.split(/\s*—\s*/).pop() || hook;
  if (QUESTION_FRAMING_BANS.some((p) => p.test(questionPart))) return null;

  // Abstract noun overload: reject questions with 3+ abstract nouns
  const abstractCount = ABSTRACT_NOUNS.filter((noun) =>
    new RegExp(`\\b${noun}\\b`, "i").test(questionPart)
  ).length;
  if (abstractCount >= 3) return null;

  // Positive question structure: must be forced-choice/mechanism/ownership/timing
  if (!hasValidQuestionStructure(hook)) return null;

  // You-first framing: reject hooks that use first-person (we/our/us/I)
  if (hasFirstPersonFraming(hook)) return null;

  const tier = (raw.evidence_tier || "").toUpperCase() as EvidenceTier;
  const validTier = tier === "A" || tier === "B" ? tier : (
    sourceLookup?.get(raw.news_item)?.tier ?? "B"
  );

  // Tier B: ONLY trigger angle allowed, no risk/tradeoff
  if (validTier === "B" && angle !== "trigger") return null;

  const evidenceSnippet = (raw.evidence_snippet || "").trim();

  // MANDATORY: Hook must contain a verbatim quote from evidence (5+ words in double quotes)
  const quote = extractQuoteFromHook(hook);
  if (!quote) return null; // No quote found → reject
  if (!quoteExistsInEvidence(quote, evidenceSnippet)) return null; // Quote not in evidence → reject

  // No fake stats: numbers outside the verbatim quote must appear in evidence
  // (numbers inside the quote are already validated by quoteExistsInEvidence)
  const hookWithoutQuote = hook.replace(/["\u201C][^"\u201D]*["\u201D]/g, "");
  const outsideNumbers = hookWithoutQuote.match(/\d[\d,.]*%?/g) || [];
  for (const num of outsideNumbers) {
    if (!evidenceSnippet.includes(num)) return null;
  }

  // Reject hooks with unsourced claims (redesign, hiring, stats not in evidence)
  if (containsUnsourcedClaim(hook, evidenceSnippet)) return null;

  // Change verbs without evidence: attempt rewrite to present tense, then drop if still fails
  if (containsUnsupportedChangeVerb(hook, evidenceSnippet)) {
    const rewritten = rewriteChangeVerbs(hook);
    if (!rewritten) return null; // Can't rewrite → drop
    hook = rewritten;
    // Belt-and-suspenders: verify rewrite is clean
    if (containsUnsupportedChangeVerb(hook, evidenceSnippet)) return null;
    // Re-validate length after rewrite
    if (hook.length > MAX_HOOK_CHARS) return null;
  }

  // Reject hooks whose source lacks concrete evidence (number, named tool, feature term)
  if (sourceLookup) {
    const source = sourceLookup.get(raw.news_item);
    if (source) {
      if (!sourceHasConcreteEvidence(source.facts)) return null;
      // Tier B sources without a concrete anchor → Low Signal, skip
      if (validTier === "B" && computeSpecificityScore(source.facts) < 2) return null;
    }
  }

  // Validate and normalize psych_mode (optional — gracefully handle missing/invalid)
  const rawMode = (raw.psych_mode || "").toLowerCase().replace(/-/g, "_") as PsychMode;
  const psychMode = VALID_PSYCH_MODES.includes(rawMode) ? rawMode : undefined;

  // Mode E (contrarian) gate: require company-anchored + recent source
  if (psychMode === "contrarian" && sourceLookup) {
    const source = sourceLookup.get(raw.news_item);
    if (source) {
      const isAnchored = (source.anchorScore ?? 0) >= 3;
      const isRecent = source.date && !source.stale;
      if (!isAnchored || !isRecent) return null;
    }
  }

  return {
    news_item: typeof raw.news_item === "number" ? raw.news_item : 1,
    angle,
    hook,
    evidence_snippet: evidenceSnippet,
    source_title: (raw.source_title || "").trim(),
    source_date: (raw.source_date || "").trim(),
    source_url: (raw.source_url || "").trim(),
    evidence_tier: validTier,
    confidence,
    psych_mode: psychMode,
    why_this_works: (raw.why_this_works || "").trim() || undefined,
  };
}

// ---------------------------------------------------------------------------
// PUBLISH GATE — single enforcement layer before hooks are shown/returned
// ---------------------------------------------------------------------------

export type PublishGateOptions = {
  /** If true, allow max 1 unanchored source labeled "Market context". Default: false */
  includeMarketContext?: boolean;
};

/**
 * Publish Gate: validate → rewrite once → drop/backfill.
 * This is the ONLY function that should be used to produce user-facing hooks.
 * It enforces:
 *   1. Anchored source check (exclude unanchored when market context off)
 *   2. Verbatim quote requirement (5–12 word span in evidence)
 *   3. Change verb rewrite-or-drop
 *   4. Forced-choice question structure
 *   5. Tier B cap (max 1 total) + concrete anchor requirement
 *   6. All other validateHook rules (banned phrases, first-person, fake stats, etc.)
 */
export function publishGate(
  rawHooks: ClaudeHookPayload[],
  sourceLookup: Map<number, ClassifiedSource>,
  options?: PublishGateOptions,
): Hook[] {
  const includeMarketContext = options?.includeMarketContext ?? false;

  // Step 1: Filter source lookup to exclude unanchored when market context off
  const filteredLookup = new Map<number, ClassifiedSource>();
  for (const [idx, source] of sourceLookup) {
    const anchored = (source.anchorScore ?? 0) >= 3;
    if (!anchored && !includeMarketContext) continue;
    filteredLookup.set(idx, source);
  }

  // Step 2: Validate each hook through full pipeline (includes rewrite-or-drop)
  const validHooks: Hook[] = [];
  for (const raw of rawHooks) {
    // Reject hooks from sources that were filtered out
    if (!filteredLookup.has(raw.news_item)) continue;
    const validated = validateHook(raw, filteredLookup);
    if (validated) validHooks.push(validated);
  }

  // Step 3: Enforce Tier B cap — max 1 total (or 0 if market context off and unanchored)
  let tierBCount = 0;
  const cappedHooks: Hook[] = [];
  for (const hook of validHooks) {
    if (hook.evidence_tier === "B") {
      if (tierBCount >= 1) continue;
      // In market-context mode, label unanchored Tier B
      const source = filteredLookup.get(hook.news_item);
      if (source && (source.anchorScore ?? 0) < 3 && includeMarketContext) {
        // Allowed but capped — this is the 1 market context hook
      }
      tierBCount++;
    }
    cappedHooks.push(hook);
  }

  return cappedHooks;
}

/**
 * Validate a single pre-built Hook object through publish gate rules.
 * Used for static/demo hooks that are already in Hook shape (not ClaudeHookPayload).
 * Returns the hook if it passes, null if it fails.
 */
export function publishGateValidateHook(hook: Hook): Hook | null {
  const payload: ClaudeHookPayload = {
    news_item: hook.news_item,
    angle: hook.angle,
    hook: hook.hook,
    evidence_snippet: hook.evidence_snippet,
    source_title: hook.source_title,
    source_date: hook.source_date,
    source_url: hook.source_url,
    evidence_tier: hook.evidence_tier,
    confidence: hook.confidence,
    psych_mode: hook.psych_mode,
    why_this_works: hook.why_this_works,
  };
  return validateHook(payload);
}

/**
 * Run the publish gate on an already-formed Hook[] (e.g., from cache).
 * This is the LAST step before returning hooks to the user.
 * Every return path that includes hooks MUST call this.
 *
 * Rule A: Change verbs without proof → rewrite to present tense → drop if still fails
 * Rule B: Unanchored source → drop (unless includeMarketContext=true, cap 1)
 * Rule C: Forced-choice question → drop if missing
 * Rule D: Tier B cap at 1
 */
export function publishGateFinal(
  hooks: Hook[],
  companyDomain?: string,
  options?: PublishGateOptions,
): Hook[] {
  const includeMarketContext = options?.includeMarketContext ?? false;
  const domainLower = (companyDomain || "").toLowerCase();

  const gated: Hook[] = [];
  let tierBCount = 0;

  for (const hook of hooks) {
    // Rule B: Unanchored source exclusion
    if (domainLower && hook.source_url) {
      const sourceHost = getDomain(hook.source_url).toLowerCase();
      const isOnDomain = sourceHost === domainLower || sourceHost.endsWith("." + domainLower);
      const titleOrSnippet = ((hook.source_title || "") + " " + (hook.evidence_snippet || "")).toLowerCase();
      const mentionsDomain = titleOrSnippet.includes(domainLower);
      const companyName = extractCompanyName(`https://${domainLower}`).toLowerCase();
      const isGenericName = GENERIC_NAME_WORDS.has(companyName) || companyName.length <= 3;
      const mentionsName = !isGenericName && titleOrSnippet.includes(companyName);

      const anchored = isOnDomain || mentionsDomain || mentionsName;
      if (!anchored) {
        if (!includeMarketContext) continue; // Drop entirely
        // Market context mode: allow max 1, force Tier B
        if (tierBCount >= 1) continue;
      }
    }

    // Run through full validateHook (Rule A: change verb rewrite, Rule C: question quality, etc.)
    const payload: ClaudeHookPayload = {
      news_item: hook.news_item,
      angle: hook.angle,
      hook: hook.hook,
      evidence_snippet: hook.evidence_snippet,
      source_title: hook.source_title,
      source_date: hook.source_date,
      source_url: hook.source_url,
      evidence_tier: hook.evidence_tier,
      confidence: hook.confidence,
      psych_mode: hook.psych_mode,
      why_this_works: hook.why_this_works,
    };
    const validated = validateHook(payload);
    if (!validated) continue;

    // Rule D: Tier B cap
    if (validated.evidence_tier === "B") {
      if (tierBCount >= 1) continue;
      tierBCount++;
    }

    gated.push(validated);
  }

  return gated;
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
  includeMarketContext?: boolean;
}): Promise<{ hooks: Hook[]; suggestion?: string; lowSignal?: boolean }> {
  const braveApiKey = process.env.BRAVE_API_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;

  if (!braveApiKey || !claudeApiKey) {
    throw new Error("Missing BRAVE_API_KEY or CLAUDE_API_KEY");
  }

  const { sources: rawSources, signalCount, lowSignal, hasAnchoredSources } = await fetchSourcesWithGating(opts.url, braveApiKey);
  const domain = getDomain(opts.url);
  const includeMarketContext = opts.includeMarketContext ?? false;

  // Default mode: exclude unanchored sources entirely (anchorScore < 3)
  // Market context mode: allow max 1 unanchored source, labeled + capped
  const sources = includeMarketContext
    ? rawSources
    : rawSources.filter((s) => (s.anchorScore ?? 0) >= 3);

  const NO_ANCHOR_SUGGESTION = [
    "Low Signal: no company-specific signals found — only market context available.",
    "For better hooks, provide one of these:",
    `  - ${domain}/press or ${domain}/newsroom`,
    `  - ${domain}/blog or ${domain}/changelog`,
    `  - ${domain}/careers or LinkedIn company page`,
    "  - Recent news articles mentioning the company by name",
    "  - Partner or customer announcement pages",
  ].join("\n");

  const LOW_SIGNAL_SUGGESTION = [
    `Low Signal: only ${signalCount} signal fact(s) found — only fundamentals available.`,
    "For better hooks, try fetching from these sources:",
    `  - ${domain}/press or ${domain}/newsroom`,
    `  - ${domain}/blog or ${domain}/changelog`,
    `  - ${domain}/careers or LinkedIn jobs page`,
    "  - Recent news articles about the company",
    "  - Partner announcement pages",
  ].join("\n");

  // Check if all sources are Tier C
  const usableSources = sources.filter((s) => s.tier !== "C");
  if (usableSources.length === 0) {
    return {
      hooks: [],
      suggestion: NO_ANCHOR_SUGGESTION,
      lowSignal: true,
    };
  }

  // If no company-anchored sources, show low signal with specific guidance
  if (!hasAnchoredSources) {
    const sourceLookup = new Map<number, ClassifiedSource>();
    usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(opts.url, sources, opts.pitchContext);
    const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

    // Publish Gate — enforce all rules
    const gated = publishGate(rawHooks, sourceLookup, { includeMarketContext });
    return {
      hooks: gated.slice(0, 1),
      suggestion: NO_ANCHOR_SUGGESTION,
      lowSignal: true,
    };
  }

  const sourceLookup = new Map<number, ClassifiedSource>();
  usableSources.forEach((s, i) => sourceLookup.set(i + 1, s));

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(opts.url, sources, opts.pitchContext);
  const rawHooks = await callClaude(systemPrompt, userPrompt, claudeApiKey);

  // Publish Gate — enforce all rules (validate → rewrite → drop, Tier B cap, anchor filter)
  const gated = publishGate(rawHooks, sourceLookup, { includeMarketContext });

  // Signal vs Fundamental gate
  if (lowSignal) {
    return {
      hooks: gated.slice(0, 1),
      suggestion: LOW_SIGNAL_SUGGESTION,
      lowSignal: true,
    };
  }

  // If nothing survived publish gate, return low signal
  if (gated.length === 0) {
    return {
      hooks: [],
      suggestion: NO_ANCHOR_SUGGESTION,
      lowSignal: true,
    };
  }

  const limit = opts.count ?? gated.length;
  return { hooks: gated.slice(0, limit), lowSignal: false };
}
