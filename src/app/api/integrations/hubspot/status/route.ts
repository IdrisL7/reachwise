import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/** GET /api/integrations/hubspot/status — check connection status for current user */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ connected: false }, { status: 401 });
  }

  const [integration] = await db
    .select({
      id: schema.integrations.id,
      status: schema.integrations.status,
      lastSyncAt: schema.integrations.lastSyncAt,
    })
    .from(schema.integrations)
    .where(
      and(
        eq(schema.integrations.provider, "hubspot"),
        eq(schema.integrations.userId, session.user.id),
      ),
    )
    .limit(1);

  return NextResponse.json({
    connected: !!integration && integration.status === "active",
    lastSyncAt: integration?.lastSyncAt || null,
  });
}
