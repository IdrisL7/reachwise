import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, or, isNull, and } from "drizzle-orm";
import { SEQUENCES, getDelayForStep } from "@/lib/followup/sequences";
import type { SequenceStep } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

    const dueLeads: any[] = [];

    // --- Path 1: Leads with active lead_sequences (custom sequences) ---
    const activeLeadSeqs = await db
      .select({
        ls: schema.leadSequences,
        lead: schema.leads,
        seqSteps: schema.sequences.steps,
        seqName: schema.sequences.name,
      })
      .from(schema.leadSequences)
      .innerJoin(schema.leads, eq(schema.leadSequences.leadId, schema.leads.id))
      .innerJoin(schema.sequences, eq(schema.leadSequences.sequenceId, schema.sequences.id))
      .where(eq(schema.leadSequences.status, "active"))
      .limit(200);

    const now = Date.now();

    for (const row of activeLeadSeqs) {
      if (dueLeads.length >= limit) break;

      const steps = row.seqSteps as SequenceStep[];
      const currentStepIdx = row.ls.currentStep;

      // Past all steps → should be completed
      if (currentStepIdx >= steps.length) continue;

      const step = steps[currentStepIdx];

      // Check if lead status prevents sending
      if (row.lead.status === "in_conversation" || row.lead.status === "won" || row.lead.status === "lost" || row.lead.status === "unreachable") continue;

      // Check delay
      if (row.lead.lastContactedAt) {
        const lastContact = new Date(row.lead.lastContactedAt).getTime();
        const delayMs = step.delayDays * 24 * 60 * 60 * 1000;
        if (now - lastContact < delayMs) continue;
      }

      dueLeads.push({
        id: row.lead.id,
        lead_id: row.lead.id,
        email: row.lead.email,
        email_to: row.lead.email,
        name: row.lead.name,
        company_name: row.lead.companyName,
        company_website: row.lead.companyWebsite,
        account_domain: row.lead.companyWebsite || null,
        sequence_step: currentStepIdx,
        followup_step: currentStepIdx,
        next_step: currentStepIdx,
        sequence_id: row.ls.sequenceId,
        sequence_name: row.seqName,
        lead_sequence_id: row.ls.id,
        channel: step.channel,
        step_type: step.type,
        approval_mode: row.ls.approvalMode === 1,
        last_contacted_at: row.lead.lastContactedAt,
        rep_id: row.lead.userId,
        timezone: null,
        mode: row.ls.approvalMode === 1 ? "draft_only" : "send",
      });
    }

    // --- Path 2: Legacy fallback for leads without lead_sequences ---
    const sequenceId = url.searchParams.get("sequence_id") || "default-b2b-sequence";
    const sequence = SEQUENCES[sequenceId];

    if (sequence && dueLeads.length < limit) {
      // Get lead IDs that already have active lead_sequences (to exclude)
      const assignedLeadIds = new Set(activeLeadSeqs.map((r) => r.lead.id));

      const candidates = await db.select()
        .from(schema.leads)
        .where(
          or(
            eq(schema.leads.status, "cold"),
            eq(schema.leads.status, "in_conversation"),
          ),
        )
        .limit(500);

      for (const lead of candidates) {
        if (dueLeads.length >= limit) break;
        if (assignedLeadIds.has(lead.id)) continue;
        if (lead.sequenceStep >= sequence.maxSteps) continue;
        if (lead.status === "in_conversation" && sequence.stopOnReply) continue;

        if (lead.lastContactedAt) {
          const lastContact = new Date(lead.lastContactedAt).getTime();
          const delayMs = getDelayForStep(sequence, lead.sequenceStep) * 24 * 60 * 60 * 1000;
          if (now - lastContact < delayMs) continue;
        }

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
          sequence_name: "Default B2B Sequence",
          lead_sequence_id: null,
          channel: "email",
          step_type: "first",
          approval_mode: false,
          last_contacted_at: lead.lastContactedAt,
          rep_id: lead.userId,
          timezone: null,
          mode: "send",
        });
      }
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
