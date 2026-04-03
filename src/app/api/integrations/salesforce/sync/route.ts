import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { auth } from "@/lib/auth";
import { syncSalesforce } from "@/lib/integrations/salesforce";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

/** POST /api/integrations/salesforce/sync — trigger a bidirectional sync */
export async function POST(request: NextRequest) {
  const session = await auth();
  const hasBearerToken = validateBearerToken(request);
  if (!session?.user?.id && !hasBearerToken) return unauthorized();

  try {
    const body = await request.json().catch(() => ({})) as { integrationId?: string };
    const integrationId = body.integrationId?.trim();

    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(
        session?.user?.id
          ? and(
              eq(schema.integrations.provider, "salesforce"),
              eq(schema.integrations.userId, session.user.id),
            )
          : integrationId
            ? and(
                eq(schema.integrations.provider, "salesforce"),
                eq(schema.integrations.id, integrationId),
              )
            : and(eq(schema.integrations.provider, "salesforce"), eq(schema.integrations.id, "__missing__")),
      )
      .limit(1);

    if (!integration) {
      return NextResponse.json(
        {
          status: "error",
          code: "NOT_CONNECTED",
          message: session?.user?.id
            ? "Salesforce is not connected. Complete the OAuth flow first."
            : "integrationId is required for bearer-token sync requests.",
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
      { status: "error", code: "SYNC_FAILED", message: "Salesforce sync failed." },
      { status: 500 },
    );
  }
}
