import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();

    if (!body.lead_id || !body.event) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "lead_id and event are required." },
        { status: 400 },
      );
    }

    const entry = await db.insert(schema.auditLog).values({
      id: crypto.randomUUID(),
      leadId: body.lead_id,
      event: body.event,
      reason: body.reason || null,
      runId: body.run_id || null,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
      createdAt: new Date().toISOString(),
    }).returning();

    return NextResponse.json({
      status: "ok",
      audit_id: entry[0]?.id,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error writing audit log:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to write audit log." },
      { status: 500 },
    );
  }
}
