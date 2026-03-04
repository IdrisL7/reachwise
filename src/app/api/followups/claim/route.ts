import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, and, lt } from "drizzle-orm";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();

    if (!body.lead_id || !body.run_id) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "lead_id and run_id are required." },
        { status: 400 },
      );
    }

    const ttlMinutes = body.lock_ttl_minutes || 30;
    const now = new Date();
    const nowISO = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    // Check if lead exists
    const lead = await db.query.leads.findFirst({
      where: eq(schema.leads.id, body.lead_id),
    });

    if (!lead) {
      return NextResponse.json(
        { status: "error", code: "LEAD_NOT_FOUND", message: `Lead ${body.lead_id} not found.` },
        { status: 404 },
      );
    }

    // Check if already sent at current step
    const recentMessage = await db.query.outboundMessages.findFirst({
      where: and(
        eq(schema.outboundMessages.leadId, body.lead_id),
        eq(schema.outboundMessages.sequenceStep, lead.sequenceStep),
        eq(schema.outboundMessages.direction, "outbound"),
      ),
    });

    if (recentMessage) {
      return NextResponse.json({
        claimed: false,
        lock_id: null,
        already_sent: true,
        status: "already_sent_at_step",
      });
    }

    // Check for existing lock
    const existingLock = await db.query.claimLocks.findFirst({
      where: eq(schema.claimLocks.leadId, body.lead_id),
    });

    if (existingLock) {
      const lockExpiry = new Date(existingLock.expiresAt);
      if (lockExpiry > now) {
        // Still locked by another run
        return NextResponse.json({
          claimed: false,
          lock_id: null,
          already_sent: false,
          status: "locked_by_another_run",
        });
      }
      // Lock expired — delete it so we can claim
      await db.delete(schema.claimLocks).where(eq(schema.claimLocks.id, existingLock.id));
    }

    // Insert new lock
    const lockId = crypto.randomUUID();
    await db.insert(schema.claimLocks).values({
      id: lockId,
      leadId: body.lead_id,
      runId: body.run_id,
      lockedAt: nowISO,
      expiresAt: expiresAt.toISOString(),
    });

    return NextResponse.json({
      claimed: true,
      lock_id: lockId,
      already_sent: false,
      status: "claimed",
    });
  } catch (error: any) {
    // Handle unique constraint (race condition — another run claimed first)
    const errStr = String(error?.message ?? "") + String(error?.cause?.message ?? "") + String(error?.cause?.code ?? "");
    if (errStr.includes("UNIQUE") || errStr.includes("SQLITE_CONSTRAINT")) {
      return NextResponse.json({
        claimed: false,
        lock_id: null,
        already_sent: false,
        status: "claimed_by_race",
      });
    }

    console.error("Error claiming lead lock:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to claim lead lock." },
      { status: 500 },
    );
  }
}
