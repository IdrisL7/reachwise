import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import crypto from "crypto";

function readEnvFile(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim().replace(/^"|"$/g, "")];
      }),
  );
}

const env = {
  ...readEnvFile(".env.local"),
  ...process.env,
};

function requireEnv(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const client = createClient({
  url: requireEnv("TURSO_DATABASE_URL"),
  authToken: requireEnv("TURSO_AUTH_TOKEN"),
});

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

function normalizeCompanyName(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function slugCompanyName(value) {
  return (normalizeCompanyName(value) || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDomain(value) {
  if (!value) return null;
  let input = value.trim().toLowerCase();
  if (!input) return null;
  try {
    if (!/^https?:\/\//.test(input)) {
      input = `https://${input}`;
    }
    const url = new URL(input);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return input
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0]
      .split("?")[0]
      .split("#")[0] || null;
  }
}

function normalizeWebsite(value, domain) {
  if (value) {
    let input = value.trim();
    if (!input) return domain ? `https://${domain}` : null;
    if (!/^https?:\/\//i.test(input)) {
      input = `https://${input}`;
    }
    try {
      const url = new URL(input);
      return `${url.protocol}//${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`;
    } catch {
      return domain ? `https://${domain}` : null;
    }
  }
  return domain ? `https://${domain}` : null;
}

function mapHookEventToOutcomeType(event) {
  if (event === "viewed") return "viewed";
  if (event === "copied" || event === "copied_with_evidence") return "copied";
  if (event === "email_copied" || event === "used_in_email") return "sent";
  if (event === "reply_win") return "reply_win";
  if (event === "positive_reply") return "reply_positive";
  return null;
}

function mapOutboundStatusToStage(status) {
  if (status === "draft") return "generated";
  if (status === "queued") return "queued";
  if (status === "sent") return "sent";
  if (status === "failed") return "rejected";
  return "generated";
}

function inferCreatedAt(row) {
  return row.created_at || row.sent_at || new Date().toISOString();
}

async function fetchRows() {
  const tables = await client.execute(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
  `);
  const tableSet = new Set(tables.rows.map((row) => String(row.name)));

  const requiredV2Tables = ["accounts_v2", "messages_v2", "outcomes_v2"];
  const missingV2Tables = requiredV2Tables.filter((name) => !tableSet.has(name));
  if (missingV2Tables.length > 0) {
    throw new Error(
      `Missing required v2 tables: ${missingV2Tables.join(", ")}. Run drizzle/0021_v2_core_backbone.sql before running this backfill.`,
    );
  }

  const accountRows = await client.execute(`
    SELECT id, user_id, company_name, domain, website, linkedin_url, status, priority, last_signal_at, last_message_at
    FROM accounts_v2
  `);

  const generatedHooksColumns = tableSet.has("generated_hooks")
    ? new Set(
        (
          await client.execute(`PRAGMA table_info(generated_hooks)`)
        ).rows.map((row) => String(row.name)),
      )
    : new Set();

  const hookRows = tableSet.has("generated_hooks")
    ? await client.execute(`
        SELECT id, user_id, company_url, company_name, hook_text, angle, source_url, source_title, source_snippet,
               source_date, trigger_type,
               ${generatedHooksColumns.has("target_role") ? "target_role" : "NULL AS target_role"},
               created_at
        FROM generated_hooks
        WHERE user_id IS NOT NULL
      `)
    : { rows: [] };

  const outcomeRows = tableSet.has("hook_outcomes") && tableSet.has("generated_hooks")
    ? await client.execute(`
        SELECT ho.id, ho.generated_hook_id, ho.user_id, ho.event, ho.metadata, ho.created_at,
               gh.company_url, gh.company_name
        FROM hook_outcomes ho
        JOIN generated_hooks gh ON gh.id = ho.generated_hook_id
        WHERE ho.user_id IS NOT NULL
      `)
    : { rows: [] };

  const outboundRows = tableSet.has("outbound_messages") && tableSet.has("leads")
    ? await client.execute(`
        SELECT om.id, om.lead_id, om.sequence_step, om.channel, om.subject, om.body, om.sent_at, om.status,
               om.metadata, om.created_at, l.user_id, l.company_name, l.company_website
        FROM outbound_messages om
        JOIN leads l ON l.id = om.lead_id
        WHERE l.user_id IS NOT NULL AND om.direction = 'outbound'
      `)
    : { rows: [] };

  return {
    accountRows: accountRows.rows,
    hookRows: hookRows.rows,
    outcomeRows: outcomeRows.rows,
    outboundRows: outboundRows.rows,
    availableTables: Array.from(tableSet).sort(),
  };
}

function buildAccountMaps(rows) {
  const byDomain = new Map();
  const byName = new Map();
  for (const row of rows) {
    if (row.domain) byDomain.set(`${row.user_id}::${row.domain}`, row.id);
    const normalizedName = normalizeCompanyName(row.company_name);
    if (normalizedName) byName.set(`${row.user_id}::${slugCompanyName(normalizedName)}`, row.id);
  }
  return { byDomain, byName };
}

async function ensureAccountId(accountMaps, params) {
  const domain = normalizeDomain(params.companyUrl);
  const companyName = normalizeCompanyName(params.companyName) || domain || "Unknown";
  const domainKey = domain ? `${params.userId}::${domain}` : null;
  const nameKey = `${params.userId}::${slugCompanyName(companyName)}`;
  const existingId = (domainKey ? accountMaps.byDomain.get(domainKey) : null) ?? accountMaps.byName.get(nameKey) ?? null;

  if (existingId) {
    if (!dryRun) {
      await client.execute({
        sql: `
          UPDATE accounts_v2
          SET
            company_name = COALESCE(company_name, ?),
            domain = COALESCE(domain, ?),
            website = COALESCE(website, ?),
            updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [companyName, domain, normalizeWebsite(params.companyUrl, domain), existingId],
      });
    }
    return existingId;
  }

  const accountId = crypto.randomUUID();
  if (!dryRun) {
    await client.execute({
      sql: `
        INSERT INTO accounts_v2 (
          id, user_id, company_name, domain, website, status, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'active', 'normal', datetime('now'), datetime('now'))
      `,
      args: [accountId, params.userId, companyName, domain, normalizeWebsite(params.companyUrl, domain)],
    });
  }

  if (domainKey) accountMaps.byDomain.set(domainKey, accountId);
  accountMaps.byName.set(nameKey, accountId);
  return accountId;
}

