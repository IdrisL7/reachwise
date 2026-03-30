import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: schema.leadSequences.id,
      leadId: schema.leadSequences.leadId,
      leadEmail: schema.leads.email,
      leadName: schema.leads.name,
      companyName: schema.leads.companyName,
      sequenceId: schema.leadSequences.sequenceId,
      sequenceName: schema.sequences.name,
      sequenceSteps: schema.sequences.steps,
      currentStep: schema.leadSequences.currentStep,
      status: schema.leadSequences.status,
      lastContactedAt: schema.leads.lastContactedAt,
      startedAt: schema.leadSequences.startedAt,
    })
    .from(schema.leadSequences)
    .innerJoin(schema.leads, eq(schema.leadSequences.leadId, schema.leads.id))
    .innerJoin(schema.sequences, eq(schema.leadSequences.sequenceId, schema.sequences.id))
    .where(eq(schema.leads.userId, session.user.id))
    .orderBy(desc(schema.leadSequences.startedAt));

  const assignments = rows.map((r) => ({
    id: r.id,
    leadId: r.leadId,
    leadEmail: r.leadEmail,
    leadName: r.leadName,
    companyName: r.companyName,
    sequenceId: r.sequenceId,
    sequenceName: r.sequenceName,
    currentStep: r.currentStep,
    totalSteps: Array.isArray(r.sequenceSteps) ? r.sequenceSteps.length : 0,
    status: r.status,
    lastContactedAt: r.lastContactedAt,
    startedAt: r.startedAt,
  }));

  return NextResponse.json({ assignments });
}

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
