import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

    const conditions = [eq(schema.leads.userId, session.user.id)];
    if (status) {
      conditions.push(eq(schema.leads.status, status as any));
    }

    const rows = await db
      .select({
        lead: schema.leads,
        score: schema.leadScores.score,
        temperature: schema.leadScores.temperature,
        signalsCount: schema.leadScores.signalsCount,
        lastScoredAt: schema.leadScores.lastScoredAt,
      })
      .from(schema.leads)
      .leftJoin(schema.leadScores, eq(schema.leads.id, schema.leadScores.leadId))
      .where(and(...conditions))
      .orderBy(desc(schema.leadScores.score))
      .limit(limit);

    const leads = rows.map((r) => ({
      ...r.lead,
      intentScore: r.score ?? null,
      temperature: r.temperature ?? null,
      signalsCount: r.signalsCount ?? 0,
      lastScoredAt: r.lastScoredAt ?? null,
    }));

    return NextResponse.json({ leads });
  } catch (error) {
    console.error("Error listing leads:", error);
    return NextResponse.json(
      { status: "error", code: "SERVER_ERROR", message: "Failed to list leads." },
      { status: 500 },
    );
  }
}
