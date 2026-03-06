import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc, inArray } from "drizzle-orm";

// GET /api/notifications — list notifications
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, session.user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);

  const unreadCount = rows.filter((r) => r.read === 0).length;

  return NextResponse.json({ notifications: rows, unreadCount });
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { ids?: string[] };
  if (!body.ids || body.ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  await db
    .update(schema.notifications)
    .set({ read: 1 })
    .where(
      and(
        eq(schema.notifications.userId, session.user.id),
        inArray(schema.notifications.id, body.ids),
      ),
    );

  return NextResponse.json({ updated: body.ids.length });
}
