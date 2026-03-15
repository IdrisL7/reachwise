# Find Contacts at This Company — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After generating hooks, Pro/Concierge users can click "Find contacts at this company" to pull verified B2B contacts from LinkedIn via Apify and save them directly to their leads table.

**Architecture:** A new `POST /api/find-contacts` route calls the Apify `blitzapi/linkedin-leads-scraper` actor, maps the response to the `leads` table schema, upserts on email uniqueness, and returns a count. The hooks page gains a compact action button below the results section; it renders an upgrade nudge for Starter users and live feedback (loading / saved N contacts) for Pro/Concierge.

**Tech Stack:** Next.js App Router API route, Drizzle ORM + Turso, Apify REST API (no SDK), React state in `src/app/app/hooks/page.tsx`.

---

## Task 1: API route — `POST /api/find-contacts`

**Files:**
- Create: `src/app/api/find-contacts/route.ts`

### Step 1: Create the route file with auth + tier gate

The route must:
1. Require an authenticated session (no anonymous access)
2. Block Starter tier with a 403 and an `UPGRADE_REQUIRED` code
3. Accept `{ domain: string }` in the request body — domain is a bare hostname like `gong.io`
4. Validate that `domain` is non-empty and looks like a hostname

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { sql } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tierId: string = (session.user as any).tierId || "starter";
  if (tierId !== "pro" && tierId !== "concierge") {
    return NextResponse.json(
      { error: "Upgrade to Pro or Concierge to find contacts.", code: "UPGRADE_REQUIRED" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null) as { domain?: string } | null;
  const domain = body?.domain?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "Provide a valid domain (e.g. gong.io)." }, { status: 400 });
  }

  // ... Apify call + DB insert (next steps)
}
```

### Step 2: Add Apify call inside the route

The actor `blitzapi/linkedin-leads-scraper` is called synchronously (same pattern as `callApifyActor` in `src/lib/apify-signals.ts`). Read that file to understand the pattern before writing this.

Add this after the validation block:

```typescript
  const apifyToken = process.env.APIFY_API_TOKEN;
  if (!apifyToken) {
    return NextResponse.json({ error: "Contact discovery is not configured." }, { status: 503 });
  }

  type ApifyLead = {
    firstName?: string;
    lastName?: string;
    email?: string;
    title?: string;
    headline?: string;
    linkedinUrl?: string;
    companyName?: string;
    companyWebsite?: string;
  };

  let rawLeads: ApifyLead[] = [];
  try {
    const slug = "blitzapi~linkedin-leads-scraper";
    const res = await fetch(
      `https://api.apify.com/v2/acts/${slug}/run-sync-get-dataset-items?token=${apifyToken}&timeout=30`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, maxLeads: 20 }),
      },
    );
    if (res.ok) {
      rawLeads = await res.json() as ApifyLead[];
    }
  } catch {
    // Apify call failed — return empty result rather than 500
    return NextResponse.json({ leads: [], created: 0, skipped: 0 });
  }
```

### Step 3: Map Apify results and upsert into leads table

Valid leads must have at least an email. Map to the `leads` table schema (see `src/lib/db/schema.ts` — columns: `userId`, `email`, `name`, `title`, `companyName`, `companyWebsite`, `linkedinUrl`, `source`).

```typescript
  const validLeads = rawLeads.filter((l) => l.email && l.email.includes("@"));
  let created = 0;
  let skipped = 0;

  for (const lead of validLeads) {
    const email = lead.email!.trim().toLowerCase();
    const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null;
    try {
      await db.insert(schema.leads).values({
        userId: session.user.id,
        email,
        name,
        title: lead.title || lead.headline || null,
        companyName: lead.companyName || null,
        companyWebsite: lead.companyWebsite || `https://${domain}`,
        linkedinUrl: lead.linkedinUrl || null,
        source: "apify-linkedin",
      });
      created++;
    } catch {
      // UNIQUE constraint on email — skip duplicate
      skipped++;
    }
  }

  return NextResponse.json({ leads: validLeads.slice(0, created), created, skipped });
```

### Step 4: Manual smoke test (no automated test needed for this route)

Start dev server (`pnpm dev`) and in a new terminal:

```bash
# Replace TOKEN with a valid session cookie from browser devtools if testing via curl,
# or just verify the route exists and returns 401 without auth:
curl -X POST http://localhost:3000/api/find-contacts \
  -H "Content-Type: application/json" \
  -d '{"domain":"gong.io"}' \
  -s | jq .
