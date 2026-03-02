import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!validateBearerToken(request)) return unauthorized();

  const { id } = await params;

  const lead = await db.query.leads.findFirst({
    where: eq(schema.leads.id, id),
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
