import { NextRequest, NextResponse } from "next/server";
import { exchangeHubSpotCode } from "@/lib/integrations/hubspot";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/** GET /api/integrations/hubspot/callback — OAuth callback handler */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/setup?error=hubspot_denied&message=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.json(
      { status: "error", message: "Missing authorization code" },
      { status: 400 },
    );
  }

  try {
    const tokens = await exchangeHubSpotCode(code);
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    // Check for existing HubSpot integration
    const [existing] = await db
      .select()
      .from(schema.integrations)
      .where(eq(schema.integrations.provider, "hubspot"))
      .limit(1);

    if (existing) {
      // Update existing
      await db
        .update(schema.integrations)
        .set({
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          tokenExpiresAt: expiresAt,
          status: "active",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.integrations.id, existing.id));
    } else {
      // Create new
      await db.insert(schema.integrations).values({
        provider: "hubspot",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: "crm.objects.contacts.read crm.objects.contacts.write",
        status: "active",
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/setup?success=hubspot_connected`);
  } catch (err) {
    console.error("HubSpot OAuth callback error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${appUrl}/setup?error=hubspot_failed&message=${encodeURIComponent((err as Error).message)}`,
    );
  }
}
