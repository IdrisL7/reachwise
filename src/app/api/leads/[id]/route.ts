import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, desc, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lead = await db.query.leads.findFirst({
    where: and(eq(schema.leads.id, id), eq(schema.leads.userId, session.user.id)),
  });

  if (!lead) {
    return NextResponse.json(
      { status: "error", code: "LEAD_NOT_FOUND", message: `Lead with id ${id} was not found.` },
      { status: 404 },
    );
  }

  const messages = await db.select()
    .from(schema.outboundMessages)
    .where(eq(schema.outboundMessages.leadId, id))
    .orderBy(desc(schema.outboundMessages.createdAt));

  return NextResponse.json({ lead, messages });
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
    .delete(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.userId, session.user.id)))
    .returning({ id: schema.leads.id });

  if (deleted.length === 0) {
    return NextResponse.json(
      { status: "error", code: "LEAD_NOT_FOUND", message: `Lead with id ${id} was not found.` },
      { status: 404 },
    );
  }

  return NextResponse.json({ status: "ok" });
}
