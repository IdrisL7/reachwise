# Competitive Features Plan: Company Intelligence + Lead Discovery

**Date**: 2026-03-12
**Goal**: Close the two biggest gaps vs Clay.com — no company intelligence and no lead discovery.

---

## Phase 1: Company Intelligence Dashboard

### What it does

When a user generates hooks, also extract and display structured company data alongside the hooks. Cached per domain with 7-day TTL. Runs in parallel with existing hook generation (no added latency).

### Data extracted per company

| Field | Starter | Pro/Concierge |
|-------|---------|---------------|
| Company name, industry, size, HQ, description | Yes | Yes |
| Tech stack (with sources) | No | Yes |
| Decision maker titles (no PII — titles only, never names/emails) | No | Yes |
| Competitors | No | Yes |
| Funding/hiring/news signals | Already in intent scoring | Already in intent scoring |

### Extraction strategy (all via existing Brave Search + Claude — no new API keys)

1. **Basic info** (all tiers): Fetch homepage + 1 Brave search `"[company]" company overview employees headquarters`. Claude extracts structured JSON from top 5 results + homepage content.

2. **Tech stack** (Pro/Concierge only): 2 parallel Brave searches:
   - `"[company]" hiring engineer developer React Python AWS` — job postings reveal stack
   - `"[domain]" site:stackshare.io OR site:builtwith.com` — third-party profiles
   Claude extracts tech names from combined results.

3. **Decision makers** (Pro/Concierge only): Brave search for `"[company]" VP Director "Head of" Chief Sales Marketing Engineering`. Extract titles and departments only (never names or contact info).

4. **Competitors** (Pro/Concierge only): Brave search for `"[company]" competitor alternative vs compared`. Extract from G2, comparison sites.

### New files to create

#### `src/lib/company-intel.ts` (~400-500 lines)

Core extraction module. Key types and functions:

```ts
export interface CompanyIntelligence {
  companyName: string | null;
  industry: string | null;
  subIndustry: string | null;
  employeeRange: string | null; // "11-50", "51-200", etc.
  hqLocation: string | null;
  foundedYear: number | null;
  description: string | null; // 1-2 sentence summary
  techStack: string[]; // ["React", "AWS", "Salesforce"]
  techStackSources: Array<{ tech: string; source: string; evidence: string }>;
  decisionMakers: Array<{ title: string; department: string }>; // titles only, no PII
  competitors: Array<{ name: string; domain: string }>;
  fundingSignals: Array<{ summary: string; date: string; sourceUrl: string }>;
  hiringSignals: Array<{ summary: string; roles: string[]; sourceUrl: string }>;
  recentNews: Array<{ headline: string; date: string; sourceUrl: string }>;
  confidenceScore: number; // 0-1, how much data we found
}

export interface BasicCompanyIntel {
  companyName: string | null;
  industry: string | null;
  employeeRange: string | null;
  hqLocation: string | null;
  description: string | null;
}

// Main entry point — called from generate-hooks route
export async function getCompanyIntelligence(
  companyUrl: string,
  braveApiKey: string,
  claudeApiKey: string,
  fullAccess: boolean, // false for Starter (basic only)
): Promise<CompanyIntelligence>

// Cache layer — checks company_intel table, returns null if expired or missing
export async function getCachedIntel(domain: string): Promise<CompanyIntelligence | null>
export async function setCachedIntel(domain: string, intel: CompanyIntelligence, url: string): Promise<void>

// Extraction sub-functions (each uses Brave Search + Claude)
async function extractBasicCompanyInfo(url: string, braveApiKey: string, claudeApiKey: string): Promise<BasicCompanyIntel>
async function detectTechStack(companyName: string, domain: string, braveApiKey: string, claudeApiKey: string): Promise<{ stack: string[]; sources: Array<{ tech: string; source: string; evidence: string }> }>
async function extractDecisionMakers(companyName: string, domain: string, braveApiKey: string, claudeApiKey: string): Promise<Array<{ title: string; department: string }>>
async function findCompetitors(companyName: string, industry: string, braveApiKey: string, claudeApiKey: string): Promise<Array<{ name: string; domain: string }>>
```

Use the existing Brave Search fetch pattern from `src/lib/hooks.ts` (the `fetchSourcesWithGating` and direct-fetch patterns). Use the existing Claude call pattern from `src/lib/hooks.ts` (`callClaude`). Reuse `getDomain` from hooks.ts for domain normalization.

#### `src/app/api/company-intel/route.ts`

