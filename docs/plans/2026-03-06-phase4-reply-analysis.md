# Phase 4: Reply Analysis + Coaching Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Classify inbound replies (interested, objection, not_now, wrong_person, unsubscribe, ooo), auto-generate suggested responses, enhance the analytics page with hook performance and coaching insights, and add evidence quality badges to hook cards.

**Architecture:** New `src/lib/reply-analysis.ts` for Claude-powered reply classification. Extend SendGrid inbound webhook to capture replies, match to leads, classify, and auto-pause. Enhance analytics page with reply metrics, hook angle performance, and objection distribution. Add freshness/source-type badges to hook cards.

**Tech Stack:** Next.js 16.1.6 (App Router), Claude Sonnet API, SendGrid Inbound Parse, Drizzle ORM + Turso (SQLite), Tailwind CSS

---

### Task 1: Create reply classification module

**Files:**
- Create: `src/lib/reply-analysis.ts`
- Create: `src/lib/reply-analysis.test.ts`

**Step 1: Write the test file**

```ts
import { describe, it, expect } from "vitest";
import { classifyReplyText, type ReplyCategory } from "./reply-analysis";

describe("classifyReplyText", () => {
  it("detects ooo replies", () => {
    expect(classifyReplyText("I am out of office until March 15")).toBe("ooo");
    expect(classifyReplyText("Thanks for your email. I'm currently OOO")).toBe("ooo");
    expect(classifyReplyText("Auto-reply: I will be out of the office")).toBe("ooo");
  });

  it("detects unsubscribe replies", () => {
    expect(classifyReplyText("Please remove me from your list")).toBe("unsubscribe");
    expect(classifyReplyText("Unsubscribe me")).toBe("unsubscribe");
    expect(classifyReplyText("stop emailing me")).toBe("unsubscribe");
  });

  it("detects wrong person replies", () => {
    expect(classifyReplyText("I'm not the right person for this. Try reaching out to John in sales.")).toBe("wrong_person");
    expect(classifyReplyText("Wrong department. You should contact our CTO")).toBe("wrong_person");
  });

  it("returns null for ambiguous text needing Claude", () => {
    expect(classifyReplyText("Interesting, tell me more about pricing")).toBeNull();
    expect(classifyReplyText("We already have a solution for this")).toBeNull();
  });
});
```

**Step 2: Create the reply analysis module**

```ts
// ---------------------------------------------------------------------------
// Reply Analysis — Classification + Suggested Response
// ---------------------------------------------------------------------------

export type ReplyCategory =
  | "interested"
  | "objection_budget"
  | "objection_timing"
  | "objection_authority"
  | "objection_need"
  | "objection_competitor"
  | "objection_status_quo"
  | "not_now"
  | "wrong_person"
  | "unsubscribe"
  | "ooo";

export type ReplyClassification = {
  category: ReplyCategory;
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
  suggestedAction: "respond" | "pause" | "stop" | "reassign";
};

// Quick regex-based detection for obvious cases (no API call needed)
export function classifyReplyText(text: string): ReplyCategory | null {
  const lower = text.toLowerCase();

  // OOO detection
  if (/out of (the )?office|ooo|auto.?reply|i('m| am) (away|on leave|on vacation)/i.test(lower)) {
    return "ooo";
  }

  // Unsubscribe
  if (/unsubscribe|remove me|stop (emailing|contacting|sending)|opt.?out|do not (contact|email)/i.test(lower)) {
    return "unsubscribe";
  }

  // Wrong person
  if (/wrong (person|department|team)|not the right (person|contact)|try (reaching|contacting)|you should (contact|reach|email)/i.test(lower)) {
    return "wrong_person";
  }

  return null; // Needs Claude for classification
}

const CLASSIFICATION_PROMPT = `You classify sales email replies. Given a reply, the original hook, and conversation history, classify it.

