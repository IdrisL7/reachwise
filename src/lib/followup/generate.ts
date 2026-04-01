import {
  callClaudeText,
  containsBannedPhrase,
  fetchUserProvidedSource,
  generateHooksForUrl,
  getDomain,
  publishGateValidateHook,
  type Hook,
  type TargetRole,
} from "@/lib/hooks";
import { mapStepToSequenceType, type SequenceConfig } from "./sequences";
import {
  getSequenceMemoryPriors,
  getLeadSegmentKey,
  type OutreachChannel,
  type SequenceMemoryPriors,
  type SequenceType,
} from "./sequence-memory";
import { getClaudeApiKey } from "@/lib/env";
import { getCachedHooks } from "@/lib/hook-cache";
import { db, schema } from "@/lib/db";
import { and, desc, eq, like, or } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LeadInfo = {
  userId?: string | null;
  name?: string | null;
  title?: string | null;
  companyName?: string | null;
  companyWebsite?: string | null;
  source?: string | null;
  email: string;
};

export type PreviousMessage = {
  direction: string;
  sequenceStep: number;
  channel?: string | null;
  subject?: string | null;
  body: string;
  sentAt?: string | null;
  metadata?: {
    hookId?: string | null;
    previousChannel?: string | null;
    angle?: string | null;
    buyerTensionId?: string | null;
    structuralVariant?: string | null;
    hookText?: string | null;
    evidenceSnippet?: string | null;
  } | null;
};

export type FollowUpResult = {
  subject?: string;
  body: string;
  channel: string;
  hookSource?: "provided" | "hook_cache_exact" | "hook_cache_root" | "generated_hooks" | "subpage_live" | "subpage_fallback" | "live_generation";
  orchestration?: SequenceOrchestrationPlan;
  hookUsed?: {
    generatedHookId?: string;
    angle: string;
    hookText: string;
    evidence: string;
    buyerTensionId?: string;
    structuralVariant?: string;
  };
};

type LearnedOutreachPreferences = {
  preferredChannel: OutreachChannel | null;
  preferredTone: "concise" | "warm" | "direct" | null;
  preferredSendWindow: SequenceOrchestrationPlan["sendWindow"] | null;
  sequencePriors?: SequenceMemoryPriors | null;
};

export type SequenceOrchestrationPlan = {
  sequenceType: SequenceType;
  channel: OutreachChannel;
  previousChannel: OutreachChannel | null;
  tone: "concise" | "warm" | "direct";
  wordCountHint: number;
  ctaStyle: "problem_question" | "permission_check" | "soft_breakup" | "connection_reason" | "video_nudge";
  sendWindow: "weekday_morning" | "weekday_afternoon" | "weekday_evening" | "weekend";
  reasoning: string[];
};

type SequenceHookFit = {
  total: number;
  baseScore: number;
  sequenceFit: number;
  channelFit: number;
  freshnessFit: number;
  antiRepeatFit: number;
  confidenceFit: number;
};

export function extractPreviousHookMetadata(
  raw: unknown,
): PreviousMessage["metadata"] {
  if (!raw || typeof raw !== "object") return null;
  const metadata = raw as Record<string, unknown>;
  const nestedHookUsed =
    metadata.hookUsed && typeof metadata.hookUsed === "object"
      ? (metadata.hookUsed as Record<string, unknown>)
      : null;

  const pickString = (...values: unknown[]): string | null => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value;
    }
    return null;
  };

  return {
    hookId: pickString(metadata.hookId, nestedHookUsed?.generatedHookId),
    angle: pickString(metadata.angle, nestedHookUsed?.angle),
    buyerTensionId: pickString(metadata.buyerTensionId, nestedHookUsed?.buyerTensionId),
    structuralVariant: pickString(metadata.structuralVariant, nestedHookUsed?.structuralVariant),
    hookText: pickString(metadata.hookText, nestedHookUsed?.hookText),
    evidenceSnippet: pickString(metadata.evidenceSnippet, nestedHookUsed?.evidence),
  };
}

export function extractPreviousSequenceMetadata(
  raw: unknown,
): {
  sequenceType?: SequenceType | null;
  tone?: "concise" | "warm" | "direct" | null;
  previousChannel?: OutreachChannel | null;
} {
  if (!raw || typeof raw !== "object") return {};
  const metadata = raw as Record<string, unknown>;
  const orchestration =
    metadata.orchestration && typeof metadata.orchestration === "object"
      ? (metadata.orchestration as Record<string, unknown>)
      : null;

  const sequenceType =
    typeof metadata.sequenceType === "string"
      ? metadata.sequenceType
      : typeof orchestration?.sequenceType === "string"
        ? orchestration.sequenceType
        : null;

  const tone =
    typeof metadata.tone === "string"
      ? metadata.tone
      : typeof orchestration?.tone === "string"
        ? orchestration.tone
        : null;

  const previousChannel =
    typeof metadata.previousChannel === "string"
      ? metadata.previousChannel
      : typeof orchestration?.previousChannel === "string"
        ? orchestration.previousChannel
        : null;

  return {
    sequenceType:
      sequenceType === "first" || sequenceType === "bump" || sequenceType === "breakup"
        ? sequenceType
        : null,
    tone:
      tone === "concise" || tone === "warm" || tone === "direct"
        ? tone
        : null,
    previousChannel:
      previousChannel === "email" ||
      previousChannel === "linkedin_connection" ||
      previousChannel === "linkedin_message" ||
      previousChannel === "cold_call" ||
      previousChannel === "video_script"
        ? previousChannel
        : null,
  };
}