Standalone endpoint for fetching company intel without generating hooks. Used by the discovery page and for on-demand research.

```ts
// GET /api/company-intel?url=https://acme.com
// Returns CompanyIntelligence JSON
// Requires auth, rate limited (use "auth:hooks" rate limit config), tier-gated
// Starter gets basic fields only (name, industry, size, HQ, description)
// Pro/Concierge get full intel
```

#### `src/app/app/hooks/company-intel-panel.tsx`

Collapsible UI panel displayed above hooks results. Match the existing dark theme (zinc-900 bg, zinc-800 border, rounded-xl — same pattern as `intent-signals.tsx`).

Layout:
```
+------------------------------------------------------+
| Company Intelligence                    [Collapse ^]  |
+------------------------------------------------------+
| Acme Inc  |  SaaS / Developer Tools  |  51-200       |
| San Francisco, CA  |  Founded 2019                    |
+------------------------------------------------------+
| Tech Stack: React, TypeScript, AWS, Stripe, Segment   |
|   (sourced from job postings + builtwith)             |
+------------------------------------------------------+
| Key Roles: VP Engineering, Head of Sales, CTO         |
| Competitors: Competitor1, Competitor2                  |
+------------------------------------------------------+
| Recent Signals:                                       |
|  [funding] Series B $25M - Jan 2026  [source link]   |
|  [hiring] 12 open roles (engineering) [source link]   |
+------------------------------------------------------+
```

Props:
```ts
interface CompanyIntelPanelProps {
  intel: CompanyIntelligence;
  isBasic: boolean; // true for Starter — show upgrade prompt for hidden sections
  onGenerateHooks?: (url: string) => void; // used when rendered from discovery page
}
```

For Starter users, show the basic fields and a subtle upgrade prompt ("Upgrade to Pro to see tech stack, decision makers, and competitors") for the locked sections.

### Files to modify

#### `src/lib/db/schema.ts`

Add `company_intel` table after `stripeEvents`:

```ts
export const companyIntel = sqliteTable("company_intel", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  domain: text("domain").notNull().unique(),
  url: text("url").notNull(),
  companyName: text("company_name"),
  industry: text("industry"),
  subIndustry: text("sub_industry"),
  employeeRange: text("employee_range"),
  hqLocation: text("hq_location"),
  foundedYear: integer("founded_year"),
  description: text("description"),
  techStack: text("tech_stack", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  techStackSources: text("tech_stack_sources", { mode: "json" }).$type<Array<{ tech: string; source: string; evidence: string }>>().default(sql`'[]'`),
  decisionMakers: text("decision_makers", { mode: "json" }).$type<Array<{ title: string; department: string }>>().default(sql`'[]'`),
  competitors: text("competitors", { mode: "json" }).$type<Array<{ name: string; domain: string }>>().default(sql`'[]'`),
  fundingSignals: text("funding_signals", { mode: "json" }).$type<Array<{ summary: string; date: string; sourceUrl: string }>>().default(sql`'[]'`),
  hiringSignals: text("hiring_signals", { mode: "json" }).$type<Array<{ summary: string; roles: string[]; sourceUrl: string }>>().default(sql`'[]'`),
  recentNews: text("recent_news", { mode: "json" }).$type<Array<{ headline: string; date: string; sourceUrl: string }>>().default(sql`'[]'`),
  confidenceScore: real("confidence_score"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("company_intel_domain_idx").on(table.domain),
  index("company_intel_expires_at_idx").on(table.expiresAt),
]);
```

Also add `discoverySearches` table (see Phase 2 section below).

#### Migration: `drizzle/0007_add_company_intel_and_discovery.sql`

```sql
CREATE TABLE company_intel (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  company_name TEXT,
  industry TEXT,
  sub_industry TEXT,
  employee_range TEXT,
  hq_location TEXT,
  founded_year INTEGER,
  description TEXT,
  tech_stack TEXT DEFAULT '[]',
  tech_stack_sources TEXT DEFAULT '[]',
  decision_makers TEXT DEFAULT '[]',
  competitors TEXT DEFAULT '[]',
  funding_signals TEXT DEFAULT '[]',
  hiring_signals TEXT DEFAULT '[]',
  recent_news TEXT DEFAULT '[]',
  confidence_score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX company_intel_domain_idx ON company_intel(domain);
CREATE INDEX company_intel_expires_at_idx ON company_intel(expires_at);

CREATE TABLE discovery_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT,
  criteria TEXT NOT NULL DEFAULT '{}',
  result_count INTEGER NOT NULL DEFAULT 0,
  results TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX discovery_searches_user_id_idx ON discovery_searches(user_id);
```

