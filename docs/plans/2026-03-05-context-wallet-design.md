# Context Wallet + Hook Relevance Upgrade

**Date:** 2026-03-05
**Status:** Approved

## Problem

Hooks sound "personalized" but don't feel true. They echo prospect marketing language, invent internal pain/causality, ask broad strategy questions, and lack sender relevance. Buyers smell AI from a mile away.

A good hook does one job: prove relevance in 2 seconds and ask a question that's easy to answer. That means: one specific signal, one believable consequence, one narrow question (binary or very specific).

Two-sided relevance requires knowing BOTH the prospect's signal AND what the sender offers.

## Solution Overview

Three layers of change:

1. **Data layer** - `workspaces`, `workspace_profiles` tables, auto-creation on signup
2. **UI layer** - Profile modal (60s), progressive gating on copy/export, presets
3. **Generation layer** - Prompt changes to use sender context, verification-only fallback, tighter quality constraints

---

## 1. Data Model (Drizzle/Turso)

### workspaces
| Column | Type | Notes |
|--------|------|-------|
| id | text (uuid) | PK |
| owner_user_id | text | FK -> users.id |
| name | text | default "My Workspace" |
| created_at | text | default now |

### workspace_profiles
| Column | Type | Notes |
|--------|------|-------|
| workspace_id | text | PK, FK -> workspaces.id |
| what_you_sell | text | required |
| icp_industry | text | required |
| icp_company_size | text | required, dropdown value |
| buyer_roles | text | JSON array, required |
| primary_outcome | text | required |
| offer_category | text | enum, required (see section 8) |
| proof | text | JSON array, nullable |
| updated_at | text | default now, updated on save |

### workspace_members (deferred to v2)
Schema reserved: `workspace_id`, `user_id`, `role`, `created_at`. Not built in v1.

### Implementation notes
- Default workspace created on signup (or first login for existing users)
- All API routes resolve: session -> user -> default workspace -> workspace_id
- `workspace_members` deferred; workspace_id is the join point for future teams

---

## 2. UI Components

### A. Profile Modal (`/components/context-wallet-modal.tsx`)
- Triggered on first copy/export if no profile exists
- 4 required fields + offer_category + 1 optional, single screen
- "Start from template" dropdown pre-fills fields (6 presets)
- Save -> POST `/api/workspace-profile`

**Header copy:**
- Title: "Add your 60-second profile"
- Sub: "To generate hooks that connect the prospect's signal to YOUR offer, we need a little context."
- Primary button: "Save profile"
- No "Skip for now" when triggered from copy/export

### B. Context Gate (`/components/context-gate.tsx`)
- Wraps copy/export/follow-up buttons
- Checks `hasProfile` from workspace context
- If missing: shows gate modal
- **No "Copy anyway (generic)" button** - profile is required for copy/export
- Users can still VIEW generated hooks without a profile (demo experience preserved)

**Gate modal microcopy:**
- Title: "Make these hooks about YOU (not generic)"
- Body: "Right now we can see the prospect's signal, but we don't know what you sell. Add your 60-second profile to connect the signal to your offer."
- Single button: "Add profile (60 seconds)"

### C. Profile Hint Banner
- Shown below generated hooks when no profile exists
- Text: "Want hooks that connect to your pitch? Add your 60-second profile."
- Links to the profile modal

### D. Settings Page Section
- Edit profile anytime at `/dashboard/settings`
- Same form as the modal
- Shows last updated timestamp

---

## 3. API Routes

```
POST /api/workspace-profile     - create/update profile
GET  /api/workspace-profile     - fetch current profile
```

Both resolve workspace from session automatically.

---

## 4. Progressive Gating Rules

| Action | Profile required? |
|--------|------------------|
| Paste URL + generate hooks | No (demo works) |
| View generated hooks | No |
| Copy hook | Yes |
| Copy hook + evidence | Yes |
| Export to Apollo/Clay | Yes |
| Enable Follow-Up Engine | Yes |

When profile missing and gated action attempted: show Context Gate modal. No bypass.

---

## 5. Generation Layer Changes (`hooks.ts`)

### When `sender_context` exists

Inject into Claude system prompt as "SENDER CONTEXT" section:
- what_you_sell, icp, primary_outcome, offer_category, proof

Add constraints:
- Add at most ONE relevance bridge sentence tying signal -> outcome -> offer
- Relevance bridge template: `"[Signal verb] + [prospect noun] — [sender outcome] for [buyer role]. [Binary question]?"` (max 240 chars total hook)
- Never claim internal problems unless evidence supports it
- Questions must be binary (yes/no) or have exactly 2 concrete options

### When `sender_context` is null

- Switch to "verification-only" mode
- System prompt: "Do NOT reference the sender's product. Generate signal-verification hooks only."
- No relevance bridge sentence attempted
- Hooks still useful for demo/preview, just not tailored

### Question quality constraints (objective rules, replaces "ban consultant-speak")

Questions MUST satisfy at least one:
1. **Binary:** answerable yes/no ("Still using X for Y?")
2. **Two-option:** exactly 2 named alternatives ("X or Y?")
3. **Quantity/date:** asks for a specific number or timeframe ("How many reps are on that?")

