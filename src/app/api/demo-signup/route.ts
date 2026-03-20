import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = (body?.email || "").trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    // Upsert — ignore duplicates
    await db.insert(schema.demoSignups).values({
      email,
      source: "demo_gate",
    }).onConflictDoNothing();

    return NextResponse.json({ redirect: `/register?email=${encodeURIComponent(email)}` });
  } catch (err) {
    console.error("[demo-signup]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
