import { createClient, type Client } from "@libsql/client";

type AccountV2Overview = {
  id: string;
  companyName: string;
  domain: string | null;
  website: string | null;
  status: string;
  priority: string;
  lastSignalAt: string | null;
  lastMessageAt: string | null;
  signalCount: number;
  contactCount: number;
};

export type AccountV2Detail = AccountV2Overview;

type SignalV2Row = {
  id: string;
  accountId: string;
  sourceUrl: string;
  sourceType: string;
  triggerType: string | null;
  title: string | null;
  snippet: string | null;
  publishedAt: string | null;
  freshness: string;
  evidenceTier: string;
  createdAt: string;
};

type ContactV2Row = {
  accountId: string;
  leadId: string;
  name: string | null;
  email: string;
  title: string | null;
  relationship: string;
};

type MessageV2Row = {
  id: string;
  accountId: string;
  kind: string;
  stage: string;
  channel: string;
  body: string;
  rationale: string | null;
  createdAt: string;
};

type OutcomeV2Row = {
  id: string;
  accountId: string;
  messageId: string | null;
  eventType: string;
  createdAt: string;
};

type AccountWorkflowStatusRow = {
  accountId: string;
  linkedLeads: number;
  activeSequences: number;
  draftMessages: number;
  queuedMessages: number;
};

type V2BackfillStatus = {
  accountCount: number;
  signalCount: number;
  messageCount: number;
  outcomeCount: number;
  backfilledMessageCount: number;
  backfilledOutcomeCount: number;
};

type AccountNoteV2Row = {
  id: string;
  accountId: string;
  userId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type LatestAccountNoteV2Row = {
  accountId: string;
  body: string;
  createdAt: string;
};

type AccountHealthRow = {
  accountId: string;
  lastTouchAt: string | null;
  lastOutcomeType: string | null;
  lastOutcomeAt: string | null;
  lastPositiveOutcomeType: string | null;
  lastPositiveOutcomeAt: string | null;
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

export async function isV2BackboneReady() {
  const db = getClient();
  const result = await db.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name IN ('accounts_v2', 'signals_v2', 'messages_v2', 'account_contacts_v2')
  `);
  return result.rows.length >= 4;
}

export async function isAccountNotesV2Ready() {
  const db = getClient();
  const result = await db.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name = 'account_notes_v2'
  `);
  return result.rows.length === 1;
}

export async function getAccountsV2Overview(limit = 25, userId?: string | null) {
  const db = getClient();
  const result = await db.execute({
    sql: `
      SELECT
        a.id,
        a.company_name,
        a.domain,
        a.website,
        a.status,
        a.priority,
        a.last_signal_at,
        a.last_message_at,
        COUNT(DISTINCT s.id) AS signal_count,
        COUNT(DISTINCT ac.lead_id) AS contact_count
      FROM accounts_v2 a
      LEFT JOIN signals_v2 s ON s.account_id = a.id
      LEFT JOIN account_contacts_v2 ac ON ac.account_id = a.id
      WHERE (? IS NULL OR a.user_id = ?)
      GROUP BY
        a.id, a.company_name, a.domain, a.website, a.status, a.priority,
        a.last_signal_at, a.last_message_at
      ORDER BY COALESCE(a.last_signal_at, a.updated_at) DESC
      LIMIT ?
    `,
    args: [userId ?? null, userId ?? null, limit],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    companyName: String(row.company_name),
    domain: row.domain ? String(row.domain) : null,
    website: row.website ? String(row.website) : null,
    status: String(row.status),
    priority: String(row.priority),
    lastSignalAt: row.last_signal_at ? String(row.last_signal_at) : null,
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    signalCount: Number(row.signal_count ?? 0),
    contactCount: Number(row.contact_count ?? 0),
  })) satisfies AccountV2Overview[];
}

export async function getAccountV2Detail(accountId: string, userId?: string | null) {
  const db = getClient();
  const result = await db.execute({
    sql: `
      SELECT
        a.id,
        a.company_name,
        a.domain,
        a.website,
        a.status,
        a.priority,
        a.last_signal_at,
        a.last_message_at,
        COUNT(DISTINCT s.id) AS signal_count,
        COUNT(DISTINCT ac.lead_id) AS contact_count
      FROM accounts_v2 a
      LEFT JOIN signals_v2 s ON s.account_id = a.id
      LEFT JOIN account_contacts_v2 ac ON ac.account_id = a.id
      WHERE a.id = ?
        AND (? IS NULL OR a.user_id = ?)
      GROUP BY
        a.id, a.company_name, a.domain, a.website, a.status, a.priority,
        a.last_signal_at, a.last_message_at
      LIMIT 1
    `,
    args: [accountId, userId ?? null, userId ?? null],
  });

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    companyName: String(row.company_name),
    domain: row.domain ? String(row.domain) : null,
    website: row.website ? String(row.website) : null,
    status: String(row.status),
    priority: String(row.priority),
    lastSignalAt: row.last_signal_at ? String(row.last_signal_at) : null,
    lastMessageAt: row.last_message_at ? String(row.last_message_at) : null,
    signalCount: Number(row.signal_count ?? 0),
    contactCount: Number(row.contact_count ?? 0),
  } satisfies AccountV2Detail;
}

