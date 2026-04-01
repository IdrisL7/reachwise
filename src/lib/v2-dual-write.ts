import { createClient, type Client } from "@libsql/client";
import { getDomain } from "@/lib/hooks";

type SignalV2Input = {
  sourceUrl: string | null;
  sourceType: "first_party" | "trusted_news" | "semantic_web" | "fallback_web";
  triggerType?: string | null;
  title?: string | null;
  snippet?: string | null;
  publishedAt?: string | null;
  confidence?: number | null;
  freshness?: "fresh" | "recent" | "stale" | "undated";
  evidenceTier?: "A" | "B" | "C" | null;
  metadata?: Record<string, unknown> | null;
};

type HookMessageV2Input = {
  generatedHookId: string | null;
  body: string;
  channel?: string | null;
  tone?: string | null;
  rationale?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  sourceSnippet?: string | null;
  sourceDate?: string | null;
  triggerType?: string | null;
  targetRole?: string | null;
  angle?: string | null;
};

let client: Client | null = null;

function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("TURSO_DATABASE_URL is not set");
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

function normalizeCompanyName(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") || null;
}

function normalizeWebsite(value: string | null | undefined, domain: string | null) {
  const input = value?.trim();
  if (input) {
    if (/^https?:\/\//i.test(input)) return input;
    return `https://${input}`;
  }
  return domain ? `https://${domain}` : null;
}

function getFreshnessFromDate(sourceDate: string | null | undefined): "fresh" | "recent" | "stale" | "undated" {
  if (!sourceDate) return "undated";
  const parsed = Date.parse(sourceDate);
  if (Number.isNaN(parsed)) return "undated";
  const daysOld = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
  if (daysOld <= 14) return "fresh";
  if (daysOld <= 60) return "recent";
  return "stale";
}

export function inferSourceTypeForV2(params: {
  companyUrl: string;
  sourceUrl: string | null;
  evidenceTier?: "A" | "B" | "C" | null;
}): "first_party" | "trusted_news" | "semantic_web" | "fallback_web" {
  if (!params.sourceUrl) return "fallback_web";
  const companyDomain = getDomain(params.companyUrl);
  const sourceDomain = getDomain(params.sourceUrl);
  if (sourceDomain && companyDomain && (sourceDomain === companyDomain || sourceDomain.endsWith(`.${companyDomain}`))) {
    return "first_party";
  }
  if (/reuters\.com$|bloomberg\.com$|techcrunch\.com$|businesswire\.com$|globenewswire\.com$/i.test(sourceDomain)) {
    return "trusted_news";
  }
  return params.evidenceTier === "C" ? "fallback_web" : "semantic_web";
}

export async function ensureAccountV2(params: {
  userId: string;
  companyUrl?: string | null;
  companyName?: string | null;
}) {
  const db = getClient();
  const domain = params.companyUrl ? (getDomain(params.companyUrl) || null) : null;
  const companyName = normalizeCompanyName(params.companyName) || domain || "Unknown";
  const website = normalizeWebsite(params.companyUrl ?? null, domain);

  const existing = await db.execute({
    sql: `
      SELECT id
      FROM accounts_v2
      WHERE user_id = ?
        AND (
          (domain IS NOT NULL AND domain = ?)
          OR (domain IS NULL AND lower(company_name) = lower(?))
        )
      LIMIT 1
    `,
    args: [params.userId, domain, companyName],
  });

  const existingId = existing.rows[0]?.id;
  if (typeof existingId === "string" && existingId) {
    await db.execute({
      sql: `
        UPDATE accounts_v2
        SET
          company_name = COALESCE(company_name, ?),
          domain = COALESCE(domain, ?),
          website = COALESCE(website, ?),
          updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [companyName, domain, website, existingId],
    });
    return existingId;
  }

  const accountId = crypto.randomUUID();
  await db.execute({
    sql: `
      INSERT INTO accounts_v2 (
        id, user_id, company_name, domain, website, status, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', 'normal', datetime('now'), datetime('now'))
    `,
    args: [accountId, params.userId, companyName, domain, website],
  });
  return accountId;
}

export async function persistSignalsV2(params: {
  accountId: string;
  signals: SignalV2Input[];
}) {
  const db = getClient();
  const seen = new Set<string>();
  let wroteSignal = false;

  for (const signal of params.signals) {
    if (!signal.sourceUrl) continue;
    const dedupeKey = [
      signal.sourceUrl,
      signal.title ?? "",
      signal.snippet ?? "",
      signal.publishedAt ?? "",
      signal.triggerType ?? "",
    ].join("|");
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    await db.execute({
      sql: `
        INSERT INTO signals_v2 (
          id, account_id, source_url, source_type, trigger_type, title, snippet,
          published_at, confidence, freshness, evidence_tier, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `,
      args: [
        crypto.randomUUID(),
        params.accountId,
        signal.sourceUrl,
        signal.sourceType,
        signal.triggerType ?? null,
        signal.title ?? null,
        signal.snippet ?? null,
        signal.publishedAt ?? null,
        signal.confidence ?? 0.7,
        signal.freshness ?? getFreshnessFromDate(signal.publishedAt),
        signal.evidenceTier ?? "B",
        signal.metadata ? JSON.stringify(signal.metadata) : null,
      ],
    });
    wroteSignal = true;
  }

  if (wroteSignal) {
    await db.execute({
      sql: `
        UPDATE accounts_v2
        SET last_signal_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [params.accountId],
    });
  }
}

export async function persistHookMessagesV2(params: {
  accountId: string;
  hooks: HookMessageV2Input[];
}) {
  const db = getClient();

  for (const hook of params.hooks) {
    await db.execute({
      sql: `
        INSERT INTO messages_v2 (
          id, account_id, signal_id, lead_id, parent_message_id, kind, stage, channel,
          subject, body, tone, rationale, metadata, created_at, updated_at
        ) VALUES (?, ?, NULL, NULL, NULL, 'hook', 'generated', ?, NULL, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `,
      args: [
        crypto.randomUUID(),
        params.accountId,
        hook.channel ?? "email",
        hook.body,
        hook.tone ?? null,
        hook.rationale ?? null,
        JSON.stringify({
          generatedHookId: hook.generatedHookId,
          sourceUrl: hook.sourceUrl ?? null,
          sourceTitle: hook.sourceTitle ?? null,
          sourceSnippet: hook.sourceSnippet ?? null,
          sourceDate: hook.sourceDate ?? null,
          triggerType: hook.triggerType ?? null,
          targetRole: hook.targetRole ?? null,
          angle: hook.angle ?? null,
        }),
      ],
    });
  }

  if (params.hooks.length > 0) {
    await db.execute({
      sql: `
        UPDATE accounts_v2
        SET last_message_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [params.accountId],
    });
  }
}

function mapHookEventToOutcomeType(event: string) {
  if (event === "viewed") return "viewed";
  if (event === "copied" || event === "copied_with_evidence") return "copied";
  if (event === "email_copied" || event === "used_in_email") return "sent";
  if (event === "reply_win") return "reply_win";
  if (event === "positive_reply") return "reply_positive";
  return null;
}

export async function recordHookOutcomeV2(params: {
  userId: string;
  hookId: string;
  companyUrl?: string | null;
  companyName?: string | null;
  event: string;
  metadata?: Record<string, unknown>;
}) {
  const eventType = mapHookEventToOutcomeType(params.event);
  if (!eventType) return;

  const db = getClient();
  const accountId = await ensureAccountV2({
    userId: params.userId,
    companyUrl: params.companyUrl ?? null,
    companyName: params.companyName ?? null,
  });

  const messageLookup = await db.execute({
    sql: `
      SELECT id
      FROM messages_v2
      WHERE account_id = ?
        AND kind = 'hook'
        AND json_extract(metadata, '$.generatedHookId') = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    args: [accountId, params.hookId],
  });

  const messageId = typeof messageLookup.rows[0]?.id === "string" ? messageLookup.rows[0].id : null;

  await db.execute({
    sql: `
      INSERT INTO outcomes_v2 (
        id, account_id, message_id, signal_id, event_type, metadata, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?, datetime('now'))
    `,
    args: [
      crypto.randomUUID(),
      accountId,
      messageId,
      eventType,
      JSON.stringify({
        hookId: params.hookId,
        hookEvent: params.event,
        ...(params.metadata ?? {}),
      }),
    ],
  });
}

export async function persistFollowupMessageV2(params: {
  userId: string;
  companyUrl?: string | null;
  companyName?: string | null;
  outboundMessageId: string;
  leadId: string;
  subject?: string | null;
  body: string;
  channel: string;
  stage: "generated" | "queued" | "sent";
  metadata?: Record<string, unknown> | null;
}) {
  const accountId = await ensureAccountV2({
    userId: params.userId,
    companyUrl: params.companyUrl ?? null,
    companyName: params.companyName ?? null,
  });

  const db = getClient();
  const existing = await db.execute({
    sql: `
      SELECT id
      FROM messages_v2
      WHERE account_id = ?
        AND kind = 'followup'
        AND json_extract(metadata, '$.outboundMessageId') = ?
      LIMIT 1
    `,
    args: [accountId, params.outboundMessageId],
  });

  const existingId = typeof existing.rows[0]?.id === "string" ? existing.rows[0].id : null;
  const metadata = JSON.stringify({
    ...(params.metadata ?? {}),
    outboundMessageId: params.outboundMessageId,
    leadId: params.leadId,
  });

  if (existingId) {
    await db.execute({
      sql: `
        UPDATE messages_v2
        SET
          stage = ?,
          channel = ?,
          subject = ?,
          body = ?,
          metadata = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `,
      args: [params.stage, params.channel, params.subject ?? null, params.body, metadata, existingId],
    });
  } else {
    await db.execute({
      sql: `
        INSERT INTO messages_v2 (
          id, account_id, signal_id, lead_id, parent_message_id, kind, stage, channel,
          subject, body, tone, rationale, metadata, created_at, updated_at
        ) VALUES (?, ?, NULL, ?, NULL, 'followup', ?, ?, ?, ?, NULL, NULL, ?, datetime('now'), datetime('now'))
      `,
      args: [
        crypto.randomUUID(),
        accountId,
        params.leadId,
        params.stage,
        params.channel,
        params.subject ?? null,
        params.body,
        metadata,
      ],
    });
  }

  await db.execute({
    sql: `
      UPDATE accounts_v2
      SET last_message_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [accountId],
  });
}
