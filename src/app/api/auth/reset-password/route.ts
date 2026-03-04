import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(getClientIp(request), "auth:reset-password");
  if (rateLimited) return rateLimited;

  try {
    const { token, email, password } = await request.json();
    const normalizedEmail = email?.trim().toLowerCase();

    if (!token || !normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Token, email, and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    // Find the token
    const [resetToken] = await db
      .select()
      .from(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, `reset:${normalizedEmail}`),
          eq(schema.verificationTokens.token, token),
        ),
      )
      .limit(1);

    if (!resetToken) {
      return NextResponse.json(
        { error: "Invalid or expired reset link." },
        { status: 400 },
      );
    }

    // Check expiry
    if (new Date(resetToken.expires) < new Date()) {
      // Clean up expired token
      await db
        .delete(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, `reset:${normalizedEmail}`),
            eq(schema.verificationTokens.token, token),
          ),
        );
      return NextResponse.json(
        { error: "Reset link has expired. Please request a new one." },
        { status: 400 },
      );
    }

    // Update password and mark password change time (invalidates existing sessions)
    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(schema.users)
      .set({
        passwordHash,
        passwordChangedAt: new Date().toISOString(),
      })
      .where(eq(schema.users.email, normalizedEmail));

    // Delete the used token
    await db
      .delete(schema.verificationTokens)
      .where(
        and(
          eq(schema.verificationTokens.identifier, `reset:${normalizedEmail}`),
          eq(schema.verificationTokens.token, token),
        ),
      );

    return NextResponse.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
