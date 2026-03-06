import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// POST /api/drafts/[id]/approve — approve a draft message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Find the draft message
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

  // Update message status to queued (or sent for email if you have direct send)
  await db
    .update(schema.outboundMessages)
    .set({ status: "queued", sentAt: now })
    .where(eq(schema.outboundMessages.id, id));

  // Advance lead sequence if lead has one
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

  // Update lead's last contacted
  await db
    .update(schema.leads)
    .set({ lastContactedAt: now, updatedAt: now })
    .where(eq(schema.leads.id, lead.id));

  // Create audit log
  await db.insert(schema.auditLog).values({
    userId: session.user.id,
    leadId: lead.id,
    event: "draft_approved",
    reason: "User approved draft from inbox",
    metadata: JSON.stringify({ messageId: id, channel: message.channel }),
  });

  // Delete related draft_pending notification
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
