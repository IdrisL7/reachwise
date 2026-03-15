# Context Wallet Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add workspace-first sender profiles ("Context Wallet") so hooks connect prospect signals to the sender's offer, with progressive gating on copy/export and cache busting on profile changes.

**Architecture:** New `workspaces` + `workspace_profiles` tables in Turso. Default workspace auto-created on registration. Profile injected into Claude system prompt as sender context. Cache invalidated when profile changes. UI: modal for profile creation, gate on copy/export actions, hint banner when no profile.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + Turso/libsql, NextAuth JWT sessions, Tailwind CSS, Vitest

---

### Task 1: Add workspace and workspace_profiles schema

**Files:**
- Modify: `src/lib/db/schema.ts`

**Step 1: Write the failing test**

Create test file first:

```typescript
// src/lib/workspace.test.ts
import { describe, it, expect } from "vitest";
import { OFFER_CATEGORIES, PROFILE_PRESETS, type OfferCategory } from "@/lib/workspace";

describe("workspace constants", () => {
  it("has 10 offer categories", () => {
    expect(OFFER_CATEGORIES).toHaveLength(10);
  });

  it("has 6 presets that each reference a valid offer_category", () => {
    expect(PROFILE_PRESETS).toHaveLength(6);
    for (const preset of PROFILE_PRESETS) {
      expect(OFFER_CATEGORIES).toContain(preset.offer_category);
      expect(preset.what_you_sell).toBeTruthy();
      expect(preset.icp_industry).toBeTruthy();
      expect(preset.primary_outcome).toBeTruthy();
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/idris/reachwise && npx vitest run src/lib/workspace.test.ts`
Expected: FAIL — module not found

**Step 3: Create workspace module with types, constants, and schema**

```typescript
// src/lib/workspace.ts
export const OFFER_CATEGORIES = [
  "outbound_agency",
  "sdr_team",
  "revops_consulting",
  "sales_engagement_platform",
  "security_compliance",
  "marketing_automation",
  "data_enrichment",
  "recruiting",
  "b2b_saas_generic",
  "other",
] as const;

export type OfferCategory = (typeof OFFER_CATEGORIES)[number];

export type WorkspaceProfile = {
  workspaceId: string;
  whatYouSell: string;
  icpIndustry: string;
  icpCompanySize: string;
  buyerRoles: string[];
  primaryOutcome: string;
  offerCategory: OfferCategory;
  proof: string[] | null;
  updatedAt: string;
};

export type SenderContext = {
  whatYouSell: string;
  icpIndustry: string;
  icpCompanySize: string;
  buyerRoles: string[];
  primaryOutcome: string;
  offerCategory: OfferCategory;
  proof: string[] | null;
};

export const PROFILE_PRESETS = [
  {
    label: "Outbound agency",
    what_you_sell: "We run outbound campaigns for B2B companies",
    icp_industry: "B2B Services",
    icp_company_size: "51-200",
    buyer_roles: ["VP Sales", "Founder"],
    primary_outcome: "Meetings",
    offer_category: "outbound_agency" as OfferCategory,
  },
  {
    label: "SDR team",
    what_you_sell: "We help prospects book demos",
    icp_industry: "SaaS",
    icp_company_size: "51-200",
    buyer_roles: ["VP Sales", "RevOps"],
    primary_outcome: "Pipeline",
    offer_category: "sdr_team" as OfferCategory,
  },
  {
    label: "RevOps consulting",
    what_you_sell: "We optimize CRM and sales processes",
    icp_industry: "Technology",
    icp_company_size: "201-1k",
    buyer_roles: ["RevOps", "VP Sales"],
    primary_outcome: "Speed",
    offer_category: "revops_consulting" as OfferCategory,
  },
  {
    label: "Sales engagement platform",
    what_you_sell: "We provide tools for sales outreach at scale",
    icp_industry: "SaaS",
    icp_company_size: "51-200",
    buyer_roles: ["VP Sales", "Marketing"],
    primary_outcome: "Conversion",
    offer_category: "sales_engagement_platform" as OfferCategory,
  },
  {
    label: "Security/compliance",
    what_you_sell: "We help companies meet security standards",
    icp_industry: "Technology",
    icp_company_size: "201-1k",
    buyer_roles: ["VP Sales", "Founder"],
    primary_outcome: "Compliance",
    offer_category: "security_compliance" as OfferCategory,
  },
  {
    label: "B2B SaaS (generic)",
    what_you_sell: "We sell B2B software",
    icp_industry: "Technology",
    icp_company_size: "51-200",
    buyer_roles: ["VP Sales", "Founder"],
    primary_outcome: "Pipeline",
    offer_category: "b2b_saas_generic" as OfferCategory,
  },
];
```