Run `pnpm drizzle-kit push` after creating the migration.

#### `src/lib/tiers.ts`

Add two new flags to the `Tier["flags"]` interface:

```ts
flags: {
  // ... existing flags ...
  companyIntel: boolean;    // NEW
  leadDiscovery: boolean;   // NEW
};
```

Set per tier:
- **Starter**: `companyIntel: true` (basic only — gated in the lib), `leadDiscovery: false`
- **Pro**: `companyIntel: true` (full access), `leadDiscovery: true`
- **Concierge**: `companyIntel: true` (full access), `leadDiscovery: true`

#### `src/lib/tier-guard.ts`

Add `discoverySearchesPerMonth` to the `TierLimits` interface and `TIER_LIMITS`:

```ts
interface TierLimits {
  hooksPerMonth: number;
  batchSize: number;
  discoverySearchesPerMonth: number; // NEW
}

const TIER_LIMITS: Record<TierId, TierLimits> = {
  starter: { hooksPerMonth: 200, batchSize: 10, discoverySearchesPerMonth: 0 },
  pro: { hooksPerMonth: 750, batchSize: 75, discoverySearchesPerMonth: 50 },
  concierge: { hooksPerMonth: 10000, batchSize: 75, discoverySearchesPerMonth: 200 },
};
```

Add a new function `checkDiscoveryQuota` following the same pattern as `checkHookQuota` — but instead of tracking on the user row, count rows in `discovery_searches` for the current month.

#### `src/lib/rate-limit.ts`

Add to `RATE_LIMITS`:

```ts
"auth:discover": { limit: 10, windowSeconds: 60 },
"auth:company-intel": { limit: 30, windowSeconds: 60 },
```

#### `src/app/api/generate-hooks/route.ts`

Modify to run company intel extraction in parallel with existing hook generation. Around line 382 where intent scoring runs:

```ts
// Run intent scoring AND company intel in parallel for Pro/Concierge
let intentData = null;
let companyIntel = null;

if (tierId === "pro" || tierId === "concierge") {
  const [intentResult, intelResult] = await Promise.allSettled([
    researchIntentSignals(url, companyName || companyDomain || "", braveApiKey, claudeApiKey),
    getCompanyIntelligence(url, braveApiKey, claudeApiKey, true),
  ]);
  if (intentResult.status === "fulfilled") {
    const signals = intentResult.value;
    const score = computeIntentScore(signals);
    intentData = { score, temperature: getTemperature(score), signals: signals.map(/* ... */) };
  }
  if (intelResult.status === "fulfilled") {
    companyIntel = intelResult.value;
  }
} else {
  // Starter gets basic intel only
  try {
    companyIntel = await getCompanyIntelligence(url, braveApiKey, claudeApiKey, false);
  } catch {}
}
```

Add `companyIntel` to the JSON response (line 408):

```ts
return NextResponse.json({
  // ... existing fields ...
  companyIntel, // NEW
});
```

#### `src/app/app/hooks/page.tsx`

Add state for company intel:

```ts
const [companyIntel, setCompanyIntel] = useState<CompanyIntelligence | null>(null);
```

In the `doGenerate` callback, parse `data.companyIntel` from the response and set state.

Render `<CompanyIntelPanel>` between the form and hooks results:

```tsx
{companyIntel && (
  <CompanyIntelPanel
    intel={companyIntel}
    isBasic={/* check if starter tier */}
  />
)}
```

Place it after the error/upgrade blocks and before the hooks list, so it appears as the first result section.

---

## Phase 2: Lead Discovery

### What it does

New `/app/discover` page where users search for companies by criteria (industry, tech stack, size, location, signals) and get a list of prospects. They can then generate hooks for any discovered company.

Pro and Concierge only — Starter sees an upgrade prompt.

### How discovery works

1. Convert user criteria into 2-4 Brave Search queries run in parallel. Examples:
   - Industry + size: `"SaaS" company "51-200 employees" [location]`
   - Tech stack: `"uses Salesforce" OR "Salesforce customer" company [industry]`
   - Signals: `[industry] company "hiring" OR "raised" OR "funding" [location]`
   - Keywords: User's free text combined with industry/size filters

2. Collect up to 30 Brave results across all queries.

3. Pass combined results to Claude with an extraction prompt requesting structured JSON per company: name, domain, description, estimated size, location, which criteria it matched.

