import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

// GET /api/drafts — list draft messages for the current user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
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

  const drafts = rows.map((r) => ({
    id: r.id,
    leadId: r.leadId,
    leadName: r.leadName ?? "Unknown",
    leadCompany: r.leadCompany ?? "",
    preview: r.body.slice(0, 120),
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ drafts });
}
