import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { syncSalesforce } from "@/lib/integrations/salesforce";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** POST /api/integrations/salesforce/sync — trigger a bidirectional sync */
export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.provider, "salesforce"))
      .limit(1);

    if (!integration) {
      return NextResponse.json(
        {
          status: "error",
          code: "NOT_CONNECTED",
          message: "Salesforce is not connected. Complete the OAuth flow first.",
        },
        { status: 400 },
      );
    }

    if (integration.status !== "active") {
      return NextResponse.json(
        {
          status: "error",
          code: "INTEGRATION_INACTIVE",
          message: `Salesforce integration status: ${integration.status}. Reconnect to fix.`,
        },
        { status: 400 },
      );
    }

    const results = await syncSalesforce(integration.id);

    return NextResponse.json({
      status: "ok",
      sync: results,
      last_sync_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Salesforce sync error:", error);
    return NextResponse.json(
      { status: "error", code: "SYNC_FAILED", message: (error as Error).message },
      { status: 500 },
    );
  }
}