**Step 4: Add schema tables to `src/lib/db/schema.ts`**

Add after the existing `hookCache` table:

```typescript
// ── Workspaces ──

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("My Workspace"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const workspaceProfiles = sqliteTable("workspace_profiles", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  whatYouSell: text("what_you_sell").notNull(),
  icpIndustry: text("icp_industry").notNull(),
  icpCompanySize: text("icp_company_size").notNull(),
  buyerRoles: text("buyer_roles", { mode: "json" }).$type<string[]>().notNull(),
  primaryOutcome: text("primary_outcome").notNull(),
  offerCategory: text("offer_category").notNull(),
  proof: text("proof", { mode: "json" }).$type<string[]>(),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});
```

**Step 5: Run test to verify it passes**

Run: `cd /home/idris/reachwise && npx vitest run src/lib/workspace.test.ts`
Expected: PASS

**Step 6: Generate and apply migration**

Run: `cd /home/idris/reachwise && npx drizzle-kit generate`
Then: `cd /home/idris/reachwise && npx drizzle-kit push`

**Step 7: Commit**

```bash
git add src/lib/workspace.ts src/lib/workspace.test.ts src/lib/db/schema.ts drizzle/
git commit -m "feat: add workspaces + workspace_profiles schema

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Auto-create default workspace on registration

**Files:**
- Modify: `src/app/api/auth/register/route.ts`
- Create: `src/lib/workspace-helpers.ts`

**Step 1: Write the helper module**

```typescript
// src/lib/workspace-helpers.ts
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { SenderContext } from "@/lib/workspace";

/**
 * Get or create default workspace for a user.
 * Returns workspace id.
 */
export async function getOrCreateDefaultWorkspace(userId: string): Promise<string> {
  // Check for existing workspace
  const [existing] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerUserId, userId))
    .limit(1);

  if (existing) return existing.id;

  // Create default workspace
  const [ws] = await db
    .insert(schema.workspaces)
    .values({ ownerUserId: userId, name: "My Workspace" })
    .returning({ id: schema.workspaces.id });

  return ws.id;
}

/**
 * Get workspace profile as SenderContext (or null if not set).
 */
export async function getWorkspaceProfile(workspaceId: string): Promise<SenderContext | null> {
  const [profile] = await db
    .select()
    .from(schema.workspaceProfiles)
    .where(eq(schema.workspaceProfiles.workspaceId, workspaceId))
    .limit(1);

  if (!profile) return null;

  return {
    whatYouSell: profile.whatYouSell,
    icpIndustry: profile.icpIndustry,
    icpCompanySize: profile.icpCompanySize,
    buyerRoles: profile.buyerRoles,
    primaryOutcome: profile.primaryOutcome,
    offerCategory: profile.offerCategory as SenderContext["offerCategory"],
    proof: profile.proof,
  };
}

/**
 * Get profile updatedAt for cache busting.
 */
export async function getProfileUpdatedAt(workspaceId: string): Promise<string | null> {
  const [profile] = await db
    .select({ updatedAt: schema.workspaceProfiles.updatedAt })
    .from(schema.workspaceProfiles)
    .where(eq(schema.workspaceProfiles.workspaceId, workspaceId))
    .limit(1);

  return profile?.updatedAt ?? null;
}

/**
 * Resolve userId → workspaceId (creates default if needed).
 */
export async function resolveWorkspaceId(userId: string): Promise<string> {
  return getOrCreateDefaultWorkspace(userId);
}
```

**Step 2: Add workspace creation to register route**

In `src/app/api/auth/register/route.ts`, after the user insert (line ~66), add:

```typescript
import { getOrCreateDefaultWorkspace } from "@/lib/workspace-helpers";

// After: const [user] = await db.insert(schema.users)...
await getOrCreateDefaultWorkspace(user.id);
```

**Step 3: Commit**

```bash
git add src/lib/workspace-helpers.ts src/app/api/auth/register/route.ts
git commit -m "feat: auto-create default workspace on registration

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Workspace profile API routes

**Files:**
- Create: `src/app/api/workspace-profile/route.ts`

**Step 1: Write the API route**

