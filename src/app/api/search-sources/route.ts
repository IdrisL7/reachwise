import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type SourceResult = {
  url: string;
  title: string;
  label: string;
  domain: string;
  priority: number;
};

const DOMAIN_RULES: { pattern: RegExp; label: string; priority: number }[] = [
  { pattern: /getlatka\.com/, label: "Revenue data", priority: 1 },
  { pattern: /businesswire\.com|prnewswire\.com|globenewswire\.com/, label: "Press release", priority: 2 },
  { pattern: /techcrunch\.com|venturebeat\.com|reuters\.com|bloomberg\.com|wsj\.com|ft\.com/, label: "News", priority: 3 },
  { pattern: /crunchbase\.com|pitchbook\.com/, label: "Funding data", priority: 4 },
  { pattern: /linkedin\.com\/company/, label: "LinkedIn", priority: 5 },
];

function classifySource(url: string, companyName: string): { label: string; priority: number } {
  for (const rule of DOMAIN_RULES) {
    if (rule.pattern.test(url)) return { label: rule.label, priority: rule.priority };
  }
  const slug = companyName.toLowerCase().replace(/\s+/g, "");
  const urlLower = url.toLowerCase();
  if (urlLower.includes(slug) || urlLower.includes(slug.slice(0, 5))) {
    return { label: "Company site", priority: 8 };
  }
  return { label: "News", priority: 6 };
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rateLimitResponse = await checkRateLimit(ip, "public:search-sources");
  if (rateLimitResponse) return rateLimitResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const companyName =
    typeof (body as Record<string, unknown>)?.companyName === "string"
      ? ((body as Record<string, unknown>).companyName as string).trim()
      : "";

  if (!companyName || companyName.length > 100) {
    return NextResponse.json(
      { error: "companyName must be a non-empty string of at most 100 characters" },
      { status: 400 },
    );
  }

  const exaRes = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.EXA_API_KEY ?? "" },
    body: JSON.stringify({
      query: `${companyName} company news funding press release`,
      type: "auto",
      num_results: 15,
    }),
  });

  if (!exaRes.ok) {
    const errBody = await exaRes.text().catch(() => "");
    console.error("[search-sources] Exa error", exaRes.status, errBody);
    return NextResponse.json({ error: `Search failed (${exaRes.status})` }, { status: 502 });
  }

  const data = (await exaRes.json()) as { results?: { url: string; title: string }[] };
  const results = data.results ?? [];

  // Map to SourceResult
  const mapped: SourceResult[] = results.map((r) => {
    let domain = "";
    try {
      domain = new URL(r.url).hostname.replace("www.", "");
    } catch {
      domain = r.url;
    }
    const { label, priority } = classifySource(r.url, companyName);
    return { url: r.url, title: r.title, label, domain, priority };
  });

  // Deduplicate by domain — keep highest priority (lowest number) per domain
  const byDomain = new Map<string, SourceResult>();
  for (const item of mapped) {
    const existing = byDomain.get(item.domain);
    if (!existing || item.priority < existing.priority) {
      byDomain.set(item.domain, item);
    }
  }

  const sources = Array.from(byDomain.values())
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);

  // Always append guaranteed fallback links (deduplicated against search results)
  const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const guaranteed: SourceResult[] = [
    {
      url: `https://www.linkedin.com/company/${slug}/about/`,
      title: `${companyName} on LinkedIn`,
      label: "LinkedIn",
      domain: "linkedin.com",
      priority: 5,
    },
    {
      url: `https://www.crunchbase.com/organization/${slug}`,
      title: `${companyName} on Crunchbase`,
      label: "Funding data",
      domain: "crunchbase.com",
      priority: 4,
    },
  ];

  const existingDomains = new Set(sources.map((s) => s.domain));
  for (const g of guaranteed) {
    if (!existingDomains.has(g.domain)) {
      sources.push(g);
    }
  }

  return NextResponse.json({ sources });
}
