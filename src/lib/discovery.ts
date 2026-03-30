import { db, schema } from "@/lib/db";
import { callClaude, getDomain } from "@/lib/hooks";

type SearchResult = {
  title?: string;
  url?: string;
  description?: string;
};

export interface DiscoveryCriteria {
  industry?: string;
  techStack?: string[];
  companySize?: string;
  location?: string;
  signals?: ("hiring" | "funding" | "tech_change" | "growth")[];
  keywords?: string;
}

export interface DiscoveredCompany {
  name: string;
  domain: string;
  url: string;
  description: string;
  industry: string | null;
  employeeRange: string | null;
  location: string | null;
  matchingSignals: string[];
  confidenceScore: number;
  sourceUrls: string[];
}

export interface DiscoveryResult {
  companies: DiscoveredCompany[];
  totalEstimate: number;
  searchId: string;
  criteria: DiscoveryCriteria;
}

async function searchExa(query: string, apiKey: string, count = 8): Promise<SearchResult[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      query,
      type: "auto",
      numResults: count,
      contents: { text: true },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return ((data?.results ?? []) as Array<{ title?: string; url?: string; text?: string }>).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.text,
  }));
}

export function buildDiscoveryQueries(criteria: DiscoveryCriteria): string[] {
  const queries: string[] = [];
  const industry = criteria.industry || "";
  const size = criteria.companySize ? `\"${criteria.companySize} employees\"` : "";
  const location = criteria.location || "";

  if (industry || size || location) {
    queries.push([industry, "company", size, location].filter(Boolean).join(" "));
  }

  // Add a natural-language fallback query with numeric tokens stripped (e.g. "fintech 1000 london" → "top fintech companies london")
  const industryClean = industry.replace(/\b\d+\b/g, "").replace(/\s+/g, " ").trim();
  if (industryClean || location) {
    const nlQuery = ["top", industryClean || industry, "companies", location]
      .filter(Boolean)
      .join(" ");
    queries.push(nlQuery);
  }

  if (criteria.techStack?.length) {
    const tech = criteria.techStack.slice(0, 3).map((t) => `\"uses ${t}\" OR \"${t} customer\"`).join(" OR ");
    queries.push([tech, "company", industry].filter(Boolean).join(" "));
  }

  if (criteria.signals?.length) {
    const terms = criteria.signals.map((s) => (s === "tech_change" ? "migrated OR adopted" : s)).join(" OR ");
    queries.push([industry, "company", terms, location].filter(Boolean).join(" "));
  }

  if (criteria.keywords) {
    queries.push([criteria.keywords, industry, size, location].filter(Boolean).join(" "));
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 4);
}

async function extractCompaniesFromResults(
  searchResults: SearchResult[],
  criteria: DiscoveryCriteria,
  claudeApiKey: string,
): Promise<DiscoveredCompany[]> {
  if (searchResults.length === 0) return [];

  const context = searchResults
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || ""}`)
    .join("\n\n");

  const raw = await callClaude(
    "Return ONLY a JSON array.",
    `The user is looking for companies broadly described as: ${JSON.stringify(criteria)}\n\nExtract any companies from the search results below that broadly relate to this description. Include a company even if it only partially matches — be generous, not strict.\nReturn a JSON array of objects with keys: name, domain, url, description, industry, employeeRange, location, matchingSignals, sourceUrls\n\nResults:\n${context}`,
    claudeApiKey,
  );

  return raw
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.domain === "string" && typeof x.url === "string")
    .map((x) => ({
      name: String(x.name || x.domain),
      domain: String(x.domain),
      url: String(x.url),
      description: String(x.description || ""),
      industry: typeof x.industry === "string" ? x.industry : null,
      employeeRange: typeof x.employeeRange === "string" ? x.employeeRange : null,
      location: typeof x.location === "string" ? x.location : null,
      matchingSignals: Array.isArray(x.matchingSignals) ? x.matchingSignals.map(String) : [],
      confidenceScore: 0,
      sourceUrls: Array.isArray(x.sourceUrls) ? x.sourceUrls.map(String) : [],
    }));
}

function deduplicateAndScore(companies: DiscoveredCompany[], criteria: DiscoveryCriteria): DiscoveredCompany[] {
  const totalCriteria = [
    !!criteria.industry,
    !!criteria.companySize,
    !!criteria.location,
    !!criteria.keywords,
    (criteria.techStack?.length || 0) > 0,
    (criteria.signals?.length || 0) > 0,
  ].filter(Boolean).length || 1;

  const byDomain = new Map<string, DiscoveredCompany>();
  for (const company of companies) {
    const domain = getDomain(company.url || company.domain);
    const existing = byDomain.get(domain);

    const matches = company.matchingSignals.length || 1;
    company.confidenceScore = Math.min(1, Number((matches / totalCriteria).toFixed(2)));
    company.domain = domain;

    if (!existing || company.confidenceScore > existing.confidenceScore) {
      byDomain.set(domain, company);
    }
  }

  return [...byDomain.values()].sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export async function discoverCompanies(
  criteria: DiscoveryCriteria,
  userId: string,
  searchApiKey: string,
  claudeApiKey: string,
  limit = 20,
): Promise<DiscoveryResult> {
  const queries = buildDiscoveryQueries(criteria);
  const resultLists = await Promise.all(queries.map((q) => searchExa(q, searchApiKey, 8).catch(() => [])));

  const merged = resultLists.flat().slice(0, 30);
  const extracted = await extractCompaniesFromResults(merged, criteria, claudeApiKey);
  const scored = deduplicateAndScore(extracted, criteria).slice(0, limit);

  const id = crypto.randomUUID();
  await db.insert(schema.discoverySearches).values({
    id,
    userId,
    criteria,
    resultCount: scored.length,
    results: scored,
  });

  return {
    companies: scored,
    totalEstimate: scored.length,
    searchId: id,
    criteria,
  };
}