```typescript
// src/app/api/workspace-profile/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { resolveWorkspaceId, getWorkspaceProfile } from "@/lib/workspace-helpers";
import { OFFER_CATEGORIES } from "@/lib/workspace";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await resolveWorkspaceId(session.user.id);
  const profile = await getWorkspaceProfile(workspaceId);

  return NextResponse.json({ profile, workspaceId });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { whatYouSell, icpIndustry, icpCompanySize, buyerRoles, primaryOutcome, offerCategory, proof } = body;

  // Validate required fields
  if (!whatYouSell?.trim() || !icpIndustry?.trim() || !icpCompanySize?.trim() ||
      !Array.isArray(buyerRoles) || buyerRoles.length === 0 ||
      !primaryOutcome?.trim() || !offerCategory?.trim()) {
    return NextResponse.json(
      { error: "Missing required fields: whatYouSell, icpIndustry, icpCompanySize, buyerRoles, primaryOutcome, offerCategory" },
      { status: 400 },
    );
  }

  // Validate offer category
  if (!OFFER_CATEGORIES.includes(offerCategory)) {
    return NextResponse.json(
      { error: `Invalid offerCategory. Must be one of: ${OFFER_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const workspaceId = await resolveWorkspaceId(session.user.id);
  const now = new Date().toISOString();

  await db
    .insert(schema.workspaceProfiles)
    .values({
      workspaceId,
      whatYouSell: whatYouSell.trim(),
      icpIndustry: icpIndustry.trim(),
      icpCompanySize: icpCompanySize.trim(),
      buyerRoles,
      primaryOutcome: primaryOutcome.trim(),
      offerCategory,
      proof: Array.isArray(proof) ? proof : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.workspaceProfiles.workspaceId,
      set: {
        whatYouSell: whatYouSell.trim(),
        icpIndustry: icpIndustry.trim(),
        icpCompanySize: icpCompanySize.trim(),
        buyerRoles,
        primaryOutcome: primaryOutcome.trim(),
        offerCategory,
        proof: Array.isArray(proof) ? proof : null,
        updatedAt: now,
      },
    });

  return NextResponse.json({ ok: true, updatedAt: now });
}
```

**Step 2: Commit**

```bash
git add src/app/api/workspace-profile/route.ts
git commit -m "feat: workspace profile CRUD API routes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Context Wallet modal component

**Files:**
- Create: `src/components/context-wallet-modal.tsx`

**Step 1: Build the modal**

