import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeHubSpotCode } from "@/lib/integrations/hubspot";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

/** GET /api/integrations/hubspot/callback — OAuth callback handler */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${appUrl}/app/settings?error=hubspot_denied`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/app/settings?error=hubspot_missing_code`,
    );
  }

  // Get the current user
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  try {
    const tokens = await exchangeHubSpotCode(code);
    const expiresAt = new Date(
      Date.now() + tokens.expires_in * 1000,
    ).toISOString();

    // Check for existing HubSpot integration for this user
    const [existing] = await db
      .select()
      .from(schema.integrations)
      .where(
        and(
          eq(schema.integrations.provider, "hubspot"),
          eq(schema.integrations.userId, session.user.id),
        ),
      )
      .limit(1);

    if (existing) {
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
      await db.insert(schema.integrations).values({
        userId: session.user.id,
        provider: "hubspot",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: expiresAt,
        scopes: "crm.objects.contacts.read crm.objects.contacts.write",
        status: "active",
      });
    }

    return NextResponse.redirect(`${appUrl}/app/settings?success=hubspot_connected`);
  } catch (err) {
    console.error("HubSpot OAuth callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/app/settings?error=hubspot_failed`,
    );
  }
}
