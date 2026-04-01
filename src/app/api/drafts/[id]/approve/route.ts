import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { extractPreviousSequenceMetadata, inferTargetRoleFromLead } from "@/lib/followup/generate";
import { getLeadSegmentKey, recordSequenceOutcome } from "@/lib/followup/sequence-memory";
import { persistFollowupMessageV2 } from "@/lib/v2-dual-write";

// POST /api/drafts/[id]/approve — approve a draft (lead-based or watchlist-based)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Try watchlist draft first
  const [watchlistDraft] = await db
    .select()
    .from(schema.drafts)
    .where(
      and(
        eq(schema.drafts.id, id),
        eq(schema.drafts.userId, session.user.id),
      ),
    )
    .limit(1);

  if (watchlistDraft) {
    await db
      .update(schema.drafts)
      .set({ approved: 1 })
      .where(eq(schema.drafts.id, id));
    return NextResponse.json({ ok: true, messageId: id });
  }

  // Fall back to outbound_messages (lead-based draft)
  const [message] = await db
    .select()
    .from(schema.outboundMessages)
    .where(
      and(
        eq(schema.outboundMessages.id, id),
        eq(schema.outboundMessages.status, "draft"),
      ),
    )
    .limit(1);

  if (!message) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Verify lead belongs to user
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, message.leadId), eq(schema.leads.userId, session.user.id)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const now = new Date().toISOString();

  await db
    .update(schema.outboundMessages)
    .set({ status: "queued", sentAt: now })
    .where(eq(schema.outboundMessages.id, id));

  if (lead.userId) {
    await persistFollowupMessageV2({
      userId: lead.userId,
      companyUrl: lead.companyWebsite,
      companyName: lead.companyName,
      outboundMessageId: message.id,
      leadId: lead.id,
      subject: message.subject,
      body: message.body,
      channel: message.channel,
      stage: "queued",
      metadata: message.metadata && typeof message.metadata === "object"
        ? (message.metadata as Record<string, unknown>)
        : null,
    }).catch(() => {});
  }

  const sequenceMetadata = extractPreviousSequenceMetadata(message.metadata);
  if (
    lead.userId &&
    (message.channel === "email" ||
      message.channel === "linkedin_connection" ||
      message.channel === "linkedin_message" ||
      message.channel === "cold_call" ||
      message.channel === "video_script")
  ) {
    await recordSequenceOutcome({
      userId: lead.userId,
      targetRole: inferTargetRoleFromLead({
        email: lead.email,
        title: lead.title,
      }),
      leadSegment: getLeadSegmentKey({
        title: lead.title,
        source: lead.source,
        companyWebsite: lead.companyWebsite,
      }),
      sequenceType: sequenceMetadata.sequenceType ?? (message.sequenceStep === 0 ? "first" : "bump"),
      channel: message.channel,
      previousChannel: sequenceMetadata.previousChannel ?? null,
      event: "attempt",
    }).catch(() => {});
  }

  // Advance lead sequence step
  const [ls] = await db
    .select()
    .from(schema.leadSequences)
    .where(
      and(
        eq(schema.leadSequences.leadId, lead.id),
        eq(schema.leadSequences.status, "active"),
      ),
    )
    .limit(1);

  if (ls) {
    await db
      .update(schema.leadSequences)
      .set({ currentStep: ls.currentStep + 1 })
      .where(eq(schema.leadSequences.id, ls.id));
  }

  await db
    .update(schema.leads)
    .set({ lastContactedAt: now, updatedAt: now })
    .where(eq(schema.leads.id, lead.id));

  await db.insert(schema.auditLog).values({
    userId: session.user.id,
    leadId: lead.id,
    event: "draft_approved",
    reason: "User approved draft from inbox",
    metadata: JSON.stringify({ messageId: id, channel: message.channel }),
  });

  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.messageId, id),
        eq(schema.notifications.userId, session.user.id),
      ),
    );

  return NextResponse.json({ ok: true, messageId: id });
}
