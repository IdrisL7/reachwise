import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { classifyRetrievalSourceType } from "@/lib/retrieval-plan";
import { getDomain } from "@/lib/hooks";

export type RetrievalMemorySourceType =
  | "first_party"
  | "trusted_news"
  | "semantic_web"
  | "fallback_web";

export type RetrievalMemoryEvent =
  | "viewed"
  | "engaged"
  | "email_used"
  | "win";

export type RetrievalMemoryPriors = {
  sourceTypeBoosts: Partial<Record<RetrievalMemorySourceType, number>>;
  triggerSourceTypeBoosts: Partial<Record<string, Partial<Record<RetrievalMemorySourceType, number>>>>;
  pinnedSourceTypes: Partial<Record<RetrievalMemorySourceType, boolean>>;
  pinnedTriggerSourceTypes: Partial<Record<string, Partial<Record<RetrievalMemorySourceType, boolean>>>>;
};

export type RetrievalMemorySummary = {
  topSourcePreferences: Array<{
    sourceType: RetrievalMemorySourceType;
    adjustment: number;
    pinned?: boolean;
  }>;
  topTriggerPreferences: Array<{
    triggerType: string;
    sourceType: RetrievalMemorySourceType;
    adjustment: number;
    pinned?: boolean;
  }>;
};

type RetrievalMemoryCounts = {
  viewCount: number | null;
  engagementCount: number | null;
  emailUseCount: number | null;
  winCount: number | null;
};

const DECAY_FACTOR = 0.94;

function applyDecayEvent<T extends {
  viewCount: number | null | undefined;
  engagementCount: number | null | undefined;
  emailUseCount: number | null | undefined;
  winCount: number | null | undefined;
}>(existing: T | null | undefined, event: RetrievalMemoryEvent, now: string) {
  return {
    viewCount: (existing?.viewCount ?? 0) * DECAY_FACTOR + (event === "viewed" ? 1 : 0),
    engagementCount: (existing?.engagementCount ?? 0) * DECAY_FACTOR + (event === "engaged" ? 1 : 0),
    emailUseCount: (existing?.emailUseCount ?? 0) * DECAY_FACTOR + (event === "email_used" ? 1 : 0),
    winCount: (existing?.winCount ?? 0) * DECAY_FACTOR + (event === "win" ? 1 : 0),
    updatedAt: now,
  };
}

function computeAdjustment(row: {
  viewCount: number | null;
  engagementCount: number | null;
  emailUseCount: number | null;
  winCount: number | null;
}): number {
  const views = Math.max(0, row.viewCount ?? 0);
  const engagement = Math.max(0, row.engagementCount ?? 0);
  const emails = Math.max(0, row.emailUseCount ?? 0);
  const wins = Math.max(0, row.winCount ?? 0);
  const weighted = engagement * 1.1 + emails * 1.9 + wins * 3.2;
  const baseline = Math.max(1, views + engagement + emails);
  return Number(Math.max(-0.6, Math.min(1.4, ((weighted / baseline) - 0.55))).toFixed(2));
}

export function scaleRetrievalMemoryCounts(
  row: RetrievalMemoryCounts,
  factor: number,
  now: string,
) {
  const clampedFactor = Math.max(0, Math.min(1, factor));
  return {
    viewCount: Number(((row.viewCount ?? 0) * clampedFactor).toFixed(3)),
    engagementCount: Number(((row.engagementCount ?? 0) * clampedFactor).toFixed(3)),
    emailUseCount: Number(((row.emailUseCount ?? 0) * clampedFactor).toFixed(3)),
    winCount: Number(((row.winCount ?? 0) * clampedFactor).toFixed(3)),
    updatedAt: now,
  };
}

