import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ connected: false }, { status: 401 });

  const [integration] = await db
    .select({ id: schema.integrations.id, status: schema.integrations.status, lastSyncAt: schema.integrations.lastSyncAt })
    .from(schema.integrations)
    .where(and(eq(schema.integrations.provider, "salesforce"), eq(schema.integrations.userId, session.user.id)))
    .limit(1);

  return NextResponse.json({
    connected: !!integration && integration.status === "active",
    lastSyncAt: integration?.lastSyncAt || null,
  });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [integration] = await db
    .select({ id: schema.integrations.id })
    .from(schema.integrations)
    .where(and(eq(schema.integrations.provider, "salesforce"), eq(schema.integrations.userId, session.user.id)))
    .limit(1);

  if (!integration) return NextResponse.json({ disconnected: true });

  await db.update(schema.integrations)
    .set({ status: "disconnected", updatedAt: new Date().toISOString() })
    .where(eq(schema.integrations.id, integration.id));

  return NextResponse.json({ disconnected: true });
}
