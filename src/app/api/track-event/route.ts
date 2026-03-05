import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await request.json();
    const event = typeof body.event === "string" ? body.event.trim() : null;
    if (!event) return NextResponse.json({ ok: true });

    await db.insert(schema.usageEvents).values({
      userId: session.user.id,
      event,
      metadata: body.metadata ?? null,
    });
  } catch {
    // Non-critical — don't fail the client
  }

  return NextResponse.json({ ok: true });
}