export function summarizeRetrievalMemoryRows(rows: Array<{
  sourceType: string;
  triggerType: string | null;
  viewCount: number | null;
  engagementCount: number | null;
  emailUseCount: number | null;
  winCount: number | null;
}>, pins?: {
  pinnedSourceTypes?: Partial<Record<RetrievalMemorySourceType, boolean>>;
  pinnedTriggerSourceTypes?: Partial<Record<string, Partial<Record<RetrievalMemorySourceType, boolean>>>>;
}): RetrievalMemorySummary {
  const sourceTypeBoosts = new Map<RetrievalMemorySourceType, number>();
  const triggerPreferences: RetrievalMemorySummary["topTriggerPreferences"] = [];

  for (const row of rows) {
    const sourceType = row.sourceType as RetrievalMemorySourceType;
    const adjustment = computeAdjustment(row);

    if (!row.triggerType) {
      sourceTypeBoosts.set(sourceType, adjustment);
      continue;
    }

    triggerPreferences.push({
      triggerType: row.triggerType,
      sourceType,
      adjustment,
      pinned: pins?.pinnedTriggerSourceTypes?.[row.triggerType]?.[sourceType] ?? false,
    });
  }

  return {
    topSourcePreferences: [...sourceTypeBoosts.entries()]
      .map(([sourceType, adjustment]) => ({
        sourceType,
        adjustment,
        pinned: pins?.pinnedSourceTypes?.[sourceType] ?? false,
      }))
      .sort((a, b) => b.adjustment - a.adjustment)
      .slice(0, 4),
    topTriggerPreferences: triggerPreferences
      .sort((a, b) => b.adjustment - a.adjustment)
      .slice(0, 6),
  };
}

export function inferRetrievalMemoryEvent(event: string): RetrievalMemoryEvent | null {
  if (event === "viewed") return "viewed";
  if (event === "copied" || event === "copied_with_evidence" || event === "shared" || event === "saved" || event === "saved_lead") return "engaged";
  if (event === "email_copied" || event === "used_in_email") return "email_used";
  if (event === "reply_win" || event === "positive_reply") return "win";
  return null;
}

export function inferRetrievalSourceType(params: {
  sourceUrl?: string | null;
  companyUrl?: string | null;
  evidenceTier?: "A" | "B" | "C" | null;
}): RetrievalMemorySourceType {
  if (!params.sourceUrl) return "fallback_web";
  return classifyRetrievalSourceType(
    {
      url: params.sourceUrl,
      tier: params.evidenceTier ?? "C",
      anchorScore: undefined,
      entity_hit_score: undefined,
      stale: false,
    },
    params.companyUrl ? getDomain(params.companyUrl) : null,
  );
}

export async function recordRetrievalOutcome(params: {
  userId: string;
  targetRole?: string | null;
  sourceType: RetrievalMemorySourceType;
  triggerType?: string | null;
  event: RetrievalMemoryEvent;
}) {
  const [existing] = await db
    .select()
    .from(schema.userRetrievalMemory)
    .where(and(
      eq(schema.userRetrievalMemory.userId, params.userId),
      params.targetRole == null
        ? isNull(schema.userRetrievalMemory.targetRole)
        : eq(schema.userRetrievalMemory.targetRole, params.targetRole),
      eq(schema.userRetrievalMemory.sourceType, params.sourceType),
      params.triggerType == null
        ? isNull(schema.userRetrievalMemory.triggerType)
        : eq(schema.userRetrievalMemory.triggerType, params.triggerType),
    ))
    .limit(1);

  const now = new Date().toISOString();
  const nextValues = applyDecayEvent(existing ?? null, params.event, now);

  if (!existing) {
    await db.insert(schema.userRetrievalMemory).values({
      userId: params.userId,
      targetRole: params.targetRole ?? null,
      sourceType: params.sourceType,
      triggerType: params.triggerType ?? null,
      ...nextValues,
    });
    return;
  }

  await db.update(schema.userRetrievalMemory)
    .set(nextValues)
    .where(eq(schema.userRetrievalMemory.id, existing.id));
}

