import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/lib/db";
import { eq, and, isNull, lte, gte, sql } from "drizzle-orm";
import { sendEmail, brandedHtml } from "@/lib/email/sendgrid";
import { generateUnsubscribeToken } from "@/app/api/auth/unsubscribe/route";

// Onboarding email sequence — triggered by Vercel Cron or external scheduler
// Sends emails based on days since registration:
//   Day 0: Welcome (sent inline during registration via verification email)
//   Day 1: "Generate your first hooks" nudge
//   Day 3: "Import your leads" nudge
//   Day 6: Upgrade nudge (Free only)

const ONBOARDING_EMAILS = [
  {
    daysSinceSignup: 1,
    tag: "onboarding_day1",
    subject: "Generate your first evidence-backed hooks",
    body: (name: string) =>
      `Hi ${name || "there"},\n\nWelcome to GetSignalHooks! Here's how to get started:\n\n1. Go to your dashboard: https://www.getsignalhooks.com/app/hooks\n2. Paste any company URL\n3. Get evidence-backed hooks in seconds\n\nEach hook is anchored on a real public signal — earnings, hiring, tech changes — so your outreach is always relevant.\n\nTry it now with one of your target accounts.\n\n— The GetSignalHooks Team`,
  },
  {
    daysSinceSignup: 3,
    tag: "onboarding_day3",
    subject: "Import your leads and run hooks at scale",
    body: (name: string) =>
      `Hi ${name || "there"},\n\nDid you know you can upload your entire lead list?\n\n1. Go to Leads: https://www.getsignalhooks.com/app/leads\n2. Upload a CSV from Apollo, Clay, or any spreadsheet\n3. Use Batch Mode to generate hooks for up to 75 companies at once\n\nYour hooks include evidence snippets and source citations — everything you need to write messages that get replies.\n\n— The GetSignalHooks Team`,
  },
  {
    daysSinceSignup: 6,
    tag: "onboarding_day6_trial",
    subject: "Your trial ends tomorrow — here's what you'll keep",
    tierFilter: "free" as const,
    body: (name: string) =>
      `Hi ${name || "there"},\n\nYou've been using GetSignalHooks for almost a week — nice!\n\nReady for more? Upgrade to Pro ($79/month) for:\n- 750 hooks per month\n- Multi-channel sequences\n- Intent scoring + lead discovery\n- CSV export (Apollo, Clay, Instantly)\n\nUpgrade now: https://www.getsignalhooks.com/#pricing\n\nManage your account: https://www.getsignalhooks.com/app/settings\n\n— The GetSignalHooks Team`,
  },
];

export async function GET(req: NextRequest) {
  // Vercel Cron sends CRON_SECRET in the Authorization header
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expected = `Bearer ${cronSecret}`;
  const isValid =
    authHeader.length === expected.length &&
    timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sent = 0;

  for (const email of ONBOARDING_EMAILS) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - email.daysSinceSignup);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Find users who registered on the target date
    const conditions = [
      gte(schema.users.createdAt, dayStart.toISOString()),
      lte(schema.users.createdAt, dayEnd.toISOString()),
    ];

    if (email.tierFilter) {
      conditions.push(eq(schema.users.tierId, email.tierFilter));
    }

    const users = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        unsubscribedAt: schema.users.unsubscribedAt,
      })
      .from(schema.users)
      .where(and(...conditions));

    for (const user of users) {
      // Skip unsubscribed users
      if (user.unsubscribedAt) continue;
      // Check if this email was already sent (via usage_events)
      const [alreadySent] = await db
        .select({ id: schema.usageEvents.id })
        .from(schema.usageEvents)
        .where(
          and(
            eq(schema.usageEvents.userId, user.id),
            eq(schema.usageEvents.event, "email_sent"),
            sql`json_extract(metadata, '$.tag') = ${email.tag}`,
          ),
        )
        .limit(1);

      if (alreadySent) continue;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://www.getsignalhooks.com";
      const unsubToken = generateUnsubscribeToken(user.email);
      const unsubUrl = `${appUrl}/api/auth/unsubscribe?email=${encodeURIComponent(user.email)}&token=${unsubToken}`;
      const plainBody = email.body(user.name || "");
      const bodyWithUnsub = plainBody + `\n\n---\nDon't want these emails? Unsubscribe: ${unsubUrl}`;

      const result = await sendEmail({
        to: user.email,
        subject: email.subject,
        body: bodyWithUnsub,
        html: brandedHtml(plainBody, unsubUrl),
        userId: user.id,
      });

      if (result.success) {
        // Track that this onboarding email was sent
        await db.insert(schema.usageEvents).values({
          userId: user.id,
          event: "email_sent",
          metadata: { tag: email.tag, subject: email.subject },
        });
        sent++;
      }
    }
  }

  return NextResponse.json({ sent, timestamp: new Date().toISOString() });
}
