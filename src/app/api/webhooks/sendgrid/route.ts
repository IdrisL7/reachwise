import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

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

      // Update message status for bounces
      if (
        event.gsh_message_id &&
        (event.event === "bounce" || event.event === "dropped")
      ) {
        await db
          .update(schema.outboundMessages)
          .set({ status: "failed" })
          .where(eq(schema.outboundMessages.id, event.gsh_message_id));
      }
    }

    return NextResponse.json({ status: "ok", processed: events.length });
  } catch (error) {
    console.error("SendGrid webhook error:", error);
    return NextResponse.json({ status: "ok" }); // Always return 200 to avoid retries
  }
}
