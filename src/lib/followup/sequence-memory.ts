import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { TargetRole } from "@/lib/hooks";

export type SequenceType = "first" | "bump" | "breakup";
export type OutreachChannel = "email" | "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script";

export type SequenceOutcomeEvent =
  | "attempt"
  | "no_reply"
  | "positive_reply"
  | "reply_win"
  | "unsubscribe"
  | "wrong_person"
  | "unreachable";

export type SequenceMemoryPriors = {
  adjustments: Partial<Record<SequenceType, Partial<Record<OutreachChannel, number>>>>;
  pathAdjustments?: Partial<Record<SequenceType, Partial<Record<string, Partial<Record<OutreachChannel, number>>>>>>;
};

const DECAY_FACTOR = 0.92;
export const NO_REPLY_COOLDOWN_DAYS = 5;

function emptyAdjustmentMap(): SequenceMemoryPriors["adjustments"] {
  return {
    first: {},
    bump: {},
    breakup: {},
  };
}

function emptyPathAdjustmentMap(): NonNullable<SequenceMemoryPriors["pathAdjustments"]> {
  return {
    first: {},
    bump: {},
    breakup: {},
  };
}

export function getLeadSegmentKey(lead: {
  title?: string | null;
  source?: string | null;
  companyWebsite?: string | null;
}): string {
  const title = (lead.title || "").toLowerCase();
  const seniority = title.includes("chief") || title.includes("vp") || title.includes("head") || title.includes("founder") || title.includes("ceo")
    ? "executive"
    : title.includes("manager") || title.includes("director")
      ? "manager"
      : title.includes("operations") || title.includes("revops") || title.includes("marketing") || title.includes("sdr") || title.includes("sales")
        ? "operator"
        : "general";

  const source = (lead.source || "").toLowerCase();
  const sourceBucket =
    source === "manual" ? "manual"
      : source === "csv" || source === "import" ? "import"
        : source === "api" ? "api"
          : source ? "other"
            : "unknown";

  const companyBucket = lead.companyWebsite ? "known_domain" : "unknown_domain";
  return `${seniority}|${sourceBucket}|${companyBucket}`;
}

function computeAdjustmentFromCounts(row: {
  attemptCount: number | null;
  noReplyCount: number | null;
  positiveReplyCount: number | null;
  replyWinCount: number | null;
  unsubscribeCount: number | null;
  wrongPersonCount: number | null;
  unreachableCount: number | null;
}): number {
  const attempts = Math.max(0, row.attemptCount ?? 0);
  const noReplies = Math.max(0, row.noReplyCount ?? 0);
  const wins = Math.max(0, row.replyWinCount ?? 0);
  const positives = Math.max(0, row.positiveReplyCount ?? 0);
  const unsubscribes = Math.max(0, row.unsubscribeCount ?? 0);
  const wrongPeople = Math.max(0, row.wrongPersonCount ?? 0);
  const unreachable = Math.max(0, row.unreachableCount ?? 0);

  const success = wins * 2.4 + positives * 1.2;
  const failure = noReplies * 0.95 + unsubscribes * 2.6 + wrongPeople * 1.4 + unreachable * 1.8;
  const reliability = Math.min(1.6, Math.max(0.35, attempts / 2.5));
  return Number(Math.max(-2.5, Math.min(2.5, (((success - failure) / (attempts + 1)) * reliability))).toFixed(2));
}

function coerceMetadata(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? raw as Record<string, unknown> : {};
}

export function hasSequenceNoReplyPenalty(raw: unknown): boolean {
  const metadata = coerceMetadata(raw);
  return typeof metadata.sequenceNoReplyPenalizedAt === "string" && metadata.sequenceNoReplyPenalizedAt.trim().length > 0;
}

export function markSequenceNoReplyPenalty(raw: unknown, penalizedAt: string): Record<string, unknown> {
  const metadata = coerceMetadata(raw);
  return {
    ...metadata,
    sequenceNoReplyPenalizedAt: penalizedAt,
  };
}

export function isEligibleForNoReplyPenalty(params: {
  sentAt?: string | null;
  hasInboundAfterSend: boolean;
  alreadyPenalized: boolean;
  now?: Date;
}): boolean {
  if (!params.sentAt || params.hasInboundAfterSend || params.alreadyPenalized) return false;
  const sentAtMs = Date.parse(params.sentAt);
  if (Number.isNaN(sentAtMs)) return false;
  const nowMs = (params.now ?? new Date()).getTime();
  const ageDays = (nowMs - sentAtMs) / (1000 * 60 * 60 * 24);
  return ageDays >= NO_REPLY_COOLDOWN_DAYS;
}

