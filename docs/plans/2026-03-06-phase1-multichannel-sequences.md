# Phase 1: Multi-Channel Output + Custom Sequences — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Generate LinkedIn messages, cold call scripts, and video scripts alongside email hooks, and replace the hardcoded 3-step email sequence with user-defined multi-channel sequences.

**Architecture:** Extend the existing hooks pipeline with a second Claude call for channel variants. Add `sequences` and `lead_sequences` tables to the DB. Build a sequence builder UI at `/app/sequences`. Gate multi-channel behind Pro/Concierge tiers.

**Tech Stack:** Next.js 16.1.6 (App Router), Claude Sonnet API, Drizzle ORM + Turso (SQLite), Tailwind CSS

---

### Task 1: Add `variants` column to hookCache + new schema tables

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add variants column to hookCache table**

In `src/lib/db/schema.ts`, add a `variants` column to the `hookCache` table after the `citations` line:

```ts
// Inside hookCache table definition, after citations line:
variants: text("variants", { mode: "json" }),
```

**Step 2: Add `sequences` table**

After the `stripeEvents` table definition, add:

```ts
export const sequences = sqliteTable("sequences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  steps: text("steps", { mode: "json" }).$type<SequenceStep[]>().notNull(),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("sequences_user_id_idx").on(table.userId),
]);
```

Also add the SequenceStep type above the table (or import it):

```ts
export type SequenceStep = {
  order: number;
  channel: "email" | "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script";
  delayDays: number;
  type: "first" | "bump" | "breakup";
  tone?: "concise" | "warm" | "direct";
};
```

**Step 3: Add `lead_sequences` table**

```ts
export const leadSequences = sqliteTable("lead_sequences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: text("lead_id").notNull().references(() => leads.id),
  sequenceId: text("sequence_id").notNull().references(() => sequences.id),
  currentStep: integer("current_step").notNull().default(0),
  status: text("status", {
    enum: ["active", "paused", "completed"],
  }).notNull().default("active"),
  approvalMode: integer("approval_mode").notNull().default(0),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  pausedAt: text("paused_at"),
  completedAt: text("completed_at"),
}, (table) => [
  index("lead_sequences_lead_id_idx").on(table.leadId),
  index("lead_sequences_sequence_id_idx").on(table.sequenceId),
  index("lead_sequences_status_idx").on(table.status),
]);
```

**Step 4: Push schema to Turso**

Run: `set -a && source .env.local && set +a && npx drizzle-kit push`
Expected: New tables created, hookCache updated

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "schema: add sequences, lead_sequences tables + hookCache variants column"
```

---

### Task 2: Add `generateChannelVariants()` to hooks pipeline

**Files:**
- Modify: `src/lib/hooks.ts` (add function at end of file)
- Test: `src/lib/hooks-variants.test.ts`

**Step 1: Write the test**

Create `src/lib/hooks-variants.test.ts`:

```ts
import { describe, it, expect } from "vitest";

// We'll test the prompt builder and type structure
// (actual Claude calls can't be unit tested without mocking)

describe("ChannelVariant types", () => {
  it("channel variant has required fields", () => {
    const variant = {
      channel: "linkedin_connection" as const,
      text: "Hi Sarah — saw Gong crossed 4,000 customers.",
    };
    expect(variant.channel).toBe("linkedin_connection");
    expect(variant.text.length).toBeLessThanOrEqual(300);
  });

  it("all channel types are valid", () => {
    const validChannels = ["linkedin_connection", "linkedin_message", "cold_call", "video_script"];
    validChannels.forEach((ch) => {
      expect(["linkedin_connection", "linkedin_message", "cold_call", "video_script"]).toContain(ch);
    });
  });
});

