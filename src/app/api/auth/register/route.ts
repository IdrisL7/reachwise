import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendEmail, verificationEmailHtml } from "@/lib/email/sendgrid";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace-helpers";

/** POST /api/auth/register — create a new account */
export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit(getClientIp(request), "auth:register");
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim() || null;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }

    // Check for existing user
    const [existing] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await db
      .insert(schema.users)
      .values({
        email,
        name,
        passwordHash,
        tierId: "free",
        trialEndsAt: null,
        hooksUsedThisMonth: 0,
        hooksResetAt: new Date().toISOString(),
      })
      .returning({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        tierId: schema.users.tierId,
      });

    // Create default workspace for the new user
    await getOrCreateDefaultWorkspace(user.id);

    // Send verification email
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    await db.insert(schema.verificationTokens).values({
      identifier: `verify:${email}`,
      token: verifyToken,
      expires,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
    const verifyUrl = `${appUrl}/api/auth/verify-email?token=${verifyToken}&email=${encodeURIComponent(email)}`;

    await sendEmail({
      to: email,
      subject: "Verify your GetSignalHooks account",
      body: `Welcome to GetSignalHooks!\n\nPlease verify your email address:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— The GetSignalHooks Team`,
      html: verificationEmailHtml(verifyUrl),
    }).catch((err) => {
      console.error("Failed to send verification email:", err);
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    Sentry.captureException(error);
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 },
    );
  }
}
