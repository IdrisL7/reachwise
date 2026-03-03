import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { prospectDb, prospectSchema } from "@/lib/prospect-agent/db";
import { eq, and, gte, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") || "today";
    const leadId = url.searchParams.get("lead_id");
    const status = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

    const conditions = [];

    if (filter === "today") {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      conditions.push(gte(prospectSchema.dmLog.createdAt, todayStart.toISOString().replace("T", " ").replace("Z", "").slice(0, 19)));
    }

    if (leadId) {
      conditions.push(eq(prospectSchema.dmLog.leadId, leadId));
    }

    if (status) {
      conditions.push(eq(prospectSchema.dmLog.status, status as any));
    }

    const where = conditions.length > 0
      ? conditions.length === 1 ? conditions[0] : and(...conditions)
      : undefined;

    const dms = await prospectDb
      .select({
        id: prospectSchema.dmLog.id,
        leadId: prospectSchema.dmLog.leadId,
        leadName: prospectSchema.prospectLeads.name,
        leadCompany: prospectSchema.prospectLeads.companyName,
        linkedinUrl: prospectSchema.prospectLeads.linkedinUrl,
        dmText: prospectSchema.dmLog.dmText,
        status: prospectSchema.dmLog.status,
        error: prospectSchema.dmLog.error,
        sentAt: prospectSchema.dmLog.sentAt,
        createdAt: prospectSchema.dmLog.createdAt,
      })
      .from(prospectSchema.dmLog)
      .leftJoin(prospectSchema.prospectLeads, eq(prospectSchema.dmLog.leadId, prospectSchema.prospectLeads.id))
      .where(where)
      .limit(limit)
      .orderBy(sql`${prospectSchema.dmLog.createdAt} DESC`);

    // Summary stats
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const statsResult = await prospectDb
      .select({
        total: sql<number>`count(*)`,
        sent: sql<number>`sum(case when ${prospectSchema.dmLog.status} = 'sent' then 1 else 0 end)`,
        queued: sql<number>`sum(case when ${prospectSchema.dmLog.status} = 'queued' then 1 else 0 end)`,
        failed: sql<number>`sum(case when ${prospectSchema.dmLog.status} = 'failed' then 1 else 0 end)`,
      })
      .from(prospectSchema.dmLog)
      .where(gte(prospectSchema.dmLog.createdAt, todayStart.toISOString().replace("T", " ").replace("Z", "").slice(0, 19)));

    const stats = statsResult[0] ?? { total: 0, sent: 0, queued: 0, failed: 0 };

    return NextResponse.json({
      status: "ok",
      filter,
      count: dms.length,
      today_summary: {
        total: stats.total ?? 0,
        sent: stats.sent ?? 0,
        queued: stats.queued ?? 0,
        failed: stats.failed ?? 0,
      },
      dms,
    });
  } catch (error) {
    console.error("DM log query error:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to query DM log." },
      { status: 500 },
    );
  }
}

// PATCH - update DM status (approve, reject, mark sent/failed)
export async function PATCH(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();
    const { dm_id, status: newStatus, error: errorMsg } = body;

    if (!dm_id) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "dm_id is required." },
        { status: 400 },
      );
    }

    const validStatuses = ["approved", "sent", "failed", "rejected"];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: `status must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }

    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "sent") {
      updates.sentAt = new Date().toISOString();
    }
    if (errorMsg) {
      updates.error = errorMsg;
    }

    const [updated] = await prospectDb
      .update(prospectSchema.dmLog)
      .set(updates)
      .where(eq(prospectSchema.dmLog.id, dm_id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { status: "error", code: "NOT_FOUND", message: "DM not found." },
        { status: 404 },
      );
    }

    // If marking as sent, update lead status and lastContactedAt
    if (newStatus === "sent") {
      await prospectDb
        .update(prospectSchema.prospectLeads)
        .set({
          status: "dm_sent",
          lastContactedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(prospectSchema.prospectLeads.id, updated.leadId));
    }

    return NextResponse.json({ status: "ok", dm: updated });
  } catch (error) {
    console.error("DM log update error:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to update DM." },
      { status: 500 },
    );
  }
}
