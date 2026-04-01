import { db, schema } from "@/lib/db";
import { eq, and, or, gt, gte, desc, sql, isNotNull, lte } from "drizzle-orm";
import { NO_REPLY_COOLDOWN_DAYS } from "./sequence-memory";

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

export async function getRecentMaintenanceRuns(limit = 10) {
  const results = await db
    .select({
      id: schema.auditLog.id,
      event: schema.auditLog.event,
      reason: schema.auditLog.reason,
      metadata: schema.auditLog.metadata,
      createdAt: schema.auditLog.createdAt,
    })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.event, "followup_maintenance_run"))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit);

  return results.map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const actions = Array.isArray(metadata.actions)
      ? metadata.actions.filter((action): action is string => typeof action === "string")
      : [];
    const noReplyPenalized =
      typeof metadata.noReplyPenalized === "number" ? metadata.noReplyPenalized : 0;
    const assessmentAfter =
      metadata.assessmentAfter && typeof metadata.assessmentAfter === "object"
        ? (metadata.assessmentAfter as Record<string, unknown>)
        : null;
    const reasons = Array.isArray(assessmentAfter?.reasons)
      ? assessmentAfter.reasons.filter((reason): reason is string => typeof reason === "string")
      : [];

    return {
      id: row.id,
      createdAt: row.createdAt,
      reason: row.reason,
      actions,
      noReplyPenalized,
      status:
        assessmentAfter && typeof assessmentAfter.status === "string"
          ? assessmentAfter.status
          : "ok",
      reasons,
    };
  });
}

export async function getLatestMaintenanceSnapshot(): Promise<{
  createdAt: string | null;
  stats: LearningLoopHealthStats | null;
  assessment: LearningLoopHealthAssessment | null;
} | null> {
  const [row] = await db
    .select({
      createdAt: schema.auditLog.createdAt,
      metadata: schema.auditLog.metadata,
    })
    .from(schema.auditLog)
    .where(eq(schema.auditLog.event, "followup_maintenance_run"))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(1);

  if (!row) return null;

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  const after =
    metadata.after && typeof metadata.after === "object"
      ? (metadata.after as Record<string, unknown>)
      : null;
  const assessmentAfter =
    metadata.assessmentAfter && typeof metadata.assessmentAfter === "object"
      ? (metadata.assessmentAfter as Record<string, unknown>)
      : null;

  const stats =
    after &&
    typeof after.totalMemoryRows === "number" &&
    typeof after.pendingNoReplyPenalties === "number" &&
    typeof after.recentMessagesMissingOrchestrationRate === "number"
      ? ({
          globalMemoryRows: typeof after.globalMemoryRows === "number" ? after.globalMemoryRows : 0,
          segmentMemoryRows: typeof after.segmentMemoryRows === "number" ? after.segmentMemoryRows : 0,
          pathMemoryRows: typeof after.pathMemoryRows === "number" ? after.pathMemoryRows : 0,
          totalMemoryRows: after.totalMemoryRows,
          staleMemoryRows: typeof after.staleMemoryRows === "number" ? after.staleMemoryRows : 0,
          pendingNoReplyPenalties: after.pendingNoReplyPenalties,
          recentSequenceMessages7d: typeof after.recentSequenceMessages7d === "number" ? after.recentSequenceMessages7d : 0,
          recentMessagesMissingOrchestration7d:
            typeof after.recentMessagesMissingOrchestration7d === "number"
              ? after.recentMessagesMissingOrchestration7d
              : 0,
          recentMessagesMissingOrchestrationRate: after.recentMessagesMissingOrchestrationRate,
        } satisfies LearningLoopHealthStats)
      : null;

  const assessment =
    assessmentAfter &&
    (assessmentAfter.status === "ok" ||
      assessmentAfter.status === "warn" ||
      assessmentAfter.status === "error") &&
    Array.isArray(assessmentAfter.reasons)
      ? ({
          status: assessmentAfter.status,
          reasons: assessmentAfter.reasons.filter(
            (reason): reason is string => typeof reason === "string",
          ),
        } satisfies LearningLoopHealthAssessment)
      : null;

  return {
    createdAt: row.createdAt,
    stats,
    assessment,
  };
}