Return a JSON object:
{
  "category": one of: "interested", "objection_budget", "objection_timing", "objection_authority", "objection_need", "objection_competitor", "objection_status_quo", "not_now", "wrong_person", "unsubscribe", "ooo",
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "One sentence summary of the reply intent",
  "suggested_action": "respond" | "pause" | "stop" | "reassign"
}

Category meanings:
- interested: wants to learn more, book a call, see pricing
- objection_budget: budget/cost concern
- objection_timing: not the right time, busy quarter
- objection_authority: not the decision maker
- objection_need: don't see the need / already solved
- objection_competitor: using a competitor
- objection_status_quo: happy with current approach
- not_now: vaguely negative, maybe later
- wrong_person: should contact someone else
- unsubscribe: wants to stop receiving emails
- ooo: out of office / auto-reply

Suggested action mapping:
- interested → respond
- objection_* → respond (with rebuttal)
- not_now → pause (extend delay, nurture later)
- wrong_person → reassign
- unsubscribe → stop
- ooo → pause

Return ONLY valid JSON, no markdown.`;

export async function classifyReply(
  replyText: string,
  originalHook: string | null,
  previousMessages: Array<{ direction: string; body: string }>,
  claudeApiKey: string,
): Promise<ReplyClassification> {
  // Try quick regex first
  const quickCategory = classifyReplyText(replyText);
  if (quickCategory) {
    const actionMap: Record<string, ReplyClassification["suggestedAction"]> = {
      ooo: "pause",
      unsubscribe: "stop",
      wrong_person: "reassign",
    };
    return {
      category: quickCategory,
      sentiment: quickCategory === "ooo" ? "neutral" : "negative",
      summary: quickCategory === "ooo"
        ? "Auto-reply or out of office"
        : quickCategory === "unsubscribe"
          ? "Requested to stop receiving emails"
          : "Directed to another contact",
      suggestedAction: actionMap[quickCategory] || "pause",
    };
  }

  // Claude classification for nuanced replies
  const context = previousMessages
    .slice(-3) // Last 3 messages for context
    .map((m) => `[${m.direction}]: ${m.body}`)
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
      max_tokens: 1024,
      system: CLASSIFICATION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Reply text:\n${replyText}\n\n${originalHook ? `Original hook:\n${originalHook}\n\n` : ""}${context ? `Previous messages:\n${context}` : ""}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    return {
      category: "not_now",
      sentiment: "neutral",
      summary: "Could not classify reply",
      suggestedAction: "respond",
    };
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "{}";

  try {
    const parsed = JSON.parse(text);
    return {
      category: parsed.category || "not_now",
      sentiment: parsed.sentiment || "neutral",
      summary: parsed.summary || "",
      suggestedAction: parsed.suggested_action || "respond",
    };
  } catch {
    return {
      category: "not_now",
      sentiment: "neutral",
      summary: "Could not parse classification",
      suggestedAction: "respond",
    };
  }
}

// ---------------------------------------------------------------------------
// Suggested response generation
// ---------------------------------------------------------------------------

const RESPONSE_PROMPTS: Record<string, string> = {
  interested: "Generate a brief meeting-booking response. Reference their interest and suggest 2-3 time slots. Keep under 100 words.",
  objection_budget: "Generate a value-focused rebuttal that acknowledges the budget concern. Reference the original evidence. Keep under 120 words.",
  objection_timing: "Generate a response acknowledging timing. Offer to reconnect at a specific future date. Keep under 80 words.",
  objection_authority: "Generate a response asking for a warm intro to the decision maker. Keep under 80 words.",
  objection_need: "Generate a response that reframes the need using evidence. Keep under 100 words.",
  objection_competitor: "Generate a differentiation response without bashing the competitor. Keep under 100 words.",
  objection_status_quo: "Generate a response highlighting risks of the status quo using evidence. Keep under 100 words.",
  not_now: "Generate a nurture response. Offer a relevant resource or insight. Keep under 80 words.",
  wrong_person: "Generate a polite referral request asking for the right person's name/email. Keep under 60 words.",
};

export async function generateSuggestedResponse(
  classification: ReplyClassification,
  replyText: string,
  originalHook: string | null,
  leadName: string | null,
  claudeApiKey: string,
): Promise<string | null> {
  const prompt = RESPONSE_PROMPTS[classification.category];
  if (!prompt) return null;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      system: prompt,
      messages: [
        {
          role: "user",
          content: `Lead name: ${leadName || "there"}\nTheir reply: ${replyText}\n${originalHook ? `Original hook evidence: ${originalHook}` : ""}`,
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.[0]?.text || null;
}
```