export async function getRetrievalMemoryPriors(params: {
  userId: string;
  targetRole?: string | null;
}) : Promise<RetrievalMemoryPriors> {
  const [rows, pinRows] = await Promise.all([
    db
    .select()
    .from(schema.userRetrievalMemory)
    .where(and(
      eq(schema.userRetrievalMemory.userId, params.userId),
      params.targetRole == null
        ? undefined
        : eq(schema.userRetrievalMemory.targetRole, params.targetRole),
    )),
    db
      .select()
      .from(schema.userRetrievalPins)
      .where(and(
        eq(schema.userRetrievalPins.userId, params.userId),
        params.targetRole == null
          ? undefined
          : eq(schema.userRetrievalPins.targetRole, params.targetRole),
      )),
  ]);

  const priors: RetrievalMemoryPriors = {
    sourceTypeBoosts: {},
    triggerSourceTypeBoosts: {},
    pinnedSourceTypes: {},
    pinnedTriggerSourceTypes: {},
  };

  for (const row of rows) {
    const adjustment = computeAdjustment(row);
    const sourceType = row.sourceType as RetrievalMemorySourceType;
    priors.sourceTypeBoosts[sourceType] = adjustment;

    if (row.triggerType) {
      const triggerBucket = priors.triggerSourceTypeBoosts[row.triggerType] ?? {};
      triggerBucket[sourceType] = adjustment;
      priors.triggerSourceTypeBoosts[row.triggerType] = triggerBucket;
    }
  }

  for (const pin of pinRows) {
    const sourceType = pin.sourceType as RetrievalMemorySourceType;
    const boost = Number(pin.boost ?? (pin.triggerType ? 1.35 : 1.1));

    if (pin.triggerType) {
      const triggerBoosts = priors.triggerSourceTypeBoosts[pin.triggerType] ?? {};
      triggerBoosts[sourceType] = Number(Math.max(triggerBoosts[sourceType] ?? 0, boost).toFixed(2));
      priors.triggerSourceTypeBoosts[pin.triggerType] = triggerBoosts;

      const triggerPins = priors.pinnedTriggerSourceTypes[pin.triggerType] ?? {};
      triggerPins[sourceType] = true;
      priors.pinnedTriggerSourceTypes[pin.triggerType] = triggerPins;
      continue;
    }

    priors.sourceTypeBoosts[sourceType] = Number(Math.max(priors.sourceTypeBoosts[sourceType] ?? 0, boost).toFixed(2));
    priors.pinnedSourceTypes[sourceType] = true;
  }

  return priors;
}

export async function dampenRetrievalMemory(params: {
  userId: string;
  factor?: number;
}): Promise<RetrievalMemorySummary> {
  const rows = await db
    .select()
    .from(schema.userRetrievalMemory)
    .where(eq(schema.userRetrievalMemory.userId, params.userId));

  if (rows.length === 0) {
    return {
      topSourcePreferences: [],
      topTriggerPreferences: [],
    };
  }

  const now = new Date().toISOString();
  const factor = params.factor ?? 0.5;

  await Promise.all(rows.map((row) =>
    db.update(schema.userRetrievalMemory)
      .set(scaleRetrievalMemoryCounts(row, factor, now))
      .where(eq(schema.userRetrievalMemory.id, row.id))
  ));

  return summarizeRetrievalMemoryRows(rows.map((row) => ({
    sourceType: row.sourceType,
    triggerType: row.triggerType,
    ...scaleRetrievalMemoryCounts(row, factor, now),
  })));
}

export async function resetRetrievalMemory(params: {
  userId: string;
}): Promise<void> {
  await db
    .delete(schema.userRetrievalMemory)
    .where(eq(schema.userRetrievalMemory.userId, params.userId));
}

export async function pinRetrievalPreference(params: {
  userId: string;
  targetRole?: string | null;
  sourceType: RetrievalMemorySourceType;
  triggerType?: string | null;
  boost?: number;
}) {
  const [existing] = await db
    .select()
    .from(schema.userRetrievalPins)
    .where(and(
      eq(schema.userRetrievalPins.userId, params.userId),
      params.targetRole == null
        ? isNull(schema.userRetrievalPins.targetRole)
        : eq(schema.userRetrievalPins.targetRole, params.targetRole),
      eq(schema.userRetrievalPins.sourceType, params.sourceType),
      params.triggerType == null
        ? isNull(schema.userRetrievalPins.triggerType)
        : eq(schema.userRetrievalPins.triggerType, params.triggerType),
    ))
    .limit(1);

  const now = new Date().toISOString();
  const boost = params.boost ?? (params.triggerType ? 1.35 : 1.1);

  if (existing) {
    await db.update(schema.userRetrievalPins)
      .set({ boost, updatedAt: now })
      .where(eq(schema.userRetrievalPins.id, existing.id));
    return;
  }

  await db.insert(schema.userRetrievalPins).values({
    userId: params.userId,
    targetRole: params.targetRole ?? null,
    sourceType: params.sourceType,
    triggerType: params.triggerType ?? null,
    boost,
    updatedAt: now,
  });
}

