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
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
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

function pickPreferred(current, incoming, preferred = false) {
  if (!incoming) return current;
  if (!current) return incoming;
  if (preferred) return incoming;
  return incoming.length > current.length ? incoming : current;
}

function maxTimestamp(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function getAccountKey(userId, domain, companyName) {
  if (domain) return `${userId}::domain::${domain}`;
  return `${userId}::name::${slugCompanyName(companyName)}`;
}

function createAggregate(userId, domain, companyName) {
  return {
    userId,
    domain,
    companyName: companyName || domain || "Unknown",
    website: normalizeWebsite(null, domain),
    linkedinUrl: null,
    status: "active",
    priority: "normal",
    lastSignalAt: null,
    lastMessageAt: null,
    leadIds: new Set(),
    sources: new Set(),
  };
}

const aggregates = new Map();

function upsertAggregate({ userId, domain, companyName, website, linkedinUrl, status, priority, lastSignalAt, lastMessageAt, leadId, source, preferredName = false }) {
  const key = getAccountKey(userId, domain, companyName);
  const aggregate = aggregates.get(key) ?? createAggregate(userId, domain, companyName);

  aggregate.companyName = pickPreferred(aggregate.companyName, companyName, preferredName) || aggregate.companyName;
  aggregate.domain = aggregate.domain || domain;
  aggregate.website = pickPreferred(aggregate.website, normalizeWebsite(website, domain), Boolean(website));
  aggregate.linkedinUrl = pickPreferred(aggregate.linkedinUrl, linkedinUrl, Boolean(linkedinUrl));
  aggregate.lastSignalAt = maxTimestamp(aggregate.lastSignalAt, lastSignalAt);
  aggregate.lastMessageAt = maxTimestamp(aggregate.lastMessageAt, lastMessageAt);
  aggregate.sources.add(source);

  if (priority === "high") aggregate.priority = "high";
  if (status === "contacted") aggregate.status = "contacted";
  else if (aggregate.status !== "contacted" && status === "active") aggregate.status = "active";
  else if (aggregate.status !== "contacted" && aggregate.status !== "active" && status === "watching") aggregate.status = "watching";

  if (leadId) aggregate.leadIds.add(leadId);

  aggregates.set(key, aggregate);
}

async function fetchRows() {
  const [hookRows, watchlistRows, leadRows, existingRows] = await Promise.all([
    client.execute(`
      SELECT user_id, company_url, company_name, created_at
      FROM generated_hooks
      WHERE user_id IS NOT NULL
    `),
    client.execute(`
      SELECT user_id, company_name, domain, added_at, last_signal_at
      FROM watchlist
      WHERE user_id IS NOT NULL
    `),
    client.execute(`
      SELECT id, user_id, company_name, company_website, linkedin_url, status, last_contacted_at, created_at
      FROM leads
      WHERE user_id IS NOT NULL AND (company_name IS NOT NULL OR company_website IS NOT NULL)
    `),
    client.execute(`
      SELECT id, user_id, domain, company_name
      FROM accounts_v2
    `),
  ]);

  return {
    hookRows: hookRows.rows,
    watchlistRows: watchlistRows.rows,
    leadRows: leadRows.rows,
    existingRows: existingRows.rows,
  };
}

function buildExistingMaps(rows) {
  const byDomain = new Map();
  const byName = new Map();

  for (const row of rows) {
    const userId = row.user_id;
    const domain = row.domain || null;
    const companyName = normalizeCompanyName(row.company_name);
    if (domain) {
      byDomain.set(`${userId}::${domain}`, row.id);
    } else if (companyName) {
      byName.set(`${userId}::${slugCompanyName(companyName)}`, row.id);
    }
  }

  return { byDomain, byName };
}

function buildAggregates({ hookRows, watchlistRows, leadRows }) {
  for (const row of hookRows) {
    const domain = normalizeDomain(row.company_url);
    const companyName = normalizeCompanyName(row.company_name) || domain;
    if (!companyName && !domain) continue;
    upsertAggregate({
      userId: row.user_id,
      domain,
      companyName,
      website: row.company_url,
      status: "active",
      priority: "normal",
      lastSignalAt: row.created_at,
      source: "generated_hooks",
    });
  }

  for (const row of watchlistRows) {
    const domain = normalizeDomain(row.domain);
    const companyName = normalizeCompanyName(row.company_name) || domain;
    if (!companyName && !domain) continue;
    upsertAggregate({
      userId: row.user_id,
      domain,
      companyName,
      website: domain ? `https://${domain}` : null,
      status: "watching",
      priority: "high",
      lastSignalAt: row.last_signal_at || row.added_at,
      source: "watchlist",
      preferredName: true,
    });
  }

  for (const row of leadRows) {
    const domain = normalizeDomain(row.company_website);
    const companyName = normalizeCompanyName(row.company_name) || domain;
    if (!companyName && !domain) continue;
    const contacted = Boolean(row.last_contacted_at) || (row.status && row.status !== "cold");
    upsertAggregate({
      userId: row.user_id,
      domain,
      companyName,
      website: row.company_website,
      linkedinUrl: row.linkedin_url,
      status: contacted ? "contacted" : "active",
      priority: "normal",
      lastMessageAt: row.last_contacted_at,
      lastSignalAt: row.created_at,
      leadId: row.id,
      source: "leads",
      preferredName: true,
    });
  }
}

async function persistAggregates(existingMaps) {
  let insertedAccounts = 0;
  let updatedAccounts = 0;
  let linkedContacts = 0;

  for (const aggregate of aggregates.values()) {
    const domainKey = aggregate.domain ? `${aggregate.userId}::${aggregate.domain}` : null;
    const nameKey = `${aggregate.userId}::${slugCompanyName(aggregate.companyName)}`;
    const existingId =
      (domainKey ? existingMaps.byDomain.get(domainKey) : null) ??
      existingMaps.byName.get(nameKey) ??
      null;

    let accountId = existingId;

    if (!existingId) {
      accountId = crypto.randomUUID();
      insertedAccounts += 1;
      if (!dryRun) {
        await client.execute({
          sql: `
            INSERT INTO accounts_v2 (
              id, user_id, company_name, domain, website, linkedin_url, status, priority,
              owner_user_id, last_signal_at, last_message_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'), datetime('now'))
          `,
          args: [
            accountId,
            aggregate.userId,
            aggregate.companyName,
            aggregate.domain,
            aggregate.website,
            aggregate.linkedinUrl,
            aggregate.status,
            aggregate.priority,
            aggregate.lastSignalAt,
            aggregate.lastMessageAt,
          ],
        });
      }
      if (aggregate.domain) existingMaps.byDomain.set(`${aggregate.userId}::${aggregate.domain}`, accountId);
      existingMaps.byName.set(nameKey, accountId);
    } else {
      updatedAccounts += 1;
      if (!dryRun) {
        await client.execute({
          sql: `
            UPDATE accounts_v2
            SET
              company_name = COALESCE(?, company_name),
              domain = COALESCE(domain, ?),
              website = COALESCE(?, website),
              linkedin_url = COALESCE(?, linkedin_url),
              status = CASE
                WHEN ? = 'contacted' THEN 'contacted'
                WHEN status = 'contacted' THEN status
                WHEN ? = 'active' THEN 'active'
                WHEN status IN ('active', 'contacted') THEN status
                ELSE COALESCE(?, status)
              END,
              priority = CASE
                WHEN ? = 'high' OR priority = 'high' THEN 'high'
                ELSE COALESCE(?, priority)
              END,
              last_signal_at = CASE
                WHEN last_signal_at IS NULL THEN ?
                WHEN ? IS NULL THEN last_signal_at
                WHEN datetime(?) > datetime(last_signal_at) THEN ?
                ELSE last_signal_at
              END,
              last_message_at = CASE
                WHEN last_message_at IS NULL THEN ?
                WHEN ? IS NULL THEN last_message_at
                WHEN datetime(?) > datetime(last_message_at) THEN ?
                ELSE last_message_at
              END,
              updated_at = datetime('now')
            WHERE id = ?
          `,
          args: [
            aggregate.companyName,
            aggregate.domain,
            aggregate.website,
            aggregate.linkedinUrl,
            aggregate.status,
            aggregate.status,
            aggregate.status,
            aggregate.priority,
            aggregate.priority,
            aggregate.lastSignalAt,
            aggregate.lastSignalAt,
            aggregate.lastSignalAt,
            aggregate.lastSignalAt,
            aggregate.lastMessageAt,
            aggregate.lastMessageAt,
            aggregate.lastMessageAt,
            aggregate.lastMessageAt,
            existingId,
          ],
        });
      }
    }

    for (const leadId of aggregate.leadIds) {
      linkedContacts += 1;
      if (!dryRun) {
        await client.execute({
          sql: `
            INSERT OR IGNORE INTO account_contacts_v2 (
              account_id, lead_id, role, relationship, created_at
            ) VALUES (?, ?, NULL, 'primary', datetime('now'))
          `,
          args: [accountId, leadId],
        });
      }
    }
  }

  return { insertedAccounts, updatedAccounts, linkedContacts };
}

const rows = await fetchRows();
buildAggregates(rows);
const existingMaps = buildExistingMaps(rows.existingRows);
const result = await persistAggregates(existingMaps);

console.log(JSON.stringify({
  dryRun,
  discoveredAccounts: aggregates.size,
  insertedAccounts: result.insertedAccounts,
  updatedAccounts: result.updatedAccounts,
  linkedContacts: result.linkedContacts,
}, null, 2));
