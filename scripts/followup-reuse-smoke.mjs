#!/usr/bin/env node

import { createClient } from "@libsql/client";

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.TEST_BASE_URL || "http://localhost:3000",
    runs: 2,
    channel: "email",
    mode: "draft",
    sequenceId: "default-b2b-sequence",
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];

    if (token === "--base-url" && next) {
      args.baseUrl = next;
      i++;
    } else if (token === "--lead-id" && next) {
      args.leadId = next;
      i++;
    } else if (token === "--runs" && next) {
      args.runs = Number(next);
      i++;
    } else if (token === "--step" && next) {
      args.step = Number(next);
      i++;
    } else if (token === "--channel" && next) {
      args.channel = next;
      i++;
    } else if (token === "--mode" && next) {
      args.mode = next;
      i++;
    } else if (token === "--sequence-id" && next) {
      args.sequenceId = next;
      i++;
    }
  }

  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
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

async function loadCounts(db) {
  const [leads, hooks, activeLeadSequences] = await Promise.all([
    db.execute("select count(*) as count from leads"),
    db.execute("select count(*) as count from generated_hooks"),
    db.execute({
      sql: "select count(*) as count from lead_sequences where status = ?",
      args: ["active"],
    }),
  ]);

  return {
    leads: Number(leads.rows[0]?.count ?? 0),
    generatedHooks: Number(hooks.rows[0]?.count ?? 0),
    activeLeadSequences: Number(activeLeadSequences.rows[0]?.count ?? 0),
  };
}

async function findCandidateLead(db) {
  const [leadRes, hookRes] = await Promise.all([
    db.execute(`
      select id, user_id, email, name, title, company_name, company_website, sequence_step, status
      from leads
      where user_id is not null and company_website is not null
      limit 500
    `),
    db.execute(`
      select user_id, company_url, created_at
      from generated_hooks
      where user_id is not null and company_url is not null
      order by created_at desc
      limit 1000
    `),
  ]);

  const hookCounts = new Map();
  for (const row of hookRes.rows) {
    const key = `${row.user_id}::${normalizeDomain(row.company_url)}`;
    hookCounts.set(key, (hookCounts.get(key) || 0) + 1);
  }

  const candidates = [];
  for (const lead of leadRes.rows) {
    const key = `${lead.user_id}::${normalizeDomain(lead.company_website)}`;
    const hookCount = hookCounts.get(key) || 0;
    if (hookCount > 0) {
      candidates.push({
        leadId: String(lead.id),
        userId: String(lead.user_id),
        email: lead.email,
        name: lead.name,
        title: lead.title,
        companyName: lead.company_name,
        companyWebsite: lead.company_website,
        sequenceStep: Number(lead.sequence_step ?? 0),
        status: lead.status,
        hookCount,
      });
    }
  }

  candidates.sort((a, b) => b.hookCount - a.hookCount);
  return candidates[0] ?? null;
}

async function loadLead(db, leadId) {
  const result = await db.execute({
    sql: `
      select id, user_id, email, name, title, company_name, company_website, sequence_step, status
      from leads
      where id = ?
      limit 1
    `,
    args: [leadId],
  });

  const lead = result.rows[0];
  if (!lead) return null;

  const companyHookRows = await db.execute({
    sql: `
      select count(*) as count
      from generated_hooks
      where user_id = ?
        and company_url = ?
    `,
    args: [lead.user_id, lead.company_website],
  });

  const hookRows = await db.execute({
    sql: `
      select count(*) as count
      from generated_hooks
      where user_id = ?
    `,
    args: [lead.user_id],
  });

  return {
    leadId: String(lead.id),
    userId: String(lead.user_id),
    email: lead.email,
    name: lead.name,
    title: lead.title,
    companyName: lead.company_name,
    companyWebsite: lead.company_website,
    sequenceStep: Number(lead.sequence_step ?? 0),
    status: lead.status,
    companyHookCount: Number(companyHookRows.rows[0]?.count ?? 0),
    userHookCount: Number(hookRows.rows[0]?.count ?? 0),
  };
}

async function callGenerateFollowup({ baseUrl, token, leadId, sequenceId, step, channel, mode }) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate-followup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      lead_id: leadId,
      sequence_id: sequenceId,
      step,
      channel,
      mode,
    }),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  return {
    durationMs: Date.now() - startedAt,
    status: response.status,
    body,
  };
}

function summarizeRun(run, index) {
  const hookSource = run.body?.meta?.hook_source ?? null;
  const angle = run.body?.meta?.angle ?? null;
  const subject = run.body?.email?.subject ?? null;
  return {
    run: index + 1,
    status: run.status,
    durationMs: run.durationMs,
    hookSource,
    angle,
    subjectPreview: subject ? String(subject).slice(0, 100) : null,
    error: run.status >= 400 ? run.body : null,
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = getClient();
  const token = requireEnv("FOLLOWUP_ENGINE_API_TOKEN");

  const counts = await loadCounts(db);
  const candidate = args.leadId
    ? await loadLead(db, args.leadId)
    : await findCandidateLead(db);

  if (!candidate) {
    console.error("No reused-company lead candidate found.");
    console.error(JSON.stringify({
      counts,
      hint: "Seed at least one lead whose user/company matches existing generated_hooks, then rerun this smoke.",
    }, null, 2));
    process.exit(1);
  }

  const step = Number.isFinite(args.step) ? args.step : candidate.sequenceStep;
  const runs = [];

  console.log(JSON.stringify({
    selectedLead: {
      leadId: candidate.leadId,
      email: candidate.email,
      companyName: candidate.companyName,
      companyWebsite: candidate.companyWebsite,
      sequenceStep: candidate.sequenceStep,
      status: candidate.status,
      companyHookCount: candidate.hookCount ?? candidate.companyHookCount ?? null,
      userHookCount: candidate.userHookCount ?? null,
    },
    counts,
    request: {
      baseUrl: args.baseUrl,
      sequenceId: args.sequenceId,
      step,
      channel: args.channel,
      mode: args.mode,
      runs: args.runs,
    },
  }, null, 2));

  for (let i = 0; i < args.runs; i++) {
    const run = await callGenerateFollowup({
      baseUrl: args.baseUrl,
      token,
      leadId: candidate.leadId,
      sequenceId: args.sequenceId,
      step,
      channel: args.channel,
      mode: args.mode,
    });
    runs.push(run);
    console.log(JSON.stringify(summarizeRun(run, i), null, 2));
  }

  const successful = runs.filter((run) => run.status >= 200 && run.status < 300);
  if (successful.length === 0) {
    console.error("All smoke runs failed.");
    process.exit(1);
  }

  const durations = successful.map((run) => run.durationMs);
  const hookSources = successful.map((run) => run.body?.meta?.hook_source ?? "unknown");
  console.log(JSON.stringify({
    summary: {
      successfulRuns: successful.length,
      avgDurationMs: Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length),
      medianDurationMs: median(durations),
      minDurationMs: Math.min(...durations),
      maxDurationMs: Math.max(...durations),
      hookSources,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
