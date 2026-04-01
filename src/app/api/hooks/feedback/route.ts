import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordHookOutcome, type HookFeedbackEvent } from "@/lib/hook-feedback";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    hookId?: string;
    event?: HookFeedbackEvent;
    metadata?: Record<string, unknown>;
  };

  if (!body.hookId || !body.event) {
    return NextResponse.json({ error: "hookId and event are required" }, { status: 400 });
  }

  const result = await recordHookOutcome({
    hookId: body.hookId,
    userId: session.user.id,
    event: body.event,
    metadata: body.metadata,
  });

  if (!result.ok) {
    return NextResponse.json({ error: "Hook not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
