import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** GET /api/templates — list user templates */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await db
    .select()
    .from(schema.userTemplates)
    .where(eq(schema.userTemplates.userId, session.user.id))
    .orderBy(schema.userTemplates.createdAt);

  return NextResponse.json({ templates });
}

/** POST /api/templates — create a user template */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, signal, trigger, hook, promise } = body;

  if (!title || !signal || !trigger || !hook) {
    return NextResponse.json(
      { error: "title, signal, trigger, and hook are required." },
      { status: 400 },
    );
  }

  const [template] = await db
    .insert(schema.userTemplates)
    .values({
      userId: session.user.id,
      title,
      signal,
      trigger,
      hook,
      promise: promise || null,
    })
    .returning();

  return NextResponse.json({ template }, { status: 201 });
}
