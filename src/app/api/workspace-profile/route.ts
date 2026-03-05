import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/workspace-helpers";
import { OFFER_CATEGORIES, type OfferCategory } from "@/lib/workspace";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await resolveWorkspaceId(session.user.id);

  const [profile] = await db
    .select()
    .from(schema.workspaceProfiles)
    .where(
      eq(schema.workspaceProfiles.workspaceId, workspaceId),
    )
    .limit(1);

  return NextResponse.json({ profile: profile ?? null, workspaceId });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const whatYouSell = typeof body.whatYouSell === "string" ? body.whatYouSell.trim() : "";
  const icpIndustry = typeof body.icpIndustry === "string" ? body.icpIndustry.trim() : "";
  const icpCompanySize = typeof body.icpCompanySize === "string" ? body.icpCompanySize.trim() : "";
  const buyerRoles = Array.isArray(body.buyerRoles) ? body.buyerRoles.filter((r): r is string => typeof r === "string" && r.trim().length > 0) : [];
  const primaryOutcome = typeof body.primaryOutcome === "string" ? body.primaryOutcome.trim() : "";
  const offerCategory = typeof body.offerCategory === "string" ? body.offerCategory.trim() : "";
  const proof = Array.isArray(body.proof) ? body.proof.filter((p): p is string => typeof p === "string" && p.trim().length > 0) : undefined;

  // Validate required fields
  if (!whatYouSell || !icpIndustry || !icpCompanySize || buyerRoles.length === 0 || !primaryOutcome || !offerCategory) {
    return NextResponse.json(
      { error: "Missing required fields: whatYouSell, icpIndustry, icpCompanySize, buyerRoles (non-empty array), primaryOutcome, offerCategory." },
      { status: 400 },
    );
  }

  if (!OFFER_CATEGORIES.includes(offerCategory as OfferCategory)) {
    return NextResponse.json(
      { error: `Invalid offerCategory. Must be one of: ${OFFER_CATEGORIES.join(", ")}` },
      { status: 400 },
    );
  }

  const workspaceId = await resolveWorkspaceId(session.user.id);
  const updatedAt = new Date().toISOString();

  await db
    .insert(schema.workspaceProfiles)
    .values({
      workspaceId,
      whatYouSell,
      icpIndustry,
      icpCompanySize,
      buyerRoles,
      primaryOutcome,
      offerCategory,
      proof: proof ?? null,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.workspaceProfiles.workspaceId,
      set: {
        whatYouSell,
        icpIndustry,
        icpCompanySize,
        buyerRoles,
        primaryOutcome,
        offerCategory,
        proof: proof ?? null,
        updatedAt,
      },
    });

  return NextResponse.json({ ok: true, updatedAt });
}
