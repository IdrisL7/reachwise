import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// PATCH /api/notifications/[id] — mark single notification read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .update(schema.notifications)
    .set({ read: 1 })
    .where(
      and(
        eq(schema.notifications.id, id),
        eq(schema.notifications.userId, session.user.id),
      ),
    );

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(schema.notifications)
    .where(
      and(
        eq(schema.notifications.id, id),
        eq(schema.notifications.userId, session.user.id),
      ),
    );

  return NextResponse.json({ ok: true });
}
