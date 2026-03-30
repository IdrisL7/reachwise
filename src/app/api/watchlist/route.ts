import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { getDomain } from "@/lib/hooks";
import { TIERS } from "@/lib/tiers";

const WATCHLIST_CAPS: Record<string, number> = {
  free: 0, // locked
  pro: 100,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await db
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.userId, session.user.id))
    .orderBy(schema.watchlist.addedAt);

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tierId = (session.user as any).tierId || "free";
  const cap = WATCHLIST_CAPS[tierId] ?? 0;

  if (cap === 0) {
    return NextResponse.json(
      { error: "Watchlist is available on the Pro plan." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    companyName?: string;
    domain?: string;
  } | null;

  const companyName = body?.companyName?.trim();
  const rawDomain = body?.domain?.trim();

  if (!companyName && !rawDomain) {
    return NextResponse.json(
      { error: "Provide companyName or domain." },
      { status: 400 },
    );
  }

  // Resolve domain from either field
  let domain = rawDomain || "";
  if (!domain && companyName) {
    // Try to extract domain from companyName if it looks like a URL
    try {
      domain = getDomain(companyName.includes(".") ? companyName : `https://${companyName}.com`);
    } catch {
      domain = companyName.toLowerCase().replace(/\s+/g, "") + ".com";
    }
  } else if (domain) {
    try {
      domain = getDomain(domain.startsWith("http") ? domain : `https://${domain}`);
    } catch {
      // keep raw
    }
  }

  const name = companyName || domain;

  // Check cap
  const existing = await db
    .select({ id: schema.watchlist.id })
    .from(schema.watchlist)
    .where(eq(schema.watchlist.userId, session.user.id));

  if (existing.length >= cap) {
    return NextResponse.json(
      { error: `Watchlist limit of ${cap} companies reached for your plan.` },
      { status: 403 },
    );
  }

  // Check for duplicate domain
  const duplicate = await db
    .select({ id: schema.watchlist.id })
    .from(schema.watchlist)
    .where(
      and(
        eq(schema.watchlist.userId, session.user.id),
        eq(schema.watchlist.domain, domain),
      ),
    )
    .limit(1);

  if (duplicate.length > 0) {
    return NextResponse.json(
      { error: "This company is already in your watchlist." },
      { status: 409 },
    );
  }

  const [entry] = await db
    .insert(schema.watchlist)
    .values({
      userId: session.user.id,
      companyName: name,
      domain,
    })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
}