export async function getRecentMaintenanceAlerts(limit = 10) {
  const results = await db
    .select({
      id: schema.auditLog.id,
      event: schema.auditLog.event,
      reason: schema.auditLog.reason,
      metadata: schema.auditLog.metadata,
      createdAt: schema.auditLog.createdAt,
    })
    .from(schema.auditLog)
    .where(
      or(
        eq(schema.auditLog.event, "followup_maintenance_alert"),
        eq(schema.auditLog.event, "followup_maintenance_recovered"),
        eq(schema.auditLog.event, "followup_maintenance_acknowledged"),
      ),
    )
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit);

  return results.map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : {};
    const reasons = Array.isArray(metadata.reasons)
      ? metadata.reasons.filter((reason): reason is string => typeof reason === "string")
      : [];

    return {
      id: row.id,
      event: row.event,
      createdAt: row.createdAt,
      reason: row.reason,
      status:
        metadata.status === "ok" || metadata.status === "warn" || metadata.status === "error"
          ? metadata.status
          : "ok",
      primaryReason:
        typeof metadata.primaryReason === "string" ? metadata.primaryReason : null,
      reasons,
    };
  });
}

export async function getAlertAcknowledgementState(primaryReason: string | null) {
  if (!primaryReason) {
    return {
      latestAlertAt: null,
      latestAcknowledgedAt: null,
    };
  }

  const [latestAlert, latestAcknowledged] = await Promise.all([
    db
      .select({ createdAt: schema.auditLog.createdAt })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.event, "followup_maintenance_alert"),
          sql`json_extract(${schema.auditLog.metadata}, '$.primaryReason') = ${primaryReason}`,
        ),
      )
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ createdAt: schema.auditLog.createdAt })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.event, "followup_maintenance_acknowledged"),
          sql`json_extract(${schema.auditLog.metadata}, '$.primaryReason') = ${primaryReason}`,
        ),
      )
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  return {
    latestAlertAt: latestAlert?.createdAt ?? null,
    latestAcknowledgedAt: latestAcknowledged?.createdAt ?? null,
  };
}

// ---------------------------------------------------------------------------
// Learning loop health
// ---------------------------------------------------------------------------

export type LearningLoopHealthStats = {
  globalMemoryRows: number;
  segmentMemoryRows: number;
  pathMemoryRows: number;
  totalMemoryRows: number;
  staleMemoryRows: number;
  pendingNoReplyPenalties: number;
  recentSequenceMessages7d: number;
  recentMessagesMissingOrchestration7d: number;
  recentMessagesMissingOrchestrationRate: number;
};

export type LearningLoopHealthAssessment = {
  status: "ok" | "warn" | "error";
  reasons: string[];
};

export type LearningLoopRecommendation = {
  title: string;
  action: string;
  priority: "high" | "medium" | "low";
};

export type LearningLoopTrend = {
  previousCapturedAt: string | null;
  statusChange: "improved" | "regressed" | "unchanged" | "unknown";
  pendingNoReplyDelta: number;
  missingOrchestrationRateDelta: number;
  staleMemoryDelta: number;
  summary: string;
};

export type LearningLoopForecast = {
  horizon: "next_maintenance_window";
  riskLevel: "low" | "medium" | "high";
  likelyIssue: string;
  summary: string;
};

function readCount(rows: Array<{ count: number }>): number {
  return rows[0]?.count ?? 0;
}

