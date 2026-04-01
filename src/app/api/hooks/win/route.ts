import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
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

  // Verify ownership
  const [hook] = await db
    .select({ id: schema.generatedHooks.id })
    .from(schema.generatedHooks)
    .where(and(
      eq(schema.generatedHooks.id, body.hookId),
      eq(schema.generatedHooks.userId, session.user.id),
    ))
    .limit(1);

  if (!hook) {
    return NextResponse.json({ error: "Hook not found" }, { status: 404 });
  }

  await db.insert(schema.usageEvents).values({
    userId: session.user.id,
    event: "hook_generated", // closest available enum; tracks the win moment
    metadata: { hookId: body.hookId, type: "reply_win" },
  });

  await recordHookOutcome({
    hookId: body.hookId,
    userId: session.user.id,
    event: "reply_win",
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
