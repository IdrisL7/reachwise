import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, gte, lt, count, avg, sql } from "drizzle-orm";
import { getDomain } from "@/lib/hooks";
import { classifyRetrievalSourceType } from "@/lib/retrieval-plan";
import { getRetrievalMemorySummary } from "@/lib/retrieval-memory";

async function getAvailableTables(names: string[]) {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url || names.length === 0) {
    return new Set<string>();
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const placeholders = names.map(() => "?").join(", ");
  const result = await client.execute({
    sql: `
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN (${placeholders})
    `,
    args: names,
  });

  return new Set(result.rows.map((row) => String(row.name)));
}

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
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const availableTables = await getAvailableTables([
    "hook_outcomes",
    "user_retrieval_memory",
    "user_retrieval_pins",
    "user_sequence_memory",
  ]);
  const hasHookOutcomes = availableTables.has("hook_outcomes");
  const hasRetrievalMemory =
    availableTables.has("user_retrieval_memory") &&
    availableTables.has("user_retrieval_pins");
  const hasSequenceMemory = availableTables.has("user_sequence_memory");

  const [
    totalResult,
    lastMonthResult,
    qualityResult,
    tierAResult,
    userRow,
    sparkRows,
    trendingRows,
    retrievalRows,
    retrievalOutcomeRows,
    retrievalMemory,
    totalLeadsResult,
    activeSequencesResult,
    draftQueueResult,
    queuedMessagesResult,
    stalledSequenceRows,
    sequenceMemoryRows,
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

    db
      .select({
        sourceUrl: schema.generatedHooks.sourceUrl,
        companyUrl: schema.generatedHooks.companyUrl,
      })
      .from(schema.generatedHooks)
      .where(
        and(
          eq(schema.generatedHooks.userId, userId),
          gte(schema.generatedHooks.createdAt, thirtyDaysAgo.toISOString()),
        ),
      ),

    hasHookOutcomes
      ? db
          .select({
            generatedHookId: schema.generatedHooks.id,
            sourceUrl: schema.generatedHooks.sourceUrl,
            companyUrl: schema.generatedHooks.companyUrl,
            event: schema.hookOutcomes.event,
          })
          .from(schema.generatedHooks)
          .leftJoin(
            schema.hookOutcomes,
            and(
              eq(schema.hookOutcomes.generatedHookId, schema.generatedHooks.id),
              eq(schema.hookOutcomes.userId, userId),
              gte(schema.hookOutcomes.createdAt, thirtyDaysAgo.toISOString()),
            ),
          )
          .where(
            and(
              eq(schema.generatedHooks.userId, userId),
              gte(schema.generatedHooks.createdAt, thirtyDaysAgo.toISOString()),
            ),
          )
      : Promise.resolve([]),

    hasRetrievalMemory
      ? getRetrievalMemorySummary({ userId })
      : Promise.resolve({
          topSourcePreferences: [],
          topTriggerPreferences: [],
        }),

    db
      .select({ value: count() })
      .from(schema.leads)
      .where(eq(schema.leads.userId, userId)),

    db
      .select({ value: count() })
      .from(schema.leadSequences)
      .innerJoin(schema.leads, eq(schema.leadSequences.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.leads.userId, userId),
          eq(schema.leadSequences.status, "active"),
        ),
      ),

    db
      .select({ value: count() })
      .from(schema.outboundMessages)
      .innerJoin(schema.leads, eq(schema.outboundMessages.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.leads.userId, userId),
          eq(schema.outboundMessages.direction, "outbound"),
          eq(schema.outboundMessages.status, "draft"),
        ),
      ),

    db
      .select({ value: count() })
      .from(schema.outboundMessages)
      .innerJoin(schema.leads, eq(schema.outboundMessages.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.leads.userId, userId),
          eq(schema.outboundMessages.direction, "outbound"),
          eq(schema.outboundMessages.status, "queued"),
        ),
      ),

    db
      .select({
        leadId: schema.leads.id,
        leadName: schema.leads.name,
        leadEmail: schema.leads.email,
        companyName: schema.leads.companyName,
        sequenceName: schema.sequences.name,
        lastContactedAt: schema.leads.lastContactedAt,
        startedAt: schema.leadSequences.startedAt,
        currentStep: schema.leadSequences.currentStep,
      })
      .from(schema.leadSequences)
      .innerJoin(schema.leads, eq(schema.leadSequences.leadId, schema.leads.id))
      .innerJoin(schema.sequences, eq(schema.leadSequences.sequenceId, schema.sequences.id))
      .where(
        and(
          eq(schema.leads.userId, userId),
          eq(schema.leadSequences.status, "active"),
          sql`(
            ${schema.leads.lastContactedAt} IS NULL
            OR ${schema.leads.lastContactedAt} < ${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()}
          )`,
        ),
      )
      .orderBy(sql`COALESCE(${schema.leads.lastContactedAt}, ${schema.leadSequences.startedAt}) ASC`)
      .limit(5),

    hasSequenceMemory
      ? db
          .select({
            channel: schema.userSequenceMemory.channel,
            attemptCount: schema.userSequenceMemory.attemptCount,
            positiveReplyCount: schema.userSequenceMemory.positiveReplyCount,
            replyWinCount: schema.userSequenceMemory.replyWinCount,
            noReplyCount: schema.userSequenceMemory.noReplyCount,
          })
          .from(schema.userSequenceMemory)
          .where(eq(schema.userSequenceMemory.userId, userId))
      : Promise.resolve([]),
  ]);

  const hooksTotal = totalResult[0]?.value ?? 0;
  const hooksLastMonth = lastMonthResult[0]?.value ?? 0;
  const hooksThisMonth = userRow[0]?.hooksUsedThisMonth ?? 0;
  const avgQualityRaw = qualityResult[0]?.value;
  const avgQuality = avgQualityRaw != null ? Math.round(Number(avgQualityRaw) * 10) / 10 : null;
  const tierACount = tierAResult[0]?.value ?? 0;
  const totalLeads = totalLeadsResult[0]?.value ?? 0;
  const activeSequences = activeSequencesResult[0]?.value ?? 0;
  const draftsWaiting = draftQueueResult[0]?.value ?? 0;
  const queuedMessages = queuedMessagesResult[0]?.value ?? 0;

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

  const retrievalMix = {
    firstParty: 0,
    trustedNews: 0,
    semanticWeb: 0,
    fallbackWeb: 0,
  };

  for (const row of retrievalRows) {
    if (!row.sourceUrl) continue;
    const targetDomain = row.companyUrl ? getDomain(row.companyUrl) : null;
    const sourceType = classifyRetrievalSourceType(
      {
        url: row.sourceUrl,
        tier: "B",
        anchorScore: undefined,
        entity_hit_score: undefined,
        stale: false,
      },
      targetDomain,
    );

    if (sourceType === "first_party") retrievalMix.firstParty += 1;
    else if (sourceType === "trusted_news") retrievalMix.trustedNews += 1;
    else if (sourceType === "semantic_web") retrievalMix.semanticWeb += 1;
    else retrievalMix.fallbackWeb += 1;
  }

  const retrievalTotal =
    retrievalMix.firstParty +
    retrievalMix.trustedNews +
    retrievalMix.semanticWeb +
    retrievalMix.fallbackWeb;

  const retrievalMode =
    retrievalTotal === 0
      ? "empty"
      : retrievalMix.firstParty > 0 || retrievalMix.trustedNews > 0
        ? "hybrid"
        : "web_only";

  const retrievalOutcomes: Record<
    "firstParty" | "trustedNews" | "semanticWeb" | "fallbackWeb",
    {
      hooks: number;
      copies: number;
      emailsUsed: number;
      wins: number;
    }
  > = {
    firstParty: { hooks: 0, copies: 0, emailsUsed: 0, wins: 0 },
    trustedNews: { hooks: 0, copies: 0, emailsUsed: 0, wins: 0 },
    semanticWeb: { hooks: 0, copies: 0, emailsUsed: 0, wins: 0 },
    fallbackWeb: { hooks: 0, copies: 0, emailsUsed: 0, wins: 0 },
  };
  const countedHooks = new Set<string>();

  for (const row of retrievalOutcomeRows) {
    if (!row.sourceUrl) continue;
    const targetDomain = row.companyUrl ? getDomain(row.companyUrl) : null;
    const sourceType = classifyRetrievalSourceType(
      {
        url: row.sourceUrl,
        tier: "B",
        anchorScore: undefined,
        entity_hit_score: undefined,
        stale: false,
      },
      targetDomain,
    );
    const key =
      sourceType === "first_party"
        ? "firstParty"
        : sourceType === "trusted_news"
          ? "trustedNews"
          : sourceType === "semantic_web"
            ? "semanticWeb"
            : "fallbackWeb";

    if (!countedHooks.has(row.generatedHookId)) {
      retrievalOutcomes[key].hooks += 1;
      countedHooks.add(row.generatedHookId);
    }

    if (row.event === "copied" || row.event === "copied_with_evidence") {
      retrievalOutcomes[key].copies += 1;
    }
    if (row.event === "email_copied" || row.event === "used_in_email") {
      retrievalOutcomes[key].emailsUsed += 1;
    }
    if (row.event === "reply_win" || row.event === "positive_reply") {
      retrievalOutcomes[key].wins += 1;
    }
  }

  const sequencePerformance = sequenceMemoryRows.reduce<Record<string, {
    attempts: number;
    positiveReplies: number;
    wins: number;
    noReply: number;
  }>>((acc, row) => {
    const key = row.channel || "unknown";
    if (!acc[key]) {
      acc[key] = { attempts: 0, positiveReplies: 0, wins: 0, noReply: 0 };
    }
    acc[key].attempts += Number(row.attemptCount ?? 0);
    acc[key].positiveReplies += Number(row.positiveReplyCount ?? 0);
    acc[key].wins += Number(row.replyWinCount ?? 0);
    acc[key].noReply += Number(row.noReplyCount ?? 0);
    return acc;
  }, {});

  const topChannels = Object.entries(sequencePerformance)
    .map(([channel, stats]) => ({
      channel,
      attempts: Math.round(stats.attempts),
      positiveReplies: Math.round(stats.positiveReplies),
      wins: Math.round(stats.wins),
      noReply: Math.round(stats.noReply),
      positiveRate: stats.attempts > 0 ? Math.round((stats.positiveReplies / stats.attempts) * 100) : 0,
      winRate: stats.attempts > 0 ? Math.round((stats.wins / stats.attempts) * 100) : 0,
    }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 5);

  return NextResponse.json({
    hooksTotal,
    hooksThisMonth,
    hooksLastMonth,
    deltaPercent,
    avgQuality,
    tierACount,
    sparkline,
    retrieval: {
      windowDays: 30,
      total: retrievalTotal,
      mode: retrievalMode,
      mix: retrievalMix,
      outcomes: retrievalOutcomes,
      memory: retrievalMemory,
    },
    workflow: {
      totalLeads,
      activeSequences,
      draftsWaiting,
      queuedMessages,
      stalledLeads: stalledSequenceRows.map((row) => ({
        leadId: row.leadId,
        leadName: row.leadName || row.leadEmail || "Unknown",
        companyName: row.companyName || "Unknown",
        sequenceName: row.sequenceName,
        currentStep: row.currentStep,
        lastContactedAt: row.lastContactedAt,
        startedAt: row.startedAt,
      })),
      topChannels,
    },
    trendingAccounts: trendingRows.map((r) => ({
      companyName: r.companyName ?? "Unknown",
      score: r.score,
      temperature: r.temperature,
      lastScoredAt: r.lastScoredAt,
    })),
  });
}
