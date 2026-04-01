import { and, desc, eq, lte, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  extractPreviousSequenceMetadata,
  inferTargetRoleFromLead,
} from "./generate";
import {
  getLeadSegmentKey,
  hasSequenceNoReplyPenalty,
  isEligibleForNoReplyPenalty,
  markSequenceNoReplyPenalty,
  NO_REPLY_COOLDOWN_DAYS,
  recordSequenceOutcome,
} from "./sequence-memory";
import {
  assessLearningLoopHealth,
  getLearningLoopHealthStats,
  type LearningLoopHealthAssessment,
  type LearningLoopHealthStats,
} from "./dashboard";
import { logAudit } from "@/lib/audit";

export type LearningLoopMaintenanceAction =
  | "backfill_no_reply_penalties"
  | "observe_only";

type LearningLoopAlertState = {
  status: LearningLoopHealthAssessment["status"];
  primaryReason: string | null;
};

type LearningLoopAlertDecision =
  | {
      event: "followup_maintenance_alert" | "followup_maintenance_recovered";
      reason: string;
    }
  | null;

export function planLearningLoopMaintenance(
  stats: LearningLoopHealthStats,
  assessment: LearningLoopHealthAssessment = assessLearningLoopHealth(stats),
): LearningLoopMaintenanceAction[] {
  const actions: LearningLoopMaintenanceAction[] = [];

  if (stats.pendingNoReplyPenalties > 0) {
    actions.push("backfill_no_reply_penalties");
  }

  if (actions.length === 0 && assessment.status === "ok") {
    actions.push("observe_only");
  }

  return actions;
}

function getPrimaryReason(assessment: LearningLoopHealthAssessment): string | null {
  return assessment.reasons[0] ?? null;
}

export function decideLearningLoopAlert(params: {
  previous: LearningLoopAlertState | null;
  next: LearningLoopHealthAssessment;
}): LearningLoopAlertDecision {
  const nextPrimaryReason = getPrimaryReason(params.next);

  if (params.next.status === "ok") {
    if (params.previous && params.previous.status !== "ok") {
      return {
        event: "followup_maintenance_recovered",
        reason: "Learning-loop health recovered to ok.",
      };
    }

    return null;
  }

  if (!params.previous || params.previous.status !== params.next.status) {
    return {
      event: "followup_maintenance_alert",
      reason: `Learning-loop health changed to ${params.next.status}.`,
    };
  }

  if (nextPrimaryReason && params.previous.primaryReason !== nextPrimaryReason) {
    return {
      event: "followup_maintenance_alert",
      reason: "Learning-loop health issue changed materially.",
    };
  }

  return null;
}

async function getLatestLearningLoopAlertState(): Promise<LearningLoopAlertState | null> {
  const [row] = await db
    .select({
      event: schema.auditLog.event,
      metadata: schema.auditLog.metadata,
    })
    .from(schema.auditLog)
    .where(
      or(
        eq(schema.auditLog.event, "followup_maintenance_alert"),
        eq(schema.auditLog.event, "followup_maintenance_recovered"),
      ),
    )
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(1);

  if (!row) return null;
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  const status =
    metadata.status === "ok" || metadata.status === "warn" || metadata.status === "error"
      ? metadata.status
      : null;
  const primaryReason =
    typeof metadata.primaryReason === "string" ? metadata.primaryReason : null;

  if (!status) return null;

  return {
    status,
    primaryReason,
  };
}