# Expected: { "error": "Unauthorized" }
```

### Step 5: Commit

```bash
git add src/app/api/find-contacts/route.ts
git commit -m "feat: add POST /api/find-contacts — Apify LinkedIn leads → leads table"
```

---

## Task 2: Store `tier` in hooks page state

The hooks page already fetches `/api/user-stats` (line ~126) which returns `{ hooksUsed, tier, trialEndsAt, limits }`. Currently only `hooksUsed` is extracted. We need `tier` to decide whether to show the button or an upgrade nudge.

**Files:**
- Modify: `src/app/app/hooks/page.tsx`

### Step 1: Add `userTier` state variable

After the existing state declarations (around line 80), add:

```typescript
const [userTier, setUserTier] = useState<string>("starter");
```

### Step 2: Extract `tier` from user-stats response

In the `useEffect` that fetches user-stats (line ~131), update the handler to also set tier:

```typescript
// Before (line ~133):
const used = statsData.hooksUsed ?? 0;
setHooksUsed(used);

// After:
const used = statsData.hooksUsed ?? 0;
setHooksUsed(used);
setUserTier(statsData.tier ?? "starter");
```

### Step 3: Commit

```bash
git add src/app/app/hooks/page.tsx
git commit -m "feat: store userTier from user-stats in hooks page state"
```

---

## Task 3: "Find contacts" button UI

**Files:**
- Modify: `src/app/app/hooks/page.tsx`

### Step 1: Add contact discovery state variables

After the `userTier` state (Task 2), add:

```typescript
const [findingContacts, setFindingContacts] = useState(false);
const [contactsResult, setContactsResult] = useState<{ created: number; skipped: number } | null>(null);
const [contactsError, setContactsError] = useState<string | null>(null);
```

### Step 2: Add `findContacts` handler function

Add this function alongside the other async handlers (e.g., near `generateEmail` ~line 230):

```typescript
async function findContacts() {
  if (!companyDomain) return;
  setFindingContacts(true);
  setContactsResult(null);
  setContactsError(null);
  try {
    const res = await fetch("/api/find-contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: companyDomain }),
    });
    const data = await res.json();
    if (!res.ok) {
      setContactsError(data.error || "Something went wrong.");
    } else {
      setContactsResult({ created: data.created, skipped: data.skipped });
      trackEvent("contacts_found");
    }
  } catch {
    setContactsError("Network error — please try again.");
  } finally {
    setFindingContacts(false);
  }
}
```

### Step 3: Add the button block to the JSX

Place this block **immediately after** the closing `</div>` of the hooks list section (after line ~738, before `{intentData && ...}`):

```tsx
{hooks.length > 0 && companyDomain && (
  <div className="mt-2 pt-4 border-t border-zinc-800/60">
    {userTier === "starter" ? (
      <p className="text-xs text-zinc-500">
        <span className="text-violet-400 font-medium">Pro/Concierge</span> — Find verified contacts at this company and save them to your leads list.{" "}
        <a href="/pricing" className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">Upgrade</a>
      </p>
    ) : contactsResult ? (
      <p className="text-xs text-zinc-400">
        Saved <span className="text-emerald-400 font-medium">{contactsResult.created}</span> new contact{contactsResult.created !== 1 ? "s" : ""} to your leads
        {contactsResult.skipped > 0 && <span className="text-zinc-600"> ({contactsResult.skipped} already in list)</span>}
        {" — "}
        <a href="/app/leads" className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors">View leads</a>
      </p>
    ) : (
      <button
        onClick={findContacts}
        disabled={findingContacts}
        className="text-xs font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition-colors flex items-center gap-1.5"
      >
        {findingContacts ? (
          <>
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Finding contacts…
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
            Find contacts at {companyDomain}
          </>
        )}
      </button>
    )}
    {contactsError && (
      <p className="text-xs text-red-400 mt-1">{contactsError}</p>
    )}
  </div>
)}
```

### Step 4: Verify in browser

1. Generate hooks for any company domain
2. As a Starter user: the block shows the upgrade nudge text (no button)
3. As a Pro user with `APIFY_API_TOKEN` set: button appears, clicking it shows spinner, then "Saved N contacts to your leads" with link
4. Clicking "View leads" navigates to `/app/leads`

### Step 5: Commit

```bash
git add src/app/app/hooks/page.tsx
git commit -m "feat: add find-contacts button to hooks page (Pro/Concierge gated)"
```

---

## Verification Checklist

- [ ] `POST /api/find-contacts` returns 401 without session
- [ ] Returns 403 with `UPGRADE_REQUIRED` for Starter tier
- [ ] Returns 400 if domain is missing or has no dot
- [ ] Returns 503 if `APIFY_API_TOKEN` not set
- [ ] Pro/Concierge call with valid token → leads appear in `/app/leads`
- [ ] Duplicate emails → `skipped` count increments, no DB error
- [ ] Starter user sees upgrade nudge, not button
- [ ] Pro user sees button → spinner → success message → "View leads" link
- [ ] `contacts_found` event tracked on success
- [ ] Button only renders when `hooks.length > 0 && companyDomain`
