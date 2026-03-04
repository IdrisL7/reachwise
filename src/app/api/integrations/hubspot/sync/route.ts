import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { syncHubSpot } from "@/lib/integrations/hubspot";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** POST /api/integrations/hubspot/sync — trigger a bidirectional sync */
export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.provider, "hubspot"))
      .limit(1);

    if (!integration) {
      return NextResponse.json(
        {
          status: "error",
          code: "NOT_CONNECTED",
          message: "HubSpot is not connected. Complete the OAuth flow first.",
        },
        { status: 400 },
      );
    }

    if (integration.status !== "active") {
      return NextResponse.json(
        {
          status: "error",
          code: "INTEGRATION_INACTIVE",
          message: `HubSpot integration status: ${integration.status}. Reconnect to fix.`,
        },
        { status: 400 },
      );
    }

    const results = await syncHubSpot(integration.id);

    return NextResponse.json({
      status: "ok",
      sync: results,
      last_sync_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("HubSpot sync error:", error);
    return NextResponse.json(
      { status: "error", code: "SYNC_FAILED", message: (error as Error).message },
      { status: 500 },
    );
  }
}
