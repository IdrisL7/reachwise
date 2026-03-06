# Phase 2: Intent Scoring + Lead Prioritization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect buying signals (hiring, funding, tech changes) via Brave Search, compute a 0–100 intent score per lead, and surface prioritized leads in the UI with colored temperature badges.

**Architecture:** New `src/lib/intent.ts` module runs 3 parallel Brave queries per company, pipes results through Claude for signal extraction, stores typed IntentSignal objects in a new `intent_signals` table and computed scores in `lead_scores`. A daily Vercel cron refreshes stale signals. The leads page and hooks page surface scores + signals. Gated behind Pro/Concierge tiers.

**Tech Stack:** Next.js 16.1.6 (App Router), Claude Sonnet API, Brave Search API, Drizzle ORM + Turso (SQLite), Tailwind CSS

---

### Task 1: Add `intent_signals` and `lead_scores` tables to schema

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add `intent_signals` table**

After the `leadSequences` table definition, add:

```ts
export const intentSignals = sqliteTable("intent_signals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: text("lead_id").references(() => leads.id),
  companyUrl: text("company_url").notNull(),
  signalType: text("signal_type", {
    enum: ["hiring", "funding", "tech_change", "growth", "news"],
  }).notNull(),
  summary: text("summary").notNull(),
  confidence: real("confidence").notNull(), // 0.0–1.0
  sourceUrl: text("source_url"),
  rawEvidence: text("raw_evidence"),
  detectedAt: text("detected_at").notNull(),
  scoreContribution: integer("score_contribution").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(), // 7-day TTL
}, (table) => [
  index("intent_signals_lead_id_idx").on(table.leadId),
  index("intent_signals_company_url_idx").on(table.companyUrl),
  index("intent_signals_expires_at_idx").on(table.expiresAt),
]);
```

**Step 2: Add `lead_scores` table**

```ts
export const leadScores = sqliteTable("lead_scores", {
  leadId: text("lead_id").primaryKey().references(() => leads.id),
  score: integer("score").notNull().default(0), // 0–100
  temperature: text("temperature", {
    enum: ["hot", "warm", "cold"],
  }).notNull().default("cold"),
  signalsCount: integer("signals_count").notNull().default(0),
  lastScoredAt: text("last_scored_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("lead_scores_score_idx").on(table.score),
  index("lead_scores_temperature_idx").on(table.temperature),
]);
```

**Step 3: Add `real` import**

At the top of schema.ts, ensure `real` is imported from `drizzle-orm/sqlite-core` alongside `text`, `integer`, `sqliteTable`, `index`.

**Step 4: Push schema to Turso**

Run: `set -a && source .env.local && set +a && npx drizzle-kit push`
Expected: Two new tables created

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "schema: add intent_signals and lead_scores tables"
```

---

### Task 2: Create intent signal research module

**Files:**
- Create: `src/lib/intent.ts`
- Create: `src/lib/intent.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect } from "vitest";
import {
  buildHiringQuery,
  buildFundingQuery,
  buildTechChangeQuery,
  computeIntentScore,
  getTemperature,
  type IntentSignal,
} from "./intent";

describe("intent query builders", () => {
  it("builds hiring query with company name", () => {
    const q = buildHiringQuery("Gong", "gong.io");
    expect(q).toContain("Gong");
    expect(q).toContain("hiring");
  });

  it("builds funding query with company name", () => {
    const q = buildFundingQuery("Gong", "gong.io");
    expect(q).toContain("Gong");
    expect(q).toContain("funding");
  });

  it("builds tech change query with company name", () => {
    const q = buildTechChangeQuery("Gong", "gong.io");
    expect(q).toContain("Gong");
    expect(q).toContain("migrated");
  });
});

