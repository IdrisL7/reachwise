import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { HookSelectorPriors, RetrievedHookPattern } from "@/lib/hooks";
import type { EvidenceTier } from "@/lib/types";
import { getWorkspaceProfile, resolveWorkspaceId } from "@/lib/workspace-helpers";
import type { ReplyClassification } from "@/lib/reply-analysis";
import { classifyRetrievalSourceType } from "@/lib/retrieval-plan";
import { getDomain } from "@/lib/hooks";
import {
  getRetrievalMemoryPriors,
  inferRetrievalMemoryEvent,
  inferRetrievalSourceType,
  recordRetrievalOutcome,
} from "@/lib/retrieval-memory";
import { recordHookOutcomeV2 } from "@/lib/v2-dual-write";

export type HookFeedbackEvent =
  | "viewed"
  | "copied"
  | "copied_with_evidence"
  | "email_copied"
  | "shared"
  | "saved"
  | "used_in_email"
  | "saved_lead"
  | "reply_win"
  | "positive_reply"
  | "edited";

export function inferHookOutcomeFromReply(
  classification: Pick<ReplyClassification, "category" | "sentiment" | "suggestedAction">,
): HookFeedbackEvent | null {
  if (classification.category === "interested") return "reply_win";

  if (
    classification.suggestedAction === "respond" &&
    classification.sentiment !== "negative" &&
    classification.category !== "ooo" &&
    classification.category !== "unsubscribe" &&
    classification.category !== "wrong_person"
  ) {
    return "positive_reply";
  }

  return null;
}

const EVENT_COLUMN_MAP: Record<HookFeedbackEvent, keyof typeof schema.buyerTensionOutcomes.$inferInsert | null> = {
  viewed: "impressions",
  copied: "copies",
  copied_with_evidence: "copies",
  email_copied: "emailsUsed",
  shared: "shares",
  saved: "saves",
  used_in_email: "emailsUsed",
  saved_lead: "saves",
  reply_win: "replyWins",
  positive_reply: "positiveReplies",
  edited: null,
};

const EVENT_WEIGHT: Record<HookFeedbackEvent, number> = {
  viewed: 0.2,
  copied: 1,
  copied_with_evidence: 1.2,
  email_copied: 1.4,
  shared: 1.1,
  saved: 0.9,
  used_in_email: 1.6,
  saved_lead: 0.7,
  reply_win: 3,
  positive_reply: 4,
  edited: 0.5,
};

function matchNullable(column: any, value: string | null | undefined) {
  return value == null ? isNull(column) : eq(column, value);
}

function classifyHookLength(text: string): "short" | "medium" | "long" {
  if (text.length <= 160) return "short";
  if (text.length <= 260) return "medium";
  return "long";
}

