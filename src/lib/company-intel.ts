import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { callClaude, getDomain } from "@/lib/hooks";

type SearchResult = { title?: string; url?: string; description?: string };

export interface CompanyIntelligence {
  companyName: string | null;
  industry: string | null;
  subIndustry: string | null;
  employeeRange: string | null;
  hqLocation: string | null;
  foundedYear: number | null;
  description: string | null;
  techStack: string[];
  techStackSources: Array<{ tech: string; source: string; evidence: string }>;
  decisionMakers: Array<{ title: string; department: string }>;
  competitors: Array<{ name: string; domain: string }>;
  fundingSignals: Array<{ summary: string; date: string; sourceUrl: string }>;
  hiringSignals: Array<{ summary: string; roles: string[]; sourceUrl: string }>;
  recentNews: Array<{ headline: string; date: string; sourceUrl: string }>;
  confidenceScore: number;
}

export interface BasicCompanyIntel {
  companyName: string | null;
  industry: string | null;
  employeeRange: string | null;
  hqLocation: string | null;
  description: string | null;
}

const EMPTY_INTEL: CompanyIntelligence = {
  companyName: null,
  industry: null,
  subIndustry: null,
  employeeRange: null,
  hqLocation: null,
  foundedYear: null,
  description: null,
  techStack: [],
  techStackSources: [],
  decisionMakers: [],
  competitors: [],
  fundingSignals: [],
  hiringSignals: [],
  recentNews: [],
  confidenceScore: 0,
};

async function searchExa(query: string, apiKey: string, count = 6): Promise<SearchResult[]> {
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

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "GetSignalHooksBot/1.0" } });
  if (!res.ok) return "";
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

async function extractJsonArray(prompt: string, claudeApiKey: string) {
  const payload = await callClaude("Return ONLY a JSON array.", prompt, claudeApiKey, "claude-haiku-4-5-20251001");
  return Array.isArray(payload) ? payload : [];
}

const THIRD_PARTY_HOSTS = new Set([
  "linkedin.com", "techcrunch.com", "reuters.com", "bloomberg.com",
  "crunchbase.com", "pitchbook.com", "twitter.com", "x.com",
  "businessinsider.com", "forbes.com", "wsj.com", "ft.com",
]);

function isThirdPartyUrl(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
    return THIRD_PARTY_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function extractLinkedInSlug(url: string): string | null {
  const m = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  return m ? m[1].replace(/-/g, " ") : null;
}

async function extractBasicCompanyInfo(url: string, searchApiKey: string, claudeApiKey: string, searchIdentifier?: string): Promise<BasicCompanyIntel & { companyNameRaw?: string; industryRaw?: string; foundedYear?: number | null }> {
  const domain = getDomain(url);
  // Use provided identifier (company name/slug) for search, fall back to domain
  const searchTerm = searchIdentifier || domain;
  const fetchUrl = isThirdPartyUrl(url) ? null : url; // don't try to fetch LinkedIn/media pages
  const [homepage, results] = await Promise.all([
    fetchUrl ? fetchPage(fetchUrl).catch(() => "") : Promise.resolve(""),
    searchExa(`"${searchTerm}" company overview employees headquarters`, searchApiKey, 5),
  ]);

  const context = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || ""}`)
    .join("\n\n");

  const rows = await extractJsonArray(
    `Extract one company profile as JSON array with one object:\n[{"companyName":string|null,"industry":string|null,"employeeRange":string|null,"hqLocation":string|null,"description":string|null,"subIndustry":string|null,"foundedYear":number|null}]\nHomepage text:\n${homepage}\n\nSearch results:\n${context}`,
    claudeApiKey,
  );

  const obj = (rows[0] || {}) as Record<string, unknown>;
  return {
    companyName: typeof obj.companyName === "string" ? obj.companyName : null,
    industry: typeof obj.industry === "string" ? obj.industry : null,
    employeeRange: typeof obj.employeeRange === "string" ? obj.employeeRange : null,
    hqLocation: typeof obj.hqLocation === "string" ? obj.hqLocation : null,
    description: typeof obj.description === "string" ? obj.description : null,
    companyNameRaw: typeof obj.companyName === "string" ? obj.companyName : undefined,
    industryRaw: typeof obj.industry === "string" ? obj.industry : undefined,
    foundedYear: typeof obj.foundedYear === "number" ? obj.foundedYear : null,
  };
}

async function detectTechStack(companyName: string, domain: string, searchApiKey: string, claudeApiKey: string) {
  const [jobs, thirdParty] = await Promise.all([
    searchExa(`"${companyName}" hiring engineer developer React Python AWS`, searchApiKey, 6),
    searchExa(`"${domain}" site:stackshare.io OR site:builtwith.com`, searchApiKey, 6),
  ]);
  const combined = [...jobs, ...thirdParty]
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || ""}`)
    .join("\n\n");

  const rows = await extractJsonArray(
    `Extract tech stack evidence as JSON array:\n[{"tech":string,"source":string,"evidence":string}]\nCompany: ${companyName}\n${combined}`,
    claudeApiKey,
  );

  const sources = rows
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.tech === "string" && typeof x.source === "string")
    .map((x) => ({ tech: String(x.tech), source: String(x.source), evidence: String(x.evidence || "") }));

  const stack = [...new Set(sources.map((s) => s.tech))];
  return { stack, sources };
}

