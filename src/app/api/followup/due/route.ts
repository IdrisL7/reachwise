import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, or, isNull } from "drizzle-orm";
import { SEQUENCES, getDelayForStep } from "@/lib/followup/sequences";

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const url = new URL(request.url);
    const sequenceId = url.searchParams.get("sequence_id") || "default-b2b-sequence";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

    const sequence = SEQUENCES[sequenceId];
    if (!sequence) {
      return NextResponse.json(
        { status: "error", code: "INVALID_SEQUENCE", message: `Sequence '${sequenceId}' not found.` },
        { status: 400 },
      );
    }

    // Get all leads that are cold or in_conversation
    const candidates = await db.select()
      .from(schema.leads)
      .where(
        or(
          eq(schema.leads.status, "cold"),
          eq(schema.leads.status, "in_conversation"),
        ),
      )
      .limit(500);

    const now = Date.now();
    const dueLeads = [];

    for (const lead of candidates) {
      // Skip if already past max steps
      if (lead.sequenceStep >= sequence.maxSteps) continue;

      // If in_conversation and stopOnReply, skip
      if (lead.status === "in_conversation" && sequence.stopOnReply) continue;

      // Check delay
      if (lead.lastContactedAt) {
        const lastContact = new Date(lead.lastContactedAt).getTime();
        const delayMs = getDelayForStep(sequence, lead.sequenceStep) * 24 * 60 * 60 * 1000;
        if (now - lastContact < delayMs) continue;
      }
      // If never contacted (lastContactedAt is null), they're due for step 0

      dueLeads.push({
        id: lead.id,
        lead_id: lead.id,
        email: lead.email,
        email_to: lead.email,
        name: lead.name,
        company_name: lead.companyName,
        company_website: lead.companyWebsite,
        account_domain: lead.companyWebsite || null,
        sequence_step: lead.sequenceStep,
        followup_step: lead.sequenceStep,
        next_step: lead.sequenceStep,
        sequence_id: sequenceId,
        last_contacted_at: lead.lastContactedAt,
        rep_id: null,
        timezone: null,
        mode: "send",
      });

      if (dueLeads.length >= limit) break;
    }

    return NextResponse.json({ leads: dueLeads });
  } catch (error) {
    console.error("Error checking due follow-ups:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to check due follow-ups." },
      { status: 500 },
    );
  }
}