```typescript
// src/components/context-wallet-modal.tsx
"use client";

import { useState } from "react";
import { PROFILE_PRESETS, OFFER_CATEGORIES } from "@/lib/workspace";

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1k", "1k+"];
const BUYER_ROLE_OPTIONS = ["VP Sales", "RevOps", "Marketing", "Founder", "CTO", "SDR Manager", "Head of Growth", "Other"];
const OUTCOME_OPTIONS = ["Pipeline", "Meetings", "Conversion", "Retention", "Cost", "Risk", "Speed", "Compliance"];

interface ContextWalletModalProps {
  onSave: () => void;
  onClose?: () => void;
  showClose?: boolean;
}

export function ContextWalletModal({ onSave, onClose, showClose = false }: ContextWalletModalProps) {
  const [whatYouSell, setWhatYouSell] = useState("");
  const [icpIndustry, setIcpIndustry] = useState("");
  const [icpCompanySize, setIcpCompanySize] = useState("");
  const [buyerRoles, setBuyerRoles] = useState<string[]>([]);
  const [primaryOutcome, setPrimaryOutcome] = useState("");
  const [offerCategory, setOfferCategory] = useState("");
  const [proof, setProof] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function applyPreset(index: number) {
    const p = PROFILE_PRESETS[index];
    setWhatYouSell(p.what_you_sell);
    setIcpIndustry(p.icp_industry);
    setIcpCompanySize(p.icp_company_size);
    setBuyerRoles([...p.buyer_roles]);
    setPrimaryOutcome(p.primary_outcome);
    setOfferCategory(p.offer_category);
  }

  function toggleRole(role: string) {
    setBuyerRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSave() {
    if (!whatYouSell.trim() || !icpIndustry.trim() || !icpCompanySize ||
        buyerRoles.length === 0 || !primaryOutcome || !offerCategory) {
      setError("Please fill in all required fields.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/workspace-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatYouSell: whatYouSell.trim(),
          icpIndustry: icpIndustry.trim(),
          icpCompanySize,
          buyerRoles,
          primaryOutcome,
          offerCategory,
          proof: proof.trim() ? proof.split("\n").map((l) => l.trim()).filter(Boolean) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      onSave();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const isValid = whatYouSell.trim() && icpIndustry.trim() && icpCompanySize &&
    buyerRoles.length > 0 && primaryOutcome && offerCategory;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-zinc-100">Add your 60-second profile</h2>
          <p className="text-sm text-zinc-400 mt-1">
            To generate hooks that connect the prospect&apos;s signal to YOUR offer, we need a little context.
          </p>
        </div>

        {/* Preset selector */}
        <div className="mb-5">
          <label className="block text-xs text-zinc-500 mb-1.5">Start from a template</label>
          <select
            onChange={(e) => e.target.value && applyPreset(Number(e.target.value))}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-600"
            defaultValue=""
          >
            <option value="">Choose a preset...</option>
            {PROFILE_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* What you sell */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-1">What do you sell? *</label>
          <textarea
            value={whatYouSell}
            onChange={(e) => setWhatYouSell(e.target.value)}
            placeholder="Example: We help B2B teams book more meetings by generating evidence-backed outbound hooks."
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 min-h-[60px]"
          />
          <p className="text-xs text-zinc-600 mt-0.5">One sentence. What you do + who it&apos;s for + the outcome.</p>
        </div>

        {/* ICP Industry */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-1">Who do you sell to? *</label>
          <input
            type="text"
            value={icpIndustry}
            onChange={(e) => setIcpIndustry(e.target.value)}
            placeholder="e.g., SaaS, FinTech, Healthcare, B2B Services"
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Company size */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-1">Company size *</label>
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setIcpCompanySize(size)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  icpCompanySize === size
                    ? "bg-emerald-900/50 border-emerald-700 text-emerald-300"
                    : "bg-black border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Buyer roles */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-1">Buyer role(s) *</label>
          <div className="flex flex-wrap gap-2">
            {BUYER_ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  buyerRoles.includes(role)
                    ? "bg-emerald-900/50 border-emerald-700 text-emerald-300"
                    : "bg-black border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        {/* Primary outcome */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-1">What outcome do you drive? *</label>
          <div className="flex flex-wrap gap-2">
            {OUTCOME_OPTIONS.map((outcome) => (
              <button
                key={outcome}
                type="button"
                onClick={() => setPrimaryOutcome(outcome)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  primaryOutcome === outcome
                    ? "bg-emerald-900/50 border-emerald-700 text-emerald-300"
                    : "bg-black border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {outcome}
              </button>
            ))}
          </div>
        </div>

        {/* Offer category */}
        <div className="mb-4">
          <label className="block text-sm text-zinc-300 mb-1">Offer category *</label>
          <select
            value={offerCategory}
            onChange={(e) => setOfferCategory(e.target.value)}
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-emerald-600"
          >
            <option value="">Select...</option>
            {OFFER_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Proof */}
        <div className="mb-6">
          <label className="block text-sm text-zinc-300 mb-1">Any proof? (optional)</label>
          <textarea
            value={proof}
            onChange={(e) => setProof(e.target.value)}
            placeholder="Examples: 'Used by X', '+22% reply rate', 'SOC2', or 'No proof yet'"
            className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-600 min-h-[50px]"
          />
          <p className="text-xs text-zinc-600 mt-0.5">1-2 bullets max. One per line.</p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 px-3 py-2 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
          {showClose && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/context-wallet-modal.tsx
git commit -m "feat: context wallet modal component with presets

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Context Gate component + integrate into hooks page

**Files:**
- Create: `src/components/context-gate.tsx`
- Modify: `src/app/app/hooks/page.tsx`

**Step 1: Build the context gate wrapper**

```typescript
// src/components/context-gate.tsx
"use client";

import { useState } from "react";
import { ContextWalletModal } from "./context-wallet-modal";

interface ContextGateProps {
  hasProfile: boolean;
  onProfileSaved: () => void;
  children: React.ReactNode;
}

