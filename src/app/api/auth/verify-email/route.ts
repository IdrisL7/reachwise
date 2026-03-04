import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const email = request.nextUrl.searchParams.get("email")?.toLowerCase();

  if (!token || !email) {
    return NextResponse.redirect(new URL("/login?error=invalid-link", request.url));
  }

  // Find the verification token
  const [vToken] = await db
    .select()
    .from(schema.verificationTokens)
    .where(
      and(
        eq(schema.verificationTokens.identifier, `verify:${email}`),
        eq(schema.verificationTokens.token, token),
      ),
    )
    .limit(1);

  if (!vToken) {
    return NextResponse.redirect(new URL("/login?error=invalid-link", request.url));
  }

  // Check expiry
  if (new Date(vToken.expires) < new Date()) {
    await db
      .delete(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, `verify:${email}`),
          eq(schema.verificationTokens.token, token),
        ),
      );
    return NextResponse.redirect(new URL("/login?error=expired-link", request.url));
  }

  // Mark email as verified
  await db
    .update(schema.users)
    .set({ emailVerified: new Date().toISOString() })
    .where(eq(schema.users.email, email));

  // Delete the token
  await db
    .delete(schema.verificationTokens)
    .where(
      and(
        eq(schema.verificationTokens.identifier, `verify:${email}`),
        eq(schema.verificationTokens.token, token),
      ),
    );

  return NextResponse.redirect(new URL("/app?verified=true", request.url));
}
