import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.leadId || !body?.sequenceId) {
    return NextResponse.json({ error: "leadId and sequenceId required" }, { status: 400 });
  }

  // Verify lead belongs to user
  const [lead] = await db
    .select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(eq(schema.leads.id, body.leadId), eq(schema.leads.userId, session.user.id)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Verify sequence belongs to user
  const [sequence] = await db
    .select({ id: schema.sequences.id })
    .from(schema.sequences)
    .where(and(eq(schema.sequences.id, body.sequenceId), eq(schema.sequences.userId, session.user.id)))
    .limit(1);

  if (!sequence) {
    return NextResponse.json({ error: "Sequence not found" }, { status: 404 });
  }

  const [assignment] = await db.insert(schema.leadSequences).values({
    leadId: body.leadId,
    sequenceId: body.sequenceId,
    approvalMode: body.approvalMode ? 1 : 0,
  }).returning();

  return NextResponse.json({ assignment }, { status: 201 });
}
