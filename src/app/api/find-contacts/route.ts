import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

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

export async function POST(request: NextRequest) {
  // 1. Auth guard
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Tier gate
  const tierId = (session?.user as any)?.tierId;
  if (tierId !== "pro" && tierId !== "concierge") {
    return NextResponse.json(
      { error: "Upgrade to Pro or Concierge to find contacts.", code: "UPGRADE_REQUIRED" },
      { status: 403 },
    );
  }

  // 3. Parse body
  let domain: string;
  try {
    const body = await request.json();
    domain = (body.domain ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  // Strip https:// and trailing slash
  domain = domain.replace(/^https?:\/\//i, "").replace(/\/$/, "");

  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "Missing or invalid domain." }, { status: 400 });
  }

  // 4. Apify token check
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Apify token not configured." }, { status: 503 });
  }

  // 5. Apify call
  let apifyItems: ApifyLead[] = [];
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/blitzapi~linkedin-leads-scraper/run-sync-get-dataset-items?timeout=30`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ domain, maxLeads: 20 }),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (res.ok) {
      apifyItems = (await res.json()) as ApifyLead[];
    } else {
      return NextResponse.json({ error: "Contact lookup service unavailable. Please try again." }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Contact lookup timed out. Please try again." }, { status: 502 });
  }

  // 6. Filter valid leads
  const validLeads = apifyItems.filter(
    (item) => typeof item.email === "string" && item.email.includes("@"),
  );

  // 7. Insert into leads table
  let created = 0;
  let skipped = 0;
  const insertedLeads: typeof validLeads = [];

  try {
    for (const lead of validLeads) {
      const email = lead.email!.trim().toLowerCase();
      const name =
        [lead.firstName, lead.lastName].filter(Boolean).join(" ") || null;

      const values = {
        userId: session.user.id,
        email,
        name,
        title: lead.title || lead.headline || null,
        companyName: lead.companyName || null,
        companyWebsite: lead.companyWebsite || `https://${domain}`,
        linkedinUrl: lead.linkedinUrl || null,
        source: "apify-linkedin" as const,
      };

      try {
        await db.insert(schema.leads).values(values);
        created++;
        insertedLeads.push(lead);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("UNIQUE")) {
          skipped++;
        } else {
          // Unexpected DB error — surface it
          throw err;
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "Failed to save contacts." }, { status: 500 });
  }

  // 8. Return
  return NextResponse.json({ leads: insertedLeads, created, skipped });
}
