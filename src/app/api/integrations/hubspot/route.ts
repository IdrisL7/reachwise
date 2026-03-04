import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { getHubSpotAuthUrl } from "@/lib/integrations/hubspot";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** GET /api/integrations/hubspot — get connection status + auth URL */
export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  const [integration] = await db
    .select({
      id: schema.integrations.id,
      status: schema.integrations.status,
      lastSyncAt: schema.integrations.lastSyncAt,
      createdAt: schema.integrations.createdAt,
    })
    .from(schema.integrations)
    .where(eq(schema.integrations.provider, "hubspot"))
    .limit(1);

  return NextResponse.json({
    connected: !!integration && integration.status === "active",
    integration: integration ?? null,
    auth_url: getHubSpotAuthUrl(),
  });
}

/** DELETE /api/integrations/hubspot — disconnect HubSpot */
export async function DELETE(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  const [integration] = await db
    .select()
    .from(schema.integrations)
    .where(eq(schema.integrations.provider, "hubspot"))
    .limit(1);

  if (!integration) {
    return NextResponse.json(
      { status: "error", code: "NOT_CONNECTED", message: "HubSpot is not connected." },
      { status: 400 },
    );
  }

  await db
    .update(schema.integrations)
    .set({ status: "disconnected", updatedAt: new Date().toISOString() })
    .where(eq(schema.integrations.id, integration.id));

  return NextResponse.json({ status: "ok", disconnected: true });
}
