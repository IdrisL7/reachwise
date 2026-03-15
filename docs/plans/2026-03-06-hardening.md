# Codebase Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden security, data integrity, error handling, performance, and billing across the GetSignalHooks codebase.

**Architecture:** Five waves of changes ordered by risk. Wave 1 (security) blocks external abuse of expensive API routes. Wave 2 (data integrity) fixes race conditions. Wave 3 (indexes) improves query performance. Wave 4 (error handling) adds Sentry and sanitizes error responses. Wave 5 (billing) closes Stripe webhook gaps.

**Tech Stack:** Next.js App Router, Turso/libsql + Drizzle ORM, Stripe, Sentry, Claude API

---

## Wave 1: Security — Auth Guards + Rate Limiting

### Task 1: Add auth + rate limiting + quota to `/api/generate-hooks`

**Files:**
- Modify: `src/app/api/generate-hooks/route.ts:1-25` (imports), `47-130` (auth block)
- Modify: `src/lib/rate-limit.ts:10-21` (add new rate limit configs)

**Step 1: Add rate limit configs for hooks and email**

In `src/lib/rate-limit.ts`, the `RATE_LIMITS` object (lines 10-21). Add entries if not present. Replace the entire object:

```typescript
const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "public:hooks": { limit: 10, windowSeconds: 60 },
  "public:hooks-batch": { limit: 3, windowSeconds: 60 },
  "public:email": { limit: 5, windowSeconds: 60 },
  "public:sales-chat": { limit: 10, windowSeconds: 60 },
  "auth:hooks": { limit: 60, windowSeconds: 60 },
  "auth:hooks-batch": { limit: 20, windowSeconds: 60 },
  "auth:email": { limit: 20, windowSeconds: 60 },
  "auth:leads": { limit: 100, windowSeconds: 60 },
  "auth:followups": { limit: 30, windowSeconds: 60 },
  "auth:login": { limit: 5, windowSeconds: 300 },
  "auth:register": { limit: 3, windowSeconds: 600 },
  "auth:forgot-password": { limit: 3, windowSeconds: 600 },
  "auth:reset-password": { limit: 5, windowSeconds: 600 },
};
```

**Step 2: Add auth, rate limiting, and quota to generate-hooks route**

In `src/app/api/generate-hooks/route.ts`, add imports at top (after existing imports):

```typescript
import { checkHookQuota } from "@/lib/tier-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
```

Then replace the auth block (lines 116-130) with auth-required + rate limit + quota logic. Insert this right after the API key check (after line 114):

```typescript
    // Auth required
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting
    const rateLimited = await checkRateLimit(getClientIp(request), "auth:hooks");
    if (rateLimited) return rateLimited;

    // Quota check (trial + monthly limit + increment)
    const quotaError = await checkHookQuota(session.user.id);
    if (quotaError) return quotaError;

    // Resolve workspace profile for cache busting
    let profileUpdatedAt: string | null = null;
    let _senderContext: Awaited<ReturnType<typeof getWorkspaceProfile>> = null;
    try {
      const workspaceId = await resolveWorkspaceId(session.user.id);
      [_senderContext, profileUpdatedAt] = await Promise.all([
        getWorkspaceProfile(workspaceId),
        getProfileUpdatedAt(workspaceId),
      ]);
    } catch {
      // Non-critical — continue without profile context
    }
```

This removes the optional `try { const session = await auth() ... } catch {}` block and makes auth mandatory.

**Step 3: Verify build compiles**