export function assessLearningLoopHealth(
  stats: LearningLoopHealthStats,
): LearningLoopHealthAssessment {
  const reasons: string[] = [];
  let severity: LearningLoopHealthAssessment["status"] = "ok";

  const escalate = (next: LearningLoopHealthAssessment["status"]) => {
    if (severity === "error") return;
    if (next === "error" || (next === "warn" && severity === "ok")) {
      severity = next;
    }
  };

  if (stats.pendingNoReplyPenalties >= 100) {
    reasons.push(`${stats.pendingNoReplyPenalties} no-reply penalties are waiting to be applied.`);
    escalate("error");
  } else if (stats.pendingNoReplyPenalties >= 20) {
    reasons.push(`${stats.pendingNoReplyPenalties} cooled-off sends still need no-reply learning.`);
    escalate("warn");
  }

  if (
    stats.recentSequenceMessages7d >= 10 &&
    stats.recentMessagesMissingOrchestrationRate >= 0.4
  ) {
    reasons.push("A large share of recent sequence messages were sent without orchestration metadata.");
    escalate("error");
  } else if (
    stats.recentSequenceMessages7d >= 10 &&
    stats.recentMessagesMissingOrchestrationRate >= 0.15
  ) {
    reasons.push("Some recent sequence messages are missing orchestration metadata.");
    escalate("warn");
  }

  if (stats.staleMemoryRows >= 250) {
    reasons.push(`${stats.staleMemoryRows} learned memory rows have not been refreshed in over 30 days.`);
    escalate("warn");
  }

  if (stats.recentSequenceMessages7d >= 10 && stats.totalMemoryRows === 0) {
    reasons.push("The system is sending sequence traffic but has no learned sequence memory yet.");
    escalate("warn");
  }

  return {
    status: severity,
    reasons,
  };
}

export function getLearningLoopRecommendations(params: {
  stats: LearningLoopHealthStats;
  assessment: LearningLoopHealthAssessment;
}): LearningLoopRecommendation[] {
  const recommendations: LearningLoopRecommendation[] = [];
  const { stats, assessment } = params;

  if (stats.pendingNoReplyPenalties >= 20) {
    recommendations.push({
      title: "Run follow-up maintenance",
      action:
        "Trigger the follow-up maintenance cron to backfill delayed no-reply learning and shrink the cooled-off backlog.",
      priority: stats.pendingNoReplyPenalties >= 100 ? "high" : "medium",
    });
  }

  if (
    stats.recentSequenceMessages7d >= 10 &&
    stats.recentMessagesMissingOrchestrationRate >= 0.15
  ) {
    recommendations.push({
      title: "Repair orchestration attribution",
      action:
        "Inspect follow-up generation and send paths for messages missing orchestration metadata so future sends keep full learning attribution.",
      priority: stats.recentMessagesMissingOrchestrationRate >= 0.4 ? "high" : "medium",
    });
  }

  if (stats.staleMemoryRows >= 250) {
    recommendations.push({
      title: "Refresh stale memory",
      action:
        "Review whether the learning loop is receiving fresh outcomes regularly, because older untouched memory is starting to dominate the model.",
      priority: "medium",
    });
  }

  if (stats.recentSequenceMessages7d >= 10 && stats.totalMemoryRows === 0) {
    recommendations.push({
      title: "Check outcome ingestion",
      action:
        "Verify reply, bounce, approval, and delayed no-reply events are all writing sequence outcomes for live traffic.",
      priority: "high",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      title: assessment.status === "ok" ? "No action needed" : "Monitor health",
      action:
        assessment.status === "ok"
          ? "The learning loop looks healthy. Keep the maintenance cron running and watch for new alert transitions."
          : "The loop is degraded but no single repair action dominates yet. Monitor the latest alerts and maintenance runs.",
      priority: "low",
    });
  }

  return recommendations;
}