async function extractDecisionMakers(companyName: string, domain: string, searchApiKey: string, claudeApiKey: string) {
  const results = await searchExa(`"${companyName}" VP Director "Head of" Chief Sales Marketing Engineering`, searchApiKey, 8);
  const context = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || ""}`).join("\n\n");

  const rows = await extractJsonArray(
    `Extract decision maker TITLES ONLY (no names, no emails) as JSON array: [{"title":string,"department":string}]\nCompany: ${companyName} (${domain})\n${context}`,
    claudeApiKey,
  );

  return rows
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.title === "string")
    .map((x) => ({ title: String(x.title), department: String(x.department || "General") }))
    .slice(0, 8);
}

async function findCompetitors(companyName: string, industry: string, searchApiKey: string, claudeApiKey: string) {
  const results = await searchExa(`"${companyName}" competitor alternative vs compared ${industry || ""}`, searchApiKey, 8);
  const context = results.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.description || ""}`).join("\n\n");

  const rows = await extractJsonArray(
    `Extract competitors as JSON array: [{"name":string,"domain":string}]\n${context}`,
    claudeApiKey,
  );

  return rows
    .map((x) => x as Record<string, unknown>)
    .filter((x) => typeof x.name === "string")
    .map((x) => ({ name: String(x.name), domain: String(x.domain || "") }))
    .slice(0, 8);
}

function computeConfidence(intel: CompanyIntelligence): number {
  const checks = [
    !!intel.companyName,
    !!intel.industry,
    !!intel.employeeRange,
    !!intel.hqLocation,
    !!intel.description,
    intel.techStack.length > 0,
    intel.decisionMakers.length > 0,
    intel.competitors.length > 0,
  ];
  return Number((checks.filter(Boolean).length / checks.length).toFixed(2));
}

export async function getCachedIntel(domain: string): Promise<CompanyIntelligence | null> {
  const [row] = await db
    .select()
    .from(schema.companyIntel)
    .where(and(eq(schema.companyIntel.domain, domain), gt(schema.companyIntel.expiresAt, new Date().toISOString())))
    .limit(1);

  if (!row) return null;
  return {
    companyName: row.companyName,
    industry: row.industry,
    subIndustry: row.subIndustry,
    employeeRange: row.employeeRange,
    hqLocation: row.hqLocation,
    foundedYear: row.foundedYear,
    description: row.description,
    techStack: (row.techStack as string[]) || [],
    techStackSources: (row.techStackSources as Array<{ tech: string; source: string; evidence: string }>) || [],
    decisionMakers: (row.decisionMakers as Array<{ title: string; department: string }>) || [],
    competitors: (row.competitors as Array<{ name: string; domain: string }>) || [],
    fundingSignals: (row.fundingSignals as Array<{ summary: string; date: string; sourceUrl: string }>) || [],
    hiringSignals: (row.hiringSignals as Array<{ summary: string; roles: string[]; sourceUrl: string }>) || [],
    recentNews: (row.recentNews as Array<{ headline: string; date: string; sourceUrl: string }>) || [],
    confidenceScore: row.confidenceScore || 0,
  };
}

