import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();

    if (!body.lead_id || !body.reason) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "lead_id and reason are required." },
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

    // Map reason to appropriate status
    type LeadStatus = "cold" | "in_conversation" | "won" | "lost" | "unreachable";
    const statusMap: Record<string, LeadStatus> = {
      replied: "in_conversation",
      bounced: "unreachable",
      unsubscribed: "lost",
      ooo: "cold",
      daily_cap: "cold",
      quiet_hours: "cold",
      cold_score_drop: "cold",
    };

    const newStatus: LeadStatus = statusMap[body.reason] || "cold";

    // Update lead status if it needs changing
    if (lead.status !== newStatus && newStatus !== "cold") {
      await db.update(schema.leads)
        .set({ status: newStatus, updatedAt: new Date().toISOString() })
        .where(eq(schema.leads.id, body.lead_id));
    }

    // Release the lock if lock_id provided
    if (body.lock_id) {
      await db.delete(schema.claimLocks).where(eq(schema.claimLocks.id, body.lock_id));
    }

    const now = new Date().toISOString();

    // Write audit log entry
    await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      leadId: body.lead_id,
      event: "paused",
      reason: body.reason,
      runId: body.run_id || null,
      metadata: JSON.stringify({ lock_id: body.lock_id, previous_status: lead.status, new_status: newStatus }),
      createdAt: now,
    });

    // OOO: pause lead_sequence with 7-day auto-resume
    if (body.reason === "ooo") {
      const resumeAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db
        .update(schema.leadSequences)
        .set({ status: "paused", pausedAt: now, resumeAt })
        .where(
          and(
            eq(schema.leadSequences.leadId, body.lead_id),
            eq(schema.leadSequences.status, "active"),
          ),
        );
    }

    // Cold score drop: pause lead_sequence and notify owner
    if (body.reason === "cold_score_drop") {
      await db
        .update(schema.leadSequences)
        .set({ status: "paused", pausedAt: now })
        .where(
          and(
            eq(schema.leadSequences.leadId, body.lead_id),
            eq(schema.leadSequences.status, "active"),
          ),
        );

      // Create notification for the lead's owner
      if (lead?.userId) {
        await db.insert(schema.notifications).values({
          userId: lead.userId,
          type: "auto_paused",
          title: `Sequence paused for ${lead.name || lead.email}`,
          body: "Intent score dropped to cold. Review and resume when ready.",
          leadId: lead.id,
        });
      }
    }

    return NextResponse.json({
      status: "ok",
      lead_id: body.lead_id,
      paused: true,
      reason: body.reason,
      new_status: newStatus,
    });
  } catch (error: any) {
    console.error("Error pausing lead:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to pause lead." },
      { status: 500 },
    );
  }
}