export function getLearningLoopTrend(params: {
  currentStats: LearningLoopHealthStats;
  currentAssessment: LearningLoopHealthAssessment;
  previousStats?: LearningLoopHealthStats | null;
  previousAssessment?: LearningLoopHealthAssessment | null;
  previousCapturedAt?: string | null;
}): LearningLoopTrend {
  const {
    currentStats,
    currentAssessment,
    previousStats = null,
    previousAssessment = null,
    previousCapturedAt = null,
  } = params;

  if (!previousStats || !previousAssessment) {
    return {
      previousCapturedAt,
      statusChange: "unknown",
      pendingNoReplyDelta: 0,
      missingOrchestrationRateDelta: 0,
      staleMemoryDelta: 0,
      summary: "No previous maintenance snapshot is available yet.",
    };
  }

  const severityRank = { ok: 0, warn: 1, error: 2 } as const;
  const previousRank = severityRank[previousAssessment.status];
  const currentRank = severityRank[currentAssessment.status];
  const pendingNoReplyDelta =
    currentStats.pendingNoReplyPenalties - previousStats.pendingNoReplyPenalties;
  const missingOrchestrationRateDelta = Number(
    (
      currentStats.recentMessagesMissingOrchestrationRate -
      previousStats.recentMessagesMissingOrchestrationRate
    ).toFixed(2),
  );
  const staleMemoryDelta =
    currentStats.staleMemoryRows - previousStats.staleMemoryRows;

  let statusChange: LearningLoopTrend["statusChange"] = "unchanged";
  if (currentRank < previousRank) statusChange = "improved";
  else if (currentRank > previousRank) statusChange = "regressed";
  else if (
    pendingNoReplyDelta < 0 ||
    missingOrchestrationRateDelta < 0 ||
    staleMemoryDelta < 0
  ) {
    statusChange = "improved";
  } else if (
    pendingNoReplyDelta > 0 ||
    missingOrchestrationRateDelta > 0 ||
    staleMemoryDelta > 0
  ) {
    statusChange = "regressed";
  }

  const summary =
    statusChange === "improved"
      ? "Health has improved since the last maintenance snapshot."
      : statusChange === "regressed"
        ? "Health has regressed since the last maintenance snapshot."
        : "Health is broadly unchanged since the last maintenance snapshot.";

  return {
    previousCapturedAt,
    statusChange,
    pendingNoReplyDelta,
    missingOrchestrationRateDelta,
    staleMemoryDelta,
    summary,
  };
}

export function getLearningLoopForecast(params: {
  stats: LearningLoopHealthStats;
  assessment: LearningLoopHealthAssessment;
  trend: LearningLoopTrend;
}): LearningLoopForecast {
  const { stats, assessment, trend } = params;

  if (
    assessment.status === "error" ||
    stats.pendingNoReplyPenalties >= 100 ||
    stats.recentMessagesMissingOrchestrationRate >= 0.4 ||
    (trend.statusChange === "regressed" &&
      (stats.pendingNoReplyPenalties >= 40 ||
        stats.recentMessagesMissingOrchestrationRate >= 0.2 ||
        stats.staleMemoryRows >= 250))
  ) {
    const likelyIssue =
      stats.pendingNoReplyPenalties >= 100
        ? "No-reply learning backlog will keep growing without intervention."
        : stats.recentMessagesMissingOrchestrationRate >= 0.4
          ? "Missing orchestration attribution is likely to weaken future learning quality."
          : "Operational health is likely to worsen before the next maintenance window.";

    return {
      horizon: "next_maintenance_window",
      riskLevel: "high",
      likelyIssue,
      summary: "Without operator action, the learning loop is likely to degrade further before the next maintenance cycle.",
    };
  }

  if (
    assessment.status === "warn" ||
    stats.pendingNoReplyPenalties >= 20 ||
    stats.staleMemoryRows >= 250 ||
    trend.statusChange === "regressed"
  ) {
    const likelyIssue =
      stats.pendingNoReplyPenalties >= 20
        ? "Delayed no-reply learning may continue to accumulate."
        : stats.staleMemoryRows >= 250
          ? "Stale memory could start outweighing fresher outcomes."
          : trend.statusChange === "regressed"
            ? "Several operational metrics are drifting in the wrong direction."
            : "The loop is stable, but there is not much improvement headroom without maintenance.";

    return {
      horizon: "next_maintenance_window",
      riskLevel: "medium",
      likelyIssue,
      summary: "The learning loop should remain serviceable, but a visible issue may persist into the next maintenance window.",
    };
  }

  return {
    horizon: "next_maintenance_window",
    riskLevel: "low",
    likelyIssue: "No major operational issue is likely before the next maintenance window.",
    summary: "Current health and recent trend suggest the loop should stay stable if traffic patterns remain similar.",
  };
}

