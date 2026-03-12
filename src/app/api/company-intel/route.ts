import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkFeature, featureError } from "@/lib/tier-guard";
import { getCompanyIntelligence } from "@/lib/company-intel";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimit(getClientIp(request), "auth:company-intel");
    if (rl) return rl;

    const tierId = ((session.user as any).tierId || "starter") as "starter" | "pro" | "concierge";
    if (!checkFeature(tierId, "companyIntel")) {
      return featureError("Company Intelligence");
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url")?.trim();
    if (!url) {
      return NextResponse.json({ error: "Missing url query param" }, { status: 400 });
    }

    const tavilyApiKey = process.env.TAVILY_API_KEY;
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (!tavilyApiKey || !claudeApiKey) {
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    const fullAccess = tierId === "pro" || tierId === "concierge";
    const intel = await getCompanyIntelligence(url, tavilyApiKey, claudeApiKey, fullAccess);

    return NextResponse.json(intel);
  } catch (error) {
    console.error("/api/company-intel GET failed", error);
    return NextResponse.json({ error: "Failed to fetch company intelligence" }, { status: 500 });
  }
}
