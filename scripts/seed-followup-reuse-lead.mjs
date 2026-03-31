#!/usr/bin/env node

import { createClient } from "@libsql/client";

function parseArgs(argv) {
  const args = {
    withSequence: false,
    sequenceName: "Smoke Sequence",
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--with-sequence") {
      args.withSequence = true;
    } else if (token === "--company-url" && next) {
      args.companyUrl = next;
      i++;
    } else if (token === "--user-id" && next) {
      args.userId = next;
      i++;
    } else if (token === "--company-name" && next) {
      args.companyName = next;
      i++;
    } else if (token === "--sequence-name" && next) {
      args.sequenceName = next;
      i++;
    }
  }

  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function getClient() {
  return createClient({
    url: requireEnv("TURSO_DATABASE_URL"),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}

function normalizeDomain(url) {
  if (!url) return null;
  const stripped = String(url).trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  return stripped.split("/")[0] || null;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

async function findHookSeedCandidate(db, args) {
  const query = await db.execute(`
    select user_id, company_url, company_name, source_title, source_snippet, created_at
    from generated_hooks
    where user_id is not null and company_url is not null
    order by created_at desc
    limit 1000
  `);

  const grouped = new Map();
  for (const row of query.rows) {
    if (args.userId && row.user_id !== args.userId) continue;
    if (args.companyUrl && row.company_url !== args.companyUrl) continue;

    const domain = normalizeDomain(row.company_url);
    if (!domain) continue;

    const key = `${row.user_id}::${domain}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.hookCount++;
      continue;
    }

    grouped.set(key, {
      userId: String(row.user_id),
      companyUrl: String(row.company_url),
      companyName: row.company_name || args.companyName || null,
      sourceTitle: row.source_title || null,
      sourceSnippet: row.source_snippet || null,
      domain,
      hookCount: 1,
    });
  }

  const candidates = [...grouped.values()].sort((a, b) => b.hookCount - a.hookCount);
  return candidates[0] ?? null;
}

async function findExistingLead(db, candidate) {
  const result = await db.execute({
    sql: `
      select id, email, company_website
      from leads
      where user_id = ?
        and company_website = ?
      limit 1
    `,
    args: [candidate.userId, candidate.companyUrl],
  });

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    email: row.email,
    companyWebsite: row.company_website,
  };
}

async function ensureSequence(db, userId, sequenceName) {
  const existing = await db.execute({
    sql: `
      select id
      from sequences
      where user_id = ? and name = ?
      limit 1
    `,
    args: [userId, sequenceName],
  });

  const existingId = existing.rows[0]?.id;
  if (existingId) return String(existingId);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const steps = JSON.stringify([
    { order: 0, channel: "email", delayDays: 0, type: "first", tone: "direct" },
    { order: 1, channel: "email", delayDays: 0, type: "bump", tone: "direct" },
  ]);

  await db.execute({
    sql: `
      insert into sequences (id, user_id, name, steps, is_default, created_at, updated_at)
      values (?, ?, ?, ?, 0, ?, ?)
    `,
    args: [id, userId, sequenceName, steps, now, now],
  });

  return id;
}

async function ensureLeadSequence(db, leadId, sequenceId) {
  const existing = await db.execute({
    sql: `
      select id
      from lead_sequences
      where lead_id = ? and sequence_id = ?
      limit 1
    `,
    args: [leadId, sequenceId],
  });

  const existingId = existing.rows[0]?.id;
  if (existingId) return String(existingId);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute({
    sql: `
      insert into lead_sequences (id, lead_id, sequence_id, current_step, status, approval_mode, started_at)
      values (?, ?, ?, 0, 'active', 1, ?)
    `,
    args: [id, leadId, sequenceId, now],
  });

  return id;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = getClient();
  const candidate = await findHookSeedCandidate(db, args);

  if (!candidate) {
    console.error("No generated_hooks candidate found to seed from.");
    process.exit(1);
  }

  const existingLead = await findExistingLead(db, candidate);
  let leadId = existingLead?.id;
  let insertedLead = false;

  if (!leadId) {
    leadId = crypto.randomUUID();
    const stamp = Date.now();
    const emailSlug = slugify(candidate.domain || candidate.companyName || "company");
    const email = `followup-smoke+${emailSlug}-${stamp}@example.com`;
    const now = new Date().toISOString();

    await db.execute({
      sql: `
        insert into leads (
          user_id, id, email, name, title, company_name, company_website, source, status, sequence_step, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, 'manual', 'cold', 0, ?, ?)
      `,
      args: [
        candidate.userId,
        leadId,
        email,
        "Reuse Smoke",
        "VP Sales",
        candidate.companyName || candidate.sourceTitle || candidate.domain,
        candidate.companyUrl,
        now,
        now,
      ],
    });
    insertedLead = true;
  }

  let sequenceId = null;
  let leadSequenceId = null;

  if (args.withSequence) {
    sequenceId = await ensureSequence(db, candidate.userId, args.sequenceName);
    leadSequenceId = await ensureLeadSequence(db, leadId, sequenceId);
  }

  console.log(JSON.stringify({
    seededFrom: {
      userId: candidate.userId,
      companyUrl: candidate.companyUrl,
      companyName: candidate.companyName,
      domain: candidate.domain,
      hookCount: candidate.hookCount,
    },
    lead: {
      id: leadId,
      inserted: insertedLead,
      reusedExisting: !insertedLead,
    },
    sequence: args.withSequence
      ? {
          sequenceId,
          leadSequenceId,
          name: args.sequenceName,
        }
      : null,
    next: {
      smokeCommand: `node --env-file=.env.local scripts/followup-reuse-smoke.mjs --lead-id ${leadId} --runs 3`,
      runnerReady: Boolean(args.withSequence),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
