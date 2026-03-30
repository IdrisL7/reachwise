import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { sendEmail, verificationEmailHtml } from "@/lib/email/sendgrid";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already verified
  const [user] = await db
    .select({ emailVerified: schema.users.emailVerified })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  if (user?.emailVerified) {
    return NextResponse.json({ message: "Email already verified." });
  }

  const email = session.user.email.toLowerCase();

  // Delete old tokens
  await db
    .delete(schema.verificationTokens)
    .where(eq(schema.verificationTokens.identifier, `verify:${email}`));

  // Create new token
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await db.insert(schema.verificationTokens).values({
    identifier: `verify:${email}`,
    token,
    expires,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";
  const verifyUrl = `${appUrl}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`;

  await sendEmail({
    to: email,
    subject: "Verify your GetSignalHooks account",
    body: `Please verify your email address:\n\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n— The GetSignalHooks Team`,
    html: verificationEmailHtml(verifyUrl),
  });

  return NextResponse.json({ message: "Verification email sent." });
}
