import { createClient } from "@libsql/client";
import sgMail from "@sendgrid/mail";

const REQUIRED_COLUMNS = [
  "first_name",
  "last_name",
  "full_name",
  "title",
  "company_name",
  "company_website",
  "linkedin_url",
  "location",
  "industry",
  "employee_count",
];

export const STATUS = {
  IMPORTED: "imported",
  ENRICHED: "enriched",
  EMAIL_FOUND: "email_found",
  EMAIL_NOT_FOUND: "email_not_found",
  EMAIL_DRAFTED: "email_drafted",
  SENT: "sent",
};

export function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Missing TURSO_DATABASE_URL");
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

export async function ensureSchema(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS outreach_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      full_name TEXT,
      title TEXT,
      company_name TEXT,
      company_website TEXT,
      linkedin_url TEXT,
      location TEXT,
      industry TEXT,
      employee_count TEXT,
      email TEXT,
      email_confidence INTEGER,
      email_source TEXT,
      company_research TEXT,
      email_subject TEXT,
      email_body TEXT,
      status TEXT DEFAULT 'imported',
      reviewed INTEGER DEFAULT 0,
      sent_at TEXT,
      opened_at TEXT,
      clicked_at TEXT,
      replied INTEGER DEFAULT 0,
      bounced INTEGER DEFAULT 0,
      sendgrid_message_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS outreach_leads_linkedin_uidx ON outreach_leads(linkedin_url) WHERE linkedin_url IS NOT NULL AND linkedin_url <> '';");
  await client.execute("CREATE INDEX IF NOT EXISTS outreach_leads_company_idx ON outreach_leads(company_website);");
  await client.execute("CREATE INDEX IF NOT EXISTS outreach_leads_status_idx ON outreach_leads(status, reviewed, sent_at);");
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());

  for (const col of REQUIRED_COLUMNS) {
    if (!headers.includes(col)) throw new Error(`Missing required column: ${col}`);
  }

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? "").trim();
    });
    return row;
  });
}

export function normalizeWebsite(input) {
  if (!input) return "";
  let v = input.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  return v;
}

export function normalizeLinkedin(input) {
  if (!input) return "";
  return input.trim().replace(/\/$/, "").toLowerCase();
}

export function domainFromWebsite(companyWebsite) {
  const normalized = normalizeWebsite(companyWebsite);
  return normalized.split("/")[0] || null;
}

export async function importLeadsFromCsv(client, csvText) {
  const rows = parseCsv(csvText);
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const linkedin = normalizeLinkedin(row.linkedin_url);
    const website = normalizeWebsite(row.company_website);

    if (!linkedin && !website) {
      skipped++;
      continue;
    }

    const existing = await client.execute({
      sql: `SELECT id FROM outreach_leads WHERE (linkedin_url = ? AND ? <> '') OR (company_website = ? AND ? <> '') LIMIT 1`,
      args: [linkedin, linkedin, website, website],
    });

    if (existing.rows.length) {
      skipped++;
      continue;
    }

    await client.execute({
      sql: `
        INSERT INTO outreach_leads (
          first_name,last_name,full_name,title,company_name,company_website,linkedin_url,
          location,industry,employee_count,status
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `,
      args: [
        row.first_name || null,
        row.last_name || null,
        row.full_name || null,
        row.title || null,
        row.company_name || null,
        website || null,
        linkedin || null,
        row.location || null,
        row.industry || null,
        row.employee_count || null,
        STATUS.IMPORTED,
      ],
    });
    inserted++;
  }

  return { total: rows.length, inserted, skipped };
}

export async function tavilySearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error("Missing TAVILY_API_KEY");

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query, search_depth: "advanced", max_results: 5 }),
  });
  if (!res.ok) throw new Error(`Tavily failed ${res.status}`);
  return res.json();
}

export async function enrichLead(client, lead) {
  const queries = [
    `${lead.company_name} news 2025`,
    `${lead.company_name} ${lead.company_website ?? ""} product service`,
    `${lead.company_name} hiring OR funding OR launched 2025`,
  ];

  const results = [];
  for (const query of queries) {
    const data = await tavilySearch(query);
    results.push({ query, data, fetched_at: new Date().toISOString() });
    await sleep(1200);
  }

  await client.execute({
    sql: "UPDATE outreach_leads SET company_research = ?, status = ?, updated_at = datetime('now') WHERE id = ?",
    args: [JSON.stringify(results), STATUS.ENRICHED, lead.id],
  });
}

