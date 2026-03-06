# GetSignalHooks Platform Expansion Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform GetSignalHooks from a hook generator into a full autonomous outbound platform with multi-channel reach, intent-based prioritization, agentic sequence execution, and reply intelligence.

**Architecture:** 4-phase rollout, each independently shippable. Extends existing n8n orchestration, Brave Search pipeline, and SendGrid infrastructure. Upgrades to Vercel Pro for per-minute crons.

**Decisions:**
- Extend n8n (not replace)
- LinkedIn: generate-only (no automation)
- Intent data: Brave Search only
- Reply intake: SendGrid Inbound Parse
- Infra: Vercel Pro

---

## Phase 1: Multi-Channel Output + Custom Sequences

### 1A. Multi-Channel Hook Variants

Generate LinkedIn messages, cold call scripts, and video scripts alongside email hooks.

**Implementation:**
- New `generateChannelVariants(hooks, targetRole, senderContext)` in `src/lib/hooks.ts`
- Single Claude call: all hooks → all variants (batch)
- Limits: LinkedIn connection=300 chars, LinkedIn message=1900 chars, call=150 words, video=200 words
- Cache variants in `hookCache` (new `variants` TEXT column)
- UI: Tab switcher on hook cards (Email | LinkedIn | Call | Video)

**Types:**
```ts
type ChannelVariant = {
  channel: "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script";
  text: string;
};
type HookWithVariants = Hook & { variants: ChannelVariant[] };
```

### 1B. Custom Sequence Builder

Replace hardcoded 3-step email sequence with user-defined multi-channel sequences.

**New tables:**
- `sequences` (id, user_id, name, steps JSON, is_default, created_at, updated_at)
- `lead_sequences` (id, lead_id, sequence_id, current_step, status, approval_mode, started_at, paused_at, completed_at)

**Step schema:** `{ order, channel, delayDays, type: "first"|"bump"|"breakup", tone? }`

**New pages:** `/app/sequences` (list + builder), sequence CRUD API

**Pre-built templates:** Email Only (3-step), Multi-Channel (5-step), LinkedIn-First (3-step)

---

## Phase 2: Intent Scoring + Lead Prioritization

### 2A. Intent Signal Research

New `src/lib/intent.ts` — 3 parallel Brave queries (hiring, funding, tech changes) → Claude extraction → typed IntentSignal objects.

### 2B. Lead Scoring (0–100)

| Signal | Points |
|--------|--------|
| Hiring in relevant roles | +25 |
| Funding < 6 months | +20 |
| Tech stack change | +15 |
| Growth indicators | +15 |
| Recent news < 30 days | +10 |
| 3+ signals compound | +15 |
| Recency < 7 days | +10 |

Temperature: Hot (70-100), Warm (40-69), Cold (0-39)

### 2C. Storage & Refresh

- Tables: `intent_signals`, `lead_scores`
- On hook generation: auto-score
- Daily Vercel Pro cron: refresh active leads (batches of 50)
- 7-day TTL on signals

### 2D. UI

- Leads table: Score column with colored badge
- Hooks page: Intent signals panel
- Batch mode: Sort by score

---

## Phase 3: Agentic Sequences (Autonomous Execution)

### 3A. Enhanced n8n Template

New `agentic-sequence.json`: fetch due leads → sort by score → read step channel → generate content → send (email) or draft (non-email) → advance step → CRM sync.

### 3B. Approval Mode

`approval_mode` boolean on `lead_sequences`. Agent drafts → notification → rep approves in inbox.

### 3C. Inbox UI (`/app/inbox`)

Pending drafts, recent replies, sequence completions. Nav badge with unread count.

New `notifications` table + API.

### 3D. Auto-Pause Extensions

OOO (7-day pause + auto-resume), cold score drop, daily cap queuing.

### 3E. CRM Auto-Sync

After each send: update HubSpot/Salesforce with step, message, temperature. Pull CRM status changes back.

---

## Phase 4: Reply Analysis + Coaching Dashboard

### 4A. SendGrid Inbound Parse

MX record for `reply.getsignalhooks.com`. Webhook parses replies → matches to lead → classifies → auto-pauses → notifies.

### 4B. Reply Classification

New `src/lib/reply-analysis.ts`: interested, objection (BANT), not_now, wrong_person, unsubscribe, ooo. Returns sentiment, summary, suggested_action.

### 4C. Suggested Next Message

Auto-generate response based on classification. Saved as draft in inbox.

### 4D. Coaching Dashboard

Hook angle performance, evidence tier correlation, objection patterns, sequence completion rates.

### 4E. Evidence Quality Badges

Freshness, source type, hallucination flag — UI-only (data already in pipeline).

---

## Tier Gating

| Feature | Starter | Pro | Concierge |
|---------|---------|-----|-----------|
| Multi-channel | Email only | All channels | All |
| Custom sequences | 1 custom | Unlimited | Unlimited |
| Intent scoring | On-generation | Daily refresh | Priority |
| Agentic execution | Manual | 50 leads | Unlimited |
| Reply analysis | Manual paste | SendGrid | Priority |
| Coaching dashboard | Basic | Full | Full + team |
