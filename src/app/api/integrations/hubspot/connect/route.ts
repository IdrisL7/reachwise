import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getHubSpotAuthUrl } from "@/lib/integrations/hubspot";

/** GET /api/integrations/hubspot/connect — redirect to HubSpot OAuth */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  try {
    const authUrl = getHubSpotAuthUrl(session.user.id);
    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("HubSpot connect error:", err);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/app/settings?error=hubspot_not_configured`);
  }
}
