import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { recordHookOutcome } from "@/lib/hook-feedback";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { hookId?: string };
  if (!body.hookId) {
    return NextResponse.json({ error: "hookId required" }, { status: 400 });
  }

  // Ownership check
  const [hook] = await db
    .select()
    .from(schema.generatedHooks)
    .where(and(
      eq(schema.generatedHooks.id, body.hookId),
      eq(schema.generatedHooks.userId, session.user.id),
    ))
    .limit(1);

  if (!hook) {
    return NextResponse.json({ error: "Hook not found" }, { status: 404 });
  }

  // Insert shared hook (omit companyName/companyUrl to prevent doxing)
  const [shared] = await db
    .insert(schema.sharedHooks)
    .values({
      hookText: hook.hookText,
      sourceTitle: hook.sourceTitle ?? null,
      sourceUrl: hook.sourceUrl ?? null,
      sourceSnippet: hook.sourceSnippet ?? null,
      evidenceTier: hook.evidenceTier,
      triggerType: hook.triggerType ?? null,
      promise: hook.promise ?? null,
      bridgeQuality: hook.bridgeQuality ?? null,
      angle: hook.angle,
      targetCompanyName: hook.companyName ?? null,
    })
    .returning({ id: schema.sharedHooks.id });

  const shareId = shared.id;
  const baseUrl = process.env.NEXTAUTH_URL || "https://getsignalhooks.com";
  const shareUrl = `${baseUrl}/h/${shareId}`;

  await recordHookOutcome({
    hookId: body.hookId,
    userId: session.user.id,
    event: "shared",
    metadata: { shareId },
  }).catch(() => {});

  return NextResponse.json({ shareId, shareUrl });
}
