import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { researchIntentSignals, computeIntentScore, getTemperature } from "@/lib/intent";
import { getClaudeApiKey } from "@/lib/env";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [lead] = await db
    .select()
    .from(schema.leads)
    .where(and(eq(schema.leads.id, id), eq(schema.leads.userId, session.user.id)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.companyWebsite && !lead.companyName) {
    return NextResponse.json({ error: "Lead needs a company website or name to score" }, { status: 400 });
  }

  const exaApiKey = process.env.EXA_API_KEY;
  const claudeApiKey = getClaudeApiKey();

  if (!exaApiKey || !claudeApiKey) {
    return NextResponse.json({ error: "Missing API keys" }, { status: 500 });
  }

  const companyUrl = lead.companyWebsite || "";
  const companyName = lead.companyName || companyUrl;

  const signals = await researchIntentSignals(companyUrl, companyName, exaApiKey, claudeApiKey);

  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Clear old signals for this lead
  await db.delete(schema.intentSignals).where(eq(schema.intentSignals.leadId, lead.id));

  // Store new signals
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

  return NextResponse.json({
    score,
    temperature,
    signals: signals.map((s) => ({
      type: s.type,
      summary: s.summary,
      confidence: s.confidence,
      sourceUrl: s.sourceUrl,
      detectedAt: s.detectedAt,
    })),
  });
}