export function ContextGate({ hasProfile, onProfileSaved, children }: ContextGateProps) {
  const [showModal, setShowModal] = useState(false);

  if (hasProfile) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto transition-colors"
        title="Add profile to copy"
      >
        Copy
      </button>
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-bold text-zinc-100 mb-2">
              Make these hooks about YOU (not generic)
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Right now we can see the prospect&apos;s signal, but we don&apos;t know what you sell.
              Add your 60-second profile to connect the signal to your offer.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="text-xs text-zinc-600 hover:text-zinc-400 absolute top-4 right-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {showModal && (
        <ContextWalletModal
          onSave={() => {
            setShowModal(false);
            onProfileSaved();
          }}
        />
      )}
    </>
  );
}
```

**Step 2: Integrate into hooks page**

Modify `src/app/app/hooks/page.tsx`:

1. Add state: `const [hasProfile, setHasProfile] = useState(false);`
2. Add state: `const [showProfileModal, setShowProfileModal] = useState(false);`
3. Add useEffect to check profile on mount:
```typescript
useEffect(() => {
  fetch("/api/workspace-profile")
    .then((r) => r.json())
    .then((data) => setHasProfile(!!data.profile))
    .catch(() => {});
}, []);
```
4. Replace the Copy button (line ~218-224) with gated version:
```typescript
{hasProfile ? (
  <button
    onClick={() => copyHook(hook.text, i)}
    className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto transition-colors"
    title="Copy hook"
  >
    {copied === i ? "Copied!" : "Copy"}
  </button>
) : (
  <button
    onClick={() => setShowProfileModal(true)}
    className="text-xs text-zinc-500 hover:text-zinc-300 ml-auto transition-colors"
    title="Add profile to copy hooks"
  >
    Copy
  </button>
)}
```
5. Add profile hint banner below hooks when no profile:
```typescript
{hooks.length > 0 && !hasProfile && (
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-4 py-3 mt-4 text-sm text-zinc-400">
    Want hooks that connect to your pitch?{" "}
    <button
      onClick={() => setShowProfileModal(true)}
      className="text-emerald-400 hover:text-emerald-300 underline"
    >
      Add your 60-second profile
    </button>
    .
  </div>
)}
```
6. Add modal render at bottom of component:
```typescript
{showProfileModal && (
  <ContextWalletModal
    onSave={() => {
      setShowProfileModal(false);
      setHasProfile(true);
    }}
    onClose={() => setShowProfileModal(false)}
    showClose
  />
)}
```

**Step 3: Commit**

```bash
git add src/components/context-gate.tsx src/app/app/hooks/page.tsx
git commit -m "feat: context gate on copy + profile hint banner on hooks page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Add profile section to settings page

**Files:**
- Modify: `src/app/app/settings/page.tsx`

**Step 1: Add profile editing section**

Add a new `ProfileSection` component to the settings page that:
1. Fetches the current profile on mount via `GET /api/workspace-profile`
2. Shows the same form fields as the modal (reuse constants from `@/lib/workspace`)
3. Pre-fills with current values
4. Saves via `POST /api/workspace-profile`
5. Shows "Last updated: {date}" below the form

Insert `<ProfileSection />` as the FIRST section in the settings page (before API Keys).

**Step 2: Commit**

