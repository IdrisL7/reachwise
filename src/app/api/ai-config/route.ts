import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/workspace-helpers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaceId = await resolveWorkspaceId(session.user.id);

  const [profile] = await db
    .select({
      whatYouSell: schema.workspaceProfiles.whatYouSell,
      primaryOutcome: schema.workspaceProfiles.primaryOutcome,
      voiceTone: schema.workspaceProfiles.voiceTone,
    })
    .from(schema.workspaceProfiles)
    .where(eq(schema.workspaceProfiles.workspaceId, workspaceId))
    .limit(1);

  return NextResponse.json({
    companyDescription: profile?.whatYouSell ?? "",
    primaryKpi: profile?.primaryOutcome ?? "",
    voiceTone: profile?.voiceTone ?? "",
  });
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

  const companyDescription = typeof body.companyDescription === "string" ? body.companyDescription.trim() : null;
  const primaryKpi = typeof body.primaryKpi === "string" ? body.primaryKpi.trim() : null;
  const voiceTone = typeof body.voiceTone === "string" ? body.voiceTone.trim() : null;

  if (!companyDescription || !primaryKpi) {
    return NextResponse.json({ error: "companyDescription and primaryKpi are required." }, { status: 400 });
  }

  const workspaceId = await resolveWorkspaceId(session.user.id);
  const updatedAt = new Date().toISOString();

  // Load existing profile to preserve other required fields
  const [existing] = await db
    .select()
    .from(schema.workspaceProfiles)
    .where(eq(schema.workspaceProfiles.workspaceId, workspaceId))
    .limit(1);

  await db
    .insert(schema.workspaceProfiles)
    .values({
      workspaceId,
      whatYouSell: companyDescription,
      icpIndustry: existing?.icpIndustry ?? "Technology",
      icpCompanySize: existing?.icpCompanySize ?? "50-500",
      buyerRoles: existing?.buyerRoles ?? ["VP Sales", "SDR Manager"],
      primaryOutcome: primaryKpi,
      offerCategory: existing?.offerCategory ?? "b2b_saas_generic",
      proof: existing?.proof ?? null,
      voiceTone: voiceTone || null,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.workspaceProfiles.workspaceId,
      set: {
        whatYouSell: companyDescription,
        primaryOutcome: primaryKpi,
        voiceTone: voiceTone || null,
        updatedAt,
      },
    });

  return NextResponse.json({ ok: true });
}
