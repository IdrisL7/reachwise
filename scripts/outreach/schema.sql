-- Dedicated outreach pipeline table (kept separate from app's existing leads table)
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
  company_research JSON,
  email_subject TEXT,
  email_body TEXT,
  status TEXT DEFAULT 'imported',
  reviewed BOOLEAN DEFAULT FALSE,
  sent_at DATETIME,
  opened_at DATETIME,
  clicked_at DATETIME,
  replied BOOLEAN DEFAULT FALSE,
  bounced BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS outreach_leads_linkedin_uidx
  ON outreach_leads(linkedin_url)
  WHERE linkedin_url IS NOT NULL AND linkedin_url <> '';
