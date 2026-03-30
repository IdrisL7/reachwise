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

/** Branded HTML template for email verification */
export function verificationEmailHtml(verifyUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#030014;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#030014;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#030014;border-top:4px solid #9333ea;">
        <!-- Logo -->
        <tr><td style="padding:32px 40px 0;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">GSH</span>
          <span style="font-size:14px;color:#94a3b8;margin-left:8px;">GetSignalHooks</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 40px 0;color:#cbd5e1;font-size:15px;line-height:1.6;">
          <h1 style="color:#ffffff;font-size:24px;margin:0 0 16px;font-weight:700;">Let's get those signals.</h1>
          <p style="margin:0 0 16px;">Welcome to the era of evidence-backed outbound. To start surfacing hooks from product launches, news, and filings, please verify your email address:</p>
          <a href="${verifyUrl}" style="display:inline-block;background-color:#9333ea;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;margin:8px 0 24px;">Verify My Email Address</a>
          <p style="font-size:13px;color:#64748b;margin:0 0 8px;">This link will expire in 24 hours for your security.</p>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px 32px;border-top:1px solid #1e293b;margin-top:8px;">
          <p style="font-size:12px;color:#475569;margin:0 0 8px;"><strong style="color:#64748b;">Why did I get this?</strong> You signed up for GetSignalHooks — the tool that stops AI hallucinations in sales outreach. If you didn't do this, you can safely ignore this email.</p>
          <p style="font-size:12px;color:#475569;margin:0;">— The GetSignalHooks Team<br>
          <a href="https://www.getsignalhooks.com" style="color:#9333ea;text-decoration:none;">getsignalhooks.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Watchlist digest email — sent after nightly scan finds fresh signals */
export function watchlistDigestHtml(
  hits: Array<{ companyName: string; hookCount: number }>,
  totalHooks: number,
): string {
  const rows = hits
    .map(
      (h) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #27272a;color:#e4e4e7;font-size:14px;">${h.companyName}</td><td style="padding:6px 0;border-bottom:1px solid #27272a;color:#34d399;font-size:14px;text-align:right;">${h.hookCount} hook${h.hookCount !== 1 ? "s" : ""}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
        <tr><td style="padding-bottom:32px;">
          <span style="font-size:20px;font-weight:700;color:#34d399;letter-spacing:-0.02em;">GSH</span>
          <span style="font-size:14px;font-weight:600;color:#a1a1aa;margin-left:8px;">GetSignalHooks</span>
        </td></tr>
        <tr><td style="color:#e4e4e7;font-size:15px;padding-bottom:24px;">
          <p style="margin:0 0 16px;line-height:1.6;">Your watchlist picked up <strong style="color:#fff;">${totalHooks} new hook${totalHooks !== 1 ? "s" : ""}</strong> from <strong style="color:#fff;">${hits.length} compan${hits.length !== 1 ? "ies" : "y"}</strong> overnight.</p>
        </td></tr>
        <tr><td style="padding-bottom:24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows}
          </table>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <a href="https://www.getsignalhooks.com/app/inbox" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Review hooks in Inbox &rarr;</a>
        </td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid #27272a;">
          <p style="margin:0;font-size:12px;color:#71717a;">GetSignalHooks — Evidence-first hooks for outbound sales</p>
          <p style="margin:4px 0 0;font-size:12px;color:#52525b;"><a href="https://www.getsignalhooks.com" style="color:#52525b;text-decoration:underline;">getsignalhooks.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
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