Questions MUST NOT:
1. Contain 3+ abstract nouns (compliance, engagement, methodology, positioning, etc.)
2. Use "focusing on" or "driven by" framing
3. Ask about strategy/approach/philosophy (these are discovery-call questions, not openers)

### Evidence attribution (replaces "ban >8 word overlap")

- Quoting prospect copy is ALLOWED (this is evidence)
- Quotes MUST be attributed: wrapped in quotation marks with source indicated
- Unattributed paraphrasing of 5+ consecutive prospect words -> reject
- This means: "Your site says 'X' — [question]?" is valid. "You do X — [question]?" without quotes is not.

### Invented causality ban (objective)

Reject hooks containing:
- "the usual bottleneck is..."
- "typically this means..."
- "most teams struggle with..."
- "disconnected systems"
- "the challenge is..."
- Any causal claim not directly supported by a source fact

Pattern: if a hook contains a causal/diagnostic statement, it must map to a specific source fact. If no source fact supports it, reject.

---

## 6. Cache Busting

### Problem
When a user saves/updates their profile, cached hooks for previously-searched URLs are stale (generated without sender context or with old context).

### Solution
- Store `profile_updated_at` alongside cached hooks
- On cache read: compare `workspace_profiles.updated_at` with cached `profile_updated_at`
- If profile is newer than cache entry -> cache miss -> regenerate
- If profile is null and cache was generated with a profile -> cache miss -> regenerate (edge case: user deletes profile)

### Implementation
- Add `profile_updated_at` column to `hookCache` table (nullable text)
- On cache write: include current `workspace_profiles.updated_at` (or null)
- On cache read: fetch workspace profile, compare timestamps

---

## 7. VoltAgent Integration (thin wrapper, v1)

Single agent wrapping the existing pipeline. No sub-agents.

```typescript
import { Agent, VoltAgent } from "@voltagent/core";
import { HonoServer } from "@voltagent/server-hono";

const hookAgent = new Agent({
  name: "hook-generator",
  description: "Generates evidence-backed cold email hooks",
  llm: new AnthropicProvider({ apiKey: process.env.CLAUDE_API_KEY }),
  tools: [generateHooksTool, fetchSourcesTool],
});

new VoltAgent({ agents: { hookAgent } });
```

- `generateHooksTool` wraps `generateHooksForUrl()` with sender_context
- `fetchSourcesTool` wraps `fetchSourcesWithGating()`
- VoltOps console provides observability (optional, can connect later)
- No QA Agent, no Sales Outreach Agent in v1 — just the wrapper
- Agent server runs alongside Next.js on a separate port (3141)

---

## 8. Offer Category Enum

```typescript
type OfferCategory =
  | "outbound_agency"
  | "sdr_team"
  | "revops_consulting"
  | "sales_engagement_platform"
  | "security_compliance"
  | "marketing_automation"
  | "data_enrichment"
  | "recruiting"
  | "b2b_saas_generic"
  | "other";
```

- Required field in workspace_profiles
- Used by prompt to set tone/angle (e.g., security sellers get compliance-framed hooks)
- Presets auto-select the matching category

---

## 9. Presets

| Preset | what_you_sell | icp_industry | outcome | offer_category |
|--------|--------------|-------------|---------|----------------|
| Outbound agency | "We run outbound campaigns for B2B companies" | B2B Services | Meetings | outbound_agency |
| SDR team | "We help prospects book demos" | SaaS | Pipeline | sdr_team |
| RevOps consulting | "We optimize CRM and sales processes" | Technology | Speed | revops_consulting |
| Sales engagement platform | "We provide tools for sales outreach at scale" | SaaS | Conversion | sales_engagement_platform |
| Security/compliance | "We help companies meet security standards" | Technology | Compliance | security_compliance |
| B2B SaaS (generic) | "We sell B2B software" | Technology | Pipeline | b2b_saas_generic |

---

## 10. Relevance Bridge Template

When sender_context exists, the hook follows this structure:

```
[Attributed signal quote] — [1 believable consequence, max 15 words] — [Binary/2-option question]?
```

Total hook: max 240 characters.

Relevance bridge (the consequence part): max 80 characters. Must reference sender's outcome category without naming their product.

Examples:
- Good: `Your team posted 3 new SDR roles last month — scaling outbound before pipeline catches up? Hiring ahead of quota or backfilling?`
- Bad: `Your team posted 3 new SDR roles — the usual bottleneck is measurement frequency. Are you focusing on compliance or engagement first?`

---

## 11. Not Included (YAGNI)

- Team invites / multi-user workspace UI
- Profile versioning or history
- A/B testing different profiles
- VoltOps console setup
- Multiple agents / sub-agent orchestration
- Full cold email drafting (v2)
- Apollo/Clay export integration (existing, just gated)

---

## Implementation Order

1. Data layer: schema + migrations + default workspace creation
2. API routes: workspace-profile CRUD
3. UI: profile modal + context gate + hint banner + settings section
4. Generation: prompt changes + sender_context injection + verification-only fallback
5. Quality: new question constraints + attribution rules + causality ban
6. Cache: profile_updated_at busting
7. VoltAgent: thin wrapper agent
8. Presets: static config + UI dropdown
