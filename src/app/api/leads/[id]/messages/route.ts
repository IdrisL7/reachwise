import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(
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

  try {
    const body = await request.json();

    if (!body.body?.trim()) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "Message body is required." },
        { status: 400 },
      );
    }

    const direction = body.direction || "outbound";
    const messageStatus = body.status || "sent";

    const [message] = await db.insert(schema.outboundMessages).values({
      leadId: id,
      direction,
      sequenceStep: body.sequence_step ?? lead.sequenceStep,
      channel: body.channel || "email",
      subject: body.subject || null,
      body: body.body,
      sentAt: messageStatus === "sent" ? new Date().toISOString() : null,
      status: messageStatus,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    }).returning();

    // Update lead state if this is an outbound sent message
    if (direction === "outbound" && messageStatus === "sent") {
      await db.update(schema.leads).set({
        sequenceStep: lead.sequenceStep + 1,
        lastContactedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).where(eq(schema.leads.id, id));
    }

    // If inbound message and sequence config says stop on reply
    if (direction === "inbound") {
      await db.update(schema.leads).set({
        status: "in_conversation",
        updatedAt: new Date().toISOString(),
      }).where(eq(schema.leads.id, id));
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error recording message:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to record message." },
      { status: 500 },
    );
  }
}
