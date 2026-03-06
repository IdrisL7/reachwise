import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, and, gte } from "drizzle-orm";

const DAILY_SEND_CAP = 50;
const QUIET_HOUR_START = 21; // 9 PM
const QUIET_HOUR_END = 8;   // 8 AM

function isQuietHours(timezone?: string): boolean {
  try {
    const tz = timezone || "UTC";
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    });
    const hour = parseInt(formatter.format(now), 10);
    return hour >= QUIET_HOUR_START || hour < QUIET_HOUR_END;
  } catch {
    return false; // If timezone is invalid, don't block
  }
}

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

    // Look up lead
    const lead = await db.query.leads.findFirst({
      where: eq(schema.leads.id, body.lead_id),
    });

    if (!lead) {
      return NextResponse.json(
        { status: "error", code: "LEAD_NOT_FOUND", message: `Lead ${body.lead_id} not found.` },
        { status: 404 },
      );
    }

    // Check 1: Lead replied (in_conversation)
    if (lead.status === "in_conversation") {
      return NextResponse.json({
        safe_to_send: false,
        reason: "replied",
      });
    }

    // Check 2: Terminal statuses
    if (["won", "lost", "unreachable"].includes(lead.status)) {
      return NextResponse.json({
        safe_to_send: false,
        reason: lead.status === "unreachable" ? "bounced" : lead.status,
      });
    }

    // Check 3: Quiet hours
    if (isQuietHours(body.timezone)) {
      return NextResponse.json({
        safe_to_send: false,
        reason: "quiet_hours",
      });
    }

    // Check 4: Daily send cap (count outbound messages sent today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const sentToday = await db.select()
      .from(schema.outboundMessages)
      .where(
        and(
          eq(schema.outboundMessages.direction, "outbound"),
          gte(schema.outboundMessages.createdAt, todayStr),
        ),
      );

    if (sentToday.length >= DAILY_SEND_CAP) {
      return NextResponse.json({
        safe_to_send: false,
        reason: "daily_cap",
      });
    }

    // Check 5: OOO detection — check if last inbound message contains OOO keywords
    const lastInbound = await db.query.outboundMessages.findFirst({
      where: and(
        eq(schema.outboundMessages.leadId, body.lead_id),
        eq(schema.outboundMessages.direction, "inbound"),
      ),
    });

    if (lastInbound) {
      const oooKeywords = ["out of office", "ooo", "on vacation", "on leave", "out of the office", "auto-reply", "autoreply"];
      const bodyLower = lastInbound.body.toLowerCase();
      const isOoo = oooKeywords.some((kw) => bodyLower.includes(kw));
      if (isOoo) {
        return NextResponse.json({
          safe_to_send: false,
          reason: "ooo",
        });
      }
    }

    // Check 6: Cold intent score
    const [leadScore] = await db
      .select()
      .from(schema.leadScores)
      .where(eq(schema.leadScores.leadId, body.lead_id))
      .limit(1);

    if (leadScore && leadScore.score < 20 && leadScore.temperature === "cold") {
      return NextResponse.json({
        safe_to_send: false,
        reason: "cold_score_drop",
        details: `Intent score dropped to ${leadScore.score} (cold). Pausing to avoid low-value sends.`,
      });
    }

    return NextResponse.json({
      safe_to_send: true,
      reason: null,
    });
  } catch (error: any) {
    console.error("Error running safety check:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to run safety check." },
      { status: 500 },
    );
  }
}