export async function setCachedIntel(domain: string, intel: CompanyIntelligence, url: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(schema.companyIntel).values({
    domain,
    url,
    companyName: intel.companyName,
    industry: intel.industry,
    subIndustry: intel.subIndustry,
    employeeRange: intel.employeeRange,
    hqLocation: intel.hqLocation,
    foundedYear: intel.foundedYear,
    description: intel.description,
    techStack: intel.techStack,
    techStackSources: intel.techStackSources,
    decisionMakers: intel.decisionMakers,
    competitors: intel.competitors,
    fundingSignals: intel.fundingSignals,
    hiringSignals: intel.hiringSignals,
    recentNews: intel.recentNews,
    confidenceScore: intel.confidenceScore,
    expiresAt,
  }).onConflictDoUpdate({
    target: schema.companyIntel.domain,
    set: {
      url,
      companyName: intel.companyName,
      industry: intel.industry,
      subIndustry: intel.subIndustry,
      employeeRange: intel.employeeRange,
      hqLocation: intel.hqLocation,
      foundedYear: intel.foundedYear,
      description: intel.description,
      techStack: intel.techStack,
      techStackSources: intel.techStackSources,
      decisionMakers: intel.decisionMakers,
      competitors: intel.competitors,
      fundingSignals: intel.fundingSignals,
      hiringSignals: intel.hiringSignals,
      recentNews: intel.recentNews,
      confidenceScore: intel.confidenceScore,
      expiresAt,
    },
  });
}

export async function getCompanyIntelligence(
  companyUrl: string,
  searchApiKey: string,
  claudeApiKey: string,
  fullAccess: boolean,
  companyNameHint?: string,
): Promise<CompanyIntelligence> {
  // Resolve the real company identifier when given a third-party URL (LinkedIn, media, etc.)
  let searchIdentifier: string | undefined;
  if (isThirdPartyUrl(companyUrl)) {
    searchIdentifier = extractLinkedInSlug(companyUrl) || companyNameHint || undefined;
  }
  // Cache by the real company domain or a sanitised slug from the search identifier
  const domain = getDomain(companyUrl);
  const cacheKey = searchIdentifier
    ? searchIdentifier.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    : domain;

  const cached = await getCachedIntel(cacheKey);
  if (cached) {
    if (fullAccess) return cached;
    return { ...cached, techStack: [], techStackSources: [], decisionMakers: [], competitors: [] };
  }

  const basic = await extractBasicCompanyInfo(companyUrl, searchApiKey, claudeApiKey, searchIdentifier);
  const base: CompanyIntelligence = {
    ...EMPTY_INTEL,
    companyName: basic.companyName,
    industry: basic.industry,
    employeeRange: basic.employeeRange,
    hqLocation: basic.hqLocation,
    description: basic.description,
    foundedYear: basic.foundedYear || null,
  };

  if (fullAccess) {
    const companyName = base.companyName || domain;
    const [tech, roles, competitors] = await Promise.all([
      detectTechStack(companyName, domain, searchApiKey, claudeApiKey).catch(() => ({ stack: [], sources: [] })),
      extractDecisionMakers(companyName, domain, searchApiKey, claudeApiKey).catch(() => []),
      findCompetitors(companyName, base.industry || "", searchApiKey, claudeApiKey).catch(() => []),
    ]);
    base.techStack = tech.stack;
    base.techStackSources = tech.sources;
    base.decisionMakers = roles;
    base.competitors = competitors;
  }

  base.confidenceScore = computeConfidence(base);
  await setCachedIntel(cacheKey, base, companyUrl);

  if (!fullAccess) {
    return { ...base, techStack: [], techStackSources: [], decisionMakers: [], competitors: [] };
  }
  return base;
}
