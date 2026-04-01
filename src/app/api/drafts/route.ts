import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";
import { extractPreviousSequenceMetadata } from "@/lib/followup/generate";

// GET /api/drafts — list pending drafts (lead-based + watchlist-based) for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lead-based drafts (outbound_messages) with sequence context
  const leadRows = await db
    .select({
      id: schema.outboundMessages.id,
      leadId: schema.outboundMessages.leadId,
      subject: schema.outboundMessages.subject,
      body: schema.outboundMessages.body,
      sequenceStep: schema.outboundMessages.sequenceStep,
      channel: schema.outboundMessages.channel,
      metadata: schema.outboundMessages.metadata,
      createdAt: schema.outboundMessages.createdAt,
      leadName: schema.leads.name,
      leadEmail: schema.leads.email,
      leadCompany: schema.leads.companyName,
    })
    .from(schema.outboundMessages)
    .innerJoin(schema.leads, eq(schema.outboundMessages.leadId, schema.leads.id))
    .where(
      and(
        eq(schema.outboundMessages.status, "draft"),
        eq(schema.leads.userId, session.user.id),
      ),
    );

  // Fetch sequence info for lead-based drafts
  const leadIds = [...new Set(leadRows.map((r) => r.leadId))];
  const sequenceMap = new Map<string, { sequenceName: string; totalSteps: number }>();

  if (leadIds.length > 0) {
    for (const leadId of leadIds) {
      const [ls] = await db
        .select({
          sequenceId: schema.leadSequences.sequenceId,
        })
        .from(schema.leadSequences)
        .where(
          and(
            eq(schema.leadSequences.leadId, leadId),
            eq(schema.leadSequences.status, "active"),
          ),
        )
        .limit(1);

      if (ls) {
        const [seq] = await db
          .select({
            name: schema.sequences.name,
            steps: schema.sequences.steps,
          })
          .from(schema.sequences)
          .where(eq(schema.sequences.id, ls.sequenceId))
          .limit(1);

        if (seq) {
          sequenceMap.set(leadId, {
            sequenceName: seq.name,
            totalSteps: Array.isArray(seq.steps) ? seq.steps.length : 0,
          });
        }
      }
    }
  }

  // Watchlist-generated drafts (drafts table)
  const watchlistRows = await db
    .select()
    .from(schema.drafts)
    .where(
      and(
        eq(schema.drafts.userId, session.user.id),
        isNull(schema.drafts.approved),
      ),
    )
    .orderBy(schema.drafts.createdAt);

  const leadDrafts = leadRows.map((r) => {
    const seqInfo = sequenceMap.get(r.leadId);
    const sequenceMetadata = extractPreviousSequenceMetadata(r.metadata);
    const orchestration =
      r.metadata && typeof r.metadata === "object"
        ? ((r.metadata as { orchestration?: unknown }).orchestration as Record<string, unknown> | null) ?? null
        : null;

    return {
      id: r.id,
      leadId: r.leadId,
      leadName: r.leadName ?? "Unknown",
      leadEmail: r.leadEmail ?? "",
      leadCompany: r.leadCompany ?? "",
      companyName: r.leadCompany ?? "",
      subject: r.subject ?? "",
      body: r.body,
      preview: r.body.slice(0, 160),
      sequenceStep: r.sequenceStep,
      sequenceName: seqInfo?.sequenceName ?? null,
      sequenceTotalSteps: seqInfo?.totalSteps ?? null,
      channel: r.channel,
      orchestration: orchestration
        ? {
            sequenceType: typeof orchestration.sequenceType === "string" ? orchestration.sequenceType : sequenceMetadata.sequenceType ?? null,
            previousChannel: typeof orchestration.previousChannel === "string" ? orchestration.previousChannel : sequenceMetadata.previousChannel ?? null,
            tone: typeof orchestration.tone === "string" ? orchestration.tone : sequenceMetadata.tone ?? null,
            ctaStyle: typeof orchestration.ctaStyle === "string" ? orchestration.ctaStyle : null,
            wordCountHint: typeof orchestration.wordCountHint === "number" ? orchestration.wordCountHint : null,
            sendWindow: typeof orchestration.sendWindow === "string" ? orchestration.sendWindow : null,
            reasoning: Array.isArray(orchestration.reasoning)
              ? orchestration.reasoning.filter((item): item is string => typeof item === "string")
              : [],
          }
        : null,
      source: "manual" as const,
      createdAt: r.createdAt,
    };
  });

  const watchlistDrafts = watchlistRows.map((r) => ({
    id: r.id,
    leadId: null,
    leadName: r.companyName,
    leadEmail: "",
    leadCompany: r.domain ?? "",
    companyName: r.companyName,
    subject: "",
    body: r.hookText,
    preview: r.hookText.slice(0, 160),
    sequenceStep: null,
    sequenceName: null,
    sequenceTotalSteps: null,
    channel: "email",
    source: r.source,
    watchlistId: r.watchlistId,
    createdAt: r.createdAt,
  }));

  const drafts = [...leadDrafts, ...watchlistDrafts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({ drafts });
}