async function buildExistingMessageMaps() {
  const rows = await client.execute(`
    SELECT id, account_id, kind, metadata
    FROM messages_v2
    WHERE kind IN ('hook', 'followup')
  `);

  const hookByGeneratedHookId = new Map();
  const followupByOutboundMessageId = new Map();

  for (const row of rows.rows) {
    if (!row.metadata || typeof row.metadata !== "string") continue;
    try {
      const metadata = JSON.parse(row.metadata);
      if (row.kind === "hook" && metadata.generatedHookId) {
        hookByGeneratedHookId.set(String(metadata.generatedHookId), row.id);
      }
      if (row.kind === "followup" && metadata.outboundMessageId) {
        followupByOutboundMessageId.set(String(metadata.outboundMessageId), row.id);
      }
    } catch {
      // Ignore malformed metadata from legacy rows.
    }
  }

  return { hookByGeneratedHookId, followupByOutboundMessageId };
}

async function buildExistingOutcomeKeys() {
  const rows = await client.execute(`
    SELECT event_type, metadata, created_at
    FROM outcomes_v2
  `);

  const keys = new Set();
  for (const row of rows.rows) {
    if (!row.metadata || typeof row.metadata !== "string") continue;
    try {
      const metadata = JSON.parse(row.metadata);
      const hookOutcomeId = metadata.hookOutcomeId ? String(metadata.hookOutcomeId) : null;
      if (hookOutcomeId) {
        keys.add(`hook::${hookOutcomeId}`);
      }
    } catch {
      // Ignore malformed metadata from legacy rows.
    }
  }
  return keys;
}

