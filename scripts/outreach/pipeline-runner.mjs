#!/usr/bin/env node
import fs from "node:fs/promises";
import {
  ensureSchema,
  getClient,
  importLeadsFromCsv,
  selectLeads,
  enrichLead,
  stageFindEmail,
  stageDraftEmail,
  sleep,
  STATUS,
} from "./lib.mjs";

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

async function main() {
  const csvPath = arg("csv");
  const limit = Number(arg("limit", "100"));
  const dryRun = process.argv.includes("--dry-run");

  if (!csvPath) {
    throw new Error("Usage: node scripts/outreach/pipeline-runner.mjs --csv /path/to/leads.csv [--limit 100] [--dry-run]");
  }

  const client = getClient();
  await ensureSchema(client);

  const csvText = await fs.readFile(csvPath, "utf8");
  const importStats = await importLeadsFromCsv(client, csvText);
  console.log("[stage1/import]", importStats);

  if (dryRun) return;

  const toEnrich = await selectLeads(
    client,
    `SELECT * FROM outreach_leads WHERE status = ? ORDER BY id ASC LIMIT ?`,
    [STATUS.IMPORTED, limit],
  );

  for (const lead of toEnrich) {
    try {
      await enrichLead(client, lead);
      console.log(`[stage2/enrich] lead ${lead.id} ok`);
    } catch (err) {
      console.error(`[stage2/enrich] lead ${lead.id} failed`, err.message);
    }
    await sleep(1600);
  }

  const toFindEmail = await selectLeads(
    client,
    `SELECT * FROM outreach_leads WHERE status = ? ORDER BY id ASC LIMIT ?`,
    [STATUS.ENRICHED, limit],
  );

  for (const lead of toFindEmail) {
    try {
      await stageFindEmail(client, lead);
      console.log(`[stage3/email] lead ${lead.id} processed`);
    } catch (err) {
      console.error(`[stage3/email] lead ${lead.id} failed`, err.message);
    }
    await sleep(1300);
  }

  const toDraft = await selectLeads(
    client,
    `SELECT * FROM outreach_leads WHERE status = ? ORDER BY id ASC LIMIT ?`,
    [STATUS.EMAIL_FOUND, limit],
  );

  for (const lead of toDraft) {
    try {
      await stageDraftEmail(client, lead);
      console.log(`[stage4/draft] lead ${lead.id} drafted`);
    } catch (err) {
      console.error(`[stage4/draft] lead ${lead.id} failed`, err.message);
    }
    await sleep(1500);
  }

  const summary = await selectLeads(
    client,
    `SELECT status, COUNT(*) as count FROM outreach_leads GROUP BY status ORDER BY count DESC`,
  );

  console.log("\n[pipeline complete] status summary:");
  for (const row of summary) console.log(`- ${row.status}: ${row.count}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
