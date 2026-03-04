import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await db
    .select()
    .from(schema.leads)
    .where(eq(schema.leads.userId, session.user.id));

  const headers = [
    "email",
    "name",
    "title",
    "company_name",
    "company_website",
    "status",
    "sequence_step",
    "last_contacted_at",
    "created_at",
  ];

  const rows = leads.map((lead) =>
    [
      lead.email,
      lead.name || "",
      lead.title || "",
      lead.companyName || "",
      lead.companyWebsite || "",
      lead.status,
      String(lead.sequenceStep),
      lead.lastContactedAt || "",
      lead.createdAt,
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(","),
  );

  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
