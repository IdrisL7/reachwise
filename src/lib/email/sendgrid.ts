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
  html?: string; // If not provided, auto-generated from body with branding
  messageId?: string; // outbound_messages.id to update status
  userId?: string;
}

/** Wrap plain text email body in a branded HTML template */
export function brandedHtml(body: string, unsubscribeUrl?: string): string {
  const bodyHtml = body
    .split("\n\n")
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  const unsubBlock = unsubscribeUrl
    ? `<p style="margin:0;"><a href="${unsubscribeUrl}" style="color:#71717a;text-decoration:underline;">Unsubscribe</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <span style="font-size:20px;font-weight:700;color:#34d399;letter-spacing:-0.02em;">GSH</span>
          <span style="font-size:14px;font-weight:600;color:#a1a1aa;margin-left:8px;">GetSignalHooks</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="color:#e4e4e7;font-size:15px;">
          ${bodyHtml}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:32px;border-top:1px solid #27272a;margin-top:32px;">
          <p style="margin:0 0 8px;font-size:12px;color:#71717a;">
            GetSignalHooks — Evidence-first hooks for outbound sales
          </p>
          <p style="margin:0 0 4px;font-size:12px;color:#52525b;">
            <a href="https://www.getsignalhooks.com" style="color:#52525b;text-decoration:underline;">getsignalhooks.com</a>
          </p>
          ${unsubBlock}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
      from: { email: fromEmail, name: "GetSignalHooks" },
      subject: params.subject,
      text: params.body,
      html: params.html || brandedHtml(params.body),
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

/** High-trust verification email template with "Let's get those signals" branding */
export function verificationEmailHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Verify Your Account</title>
</head>
<body style="background-color: #030014; padding: 40px; font-family: sans-serif;">
  <div style="max-width: 600px; margin: auto; background: #0B0F1A; border: 1px solid #1e293b; border-top: 4px solid #9333ea; padding: 40px; border-radius: 12px; color: #cbd5e1;">
    <h2 style="color: #ffffff; margin-top: 0;">Let's get those signals.</h2>
    <p>Welcome to GetSignalHooks. You're one click away from evidence-backed outreach that never hallucinates.</p>
    
    <a href="${verifyUrl}" style="background: #9333ea; color: #ffffff; padding: 14px 30px; border-radius: 8px; text-decoration: none; display: inline-block; font-weight: bold; margin: 25px 0;">
      Verify My Account
    </a>
    
    <hr style="border: 0; border-top: 1px solid #1e293b; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #64748b;">
      The GetSignalHooks Team — Evidence-first hooks for outbound sales.
    </p>
  </div>
</body>
</html>`;
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