4. Deduplicate by domain, compute a confidence score (how many criteria matched out of total criteria), sort descending.

5. Save search to `discovery_searches` table. Return top 20 results.

### New files to create

#### `src/lib/discovery.ts` (~300-400 lines)

```ts
export interface DiscoveryCriteria {
  industry?: string;
  techStack?: string[]; // ["React", "Salesforce"]
  companySize?: string; // "1-10", "11-50", "51-200", "201-500", "500+"
  location?: string; // "US", "UK", "San Francisco"
  signals?: ("hiring" | "funding" | "tech_change" | "growth")[];
  keywords?: string; // free-text
}

export interface DiscoveredCompany {
  name: string;
  domain: string;
  url: string;
  description: string;
  industry: string | null;
  employeeRange: string | null;
  location: string | null;
  matchingSignals: string[]; // which criteria it matched
  confidenceScore: number; // 0-1
  sourceUrls: string[]; // where we found it
}

export interface DiscoveryResult {
  companies: DiscoveredCompany[];
  totalEstimate: number;
  searchId: string;
  criteria: DiscoveryCriteria;
}

// Main entry point
export async function discoverCompanies(
  criteria: DiscoveryCriteria,
  userId: string,
  braveApiKey: string,
  claudeApiKey: string,
  limit?: number, // default 20
): Promise<DiscoveryResult>

// Build Brave search queries from criteria
function buildDiscoveryQueries(criteria: DiscoveryCriteria): string[]

// Claude extracts structured company list from search results
async function extractCompaniesFromResults(
  searchResults: BraveWebResult[],
  criteria: DiscoveryCriteria,
  claudeApiKey: string,
): Promise<DiscoveredCompany[]>

// Dedup by domain and score by criteria-match count
function deduplicateAndScore(companies: DiscoveredCompany[]): DiscoveredCompany[]
```

Use the existing Brave Search fetch pattern from `src/lib/hooks.ts`. Use the existing Claude call pattern.

#### `src/app/api/discover/route.ts`

```ts
// POST /api/discover
// Body: DiscoveryCriteria
// Returns: DiscoveryResult
// Requires: auth, Pro/Concierge tier (use checkFeature(tierId, "leadDiscovery")),
//           rate limited ("auth:discover"), discovery quota check
```

Follow the same pattern as `generate-hooks/route.ts` for auth, rate limiting, and error handling.

#### `src/app/app/discover/page.tsx`

Main page. Client component ("use client").

Layout:
```
+------------------------------------------------------+
| Discover Companies                                    |
| Find prospects matching your ideal customer profile   |
+------------------------------------------------------+
| Industry: [dropdown___]    Company Size: [dropdown__] |
| Location: [text input_]    Signals: [x]Hiring [x]Fund|
| Tech Stack: [React] [Salesforce] [+ Add tag]          |
| Keywords: [___________________________________]       |
|                               [Discover Companies ->] |
+------------------------------------------------------+
|                                                       |
| Found 18 companies matching your criteria             |
|                                                       |
| +--------------------------------------------------+ |
| | Acme Inc (acme.com)     SaaS | 51-200 | SF, CA   | |
| | "Developer tools for API management"              | |
| | Matched: hiring, tech_stack | Confidence: 92%     | |
| | [View Intel] [Generate Hooks] [Export]             | |
| +--------------------------------------------------+ |
| | Beta Corp (beta.io)    Fintech | 11-50 | London   | |
| | ...                                               | |
| +--------------------------------------------------+ |
|                                                       |
| [Export All CSV]  [Save Search]                       |
+------------------------------------------------------+
```

Break into sub-components:
- `src/app/app/discover/discovery-form.tsx` — The criteria form
- `src/app/app/discover/company-result-card.tsx` — Individual result card

Key interactions:
- **"View Intel"**: Opens inline expanded section (or modal) showing full `CompanyIntelPanel` via `/api/company-intel?url=...`
- **"Generate Hooks"**: Navigates to `/app/hooks?url=[encoded url]` with URL pre-filled. The hooks page should check URL params on mount and auto-populate the URL field.
- **"Export All CSV"**: Client-side CSV generation — columns: name, domain, description, industry, size, location, matched signals, confidence
- **"Save Search"**: POST to save the criteria so user can re-run later

For Starter users, show the full page but with an upgrade overlay/prompt instead of the search form.

### Files to modify

#### `src/lib/db/schema.ts`

Add `discoverySearches` table (included in the migration SQL above):

