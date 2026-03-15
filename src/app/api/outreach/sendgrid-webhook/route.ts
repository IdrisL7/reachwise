import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";

function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Missing TURSO_DATABASE_URL");
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.SENDGRID_WEBHOOK_TOKEN;
    if (token) {
      const provided = req.headers.get("x-outreach-webhook-token");
      if (provided !== token) {
        return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
      }
    }

    const body = await req.json();
    const events = Array.isArray(body) ? body : [body];
    const client = getClient();

    for (const event of events) {
      const leadId = event?.lead_id || event?.custom_args?.lead_id;
      if (!leadId) continue;

      if (event.event === "open") {
        await client.execute({
          sql: "UPDATE outreach_leads SET opened_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
          args: [String(leadId)],
        });
      } else if (event.event === "click") {
        await client.execute({
          sql: "UPDATE outreach_leads SET clicked_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
          args: [String(leadId)],
        });
      } else if (event.event === "bounce") {
        await client.execute({
          sql: "UPDATE outreach_leads SET bounced = 1, updated_at = datetime('now') WHERE id = ?",
          args: [String(leadId)],
        });
      } else if (event.event === "reply") {
        await client.execute({
          sql: "UPDATE outreach_leads SET replied = 1, updated_at = datetime('now') WHERE id = ?",
          args: [String(leadId)],
        });
      }
    }

    return NextResponse.json({ ok: true, processed: events.length });
  } catch (error) {
    console.error("SendGrid webhook error", error);
    return NextResponse.json({ error: "Failed to process webhook" }, { status: 500 });
  }
}