export async function unpinRetrievalPreference(params: {
  userId: string;
  targetRole?: string | null;
  sourceType: RetrievalMemorySourceType;
  triggerType?: string | null;
}) {
  await db.delete(schema.userRetrievalPins)
    .where(and(
      eq(schema.userRetrievalPins.userId, params.userId),
      params.targetRole == null
        ? isNull(schema.userRetrievalPins.targetRole)
        : eq(schema.userRetrievalPins.targetRole, params.targetRole),
      eq(schema.userRetrievalPins.sourceType, params.sourceType),
      params.triggerType == null
        ? isNull(schema.userRetrievalPins.triggerType)
        : eq(schema.userRetrievalPins.triggerType, params.triggerType),
    ));
}

export async function getRetrievalMemorySummary(params: {
  userId: string;
  targetRole?: string | null;
}): Promise<RetrievalMemorySummary> {
  const [rows, pinRows] = await Promise.all([
    db
      .select({
        sourceType: schema.userRetrievalMemory.sourceType,
        triggerType: schema.userRetrievalMemory.triggerType,
        viewCount: schema.userRetrievalMemory.viewCount,
        engagementCount: schema.userRetrievalMemory.engagementCount,
        emailUseCount: schema.userRetrievalMemory.emailUseCount,
        winCount: schema.userRetrievalMemory.winCount,
      })
      .from(schema.userRetrievalMemory)
      .where(and(
        eq(schema.userRetrievalMemory.userId, params.userId),
        params.targetRole == null
          ? undefined
          : eq(schema.userRetrievalMemory.targetRole, params.targetRole),
      )),
    db
      .select({
        sourceType: schema.userRetrievalPins.sourceType,
        triggerType: schema.userRetrievalPins.triggerType,
      })
      .from(schema.userRetrievalPins)
      .where(and(
        eq(schema.userRetrievalPins.userId, params.userId),
        params.targetRole == null
          ? undefined
          : eq(schema.userRetrievalPins.targetRole, params.targetRole),
      )),
  ]);

  const pinnedSourceTypes: Partial<Record<RetrievalMemorySourceType, boolean>> = {};
  const pinnedTriggerSourceTypes: Partial<Record<string, Partial<Record<RetrievalMemorySourceType, boolean>>>> = {};

  for (const pin of pinRows) {
    const sourceType = pin.sourceType as RetrievalMemorySourceType;
    if (pin.triggerType) {
      const triggerPins = pinnedTriggerSourceTypes[pin.triggerType] ?? {};
      triggerPins[sourceType] = true;
      pinnedTriggerSourceTypes[pin.triggerType] = triggerPins;
    } else {
      pinnedSourceTypes[sourceType] = true;
    }
  }

  const summary = summarizeRetrievalMemoryRows(rows, {
    pinnedSourceTypes,
    pinnedTriggerSourceTypes,
  });

  for (const [sourceType] of Object.entries(pinnedSourceTypes) as Array<[RetrievalMemorySourceType, boolean]>) {
    if (!summary.topSourcePreferences.some((row) => row.sourceType === sourceType)) {
      summary.topSourcePreferences.push({
        sourceType,
        adjustment: 1.1,
        pinned: true,
      });
    }
  }

  for (const [triggerType, sourcePins] of Object.entries(pinnedTriggerSourceTypes)) {
    for (const [sourceType] of Object.entries(sourcePins ?? {}) as Array<[RetrievalMemorySourceType, boolean]>) {
      if (!summary.topTriggerPreferences.some((row) => row.triggerType === triggerType && row.sourceType === sourceType)) {
        summary.topTriggerPreferences.push({
          triggerType,
          sourceType,
          adjustment: 1.35,
          pinned: true,
        });
      }
    }
  }

  summary.topSourcePreferences = summary.topSourcePreferences
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.adjustment - a.adjustment)
    .slice(0, 4);
  summary.topTriggerPreferences = summary.topTriggerPreferences
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.adjustment - a.adjustment)
    .slice(0, 6);

  return summary;
}