```ts
export const discoverySearches = sqliteTable("discovery_searches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name"),
  criteria: text("criteria", { mode: "json" }).notNull(),
  resultCount: integer("result_count").notNull().default(0),
  results: text("results", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("discovery_searches_user_id_idx").on(table.userId),
]);
```

#### `src/app/app/layout.tsx`

Add "Discover" to `primaryNav` array between "Batch" and "Leads":

```ts
const primaryNav = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/hooks", label: "Hooks" },
  { href: "/app/batch", label: "Batch" },
  { href: "/app/discover", label: "Discover" },  // NEW
  { href: "/app/leads", label: "Leads" },
];
```

#### `src/app/app/hooks/page.tsx`

Add URL param handling so navigating from discovery pre-fills the URL:

```ts
// At the top of HooksPage, read URL params
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const prefillUrl = params.get("url");
  if (prefillUrl) {
    setUrl(prefillUrl);
    // Optionally auto-submit
  }
}, []);
```

---

## Implementation Order

| Step | Task | New/Modified Files | Depends On |
|------|------|--------------------|------------|
| 1 | Schema + migration | `schema.ts`, `drizzle/0007_*.sql` | — |
| 2 | Tier flags | `tiers.ts` | — |
| 3 | Tier guard + rate limit | `tier-guard.ts`, `rate-limit.ts` | — |
| 4 | Company intel library | `src/lib/company-intel.ts` (new) | Step 1 |
| 5 | Company intel API route | `src/app/api/company-intel/route.ts` (new) | Step 4 |
| 6 | Integrate into generate-hooks | `src/app/api/generate-hooks/route.ts` | Steps 2, 4 |
| 7 | Company intel UI panel | `src/app/app/hooks/company-intel-panel.tsx` (new) | — |
| 8 | Update hooks page | `src/app/app/hooks/page.tsx` | Steps 6, 7 |
| 9 | Discovery library | `src/lib/discovery.ts` (new) | Step 1 |
| 10 | Discovery API route | `src/app/api/discover/route.ts` (new) | Steps 2, 3, 9 |
| 11 | Discovery page + components | `src/app/app/discover/*.tsx` (new) | Steps 7, 10 |
| 12 | Nav update + hooks URL params | `layout.tsx`, `hooks/page.tsx` | Step 11 |

Steps 1-3 can run in parallel. Steps 4-8 (Phase 1) then 9-12 (Phase 2) are sequential.

---

## Brave API Budget

| Action | Queries (Starter) | Queries (Pro/Concierge) |
|--------|-------------------|------------------------|
| Hook generation (existing) | ~4-6 | ~4-6 |
| Company intel (Phase 1) | +1 | +3-4 |
| Discovery search (Phase 2) | N/A | +2-4 per search |

Company intel is cached for 7 days per domain, so repeat lookups cost zero queries.

## Risks

1. **Brave Search quality for small companies**: May not find structured data. Mitigation: `confidenceScore` field + "limited data available" badge in UI when score is low.
2. **Claude API cost**: Each full intel adds 1-2 Claude calls. Mitigation: 7-day cache, basic-only for Starter tier.
3. **Discovery result quality**: Brave Search is not a company database — results will be noisier than Clay's 150+ providers. Mitigation: confidence scoring, honest "web research" framing, iterate on query templates.
4. **Clay adds citations**: If Clay adds source URLs to Claygent outputs, our moat narrows. Mitigation: move fast, establish the "cited outreach" category.
5. **Decision maker PII**: Extract titles/departments only, never names or contact info. This keeps GSH compliant and safe.

## Existing patterns to follow

- **Brave Search**: See `fetchSourcesWithGating()` in `src/lib/hooks.ts` for the fetch pattern
- **Claude calls**: See `callClaude()` in `src/lib/hooks.ts` for the structured JSON extraction pattern
- **Domain normalization**: Use `getDomain()` from `src/lib/hooks.ts`
- **UI styling**: Follow `intent-signals.tsx` — zinc-900 bg, zinc-800 border, rounded-xl, animate-slide-in-bottom
- **Rate limiting**: Follow existing pattern in all API routes — `checkRateLimit(getClientIp(request), "auth:*")`
- **Auth**: Use `auth()` from `@/lib/auth`, check `session?.user?.id`
- **Tier gating**: Use `checkFeature(tierId, flagName)` from `@/lib/tier-guard`
- **Error responses**: Use `tierError()` and `featureError()` from `@/lib/tier-guard`
