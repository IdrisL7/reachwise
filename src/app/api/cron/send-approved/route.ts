import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email/sendgrid";
import { recordHookOutcome } from "@/lib/hook-feedback";
import { extractPreviousHookMetadata } from "@/lib/followup/generate";
import { applyPendingNoReplyPenalties } from "@/lib/followup/maintenance";
import { persistFollowupMessageV2 } from "@/lib/v2-dual-write";

const BATCH_LIMIT = 50;

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch queued messages
  const queuedMessages = await db
    .select()
    .from(schema.outboundMessages)
    .where(
      and(
        eq(schema.outboundMessages.direction, "outbound"),
        eq(schema.outboundMessages.status, "queued"),
      ),
    )
    .limit(BATCH_LIMIT);

  console.log(`[send-approved] ${queuedMessages.length} queued messages to send`);

  let sent = 0;
  let failed = 0;
  let noReplyPenalized = 0;

  for (const message of queuedMessages) {
    try {
      // Look up the lead to get recipient email
      const [lead] = await db
        .select({
          email: schema.leads.email,
          userId: schema.leads.userId,
          companyWebsite: schema.leads.companyWebsite,
          companyName: schema.leads.companyName,
        })
        .from(schema.leads)
        .where(eq(schema.leads.id, message.leadId))
        .limit(1);

      if (!lead) {
        console.error(`[send-approved] lead not found for message ${message.id}`);
        await db
          .update(schema.outboundMessages)
          .set({ status: "failed" })
          .where(eq(schema.outboundMessages.id, message.id));
        failed++;
        continue;
      }

      // Send via SendGrid — sendEmail handles status updates internally
      const result = await sendEmail({
        to: lead.email,
        subject: message.subject || "(no subject)",
        body: message.body,
        html: message.body,
        messageId: message.id,
        userId: lead.userId ?? undefined,
      });

      if (result.success) {
        sent++;

        if (lead.userId) {
          await persistFollowupMessageV2({
            userId: lead.userId,
            companyUrl: lead.companyWebsite,
            companyName: lead.companyName,
            outboundMessageId: message.id,
            leadId: message.leadId,
            subject: message.subject,
            body: message.body,
            channel: message.channel,
            stage: "sent",
            metadata: message.metadata && typeof message.metadata === "object"
              ? (message.metadata as Record<string, unknown>)
              : null,
          }).catch(() => {});
        }

        const attribution = extractPreviousHookMetadata(message.metadata);
        if (lead.userId && attribution?.hookId) {
          await recordHookOutcome({
            hookId: attribution.hookId,
            userId: lead.userId,
            event: "used_in_email",
            metadata: {
              channel: message.channel,
              messageId: message.id,
              sequenceStep: message.sequenceStep,
            },
          }).catch(() => {});
        }

        // Advance leadSequence currentStep if this message belongs to one
        const [leadSeq] = await db
          .select()
          .from(schema.leadSequences)
          .where(eq(schema.leadSequences.leadId, message.leadId))
          .limit(1);

        if (leadSeq && leadSeq.status === "active") {
          // Look up the sequence to check if we've completed all steps
          const [sequence] = await db
            .select()
            .from(schema.sequences)
            .where(eq(schema.sequences.id, leadSeq.sequenceId))
            .limit(1);

          const nextStep = leadSeq.currentStep + 1;
          const totalSteps = sequence
            ? (sequence.steps as unknown[]).length
            : nextStep + 1;

          if (nextStep >= totalSteps) {
            await db
              .update(schema.leadSequences)
              .set({
                currentStep: nextStep,
                status: "completed",
                completedAt: new Date().toISOString(),
              })
              .where(eq(schema.leadSequences.id, leadSeq.id));
          } else {
            await db
              .update(schema.leadSequences)
              .set({ currentStep: nextStep })
              .where(eq(schema.leadSequences.id, leadSeq.id));
          }
        }
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`[send-approved] error sending message ${message.id}:`, err);
      await db
        .update(schema.outboundMessages)
        .set({ status: "failed" })
        .where(eq(schema.outboundMessages.id, message.id));
      failed++;
    }

    // Small delay between sends to avoid rate limits
    await new Promise((r) => setTimeout(r, 100));
  }

  noReplyPenalized = await applyPendingNoReplyPenalties(200);

  console.log(`[send-approved] done — sent: ${sent}, failed: ${failed}, no_reply_penalized: ${noReplyPenalized}`);

  return NextResponse.json({ sent, failed, no_reply_penalized: noReplyPenalized });
}
