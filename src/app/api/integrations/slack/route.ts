import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * GET /api/integrations/slack — send daily summary to Slack webhook
 * Triggered by Vercel Cron. Requires CRON_SECRET and SLACK_WEBHOOK_URL env vars.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackWebhookUrl) {
    return NextResponse.json({ status: "skipped", reason: "No SLACK_WEBHOOK_URL configured" });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  async function countEvent(event: string) {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.usageEvents)
      .where(
        and(
          eq(schema.usageEvents.event, event as any),
          gte(schema.usageEvents.createdAt, since),
        ),
      );
    return result?.count ?? 0;
  }

  const hooks = await countEvent("hook_generated");
  const sent = await countEvent("email_sent");
  const opens = await countEvent("email_opened");
  const clicks = await countEvent("email_clicked");
  const bounces = await countEvent("email_bounced");

  const [newUsers] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users)
    .where(gte(schema.users.createdAt, since));

  const message = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "GetSignalHooks — Daily Summary" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Hooks Generated:*\n${hooks}` },
          { type: "mrkdwn", text: `*Emails Sent:*\n${sent}` },
          { type: "mrkdwn", text: `*Opens:*\n${opens}` },
          { type: "mrkdwn", text: `*Clicks:*\n${clicks}` },
          { type: "mrkdwn", text: `*Bounces:*\n${bounces}` },
          { type: "mrkdwn", text: `*New Users:*\n${newUsers?.count ?? 0}` },
        ],
      },
    ],
  };

  try {
    await fetch(slackWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    return NextResponse.json({ status: "sent" });
  } catch (err) {
    console.error("Slack webhook failed:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