export async function getSignalsV2ForAccounts(accountIds: string[], limitPerAccount = 3) {
  if (accountIds.length === 0) return [] as SignalV2Row[];
  const db = getClient();
  const placeholders = accountIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      SELECT id, account_id, source_url, source_type, trigger_type, title, snippet,
             published_at, freshness, evidence_tier, created_at
      FROM (
        SELECT
          s.*,
          ROW_NUMBER() OVER (
            PARTITION BY s.account_id
            ORDER BY COALESCE(s.published_at, s.created_at) DESC
          ) AS row_num
        FROM signals_v2 s
        WHERE s.account_id IN (${placeholders})
      )
      WHERE row_num <= ?
      ORDER BY COALESCE(published_at, created_at) DESC
    `,
    args: [...accountIds, limitPerAccount],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    accountId: String(row.account_id),
    sourceUrl: String(row.source_url),
    sourceType: String(row.source_type),
    triggerType: row.trigger_type ? String(row.trigger_type) : null,
    title: row.title ? String(row.title) : null,
    snippet: row.snippet ? String(row.snippet) : null,
    publishedAt: row.published_at ? String(row.published_at) : null,
    freshness: String(row.freshness),
    evidenceTier: String(row.evidence_tier),
    createdAt: String(row.created_at),
  })) satisfies SignalV2Row[];
}

export async function getContactsV2ForAccounts(accountIds: string[]) {
  if (accountIds.length === 0) return [] as ContactV2Row[];
  const db = getClient();
  const placeholders = accountIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      SELECT
        ac.account_id,
        ac.lead_id,
        ac.relationship,
        l.name,
        l.email,
        l.title
      FROM account_contacts_v2 ac
      INNER JOIN leads l ON l.id = ac.lead_id
      WHERE ac.account_id IN (${placeholders})
      ORDER BY ac.created_at DESC
    `,
    args: accountIds,
  });

  return result.rows.map((row) => ({
    accountId: String(row.account_id),
    leadId: String(row.lead_id),
    name: row.name ? String(row.name) : null,
    email: String(row.email),
    title: row.title ? String(row.title) : null,
    relationship: String(row.relationship),
  })) satisfies ContactV2Row[];
}

export async function getMessagesV2ForAccounts(accountIds: string[], limitPerAccount = 4) {
  if (accountIds.length === 0) return [] as MessageV2Row[];
  const db = getClient();
  const placeholders = accountIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      SELECT id, account_id, kind, stage, channel, body, rationale, created_at
      FROM (
        SELECT
          m.*,
          ROW_NUMBER() OVER (
            PARTITION BY m.account_id
            ORDER BY m.created_at DESC
          ) AS row_num
        FROM messages_v2 m
        WHERE m.account_id IN (${placeholders})
      )
      WHERE row_num <= ?
      ORDER BY created_at DESC
    `,
    args: [...accountIds, limitPerAccount],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    accountId: String(row.account_id),
    kind: String(row.kind),
    stage: String(row.stage),
    channel: String(row.channel),
    body: String(row.body),
    rationale: row.rationale ? String(row.rationale) : null,
    createdAt: String(row.created_at),
  })) satisfies MessageV2Row[];
}

export async function getOutcomesV2ForAccounts(accountIds: string[], limitPerAccount = 6) {
  if (accountIds.length === 0) return [] as OutcomeV2Row[];
  const db = getClient();
  const placeholders = accountIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      SELECT id, account_id, message_id, event_type, created_at
      FROM (
        SELECT
          o.*,
          ROW_NUMBER() OVER (
            PARTITION BY o.account_id
            ORDER BY o.created_at DESC
          ) AS row_num
        FROM outcomes_v2 o
        WHERE o.account_id IN (${placeholders})
      )
      WHERE row_num <= ?
      ORDER BY created_at DESC
    `,
    args: [...accountIds, limitPerAccount],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    accountId: String(row.account_id),
    messageId: row.message_id ? String(row.message_id) : null,
    eventType: String(row.event_type),
    createdAt: String(row.created_at),
  })) satisfies OutcomeV2Row[];
}

