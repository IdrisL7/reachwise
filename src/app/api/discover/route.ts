import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkDiscoveryQuota, checkFeature, featureError } from "@/lib/tier-guard";
import { discoverCompanies, type DiscoveryCriteria } from "@/lib/discovery";
import { db, schema } from "@/lib/db";
import { and, eq, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searches = await db
      .select({
        id: schema.discoverySearches.id,
        name: schema.discoverySearches.name,
        criteria: schema.discoverySearches.criteria,
        resultCount: schema.discoverySearches.resultCount,
        createdAt: schema.discoverySearches.createdAt,
      })
      .from(schema.discoverySearches)
      .where(eq(schema.discoverySearches.userId, session.user.id))
      .orderBy(desc(schema.discoverySearches.createdAt))
      .limit(20);

    return NextResponse.json(searches);
  } catch (error) {
    console.error("/api/discover GET failed", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.searchId || typeof body.name !== "string") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await db
      .update(schema.discoverySearches)
      .set({ name: body.name })
      .where(and(
        eq(schema.discoverySearches.id, body.searchId),
        eq(schema.discoverySearches.userId, session.user.id),
      ));

    if (!result.rowsAffected) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/discover PATCH failed", error);
    return NextResponse.json({ error: "Failed to save search" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimited = await checkRateLimit(getClientIp(request), "auth:discover");
    if (rateLimited) return rateLimited;

    const tierId = ((session.user as any).tierId || "free") as "free" | "pro";
    if (!checkFeature(tierId, "leadDiscovery")) {
      return featureError("Lead Discovery");
    }

    const quotaError = await checkDiscoveryQuota(session.user.id);
    if (quotaError) return quotaError;

    const body = (await request.json().catch(() => null)) as DiscoveryCriteria | null;
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const exaApiKey = process.env.EXA_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (!exaApiKey || !claudeApiKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const result = await discoverCompanies(body, session.user.id, exaApiKey, claudeApiKey, 20);
    return NextResponse.json(result);
  } catch (error) {
    console.error("/api/discover POST failed", error);
    return NextResponse.json({ error: "Failed to discover companies" }, { status: 500 });
  }
}
