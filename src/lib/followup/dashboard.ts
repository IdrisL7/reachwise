import { db, schema } from "@/lib/db";
import { eq, and, or, gt, gte, desc, sql, isNotNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Overview stats
// ---------------------------------------------------------------------------

export async function getOverviewStats() {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Active leads in sequences
  const activeLeadsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.leads)
    .where(
      and(
        or(
          eq(schema.leads.status, "cold"),
          eq(schema.leads.status, "in_conversation"),
        ),
        or(
          gt(schema.leads.sequenceStep, 0),
          isNotNull(schema.leads.lastContactedAt),
        ),
      ),
    );

  // Follow-ups sent in last 24 hours
  const sent24hResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.outboundMessages)
    .where(
      and(
        eq(schema.outboundMessages.direction, "outbound"),
        gt(schema.outboundMessages.sequenceStep, 0),
        eq(schema.outboundMessages.status, "sent"),
        gte(schema.outboundMessages.sentAt, oneDayAgo),
      ),
    );

  // Follow-ups sent in last 7 days
  const sent7dResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.outboundMessages)
    .where(
      and(
        eq(schema.outboundMessages.direction, "outbound"),
        gt(schema.outboundMessages.sequenceStep, 0),
        eq(schema.outboundMessages.status, "sent"),
        gte(schema.outboundMessages.sentAt, sevenDaysAgo),
      ),
    );

  // Reply rate (last 7 days)
  const inbound7dResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.outboundMessages)
    .where(
      and(
        eq(schema.outboundMessages.direction, "inbound"),
        gte(schema.outboundMessages.sentAt, sevenDaysAgo),
      ),
    );

  const activeLeads = activeLeadsResult[0]?.count ?? 0;
  const sent24h = sent24hResult[0]?.count ?? 0;
  const sent7d = sent7dResult[0]?.count ?? 0;
  const inbound7d = inbound7dResult[0]?.count ?? 0;

  const replyRate = sent7d > 0 ? ((inbound7d / sent7d) * 100) : 0;

  return {
    activeLeads,
    sent24h,
    sent7d,
    replyRate: Math.round(replyRate * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Leads by sequence step
// ---------------------------------------------------------------------------

export async function getSequenceStepCounts() {
  const results = await db
    .select({
      sequenceStep: schema.leads.sequenceStep,
      count: sql<number>`count(*)`,
    })
    .from(schema.leads)
    .where(
      or(
        eq(schema.leads.status, "cold"),
        eq(schema.leads.status, "in_conversation"),
      ),
    )
    .groupBy(schema.leads.sequenceStep)
    .orderBy(schema.leads.sequenceStep);

  return results;
}

// ---------------------------------------------------------------------------
// Recent follow-up emails
// ---------------------------------------------------------------------------

export async function getRecentFollowups(limit = 50) {
  const results = await db
    .select({
      id: schema.outboundMessages.id,
      sentAt: schema.outboundMessages.sentAt,
      sequenceStep: schema.outboundMessages.sequenceStep,
      subject: schema.outboundMessages.subject,
      body: schema.outboundMessages.body,
      status: schema.outboundMessages.status,
      leadId: schema.leads.id,
      leadName: schema.leads.name,
      leadEmail: schema.leads.email,
      companyName: schema.leads.companyName,
    })
    .from(schema.outboundMessages)
    .innerJoin(schema.leads, eq(schema.outboundMessages.leadId, schema.leads.id))
    .where(
      and(
        eq(schema.outboundMessages.direction, "outbound"),
        gt(schema.outboundMessages.sequenceStep, 0),
      ),
    )
    .orderBy(desc(schema.outboundMessages.createdAt))
    .limit(limit);

  return results;
}