export async function getAccountWorkflowStatus(accountIds: string[]) {
  if (accountIds.length === 0) return [] as AccountWorkflowStatusRow[];
  const db = getClient();
  const placeholders = accountIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      SELECT
        ac.account_id,
        COUNT(DISTINCT ac.lead_id) AS linked_leads,
        COUNT(DISTINCT CASE WHEN ls.status = 'active' THEN ls.id END) AS active_sequences,
        COUNT(DISTINCT CASE WHEN om.status = 'draft' THEN om.id END) AS draft_messages,
        COUNT(DISTINCT CASE WHEN om.status = 'queued' THEN om.id END) AS queued_messages
      FROM account_contacts_v2 ac
      LEFT JOIN lead_sequences ls ON ls.lead_id = ac.lead_id
      LEFT JOIN outbound_messages om
        ON om.lead_id = ac.lead_id
       AND om.direction = 'outbound'
      WHERE ac.account_id IN (${placeholders})
      GROUP BY ac.account_id
    `,
    args: accountIds,
  });

  return result.rows.map((row) => ({
    accountId: String(row.account_id),
    linkedLeads: Number(row.linked_leads ?? 0),
    activeSequences: Number(row.active_sequences ?? 0),
    draftMessages: Number(row.draft_messages ?? 0),
    queuedMessages: Number(row.queued_messages ?? 0),
  })) satisfies AccountWorkflowStatusRow[];
}

export async function getV2BackfillStatus(userId?: string | null) {
  const db = getClient();
  const [accounts, signals, messages, outcomes, backfilledMessages, backfilledOutcomes] = await Promise.all([
    db.execute({
      sql: `SELECT COUNT(*) AS count FROM accounts_v2 WHERE (? IS NULL OR user_id = ?)`,
      args: [userId ?? null, userId ?? null],
    }),
    db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM signals_v2
        WHERE account_id IN (
          SELECT id FROM accounts_v2 WHERE (? IS NULL OR user_id = ?)
        )
      `,
      args: [userId ?? null, userId ?? null],
    }),
    db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM messages_v2
        WHERE account_id IN (
          SELECT id FROM accounts_v2 WHERE (? IS NULL OR user_id = ?)
        )
      `,
      args: [userId ?? null, userId ?? null],
    }),
    db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM outcomes_v2
        WHERE account_id IN (
          SELECT id FROM accounts_v2 WHERE (? IS NULL OR user_id = ?)
        )
      `,
      args: [userId ?? null, userId ?? null],
    }),
    db.execute({
      sql: `
      SELECT COUNT(*) AS count
      FROM messages_v2
      WHERE account_id IN (
        SELECT id FROM accounts_v2 WHERE (? IS NULL OR user_id = ?)
      )
        AND (
          json_extract(metadata, '$.backfilled') = 1
          OR json_extract(metadata, '$.backfilled') = 'true'
        )
    `,
      args: [userId ?? null, userId ?? null],
    }),
    db.execute({
      sql: `
      SELECT COUNT(*) AS count
      FROM outcomes_v2
      WHERE account_id IN (
        SELECT id FROM accounts_v2 WHERE (? IS NULL OR user_id = ?)
      )
        AND (
          json_extract(metadata, '$.backfilled') = 1
          OR json_extract(metadata, '$.backfilled') = 'true'
        )
    `,
      args: [userId ?? null, userId ?? null],
    }),
  ]);

  return {
    accountCount: Number(accounts.rows[0]?.count ?? 0),
    signalCount: Number(signals.rows[0]?.count ?? 0),
    messageCount: Number(messages.rows[0]?.count ?? 0),
    outcomeCount: Number(outcomes.rows[0]?.count ?? 0),
    backfilledMessageCount: Number(backfilledMessages.rows[0]?.count ?? 0),
    backfilledOutcomeCount: Number(backfilledOutcomes.rows[0]?.count ?? 0),
  } satisfies V2BackfillStatus;
}

export async function getAccountNotesV2(accountId: string, userId: string, limit = 8) {
  if (!(await isAccountNotesV2Ready())) return [] as AccountNoteV2Row[];
  const db = getClient();
  const result = await db.execute({
    sql: `
      SELECT n.id, n.account_id, n.user_id, n.body, n.created_at, n.updated_at
      FROM account_notes_v2 n
      INNER JOIN accounts_v2 a ON a.id = n.account_id
      WHERE n.account_id = ?
        AND n.user_id = ?
        AND a.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ?
    `,
    args: [accountId, userId, userId, limit],
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    accountId: String(row.account_id),
    userId: String(row.user_id),
    body: String(row.body),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  })) satisfies AccountNoteV2Row[];
}

