import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// POST /api/drafts/[id]/reject — reject a draft (lead-based or watchlist-based)
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
      .set({ approved: 0 })
      .where(eq(schema.drafts.id, id));
    return NextResponse.json({ ok: true });
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

  // Verify lead ownership
  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, message.leadId), eq(schema.leads.userId, session.user.id)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await db.delete(schema.outboundMessages).where(eq(schema.outboundMessages.id, id));

  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.messageId, id),
        eq(schema.notifications.userId, session.user.id),
      ),
    );

  return NextResponse.json({ ok: true });
}
