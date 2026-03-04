import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { getSalesforceAuthUrl } from "@/lib/integrations/salesforce";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** GET /api/integrations/salesforce — get connection status + auth URL */
export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  const [integration] = await db
    .select({
      id: schema.integrations.id,
      status: schema.integrations.status,
      instanceUrl: schema.integrations.instanceUrl,
      lastSyncAt: schema.integrations.lastSyncAt,
      createdAt: schema.integrations.createdAt,
    })
    .from(schema.integrations)
    .where(eq(schema.integrations.provider, "salesforce"))
    .limit(1);

  return NextResponse.json({
    connected: !!integration && integration.status === "active",
    integration: integration ?? null,
    auth_url: getSalesforceAuthUrl(),
  });
}

/** DELETE /api/integrations/salesforce — disconnect Salesforce */
export async function DELETE(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  const [integration] = await db
    .select()
    .from(schema.integrations)
    .where(eq(schema.integrations.provider, "salesforce"))
    .limit(1);

  if (!integration) {
    return NextResponse.json(
      { status: "error", code: "NOT_CONNECTED", message: "Salesforce is not connected." },
      { status: 400 },
    );
  }

  await db
    .update(schema.integrations)
    .set({ status: "disconnected", updatedAt: new Date().toISOString() })
    .where(eq(schema.integrations.id, integration.id));

  return NextResponse.json({ status: "ok", disconnected: true });
}