**Step 3: Run tests**

Run: `npx vitest run src/lib/reply-analysis.test.ts`

**Step 4: Commit**

```bash
git add src/lib/reply-analysis.ts src/lib/reply-analysis.test.ts
git commit -m "feat: add reply classification module with regex fast-path and Claude analysis"
```

---

### Task 2: Extend SendGrid webhook for inbound reply handling

**Files:**
- Modify: `src/app/api/webhooks/sendgrid/route.ts`

**Step 1: Add inbound reply processing**

Currently the webhook only handles outbound events (open, click, bounce). Add a new endpoint or extend the existing one to handle SendGrid Inbound Parse (which sends POST with multipart form data or JSON with email content).

Add a second route handler or expand POST to detect inbound parse events:

When `event.event` is missing but `from`, `to`, `subject`, `text` fields are present (inbound parse format):

1. Extract sender email, strip quoted text and signatures from body
2. Match sender to a lead by email
3. Store as inbound message in `outboundMessages` (direction: "inbound")
4. Call `classifyReply()` from `@/lib/reply-analysis`
5. Auto-pause the lead's active sequence
6. Create notification for the lead's owner
7. If classification suggests response, generate suggested response and save as draft

**Step 2: Create separate inbound parse route**

Create `src/app/api/webhooks/sendgrid-inbound/route.ts` to handle SendGrid Inbound Parse webhook separately:

```ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { classifyReply, generateSuggestedResponse } from "@/lib/reply-analysis";

export async function POST(request: NextRequest) {
  try {
    // SendGrid Inbound Parse sends multipart form data
    const formData = await request.formData();
    const from = formData.get("from") as string;
    const to = formData.get("to") as string;
    const subject = formData.get("subject") as string;
    const text = formData.get("text") as string;

    if (!from || !text) {
      return NextResponse.json({ status: "ok" });
    }

    // Extract email from "Name <email>" format
    const emailMatch = from.match(/<(.+?)>/) || [null, from.trim()];
    const senderEmail = emailMatch[1]?.toLowerCase();

    if (!senderEmail) {
      return NextResponse.json({ status: "ok" });
    }

    // Match to lead
    const [lead] = await db
      .select()
      .from(schema.leads)
      .where(eq(schema.leads.email, senderEmail))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ status: "ok", matched: false });
    }

    // Strip quoted text (lines starting with >)
    const cleanedText = text
      .split("\n")
      .filter((line) => !line.startsWith(">"))
      .join("\n")
      .replace(/On .+ wrote:[\s\S]*$/, "")
      .replace(/[-]{2,}[\s\S]*Original Message[\s\S]*$/, "")
      .trim();

    // Store inbound message
    const [msg] = await db
      .insert(schema.outboundMessages)
      .values({
        leadId: lead.id,
        direction: "inbound",
        sequenceStep: lead.sequenceStep,
        channel: "email",
        subject: subject || null,
        body: cleanedText,
        sentAt: new Date().toISOString(),
        status: "sent",
      })
      .returning();

    // Track as usage event
    if (lead.userId) {
      await db.insert(schema.usageEvents).values({
        userId: lead.userId,
        event: "email_replied",
        metadata: { email: senderEmail, messageId: msg?.id, subject },
      });
    }

    // Update lead status
    await db
      .update(schema.leads)
      .set({ status: "in_conversation", updatedAt: new Date().toISOString() })
      .where(eq(schema.leads.id, lead.id));

    // Pause active sequences for this lead
    await db
      .update(schema.leadSequences)
      .set({ status: "paused", pausedAt: new Date().toISOString() })
      .where(
        and(
          eq(schema.leadSequences.leadId, lead.id),
          eq(schema.leadSequences.status, "active"),
        ),
      );

    // Classify reply
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (claudeApiKey) {
      // Get previous messages for context
      const prevMessages = await db
        .select()
        .from(schema.outboundMessages)
        .where(eq(schema.outboundMessages.leadId, lead.id))
        .orderBy(schema.outboundMessages.createdAt)
        .limit(5);

      const classification = await classifyReply(
        cleanedText,
        null, // original hook not easily available here
        prevMessages.map((m) => ({ direction: m.direction, body: m.body })),
        claudeApiKey,
      );

      // Store classification in message metadata
      if (msg?.id) {
        await db
          .update(schema.outboundMessages)
          .set({
            metadata: JSON.stringify({
              classification: classification.category,
              sentiment: classification.sentiment,
              summary: classification.summary,
              suggestedAction: classification.suggestedAction,
            }),
          })
          .where(eq(schema.outboundMessages.id, msg.id));
      }

      // Create notification
      if (lead.userId) {
        await db.insert(schema.notifications).values({
          userId: lead.userId,
          type: "lead_replied",
          title: `${lead.name || lead.email} replied`,
          body: `${classification.summary} (${classification.category.replace(/_/g, " ")})`,
          leadId: lead.id,
          messageId: msg?.id,
        });
      }

      // Generate suggested response and save as draft
      if (classification.suggestedAction === "respond") {
        const suggestedResponse = await generateSuggestedResponse(
          classification,
          cleanedText,
          null,
          lead.name,
          claudeApiKey,
        );

        if (suggestedResponse) {
          const [draft] = await db
            .insert(schema.outboundMessages)
            .values({
              leadId: lead.id,
              direction: "outbound",
              sequenceStep: lead.sequenceStep,
              channel: "email",
              subject: `Re: ${subject || ""}`,
              body: suggestedResponse,
              status: "draft",
            })
            .returning();

          if (draft?.id && lead.userId) {
            await db.insert(schema.notifications).values({
              userId: lead.userId,
              type: "draft_pending",
              title: `Suggested response for ${lead.name || lead.email}`,
              body: `Based on their ${classification.category.replace(/_/g, " ")} reply`,
              leadId: lead.id,
              messageId: draft.id,
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "ok", matched: true, leadId: lead.id });
  } catch (error) {
    console.error("SendGrid inbound webhook error:", error);
    return NextResponse.json({ status: "ok" }); // Always 200
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/webhooks/sendgrid-inbound/route.ts
git commit -m "feat: add SendGrid inbound parse webhook for reply classification"
```

---

### Task 3: Enhance analytics page with coaching dashboard

**Files:**
- Modify: `src/app/app/analytics/page.tsx`

**Step 1: Add reply metrics**

Add these new metrics to the stats grid:
- **Replies**: count of `email_replied` events (30 days)
- **Reply Rate**: replies / emails sent (%)

**Step 2: Add hook angle performance section**

Query outbound messages with their metadata to calculate:
- Which hook angles (trigger/risk/tradeoff) generate the most replies
- Evidence tier correlation (Tier A vs B reply rates)

Add a section after the stats grid:

```tsx
{/* Hook Performance */}
<h2 className="text-lg font-semibold mb-4">Hook Performance</h2>
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
  {angleStats.map((stat) => (
    <div key={stat.angle} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-300 capitalize">{stat.angle}</span>
        <span className="text-xs text-zinc-500">{stat.sent} sent</span>
      </div>
      <p className="text-xl font-bold text-emerald-400">{stat.replyRate}%</p>
      <p className="text-xs text-zinc-600">reply rate</p>
    </div>
  ))}
</div>
```

