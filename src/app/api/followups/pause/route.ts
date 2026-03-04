import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

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

    // Write audit log entry
    await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      leadId: body.lead_id,
      event: "paused",
      reason: body.reason,
      runId: body.run_id || null,
      metadata: JSON.stringify({ lock_id: body.lock_id, previous_status: lead.status, new_status: newStatus }),
      createdAt: new Date().toISOString(),
    });

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