function extractStyleSignals(text: string) {
  return {
    direct: text.length <= 220 && !/\bmaybe|perhaps|wondering|might\b/i.test(text),
    conversational: /\b(hey|so|honest question|you're|that's|doesn't|isn't|aren't)\b/i.test(text),
    formal: !/\b(you're|that's|doesn't|isn't|aren't|hey|so)\b/i.test(text) && /\b(following|consideration|therefore|whether)\b/i.test(text),
    operator: /\b(forecast|pipeline|inspection|handoff|attribution|ramp|commit risk|conversion|coverage)\b/i.test(text),
  };
}

function getStyleEventWeight(event: HookFeedbackEvent): number {
  switch (event) {
    case "reply_win":
      return 3;
    case "positive_reply":
      return 4;
    case "email_copied":
    case "used_in_email":
      return 1.8;
    case "copied":
    case "copied_with_evidence":
    case "shared":
    case "saved":
      return 1;
    case "saved_lead":
      return 0.75;
    default:
      return 0;
  }
}

function inferChannelFromFeedback(
  event: HookFeedbackEvent,
  metadata?: Record<string, unknown>,
): "email" | "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script" | null {
  const rawChannel = typeof metadata?.channel === "string" ? metadata.channel : null;
  if (
    rawChannel === "email" ||
    rawChannel === "linkedin_connection" ||
    rawChannel === "linkedin_message" ||
    rawChannel === "cold_call" ||
    rawChannel === "video_script"
  ) {
    return rawChannel;
  }

  if (event === "email_copied" || event === "used_in_email") return "email";
  return null;
}

function inferToneFromFeedback(
  metadata?: Record<string, unknown>,
): "concise" | "warm" | "direct" | null {
  const rawTone = typeof metadata?.tone === "string" ? metadata.tone : null;
  if (rawTone === "concise" || rawTone === "warm" || rawTone === "direct") {
    return rawTone;
  }
  return null;
}

function getSignalFreshnessBucket(sourceDate: string | null | undefined): "fresh" | "recent" | "stale" | "undated" {
  if (!sourceDate) return "undated";
  const parsed = Date.parse(sourceDate);
  if (Number.isNaN(parsed)) return "undated";
  const daysOld = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  if (daysOld <= 14) return "fresh";
  if (daysOld <= 60) return "recent";
  return "stale";
}

function getCurrentTimingWindow(now = new Date()): "weekday_morning" | "weekday_afternoon" | "weekday_evening" | "weekend" {
  const day = now.getDay();
  if (day === 0 || day === 6) return "weekend";
  const hour = now.getHours();
  if (hour < 12) return "weekday_morning";
  if (hour < 17) return "weekday_afternoon";
  return "weekday_evening";
}

function isOldSourceDate(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  const daysOld = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  return daysOld > 120;
}

function buildCounterfactualContext(hook: {
  evidenceTier: string;
  sourceDate: string | null;
  targetRole: string | null;
  buyerTensionId: string | null;
  structuralVariant: string | null;
  angle: string | null;
  triggerType: string | null;
}) {
  return {
    evidenceTier: hook.evidenceTier,
    sourceDate: hook.sourceDate,
    targetRole: hook.targetRole,
    buyerTensionId: hook.buyerTensionId,
    structuralVariant: hook.structuralVariant,
    angle: hook.angle,
    triggerType: hook.triggerType,
    timingRisk: !hook.sourceDate ? "undated" : isOldSourceDate(hook.sourceDate) ? "stale" : "fresh",
  };
}

type HookOutcomeAggregate = {
  generatedHookId: string;
  evidenceTier: EvidenceTier;
  sourceDate: string | null;
  sourceUrl: string | null;
  companyUrl: string | null;
  targetRole: string | null;
  buyerTensionId: string | null;
  structuralVariant: string | null;
  angle: string | null;
  triggerType: string | null;
  hookText: string;
  evidenceSnippet: string | null;
  sourceTitle: string | null;
  impressions: number;
  engaged: number;
  emailUses: number;
  positives: number;
  edits: number;
};

function addPenalty(map: Record<string, number>, key: string | null, value: number) {
  if (!key || value <= 0) return;
  map[key] = Number(Math.min(2.25, (map[key] ?? 0) + value).toFixed(2));
}

function inferCounterfactualPenaltySignals(aggregate: HookOutcomeAggregate) {
  const penalties = {
    buyerTension: 0,
    wording: 0,
    sourceQuality: 0,
    roleMapping: 0,
    timing: 0,
  };

  if (aggregate.edits >= 1 && aggregate.positives === 0) {
    penalties.wording += Math.min(1.25, 0.55 + aggregate.edits * 0.25);
  } else if (aggregate.edits >= 2 && aggregate.positives <= 1) {
    penalties.wording += 0.45;
  }

  if (
    aggregate.buyerTensionId &&
    aggregate.engaged >= 2 &&
    aggregate.emailUses >= 1 &&
    aggregate.positives === 0
  ) {
    penalties.buyerTension += 0.85;
  }

  if (
    aggregate.evidenceTier !== "A" &&
    aggregate.engaged >= 2 &&
    aggregate.positives === 0
  ) {
    penalties.sourceQuality += aggregate.evidenceTier === "B" ? 0.6 : 0.9;
  }

  if (
    aggregate.targetRole &&
    aggregate.emailUses >= 1 &&
    aggregate.positives === 0
  ) {
    penalties.roleMapping += 0.55;
  }

  if (aggregate.positives === 0 && aggregate.engaged >= 1) {
    if (!aggregate.sourceDate) penalties.timing += 0.35;
    else if (isOldSourceDate(aggregate.sourceDate)) penalties.timing += 0.6;
  }

  return penalties;
}

function computeOutcomeScore(aggregate: HookOutcomeAggregate): number {
  const score =
    aggregate.positives * 4 +
    aggregate.emailUses * 1.75 +
    aggregate.engaged * 1.1 -
    aggregate.edits * 0.8;
  return Number(Math.max(0, Math.min(12, score)).toFixed(2));
}

export async function recordHookOutcome(params: {
  hookId: string;
  userId: string;
  event: HookFeedbackEvent;
  metadata?: Record<string, unknown>;
}) {
  const [hook] = await db
    .select()
    .from(schema.generatedHooks)
    .where(and(
      eq(schema.generatedHooks.id, params.hookId),
      eq(schema.generatedHooks.userId, params.userId),
    ))
    .limit(1);

  if (!hook) return { ok: false as const, reason: "not_found" };

  const retrievalEvent = inferRetrievalMemoryEvent(params.event);
  if (retrievalEvent) {
    await recordRetrievalOutcome({
      userId: params.userId,
      targetRole: hook.targetRole ?? null,
      sourceType: inferRetrievalSourceType({
        sourceUrl: hook.sourceUrl,
        companyUrl: hook.companyUrl,
        evidenceTier: hook.evidenceTier,
      }),
      triggerType: hook.triggerType ?? null,
      event: retrievalEvent,
    }).catch(() => {});
  }

  await db.insert(schema.hookOutcomes).values({
    generatedHookId: hook.id,
    userId: params.userId,
    event: params.event,
    metadata: {
      ...(params.metadata ?? {}),
      counterfactualContext: buildCounterfactualContext(hook),
    },
  });

  await recordHookOutcomeV2({
    userId: params.userId,
    hookId: hook.id,
    companyUrl: hook.companyUrl,
    companyName: hook.companyName,
    event: params.event,
    metadata: params.metadata,
  }).catch(() => {});

  const [existing] = await db
    .select()
    .from(schema.buyerTensionOutcomes)
    .where(and(
      eq(schema.buyerTensionOutcomes.userId, params.userId),
      matchNullable(schema.buyerTensionOutcomes.buyerTensionId, hook.buyerTensionId),
      matchNullable(schema.buyerTensionOutcomes.targetRole, hook.targetRole),
      matchNullable(schema.buyerTensionOutcomes.triggerType, hook.triggerType),
      eq(schema.buyerTensionOutcomes.angle, hook.angle ?? null),
      matchNullable(schema.buyerTensionOutcomes.structuralVariant, hook.structuralVariant),
    ))
    .limit(1);

  const column = EVENT_COLUMN_MAP[params.event];
  const now = new Date().toISOString();

  if (!existing) {
    await db.insert(schema.buyerTensionOutcomes).values({
      userId: params.userId,
      buyerTensionId: hook.buyerTensionId ?? null,
      targetRole: hook.targetRole ?? null,
      triggerType: hook.triggerType ?? null,
      angle: hook.angle,
      structuralVariant: hook.structuralVariant ?? null,
      impressions: params.event === "viewed" ? 1 : 0,
      copies: params.event === "copied" || params.event === "copied_with_evidence" ? 1 : 0,
      shares: params.event === "shared" ? 1 : 0,
      saves: params.event === "saved" || params.event === "saved_lead" ? 1 : 0,
      emailsUsed: params.event === "email_copied" || params.event === "used_in_email" ? 1 : 0,
      replyWins: params.event === "reply_win" ? 1 : 0,
      positiveReplies: params.event === "positive_reply" ? 1 : 0,
      lastEventAt: now,
    });
  } else {
    await db.update(schema.buyerTensionOutcomes).set({
      impressions: existing.impressions + (params.event === "viewed" ? 1 : 0),
      copies: existing.copies + ((params.event === "copied" || params.event === "copied_with_evidence") ? 1 : 0),
      shares: existing.shares + (params.event === "shared" ? 1 : 0),
      saves: existing.saves + ((params.event === "saved" || params.event === "saved_lead") ? 1 : 0),
      emailsUsed: existing.emailsUsed + ((params.event === "email_copied" || params.event === "used_in_email") ? 1 : 0),
      replyWins: existing.replyWins + (params.event === "reply_win" ? 1 : 0),
      positiveReplies: existing.positiveReplies + (params.event === "positive_reply" ? 1 : 0),
      lastEventAt: now,
    }).where(eq(schema.buyerTensionOutcomes.id, existing.id));
  }

  const styleWeight = getStyleEventWeight(params.event);
  if (styleWeight > 0) {
    const workspaceId = await resolveWorkspaceId(params.userId);
    const [styleMemory, userStyleMemory, timingMemory] = await Promise.all([
      db
        .select()
        .from(schema.workspaceStyleMemory)
        .where(eq(schema.workspaceStyleMemory.workspaceId, workspaceId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(schema.userOutreachMemory)
        .where(eq(schema.userOutreachMemory.userId, params.userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      db
        .select()
        .from(schema.userTimingMemory)
        .where(eq(schema.userTimingMemory.userId, params.userId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    const lengthBucket = classifyHookLength(hook.hookText);
    const styleSignals = extractStyleSignals(hook.hookText);
    const channel = inferChannelFromFeedback(params.event, params.metadata);
    const tone = inferToneFromFeedback(params.metadata);
    const freshness = getSignalFreshnessBucket(hook.sourceDate);
    const timingWindow = getCurrentTimingWindow();
    const nextValues = {
      shortCount: (styleMemory?.shortCount ?? 0) + (lengthBucket === "short" ? styleWeight : 0),
      mediumCount: (styleMemory?.mediumCount ?? 0) + (lengthBucket === "medium" ? styleWeight : 0),
      longCount: (styleMemory?.longCount ?? 0) + (lengthBucket === "long" ? styleWeight : 0),
      directCount: (styleMemory?.directCount ?? 0) + (styleSignals.direct ? styleWeight : 0),
      conversationalCount: (styleMemory?.conversationalCount ?? 0) + (styleSignals.conversational ? styleWeight : 0),
      formalCount: (styleMemory?.formalCount ?? 0) + (styleSignals.formal ? styleWeight : 0),
      operatorCount: (styleMemory?.operatorCount ?? 0) + (styleSignals.operator ? styleWeight : 0),
      updatedAt: now,
    };

    if (!styleMemory) {
      await db.insert(schema.workspaceStyleMemory).values({
        workspaceId,
        userId: params.userId,
        ...nextValues,
      });
    } else {
      await db.update(schema.workspaceStyleMemory)
        .set(nextValues)
        .where(eq(schema.workspaceStyleMemory.workspaceId, workspaceId));
    }

    const nextUserValues = {
      shortCount: (userStyleMemory?.shortCount ?? 0) + (lengthBucket === "short" ? styleWeight : 0),
      mediumCount: (userStyleMemory?.mediumCount ?? 0) + (lengthBucket === "medium" ? styleWeight : 0),
      longCount: (userStyleMemory?.longCount ?? 0) + (lengthBucket === "long" ? styleWeight : 0),
      directCount: (userStyleMemory?.directCount ?? 0) + (styleSignals.direct ? styleWeight : 0),
      conversationalCount: (userStyleMemory?.conversationalCount ?? 0) + (styleSignals.conversational ? styleWeight : 0),
      formalCount: (userStyleMemory?.formalCount ?? 0) + (styleSignals.formal ? styleWeight : 0),
      operatorCount: (userStyleMemory?.operatorCount ?? 0) + (styleSignals.operator ? styleWeight : 0),
      emailCount: (userStyleMemory?.emailCount ?? 0) + (channel === "email" ? styleWeight : 0),
      linkedinConnectionCount: (userStyleMemory?.linkedinConnectionCount ?? 0) + (channel === "linkedin_connection" ? styleWeight : 0),
      linkedinMessageCount: (userStyleMemory?.linkedinMessageCount ?? 0) + (channel === "linkedin_message" ? styleWeight : 0),
      coldCallCount: (userStyleMemory?.coldCallCount ?? 0) + (channel === "cold_call" ? styleWeight : 0),
      videoScriptCount: (userStyleMemory?.videoScriptCount ?? 0) + (channel === "video_script" ? styleWeight : 0),
      conciseToneCount: (userStyleMemory?.conciseToneCount ?? 0) + (tone === "concise" ? styleWeight : 0),
      warmToneCount: (userStyleMemory?.warmToneCount ?? 0) + (tone === "warm" ? styleWeight : 0),
      directToneCount: (userStyleMemory?.directToneCount ?? 0) + (tone === "direct" ? styleWeight : 0),
      updatedAt: now,
    };

    if (!userStyleMemory) {
      await db.insert(schema.userOutreachMemory).values({
        userId: params.userId,
        ...nextUserValues,
      });
    } else {
      await db.update(schema.userOutreachMemory)
        .set(nextUserValues)
        .where(eq(schema.userOutreachMemory.userId, params.userId));
    }

    const nextTimingValues = {
      freshSignalCount: (timingMemory?.freshSignalCount ?? 0) + (freshness === "fresh" ? styleWeight : 0),
      recentSignalCount: (timingMemory?.recentSignalCount ?? 0) + (freshness === "recent" ? styleWeight : 0),
      staleSignalCount: (timingMemory?.staleSignalCount ?? 0) + (freshness === "stale" ? styleWeight : 0),
      undatedSignalCount: (timingMemory?.undatedSignalCount ?? 0) + (freshness === "undated" ? styleWeight : 0),
      weekdayMorningCount: (timingMemory?.weekdayMorningCount ?? 0) + (timingWindow === "weekday_morning" ? styleWeight : 0),
      weekdayAfternoonCount: (timingMemory?.weekdayAfternoonCount ?? 0) + (timingWindow === "weekday_afternoon" ? styleWeight : 0),
      weekdayEveningCount: (timingMemory?.weekdayEveningCount ?? 0) + (timingWindow === "weekday_evening" ? styleWeight : 0),
      weekendCount: (timingMemory?.weekendCount ?? 0) + (timingWindow === "weekend" ? styleWeight : 0),
      updatedAt: now,
    };

    if (!timingMemory) {
      await db.insert(schema.userTimingMemory).values({
        userId: params.userId,
        ...nextTimingValues,
      });
    } else {
      await db.update(schema.userTimingMemory)
        .set(nextTimingValues)
        .where(eq(schema.userTimingMemory.userId, params.userId));
    }
  }

  return { ok: true as const, hook };
}

export async function getHookSelectorPriors(params: {
  userId: string;
  companyUrl?: string | null;
  targetRole?: string | null;
}): Promise<HookSelectorPriors> {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const recentSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const outcomeRows = await db
    .select({
      buyerTensionId: schema.buyerTensionOutcomes.buyerTensionId,
      triggerType: schema.buyerTensionOutcomes.triggerType,
      angle: schema.buyerTensionOutcomes.angle,
      structuralVariant: schema.buyerTensionOutcomes.structuralVariant,
      impressions: schema.buyerTensionOutcomes.impressions,
      copies: schema.buyerTensionOutcomes.copies,
      shares: schema.buyerTensionOutcomes.shares,
      saves: schema.buyerTensionOutcomes.saves,
      emailsUsed: schema.buyerTensionOutcomes.emailsUsed,
      replyWins: schema.buyerTensionOutcomes.replyWins,
      positiveReplies: schema.buyerTensionOutcomes.positiveReplies,
    })
    .from(schema.buyerTensionOutcomes)
    .where(and(
      eq(schema.buyerTensionOutcomes.userId, params.userId),
      params.targetRole ? eq(schema.buyerTensionOutcomes.targetRole, params.targetRole) : undefined,
      gte(schema.buyerTensionOutcomes.lastEventAt, since),
    ));

  const recentCompanyHooks = params.companyUrl
    ? await db
        .select({
          buyerTensionId: schema.generatedHooks.buyerTensionId,
          structuralVariant: schema.generatedHooks.structuralVariant,
          hookText: schema.generatedHooks.hookText,
        })
        .from(schema.generatedHooks)
        .where(and(
          eq(schema.generatedHooks.userId, params.userId),
          eq(schema.generatedHooks.companyUrl, params.companyUrl),
          params.targetRole ? eq(schema.generatedHooks.targetRole, params.targetRole) : undefined,
          gte(schema.generatedHooks.createdAt, recentSince),
        ))
        .orderBy(desc(schema.generatedHooks.createdAt))
        .limit(20)
    : [];

  const workspaceId = await resolveWorkspaceId(params.userId);
  const [styleMemory, userStyleMemory, timingMemory, workspaceProfile, retrievalMemoryPriors] = await Promise.all([
    db
      .select()
      .from(schema.workspaceStyleMemory)
      .where(eq(schema.workspaceStyleMemory.workspaceId, workspaceId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(schema.userOutreachMemory)
      .where(eq(schema.userOutreachMemory.userId, params.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(schema.userTimingMemory)
      .where(eq(schema.userTimingMemory.userId, params.userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getWorkspaceProfile(workspaceId),
    getRetrievalMemoryPriors({
      userId: params.userId,
      targetRole: params.targetRole ?? null,
    }).catch(() => ({
      sourceTypeBoosts: {},
      triggerSourceTypeBoosts: {},
      pinnedSourceTypes: {},
      pinnedTriggerSourceTypes: {},
    })),
  ]);

  const preferredLength = styleMemory
    ? [...([
        ["short", styleMemory.shortCount],
        ["medium", styleMemory.mediumCount],
        ["long", styleMemory.longCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const totalStyle =
    (styleMemory?.shortCount ?? 0) +
    (styleMemory?.mediumCount ?? 0) +
    (styleMemory?.longCount ?? 0);

  const normalizePreference = (value: number | undefined) =>
    totalStyle > 0 ? Number((((value ?? 0) / totalStyle) * 2).toFixed(2)) : 0;

  const totalUserStyle =
    (userStyleMemory?.shortCount ?? 0) +
    (userStyleMemory?.mediumCount ?? 0) +
    (userStyleMemory?.longCount ?? 0);

  const normalizeUserPreference = (value: number | undefined) =>
    totalUserStyle > 0 ? Number((((value ?? 0) / totalUserStyle) * 2.25).toFixed(2)) : 0;

  const preferredUserLength = userStyleMemory
    ? [...([
        ["short", userStyleMemory.shortCount],
        ["medium", userStyleMemory.mediumCount],
        ["long", userStyleMemory.longCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const preferredTone = userStyleMemory
    ? [...([
        ["concise", userStyleMemory.conciseToneCount],
        ["warm", userStyleMemory.warmToneCount],
        ["direct", userStyleMemory.directToneCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const preferredChannel = userStyleMemory
    ? [...([
        ["email", userStyleMemory.emailCount],
        ["linkedin_connection", userStyleMemory.linkedinConnectionCount],
        ["linkedin_message", userStyleMemory.linkedinMessageCount],
        ["cold_call", userStyleMemory.coldCallCount],
        ["video_script", userStyleMemory.videoScriptCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const preferredFreshness = timingMemory
    ? [...([
        ["fresh", timingMemory.freshSignalCount],
        ["recent", timingMemory.recentSignalCount],
        ["stale", timingMemory.staleSignalCount],
        ["undated", timingMemory.undatedSignalCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const preferredSendWindow = timingMemory
    ? [...([
        ["weekday_morning", timingMemory.weekdayMorningCount],
        ["weekday_afternoon", timingMemory.weekdayAfternoonCount],
        ["weekday_evening", timingMemory.weekdayEveningCount],
        ["weekend", timingMemory.weekendCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const totalTimingPreference =
    (timingMemory?.freshSignalCount ?? 0) +
    (timingMemory?.recentSignalCount ?? 0) +
    (timingMemory?.staleSignalCount ?? 0) +
    (timingMemory?.undatedSignalCount ?? 0);

  const normalizeTimingPreference = (value: number | undefined) =>
    totalTimingPreference > 0 ? Number((((value ?? 0) / totalTimingPreference) * 2).toFixed(2)) : 0;

  const priors: HookSelectorPriors = {
    buyerTensionBoosts: {},
    structuralVariantBoosts: {},
    angleBoosts: {},
    triggerTypeBoosts: {},
    buyerTensionTrials: {},
    structuralVariantTrials: {},
    angleTrials: {},
    triggerTypeTrials: {},
    totalTrials: 0,
    explorationWeight: 0.85,
    workspaceStyle: {
      preferredLength,
      directnessPreference: normalizePreference(styleMemory?.directCount),
      conversationalPreference: normalizePreference(styleMemory?.conversationalCount),
      formalPreference: normalizePreference(styleMemory?.formalCount),
      operatorPreference: normalizePreference(styleMemory?.operatorCount),
      explicitVoiceTone: workspaceProfile?.voiceTone ?? null,
    },
    userStyle: {
      preferredLength: preferredUserLength,
      directnessPreference: normalizeUserPreference(userStyleMemory?.directCount),
      conversationalPreference: normalizeUserPreference(userStyleMemory?.conversationalCount),
      formalPreference: normalizeUserPreference(userStyleMemory?.formalCount),
      operatorPreference: normalizeUserPreference(userStyleMemory?.operatorCount),
      preferredTone: preferredTone as "concise" | "warm" | "direct" | null,
      preferredChannel: preferredChannel as "email" | "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script" | null,
    },
    timingPreference: {
      preferredFreshness: preferredFreshness as "fresh" | "recent" | "stale" | "undated" | null,
      freshPreference: normalizeTimingPreference(timingMemory?.freshSignalCount),
      recentPreference: normalizeTimingPreference(timingMemory?.recentSignalCount),
      staleTolerance: normalizeTimingPreference(timingMemory?.staleSignalCount),
      undatedTolerance: normalizeTimingPreference(timingMemory?.undatedSignalCount),
      preferredSendWindow: preferredSendWindow as "weekday_morning" | "weekday_afternoon" | "weekday_evening" | "weekend" | null,
    },
    recentCompanyMemory: {
      buyerTensionIds: recentCompanyHooks.map((row) => row.buyerTensionId).filter((value): value is string => !!value),
      structuralVariants: recentCompanyHooks.map((row) => row.structuralVariant).filter((value): value is string => !!value),
      hookTexts: recentCompanyHooks.map((row) => row.hookText).filter((value): value is string => !!value),
    },
    currentCompanyDomain: params.companyUrl ? getDomain(params.companyUrl) : null,
    retrievalLibrary: [],
    sourceTypeBoosts: { ...(retrievalMemoryPriors.sourceTypeBoosts ?? {}) },
    triggerSourceTypeBoosts: { ...(retrievalMemoryPriors.triggerSourceTypeBoosts ?? {}) },
    pinnedSourceTypes: { ...(retrievalMemoryPriors.pinnedSourceTypes ?? {}) },
    pinnedTriggerSourceTypes: { ...(retrievalMemoryPriors.pinnedTriggerSourceTypes ?? {}) },
    counterfactuals: {
      buyerTensionPenalties: {},
      structuralVariantPenalties: {},
      evidenceTierPenalties: {},
      targetRolePenalties: {},
      staleSourcePenalty: 0,
      undatedSourcePenalty: 0,
    },
  };

  const hookOutcomeRows = await db
    .select({
      generatedHookId: schema.hookOutcomes.generatedHookId,
      event: schema.hookOutcomes.event,
      evidenceTier: schema.generatedHooks.evidenceTier,
      sourceDate: schema.generatedHooks.sourceDate,
      sourceUrl: schema.generatedHooks.sourceUrl,
      companyUrl: schema.generatedHooks.companyUrl,
      targetRole: schema.generatedHooks.targetRole,
      buyerTensionId: schema.generatedHooks.buyerTensionId,
      structuralVariant: schema.generatedHooks.structuralVariant,
      angle: schema.generatedHooks.angle,
      triggerType: schema.generatedHooks.triggerType,
      hookText: schema.generatedHooks.hookText,
      evidenceSnippet: schema.generatedHooks.sourceSnippet,
      sourceTitle: schema.generatedHooks.sourceTitle,
    })
    .from(schema.hookOutcomes)
    .innerJoin(
      schema.generatedHooks,
      eq(schema.hookOutcomes.generatedHookId, schema.generatedHooks.id),
    )
    .where(and(
      eq(schema.hookOutcomes.userId, params.userId),
      params.targetRole ? eq(schema.generatedHooks.targetRole, params.targetRole) : undefined,
      gte(schema.hookOutcomes.createdAt, since),
    ));

  const aggregates = new Map<string, HookOutcomeAggregate>();
  for (const row of hookOutcomeRows) {
    const existing = aggregates.get(row.generatedHookId) ?? {
      generatedHookId: row.generatedHookId,
      evidenceTier: row.evidenceTier as EvidenceTier,
      sourceDate: row.sourceDate,
      sourceUrl: row.sourceUrl,
      companyUrl: row.companyUrl,
      targetRole: row.targetRole,
      buyerTensionId: row.buyerTensionId,
      structuralVariant: row.structuralVariant,
      angle: row.angle,
      triggerType: row.triggerType,
      hookText: row.hookText,
      evidenceSnippet: row.evidenceSnippet,
      sourceTitle: row.sourceTitle,
      impressions: 0,
      engaged: 0,
      emailUses: 0,
      positives: 0,
      edits: 0,
    };

    if (row.event === "viewed") existing.impressions += 1;
    if (["copied", "copied_with_evidence", "email_copied", "shared", "saved", "used_in_email", "saved_lead"].includes(row.event)) {
      existing.engaged += 1;
    }
    if (["email_copied", "used_in_email"].includes(row.event)) {
      existing.emailUses += 1;
    }
    if (["reply_win", "positive_reply"].includes(row.event)) {
      existing.positives += 1;
    }
    if (row.event === "edited") {
      existing.edits += 1;
    }

    aggregates.set(row.generatedHookId, existing);
  }

  for (const row of outcomeRows) {
    const trials = row.impressions + row.copies + row.shares + row.saves + row.emailsUsed + row.replyWins + row.positiveReplies;
    priors.totalTrials += trials;

    const weighted =
      row.impressions * EVENT_WEIGHT.viewed +
      row.copies * EVENT_WEIGHT.copied +
      row.shares * EVENT_WEIGHT.shared +
      row.saves * EVENT_WEIGHT.saved +
      row.emailsUsed * EVENT_WEIGHT.used_in_email +
      row.replyWins * EVENT_WEIGHT.reply_win +
      row.positiveReplies * EVENT_WEIGHT.positive_reply;

    const baseline = Math.max(1, row.impressions || row.copies || row.shares || row.saves || row.emailsUsed);
    const adjustment = Math.max(-1.5, Math.min(2.5, Number(((weighted / baseline) - 0.6).toFixed(2))));

    if (row.buyerTensionId) priors.buyerTensionBoosts[row.buyerTensionId] = adjustment;
    if (row.structuralVariant) priors.structuralVariantBoosts[row.structuralVariant] = adjustment;
    if (row.angle) priors.angleBoosts[row.angle] = adjustment;
    if (row.triggerType) priors.triggerTypeBoosts[row.triggerType] = adjustment;

    if (row.buyerTensionId) priors.buyerTensionTrials[row.buyerTensionId] = trials;
    if (row.structuralVariant) priors.structuralVariantTrials[row.structuralVariant] = (priors.structuralVariantTrials[row.structuralVariant] ?? 0) + trials;
    if (row.angle) priors.angleTrials[row.angle] = (priors.angleTrials[row.angle] ?? 0) + trials;
    if (row.triggerType) priors.triggerTypeTrials[row.triggerType] = (priors.triggerTypeTrials[row.triggerType] ?? 0) + trials;
  }

  for (const aggregate of aggregates.values()) {
    const signals = inferCounterfactualPenaltySignals(aggregate);
    addPenalty(priors.counterfactuals!.buyerTensionPenalties, aggregate.buyerTensionId, signals.buyerTension);
    addPenalty(priors.counterfactuals!.structuralVariantPenalties, aggregate.structuralVariant, signals.wording);

    if (signals.sourceQuality > 0) {
      const current = priors.counterfactuals!.evidenceTierPenalties[aggregate.evidenceTier] ?? 0;
      priors.counterfactuals!.evidenceTierPenalties[aggregate.evidenceTier] = Number(Math.min(1.5, current + signals.sourceQuality).toFixed(2));
    }

    addPenalty(priors.counterfactuals!.targetRolePenalties, aggregate.targetRole, signals.roleMapping);

    if (signals.timing > 0) {
      if (!aggregate.sourceDate) {
        priors.counterfactuals!.undatedSourcePenalty = Number(Math.min(1.2, priors.counterfactuals!.undatedSourcePenalty + signals.timing).toFixed(2));
      } else if (isOldSourceDate(aggregate.sourceDate)) {
        priors.counterfactuals!.staleSourcePenalty = Number(Math.min(1.4, priors.counterfactuals!.staleSourcePenalty + signals.timing).toFixed(2));
      }
    }
  }

  const sourceTypeOutcomes = {
    first_party: { weighted: 0, baseline: 0 },
    trusted_news: { weighted: 0, baseline: 0 },
    semantic_web: { weighted: 0, baseline: 0 },
    fallback_web: { weighted: 0, baseline: 0 },
  } satisfies Record<"first_party" | "trusted_news" | "semantic_web" | "fallback_web", { weighted: number; baseline: number }>;
  const triggerSourceTypeOutcomes: Record<
    string,
    Record<"first_party" | "trusted_news" | "semantic_web" | "fallback_web", { weighted: number; baseline: number }>
  > = {};

  for (const aggregate of aggregates.values()) {
    const sourceType = aggregate.sourceUrl
      ? classifyRetrievalSourceType(
          {
            url: aggregate.sourceUrl,
            tier: aggregate.evidenceTier,
            anchorScore: undefined,
            entity_hit_score: undefined,
            stale: false,
          },
          aggregate.companyUrl ? getDomain(aggregate.companyUrl) : null,
        )
      : "fallback_web";

    const weighted =
      aggregate.impressions * EVENT_WEIGHT.viewed +
      aggregate.engaged * EVENT_WEIGHT.copied +
      aggregate.emailUses * EVENT_WEIGHT.used_in_email +
      aggregate.positives * EVENT_WEIGHT.positive_reply;
    const baseline = Math.max(1, aggregate.impressions + aggregate.engaged + aggregate.emailUses);

    sourceTypeOutcomes[sourceType].weighted += weighted;
    sourceTypeOutcomes[sourceType].baseline += baseline;

    if (aggregate.triggerType) {
      const triggerBucket = triggerSourceTypeOutcomes[aggregate.triggerType] ?? {
        first_party: { weighted: 0, baseline: 0 },
        trusted_news: { weighted: 0, baseline: 0 },
        semantic_web: { weighted: 0, baseline: 0 },
        fallback_web: { weighted: 0, baseline: 0 },
      };
      triggerBucket[sourceType].weighted += weighted;
      triggerBucket[sourceType].baseline += baseline;
      triggerSourceTypeOutcomes[aggregate.triggerType] = triggerBucket;
    }
  }

  for (const [sourceType, totals] of Object.entries(sourceTypeOutcomes) as Array<[keyof typeof sourceTypeOutcomes, { weighted: number; baseline: number }]>) {
    if (totals.baseline <= 0) continue;
    const adjustment = Math.max(-0.6, Math.min(1.2, Number(((totals.weighted / totals.baseline) - 0.6).toFixed(2))));
    priors.sourceTypeBoosts![sourceType] = Number((((priors.sourceTypeBoosts![sourceType] ?? 0) + adjustment) / 2).toFixed(2));
  }

  for (const [triggerType, sourceTypeTotals] of Object.entries(triggerSourceTypeOutcomes)) {
    const triggerBoosts = { ...(priors.triggerSourceTypeBoosts?.[triggerType] ?? {}) };
    let hasAdjustment = false;

    for (const [sourceType, totals] of Object.entries(sourceTypeTotals) as Array<[keyof typeof sourceTypeOutcomes, { weighted: number; baseline: number }]>) {
      if (totals.baseline <= 0) continue;
      const adjustment = Math.max(-0.6, Math.min(1.2, Number(((totals.weighted / totals.baseline) - 0.6).toFixed(2))));
      triggerBoosts[sourceType] = Number((((triggerBoosts[sourceType] ?? 0) + adjustment) / 2).toFixed(2));
      hasAdjustment = true;
    }

    if (hasAdjustment) {
      priors.triggerSourceTypeBoosts![triggerType] = triggerBoosts;
    }
  }

  const retrievalSeen = new Set<string>();
  for (const aggregate of [...aggregates.values()].sort((a, b) => computeOutcomeScore(b) - computeOutcomeScore(a))) {
    const outcomeScore = computeOutcomeScore(aggregate);
    if (outcomeScore < 2.5) continue;

    const dedupeKey = [
      aggregate.buyerTensionId ?? "none",
      aggregate.structuralVariant ?? "none",
      aggregate.angle ?? "none",
      aggregate.triggerType ?? "none",
    ].join("|");
    if (retrievalSeen.has(dedupeKey)) continue;
    retrievalSeen.add(dedupeKey);

    priors.retrievalLibrary!.push({
      generatedHookId: aggregate.generatedHookId,
      buyerTensionId: aggregate.buyerTensionId,
      structuralVariant: aggregate.structuralVariant,
      angle: (aggregate.angle === "risk" || aggregate.angle === "tradeoff" ? aggregate.angle : "trigger"),
      triggerType: aggregate.triggerType as RetrievedHookPattern["triggerType"],
      targetRole: aggregate.targetRole,
      evidenceTier: aggregate.evidenceTier,
      hookText: aggregate.hookText,
      evidenceSnippet: aggregate.evidenceSnippet,
      sourceTitle: aggregate.sourceTitle,
      sourceType: aggregate.sourceUrl
        ? classifyRetrievalSourceType(
            {
              url: aggregate.sourceUrl,
              tier: aggregate.evidenceTier,
              anchorScore: undefined,
              entity_hit_score: undefined,
              stale: false,
            },
            aggregate.companyUrl ? getDomain(aggregate.companyUrl) : null,
          )
        : "fallback_web",
      outcomeScore,
    });

    if (priors.retrievalLibrary!.length >= 4) break;
  }

  return priors;
}
