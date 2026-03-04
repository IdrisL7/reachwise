import sgMail from "@sendgrid/mail";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface SendEmailParams {
  to: string;
  from?: string;
  subject: string;
  body: string;
  messageId?: string; // outbound_messages.id to update status
  userId?: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Send an email via SendGrid and track the result */
export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  if (!SENDGRID_API_KEY) {
    console.warn("SENDGRID_API_KEY not set — email not sent");
    return { success: false, error: "SendGrid not configured" };
  }

  const fromEmail = params.from || process.env.SENDGRID_FROM_EMAIL || "noreply@getsignalhooks.com";

  try {
    const [response] = await sgMail.send({
      to: params.to,
      from: fromEmail,
      subject: params.subject,
      text: params.body,
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
      },
      customArgs: {
        ...(params.messageId ? { gsh_message_id: params.messageId } : {}),
        ...(params.userId ? { gsh_user_id: params.userId } : {}),
      },
    });

    // Update message status if we have a messageId
    if (params.messageId) {
      await db
        .update(schema.outboundMessages)
        .set({
          status: "sent",
          sentAt: new Date().toISOString(),
        })
        .where(eq(schema.outboundMessages.id, params.messageId));
    }

    // Track usage event
    if (params.userId) {
      await db.insert(schema.usageEvents).values({
        userId: params.userId,
        event: "email_sent",
        metadata: {
          to: params.to,
          subject: params.subject,
          messageId: params.messageId,
          sgMessageId: response.headers["x-message-id"],
        },
      });
    }

    return {
      success: true,
      messageId: response.headers["x-message-id"],
    };
  } catch (err: unknown) {
    const error = err as Error & { response?: { body?: unknown } };
    console.error("SendGrid send error:", error.response?.body || error.message);

    // Mark as failed if we have a messageId
    if (params.messageId) {
      await db
        .update(schema.outboundMessages)
        .set({ status: "failed" })
        .where(eq(schema.outboundMessages.id, params.messageId));
    }

    return { success: false, error: error.message };
  }
}

/** Send a batch of emails */
export async function sendEmailBatch(
  emails: SendEmailParams[],
): Promise<SendResult[]> {
  const results: SendResult[] = [];
  for (const email of emails) {
    results.push(await sendEmail(email));
    // Small delay between sends to avoid rate limits
    await new Promise((r) => setTimeout(r, 100));
  }
  return results;
}