describe("computeIntentScore", () => {
  it("returns 0 for no signals", () => {
    expect(computeIntentScore([])).toBe(0);
  });

  it("scores hiring signal at 25", () => {
    const signals: IntentSignal[] = [
      { type: "hiring", summary: "Hiring SDRs", confidence: 0.9, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
    ];
    expect(computeIntentScore(signals)).toBeGreaterThanOrEqual(25);
  });

  it("scores funding signal at 20", () => {
    const signals: IntentSignal[] = [
      { type: "funding", summary: "Series B", confidence: 0.9, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
    ];
    expect(computeIntentScore(signals)).toBeGreaterThanOrEqual(20);
  });

  it("caps at 100", () => {
    const signals: IntentSignal[] = [
      { type: "hiring", summary: "a", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "funding", summary: "b", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "tech_change", summary: "c", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "growth", summary: "d", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
      { type: "news", summary: "e", confidence: 1, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" },
    ];
    expect(computeIntentScore(signals)).toBeLessThanOrEqual(100);
  });

  it("applies compound bonus for 3+ signals", () => {
    const base: IntentSignal = { type: "hiring", summary: "a", confidence: 0.8, sourceUrl: "", detectedAt: new Date().toISOString(), rawEvidence: "" };
    const twoSignals = [
      { ...base, type: "hiring" as const },
      { ...base, type: "funding" as const },
    ];
    const threeSignals = [
      ...twoSignals,
      { ...base, type: "tech_change" as const },
    ];
    const twoScore = computeIntentScore(twoSignals);
    const threeScore = computeIntentScore(threeSignals);
    // Three signals should have compound bonus (15 pts) beyond just the extra signal points
    expect(threeScore - twoScore).toBeGreaterThan(15);
  });
});

describe("getTemperature", () => {
  it("returns hot for 70+", () => {
    expect(getTemperature(70)).toBe("hot");
    expect(getTemperature(100)).toBe("hot");
  });

  it("returns warm for 40-69", () => {
    expect(getTemperature(40)).toBe("warm");
    expect(getTemperature(69)).toBe("warm");
  });

  it("returns cold for 0-39", () => {
    expect(getTemperature(0)).toBe("cold");
    expect(getTemperature(39)).toBe("cold");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/intent.test.ts`
Expected: FAIL (module not found)

**Step 3: Create the intent module**

Create `src/lib/intent.ts`:

```ts
// ---------------------------------------------------------------------------
// Intent Signal Research — Brave Search + Claude extraction
// ---------------------------------------------------------------------------

export type IntentSignalType = "hiring" | "funding" | "tech_change" | "growth" | "news";

export type IntentSignal = {
  type: IntentSignalType;
  summary: string;
  confidence: number; // 0.0–1.0
  sourceUrl: string;
  detectedAt: string; // ISO date
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

const COMPOUND_BONUS = 15; // 3+ signal types
const RECENCY_BONUS = 10; // signal < 7 days old

export function computeIntentScore(signals: IntentSignal[]): number {
  if (signals.length === 0) return 0;

  let score = 0;

  // Base points per signal type (take highest confidence per type)
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

  // Compound bonus
  if (byType.size >= 3) {
    score += COMPOUND_BONUS;
  }

  // Recency bonus — any signal < 7 days old
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
    freshness: "pm", // past month
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
  // Extract domain from URL
  let domain: string;
  try {
    domain = new URL(companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`).hostname.replace(/^www\./, "");
  } catch {
    domain = companyUrl;
  }

  // 3 parallel Brave searches
  const [hiringResults, fundingResults, techResults] = await Promise.all([
    searchBrave(buildHiringQuery(companyName, domain), braveApiKey),
    searchBrave(buildFundingQuery(companyName, domain), braveApiKey),
    searchBrave(buildTechChangeQuery(companyName, domain), braveApiKey),
  ]);

  // 3 parallel Claude extractions
  const [hiringSignals, fundingSignals, techSignals] = await Promise.all([
    extractSignals(hiringResults, companyName, "hiring", claudeApiKey),
    extractSignals(fundingResults, companyName, "funding", claudeApiKey),
    extractSignals(techResults, companyName, "tech_change", claudeApiKey),
  ]);

  return [...hiringSignals, ...fundingSignals, ...techSignals];
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/intent.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/lib/intent.ts src/lib/intent.test.ts
git commit -m "feat: add intent signal research module with scoring"
```

---

### Task 3: Create intent scoring API route

**Files:**
- Create: `src/app/api/leads/[id]/intent/route.ts`

**Step 1: Create the route**

This route triggers intent scoring for a single lead (on-demand).

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify lead belongs to user
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.userId, session.user.id)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.companyWebsite && !lead.companyName) {
    return NextResponse.json({ error: "Lead needs a company website or name to score" }, { status: 400 });
  }

  const braveApiKey = process.env.BRAVE_API_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;

  if (!braveApiKey || !claudeApiKey) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  const companyUrl = lead.companyWebsite || "";
  const companyName = lead.companyName || companyUrl;

  // Research signals
  const signals = await researchIntentSignals(companyUrl, companyName, braveApiKey, claudeApiKey);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Clear old signals for this lead
  if (lead.id) {
    await db.delete(schema.intentSignals).where(eq(schema.intentSignals.leadId, lead.id));
  }

  // Store new signals
  for (const signal of signals) {
    const contribution = Math.round(
      ({ hiring: 25, funding: 20, tech_change: 15, growth: 15, news: 10 }[signal.type] || 10) * signal.confidence,
    );

    await db.insert(schema.intentSignals).values({
      leadId: lead.id,
      companyUrl,
      signalType: signal.type,
      summary: signal.summary,
      confidence: signal.confidence,
      sourceUrl: signal.sourceUrl,
      rawEvidence: signal.rawEvidence,
      detectedAt: signal.detectedAt,
      scoreContribution: contribution,
      expiresAt,
    });
  }

  // Compute and store score
  const score = computeIntentScore(signals);
  const temperature = getTemperature(score);

  await db
    .insert(schema.leadScores)
    .values({
      leadId: lead.id,
      score,
      temperature,
      signalsCount: signals.length,
      lastScoredAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.leadScores.leadId,
      set: { score, temperature, signalsCount: signals.length, lastScoredAt: now, updatedAt: now },
    });

  return NextResponse.json({
    score,
    temperature,
    signals: signals.map((s) => ({
      type: s.type,
      summary: s.summary,
      confidence: s.confidence,
      sourceUrl: s.sourceUrl,
      detectedAt: s.detectedAt,
    })),
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/leads/\[id\]/intent/route.ts
git commit -m "feat: add on-demand intent scoring API for leads"
```

---

### Task 4: Create daily intent refresh cron

**Files:**
- Create: `src/app/api/cron/intent-refresh/route.ts`

**Step 1: Create the cron route**

Follow the existing pattern from `src/app/api/cron/cleanup/route.ts` for auth.

```ts
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/lib/db";
import { eq, lt, sql, isNull, or } from "drizzle-orm";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = `Bearer ${cronSecret}`;
  const isValid =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const braveApiKey = process.env.BRAVE_API_KEY;
  const claudeApiKey = process.env.CLAUDE_API_KEY;

  if (!braveApiKey || !claudeApiKey) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  // Find leads that need scoring:
  // 1. Never scored (no lead_scores row)
  // 2. Scored > 24 hours ago
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const leadsToScore = await db
    .select({
      id: schema.leads.id,
      companyWebsite: schema.leads.companyWebsite,
      companyName: schema.leads.companyName,
      lastScoredAt: schema.leadScores.lastScoredAt,
    })
    .from(schema.leads)
    .leftJoin(schema.leadScores, eq(schema.leads.id, schema.leadScores.leadId))
    .where(
      or(
        isNull(schema.leadScores.lastScoredAt),
        lt(schema.leadScores.lastScoredAt, oneDayAgo),
      ),
    )
    .limit(50); // batch of 50

  let scored = 0;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const lead of leadsToScore) {
    if (!lead.companyWebsite && !lead.companyName) continue;

    try {
      const companyUrl = lead.companyWebsite || "";
      const companyName = lead.companyName || companyUrl;

      const signals = await researchIntentSignals(companyUrl, companyName, braveApiKey, claudeApiKey);

      // Clear old signals
      await db.delete(schema.intentSignals).where(eq(schema.intentSignals.leadId, lead.id));

      // Store new signals
      for (const signal of signals) {
        const contribution = Math.round(
          ({ hiring: 25, funding: 20, tech_change: 15, growth: 15, news: 10 }[signal.type] || 10) * signal.confidence,
        );

        await db.insert(schema.intentSignals).values({
          leadId: lead.id,
          companyUrl,
          signalType: signal.type,
          summary: signal.summary,
          confidence: signal.confidence,
          sourceUrl: signal.sourceUrl,
          rawEvidence: signal.rawEvidence,
          detectedAt: signal.detectedAt,
          scoreContribution: contribution,
          expiresAt,
        });
      }

      // Compute and upsert score
      const score = computeIntentScore(signals);
      const temperature = getTemperature(score);

      await db
        .insert(schema.leadScores)
        .values({
          leadId: lead.id,
          score,
          temperature,
          signalsCount: signals.length,
          lastScoredAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.leadScores.leadId,
          set: { score, temperature, signalsCount: signals.length, lastScoredAt: now, updatedAt: now },
        });

      scored++;
    } catch {
      // Continue on individual lead failure
    }
  }

  // Also clean up expired signals
  await db.delete(schema.intentSignals).where(lt(schema.intentSignals.expiresAt, now));

  return NextResponse.json({
    scored,
    total: leadsToScore.length,
    timestamp: now,
  });
}
```

**Step 2: Add to `vercel.json` cron config**

Check if `vercel.json` exists. If it does, add the cron entry. If not, create it:

```json
{
  "crons": [
    { "path": "/api/cron/cleanup", "schedule": "0 3 * * *" },
    { "path": "/api/cron/onboarding-emails", "schedule": "0 9 * * *" },
    { "path": "/api/cron/intent-refresh", "schedule": "0 6 * * *" }
  ]
}
```

Note: On Vercel Hobby, crons are daily only. This runs at 6 AM UTC daily.

**Step 3: Commit**

```bash
git add src/app/api/cron/intent-refresh/route.ts vercel.json
git commit -m "feat: add daily intent refresh cron with batch scoring"
```

---

### Task 5: Add intent score display to leads page

**Files:**
- Modify: `src/app/app/leads/page.tsx`
- Modify: `src/app/api/leads/route.ts`

**Step 1: Update leads API to include scores**

In `src/app/api/leads/route.ts`, modify the GET handler to LEFT JOIN `lead_scores`:

```ts
// Add import at top:
import { desc } from "drizzle-orm";

// Replace the simple select with a join:
const rows = await db
  .select({
    lead: schema.leads,
    score: schema.leadScores.score,
    temperature: schema.leadScores.temperature,
    signalsCount: schema.leadScores.signalsCount,
    lastScoredAt: schema.leadScores.lastScoredAt,
  })
  .from(schema.leads)
  .leftJoin(schema.leadScores, eq(schema.leads.id, schema.leadScores.leadId))
  .where(and(eq(schema.leads.userId, session.user.id), ...conditions))
  .orderBy(desc(schema.leadScores.score))
  .limit(limit);

const leads = rows.map((r) => ({
  ...r.lead,
  intentScore: r.score ?? null,
  temperature: r.temperature ?? null,
  signalsCount: r.signalsCount ?? 0,
  lastScoredAt: r.lastScoredAt ?? null,
}));
```

**Step 2: Update leads page UI**

In `src/app/app/leads/page.tsx`:

- Add `intentScore`, `temperature`, `signalsCount` to the Lead interface
- Add a "Score" column after Status showing a colored badge:
  - Hot (70-100): `bg-red-900/30 text-red-400 border-red-800`
  - Warm (40-69): `bg-amber-900/30 text-amber-400 border-amber-800`
  - Cold (0-39): `bg-zinc-800 text-zinc-400 border-zinc-700`
  - Not scored: `bg-zinc-800/50 text-zinc-600 border-zinc-700` with "—" text
- Add a "Score" button per lead row that calls `POST /api/leads/{id}/intent` to trigger on-demand scoring
- Show the score number inside the badge (e.g., "72 Hot")
- Add sort toggle: click the "Score" column header to sort by score descending

**Step 3: Commit**

```bash
git add src/app/api/leads/route.ts src/app/app/leads/page.tsx
git commit -m "feat: show intent scores on leads page with sort and on-demand scoring"
```

---

### Task 6: Add intent signals panel to hooks page

**Files:**
- Modify: `src/app/app/hooks/page.tsx`
- Modify: `src/app/api/generate-hooks/route.ts`

**Step 1: Piggyback intent scoring on hook generation**

In `src/app/api/generate-hooks/route.ts`, after hooks are generated (for Pro/Concierge users), run intent research in the background and return signals alongside hooks:

```ts
// Add import:
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";

// After hook generation succeeds, before returning response:
let intentData = null;
if (tierFlags?.multiChannel) { // Pro/Concierge only
  try {
    const signals = await researchIntentSignals(
      url, companyName, process.env.BRAVE_API_KEY!, process.env.CLAUDE_API_KEY!
    );
    const score = computeIntentScore(signals);
    intentData = {
      score,
      temperature: getTemperature(score),
      signals: signals.map((s) => ({
        type: s.type,
        summary: s.summary,
        confidence: s.confidence,
        sourceUrl: s.sourceUrl,
        detectedAt: s.detectedAt,
      })),
    };
  } catch {
    // Non-blocking — intent scoring failure shouldn't break hook generation
  }
}

// Add to response JSON:
return NextResponse.json({
  hooks: finalHooks,
  // ... existing fields ...
  intent: intentData,
});
```

**Step 2: Add intent signals panel to hooks page**

In `src/app/app/hooks/page.tsx`, after the hooks are displayed, show an intent signals section if `data.intent` is present:

- Panel below hooks with heading "Intent Signals"
- Score badge (same style as leads page)
- List of signals with type icon, summary, confidence bar, and source link
- Signal type badges: hiring (blue), funding (green), tech_change (purple), growth (orange), news (zinc)

**Step 3: Commit**

```bash
git add src/app/api/generate-hooks/route.ts src/app/app/hooks/page.tsx
git commit -m "feat: show intent signals panel on hooks page for Pro/Concierge users"
```

---

### Task 7: Add intent data to batch results

**Files:**
- Modify: `src/app/api/generate-hooks-batch/route.ts`
- Modify: `src/app/app/batch/page.tsx`

**Step 1: Add intent scoring to batch API**

In `src/app/api/generate-hooks-batch/route.ts`, after hooks are generated per URL, run intent research (for Pro/Concierge). Add `intent` field to each batch result item.

Keep it lightweight — only run intent research, don't store in DB (batch mode is for quick exploration, not lead management).

**Step 2: Show intent badge on batch results**

In `src/app/app/batch/page.tsx`, add a small score badge next to each URL in the results. Show temperature color + score number.

**Step 3: Commit**

```bash
git add src/app/api/generate-hooks-batch/route.ts src/app/app/batch/page.tsx
git commit -m "feat: add intent scores to batch results for Pro/Concierge users"
```

---

### Task 8: Update tier flags

**Files:**
- Modify: `src/lib/tiers.ts`

**Step 1: Add intent scoring flag**

Add `intentScoring: boolean` to the `flags` interface.

- Starter: `intentScoring: false`
- Pro: `intentScoring: true`
- Concierge: `intentScoring: true`

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Run build**

Run: `npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/tiers.ts
git commit -m "feat: add intentScoring tier flag"
```

---

### Task 9: Final integration test and cleanup

**Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 2: Run build**

Run: `npx next build`
Expected: Build succeeds with no errors

**Step 3: Verify schema**

Run: `set -a && source .env.local && set +a && npx drizzle-kit push`
Expected: No pending changes (tables already created in Task 1)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: phase 2 integration fixes"
```

---

## Verification Checklist

- [ ] `intent_signals` and `lead_scores` tables exist in Turso
- [ ] `computeIntentScore()` returns correct scores for all signal combinations
- [ ] `getTemperature()` maps scores to hot/warm/cold correctly
- [ ] `POST /api/leads/{id}/intent` scores a lead and returns signals
- [ ] `GET /api/cron/intent-refresh` processes batch of 50 leads
- [ ] Leads page shows Score column with colored temperature badges
- [ ] Leads page has "Score" button that triggers on-demand scoring
- [ ] Hooks page shows intent signals panel for Pro/Concierge users
- [ ] Batch page shows intent score badges per URL for Pro/Concierge users
- [ ] Starter users see no intent scoring UI
- [ ] All tests pass (`npx vitest run`)
- [ ] Build succeeds (`npx next build`)