function applyDecayEvent<T extends {
  attemptCount: number | null | undefined;
  noReplyCount: number | null | undefined;
  positiveReplyCount: number | null | undefined;
  replyWinCount: number | null | undefined;
  unsubscribeCount: number | null | undefined;
  wrongPersonCount: number | null | undefined;
  unreachableCount: number | null | undefined;
}>(existing: T | null | undefined, event: SequenceOutcomeEvent, now: string) {
  return {
    attemptCount: (existing?.attemptCount ?? 0) * DECAY_FACTOR + (event === "attempt" ? 1 : 0),
    noReplyCount: (existing?.noReplyCount ?? 0) * DECAY_FACTOR + (event === "no_reply" ? 1 : 0),
    positiveReplyCount: (existing?.positiveReplyCount ?? 0) * DECAY_FACTOR + (event === "positive_reply" ? 1 : 0),
    replyWinCount: (existing?.replyWinCount ?? 0) * DECAY_FACTOR + (event === "reply_win" ? 1 : 0),
    unsubscribeCount: (existing?.unsubscribeCount ?? 0) * DECAY_FACTOR + (event === "unsubscribe" ? 1 : 0),
    wrongPersonCount: (existing?.wrongPersonCount ?? 0) * DECAY_FACTOR + (event === "wrong_person" ? 1 : 0),
    unreachableCount: (existing?.unreachableCount ?? 0) * DECAY_FACTOR + (event === "unreachable" ? 1 : 0),
    updatedAt: now,
  };
}