async function persistHooks({ hookRows, accountMaps, messageMaps }) {
  let insertedHooks = 0;

  for (const row of hookRows) {
    if (messageMaps.hookByGeneratedHookId.has(String(row.id))) continue;

    const accountId = await ensureAccountId(accountMaps, {
      userId: row.user_id,
      companyUrl: row.company_url,
      companyName: row.company_name,
    });

    insertedHooks += 1;
    const createdAt = inferCreatedAt(row);
    if (!dryRun) {
      const messageId = crypto.randomUUID();
      await client.execute({
        sql: `
          INSERT INTO messages_v2 (
            id, account_id, signal_id, lead_id, parent_message_id, kind, stage, channel,
            subject, body, tone, rationale, metadata, created_at, updated_at
          ) VALUES (?, ?, NULL, NULL, NULL, 'hook', 'generated', 'email', NULL, ?, NULL, NULL, ?, ?, ?)
        `,
        args: [
          messageId,
          accountId,
          row.hook_text,
          JSON.stringify({
            generatedHookId: row.id,
            sourceUrl: row.source_url ?? null,
            sourceTitle: row.source_title ?? null,
            sourceSnippet: row.source_snippet ?? null,
            sourceDate: row.source_date ?? null,
            triggerType: row.trigger_type ?? null,
            targetRole: row.target_role ?? null,
            angle: row.angle ?? null,
            backfilled: true,
          }),
          createdAt,
          createdAt,
        ],
      });
      await client.execute({
        sql: `
          UPDATE accounts_v2
          SET
            last_message_at = CASE
              WHEN last_message_at IS NULL THEN ?
              WHEN datetime(?) > datetime(last_message_at) THEN ?
              ELSE last_message_at
            END,
            updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [createdAt, createdAt, createdAt, accountId],
      });
      messageMaps.hookByGeneratedHookId.set(String(row.id), messageId);
    } else {
      messageMaps.hookByGeneratedHookId.set(String(row.id), `dry-run-hook-${row.id}`);
    }
  }

  return insertedHooks;
}

async function persistOutboundMessages({ outboundRows, accountMaps, messageMaps }) {
  let insertedFollowups = 0;

  for (const row of outboundRows) {
    if (messageMaps.followupByOutboundMessageId.has(String(row.id))) continue;

    const accountId = await ensureAccountId(accountMaps, {
      userId: row.user_id,
      companyUrl: row.company_website,
      companyName: row.company_name,
    });

    insertedFollowups += 1;
    const createdAt = inferCreatedAt(row);
    const stage = mapOutboundStatusToStage(row.status);
    let parsedMetadata = {};
    if (row.metadata && typeof row.metadata === "string") {
      try {
        parsedMetadata = JSON.parse(row.metadata);
      } catch {
        parsedMetadata = {};
      }
    }

    if (!dryRun) {
      const messageId = crypto.randomUUID();
      await client.execute({
        sql: `
          INSERT INTO messages_v2 (
            id, account_id, signal_id, lead_id, parent_message_id, kind, stage, channel,
            subject, body, tone, rationale, metadata, created_at, updated_at
          ) VALUES (?, ?, NULL, ?, NULL, 'followup', ?, ?, ?, ?, NULL, NULL, ?, ?, ?)
        `,
        args: [
          messageId,
          accountId,
          row.lead_id,
          stage,
          row.channel || "email",
          row.subject ?? null,
          row.body,
          JSON.stringify({
            ...parsedMetadata,
            outboundMessageId: row.id,
            leadId: row.lead_id,
            sequenceStep: row.sequence_step,
            backfilled: true,
          }),
          createdAt,
          row.sent_at || createdAt,
        ],
      });
      await client.execute({
        sql: `
          UPDATE accounts_v2
          SET
            last_message_at = CASE
              WHEN last_message_at IS NULL THEN ?
              WHEN datetime(?) > datetime(last_message_at) THEN ?
              ELSE last_message_at
            END,
            updated_at = datetime('now')
          WHERE id = ?
        `,
        args: [createdAt, createdAt, createdAt, accountId],
      });
      messageMaps.followupByOutboundMessageId.set(String(row.id), messageId);
    } else {
      messageMaps.followupByOutboundMessageId.set(String(row.id), `dry-run-followup-${row.id}`);
    }
  }

  return insertedFollowups;
}

async function persistHookOutcomes({ outcomeRows, accountMaps, messageMaps, outcomeKeys }) {
  let insertedOutcomes = 0;

  for (const row of outcomeRows) {
    const mapped = mapHookEventToOutcomeType(row.event);
    if (!mapped) continue;
    const outcomeKey = `hook::${row.id}`;
    if (outcomeKeys.has(outcomeKey)) continue;

    const accountId = await ensureAccountId(accountMaps, {
      userId: row.user_id,
      companyUrl: row.company_url,
      companyName: row.company_name,
    });
    const messageId = messageMaps.hookByGeneratedHookId.get(String(row.generated_hook_id)) ?? null;

    insertedOutcomes += 1;
    let parsedMetadata = {};
    if (row.metadata && typeof row.metadata === "string") {
      try {
        parsedMetadata = JSON.parse(row.metadata);
      } catch {
        parsedMetadata = {};
      }
    }

    if (!dryRun) {
      await client.execute({
        sql: `
          INSERT INTO outcomes_v2 (
            id, account_id, message_id, signal_id, event_type, metadata, created_at
          ) VALUES (?, ?, ?, NULL, ?, ?, ?)
        `,
        args: [
          crypto.randomUUID(),
          accountId,
          messageId,
          mapped,
          JSON.stringify({
            ...parsedMetadata,
            hookOutcomeId: row.id,
            hookId: row.generated_hook_id,
            hookEvent: row.event,
            backfilled: true,
          }),
          row.created_at || new Date().toISOString(),
        ],
      });
      outcomeKeys.add(outcomeKey);
    }
  }

  return insertedOutcomes;
}

try {
  const rows = await fetchRows();
  const accountMaps = buildAccountMaps(rows.accountRows);
  const messageMaps = await buildExistingMessageMaps();
  const outcomeKeys = await buildExistingOutcomeKeys();

  const insertedHookMessages = await persistHooks({
    hookRows: rows.hookRows,
    accountMaps,
    messageMaps,
  });
  const insertedFollowupMessages = await persistOutboundMessages({
    outboundRows: rows.outboundRows,
    accountMaps,
    messageMaps,
  });
  const insertedOutcomes = await persistHookOutcomes({
    outcomeRows: rows.outcomeRows,
    accountMaps,
    messageMaps,
    outcomeKeys,
  });

  console.log(JSON.stringify({
    dryRun,
    availableSourceTables: rows.availableTables.filter((name) => ["generated_hooks", "hook_outcomes", "outbound_messages", "leads"].includes(name)),
    insertedHookMessages,
    insertedFollowupMessages,
    insertedOutcomes,
  }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
