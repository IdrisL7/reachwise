import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeSalesforceCode } from "@/lib/integrations/salesforce";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

/** GET /api/integrations/salesforce/callback — OAuth callback handler */
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${appUrl}/app/settings/integrations?error=salesforce_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${appUrl}/app/settings/integrations?error=salesforce_missing_code`);
  }

  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(`${appUrl}/login`);

  // Validate OAuth state parameter to prevent CSRF
  const state = url.searchParams.get("state");
  if (!state || state !== session.user.id) {
    return NextResponse.redirect(`${appUrl}/app/settings/integrations?error=salesforce_invalid_state`);
  }

  try {
    const tokens = await exchangeSalesforceCode(code);

    const [existing] = await db
      .select()
      .from(schema.integrations)
      .where(and(eq(schema.integrations.provider, "salesforce"), eq(schema.integrations.userId, session.user.id)))
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
        userId: session.user.id,
        provider: "salesforce",
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        instanceUrl: tokens.instance_url,
        scopes: "api refresh_token",
        status: "active",
      });
    }

    return NextResponse.redirect(`${appUrl}/app/settings/integrations?success=salesforce_connected`);
  } catch (err) {
    console.error("Salesforce OAuth callback error:", err);
    return NextResponse.redirect(`${appUrl}/app/settings/integrations?error=salesforce_failed`);
  }
}
