import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Generate a simple HMAC-based unsubscribe token (no DB storage needed)
export function generateUnsubscribeToken(email: string): string {
  const secret = process.env.AUTH_SECRET || "fallback-secret";
  const hmac = crypto.createHmac("sha256", secret).update(email).digest("hex");
  return hmac.slice(0, 32);
}

export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = generateUnsubscribeToken(email);
  return token === expected;
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase();
  const token = req.nextUrl.searchParams.get("token");

  if (!email || !token) {
    return NextResponse.redirect(new URL("/?error=invalid-link", req.url));
  }

  if (!verifyUnsubscribeToken(email, token)) {
    return NextResponse.redirect(new URL("/?error=invalid-link", req.url));
  }

  // Mark user as unsubscribed
  await db
    .update(schema.users)
    .set({ unsubscribedAt: new Date().toISOString() })
    .where(eq(schema.users.email, email));

  return NextResponse.redirect(new URL("/unsubscribed", req.url));
}

// POST to resubscribe
export async function POST(req: NextRequest) {
  const { email, token } = await req.json();

  if (!email || !token || !verifyUnsubscribeToken(email.toLowerCase(), token)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await db
    .update(schema.users)
    .set({ unsubscribedAt: null })
    .where(eq(schema.users.email, email.toLowerCase()));

  return NextResponse.json({ message: "Resubscribed successfully." });
}
