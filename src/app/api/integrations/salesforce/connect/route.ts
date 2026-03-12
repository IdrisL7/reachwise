import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSalesforceAuthUrl } from "@/lib/integrations/salesforce";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  try {
    const authUrl = getSalesforceAuthUrl(session.user.id);
    return NextResponse.redirect(authUrl);
  } catch {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return NextResponse.redirect(`${appUrl}/app/settings/integrations?error=salesforce_not_configured`);
  }
}
