import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// POST /api/drafts/[id]/reject — reject and delete a draft
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Find draft
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

  // Delete draft
  await db.delete(schema.outboundMessages).where(eq(schema.outboundMessages.id, id));

  // Delete notification
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