```bash
git add src/app/app/settings/page.tsx
git commit -m "feat: sender profile editing in settings page

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: Inject sender context into hook generation prompt

**Files:**
- Modify: `src/lib/hooks.ts` (buildSystemPrompt, buildUserPrompt)
- Modify: `src/app/api/generate-hooks/route.ts`

**Step 1: Write failing tests for sender context injection**

```typescript
// Add to src/lib/hooks.test.ts
describe("sender context prompt injection", () => {
  it("buildSystemPrompt includes SENDER CONTEXT section when provided", () => {
    const ctx: SenderContext = {
      whatYouSell: "We help B2B teams book more meetings",
      icpIndustry: "SaaS",
      icpCompanySize: "51-200",
      buyerRoles: ["VP Sales"],
      primaryOutcome: "Meetings",
      offerCategory: "outbound_agency",
      proof: ["+22% reply rate"],
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("SENDER CONTEXT");
    expect(prompt).toContain("We help B2B teams book more meetings");
    expect(prompt).toContain("at most ONE relevance bridge sentence");
  });

  it("buildSystemPrompt uses verification-only mode when no sender context", () => {
    const prompt = buildSystemPrompt(null);
    expect(prompt).toContain("verification-only");
    expect(prompt).not.toContain("SENDER CONTEXT");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/idris/reachwise && npx vitest run src/lib/hooks.test.ts`
Expected: FAIL

**Step 3: Modify `buildSystemPrompt` to accept optional `SenderContext`**

Change signature: `export function buildSystemPrompt(senderContext?: SenderContext | null): string`

When `senderContext` is provided, append this section before the output format:

```
## SENDER CONTEXT
The sender sells: {whatYouSell}
ICP: {icpIndustry}, {icpCompanySize} employees, targeting {buyerRoles.join(", ")}
Primary outcome: {primaryOutcome}
Category: {offerCategory}
{proof ? "Proof points: " + proof.join("; ") : ""}

## RELEVANCE BRIDGE RULES (only when sender context is provided)
- Add at most ONE sentence tying the prospect's signal to the sender's outcome.
- Template: "[Signal verb] + [prospect noun] — [sender outcome] for [buyer role]. [Binary question]?"
- Max 80 characters for the bridge portion.
- Never name the sender's product. Reference their outcome category only.
- Never claim "we help teams like you" or similar generic framing.
- The bridge must follow logically from the evidence. If no natural connection exists, omit it.
```

When `senderContext` is null, append:

```
## VERIFICATION-ONLY MODE
Do NOT reference the sender's product or offer. Generate signal-verification hooks only.
Do NOT attempt a relevance bridge sentence.
Hooks should verify the prospect's signal and ask a narrow operational question.
```

**Step 4: Modify the API route to pass sender context**

In `src/app/api/generate-hooks/route.ts`:
1. Import `auth` from `@/lib/auth`
2. Import `resolveWorkspaceId`, `getWorkspaceProfile` from `@/lib/workspace-helpers`
3. After session check, resolve workspace and get profile
4. Pass profile to `buildSystemPrompt(senderContext)`

```typescript
// Near the top, after API key checks
let senderContext: SenderContext | null = null;
const session = await auth();
if (session?.user?.id) {
  try {
    const wsId = await resolveWorkspaceId(session.user.id);
    senderContext = await getWorkspaceProfile(wsId);
  } catch { /* proceed without context */ }
}

// In the generation block, change:
const systemPrompt = buildSystemPrompt(senderContext);
```

**Step 5: Run tests**

Run: `cd /home/idris/reachwise && npx vitest run src/lib/hooks.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/hooks.ts src/lib/hooks.test.ts src/app/api/generate-hooks/route.ts
git commit -m "feat: inject sender context into hook generation prompt

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: Add question quality + attribution + causality validators

**Files:**
- Modify: `src/lib/hooks.ts` (validateHook / publishGateFinal)
- Modify: `src/lib/hooks.test.ts`

**Step 1: Write failing tests for new validators**

```typescript
describe("question quality — objective constraints", () => {
  it("rejects hook with 3+ abstract nouns in question", () => {
    const hook = makeHook('Your site says "X" — is your compliance engagement methodology positioning aligned?');
    expect(validateHook(hook)).toBeNull();
  });

  it("rejects hook with 'focusing on' framing", () => {
    const hook = makeHook('Your site says "X" — are you focusing on growth or retention?');
    expect(validateHook(hook)).toBeNull();
  });

  it("rejects hook asking about strategy/approach", () => {
    const hook = makeHook('Your site says "X" — what\'s your approach to outbound?');
    expect(validateHook(hook)).toBeNull();
  });

  it("passes binary question", () => {
    const hook = makeHook('Your site says "X" — still using Salesforce for that?');
    expect(validateHook(hook)).not.toBeNull();
  });
});

describe("evidence attribution", () => {
  it("rejects unattributed 5+ word paraphrase", () => {
    const hook = makeHook("You help B2B teams book more meetings — outbound or inbound?");
    // No quotes around the paraphrase
    expect(validateHook(hook)).toBeNull();
  });

  it("passes attributed quote", () => {
    const hook = makeHook('Your site says "help B2B teams book more meetings" — outbound or inbound?');
    expect(validateHook(hook)).not.toBeNull();
  });
});

describe("invented causality ban", () => {
  it("rejects 'the usual bottleneck is'", () => {
    const hook = makeHook('You posted "3 SDR roles" — the usual bottleneck is hiring. Backfilling or expanding?');
    expect(validateHook(hook)).toBeNull();
  });

  it("rejects 'most teams struggle with'", () => {
    const hook = makeHook('You said "scaling fast" — most teams struggle with onboarding. You too?');
    expect(validateHook(hook)).toBeNull();
  });

  it("rejects 'typically this means'", () => {
    const hook = makeHook('You posted "new CTO hire" — typically this means a stack change. Swapping tools?');
    expect(validateHook(hook)).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/idris/reachwise && npx vitest run src/lib/hooks.test.ts`

**Step 3: Implement validators**

Add to `src/lib/hooks.ts`:

**Invented causality patterns** (add to constants section):
```typescript
const INVENTED_CAUSALITY_PATTERNS = [
  /\bthe usual bottleneck is\b/i,
  /\btypically this means\b/i,
  /\bmost teams struggle with\b/i,
  /\bdisconnected systems\b/i,
  /\bthe challenge is\b/i,
  /\bthe problem is usually\b/i,
  /\bcommonly leads to\b/i,
  /\boften results in\b/i,
];
```

**Abstract nouns list** (for question quality):
```typescript
const ABSTRACT_NOUNS = [
  "compliance", "engagement", "methodology", "positioning", "strategy",
  "alignment", "optimization", "transformation", "enablement", "governance",
  "framework", "paradigm", "synergy", "ecosystem", "philosophy",
];
```

**Question framing bans:**
```typescript
const QUESTION_FRAMING_BANS = [
  /\bfocusing on\b/i,
  /\bdriven by\b/i,
  /\bwhat'?s your (approach|strategy|philosophy)\b/i,
  /\bhow are you (thinking|approaching)\b/i,
];
```

Update `validateHook()` to include:
1. Invented causality check: if any `INVENTED_CAUSALITY_PATTERNS` match → null
2. Question framing bans: if question part matches any `QUESTION_FRAMING_BANS` → null
3. Abstract noun count: if question part contains 3+ words from `ABSTRACT_NOUNS` → null

**Step 4: Run tests**

Run: `cd /home/idris/reachwise && npx vitest run src/lib/hooks.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/hooks.ts src/lib/hooks.test.ts
git commit -m "feat: objective question quality + causality + attribution validators

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: Cache busting tied to profile updatedAt

**Files:**
- Modify: `src/lib/db/schema.ts` (add column to hookCache)
- Modify: `src/lib/hook-cache.ts`
- Modify: `src/app/api/generate-hooks/route.ts`

**Step 1: Add `profileUpdatedAt` column to hookCache schema**

In `src/lib/db/schema.ts`, add to `hookCache`:
```typescript
profileUpdatedAt: text("profile_updated_at"),
```

**Step 2: Run migration**

Run: `cd /home/idris/reachwise && npx drizzle-kit generate && npx drizzle-kit push`

**Step 3: Update `hook-cache.ts`**

Modify `getCachedHooks` to accept and check `profileUpdatedAt`:
```typescript
export async function getCachedHooks(url: string, currentProfileUpdatedAt?: string | null) {
  const urlHash = await hashUrl(url);
  const [cached] = await db
    .select()
    .from(schema.hookCache)
    .where(eq(schema.hookCache.urlHash, urlHash))
    .limit(1);

  if (!cached) return null;
  if (new Date(cached.expiresAt) < new Date()) {
    await db.delete(schema.hookCache).where(eq(schema.hookCache.id, cached.id));
    return null;
  }

  // Cache bust: profile changed since this cache entry was created
  const cachedProfileAt = (cached as any).profileUpdatedAt as string | null;
  if (currentProfileUpdatedAt && cachedProfileAt !== currentProfileUpdatedAt) {
    return null; // stale — profile changed
  }
  if (!currentProfileUpdatedAt && cachedProfileAt) {
    return null; // profile was removed
  }

  return { hooks: cached.hooks, citations: cached.citations };
}
```

Modify `setCachedHooks` to store `profileUpdatedAt`:
```typescript
export async function setCachedHooks(
  url: string,
  hooks: unknown,
  citations: unknown,
  profileUpdatedAt?: string | null,
) {
  const urlHash = await hashUrl(url);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await db
    .insert(schema.hookCache)
    .values({ urlHash, url, hooks, citations, expiresAt, profileUpdatedAt: profileUpdatedAt ?? null })
    .onConflictDoUpdate({
      target: schema.hookCache.urlHash,
      set: { hooks, citations, expiresAt, createdAt: new Date().toISOString(), profileUpdatedAt: profileUpdatedAt ?? null },
    });
}
```

**Step 4: Update API route to pass profile timestamps**

In `src/app/api/generate-hooks/route.ts`:
1. Get `profileUpdatedAt` alongside `senderContext`
2. Pass to `getCachedHooks(url, profileUpdatedAt)`
3. Pass to `setCachedHooks(url, finalHooks, citations, profileUpdatedAt)`

**Step 5: Commit**

```bash
git add src/lib/db/schema.ts src/lib/hook-cache.ts src/app/api/generate-hooks/route.ts drizzle/
git commit -m "feat: cache busting on workspace profile changes

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: VoltAgent thin wrapper

**Files:**
- Create: `src/lib/voltagent/agent.ts`
- Create: `src/lib/voltagent/tools.ts`

**Step 1: Create the tools wrapper**

```typescript
// src/lib/voltagent/tools.ts
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { generateHooksForUrl } from "@/lib/hooks";
import { fetchSourcesWithGating } from "@/lib/hooks";

export const generateHooksTool = createTool({
  name: "generate_hooks",
  description: "Generate evidence-backed cold email hooks for a prospect URL",
  parameters: z.object({
    url: z.string().url().describe("The prospect company URL"),
    senderContext: z.object({
      whatYouSell: z.string(),
      primaryOutcome: z.string(),
      offerCategory: z.string(),
    }).optional().describe("Optional sender context for relevance"),
  }),
  execute: async ({ url }) => {
    const braveApiKey = process.env.BRAVE_API_KEY!;
    const claudeApiKey = process.env.CLAUDE_API_KEY!;
    const result = await generateHooksForUrl(url, braveApiKey, claudeApiKey);
    return result;
  },
});

export const fetchSourcesTool = createTool({
  name: "fetch_sources",
  description: "Research a company URL and return classified evidence sources",
  parameters: z.object({
    url: z.string().url().describe("The company URL to research"),
  }),
  execute: async ({ url }) => {
    const braveApiKey = process.env.BRAVE_API_KEY!;
    const result = await fetchSourcesWithGating(url, braveApiKey);
    return result;
  },
});
```

**Step 2: Create the agent**

```typescript
// src/lib/voltagent/agent.ts
import { Agent, VoltAgent } from "@voltagent/core";
import { VercelAIProvider } from "@voltagent/vercel-ai"; // if available
import { HonoServer } from "@voltagent/server-hono";
import { generateHooksTool, fetchSourcesTool } from "./tools";

// Only initialize if CLAUDE_API_KEY is set (avoids errors in test/build)
export function initVoltAgent() {
  if (!process.env.CLAUDE_API_KEY) return null;

  const hookAgent = new Agent({
    name: "hook-generator",
    description: "Generates evidence-backed cold email hooks for B2B outbound",
    tools: [generateHooksTool, fetchSourcesTool],
  });

  return new VoltAgent({
    agents: { hookAgent },
    server: new HonoServer({ port: 3141 }),
  });
}
```

Note: The VoltAgent provider setup depends on the exact API of `@voltagent/core` v2.6.4. Check the actual exports and adjust. The key constraint is: thin wrapper, no extra agent roles.

**Step 3: Commit**

```bash
git add src/lib/voltagent/
git commit -m "feat: thin VoltAgent wrapper for hook generation pipeline

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end verification

**Step 1: Run full test suite**

Run: `cd /home/idris/reachwise && npx vitest run`
Expected: ALL PASS

**Step 2: Start dev server and manually test**

Run: `cd /home/idris/reachwise && npm run dev`

Test flow:
1. Log in -> go to /app/hooks
2. Generate hooks for a URL (should work without profile — demo mode)
3. Click "Copy" -> should show Context Gate modal
4. Fill in profile (try a preset) -> Save
5. "Copy" should now work
6. Go to /app/settings -> verify profile section shows saved data
7. Edit profile -> regenerate hooks for same URL -> should get new hooks (cache busted)

**Step 3: Verify migration**

Run: `cd /home/idris/reachwise && npx drizzle-kit push`
Confirm: workspaces, workspace_profiles tables created; hookCache has profile_updated_at column

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: end-to-end verification complete

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary of files changed/created

### New files:
- `src/lib/workspace.ts` — types, constants, presets
- `src/lib/workspace.test.ts` — workspace constant tests
- `src/lib/workspace-helpers.ts` — DB helpers (resolve workspace, get profile)
- `src/app/api/workspace-profile/route.ts` — profile CRUD API
- `src/components/context-wallet-modal.tsx` — profile creation modal
- `src/components/context-gate.tsx` — copy/export gating component
- `src/lib/voltagent/agent.ts` — thin VoltAgent wrapper
- `src/lib/voltagent/tools.ts` — VoltAgent tool definitions

### Modified files:
- `src/lib/db/schema.ts` — add workspaces, workspace_profiles tables + hookCache.profileUpdatedAt
- `src/app/api/auth/register/route.ts` — create default workspace on registration
- `src/app/app/hooks/page.tsx` — integrate context gate + profile hint
- `src/app/app/settings/page.tsx` — add profile editing section
- `src/lib/hooks.ts` — sender context in prompt, new validators
- `src/lib/hooks.test.ts` — new test suites for sender context + validators
- `src/lib/hook-cache.ts` — profile-aware cache busting
- `src/app/api/generate-hooks/route.ts` — pass sender context + profile timestamps
