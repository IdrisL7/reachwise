import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ hooksUsed: 0 });
  }

  const [user] = await db
    .select({ hooksUsed: schema.users.hooksUsedThisMonth })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  return NextResponse.json({ hooksUsed: user?.hooksUsed ?? 0 });
}