export function inferTargetRoleFromLead(lead: LeadInfo): TargetRole | null {
  const title = (lead.title || "").toLowerCase();
  if (!title) return null;

  if (
    title.includes("revops") ||
    title.includes("revenue operations") ||
    title.includes("sales operations")
  ) {
    return "RevOps";
  }

  if (
    title.includes("sdr manager") ||
    title.includes("sales development manager") ||
    title.includes("bdr manager")
  ) {
    return "SDR Manager";
  }

  if (
    title.includes("marketing") ||
    title.includes("demand gen") ||
    title.includes("growth marketing")
  ) {
    return "Marketing";
  }

  if (
    title.includes("founder") ||
    title.includes("co-founder") ||
    title.includes("chief executive") ||
    title.includes("ceo")
  ) {
    return "Founder/CEO";
  }

  if (
    title.includes("vp sales") ||
    title.includes("head of sales") ||
    title.includes("sales director") ||
    title.includes("chief revenue officer") ||
    title.includes("cro")
  ) {
    return "VP Sales";
  }

  return null;
}

function mapStoredHookToHook(row: {
  id: string;
  hookText: string;
  angle: string;
  confidence: string;
  evidenceTier: string;
  sourceSnippet: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceDate: string | null;
  triggerType: string | null;
  promise: string | null;
  bridgeQuality: string | null;
  qualityScore: number;
}): Hook | null {
  if (
    !row.hookText ||
    !row.angle ||
    !row.confidence ||
    !row.evidenceTier
  ) {
    return null;
  }

  // `generated_hooks` rows are persisted only after publish-gating in
  // `/api/generate-hooks`, so re-running the full validator here can
  // incorrectly reject valid historical hooks as validation rules evolve.
  return {
    news_item: 1,
    angle: row.angle as Hook["angle"],
    hook: row.hookText,
    evidence_snippet: row.sourceSnippet || "",
    source_title: row.sourceTitle || "",
    source_date: row.sourceDate || "",
    source_url: row.sourceUrl || "",
    evidence_tier: row.evidenceTier as Hook["evidence_tier"],
    confidence: row.confidence as Hook["confidence"],
    quality_score: row.qualityScore,
    generated_hook_id: row.id,
    trigger_type: (row.triggerType || undefined) as Hook["trigger_type"],
    promise: row.promise || undefined,
    bridge_quality: (row.bridgeQuality || undefined) as Hook["bridge_quality"],
  };
}

function normalizeCachedHooks(raw: unknown, limit: number): Hook[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((hook) => publishGateValidateHook(hook as Hook))
    .filter((hook): hook is Hook => hook !== null)
    .slice(0, limit);
}

async function getReusableHooks(
  lead: LeadInfo,
  targetRole: TargetRole | null,
  limit: number,
): Promise<{
  hooks: Hook[];
  source?: "hook_cache_exact" | "hook_cache_root" | "generated_hooks";
}> {
  const companyUrl = lead.companyWebsite?.trim();
  if (!companyUrl) return { hooks: [] };

  const role = targetRole ?? undefined;

  const exactCached = await getCachedHooks(
    companyUrl,
    undefined,
    role,
    "evidence",
  ).catch(() => null);
  const exactCachedHooks = normalizeCachedHooks(exactCached?.hooks, limit);
  if (exactCachedHooks.length > 0) {
    console.info(
      `[generate-followup] reusable hooks hit source=hook_cache_exact company_url="${companyUrl}" role="${role || "none"}" count=${exactCachedHooks.length}`,
    );
    return { hooks: exactCachedHooks, source: "hook_cache_exact" };
  }

  const domain = getDomain(companyUrl);
  const rootUrl = `https://${domain}`;
  if (rootUrl !== companyUrl) {
    const rootCached = await getCachedHooks(
      rootUrl,
      undefined,
      role,
      "evidence",
    ).catch(() => null);
    const rootCachedHooks = normalizeCachedHooks(rootCached?.hooks, limit);
    if (rootCachedHooks.length > 0) {
      console.info(
        `[generate-followup] reusable hooks hit source=hook_cache_root company_url="${companyUrl}" root_url="${rootUrl}" role="${role || "none"}" count=${rootCachedHooks.length}`,
      );
      return { hooks: rootCachedHooks, source: "hook_cache_root" };
    }
  }

  if (!lead.userId) {
    console.info(
      `[generate-followup] reusable hooks skipped source=generated_hooks reason=missing_user_id company_url="${companyUrl}"`,
    );
    return { hooks: [] };
  }

  const stored = await db
    .select({
      id: schema.generatedHooks.id,
      hookText: schema.generatedHooks.hookText,
      angle: schema.generatedHooks.angle,
      confidence: schema.generatedHooks.confidence,
      evidenceTier: schema.generatedHooks.evidenceTier,
      sourceSnippet: schema.generatedHooks.sourceSnippet,
      sourceUrl: schema.generatedHooks.sourceUrl,
      sourceTitle: schema.generatedHooks.sourceTitle,
      sourceDate: schema.generatedHooks.sourceDate,
      triggerType: schema.generatedHooks.triggerType,
      promise: schema.generatedHooks.promise,
      bridgeQuality: schema.generatedHooks.bridgeQuality,
      qualityScore: schema.generatedHooks.qualityScore,
    })
    .from(schema.generatedHooks)
    .where(
      and(
        eq(schema.generatedHooks.userId, lead.userId),
        or(
          eq(schema.generatedHooks.companyUrl, companyUrl),
          eq(schema.generatedHooks.companyUrl, rootUrl),
          like(schema.generatedHooks.companyUrl, `${rootUrl}/%`),
        ),
      ),
    )
    .orderBy(desc(schema.generatedHooks.createdAt))
    .limit(limit * 4);

  const hooks = stored
    .map(mapStoredHookToHook)
    .filter((hook): hook is Hook => hook !== null)
    .slice(0, limit);

  if (hooks.length > 0) {
    console.info(
      `[generate-followup] reusable hooks hit source=generated_hooks company_url="${companyUrl}" root_url="${rootUrl}" user_id="${lead.userId}" stored_rows=${stored.length} valid_hooks=${hooks.length}`,
    );
    return { hooks, source: "generated_hooks" };
  }

  console.info(
    `[generate-followup] reusable hooks miss company_url="${companyUrl}" root_url="${rootUrl}" user_id="${lead.userId}" stored_rows=${stored.length} valid_hooks=0`,
  );

  return { hooks: [] };
}

