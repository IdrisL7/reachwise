import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { getSequence } from "@/lib/followup/sequences";
import { generateFollowUp } from "@/lib/followup/generate";
import type { Hook } from "@/lib/hooks";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();

    if (!body.lead_id) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "lead_id is required." },
        { status: 400 },
      );
    }

    const lead = await db.query.leads.findFirst({
      where: eq(schema.leads.id, body.lead_id),
    });

    if (!lead) {
      return NextResponse.json(
        { status: "error", code: "LEAD_NOT_FOUND", message: `Lead with id ${body.lead_id} was not found.` },
        { status: 404 },
      );
    }

    const sequenceId = body.sequence_id || "default-b2b-sequence";
    const sequence = getSequence(sequenceId);
    if (!sequence) {
      return NextResponse.json(
        { status: "error", code: "INVALID_SEQUENCE", message: `Sequence '${sequenceId}' not found.` },
        { status: 400 },
      );
    }

    // Get previous messages
    const previousMessages = await db.select()
      .from(schema.outboundMessages)
      .where(eq(schema.outboundMessages.leadId, lead.id))
      .orderBy(desc(schema.outboundMessages.createdAt));

    const currentStep = typeof body.step === "number" ? body.step : lead.sequenceStep;

    const channel = body.channel || "email";

    const result = await generateFollowUp({
      lead: {
        email: lead.email,
        name: lead.name,
        title: lead.title,
        companyName: lead.companyName,
        companyWebsite: lead.companyWebsite,
      },
      previousMessages: previousMessages.map((m) => ({
        direction: m.direction,
        sequenceStep: m.sequenceStep,
        subject: m.subject,
        body: m.body,
        sentAt: m.sentAt,
      })),
      sequence,
      currentStep,
      hooks: body.hooks as Hook[] | undefined,
      tone: body.style?.tone,
      wordCountHint: body.style?.word_count_hint,
      avoidAngle: body.avoid_angle,
      channel,
    });

    const mode = body.mode || "send";

    const responsePayload: Record<string, any> = { body: result.body };
    if (result.subject) responsePayload.subject = result.subject;

    return NextResponse.json({
      email: responsePayload,
      meta: {
        step: currentStep,
        angle: result.hookUsed?.angle,
        sequence_id: sequenceId,
        channel: result.channel,
        mode,
      },
    });
  } catch (error: any) {
    console.error("Error generating follow-up:", error);
    return NextResponse.json(
      { status: "error", code: "GENERATION_FAILED", message: error?.message || "Failed to generate follow-up email." },
      { status: 500 },
    );
  }
}
