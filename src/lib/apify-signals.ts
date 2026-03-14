import type { ClassifiedSource } from "./hooks";
import type { EvidenceTier } from "./types";

const APIFY_BASE = "https://api.apify.com/v2/acts";

// Generic Apify actor runner — synchronous run with dataset item response
async function callApifyActor<T>(
  actorSlug: string,
  input: Record<string, unknown>,
  token: string,
  timeoutSeconds = 20,
): Promise<T[]> {
  const slug = actorSlug.replace("/", "~");
  const res = await fetch(
    `${APIFY_BASE}/${slug}/run-sync-get-dataset-items?timeout=${timeoutSeconds}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) return [];
  return (await res.json() as T[]);
}

// --- Prong E: Crunchbase ---

type CrunchbaseItem = {
  name?: string;
  description?: string;
  fundingTotal?: string;
  lastFundingType?: string;
  lastFundingDate?: string;
  lastFundingAmount?: string;
  totalFundingRounds?: number;
  ceo?: string;
  founded?: string;
  employeeCount?: string;
  website?: string;
};

export async function fetchCrunchbaseSignals(
  domain: string,
  companyName: string,
  token: string,
): Promise<ClassifiedSource[]> {
  const items = await callApifyActor<CrunchbaseItem>(
    "ingenious_mastiff/crunchbase-scrapper",
    { query: companyName, maxResults: 3 },
    token,
  ).catch(() => [] as CrunchbaseItem[]);

  return items
    .filter((item) => item.name && item.description)
    .map((item): ClassifiedSource => {
      const facts: string[] = [];
      if (item.description) facts.push(item.description);
      if (item.lastFundingType && item.lastFundingAmount) {
        facts.push(`${item.name} raised ${item.lastFundingAmount} in ${item.lastFundingType}${item.lastFundingDate ? ` (${item.lastFundingDate})` : ""}.`);
      }
      if (item.employeeCount) facts.push(`Headcount: ${item.employeeCount} employees.`);
      if (item.ceo) facts.push(`CEO: ${item.ceo}.`);

      const tier: EvidenceTier = item.lastFundingDate ? "A" : "B";
      return {
        title: `${item.name} — Crunchbase profile`,
        publisher: "crunchbase.com",
        date: item.lastFundingDate ?? "",
        url: `https://www.crunchbase.com/organization/${domain.split(".")[0]}`,
        facts,
        tier,
        anchorScore: 5,
        entity_hit_score: 3,
        entity_matched_term: domain,
      };
    })
    .filter((s) => s.facts.length > 0);
}

// --- Prong F: LinkedIn Posts ---

type LinkedInPost = {
  text?: string;
  postedAt?: string;
  postUrl?: string;
  authorName?: string;
  likesCount?: number;
};

export async function fetchLinkedInPostSignals(
  linkedinSlug: string,
  domain: string,
  token: string,
): Promise<ClassifiedSource[]> {
  if (!linkedinSlug) return [];

  const items = await callApifyActor<LinkedInPost>(
    "api-empire/linkedin-post-scraper",
    {
      url: `https://www.linkedin.com/company/${linkedinSlug}/posts/`,
      maxPosts: 10,
    },
    token,
  ).catch(() => [] as LinkedInPost[]);

  return items
    .filter((post) => post.text && post.text.length > 50)
    .slice(0, 5)
    .map((post): ClassifiedSource => ({
      title: `${domain} LinkedIn post — ${post.postedAt ?? "recent"}`,
      publisher: "linkedin.com",
      date: post.postedAt ?? "",
      url: post.postUrl ?? `https://www.linkedin.com/company/${linkedinSlug}/`,
      facts: [post.text!.slice(0, 500)],
      tier: post.postedAt ? "A" : "B",
      anchorScore: 4,
      entity_hit_score: 2,
      entity_matched_term: domain,
    }));
}