**Step 3: Add objection distribution**

Query reply classifications from message metadata:

```tsx
{/* Objection Distribution */}
<h2 className="text-lg font-semibold mb-4">Reply Classification</h2>
<div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 mb-8">
  {/* Bar chart showing distribution of reply categories */}
  {classificationStats.map((stat) => (
    <div key={stat.category} className="flex items-center gap-3 mb-2">
      <span className="text-xs text-zinc-400 w-32 shrink-0">{stat.label}</span>
      <div className="flex-1 bg-zinc-800 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-emerald-500"
          style={{ width: `${stat.percentage}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500 w-8 text-right">{stat.count}</span>
    </div>
  ))}
</div>
```

**Step 4: Add sequence completion rates**

Query `lead_sequences` for completion stats by sequence name.

**Step 5: Commit**

```bash
git add src/app/app/analytics/page.tsx
git commit -m "feat: enhance analytics with reply metrics, hook performance, and coaching"
```

---

### Task 4: Add evidence quality badges to hook cards

**Files:**
- Modify: `src/app/app/hooks/page.tsx`

**Step 1: Add freshness badge**

On each hook card, next to the existing trust badge, add a freshness indicator based on `source_date`:

```tsx
{/* Freshness badge */}
{hook.source_date && (() => {
  const age = daysSince(hook.source_date);
  const freshness = age <= 7 ? "Fresh" : age <= 30 ? "Recent" : age <= 90 ? "Older" : "Stale";
  const color = age <= 7
    ? "text-emerald-400 bg-emerald-900/30 border-emerald-800"
    : age <= 30
      ? "text-blue-400 bg-blue-900/30 border-blue-800"
      : age <= 90
        ? "text-amber-400 bg-amber-900/30 border-amber-800"
        : "text-zinc-500 bg-zinc-800 border-zinc-700";
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${color}`}>
      {freshness}
    </span>
  );
})()}
```

Add helper function:
```ts
function daysSince(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 999;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}
```

**Step 2: Commit**

```bash
git add src/app/app/hooks/page.tsx
git commit -m "feat: add evidence freshness badges to hook cards"
```

---

### Task 5: Update tier flags and run tests

**Files:**
- Modify: `src/lib/tiers.ts`

**Step 1: Add replyAnalysis flag**

Add `replyAnalysis: boolean` to flags interface:
- Starter: `replyAnalysis: false`
- Pro: `replyAnalysis: true`
- Concierge: `replyAnalysis: true`

**Step 2: Run full test suite**

Run: `npx vitest run`

**Step 3: Run build**

Run: `npx next build`

**Step 4: Commit**

```bash
git add src/lib/tiers.ts
git commit -m "feat: add replyAnalysis tier flag"
```

---

### Task 6: Final integration test

**Step 1: Run full test suite**

Run: `npx vitest run`

**Step 2: Run build**

Run: `npx next build`

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: phase 4 integration fixes"
```

---

## Verification Checklist

- [ ] `classifyReplyText()` correctly detects ooo, unsubscribe, wrong_person
- [ ] `classifyReply()` calls Claude for nuanced replies
- [ ] `generateSuggestedResponse()` returns appropriate drafts per category
- [ ] SendGrid inbound webhook matches replies to leads
- [ ] Inbound replies stored with direction="inbound" and classification metadata
- [ ] Active sequences auto-pause on reply
- [ ] Notifications created for replies
- [ ] Suggested response saved as draft with notification
- [ ] Analytics shows reply rate, hook angle performance, classification distribution
- [ ] Freshness badges show on hook cards
- [ ] replyAnalysis tier flag gates features for Pro/Concierge
- [ ] All tests pass (`npx vitest run`)
- [ ] Build succeeds (`npx next build`)
