import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [sequence] = await db
    .select()
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.userId, session.user.id)))
    .limit(1);

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  return NextResponse.json({ sequence });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.name) updates.name = body.name;
  if (body.steps) updates.steps = body.steps;
  if (body.isDefault !== undefined) updates.isDefault = body.isDefault ? 1 : 0;

  await db
    .update(schema.sequences)
    .set(updates)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.userId, session.user.id)));

  return NextResponse.json({ status: "ok" });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await db
    .delete(schema.sequences)
    .where(and(eq(schema.sequences.id, id), eq(schema.sequences.userId, session.user.id)))
    .returning({ id: schema.sequences.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "ok" });
}
