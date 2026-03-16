import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, gte, lt, count, avg, sql } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const now = new Date();

  // Last month boundaries
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

  // 7-day sparkline boundaries
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [
    totalResult,
    lastMonthResult,
    qualityResult,
    tierAResult,
    userRow,
    sparkRows,
    trendingRows,
  ] = await Promise.all([
    // Total hooks ever
    db
      .select({ value: count() })
      .from(schema.generatedHooks)
      .where(eq(schema.generatedHooks.userId, userId)),

    // Last month hooks (for delta)
    db
      .select({ value: count() })
      .from(schema.generatedHooks)
      .where(
        and(
          eq(schema.generatedHooks.userId, userId),
          gte(schema.generatedHooks.createdAt, lastMonthStart.toISOString()),
          lt(schema.generatedHooks.createdAt, lastMonthEnd.toISOString()),
        ),
      ),

    // Avg quality score
    db
      .select({ value: avg(schema.generatedHooks.qualityScore) })
      .from(schema.generatedHooks)
      .where(eq(schema.generatedHooks.userId, userId)),

    // Tier A count
    db
      .select({ value: count() })
      .from(schema.generatedHooks)
      .where(
        and(
          eq(schema.generatedHooks.userId, userId),
          eq(schema.generatedHooks.evidenceTier, "A"),
        ),
      ),

    // hooksUsedThisMonth from users table
    db
      .select({ hooksUsedThisMonth: schema.users.hooksUsedThisMonth })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1),

    // Sparkline: last 7 days, hooks per day
    db
      .select({
        day: sql<string>`strftime('%Y-%m-%d', ${schema.generatedHooks.createdAt})`.as("day"),
        count: count(),
      })
      .from(schema.generatedHooks)
      .where(
        and(
          eq(schema.generatedHooks.userId, userId),
          gte(schema.generatedHooks.createdAt, sevenDaysAgo.toISOString()),
        ),
      )
      .groupBy(sql`strftime('%Y-%m-%d', ${schema.generatedHooks.createdAt})`),

    // Trending accounts: top 3 scored leads for this user
    db
      .select({
        companyName: schema.leads.companyName,
        score: schema.leadScores.score,
        temperature: schema.leadScores.temperature,
        lastScoredAt: schema.leadScores.lastScoredAt,
      })
      .from(schema.leadScores)
      .innerJoin(schema.leads, eq(schema.leadScores.leadId, schema.leads.id))
      .where(eq(schema.leads.userId, userId))
      .orderBy(sql`${schema.leadScores.score} DESC`)
      .limit(3),
  ]);

  const hooksTotal = totalResult[0]?.value ?? 0;
  const hooksLastMonth = lastMonthResult[0]?.value ?? 0;
  const hooksThisMonth = userRow[0]?.hooksUsedThisMonth ?? 0;
  const avgQualityRaw = qualityResult[0]?.value;
  const avgQuality = avgQualityRaw != null ? Math.round(Number(avgQualityRaw) * 10) / 10 : null;
  const tierACount = tierAResult[0]?.value ?? 0;

  // Delta % vs last month (using hooksThisMonth vs hooksLastMonth)
  let deltaPercent: number | null = null;
  if (hooksLastMonth > 0) {
    deltaPercent = Math.round(((hooksThisMonth - hooksLastMonth) / hooksLastMonth) * 100);
  } else if (hooksThisMonth > 0) {
    deltaPercent = 100;
  }

  // Build full 7-day sparkline (fill missing days with 0)
  const sparkMap = new Map<string, number>();
  for (const row of sparkRows) {
    sparkMap.set(row.day, row.count);
  }
  const sparkline: { day: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    sparkline.push({ day: key, count: sparkMap.get(key) ?? 0 });
  }

  return NextResponse.json({
    hooksTotal,
    hooksThisMonth,
    hooksLastMonth,
    deltaPercent,
    avgQuality,
    tierACount,
    sparkline,
    trendingAccounts: trendingRows.map((r) => ({
      companyName: r.companyName ?? "Unknown",
      score: r.score,
      temperature: r.temperature,
      lastScoredAt: r.lastScoredAt,
    })),
  });
}