describe("buildVariantsPrompt", () => {
  // Import after implementation exists
  it("placeholder for prompt builder test", () => {
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test to verify it passes (basic structure)**

Run: `npx vitest run src/lib/hooks-variants.test.ts`
Expected: PASS

**Step 3: Add types and function to hooks.ts**

At the top of `src/lib/hooks.ts`, add the new types after the existing `Hook` type:

```ts
export type ChannelVariant = {
  channel: "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script";
  text: string;
};

export type HookWithVariants = Hook & {
  variants: ChannelVariant[];
};
```

At the end of `src/lib/hooks.ts`, add the variant generation function:

```ts
// ---------------------------------------------------------------------------
// Multi-channel variant generation
// ---------------------------------------------------------------------------

const CHANNEL_LIMITS: Record<ChannelVariant["channel"], { maxChars?: number; maxWords?: number; label: string }> = {
  linkedin_connection: { maxChars: 300, label: "LinkedIn Connection Request" },
  linkedin_message: { maxChars: 1900, label: "LinkedIn DM" },
  cold_call: { maxWords: 150, label: "Cold Call Opener" },
  video_script: { maxWords: 200, label: "Video Message Script" },
};

export function buildVariantsSystemPrompt(targetRole?: string): string {
  const roleCtx = targetRole && targetRole !== "General"
    ? `The recipient is a ${targetRole}.`
    : "";

  return `You are an expert B2B sales copywriter. Given email hooks with evidence, generate channel-specific variants.

Rules:
- Each variant must preserve the SAME evidence/signal from the original hook
- LinkedIn Connection Request: ≤300 characters. Casual, curious tone. No pitch.
- LinkedIn DM: ≤1900 characters. Conversational, reference the evidence, ask a question.
- Cold Call Opener: ≤150 words. Verbal/spoken style. Start with name, reference evidence, ask permission to continue.
- Video Script: ≤200 words. Personable, reference evidence, end with clear CTA for a meeting.
${roleCtx}

Return valid JSON array matching this schema exactly:
[
  {
    "hook_index": 0,
    "variants": [
      { "channel": "linkedin_connection", "text": "..." },
      { "channel": "linkedin_message", "text": "..." },
      { "channel": "cold_call", "text": "..." },
      { "channel": "video_script", "text": "..." }
    ]
  }
]

Do NOT include any text outside the JSON array.`;
}

export function buildVariantsUserPrompt(hooks: Hook[]): string {
  const hookDescriptions = hooks.map((h, i) => {
    return `Hook ${i}:
Text: ${h.hook}
Angle: ${h.angle}
Evidence: ${h.evidence_snippet || "N/A"}
Source: ${h.source_title || h.source_url || "N/A"}`;
  }).join("\n\n");

  return `Generate channel variants for each of these ${hooks.length} hooks:\n\n${hookDescriptions}`;
}

export async function generateChannelVariants(
  hooks: Hook[],
  claudeApiKey: string,
  targetRole?: string,
): Promise<HookWithVariants[]> {
  if (hooks.length === 0) return [];

  const systemPrompt = buildVariantsSystemPrompt(targetRole);
  const userPrompt = buildVariantsUserPrompt(hooks);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "[]";

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("generateChannelVariants: no JSON array found in response");
      return hooks.map((h) => ({ ...h, variants: [] }));
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      hook_index: number;
      variants: ChannelVariant[];
    }>;

    // Map variants back to hooks
    return hooks.map((hook, idx) => {
      const entry = parsed.find((p) => p.hook_index === idx);
      const variants = (entry?.variants || []).filter((v) =>
        ["linkedin_connection", "linkedin_message", "cold_call", "video_script"].includes(v.channel),
      );
      return { ...hook, variants };
    });
  } catch (error) {
    console.error("generateChannelVariants: failed", error);
    // Graceful fallback — return hooks without variants
    return hooks.map((h) => ({ ...h, variants: [] }));
  }
}
```

**Step 4: Update test with real import**

Update `src/lib/hooks-variants.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildVariantsSystemPrompt, buildVariantsUserPrompt, type Hook } from "./hooks";

describe("buildVariantsSystemPrompt", () => {
  it("includes channel limits", () => {
    const prompt = buildVariantsSystemPrompt();
    expect(prompt).toContain("300 characters");
    expect(prompt).toContain("1900 characters");
    expect(prompt).toContain("150 words");
    expect(prompt).toContain("200 words");
  });

  it("includes role context when provided", () => {
    const prompt = buildVariantsSystemPrompt("VP Sales");
    expect(prompt).toContain("VP Sales");
  });

  it("omits role context for General", () => {
    const prompt = buildVariantsSystemPrompt("General");
    expect(prompt).not.toContain("recipient is a General");
  });
});

describe("buildVariantsUserPrompt", () => {
  it("includes all hooks", () => {
    const hooks: Hook[] = [
      {
        news_item: 1,
        angle: "trigger",
        hook: "Test hook 1",
        evidence_snippet: "Evidence 1",
        source_title: "Source 1",
        source_date: "2026-03-01",
        source_url: "https://example.com",
        evidence_tier: "A",
        confidence: "high",
      },
      {
        news_item: 2,
        angle: "risk",
        hook: "Test hook 2",
        evidence_snippet: "Evidence 2",
        source_title: "Source 2",
        source_date: "2026-03-01",
        source_url: "https://example.com/2",
        evidence_tier: "B",
        confidence: "med",
      },
    ];
    const prompt = buildVariantsUserPrompt(hooks);
    expect(prompt).toContain("Hook 0:");
    expect(prompt).toContain("Hook 1:");
    expect(prompt).toContain("Test hook 1");
    expect(prompt).toContain("Test hook 2");
    expect(prompt).toContain("Evidence 1");
  });
});
```

**Step 5: Run tests**

Run: `npx vitest run src/lib/hooks-variants.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/hooks.ts src/lib/hooks-variants.test.ts
git commit -m "feat: add generateChannelVariants() for multi-channel hook output"
```

---

### Task 3: Integrate variants into hook cache and API route

**Files:**
- Modify: `src/lib/hook-cache.ts`
- Modify: `src/app/api/generate-hooks/route.ts`

**Step 1: Extend cache to store/return variants**

In `src/lib/hook-cache.ts`, update the `CachedHookResult` interface:

```ts
export interface CachedHookResult {
  hooks: unknown;
  citations: unknown;
  variants: unknown;
  rulesVersion: number | null;
}
```

In `getCachedHooks`, add variants to the return:

```ts
return { hooks: cached.hooks, citations: cached.citations, variants: cached.variants ?? null, rulesVersion };
```

In `setCachedHooks`, add a variants parameter:

```ts
export async function setCachedHooks(
  url: string,
  hooks: unknown,
  citations: unknown,
  profileUpdatedAt?: string | null,
  targetRole?: string,
  variants?: unknown,
) {
```

And include it in both `.values()` and `.set()`:

```ts
.values({
  urlHash, url, hooks, citations, variants: variants ?? null,
  rulesVersion: RULES_VERSION, profileUpdatedAt: profileUpdatedAt ?? null, expiresAt,
})
.onConflictDoUpdate({
  target: schema.hookCache.urlHash,
  set: {
    hooks, citations, variants: variants ?? null,
    rulesVersion: RULES_VERSION, profileUpdatedAt: profileUpdatedAt ?? null,
    expiresAt, createdAt: new Date().toISOString(),
  },
});
```

**Step 2: Integrate into generate-hooks route**

In `src/app/api/generate-hooks/route.ts`:

Add import:
```ts
import { generateChannelVariants, type HookWithVariants } from "@/lib/hooks";
```

After the `rankAndCap` call (around line 296), before the cache write, add variant generation:

```ts
// Generate multi-channel variants (Pro/Concierge only)
let variantsMap: HookWithVariants[] | null = null;
const userTierId = session.user.tierId;
if (userTierId === "pro" || userTierId === "concierge") {
  const hooksForVariants = [...finalTop, ...finalOverflow];
  if (hooksForVariants.length > 0 && !cached) {
    variantsMap = await generateChannelVariants(hooksForVariants, claudeApiKey, targetRole);
  } else if (cached) {
    // Load variants from cache
    const cachedVariants = cachedResult?.variants as HookWithVariants[] | null;
    if (cachedVariants) {
      variantsMap = cachedVariants;
    }
  }
}
```

Wait — the route structure makes this tricky because `cachedResult` isn't in scope at that point. Let me re-examine.

Actually, let me simplify. The variants should be:
1. Generated alongside hooks for fresh results (Pro/Concierge)
2. Stored in cache alongside hooks
3. Returned from cache on cache hits
4. Included in the API response

The cleanest approach: add a `variants` field to the response JSON, and handle the variant generation right before the final response.

In the route handler, after the cache write block (line ~337), before the final return:

```ts
// ---------------------------------------------------------------------------
// MULTI-CHANNEL VARIANTS — Pro/Concierge only, generated for fresh results
// ---------------------------------------------------------------------------
let variants: unknown = null;
if ((session.user as any).tierId === "pro" || (session.user as any).tierId === "concierge") {
  if (cached && !cacheStale) {
    // Try to load variants from cached result
    try {
      const cachedResult2 = await getCachedHooks(url!, profileUpdatedAt, targetRole);
      variants = cachedResult2?.variants ?? null;
    } catch { /* ignore */ }
  }

  if (!variants && roleGated.length > 0) {
    // Generate fresh variants
    try {
      const withVariants = await generateChannelVariants(roleGated, claudeApiKey, targetRole);
      variants = withVariants.map((h) => ({
        hook_index: roleGated.indexOf(h),
        variants: h.variants,
      }));
      // Cache variants alongside hooks
      setCachedHooks(url!, roleGated, citations, profileUpdatedAt, targetRole, variants).catch(() => {});
    } catch { /* graceful fallback — no variants */ }
  }
}
```

Hmm, this is getting complex. Let me simplify further — store variants as a simple map keyed by hook text hash, and return them in the response.

Actually, the simplest approach: just add `variants` to the JSON response. The client can request them separately or we can inline them.

**Simplified approach for the route:**

After the existing cache write (line ~337), add:

```ts
// Multi-channel variants (Pro/Concierge only)
let hookVariants: Array<{ hook_index: number; variants: Array<{ channel: string; text: string }> }> = [];
const tierId = (session.user as any).tierId || "starter";
if (tierId === "pro" || tierId === "concierge") {
  if (cached) {
    // Load from cache
    try {
      const cr = await getCachedHooks(url!, profileUpdatedAt, targetRole);
      if (cr?.variants) hookVariants = cr.variants as typeof hookVariants;
    } catch {}
  }
  if (hookVariants.length === 0 && roleGated.length > 0) {
    try {
      const withVars = await generateChannelVariants(roleGated, claudeApiKey, targetRole);
      hookVariants = withVars.map((h, i) => ({ hook_index: i, variants: h.variants }));
      // Re-cache with variants
      setCachedHooks(url!, roleGated, citations, profileUpdatedAt, targetRole, hookVariants).catch(() => {});
    } catch {}
  }
}
```

Then add `hookVariants` to the response JSON:

```ts
return NextResponse.json({
  // ... existing fields ...
  hookVariants, // new field
});
```

**Step 3: Commit**

```bash
git add src/lib/hook-cache.ts src/app/api/generate-hooks/route.ts
git commit -m "feat: integrate multi-channel variants into cache and API response"
```

---

### Task 4: Add channel variant tabs to hooks page UI

**Files:**
- Modify: `src/app/app/hooks/page.tsx`

**Step 1: Add variant state and types**

At the top of the file, update the Hook interface:

```ts
interface ChannelVariant {
  channel: string;
  text: string;
}
```

Add state after existing state declarations:

```ts
const [hookVariants, setHookVariants] = useState<Array<{ hook_index: number; variants: ChannelVariant[] }>>([]);
const [activeChannel, setActiveChannel] = useState<Record<number, string>>({}); // hookIndex → channel
```

**Step 2: Parse variants from API response**

In the `doGenerate` function, after `setHooks(structured.map(mapHook))`, add:

```ts
if (data.hookVariants) {
  setHookVariants(data.hookVariants);
}
```

**Step 3: Add channel tab UI to each hook card**

In the hook card render section, add a tab row above the hook text. Find where each hook card renders (look for the hook text display like `{hook.text}`). Before the hook text, add:

```tsx
{/* Channel tabs */}
{(() => {
  const variantEntry = hookVariants.find((v) => v.hook_index === index);
  if (!variantEntry || variantEntry.variants.length === 0) return null;
  const channels = [
    { key: "email", label: "Email" },
    { key: "linkedin_connection", label: "LinkedIn Req" },
    { key: "linkedin_message", label: "LinkedIn DM" },
    { key: "cold_call", label: "Call" },
    { key: "video_script", label: "Video" },
  ];
  const active = activeChannel[index] || "email";
  return (
    <div className="flex gap-1 mb-2 flex-wrap">
      {channels.map((ch) => (
        <button
          key={ch.key}
          onClick={() => setActiveChannel((prev) => ({ ...prev, [index]: ch.key }))}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            active === ch.key
              ? "bg-emerald-900/40 border-emerald-700 text-emerald-300"
              : "bg-zinc-800/50 border-zinc-700 text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {ch.label}
        </button>
      ))}
    </div>
  );
})()}
```

Then, conditionally render the variant text instead of the hook text:

```tsx
{(() => {
  const active = activeChannel[index] || "email";
  if (active === "email") return <p className="text-sm text-zinc-200">{hook.text}</p>;
  const variantEntry = hookVariants.find((v) => v.hook_index === index);
  const variant = variantEntry?.variants.find((v) => v.channel === active);
  if (!variant) return <p className="text-xs text-zinc-500 italic">No variant available for this channel</p>;
  return <p className="text-sm text-zinc-200 whitespace-pre-wrap">{variant.text}</p>;
})()}
```

**Step 4: Update copy functions to respect active channel**

Update the `copyHook` function to copy the active channel's text:

```ts
async function copyHook(text: string, index: number) {
  if (profileRequired) { setShowGateModal(true); return; }
  const active = activeChannel[index] || "email";
  let copyText = text;
  if (active !== "email") {
    const variantEntry = hookVariants.find((v) => v.hook_index === index);
    const variant = variantEntry?.variants.find((v) => v.channel === active);
    if (variant) copyText = variant.text;
  }
  await navigator.clipboard.writeText(copyText);
  setCopied(index);
  markCopied();
  setTimeout(() => setCopied(null), 2000);
}
```

**Step 5: Commit**

```bash
git add src/app/app/hooks/page.tsx
git commit -m "feat: add multi-channel variant tabs to hook cards"
```

---

### Task 5: Add channel variants to batch page

**Files:**
- Modify: `src/app/app/batch/page.tsx`

Similar to Task 4 but for the batch results. The batch API route (`/api/generate-hooks-batch`) calls `generateHooksForUrl` per URL, which doesn't include variants. For batch mode, add variant data to each result.

**Step 1: Update batch API to include variants**

Modify `src/app/api/generate-hooks-batch/route.ts`. After each successful `generateHooksForUrl` call, call `generateChannelVariants` if the user is Pro/Concierge.

In the `result.hooks.map` section, after getting hooks:

```ts
// Inside the map callback, after getting result:
let hookVariants: Array<{ hook_index: number; variants: Array<{ channel: string; text: string }> }> = [];
if ((tierId === "pro" || tierId === "concierge") && result.hooks.length > 0) {
  try {
    const claudeApiKey = process.env.CLAUDE_API_KEY!;
    const withVars = await generateChannelVariants(result.hooks, claudeApiKey);
    hookVariants = withVars.map((h, i) => ({ hook_index: i, variants: h.variants }));
  } catch {}
}
return {
  url, hooks: result.hooks, error: null,
  suggestion: result.suggestion, lowSignal: result.lowSignal,
  hookVariants,
};
```

Add import at top: `import { generateChannelVariants } from "@/lib/hooks";`

Update `BatchItemResult` type to include `hookVariants`.

**Step 2: Update batch page UI**

Add the same channel tab pattern from Task 4 to the batch hook cards. Since the batch page already has per-hook copy buttons, add channel tabs above each hook in the results.

**Step 3: Commit**

```bash
git add src/app/api/generate-hooks-batch/route.ts src/app/app/batch/page.tsx
git commit -m "feat: add multi-channel variants to batch mode"
```

---

### Task 6: Sequence CRUD API

**Files:**
- Create: `src/app/api/sequences/route.ts`
- Create: `src/app/api/sequences/[id]/route.ts`

**Step 1: Create sequences list + create route**

Create `src/app/api/sequences/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SequenceStep } from "@/lib/db/schema";

const PRESET_TEMPLATES: Array<{ name: string; steps: SequenceStep[] }> = [
  {
    name: "Email Only (3-step)",
    steps: [
      { order: 0, channel: "email", delayDays: 0, type: "first" },
      { order: 1, channel: "email", delayDays: 3, type: "bump" },
      { order: 2, channel: "email", delayDays: 5, type: "breakup" },
    ],
  },
  {
    name: "Multi-Channel (5-step)",
    steps: [
      { order: 0, channel: "email", delayDays: 0, type: "first" },
      { order: 1, channel: "linkedin_connection", delayDays: 1, type: "bump" },
      { order: 2, channel: "email", delayDays: 3, type: "bump" },
      { order: 3, channel: "cold_call", delayDays: 2, type: "bump" },
      { order: 4, channel: "email", delayDays: 4, type: "breakup" },
    ],
  },
  {
    name: "LinkedIn-First (3-step)",
    steps: [
      { order: 0, channel: "linkedin_connection", delayDays: 0, type: "first" },
      { order: 1, channel: "linkedin_message", delayDays: 2, type: "bump" },
      { order: 2, channel: "email", delayDays: 3, type: "breakup" },
    ],
  },
];

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let userSequences = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.userId, session.user.id));

  // Seed preset templates if user has none
  if (userSequences.length === 0) {
    for (const template of PRESET_TEMPLATES) {
      await db.insert(schema.sequences).values({
        userId: session.user.id,
        name: template.name,
        steps: template.steps,
        isDefault: template.name === "Email Only (3-step)" ? 1 : 0,
      });
    }
    userSequences = await db
      .select()
      .from(schema.sequences)
      .where(eq(schema.sequences.userId, session.user.id));
  }

  return NextResponse.json({ sequences: userSequences });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.name || !Array.isArray(body.steps) || body.steps.length === 0) {
    return NextResponse.json({ error: "Name and steps are required" }, { status: 400 });
  }

  // Tier check: Starter gets 1 custom sequence max (presets don't count)
  const existing = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.userId, session.user.id));

  const customCount = existing.filter((s) => !PRESET_TEMPLATES.some((p) => p.name === s.name)).length;
  const tierId = (session.user as any).tierId || "starter";
  if (tierId === "starter" && customCount >= 1) {
    return NextResponse.json(
      { error: "Starter plan allows 1 custom sequence. Upgrade for unlimited." },
      { status: 402 },
    );
  }

  const [sequence] = await db.insert(schema.sequences).values({
    userId: session.user.id,
    name: body.name,
    steps: body.steps,
  }).returning();

  return NextResponse.json({ sequence }, { status: 201 });
}
```

**Step 2: Create single sequence route**

Create `src/app/api/sequences/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [sequence] = await db
    .select()
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.userId, session.user.id)))
    .limit(1);

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  return NextResponse.json({ sequence });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name) updates.name = body.name;
  if (body.steps) updates.steps = body.steps;
  if (body.isDefault !== undefined) updates.isDefault = body.isDefault ? 1 : 0;

  await db
    .update(schema.sequences)
    .set(updates)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.userId, session.user.id)));

  return NextResponse.json({ status: "ok" });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const deleted = await db
    .delete(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.userId, session.user.id)))
    .returning({ id: schema.sequences.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "ok" });
}
```

**Step 3: Commit**

```bash
git add src/app/api/sequences/route.ts src/app/api/sequences/\[id\]/route.ts
git commit -m "feat: add sequences CRUD API with preset templates"
```

---

### Task 7: Build sequence builder UI page

**Files:**
- Create: `src/app/app/sequences/page.tsx`
- Modify: `src/app/app/layout.tsx` (add nav link)

**Step 1: Create sequences page**

Create `src/app/app/sequences/page.tsx` — a page that:
- Lists user's sequences (from GET /api/sequences)
- Shows a "Create Sequence" form with:
  - Name input
  - Steps list with: step number, channel dropdown, delay days input, type dropdown
  - "Add Step" button
  - "Remove" button per step
  - "Save" button
- Each existing sequence shows: name, step count, channel icons, edit/delete buttons
- Default sequence gets a badge

The channel dropdown options: Email, LinkedIn Connection, LinkedIn DM, Cold Call, Video Script

This is a ~250-line React component. Build it with the same dark theme (zinc/emerald/violet) as other app pages.

Key UI elements:
- Card per sequence in a grid
- Modal or inline form for create/edit
- Step reordering via up/down arrows (simpler than drag-and-drop)

**Step 2: Add nav link**

In `src/app/app/layout.tsx`, add to navItems after "Leads":

```ts
{ href: "/app/sequences", label: "Sequences" },
```

**Step 3: Commit**

```bash
git add src/app/app/sequences/page.tsx src/app/app/layout.tsx
git commit -m "feat: sequence builder UI with create/edit/delete"
```

---

### Task 8: Add "Assign Sequence" to leads page

**Files:**
- Modify: `src/app/app/leads/page.tsx`
- Create: `src/app/api/lead-sequences/route.ts`

**Step 1: Create lead-sequences API**

Create `src/app/api/lead-sequences/route.ts`:

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.leadId || !body?.sequenceId) {
    return NextResponse.json({ error: "leadId and sequenceId required" }, { status: 400 });
  }

  // Verify lead belongs to user
  const [lead] = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, body.leadId), eq(schema.leads.userId, session.user.id)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Verify sequence belongs to user
  const [sequence] = await db
    .select({ id: schema.sequences.id })
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, body.sequenceId), eq(schema.sequences.userId, session.user.id)))
    .limit(1);

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  const [assignment] = await db.insert(schema.leadSequences).values({
    leadId: body.leadId,
    sequenceId: body.sequenceId,
    approvalMode: body.approvalMode ? 1 : 0,
  }).returning();

  return NextResponse.json({ assignment }, { status: 201 });
}
```

**Step 2: Add sequence assignment UI to leads page**

In the leads table, add an "Assign" button per lead row. When clicked, show a dropdown of available sequences. On selection, POST to `/api/lead-sequences`.

Add to the table header: `<th className="px-4 py-3">Sequence</th>`

Add to each row: a dropdown or button that triggers sequence assignment.

**Step 3: Commit**

```bash
git add src/app/api/lead-sequences/route.ts src/app/app/leads/page.tsx
git commit -m "feat: assign sequences to leads from leads page"
```

---

### Task 9: Refactor followup/sequences.ts to support DB sequences

**Files:**
- Modify: `src/lib/followup/sequences.ts`

**Step 1: Add DB-backed sequence lookup**

Keep the existing hardcoded `SEQUENCES` as fallback, but add a `getSequenceFromDb()` function:

```ts
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SequenceStep } from "@/lib/db/schema";

