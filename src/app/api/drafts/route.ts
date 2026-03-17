import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, isNull } from "drizzle-orm";

// GET /api/drafts — list pending drafts (lead-based + watchlist-based) for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lead-based drafts (outbound_messages)
  const leadRows = await db
    .select({
      id: schema.outboundMessages.id,
      leadId: schema.outboundMessages.leadId,
      body: schema.outboundMessages.body,
      createdAt: schema.outboundMessages.createdAt,
      leadName: schema.leads.name,
      leadCompany: schema.leads.companyName,
    })
    .from(schema.outboundMessages)
    .innerJoin(schema.leads, eq(schema.outboundMessages.leadId, schema.leads.id))
    .where(
      and(
        eq(schema.outboundMessages.status, "draft"),
        eq(schema.leads.userId, session.user.id),
      ),
    );

  // Watchlist-generated drafts (drafts table)
  const watchlistRows = await db
    .select()
    .from(schema.drafts)
    .where(
      and(
        eq(schema.drafts.userId, session.user.id),
        isNull(schema.drafts.approved),
      ),
    )
    .orderBy(schema.drafts.createdAt);

  const leadDrafts = leadRows.map((r) => ({
    id: r.id,
    leadId: r.leadId,
    leadName: r.leadName ?? "Unknown",
    leadCompany: r.leadCompany ?? "",
    companyName: r.leadCompany ?? "",
    preview: r.body.slice(0, 160),
    source: "manual" as const,
    createdAt: r.createdAt,
  }));

  const watchlistDrafts = watchlistRows.map((r) => ({
    id: r.id,
    leadId: null,
    leadName: r.companyName,
    leadCompany: r.domain ?? "",
    companyName: r.companyName,
    preview: r.hookText.slice(0, 160),
    source: r.source,
    watchlistId: r.watchlistId,
    createdAt: r.createdAt,
  }));

  const drafts = [...leadDrafts, ...watchlistDrafts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return NextResponse.json({ drafts });
}