async function generateHooksFastForSubpage(
  companyUrl: string,
  targetRole: TargetRole | null,
  limit: number,
): Promise<{
  hooks: Hook[];
  source?: "subpage_live" | "subpage_fallback";
}> {
  const parsedUrl = new URL(
    companyUrl.startsWith("http") ? companyUrl : `https://${companyUrl}`,
  );
  const hasSubpath = parsedUrl.pathname.length > 1 && parsedUrl.pathname !== "/";
  if (!hasSubpath) return { hooks: [] };

  const exaApiKey = process.env.EXA_API_KEY;
  const claudeApiKey = getClaudeApiKey();
  if (!exaApiKey || !claudeApiKey) return { hooks: [] };

  const userSrc = await fetchUserProvidedSource(
    companyUrl,
    getDomain(companyUrl),
    exaApiKey,
  ).catch(() => null);

  if (!userSrc) return { hooks: [] };

  const fastResult = await generateHooksForUrl({
    url: companyUrl,
    count: limit,
    targetRole,
  });

  if (fastResult.hooks.length > 0) {
    return { hooks: fastResult.hooks, source: "subpage_live" };
  }

  return {
    hooks: [
      {
        news_item: 1,
        angle: "trigger",
        hook: `${userSrc.title}. Is that creating pressure on pipeline visibility or forecast confidence right now?`,
        evidence_snippet: userSrc.facts[0] || userSrc.title,
        source_title: userSrc.title,
        source_date: userSrc.date || "",
        source_url: userSrc.url,
        evidence_tier: "A",
        confidence: "med",
      },
    ],
    source: "subpage_fallback",
  };
}

