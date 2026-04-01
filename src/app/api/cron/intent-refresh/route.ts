import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { db, schema } from "@/lib/db";
import { eq, lt, isNull, or } from "drizzle-orm";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";
import { getClaudeApiKey } from "@/lib/env";

export async function GET(req: NextRequest) {
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

  const exaApiKey = process.env.EXA_API_KEY;
  const claudeApiKey = getClaudeApiKey();

  if (!exaApiKey || !claudeApiKey) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const leadsToScore = await db
    .select({
      id: schema.leads.id,
      companyWebsite: schema.leads.companyWebsite,
      companyName: schema.leads.companyName,
      lastScoredAt: schema.leadScores.lastScoredAt,
    })
    .from(schema.leads)
    .leftJoin(schema.leadScores, eq(schema.leads.id, schema.leadScores.leadId))
    .where(
      or(
        isNull(schema.leadScores.lastScoredAt),
        lt(schema.leadScores.lastScoredAt, oneDayAgo),
      ),
    )
    .limit(50);

  let scored = 0;
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  for (const lead of leadsToScore) {
    if (!lead.companyWebsite && !lead.companyName) continue;

    try {
      const companyUrl = lead.companyWebsite || "";
      const companyName = lead.companyName || companyUrl;

      const signals = await researchIntentSignals(companyUrl, companyName, exaApiKey, claudeApiKey);

      await db.delete(schema.intentSignals).where(eq(schema.intentSignals.leadId, lead.id));

      for (const signal of signals) {
        const contribution = Math.round(
          ({ hiring: 25, funding: 20, tech_change: 15, growth: 15, news: 10 }[signal.type] || 10) * signal.confidence,
        );

        await db.insert(schema.intentSignals).values({
          leadId: lead.id,
          companyUrl,
          signalType: signal.type,
          summary: signal.summary,
          confidence: signal.confidence,
          sourceUrl: signal.sourceUrl,
          rawEvidence: signal.rawEvidence,
          detectedAt: signal.detectedAt,
          scoreContribution: contribution,
          expiresAt,
        });
      }

      const score = computeIntentScore(signals);
      const temperature = getTemperature(score);

      await db
        .insert(schema.leadScores)
        .values({
          leadId: lead.id,
          score,
          temperature,
          signalsCount: signals.length,
          lastScoredAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.leadScores.leadId,
          set: { score, temperature, signalsCount: signals.length, lastScoredAt: now, updatedAt: now },
        });

      scored++;
    } catch {
      // Continue on individual lead failure
    }
  }

  // Clean up expired signals
  await db.delete(schema.intentSignals).where(lt(schema.intentSignals.expiresAt, now));

  return NextResponse.json({
    scored,
    total: leadsToScore.length,
    timestamp: now,
  });
}
