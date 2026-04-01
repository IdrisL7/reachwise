import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { extractPreviousSequenceMetadata, inferTargetRoleFromLead } from "@/lib/followup/generate";
import { getLeadSegmentKey, recordSequenceOutcome } from "@/lib/followup/sequence-memory";

interface SendGridEvent {
  event: string; // delivered, open, click, bounce, dropped, deferred, spam_report, unsubscribe
  email: string;
  timestamp: number;
  gsh_message_id?: string;
  gsh_user_id?: string;
  url?: string; // for click events
  reason?: string; // for bounce/drop
  type?: string; // bounce type
}

const EVENT_MAP: Record<string, string> = {
  open: "email_opened",
  click: "email_clicked",
  bounce: "email_bounced",
  dropped: "email_bounced",
  spam_report: "email_bounced",
};

/** POST /api/webhooks/sendgrid — handle SendGrid event webhooks */
export async function POST(request: NextRequest) {
  try {
    const events: SendGridEvent[] = await request.json();

    for (const event of events) {
      const mappedEvent = EVENT_MAP[event.event];
      if (!mappedEvent) continue; // Skip events we don't track

      // Track as usage event if we have a user ID
      if (event.gsh_user_id) {
        await db.insert(schema.usageEvents).values({
          userId: event.gsh_user_id,
          event: mappedEvent as any,
          metadata: {
            email: event.email,
            messageId: event.gsh_message_id,
            url: event.url,
            reason: event.reason,
            bounceType: event.type,
            timestamp: event.timestamp,
          },
        });
      }

      // Update message status and lead status for bounces
      if (
        event.gsh_message_id &&
        (event.event === "bounce" || event.event === "dropped" || event.event === "spam_report")
      ) {
        await db
          .update(schema.outboundMessages)
          .set({ status: "failed" })
          .where(eq(schema.outboundMessages.id, event.gsh_message_id));

        // Mark the lead as unreachable and remove claim locks
        const [msg] = await db
          .select({
            leadId: schema.outboundMessages.leadId,
            sequenceStep: schema.outboundMessages.sequenceStep,
            channel: schema.outboundMessages.channel,
            metadata: schema.outboundMessages.metadata,
          })
          .from(schema.outboundMessages)
          .where(eq(schema.outboundMessages.id, event.gsh_message_id))
          .limit(1);

        if (msg?.leadId) {
          const [lead] = await db
            .select({
              userId: schema.leads.userId,
              email: schema.leads.email,
              title: schema.leads.title,
              source: schema.leads.source,
              companyWebsite: schema.leads.companyWebsite,
            })
            .from(schema.leads)
            .where(eq(schema.leads.id, msg.leadId))
            .limit(1);

          if (
            lead?.userId &&
            (msg.channel === "email" ||
              msg.channel === "linkedin_connection" ||
              msg.channel === "linkedin_message" ||
              msg.channel === "cold_call" ||
              msg.channel === "video_script")
          ) {
            const sequenceMetadata = extractPreviousSequenceMetadata(msg.metadata);
            await recordSequenceOutcome({
              userId: lead.userId,
              targetRole: inferTargetRoleFromLead({
                email: lead.email,
                title: lead.title,
              }),
              leadSegment: getLeadSegmentKey({
                title: lead.title,
                source: lead.source,
                companyWebsite: lead.companyWebsite,
              }),
              sequenceType: sequenceMetadata.sequenceType ?? (msg.sequenceStep === 0 ? "first" : "bump"),
              channel: msg.channel,
              previousChannel: sequenceMetadata.previousChannel ?? null,
              event: "unreachable",
            }).catch(() => {});
          }

          await db
            .update(schema.leads)
            .set({ status: "unreachable", updatedAt: new Date().toISOString() })
            .where(eq(schema.leads.id, msg.leadId));
          await db
            .delete(schema.claimLocks)
            .where(eq(schema.claimLocks.leadId, msg.leadId));
        }
      }
    }

    return NextResponse.json({ status: "ok", processed: events.length });
  } catch (error) {
    console.error("SendGrid webhook error:", error);
    return NextResponse.json({ status: "ok" }); // Always return 200 to avoid retries
  }
}
