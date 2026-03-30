import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await db
    .delete(schema.userTemplates)
    .where(
      and(
        eq(schema.userTemplates.id, id),
        eq(schema.userTemplates.userId, session.user.id),
      ),
    );

  return NextResponse.json({ ok: true });
}
