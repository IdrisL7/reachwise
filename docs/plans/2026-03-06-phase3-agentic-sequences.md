# Phase 3: Agentic Sequences (Autonomous Execution) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable autonomous multi-channel sequence execution: n8n reads lead_sequences, generates content per step channel, sends email or saves draft for non-email, supports approval mode, and surfaces everything in an inbox UI.

**Architecture:** Extend the existing followup-core n8n template to read from `lead_sequences` + `sequences` tables instead of hardcoded sequence. Add a notifications table for inbox. Create `/app/inbox` page for draft approval and activity feed. Extend the `/api/followup/due` route to return leads with their custom sequence steps and channels.

**Tech Stack:** Next.js 16.1.6 (App Router), n8n (Docker), Claude Sonnet API, Drizzle ORM + Turso (SQLite), Tailwind CSS

---

### Task 1: Add `notifications` table to schema

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Add notifications table**

After the `leadScores` table, add:

```ts
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type", {
    enum: ["draft_pending", "sequence_completed", "lead_replied", "auto_paused"],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body"),
  leadId: text("lead_id").references(() => leads.id),
  messageId: text("message_id").references(() => outboundMessages.id),
  read: integer("read").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
]);
```

**Step 2: Push schema to Turso**

Run: `set -a && source .env.local && set +a && npx drizzle-kit push`

**Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "schema: add notifications table for inbox"
```

---

### Task 2: Upgrade `/api/followup/due` to support custom sequences

**Files:**
- Modify: `src/app/api/followup/due/route.ts`

**Step 1: Refactor to read from lead_sequences**

Replace the current implementation that uses hardcoded sequences with one that reads from `lead_sequences` JOIN `sequences`:

```ts
import { resolveSequence } from "@/lib/followup/sequences";

// In GET handler, replace the simple leads query with:
// 1. Get active lead_sequences with their sequence config
const activeLeadSeqs = await db
  .select({
    ls: schema.leadSequences,
    lead: schema.leads,
    seqName: schema.sequences.name,
    seqSteps: schema.sequences.steps,
  })
  .from(schema.leadSequences)
  .innerJoin(schema.leads, eq(schema.leadSequences.leadId, schema.leads.id))
  .innerJoin(schema.sequences, eq(schema.leadSequences.sequenceId, schema.sequences.id))
  .where(eq(schema.leadSequences.status, "active"))
  .limit(200);