// ... keep existing code ...

export async function getSequenceFromDb(sequenceId: string): Promise<SequenceConfig | null> {
  const [seq] = await db
    .select()
    .from(schema.sequences)
    .where(eq(schema.sequences.id, sequenceId))
    .limit(1);

  if (!seq) return null;

  const steps = seq.steps as SequenceStep[];
  return {
    id: seq.id,
    maxSteps: steps.length,
    delaysDays: steps.map((s) => s.delayDays),
    stopOnReply: true,
    stopOnBounce: true,
  };
}

export async function resolveSequence(sequenceId: string): Promise<SequenceConfig | null> {
  // Try hardcoded first (fast path for legacy)
  const hardcoded = getSequence(sequenceId);
  if (hardcoded) return hardcoded;

  // Fall back to DB
  return getSequenceFromDb(sequenceId);
}
```

**Step 2: Commit**

```bash
git add src/lib/followup/sequences.ts
git commit -m "feat: add DB-backed sequence resolution with legacy fallback"
```

---

### Task 10: Update tier flags and run full test suite

**Files:**
- Modify: `src/lib/tiers.ts`

**Step 1: Add multi-channel and sequences flags**

In `src/lib/tiers.ts`, add to the `flags` interface:

```ts
multiChannel: boolean;
sequences: boolean;
```

Update each tier:
- Starter: `multiChannel: false, sequences: true` (1 custom, email only)
- Pro: `multiChannel: true, sequences: true` (unlimited)
- Concierge: `multiChannel: true, sequences: true` (unlimited)

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Run build**

Run: `npx next build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/lib/tiers.ts
git commit -m "feat: add multiChannel and sequences tier flags"
```

---

### Task 11: Final integration test and cleanup

**Step 1: Manual test flow**

1. Start dev server: `pnpm dev`
2. Log in as a Pro user
3. Generate hooks for a URL → verify variant tabs appear on hook cards
4. Click through LinkedIn / Call / Video tabs → verify content shows
5. Copy a variant → verify clipboard content
6. Go to `/app/sequences` → verify 3 preset templates loaded
7. Create a custom sequence → verify it appears
8. Go to Leads → assign sequence to a lead → verify in DB
9. Switch to Starter user → verify no variant tabs on hooks
10. Batch mode → verify variants appear for Pro users

**Step 2: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for multi-channel + sequences"
```

**Step 3: Push**

```bash
git push
```
