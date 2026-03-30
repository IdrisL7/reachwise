import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getLimits } from "@/lib/tier-guard";
import type { TierId } from "@/lib/tiers";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ hooksUsed: 0 });
  }

  const [user] = await db
    .select({
      hooksUsed: schema.users.hooksUsedThisMonth,
      tierId: schema.users.tierId,
      trialEndsAt: schema.users.trialEndsAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  const tierId = (user?.tierId ?? "free") as TierId;
  const limits = getLimits(tierId);

  return NextResponse.json({
    hooksUsed: user?.hooksUsed ?? 0,
    tier: tierId,
    trialEndsAt: user?.trialEndsAt ?? null,
    limits: {
      hooksPerMonth: limits.hooksPerMonth,
      batchSize: limits.batchSize,
    },
  });
}