// 2. For each, check if current step is due based on delay
// 3. Return enriched lead objects with channel info from the step
```

The response should include:
- `channel`: from the sequence step (email, linkedin_connection, etc.)
- `step_type`: from the sequence step (first, bump, breakup)
- `approval_mode`: from lead_sequences
- `sequence_name`: for display in inbox

Keep backward compatibility: if no lead_sequences exist, fall back to the old behavior using hardcoded default sequence.

**Step 2: Commit**

```bash
git add src/app/api/followup/due/route.ts
git commit -m "feat: upgrade due leads API to support custom multi-channel sequences"
```

---

### Task 3: Extend generate-followup to support multi-channel content

**Files:**
- Modify: `src/app/api/generate-followup/route.ts`
- Modify: `src/lib/followup/generate.ts`

**Step 1: Update generate.ts to accept channel parameter**

Add a `channel` parameter to `generateFollowUp()`. When channel is:
- `email` — existing behavior (subject + body)
- `linkedin_connection` — generate short connection request (300 chars max)
- `linkedin_message` — generate LinkedIn DM (1900 chars max)
- `cold_call` — generate call opener script (150 words max)
- `video_script` — generate video script (200 words max)

Add channel-specific system prompts that reuse the existing evidence-based approach. The function should return:
```ts
{ subject?: string, body: string, channel: string, hookUsed?: { angle, evidence } }
```

**Step 2: Update route to pass channel from request body**

Accept `body.channel` (default: "email") and pass to `generateFollowUp()`.

**Step 3: Commit**

```bash
git add src/app/api/generate-followup/route.ts src/lib/followup/generate.ts
git commit -m "feat: extend followup generation to support multi-channel content"
```

---

### Task 4: Add draft approval and notification APIs

**Files:**
- Create: `src/app/api/notifications/route.ts`
- Create: `src/app/api/notifications/[id]/route.ts`
- Create: `src/app/api/drafts/[id]/approve/route.ts`

**Step 1: Create notifications API**

`GET /api/notifications` — list notifications for current user (session auth), ordered by createdAt desc, limit 50.

`PATCH /api/notifications` — mark notifications as read (accepts `{ ids: string[] }`).

**Step 2: Create single notification route**

`PATCH /api/notifications/[id]` — mark single notification read.
`DELETE /api/notifications/[id]` — delete notification.

**Step 3: Create draft approval route**

`POST /api/drafts/[id]/approve` — where `id` is the outboundMessages id:
1. Verify the message belongs to the user's lead
2. Update message status from "draft" to "queued" (or "sent" if email channel)
3. For email: trigger SendGrid/Gmail send
4. Advance lead_sequences currentStep
5. Update lead.lastContactedAt
6. Create audit log entry
7. Delete the draft_pending notification

`POST /api/drafts/[id]/reject` — delete the draft message and notification.

**Step 4: Commit**

```bash
git add src/app/api/notifications/route.ts src/app/api/notifications/\[id\]/route.ts src/app/api/drafts/\[id\]/approve/route.ts
git commit -m "feat: add notifications + draft approval/reject APIs"
```

---

### Task 5: Create enhanced n8n agentic-sequence template

**Files:**
- Create: `src/lib/n8n-templates/agentic-sequence.json`

**Step 1: Create new n8n workflow template**

Build on `followup-core.json` but with key differences:

1. **Check Due Leads** — calls `/api/followup/due` (now returns channel + approval_mode)
2. **Sort by Score** — add a Function node that sorts leads by intent score (from lead_scores, fetched in due response)
3. **Channel Router** — IF node: email → send flow, non-email → draft flow
4. **Generate Content** — calls `/api/generate-followup` with `channel` parameter
5. **Email Send Path** — Gmail node (existing) + record message + advance step
6. **Draft Path** — save as draft in outbound_messages + create notification
7. **Approval Mode Check** — IF approvalMode → always save as draft (even email)
8. **Step Advance** — `PATCH /api/lead-sequences/{id}` to advance currentStep
9. **Audit** — existing audit flow

This is a JSON file following n8n workflow format. Use the existing `followup-core.json` as a template for node structure, credentials, and variable references.

**Step 2: Register in n8n-templates API**

Check `src/app/api/n8n-templates/route.ts` and add the new template to the templates list.

**Step 3: Commit**

```bash
git add src/lib/n8n-templates/agentic-sequence.json src/app/api/n8n-templates/route.ts
git commit -m "feat: add agentic-sequence n8n template with multi-channel + approval"
```

---

### Task 6: Add lead-sequences advancement API

**Files:**
- Create: `src/app/api/lead-sequences/[id]/route.ts`

**Step 1: Create route**

`PATCH /api/lead-sequences/[id]` — Bearer token auth (for n8n) or session auth:

Accepts: `{ currentStep?: number, status?: "active"|"paused"|"completed" }`

Logic:
1. Find lead_sequence by id
2. Update fields
3. If currentStep >= sequence maxSteps, auto-set status to "completed" and create notification
4. If status changed to "paused", set pausedAt
5. If status changed to "completed", set completedAt and create notification

**Step 2: Commit**

```bash
git add "src/app/api/lead-sequences/[id]/route.ts"
git commit -m "feat: add lead-sequences advancement API for n8n"
```

---

### Task 7: Create Inbox page

**Files:**
- Create: `src/app/app/inbox/page.tsx`
- Modify: `src/app/app/layout.tsx`

**Step 1: Create inbox page**

Three sections:

**Pending Drafts** — drafts waiting for approval:
- Fetch: `GET /api/notifications?type=draft_pending` + associated draft messages
- Each card shows: lead name, company, channel badge, draft content preview
- Actions: "Approve & Send" (calls `/api/drafts/{id}/approve`) and "Reject" (calls `/api/drafts/{id}/reject`)

**Recent Activity** — all notifications:
- Fetch: `GET /api/notifications`
- Shows: type icon, title, body, timestamp, read/unread state
- Click marks as read

**Sequence Completions** — completed sequences:
- Filter notifications by type "sequence_completed"

Styling: consistent with existing pages (zinc-900 cards, zinc-800 borders, emerald accents).

**Step 2: Add nav link with badge**

In `src/app/app/layout.tsx`, add Inbox to navItems after Dashboard:
```ts
{ href: "/app/inbox", label: "Inbox" }
```

Add unread count badge next to the label by fetching notification count.

**Step 3: Commit**

```bash
git add src/app/app/inbox/page.tsx src/app/app/layout.tsx
git commit -m "feat: add inbox page with draft approval and notifications"
```

---

### Task 8: Add auto-pause extensions

**Files:**
- Modify: `src/app/api/followups/safety-check/route.ts`
- Modify: `src/app/api/followups/pause/route.ts`

**Step 1: Extend safety-check with intent score drop**

Add a 6th check: if lead's intent score dropped below 20 (was warm/hot, now cold), flag for pause with reason "cold_score_drop".

Read the lead's current score from `lead_scores` table.

**Step 2: Extend pause with auto-resume for OOO**

When pausing for "ooo":
1. Set `lead_sequences.pausedAt = now`
2. Calculate resumeAt = now + 7 days
3. Store resumeAt in lead_sequences metadata or a new `resumeAt` column

Add `resumeAt` text column to `lead_sequences` table if needed.

**Step 3: Extend daily cap handling**

When hitting "daily_cap", instead of pausing the sequence, just skip this execution cycle. The lead stays active and will be picked up in the next n8n run.

**Step 4: Commit**

```bash
git add src/app/api/followups/safety-check/route.ts src/app/api/followups/pause/route.ts src/lib/db/schema.ts
git commit -m "feat: extend auto-pause with score drop detection and OOO auto-resume"
```

---

### Task 9: Update tier flags and run tests

**Files:**
- Modify: `src/lib/tiers.ts`

**Step 1: Add agentic execution flag**

Add `agenticExecution: boolean` to flags interface:
- Starter: `agenticExecution: false`
- Pro: `agenticExecution: true`
- Concierge: `agenticExecution: true`

**Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

**Step 3: Run build**

Run: `npx next build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/lib/tiers.ts
git commit -m "feat: add agenticExecution tier flag"
```

---

### Task 10: Final integration test

**Step 1: Run full test suite**

Run: `npx vitest run`

**Step 2: Run build**

Run: `npx next build`

**Step 3: Verify schema**

Run: `set -a && source .env.local && set +a && npx drizzle-kit push`

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: phase 3 integration fixes"
```

---

## Verification Checklist

- [ ] `notifications` table exists in Turso
- [ ] `/api/followup/due` returns leads with channel info from custom sequences
- [ ] `/api/generate-followup` generates content for all 5 channels
- [ ] `/api/notifications` returns user's notifications
- [ ] `/api/drafts/{id}/approve` advances sequence and records message
- [ ] `/api/lead-sequences/{id}` PATCH advances step and auto-completes
- [ ] Inbox page shows pending drafts, activity feed, completions
- [ ] Inbox nav link shows unread count badge
- [ ] Safety check detects cold intent score drop
- [ ] OOO pause includes auto-resume logic
- [ ] agentic-sequence.json n8n template is valid JSON
- [ ] All tests pass (`npx vitest run`)
- [ ] Build succeeds (`npx next build`)
