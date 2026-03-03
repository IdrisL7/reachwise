import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { prospectDb, prospectSchema } from "@/lib/prospect-agent/db";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();
    const { query, location, limit = 10 } = body;

    if (!query?.trim()) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "query is required." },
        { status: 400 },
      );
    }

    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { status: "error", code: "CONFIG_ERROR", message: "BRAVE_API_KEY not set." },
        { status: 500 },
      );
    }

    // Build search query targeting LinkedIn profiles
    const searchQuery = location
      ? `site:linkedin.com/in ${query} ${location}`
      : `site:linkedin.com/in ${query}`;

    const count = Math.min(Math.max(limit, 1), 20);

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=${count}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": apiKey,
        },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { status: "error", code: "SEARCH_ERROR", message: `Brave API returned ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const results = data.web?.results ?? [];

    // Extract prospect info from LinkedIn search results
    const prospects = results
      .filter((r: any) => r.url?.includes("linkedin.com/in/"))
      .map((r: any) => {
        const title = r.title || "";
        // LinkedIn titles typically: "Name - Title - Company | LinkedIn"
        const parts = title.split(" - ");
        const name = parts[0]?.replace(" | LinkedIn", "").trim() || null;
        const headline = parts.slice(1).join(" - ").replace(" | LinkedIn", "").trim() || null;

        // Try to extract company from headline
        const companyMatch = headline?.split(" at ")?.pop()?.split(" | ")[0]?.trim();

        const description = r.description || "";

        return {
          name,
          linkedinUrl: r.url,
          linkedinHeadline: headline,
          companyName: companyMatch || null,
          snippet: description.slice(0, 200),
        };
      });

    // Upsert prospects into prospect_leads table
    const created: any[] = [];
    const skipped: any[] = [];

    for (const prospect of prospects) {
      if (!prospect.linkedinUrl) continue;

      const values = {
        name: prospect.name,
        companyName: prospect.companyName,
        linkedinUrl: prospect.linkedinUrl,
        linkedinHeadline: prospect.linkedinHeadline,
        source: "prospect-agent",
      };

      try {
        const [lead] = await prospectDb.insert(prospectSchema.prospectLeads).values(values).returning();
        created.push(lead);
      } catch (err: any) {
        const errStr = String(err?.message ?? "") + String(err?.cause?.message ?? "") + String(err?.cause?.code ?? "") + String(err?.code ?? "");
        if (errStr.includes("UNIQUE") || errStr.includes("SQLITE_CONSTRAINT")) {
          skipped.push({ linkedinUrl: prospect.linkedinUrl, reason: "already exists" });
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({
      status: "ok",
      query: searchQuery,
      found: prospects.length,
      created: created.length,
      skipped: skipped.length,
      leads: created,
      skipped_details: skipped,
    }, { status: 201 });
  } catch (error) {
    console.error("Prospect search error:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to search prospects." },
      { status: 500 },
    );
  }
}