export async function getLatestAccountNotesV2(accountIds: string[], userId: string) {
  if (accountIds.length === 0) return [] as LatestAccountNoteV2Row[];
  if (!(await isAccountNotesV2Ready())) return [] as LatestAccountNoteV2Row[];
  const db = getClient();
  const placeholders = accountIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      SELECT account_id, body, created_at
      FROM (
        SELECT
          n.*,
          ROW_NUMBER() OVER (
            PARTITION BY n.account_id
            ORDER BY n.created_at DESC
          ) AS row_num
        FROM account_notes_v2 n
        INNER JOIN accounts_v2 a ON a.id = n.account_id
        WHERE n.account_id IN (${placeholders})
          AND n.user_id = ?
          AND a.user_id = ?
      )
      WHERE row_num = 1
      ORDER BY created_at DESC
    `,
    args: [...accountIds, userId, userId],
  });

  return result.rows.map((row) => ({
    accountId: String(row.account_id),
    body: String(row.body),
    createdAt: String(row.created_at),
  })) satisfies LatestAccountNoteV2Row[];
}

export async function getAccountHealthForAccounts(accountIds: string[]) {
  if (accountIds.length === 0) return [] as AccountHealthRow[];
  const db = getClient();
  const placeholders = accountIds.map(() => "?").join(", ");
  const result = await db.execute({
    sql: `
      WITH last_messages AS (
        SELECT account_id, MAX(created_at) AS last_message_at
        FROM messages_v2
        WHERE account_id IN (${placeholders})
        GROUP BY account_id
      ),
      last_outcomes AS (
        SELECT account_id, event_type, created_at
        FROM (
          SELECT
            o.*,
            ROW_NUMBER() OVER (
              PARTITION BY o.account_id
              ORDER BY o.created_at DESC
            ) AS row_num
          FROM outcomes_v2 o
          WHERE o.account_id IN (${placeholders})
        )
        WHERE row_num = 1
      ),
      positive_outcomes AS (
        SELECT account_id, event_type, created_at
        FROM (
          SELECT
            o.*,
            ROW_NUMBER() OVER (
              PARTITION BY o.account_id
              ORDER BY o.created_at DESC
            ) AS row_num
          FROM outcomes_v2 o
          WHERE o.account_id IN (${placeholders})
            AND o.event_type IN ('reply_positive', 'reply_win')
        )
        WHERE row_num = 1
      )
      SELECT
        a.id AS account_id,
        MAX(
          COALESCE(a.last_signal_at, ''),
          COALESCE(a.last_message_at, ''),
          COALESCE(lm.last_message_at, ''),
          COALESCE(lo.created_at, ''),
          COALESCE(po.created_at, '')
        ) AS last_touch_at,
        lo.event_type AS last_outcome_type,
        lo.created_at AS last_outcome_at,
        po.event_type AS last_positive_outcome_type,
        po.created_at AS last_positive_outcome_at
      FROM accounts_v2 a
      LEFT JOIN last_messages lm ON lm.account_id = a.id
      LEFT JOIN last_outcomes lo ON lo.account_id = a.id
      LEFT JOIN positive_outcomes po ON po.account_id = a.id
      WHERE a.id IN (${placeholders})
    `,
    args: [...accountIds, ...accountIds, ...accountIds, ...accountIds],
  });

  return result.rows.map((row) => ({
    accountId: String(row.account_id),
    lastTouchAt: row.last_touch_at ? String(row.last_touch_at) : null,
    lastOutcomeType: row.last_outcome_type ? String(row.last_outcome_type) : null,
    lastOutcomeAt: row.last_outcome_at ? String(row.last_outcome_at) : null,
    lastPositiveOutcomeType: row.last_positive_outcome_type ? String(row.last_positive_outcome_type) : null,
    lastPositiveOutcomeAt: row.last_positive_outcome_at ? String(row.last_positive_outcome_at) : null,
  })) satisfies AccountHealthRow[];
}

export async function updateAccountV2StatusPriority(params: {
  accountId: string;
  userId: string;
  status: "watching" | "active" | "contacted" | "archived";
  priority: "low" | "normal" | "high";
}) {
  const db = getClient();
  await db.execute({
    sql: `
      UPDATE accounts_v2
      SET status = ?, priority = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `,
    args: [params.status, params.priority, params.accountId, params.userId],
  });
}

export async function createAccountNoteV2(params: {
  accountId: string;
  userId: string;
  body: string;
}) {
  if (!(await isAccountNotesV2Ready())) {
    return false;
  }
  const trimmedBody = params.body.trim();
  if (!trimmedBody) return false;
  const db = getClient();
  await db.execute({
    sql: `
      INSERT INTO account_notes_v2 (
        id, account_id, user_id, body, created_at, updated_at
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `,
    args: [crypto.randomUUID(), params.accountId, params.userId, trimmedBody],
  });
  await db.execute({
    sql: `
      INSERT INTO events_v2 (
        id, user_id, account_id, signal_id, message_id, event_type, payload, created_at
      ) VALUES (?, ?, ?, NULL, NULL, 'account_note_added', ?, datetime('now'))
    `,
    args: [crypto.randomUUID(), params.userId, params.accountId, JSON.stringify({ body: trimmedBody })],
  });
  return true;
}