Run: `cd /home/idris/reachwise && npx next build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

**Step 4: Commit**

```bash
git add src/app/api/generate-hooks/route.ts src/lib/rate-limit.ts
git commit -m "security: add auth, rate limiting, and quota to generate-hooks route"
```

---

### Task 2: Add auth + rate limiting to `/api/generate-email`

**Files:**
- Modify: `src/app/api/generate-email/route.ts:1-6` (imports), `194-210` (route handler top)

**Step 1: Add auth and rate limit check at top of POST handler**

Add imports at top of file:

```typescript
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
```

Insert auth + rate limit check right after `export async function POST(request: Request) {` and before `try {`:

```typescript
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimited = await checkRateLimit(getClientIp(request), "auth:email");
  if (rateLimited) return rateLimited;

  try {
```

**Step 2: Verify build**

Run: `cd /home/idris/reachwise && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/generate-email/route.ts
git commit -m "security: add auth and rate limiting to generate-email route"
```

---

### Task 3: Add rate limiting to `/api/sales-chat`

**Files:**
- Modify: `src/app/api/sales-chat/route.ts:1-3` (imports), `52-57` (route handler top)

**Step 1: Add rate limit check**

The sales-chat route is intentionally public (homepage widget), so no auth — but add IP-based rate limiting.

Add import at top:

```typescript
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
```

Insert at very start of POST handler (line 52), before `try {`:

```typescript
export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(getClientIp(request), "public:sales-chat");
  if (rateLimited) return rateLimited;

  try {
```

**Step 2: Verify build**

Run: `cd /home/idris/reachwise && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/sales-chat/route.ts
git commit -m "security: add rate limiting to sales-chat route"
```

---

### Task 4: Rate limiter — fail closed instead of open

**Files:**
- Modify: `src/lib/rate-limit.ts:81-85`

**Step 1: Change fail-open to fail-closed**

Replace the catch block (lines 81-85):

```typescript
  } catch (err) {
    // Fail closed — if DB is down, reject the request
    console.error("Rate limit check failed:", err);
    return NextResponse.json(
      { status: "error", code: "SERVICE_UNAVAILABLE", message: "Service temporarily unavailable. Please try again." },
      { status: 503 },
    );
  }
```

**Step 2: Commit**

```bash
git add src/lib/rate-limit.ts
git commit -m "security: rate limiter fails closed instead of open"
```

---

### Task 5: Timing-safe comparison for CRON_SECRET

**Files:**
- Modify: `src/app/api/cron/cleanup/route.ts:7-11`

**Step 1: Replace string comparison with timing-safe comparison**

Add import at top:

```typescript
import { timingSafeEqual } from "crypto";
```

Replace the auth check (lines 7-11):

```typescript
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
```

**Step 2: Check if there's a second cron route (`cron/onboarding-emails`) that needs the same fix**

Read `src/app/api/cron/onboarding-emails/route.ts` and apply the same pattern if it uses string comparison.

**Step 3: Commit**

```bash
git add src/app/api/cron/cleanup/route.ts src/app/api/cron/onboarding-emails/route.ts
git commit -m "security: timing-safe comparison for cron secrets"
```

---

## Wave 2: Data Integrity — Race Conditions + Atomic Operations

### Task 6: Atomic hooksUsedThisMonth reset + increment

**Files:**
- Modify: `src/lib/tier-guard.ts:86-139`

**Step 1: Replace SELECT-then-UPDATE with atomic SQL**

Replace the entire `checkHookQuota` function (lines 86-139) with an atomic version:

```typescript
/** Check and increment hook usage. Returns null if OK, or error response if limit hit. */
export async function checkHookQuota(userId: string): Promise<NextResponse | null> {
  // First check trial status
  const trialCheck = await checkTrialActive(userId);
  if (trialCheck) return trialCheck;

  const [user] = await db
    .select({
      tierId: schema.users.tierId,
      hooksUsedThisMonth: schema.users.hooksUsedThisMonth,
      hooksResetAt: schema.users.hooksResetAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) return tierError("User not found.", "USER_NOT_FOUND");

  const tierId = (user.tierId as TierId) || "starter";
  const limits = getLimits(tierId);

  const now = new Date();
  const resetDate = new Date(user.hooksResetAt);
  const isNewMonth =
    resetDate.getMonth() !== now.getMonth() ||
    resetDate.getFullYear() !== now.getFullYear();

  // Atomic: reset-if-new-month + increment + check in one UPDATE with WHERE guard
  const result = await db
    .update(schema.users)
    .set({
      hooksUsedThisMonth: isNewMonth
        ? 1
        : sql`${schema.users.hooksUsedThisMonth} + 1`,
      hooksResetAt: isNewMonth ? now.toISOString() : user.hooksResetAt,
    })
    .where(
      isNewMonth
        ? eq(schema.users.id, userId)
        : sql`${schema.users.id} = ${userId} AND ${schema.users.hooksUsedThisMonth} < ${limits.hooksPerMonth}`,
    )
    .returning({ hooksUsedThisMonth: schema.users.hooksUsedThisMonth });

  if (!result.length) {
    return tierError(
      `Monthly hook limit reached (${limits.hooksPerMonth}). Upgrade your plan for more.`,
    );
  }

  return null;
}
```

Note: Drizzle with Turso supports `.returning()`. If it doesn't work with the WHERE-based conditional, fall back to checking `result` length — if 0 rows updated, the WHERE guard blocked it (quota exceeded).

**Step 2: Verify build**

Run: `cd /home/idris/reachwise && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/lib/tier-guard.ts
git commit -m "fix: atomic hooksUsedThisMonth reset and increment (race condition)"
```

---

### Task 7: Bulk account deletion (replace N+1 loop)

**Files:**
- Modify: `src/app/api/auth/delete-account/route.ts:52-63`

**Step 1: Replace the N+1 loop with bulk deletes**

Replace lines 52-63 (the userLeads loop) with:

```typescript
    // Leads and related data — bulk delete via subquery
    await db.delete(schema.outboundMessages).where(
      sql`${schema.outboundMessages.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
    );
    await db.delete(schema.auditLog).where(
      sql`${schema.auditLog.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
    );
    await db.delete(schema.claimLocks).where(
      sql`${schema.claimLocks.leadId} IN (SELECT id FROM leads WHERE user_id = ${userId})`,
    );
    await db.delete(schema.leads).where(eq(schema.leads.userId, userId));
```

Also add `sql` to imports if not already present:

```typescript
import { eq, sql } from "drizzle-orm";
```

**Step 2: Commit**

```bash
git add src/app/api/auth/delete-account/route.ts
git commit -m "perf: bulk account deletion replaces N+1 query loop"
```

---

### Task 8: Stripe webhook idempotency

**Files:**
- Modify: `src/lib/db/schema.ts` (add stripe_events table)
- Modify: `src/app/api/webhooks/stripe/route.ts:8-27` (add dedup check)

**Step 1: Add stripe_events table to schema**

Append to `src/lib/db/schema.ts` (after rateLimits table, before the closing):

```typescript
export const stripeEvents = sqliteTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: text("processed_at").notNull().default(sql`(datetime('now'))`),
});
```

**Step 2: Generate and run migration**

Run: `cd /home/idris/reachwise && npx drizzle-kit generate`

Then push to DB:
Run: `cd /home/idris/reachwise && npx drizzle-kit push`

**Step 3: Add idempotency check to webhook handler**

In `src/app/api/webhooks/stripe/route.ts`, add import:

```typescript
import { sql } from "drizzle-orm";
```

After the signature verification (after line 26, before the switch), add:

```typescript
  // Idempotency: skip already-processed events
  const [existing] = await db
    .select()
    .from(schema.stripeEvents)
    .where(eq(schema.stripeEvents.eventId, event.id))
    .limit(1);

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Record this event as processed
  await db.insert(schema.stripeEvents).values({
    eventId: event.id,
    type: event.type,
  });
```

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts src/app/api/webhooks/stripe/route.ts
git commit -m "fix: Stripe webhook idempotency via stripe_events table"
```

---

## Wave 3: Database Indexes

### Task 9: Add missing database indexes

**Files:**
- Modify: `src/lib/db/schema.ts` (add indexes to existing tables)

**Step 1: Add indexes**

Add index to `hookCache` table definition. Change the table to include an index function:

```typescript
export const hookCache = sqliteTable("hook_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  urlHash: text("url_hash").notNull().unique(),
  url: text("url").notNull(),
  hooks: text("hooks", { mode: "json" }).notNull(),
  citations: text("citations", { mode: "json" }),
  rulesVersion: integer("rules_version"),
  profileUpdatedAt: text("profile_updated_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("hook_cache_expires_at_idx").on(table.expiresAt),
]);
```

Add index to `rateLimits`:

```typescript
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(1),
  resetAt: text("reset_at").notNull(),
}, (table) => [
  index("rate_limits_reset_at_idx").on(table.resetAt),
]);
```

Add status index to `outboundMessages` (it already has a `(table) => [...]` block — add to it):

```typescript
}, (table) => [
  index("outbound_messages_lead_id_idx").on(table.leadId),
  index("outbound_messages_status_idx").on(table.status),
]);
```

Add `createdAt` index to `leads` (it already has indexes — add to the array):

```typescript
}, (table) => [
  index("leads_user_id_idx").on(table.userId),
  index("leads_status_idx").on(table.status),
  index("leads_created_at_idx").on(table.createdAt),
]);
```

**Step 2: Push schema changes**

Run: `cd /home/idris/reachwise && npx drizzle-kit push`

**Step 3: Commit**

```bash
git add src/lib/db/schema.ts
git commit -m "perf: add missing indexes on hookCache, rateLimits, outboundMessages, leads"
```

---

## Wave 4: Error Handling — Sentry + Error Sanitization

### Task 10: Add Sentry.captureException to route error handlers

**Files:**
- Modify: `src/app/api/generate-hooks/route.ts:362-367`
- Modify: `src/app/api/generate-hooks-batch/route.ts:129-134`
- Modify: `src/app/api/generate-email/route.ts` (find the catch block at end of POST)
- Modify: `src/app/api/webhooks/stripe/route.ts` (add try/catch around switch)
- Modify: `src/app/api/auth/register/route.ts` (find the catch block)
- Modify: `src/app/api/auth/delete-account/route.ts:73-78`

**Step 1: Add Sentry capture to each route's catch block**

For each file above, add this import at the top:

```typescript
import * as Sentry from "@sentry/nextjs";
```

Then in each catch block, add `Sentry.captureException(error);` before the `console.error` line. Example pattern:

```typescript
  } catch (error) {
    Sentry.captureException(error);
    console.error("...", error);
    return NextResponse.json(
      { error: "..." },
      { status: 500 },
    );
  }
```

Apply this to all 6 files listed above. For the stripe webhook, wrap the switch statement in try/catch if not already wrapped.

**Step 2: Verify build**

Run: `cd /home/idris/reachwise && npx next build 2>&1 | tail -5`

**Step 3: Commit**

```bash
git add src/app/api/generate-hooks/route.ts src/app/api/generate-hooks-batch/route.ts \
  src/app/api/generate-email/route.ts src/app/api/webhooks/stripe/route.ts \
  src/app/api/auth/register/route.ts src/app/api/auth/delete-account/route.ts
git commit -m "fix: add Sentry.captureException to all route error handlers"
```

---

### Task 11: Sanitize error messages in Stripe checkout route

**Files:**
- Modify: `src/app/api/stripe/checkout/route.ts`

**Step 1: Find and sanitize the error response**

Read the file first. Find the catch block that exposes `message` directly. Replace:

```typescript
return NextResponse.json({ error: `Checkout failed: ${message}` }, ...);
```

With:

```typescript
Sentry.captureException(error);
console.error("Stripe checkout error:", error);
return NextResponse.json(
  { error: "Something went wrong creating your checkout session. Please try again." },
  { status: 500 },
);
```

**Step 2: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts
git commit -m "security: sanitize Stripe checkout error messages"
```

---

## Wave 5: Stripe Webhook Coverage

### Task 12: Add charge.refunded and customer.subscription.created handlers

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts:28-144` (add cases to switch)

**Step 1: Add charge.refunded handler**

Add this case to the switch statement (after `invoice.payment_failed` case, before the closing `}`):

```typescript
    case "charge.refunded": {
      const charge = event.data.object;
      const customerId = charge.customer as string;
      if (customerId) {
        const [refundedUser] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.stripeCustomerId, customerId))
          .limit(1);

        if (refundedUser) {
          await db
            .update(schema.users)
            .set({ tierId: "starter", stripeSubscriptionId: null })
            .where(eq(schema.users.id, refundedUser.id));

          logAudit({
            userId: refundedUser.id,
            event: "subscription_downgraded_refund",
            metadata: { chargeId: charge.id, amountRefunded: charge.amount_refunded },
          }).catch(() => {});
        }
      }
      break;
    }
```

**Step 2: Add customer.subscription.created handler**

Add this case (catches subscriptions created outside checkout flow):

```typescript
    case "customer.subscription.created": {
      const subscription = event.data.object;
      await syncSubscriptionToUser(subscription);
      logAudit({
        userId: subscription.metadata.userId,
        event: "subscription_created_webhook",
        metadata: { subscriptionId: subscription.id },
      }).catch(() => {});
      break;
    }
```

**Step 3: Verify build**

Run: `cd /home/idris/reachwise && npx next build 2>&1 | tail -5`

**Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: handle charge.refunded and customer.subscription.created webhooks"
```

---

## Final: Verify full build + push

### Task 13: Final verification

**Step 1: Full build check**

Run: `cd /home/idris/reachwise && npx next build 2>&1 | tail -20`
Expected: Clean build, no errors.

**Step 2: Run existing tests**

Run: `cd /home/idris/reachwise && npx vitest run 2>&1`
Expected: All existing tests pass.

**Step 3: Push all commits**

Run: `git push origin main`
