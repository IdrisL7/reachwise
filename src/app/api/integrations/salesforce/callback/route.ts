import { NextRequest, NextResponse } from "next/server";
import { exchangeSalesforceCode } from "@/lib/integrations/salesforce";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

/** GET /api/integrations/salesforce/callback — OAuth callback handler */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/setup?error=salesforce_denied&message=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.json(
      { status: "error", message: "Missing authorization code" },
      { status: 400 },
    );
  }

  try {
    const tokens = await exchangeSalesforceCode(code);

    // Check for existing Salesforce integration
    const [existing] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.provider, "salesforce"))
      .limit(1);

    if (existing) {
      await db
        .update(schema.integrations)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          instanceUrl: tokens.instance_url,
          status: "active",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.integrations.id, existing.id));
    } else {
      await db.insert(schema.integrations).values({
        provider: "salesforce",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        instanceUrl: tokens.instance_url,
        scopes: "api refresh_token",
        status: "active",
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/setup?success=salesforce_connected`);
  } catch (err) {
    console.error("Salesforce OAuth callback error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/setup?error=salesforce_failed&message=${encodeURIComponent((err as Error).message)}`,
    );
  }
}