export async function recordSequenceOutcome(params: {
  userId: string;
  targetRole?: TargetRole | null;
  leadSegment?: string | null;
  sequenceType: SequenceType;
  channel: OutreachChannel;
  previousChannel?: OutreachChannel | null;
  event: SequenceOutcomeEvent;
}) {
  const [existing, segmentExisting, pathExisting] = await Promise.all([
    db
    .select()
    .from(schema.userSequenceMemory)
    .where(and(
      eq(schema.userSequenceMemory.userId, params.userId),
      params.targetRole == null
        ? isNull(schema.userSequenceMemory.targetRole)
        : eq(schema.userSequenceMemory.targetRole, params.targetRole),
      eq(schema.userSequenceMemory.sequenceType, params.sequenceType),
      eq(schema.userSequenceMemory.channel, params.channel),
    ))
    .limit(1)
    .then((rows) => rows[0] ?? null),
    params.leadSegment
      ? db
          .select()
          .from(schema.userLeadSequenceMemory)
          .where(and(
            eq(schema.userLeadSequenceMemory.userId, params.userId),
            params.targetRole == null
              ? isNull(schema.userLeadSequenceMemory.targetRole)
              : eq(schema.userLeadSequenceMemory.targetRole, params.targetRole),
            eq(schema.userLeadSequenceMemory.leadSegment, params.leadSegment),
            eq(schema.userLeadSequenceMemory.sequenceType, params.sequenceType),
            eq(schema.userLeadSequenceMemory.channel, params.channel),
          ))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    params.previousChannel !== undefined
      ? db
          .select()
          .from(schema.userSequencePathMemory)
          .where(and(
            eq(schema.userSequencePathMemory.userId, params.userId),
            params.targetRole == null
              ? isNull(schema.userSequencePathMemory.targetRole)
              : eq(schema.userSequencePathMemory.targetRole, params.targetRole),
            params.leadSegment == null
              ? isNull(schema.userSequencePathMemory.leadSegment)
              : eq(schema.userSequencePathMemory.leadSegment, params.leadSegment),
            eq(schema.userSequencePathMemory.sequenceType, params.sequenceType),
            params.previousChannel == null
              ? isNull(schema.userSequencePathMemory.fromChannel)
              : eq(schema.userSequencePathMemory.fromChannel, params.previousChannel),
            eq(schema.userSequencePathMemory.toChannel, params.channel),
          ))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const now = new Date().toISOString();
  const nextValues = applyDecayEvent(existing, params.event, now);

  if (!existing) {
    await db.insert(schema.userSequenceMemory).values({
      userId: params.userId,
      targetRole: params.targetRole ?? null,
      sequenceType: params.sequenceType,
      channel: params.channel,
      ...nextValues,
    });
    return;
  }

  await db.update(schema.userSequenceMemory)
    .set(nextValues)
    .where(eq(schema.userSequenceMemory.id, existing.id));

  if (params.leadSegment) {
    const nextSegmentValues = applyDecayEvent(segmentExisting, params.event, now);

    if (!segmentExisting) {
      await db.insert(schema.userLeadSequenceMemory).values({
        userId: params.userId,
        targetRole: params.targetRole ?? null,
        leadSegment: params.leadSegment,
        sequenceType: params.sequenceType,
        channel: params.channel,
        ...nextSegmentValues,
      });
    } else {
      await db.update(schema.userLeadSequenceMemory)
        .set(nextSegmentValues)
        .where(eq(schema.userLeadSequenceMemory.id, segmentExisting.id));
    }
  }

  if (params.previousChannel !== undefined) {
    const nextPathValues = applyDecayEvent(pathExisting, params.event, now);

    if (!pathExisting) {
      await db.insert(schema.userSequencePathMemory).values({
        userId: params.userId,
        targetRole: params.targetRole ?? null,
        leadSegment: params.leadSegment ?? null,
        sequenceType: params.sequenceType,
        fromChannel: params.previousChannel ?? null,
        toChannel: params.channel,
        ...nextPathValues,
      });
    } else {
      await db.update(schema.userSequencePathMemory)
        .set(nextPathValues)
        .where(eq(schema.userSequencePathMemory.id, pathExisting.id));
    }
  }
}

export async function getSequenceMemoryPriors(params: {
  userId?: string | null;
  targetRole?: TargetRole | null;
  leadSegment?: string | null;
}): Promise<SequenceMemoryPriors | null> {
  if (!params.userId || !params.targetRole) return null;

  const [rows, segmentRows] = await Promise.all([
    db
      .select()
      .from(schema.userSequenceMemory)
      .where(and(
        eq(schema.userSequenceMemory.userId, params.userId),
        eq(schema.userSequenceMemory.targetRole, params.targetRole),
      )),
    params.leadSegment
      ? db
          .select()
          .from(schema.userLeadSequenceMemory)
          .where(and(
            eq(schema.userLeadSequenceMemory.userId, params.userId),
            eq(schema.userLeadSequenceMemory.targetRole, params.targetRole),
            eq(schema.userLeadSequenceMemory.leadSegment, params.leadSegment),
          ))
      : Promise.resolve([]),
  ]);

  if (rows.length === 0 && segmentRows.length === 0) return null;

  const adjustments = emptyAdjustmentMap();
  const pathAdjustments = emptyPathAdjustmentMap();

  const applyRows = (
    inputRows: Array<{
      sequenceType: string;
      channel: string;
      attemptCount: number | null;
      noReplyCount: number | null;
      positiveReplyCount: number | null;
      replyWinCount: number | null;
      unsubscribeCount: number | null;
      wrongPersonCount: number | null;
      unreachableCount: number | null;
    }>,
    weight: number,
  ) => {
    for (const row of inputRows) {
      const adjustment = computeAdjustmentFromCounts(row) * weight;
      if (
        (row.sequenceType === "first" || row.sequenceType === "bump" || row.sequenceType === "breakup") &&
        (row.channel === "email" ||
          row.channel === "linkedin_connection" ||
          row.channel === "linkedin_message" ||
          row.channel === "cold_call" ||
          row.channel === "video_script")
      ) {
        const bucket = adjustments[row.sequenceType] ?? {};
        bucket[row.channel] = Number(((bucket[row.channel] ?? 0) + adjustment).toFixed(2));
        adjustments[row.sequenceType] = bucket;
      }
    }
  };

  applyRows(rows, 0.55);
  applyRows(segmentRows, 0.95);

  for (const sequenceType of ["first", "bump", "breakup"] as const) {
    const bucket = adjustments[sequenceType] ?? {};
    for (const channel of Object.keys(bucket) as OutreachChannel[]) {
      bucket[channel] = Number(Math.max(-2.5, Math.min(2.5, bucket[channel] ?? 0)).toFixed(2));
    }
    adjustments[sequenceType] = bucket;
  }

  const pathRows = await db
    .select()
    .from(schema.userSequencePathMemory)
    .where(and(
      eq(schema.userSequencePathMemory.userId, params.userId),
      eq(schema.userSequencePathMemory.targetRole, params.targetRole),
      params.leadSegment
        ? eq(schema.userSequencePathMemory.leadSegment, params.leadSegment)
        : isNull(schema.userSequencePathMemory.leadSegment),
    ));

  for (const row of pathRows) {
    if (
      !(row.sequenceType === "first" || row.sequenceType === "bump" || row.sequenceType === "breakup") ||
      !(row.toChannel === "email" ||
        row.toChannel === "linkedin_connection" ||
        row.toChannel === "linkedin_message" ||
        row.toChannel === "cold_call" ||
        row.toChannel === "video_script")
    ) {
      continue;
    }

    const fromKey = row.fromChannel ?? "__none__";
    const sequenceBucket = pathAdjustments[row.sequenceType] ?? {};
    const fromBucket = sequenceBucket[fromKey] ?? {};
    fromBucket[row.toChannel] = computeAdjustmentFromCounts(row);
    sequenceBucket[fromKey] = fromBucket;
    pathAdjustments[row.sequenceType] = sequenceBucket;
  }

  return { adjustments, pathAdjustments };
}
