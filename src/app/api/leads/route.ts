import { NextRequest, NextResponse } from "next/server";
import { validateBearerToken, unauthorized } from "@/lib/followup/auth";
import { db, schema } from "@/lib/db";
import { eq, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const body = await request.json();
    const items = body.leads;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { status: "error", code: "INVALID_BODY", message: "Request body must include a non-empty 'leads' array." },
        { status: 400 },
      );
    }

    const created = [];
    for (const item of items) {
      if (!item.email?.trim()) continue;

      const values = {
        email: item.email.trim().toLowerCase(),
        name: item.name || null,
        title: item.title || null,
        companyName: item.company_name || null,
        companyWebsite: item.company_website || null,
        linkedinUrl: item.linkedin_url || null,
        source: item.source || "manual",
      };

      try {
        const [lead] = await db.insert(schema.leads).values(values).returning();
        created.push(lead);
      } catch (err: any) {
        if (err?.message?.includes("UNIQUE")) {
          // Lead with this email already exists, skip
          continue;
        }
        throw err;
      }
    }

    return NextResponse.json({ created: created.length, leads: created }, { status: 201 });
  } catch (error) {
    console.error("Error creating leads:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to create leads." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!validateBearerToken(request)) return unauthorized();

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

    let query = db.select().from(schema.leads);

    if (status) {
      query = query.where(eq(schema.leads.status, status as any)) as any;
    }

    const leads = await (query as any).limit(limit);

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Error listing leads:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to list leads." },
      { status: 500 },
    );
  }
}