export async function findEmailWithHunter(firstName, lastName, domain) {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) throw new Error("Missing HUNTER_API_KEY");
  if (!domain) return { email: null, confidence: null };

  const url = new URL("https://api.hunter.io/v2/email-finder");
  url.searchParams.set("domain", domain);
  url.searchParams.set("first_name", firstName || "");
  url.searchParams.set("last_name", lastName || "");
  url.searchParams.set("api_key", apiKey);

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Hunter failed ${resp.status}`);

  const data = (await resp.json())?.data ?? {};
  const email = data.email || null;
  const confidence = Number(data.score || 0);

  if (email && confidence > 70) return { email, confidence };
  return { email: null, confidence: null };
}

export async function stageFindEmail(client, lead) {
  const domain = domainFromWebsite(lead.company_website);
  const { email, confidence } = await findEmailWithHunter(lead.first_name, lead.last_name, domain);

  await client.execute({
    sql: `
      UPDATE outreach_leads
      SET email = ?, email_confidence = ?, email_source = 'hunter.io', status = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [email, confidence, email ? STATUS.EMAIL_FOUND : STATUS.EMAIL_NOT_FOUND, lead.id],
  });
}

export async function generateDraftWithAnthropic(lead) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const research = safeParseJson(lead.company_research) ?? [];

  const prompt = `You write high-performing cold emails. Return JSON only: {"subject":"...","body":"..."}\n\nLead:\n- Name: ${lead.full_name || `${lead.first_name || ""} ${lead.last_name || ""}`.trim()}\n- Title: ${lead.title || ""}\n- Company: ${lead.company_name || ""}\n- Website: ${lead.company_website || ""}\n- Industry: ${lead.industry || ""}\n\nCompany research JSON:\n${JSON.stringify(research).slice(0, 12000)}\n\nRules:\n- 5-7 sentences max\n- Start with specific observation about their company\n- Connect to why cold outreach quality matters for them\n- Introduce GetSignalHooks in one sentence\n- Ask to try a free demo and give feedback\n- Direct tone, concise\n- No hype, no fake claims\n`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OUTREACH_LLM_MODEL || "claude-3-5-sonnet-latest",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic failed ${res.status}`);
  const payload = await res.json();
  const text = payload?.content?.[0]?.text || "";
  const parsed = safeParseJson(extractJson(text));

  return {
    subject: parsed?.subject || `Quick idea for ${lead.company_name || "your outbound"}`,
    body: parsed?.body || text,
  };
}

export async function stageDraftEmail(client, lead) {
  const draft = await generateDraftWithAnthropic(lead);
  await client.execute({
    sql: `UPDATE outreach_leads SET email_subject = ?, email_body = ?, status = ?, updated_at = datetime('now') WHERE id = ?`,
    args: [draft.subject, draft.body, STATUS.EMAIL_DRAFTED, lead.id],
  });
}

export function initSendgrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (!key) throw new Error("Missing SENDGRID_API_KEY");
  sgMail.setApiKey(key);
}

export async function sendLeadEmail(client, lead) {
  if (!lead.email || !lead.email_subject || !lead.email_body) {
    throw new Error(`Lead ${lead.id} missing email or draft`);
  }

  const msg = {
    to: lead.email,
    from: {
      email: process.env.SENDGRID_FROM_EMAIL || "hello@getsignalhooks.com",
      name: process.env.SENDGRID_FROM_NAME || "Idris from GetSignalHooks",
    },
    subject: lead.email_subject,
    text: lead.email_body,
    trackingSettings: {
      clickTracking: { enable: true, enableText: true },
      openTracking: { enable: true },
    },
    customArgs: {
      lead_id: String(lead.id),
      pipeline: "getsignalhooks_outreach",
    },
  };

  const [resp] = await sgMail.send(msg);
  const messageId = resp?.headers?.["x-message-id"] || null;

  await client.execute({
    sql: `
      UPDATE outreach_leads
      SET status = ?, sent_at = datetime('now'), sendgrid_message_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [STATUS.SENT, messageId, lead.id],
  });
}

export async function selectLeads(client, sql, args = []) {
  const res = await client.execute({ sql, args });
  return res.rows;
}

export function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export function safeParseJson(text) {
  if (!text || typeof text !== "string") return null;
  try { return JSON.parse(text); } catch { return null; }
}

export async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