export async function getLearningLoopHealthStats(): Promise<LearningLoopHealthStats> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const noReplyCutoff = new Date(
    now.getTime() - NO_REPLY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sequenceTrafficPredicate = sql`(${schema.outboundMessages.sequenceStep} > 0 or json_extract(${schema.outboundMessages.metadata}, '$.sequenceType') is not null)`;

  const [
    globalMemoryRowsResult,
    segmentMemoryRowsResult,
    pathMemoryRowsResult,
    staleGlobalRowsResult,
    staleSegmentRowsResult,
    stalePathRowsResult,
    pendingNoReplyResult,
    recentSequenceMessages7dResult,
    recentMissingOrchestrationResult,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(schema.userSequenceMemory),
    db.select({ count: sql<number>`count(*)` }).from(schema.userLeadSequenceMemory),
    db.select({ count: sql<number>`count(*)` }).from(schema.userSequencePathMemory),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.userSequenceMemory)
      .where(lte(schema.userSequenceMemory.updatedAt, staleCutoff)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.userLeadSequenceMemory)
      .where(lte(schema.userLeadSequenceMemory.updatedAt, staleCutoff)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.userSequencePathMemory)
      .where(lte(schema.userSequencePathMemory.updatedAt, staleCutoff)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboundMessages)
      .where(and(
        eq(schema.outboundMessages.direction, "outbound"),
        eq(schema.outboundMessages.status, "sent"),
        sequenceTrafficPredicate,
        lte(schema.outboundMessages.sentAt, noReplyCutoff),
        sql`json_extract(${schema.outboundMessages.metadata}, '$.sequenceNoReplyPenalizedAt') is null`,
      )),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboundMessages)
      .where(and(
        eq(schema.outboundMessages.direction, "outbound"),
        eq(schema.outboundMessages.status, "sent"),
        sequenceTrafficPredicate,
        gte(schema.outboundMessages.sentAt, sevenDaysAgo),
      )),
    db
      .select({ count: sql<number>`count(*)` })
      .from(schema.outboundMessages)
      .where(and(
        eq(schema.outboundMessages.direction, "outbound"),
        eq(schema.outboundMessages.status, "sent"),
        sequenceTrafficPredicate,
        gte(schema.outboundMessages.sentAt, sevenDaysAgo),
        sql`json_extract(${schema.outboundMessages.metadata}, '$.orchestration') is null`,
      )),
  ]);

  const globalMemoryRows = readCount(globalMemoryRowsResult);
  const segmentMemoryRows = readCount(segmentMemoryRowsResult);
  const pathMemoryRows = readCount(pathMemoryRowsResult);
  const staleMemoryRows =
    readCount(staleGlobalRowsResult) +
    readCount(staleSegmentRowsResult) +
    readCount(stalePathRowsResult);
  const totalMemoryRows = globalMemoryRows + segmentMemoryRows + pathMemoryRows;
  const recentSequenceMessages7d = readCount(recentSequenceMessages7dResult);
  const recentMessagesMissingOrchestration7d = readCount(recentMissingOrchestrationResult);

  return {
    globalMemoryRows,
    segmentMemoryRows,
    pathMemoryRows,
    totalMemoryRows,
    staleMemoryRows,
    pendingNoReplyPenalties: readCount(pendingNoReplyResult),
    recentSequenceMessages7d,
    recentMessagesMissingOrchestration7d,
    recentMessagesMissingOrchestrationRate:
      recentSequenceMessages7d > 0
        ? Number(
            (
              recentMessagesMissingOrchestration7d / recentSequenceMessages7d
            ).toFixed(2),
          )
        : 0,
  };
}