async function getLearnedOutreachPreferences(
  userId?: string | null,
  targetRole?: TargetRole | null,
  leadSegment?: string | null,
): Promise<LearnedOutreachPreferences | null> {
  if (!userId) return null;

  const [userOutreachMemory, userTimingMemory, sequencePriors] = await Promise.all([
    db
      .select()
      .from(schema.userOutreachMemory)
      .where(eq(schema.userOutreachMemory.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(schema.userTimingMemory)
      .where(eq(schema.userTimingMemory.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getSequenceMemoryPriors({ userId, targetRole, leadSegment }),
  ]);

  const preferredChannel = userOutreachMemory
    ? [...([
        ["email", userOutreachMemory.emailCount],
        ["linkedin_connection", userOutreachMemory.linkedinConnectionCount],
        ["linkedin_message", userOutreachMemory.linkedinMessageCount],
        ["cold_call", userOutreachMemory.coldCallCount],
        ["video_script", userOutreachMemory.videoScriptCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const preferredTone = userOutreachMemory
    ? [...([
        ["concise", userOutreachMemory.conciseToneCount],
        ["warm", userOutreachMemory.warmToneCount],
        ["direct", userOutreachMemory.directToneCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  const preferredSendWindow = userTimingMemory
    ? [...([
        ["weekday_morning", userTimingMemory.weekdayMorningCount],
        ["weekday_afternoon", userTimingMemory.weekdayAfternoonCount],
        ["weekday_evening", userTimingMemory.weekdayEveningCount],
        ["weekend", userTimingMemory.weekendCount],
      ] as const)].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
    : null;

  if (!preferredChannel && !preferredTone && !preferredSendWindow && !sequencePriors) {
    return null;
  }

  return {
    preferredChannel: preferredChannel as OutreachChannel | null,
    preferredTone: preferredTone as "concise" | "warm" | "direct" | null,
    preferredSendWindow: preferredSendWindow as SequenceOrchestrationPlan["sendWindow"] | null,
    sequencePriors,
  };
}

// ---------------------------------------------------------------------------
// Email-specific banned phrases (same as generate-email route)
// ---------------------------------------------------------------------------

const EMAIL_BANNED_PHRASES = [
  "curious",
  "worth a quick",
  "just checking in",
  "just following up",
  "touching base",
  "quick chat",
  "quick call",
  "bugging you",
  "bothering you",
  "synergy",
  "win-win",
];

// ---------------------------------------------------------------------------
// Prompt builders (adapted from generate-email/route.ts)
// ---------------------------------------------------------------------------

function buildFollowUpSystemPrompt(
  tone: string,
  sequenceStep: "first" | "bump" | "breakup",
  wordCountHint: number,
  ctaStyle: SequenceOrchestrationPlan["ctaStyle"] = "problem_question",
): string {
  const toneGuide: Record<string, string> = {
    concise:
      "Write as a thoughtful SDR: clear, direct, respectful. Personable but professional. Be short and punchy. No filler. Every sentence earns its place.",
    warm:
      "Write as a thoughtful SDR: clear, direct, respectful. Personable but professional. Be conversational and human. Still direct, but friendly in tone.",
    direct:
      "Write as a thoughtful SDR: clear, direct, respectful. Personable but professional. Be blunt and to the point. No small talk. Lead with the signal.",
  };

  const stepGuide: Record<string, string> = {
    first:
      "This is a first-touch cold email. The recipient has never heard from the sender. Open strong with the signal.",
    bump:
      "This is a follow-up to an unanswered previous email. Reference the original signal briefly, add a new angle or implication, and keep it shorter than the first email.",
    breakup:
      "This is a final follow-up. Be respectful, brief, and give the recipient an easy out. Still anchor on the original signal but frame it as a last note.",
  };

  const ctaGuide: Record<SequenceOrchestrationPlan["ctaStyle"], string> = {
    problem_question:
      "CTA style: end with a concrete diagnostic question about the problem created by the signal.",
    permission_check:
      "CTA style: use a low-friction permission-based question that still references the operational problem.",
    soft_breakup:
      "CTA style: close with a respectful last-note question that gives the reader an easy out.",
    connection_reason:
      "CTA style: explain the reason for reaching out and make the ask feel lightweight, not meeting-hungry.",
    video_nudge:
      "CTA style: close with a soft nudge that makes a quick async review feel easier than a live meeting.",
  };

  return [
    "You are an elite cold email copywriter. You write emails that get replies by being relevant, specific, and respectful of the reader's time.",
    "",
    "## Doctrine (HARD rules)",
    "- Every email is anchored on the hook's evidence: Signal, then Implication, then Question.",
    "- No invented results or guarantees. Only reference what the hook's evidence_snippet supports.",
    "- BANNED phrases (never use): " + EMAIL_BANNED_PHRASES.join(", ") + ".",
    "- Avoid apologetic or needy language such as: 'bugging you', 'bothering you', 'just checking in', 'just following up', 'touching base', or similar.",
    "- First line: clearly tie to the signal and evidence snippet. No generic openers.",
    "- One short paragraph: pull out the implication in the prospect's own language.",
    "- Close with a simple, concrete question about the problem or next step, derived from the hook's question. Do not default to generic 'jump on a quick call' / 'worth a quick chat' style CTAs.",
    "- Do NOT include any name or signature at the end. End the email body after the last sentence of the message.",
    "",
    `## Tone: ${tone}`,
    toneGuide[tone] || toneGuide["direct"],
    "",
    `## Sequence step: ${sequenceStep}`,
    stepGuide[sequenceStep] || stepGuide["first"],
    "",
    `## CTA style: ${ctaStyle}`,
    ctaGuide[ctaStyle],
    "",
    `## Length: aim for roughly ${wordCountHint} words in the body. Shorter is better than longer.`,
    "",
    "## Output format",
    "Return ONLY valid JSON with no markdown fences:",
    '{ "subject": "<subject line>", "body": "<email body>" }',
    "",
    "The body should use \\n for line breaks between paragraphs. Do not include a greeting line like 'Hi [Name]' since the sender will add that.",
  ].join("\n");
}

function buildFollowUpUserPrompt(
  lead: LeadInfo,
  hook: Hook,
  previousMessages: PreviousMessage[],
  sequenceStep: "first" | "bump" | "breakup",
): string {
  const lines: string[] = [];

  if (lead.companyWebsite) {
    lines.push(`## Prospect company URL: ${lead.companyWebsite}`);
  }
  if (lead.companyName) {
    lines.push(`## Prospect company: ${lead.companyName}`);
  }
  if (lead.name) {
    lines.push(`## Prospect name: ${lead.name}`);
  }
  if (lead.title) {
    lines.push(`## Prospect title: ${lead.title}`);
  }

  lines.push("");
  lines.push("## Hook to base the email on:");
  lines.push(`- Angle: ${hook.angle}`);
  lines.push(`- Hook text: ${hook.hook}`);
  lines.push(`- Evidence snippet: ${hook.evidence_snippet}`);
  lines.push(`- Source: ${hook.source_title}`);
  lines.push(`- Confidence: ${hook.confidence}`);

  if (previousMessages.length > 0 && sequenceStep !== "first") {
    lines.push("");
    lines.push("## Previous messages sent (for context — reference but don't repeat):");
    for (const msg of previousMessages) {
      lines.push(`### Step ${msg.sequenceStep} (${msg.direction}, ${msg.sentAt || "unknown date"}):`);
      if (msg.subject) lines.push(`Subject: ${msg.subject}`);
      lines.push(`Body: ${msg.body}`);
      lines.push("");
    }
  }

  lines.push("");
  lines.push("Write the email now. Return JSON only.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Strip trailing signature (same logic as generate-email route)
// ---------------------------------------------------------------------------

function stripTrailingSignature(body: string): string {
  const lines = body.split("\n");

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  if (lines.length === 0) return body;

  const lastLine = lines[lines.length - 1].trim();

  const signoffPatterns = [
    /^(best|cheers|thanks|thank you|regards|kind regards|warm regards)[,!\s]*$/i,
    /^(best|cheers|thanks|thank you|regards|kind regards|warm regards)[,!\s]+[a-zA-Z]+$/i,
  ];

  const looksLikeJustAName = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$/.test(lastLine);

  const isExplicitSignoff = signoffPatterns.some((re) => re.test(lastLine));

  if (isExplicitSignoff || looksLikeJustAName) {
    lines.pop();
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    return lines.join("\n");
  }

  return body;
}

// ---------------------------------------------------------------------------
// Sequence-aware hook selection
// ---------------------------------------------------------------------------

function getHookLengthBucket(hook: Hook): "short" | "medium" | "long" {
  const length = hook.hook.trim().length;
  if (length <= 120) return "short";
  if (length <= 190) return "medium";
  return "long";
}

function getRecentHookMemory(previousMessages: PreviousMessage[]) {
  const usedAngles = new Set<string>();
  const usedTensions = new Set<string>();
  const usedVariants = new Set<string>();
  const usedHooks = new Set<string>();

  for (const message of previousMessages) {
    if (message.direction !== "outbound") continue;
    const metadata = message.metadata ?? null;
    if (metadata?.angle) usedAngles.add(metadata.angle);
    if (metadata?.buyerTensionId) usedTensions.add(metadata.buyerTensionId);
    if (metadata?.structuralVariant) usedVariants.add(metadata.structuralVariant);
    if (metadata?.hookText) usedHooks.add(metadata.hookText.trim().toLowerCase());
  }

  return { usedAngles, usedTensions, usedVariants, usedHooks };
}

export function computeSequenceHookFit(
  hook: Hook,
  opts: {
    previousMessages: PreviousMessage[];
    sequenceType: SequenceType;
    channel: string;
    avoidAngle?: string;
  },
): SequenceHookFit {
  const { previousMessages, sequenceType, channel, avoidAngle } = opts;
  const memory = getRecentHookMemory(previousMessages);
  const baseScore = hook.selector_score ?? hook.ranking_score ?? hook.quality_score ?? 0;
  let sequenceFit = 0;
  let channelFit = 0;
  let freshnessFit = 0;
  let antiRepeatFit = 0;
  let confidenceFit = 0;

  if (sequenceType === "first") {
    sequenceFit += hook.angle === "trigger" ? 2.5 : hook.angle === "risk" ? 1.2 : 0.5;
  } else if (sequenceType === "bump") {
    sequenceFit += hook.angle === "risk" ? 2.2 : hook.angle === "tradeoff" ? 1.8 : 0.3;
  } else {
    sequenceFit += hook.angle === "tradeoff" ? 2.4 : hook.angle === "risk" ? 1.8 : 0.2;
  }

  const lengthBucket = getHookLengthBucket(hook);
  switch (channel) {
    case "linkedin_connection":
      channelFit += lengthBucket === "short" ? 2.6 : lengthBucket === "medium" ? 0.8 : -2.5;
      channelFit += hook.angle === "trigger" ? 1 : hook.angle === "tradeoff" ? 0.3 : -0.8;
      break;
    case "linkedin_message":
      channelFit += lengthBucket === "medium" ? 1.8 : lengthBucket === "short" ? 1 : -0.5;
      channelFit += hook.interestingness_score ? Math.min(hook.interestingness_score / 3, 1.2) : 0;
      break;
    case "cold_call":
      channelFit += lengthBucket === "short" ? 1.8 : lengthBucket === "medium" ? 0.8 : -1.5;
      channelFit += hook.angle === "trigger" ? 1.2 : hook.angle === "risk" ? 1 : -0.2;
      break;
    case "video_script":
      channelFit += lengthBucket === "medium" ? 1.6 : lengthBucket === "short" ? 0.8 : -0.4;
      channelFit += hook.interestingness_score ? Math.min(hook.interestingness_score / 2.5, 1.4) : 0;
      break;
    default:
      channelFit += lengthBucket === "medium" ? 0.8 : 0;
      break;
  }

  if (hook.confidence === "high") confidenceFit += 2;
  else if (hook.confidence === "med") confidenceFit += 0.8;
  else confidenceFit -= 1.5;

  if (avoidAngle && hook.angle === avoidAngle) antiRepeatFit -= 5;
  if (memory.usedAngles.has(hook.angle)) antiRepeatFit -= sequenceType === "first" ? 0.5 : 2.2;
  else freshnessFit += 1.4;

  if (hook.buyer_tension_id) {
    if (memory.usedTensions.has(hook.buyer_tension_id)) antiRepeatFit -= 2.8;
    else freshnessFit += 1.8;
  }

  if (hook.structural_variant) {
    if (memory.usedVariants.has(hook.structural_variant)) antiRepeatFit -= 1.5;
    else freshnessFit += 0.9;
  }

  const normalizedText = hook.hook.trim().toLowerCase();
  if (memory.usedHooks.has(normalizedText)) antiRepeatFit -= 4;

  if (sequenceType !== "first" && hook.non_overlap_score) {
    freshnessFit += Math.min(hook.non_overlap_score / 2, 1.8);
  }

  if (sequenceType === "breakup" && lengthBucket === "long") {
    antiRepeatFit -= 1.2;
  }

  const total =
    baseScore +
    sequenceFit +
    channelFit +
    freshnessFit +
    antiRepeatFit +
    confidenceFit;

  return {
    total,
    baseScore,
    sequenceFit,
    channelFit,
    freshnessFit,
    antiRepeatFit,
    confidenceFit,
  };
}

export function pickBestHook(
  hooks: Hook[],
  previousMessages: PreviousMessage[],
  opts: {
    avoidAngle?: string;
    sequenceType: SequenceType;
    channel: string;
  },
): Hook {
  if (hooks.length === 0) {
    throw new Error("No hooks available for this company");
  }

  return hooks
    .map((hook) => ({
      hook,
      fit: computeSequenceHookFit(hook, {
        previousMessages,
        sequenceType: opts.sequenceType,
        channel: opts.channel,
        avoidAngle: opts.avoidAngle,
      }),
    }))
    .sort((a, b) => b.fit.total - a.fit.total)[0]!.hook;
}

// ---------------------------------------------------------------------------
// Channel-specific system prompts
// ---------------------------------------------------------------------------

function getChannelSystemPrompt(channel: string): string {
  switch (channel) {
    case "linkedin_connection":
      return `You write LinkedIn connection request messages. Keep under 300 characters. Be personal, reference something specific about the person or company. No salesy language. Just a genuine reason to connect.`;
    case "linkedin_message":
      return `You write LinkedIn direct messages. Keep under 1900 characters. Reference evidence about their company. Be conversational, not formal. No "Dear" or "Hi there". Get to the point quickly.`;
    case "cold_call":
      return `You write cold call opener scripts. Keep under 150 words. Structure: introduce yourself (1 sentence), reference trigger/evidence (1 sentence), ask permission-based opener question. Include a talk track for likely objections.`;
    case "video_script":
      return `You write personalized video outreach scripts. Keep under 200 words. Structure: greet by name, reference specific evidence about their company, explain why it matters to them, soft CTA. Conversational tone, meant to be spoken on camera.`;
    default:
      return ""; // email uses existing system prompt
  }
}

// ---------------------------------------------------------------------------
// Build user prompt for non-email channels
// ---------------------------------------------------------------------------

function buildChannelUserPrompt(
  lead: LeadInfo,
  hook: Hook,
  previousMessages: PreviousMessage[],
  sequenceType: SequenceType,
  channel: string,
  ctaStyle: SequenceOrchestrationPlan["ctaStyle"],
): string {
  const lines: string[] = [];

  if (lead.companyWebsite) lines.push(`Company URL: ${lead.companyWebsite}`);
  if (lead.companyName) lines.push(`Company: ${lead.companyName}`);
  if (lead.name) lines.push(`Prospect name: ${lead.name}`);
  if (lead.title) lines.push(`Prospect title: ${lead.title}`);

  lines.push("");
  lines.push("## Hook / evidence to reference:");
  lines.push(`- Angle: ${hook.angle}`);
  lines.push(`- Hook text: ${hook.hook}`);
  lines.push(`- Evidence snippet: ${hook.evidence_snippet}`);
  lines.push(`- Source: ${hook.source_title}`);

  lines.push("");
  lines.push(`Sequence step type: ${sequenceType}`);
  lines.push(`Channel: ${channel}`);
  lines.push(`CTA style: ${ctaStyle}`);

  if (previousMessages.length > 0) {
    lines.push("Use this as a fresh next touch, not a repeat of earlier messages.");
    lines.push("Previous outbound messages:");
    for (const msg of previousMessages.slice(0, 3)) {
      lines.push(`- Step ${msg.sequenceStep} (${msg.channel || "email"}): ${msg.body}`);
    }
  }

  lines.push("");
  lines.push("Write the message now. Return only the message text, no JSON wrapping.");
  return lines.join("\n");
}

function getRecentOutboundMessages(previousMessages: PreviousMessage[]): PreviousMessage[] {
  return previousMessages.filter((message) => message.direction === "outbound");
}

function getCurrentSendWindow(now = new Date()): SequenceOrchestrationPlan["sendWindow"] {
  const day = now.getDay();
  if (day === 0 || day === 6) return "weekend";
  const hour = now.getHours();
  if (hour < 12) return "weekday_morning";
  if (hour < 17) return "weekday_afternoon";
  return "weekday_evening";
}

function scoreSequenceChannelPlan(
  channel: OutreachChannel,
  sequenceType: SequenceType,
  previousMessages: PreviousMessage[],
  sendWindow: SequenceOrchestrationPlan["sendWindow"],
  learnedPreferences?: LearnedOutreachPreferences | null,
): { score: number; reasons: string[] } {
  const outbound = getRecentOutboundMessages(previousMessages);
  const priorChannels = outbound.map((message) => message.channel || "email");
  const sameChannelCount = priorChannels.filter((value) => value === channel).length;
  let score = 0;
  const reasons: string[] = [];

  const sequencePreferences: Record<SequenceType, Record<OutreachChannel, number>> = {
    first: {
      email: 3.2,
      linkedin_connection: 2.6,
      linkedin_message: 1.4,
      cold_call: 0.8,
      video_script: 1.5,
    },
    bump: {
      email: 1.8,
      linkedin_connection: 0.2,
      linkedin_message: 3,
      cold_call: 1.9,
      video_script: 2.2,
    },
    breakup: {
      email: 2.8,
      linkedin_connection: -1,
      linkedin_message: 1.7,
      cold_call: 2.1,
      video_script: 1.8,
    },
  };

  score += sequencePreferences[sequenceType][channel];
  reasons.push(`${sequenceType} step prefers ${channel}`);

  if (sameChannelCount === 0) {
    score += 1.3;
    reasons.push("fresh channel for this thread");
  } else if (sameChannelCount >= 2) {
    score -= 1.6;
    reasons.push("channel fatigue from repeated prior touches");
  }

  const mostRecentChannel = priorChannels[0];
  if (mostRecentChannel && mostRecentChannel !== channel) {
    score += 0.8;
    reasons.push("varies from most recent channel");
  }

  if (sequenceType === "first" && outbound.length === 0 && channel === "email") {
    score += 0.9;
    reasons.push("email remains the clearest first-touch format");
  }

  if (sequenceType === "bump" && outbound.length > 0 && channel === "linkedin_message") {
    score += 0.9;
    reasons.push("LinkedIn message works as a lighter second touch");
  }

  if (sequenceType === "breakup" && channel === "email") {
    score += 0.7;
    reasons.push("email supports a clean final note");
  }

  if (sendWindow === "weekday_morning") {
    if (channel === "email") {
      score += 0.8;
      reasons.push("morning favors email review");
    }
    if (channel === "cold_call") {
      score += 0.5;
      reasons.push("morning is workable for call outreach");
    }
  } else if (sendWindow === "weekday_afternoon") {
    if (channel === "linkedin_message") {
      score += 0.55;
      reasons.push("afternoon suits lighter async channels");
    }
    if (channel === "video_script") {
      score += 0.35;
      reasons.push("afternoon supports async video follow-up");
    }
  } else if (sendWindow === "weekday_evening" || sendWindow === "weekend") {
    if (channel === "cold_call") {
      score -= 1.6;
      reasons.push("avoid call-led outreach outside business hours");
    }
    if (channel === "linkedin_connection") {
      score -= 0.4;
      reasons.push("connection requests are weaker off-hours");
    }
    if (channel === "email") {
      score += 0.35;
      reasons.push("email remains safest outside core hours");
    }
    if (channel === "video_script") {
      score += 0.25;
      reasons.push("async video can still travel well off-hours");
    }
  }

  if (learnedPreferences?.preferredChannel === channel) {
    score += 2.1;
    reasons.unshift("matches learned channel preference");
  }

  if (
    learnedPreferences?.preferredSendWindow &&
    learnedPreferences.preferredSendWindow !== sendWindow
  ) {
    if (channel === "cold_call") {
      score -= 0.8;
      reasons.unshift("call is riskier outside the learned send window");
    } else if (channel === "linkedin_connection") {
      score -= 0.35;
      reasons.unshift("connection requests are less reliable outside the learned send window");
    } else if (channel === "video_script") {
      score += 0.7;
      reasons.unshift("video is a safer async touch outside the learned send window");
    } else if (channel === "linkedin_message") {
      score += 0.3;
      reasons.unshift("async message fits better outside the learned send window");
    } else {
      score += 0.15;
      reasons.unshift("email remains safe outside the learned send window");
    }
  }

  const sequenceAdjustment = learnedPreferences?.sequencePriors?.adjustments[sequenceType]?.[channel] ?? 0;
  if (sequenceAdjustment > 0.2) {
    score += sequenceAdjustment;
    reasons.unshift("matches a historically successful sequence pattern");
  } else if (sequenceAdjustment < -0.2) {
    score += sequenceAdjustment;
    reasons.unshift("historically weaker for this step and role");
  }

  const pathAdjustment =
    learnedPreferences?.sequencePriors?.pathAdjustments?.[sequenceType]?.[mostRecentChannel ?? "__none__"]?.[channel] ?? 0;
  if (pathAdjustment > 0.2) {
    score += pathAdjustment;
    reasons.unshift("transition has worked well after the prior channel");
  } else if (pathAdjustment < -0.2) {
    score += pathAdjustment;
    reasons.unshift("transition has underperformed after the prior channel");
  }

  return { score, reasons };
}

export function buildSequenceOrchestrationPlan(opts: {
  currentStep: number;
  maxSteps: number;
  previousMessages: PreviousMessage[];
  preferredChannel?: string;
  preferredTone?: "concise" | "warm" | "direct";
  preferredWordCountHint?: number;
  learnedPreferredChannel?: OutreachChannel | null;
  learnedPreferredTone?: "concise" | "warm" | "direct" | null;
  learnedPreferredSendWindow?: SequenceOrchestrationPlan["sendWindow"] | null;
  learnedSequencePriors?: SequenceMemoryPriors | null;
  now?: Date;
}): SequenceOrchestrationPlan {
  const sequenceType = mapStepToSequenceType(opts.currentStep, opts.maxSteps);
  const sendWindow = getCurrentSendWindow(opts.now);
  const explicitChannel = opts.preferredChannel as OutreachChannel | undefined;
  const previousChannel = (getRecentOutboundMessages(opts.previousMessages)[0]?.channel as OutreachChannel | null) ?? null;
  const learnedPreferences: LearnedOutreachPreferences | null =
    opts.learnedPreferredChannel || opts.learnedPreferredTone || opts.learnedPreferredSendWindow || opts.learnedSequencePriors
      ? {
          preferredChannel: opts.learnedPreferredChannel ?? null,
          preferredTone: opts.learnedPreferredTone ?? null,
          preferredSendWindow: opts.learnedPreferredSendWindow ?? null,
          sequencePriors: opts.learnedSequencePriors ?? null,
        }
      : null;
  const candidateChannels: OutreachChannel[] = explicitChannel
    ? [explicitChannel]
    : sequenceType === "first"
      ? ["email", "linkedin_connection", "video_script"]
      : sequenceType === "bump"
        ? ["linkedin_message", "email", "video_script", "cold_call"]
        : ["email", "cold_call", "linkedin_message", "video_script"];

  const ranked = candidateChannels
    .map((channel) => ({
      channel,
      ...scoreSequenceChannelPlan(channel, sequenceType, opts.previousMessages, sendWindow, learnedPreferences),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = ranked[0]!;
  const tone = opts.preferredTone
    ?? opts.learnedPreferredTone
    ?? (selected.channel === "email"
      ? (sequenceType === "breakup" ? "concise" : "direct")
      : selected.channel === "linkedin_message"
        ? "warm"
        : "direct");

  const wordCountHint = opts.preferredWordCountHint
    ?? (selected.channel === "email"
      ? (sequenceType === "first" ? 80 : sequenceType === "bump" ? 60 : 45)
      : selected.channel === "linkedin_connection"
        ? 35
        : selected.channel === "cold_call"
          ? 55
          : 70);

  const adjustedWordCountHint =
    sendWindow === "weekday_evening" || sendWindow === "weekend"
      ? Math.max(30, wordCountHint - 10)
      : wordCountHint;

  const ctaStyle: SequenceOrchestrationPlan["ctaStyle"] =
    selected.channel === "linkedin_connection"
      ? "connection_reason"
      : selected.channel === "cold_call"
        ? "permission_check"
        : selected.channel === "video_script"
          ? "video_nudge"
          : sequenceType === "breakup"
            ? "soft_breakup"
            : "problem_question";

  return {
    sequenceType,
    channel: selected.channel,
    previousChannel,
    tone,
    wordCountHint: adjustedWordCountHint,
    ctaStyle,
    sendWindow,
    reasoning: selected.reasons.slice(0, 3),
  };
}

// ---------------------------------------------------------------------------
// Main: generate a follow-up email
// ---------------------------------------------------------------------------

export async function generateFollowUp(opts: {
  lead: LeadInfo;
  previousMessages: PreviousMessage[];
  sequence: SequenceConfig;
  currentStep: number;
  hooks?: Hook[];
  tone?: string;
  wordCountHint?: number;
  senderProfile?: { name: string; role?: string; company?: string };
  avoidAngle?: string;
  channel?: string;
}): Promise<FollowUpResult> {
  const startedAt = Date.now();
  const claudeApiKey = getClaudeApiKey();
  if (!claudeApiKey) {
    throw new Error("Server misconfiguration: missing CLAUDE_API_KEY");
  }

  // Get hooks — use provided or auto-generate
  let hooks = opts.hooks;
  let hookSource: FollowUpResult["hookSource"] = hooks?.length ? "provided" : undefined;
  if (!hooks || hooks.length === 0) {
    const companyUrl = opts.lead.companyWebsite || opts.lead.companyName;
    if (!companyUrl) {
      throw new Error("Lead must have company_website or company_name to generate hooks");
    }
    const targetRole = inferTargetRoleFromLead(opts.lead);

    const reusable = await getReusableHooks(opts.lead, targetRole, 6);
    hooks = reusable.hooks;
    hookSource = reusable.source;

    if (hooks.length === 0) {
      const subpageHooks = await generateHooksFastForSubpage(companyUrl, targetRole, 6);
      hooks = subpageHooks.hooks;
      hookSource = subpageHooks.source;
    }

    if (hooks.length === 0) {
      const result = await generateHooksForUrl({
        url: companyUrl,
        count: 6,
        targetRole,
      });
      hooks = result.hooks;
      hookSource = "live_generation";
    }
  }

  if (hooks.length === 0) {
    throw new Error("Could not generate any hooks for this lead's company");
  }

  const targetRole = inferTargetRoleFromLead(opts.lead);
  const leadSegment = getLeadSegmentKey({
    title: opts.lead.title,
    source: opts.lead.source,
    companyWebsite: opts.lead.companyWebsite,
  });
  const learnedPreferences = await getLearnedOutreachPreferences(opts.lead.userId, targetRole, leadSegment);

  const orchestration = buildSequenceOrchestrationPlan({
    currentStep: opts.currentStep,
    maxSteps: opts.sequence.maxSteps,
    previousMessages: opts.previousMessages,
    preferredChannel: opts.channel,
    preferredTone: opts.tone as SequenceOrchestrationPlan["tone"] | undefined,
    preferredWordCountHint: opts.wordCountHint,
    learnedPreferredChannel: learnedPreferences?.preferredChannel,
    learnedPreferredTone: learnedPreferences?.preferredTone,
    learnedPreferredSendWindow: learnedPreferences?.preferredSendWindow,
    learnedSequencePriors: learnedPreferences?.sequencePriors,
  });
  const channel = orchestration.channel;
  const sequenceType = orchestration.sequenceType;
  const hook = pickBestHook(hooks, opts.previousMessages, {
    avoidAngle: opts.avoidAngle,
    sequenceType,
    channel,
  });

  // --- Non-email channels: simpler Claude call, no subject line ---
  if (channel !== "email") {
    const channelPrompt = getChannelSystemPrompt(channel);
    if (!channelPrompt) {
      throw new Error(`Unsupported channel: ${channel}`);
    }

    const userPrompt = buildChannelUserPrompt(
      opts.lead,
      hook,
      opts.previousMessages,
      sequenceType,
      channel,
      orchestration.ctaStyle,
    );
    const raw = await callClaudeText(channelPrompt, userPrompt, claudeApiKey, 800);

    // Strip any accidental markdown fences
    const body = raw
      .replace(/^```(?:\w+)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    if (!body) {
      throw new Error("LLM returned empty content for channel message");
    }

    console.info(
      `[generate-followup] channel=${channel} company="${opts.lead.companyName || opts.lead.companyWebsite || opts.lead.email}" hook_source=${hookSource || "unknown"} hook_angle=${hook.angle} duration_ms=${Date.now() - startedAt}`,
    );

    return {
      body,
      channel,
      orchestration,
      hookSource,
      hookUsed: {
        generatedHookId: hook.generated_hook_id,
        angle: hook.angle,
        hookText: hook.hook,
        evidence: hook.evidence_snippet,
        buyerTensionId: hook.buyer_tension_id,
        structuralVariant: hook.structural_variant,
      },
    };
  }

  // --- Email channel: full generation with subject line ---
  const tone = orchestration.tone;
  const wordCountHint = orchestration.wordCountHint;

  const systemPrompt = buildFollowUpSystemPrompt(
    tone,
    sequenceType,
    wordCountHint,
    orchestration.ctaStyle,
  );
  const userPrompt = buildFollowUpUserPrompt(
    opts.lead,
    hook,
    opts.previousMessages,
    sequenceType,
  );

  const raw = await callClaudeText(systemPrompt, userPrompt, claudeApiKey, 1200);

  // Parse JSON response
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  const parsed = JSON.parse(cleaned) as { subject: string; body: string };

  if (!parsed.subject || !parsed.body) {
    throw new Error("LLM returned an invalid email structure");
  }

  // Quality check — warn but don't block
  const banned = containsBannedPhrase(parsed.body);
  if (banned) {
    console.warn(`generate-followup: banned phrase detected in body: "${banned}"`);
  }

  parsed.body = stripTrailingSignature(parsed.body);

  console.info(
    `[generate-followup] channel=${channel} company="${opts.lead.companyName || opts.lead.companyWebsite || opts.lead.email}" hook_source=${hookSource || "unknown"} hook_angle=${hook.angle} duration_ms=${Date.now() - startedAt}`,
  );

  return {
    subject: parsed.subject,
    body: parsed.body,
    channel,
    orchestration,
    hookSource,
    hookUsed: {
      generatedHookId: hook.generated_hook_id,
      angle: hook.angle,
      hookText: hook.hook,
      evidence: hook.evidence_snippet,
      buyerTensionId: hook.buyer_tension_id,
      structuralVariant: hook.structural_variant,
    },
  };
}
