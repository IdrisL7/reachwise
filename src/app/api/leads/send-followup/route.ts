import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { getSequence, getDelayForStep } from "@/lib/followup/sequences";
import { extractPreviousHookMetadata, generateFollowUp } from "@/lib/followup/generate";
import { persistFollowupMessageV2 } from "@/lib/v2-dual-write";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();

    // -----------------------------------------------------------------------
    // Validate request
    // -----------------------------------------------------------------------

    if (!body.lead_id || !body.sequence_id) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "lead_id and sequence_id are required." },
        { status: 400 },
      );
    }

    const force = body.override?.force === true;
    const maxStepOverride = body.override?.max_sequence_step;

    // -----------------------------------------------------------------------
    // Load lead
    // -----------------------------------------------------------------------

    const lead = await db.query.leads.findFirst({
      where: eq(schema.leads.id, body.lead_id),
    });

    if (!lead) {
      return NextResponse.json(
        { status: "error", code: "LEAD_NOT_FOUND", message: `Lead with id ${body.lead_id} was not found.` },
        { status: 404 },
      );
    }

    // -----------------------------------------------------------------------
    // Load sequence
    // -----------------------------------------------------------------------

    const sequence = getSequence(body.sequence_id);
    if (!sequence) {
      return NextResponse.json(
        { status: "error", code: "INVALID_SEQUENCE", message: `Sequence '${body.sequence_id}' not found.` },
        { status: 400 },
      );
    }

    const effectiveMaxSteps = maxStepOverride ?? sequence.maxSteps;

    // -----------------------------------------------------------------------
    // Validate lead state (unless force=true)
    // -----------------------------------------------------------------------

    if (!force) {
      // Terminal status check
      const terminalStatuses = ["won", "lost", "unreachable"];
      if (terminalStatuses.includes(lead.status)) {
        return NextResponse.json(
          {
            status: "error",
            code: "LEAD_TERMINAL",
            message: `Lead ${body.lead_id} has terminal status '${lead.status}' and cannot receive follow-ups.`,
          },
          { status: 400 },
        );
      }

      // Stop on reply check
      if (lead.status === "in_conversation" && sequence.stopOnReply) {
        return NextResponse.json(
          {
            status: "error",
            code: "LEAD_REPLIED",
            message: `Lead ${body.lead_id} has replied. Sequence is paused per stop-on-reply rule.`,
          },
          { status: 400 },
        );
      }

      // Max steps check
      if (lead.sequenceStep >= effectiveMaxSteps) {
        return NextResponse.json(
          {
            status: "error",
            code: "SEQUENCE_COMPLETE",
            message: `Lead ${body.lead_id} has already reached the maximum sequence step for ${body.sequence_id}.`,
          },
          { status: 400 },
        );
      }

      // Delay check
      if (lead.lastContactedAt) {
        const lastContact = new Date(lead.lastContactedAt).getTime();
        const delayDays = getDelayForStep(sequence, lead.sequenceStep);
        const delayMs = delayDays * 24 * 60 * 60 * 1000;
        const nextSendAt = new Date(lastContact + delayMs);

        if (Date.now() < nextSendAt.getTime()) {
          return NextResponse.json(
            {
              status: "error",
              code: "TOO_EARLY",
              message: `Next follow-up for lead ${body.lead_id} is scheduled after ${nextSendAt.toISOString()}.`,
            },
            { status: 400 },
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Load previous messages
    // -----------------------------------------------------------------------

    const previousMessages = await db.select()
      .from(schema.outboundMessages)
      .where(eq(schema.outboundMessages.leadId, lead.id))
      .orderBy(desc(schema.outboundMessages.createdAt));

    // -----------------------------------------------------------------------
    // Generate follow-up email
    // -----------------------------------------------------------------------

    const result = await generateFollowUp({
      lead: {
        userId: lead.userId,
        email: lead.email,
        name: lead.name,
        title: lead.title,
        companyName: lead.companyName,
        companyWebsite: lead.companyWebsite,
        source: lead.source,
      },
      previousMessages: previousMessages.map((m) => ({
        direction: m.direction,
        sequenceStep: m.sequenceStep,
        channel: m.channel,
        subject: m.subject,
        body: m.body,
        sentAt: m.sentAt,
        metadata: extractPreviousHookMetadata(m.metadata),
      })),
      sequence,
      currentStep: lead.sequenceStep,
    });

    // -----------------------------------------------------------------------
    // Record draft message and update lead state
    // -----------------------------------------------------------------------

    const now = new Date().toISOString();

    const [insertedMessage] = await db.insert(schema.outboundMessages).values({
      leadId: lead.id,
      direction: "outbound",
      sequenceStep: lead.sequenceStep,
      channel: result.channel,
      subject: result.subject,
      body: result.body,
      status: "draft",
      sentAt: null,
      metadata: result.hookUsed
        ? {
            hookId: result.hookUsed.generatedHookId ?? null,
            sequenceType: result.orchestration?.sequenceType ?? null,
            previousChannel: result.orchestration?.previousChannel ?? null,
            tone: result.orchestration?.tone ?? null,
            angle: result.hookUsed.angle,
            buyerTensionId: result.hookUsed.buyerTensionId ?? null,
            structuralVariant: result.hookUsed.structuralVariant ?? null,
            hookText: result.hookUsed.hookText,
            evidenceSnippet: result.hookUsed.evidence,
            orchestration: result.orchestration ?? null,
          }
        : null,
    }).returning({ id: schema.outboundMessages.id });

    if (lead.userId) {
      await persistFollowupMessageV2({
        userId: lead.userId,
        companyUrl: lead.companyWebsite,
        companyName: lead.companyName,
        outboundMessageId: insertedMessage.id,
        leadId: lead.id,
        subject: result.subject,
        body: result.body,
        channel: result.channel,
        stage: "generated",
        metadata: result.hookUsed
          ? {
              hookId: result.hookUsed.generatedHookId ?? null,
              sequenceType: result.orchestration?.sequenceType ?? null,
              previousChannel: result.orchestration?.previousChannel ?? null,
              tone: result.orchestration?.tone ?? null,
              angle: result.hookUsed.angle,
            }
          : null,
      }).catch(() => {});
    }

    await db.update(schema.leads).set({
      sequenceStep: lead.sequenceStep + 1,
      lastContactedAt: now,
      updatedAt: now,
    }).where(eq(schema.leads.id, lead.id));

    // -----------------------------------------------------------------------
    // Return response
    // -----------------------------------------------------------------------

    return NextResponse.json({
      status: "ok",
      lead: {
        id: lead.id,
        email: lead.email,
        name: lead.name,
        title: lead.title,
        company_name: lead.companyName,
      },
      sequence: {
        sequence_id: body.sequence_id,
        current_step: lead.sequenceStep + 1,
        max_steps: effectiveMaxSteps,
        can_send: lead.sequenceStep + 1 < effectiveMaxSteps,
      },
      followup: {
        subject: result.subject,
        body: result.body,
        hook_source: result.hookSource,
        orchestration: result.orchestration,
      },
    });
  } catch (error: any) {
    console.error("Error in send-followup:", error);
    return NextResponse.json(
      {
        status: "error",
        code: "GENERATION_FAILED",
        message: error?.message || "Failed to generate and record follow-up.",
      },
      { status: 500 },
    );
  }
}
