#!/usr/bin/env node
import {
  ensureSchema,
  getClient,
  initSendgrid,
  selectLeads,
  sendLeadEmail,
  sleep,
  STATUS,
} from "./lib.mjs";

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function jitterSeconds(min = 60, max = 90) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const maxDaily = Number(arg("max-daily", "50"));
  const batchLimit = Number(arg("limit", String(maxDaily)));
  const dryRun = process.argv.includes("--dry-run");

  const client = getClient();
  await ensureSchema(client);

  const sentTodayRows = await selectLeads(
    client,
    `SELECT COUNT(*) AS sent_today FROM outreach_leads WHERE date(sent_at) = date('now')`,
  );
  const sentToday = Number(sentTodayRows[0]?.sent_today || 0);
  const remaining = Math.max(0, maxDaily - sentToday);

  if (remaining <= 0) {
    console.log(`[send-queue] Daily cap reached (${maxDaily}). Nothing sent.`);
    return;
  }

  const leads = await selectLeads(
    client,
    `
      SELECT * FROM outreach_leads
      WHERE status = ?
        AND reviewed = 1
        AND sent_at IS NULL
      ORDER BY id ASC
      LIMIT ?
    `,
    [STATUS.EMAIL_DRAFTED, Math.min(remaining, batchLimit)],
  );

  if (!leads.length) {
    console.log("[send-queue] No reviewed drafts found.");
    return;
  }

  if (!dryRun) initSendgrid();

  for (const lead of leads) {
    try {
      if (!dryRun) {
        await sendLeadEmail(client, lead);
      }
      console.log(`[stage5/send] lead ${lead.id} ${dryRun ? "dry-run" : "sent"}`);
    } catch (err) {
      console.error(`[stage5/send] lead ${lead.id} failed`, err.message);
      continue;
    }

    const waitSec = jitterSeconds(60, 90);
    console.log(`[stage5/send] waiting ${waitSec}s before next send`);
    await sleep(waitSec * 1000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
