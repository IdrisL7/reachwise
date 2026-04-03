import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { auth } from "@/lib/auth";
import { unauthorized, validateBearerToken } from "@/lib/followup/auth";

const ALLOWED_CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
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

function parseCsv(content: string) {
  const required = [
    "first_name", "last_name", "full_name", "title", "company_name",
    "company_website", "linkedin_url", "location", "industry", "employee_count",
  ];

  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("CSV must include header and at least one row");

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (const col of required) {
    if (!headers.includes(col)) throw new Error(`Missing required column: ${col}`);
  }

  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (vals[idx] ?? "").trim();
    });
    return row;
  });
}

function normalizeWebsite(input: string) {
  return (input || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

function normalizeLinkedin(input: string) {
  return (input || "").trim().toLowerCase().replace(/\/$/, "");
}

function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("Missing TURSO_DATABASE_URL");
  return createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const hasBearerToken = validateBearerToken(req);
  if (!session?.user?.id && !hasBearerToken) {
    return unauthorized();
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing CSV file in `file` form field." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Only CSV uploads are supported." }, { status: 400 });
    }
    if (!ALLOWED_CSV_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Upload a CSV file." }, { status: 400 });
    }
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      return NextResponse.json({ error: "CSV file is too large." }, { status: 400 });
    }

    const csv = await file.text();
    const rows = parseCsv(csv);

    const client = getClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS outreach_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT, last_name TEXT, full_name TEXT, title TEXT,
        company_name TEXT, company_website TEXT, linkedin_url TEXT,
        location TEXT, industry TEXT, employee_count TEXT,
        email TEXT, email_confidence INTEGER, email_source TEXT,
        company_research TEXT, email_subject TEXT, email_body TEXT,
        status TEXT DEFAULT 'imported', reviewed INTEGER DEFAULT 0,
        sent_at TEXT, opened_at TEXT, clicked_at TEXT,
        replied INTEGER DEFAULT 0, bounced INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    let inserted = 0;
    let skipped = 0;

    for (const row of rows) {
      const linkedin = normalizeLinkedin(row.linkedin_url);
      const website = normalizeWebsite(row.company_website);
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
          "imported",
        ],
      });
      inserted++;
    }

    return NextResponse.json({ ok: true, total: rows.length, inserted, skipped });
  } catch (error) {
    console.error("outreach import failed", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