export async function applyPendingNoReplyPenalties(limit = 200): Promise<number> {
  const noReplyCutoff = new Date(
    Date.now() - NO_REPLY_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sentMessages = await db
    .select()
    .from(schema.outboundMessages)
    .where(
      and(
        eq(schema.outboundMessages.status, "sent"),
        eq(schema.outboundMessages.direction, "outbound"),
        lte(schema.outboundMessages.sentAt, noReplyCutoff),
      ),
    )
    .limit(limit);

  let noReplyPenalized = 0;

  for (const message of sentMessages) {
    try {
      const alreadyPenalized = hasSequenceNoReplyPenalty(message.metadata);
      const [lastInbound] = await db
        .select({
          id: schema.outboundMessages.id,
          sentAt: schema.outboundMessages.sentAt,
        })
        .from(schema.outboundMessages)
        .where(
          and(
            eq(schema.outboundMessages.leadId, message.leadId),
            eq(schema.outboundMessages.direction, "inbound"),
          ),
        )
        .orderBy(desc(schema.outboundMessages.createdAt))
        .limit(1);

      const hasInboundAfterSend =
        !!lastInbound?.sentAt &&
        !!message.sentAt &&
        Date.parse(lastInbound.sentAt) > Date.parse(message.sentAt);

      if (
        !isEligibleForNoReplyPenalty({
          sentAt: message.sentAt,
          hasInboundAfterSend,
          alreadyPenalized,
        })
      ) {
        continue;
      }

      const [lead] = await db
        .select({
          userId: schema.leads.userId,
          email: schema.leads.email,
          title: schema.leads.title,
          source: schema.leads.source,
          companyWebsite: schema.leads.companyWebsite,
        })
        .from(schema.leads)
        .where(eq(schema.leads.id, message.leadId))
        .limit(1);

      if (
        !lead?.userId ||
        !(
          message.channel === "email" ||
          message.channel === "linkedin_connection" ||
          message.channel === "linkedin_message" ||
          message.channel === "cold_call" ||
          message.channel === "video_script"
        )
      ) {
        continue;
      }

      const sequenceMetadata = extractPreviousSequenceMetadata(message.metadata);
      await recordSequenceOutcome({
        userId: lead.userId,
        targetRole: inferTargetRoleFromLead({
          email: lead.email,
          title: lead.title,
        }),
        leadSegment: getLeadSegmentKey({
          title: lead.title,
          source: lead.source,
          companyWebsite: lead.companyWebsite,
        }),
        sequenceType:
          sequenceMetadata.sequenceType ??
          (message.sequenceStep === 0 ? "first" : "bump"),
        channel: message.channel,
        previousChannel: sequenceMetadata.previousChannel ?? null,
        event: "no_reply",
      }).catch(() => {});

      await db
        .update(schema.outboundMessages)
        .set({
          metadata: markSequenceNoReplyPenalty(
            message.metadata,
            new Date().toISOString(),
          ),
        })
        .where(eq(schema.outboundMessages.id, message.id));

      noReplyPenalized++;
    } catch (err) {
      console.error(
        `[followup-maintenance] error applying no-reply penalty for ${message.id}:`,
        err,
      );
    }
  }

  return noReplyPenalized;
}

export async function runLearningLoopMaintenance(params?: {
  noReplySweepLimit?: number;
  runId?: string;
}) {
  const before = await getLearningLoopHealthStats();
  const assessmentBefore = assessLearningLoopHealth(before);
  const actions = planLearningLoopMaintenance(before, assessmentBefore);
  const runId = params?.runId ?? crypto.randomUUID();

  let noReplyPenalized = 0;

  if (actions.includes("backfill_no_reply_penalties")) {
    noReplyPenalized = await applyPendingNoReplyPenalties(
      params?.noReplySweepLimit ?? 500,
    );
  }

  const after = await getLearningLoopHealthStats();
  const assessmentAfter = assessLearningLoopHealth(after);
  const previousAlertState = await getLatestLearningLoopAlertState();
  const alertDecision = decideLearningLoopAlert({
    previous: previousAlertState,
    next: assessmentAfter,
  });

  await logAudit({
    event: "followup_maintenance_run",
    reason:
      actions.includes("backfill_no_reply_penalties")
        ? "Applied automated learning-loop maintenance"
        : "Observed learning-loop health with no repairs needed",
    metadata: {
      runId,
      actions,
      noReplyPenalized,
      before,
      after,
      assessmentBefore,
      assessmentAfter,
    },
  });

  if (alertDecision) {
    await logAudit({
      event: alertDecision.event,
      reason: alertDecision.reason,
      metadata: {
        runId,
        status: assessmentAfter.status,
        primaryReason: getPrimaryReason(assessmentAfter),
        reasons: assessmentAfter.reasons,
      },
    });
  }

  return {
    runId,
    actions,
    noReplyPenalized,
    before,
    after,
    assessmentBefore,
    assessmentAfter,
    alertDecision,
  };
}
