CREATE TABLE company_intel (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  company_name TEXT,
  industry TEXT,
  sub_industry TEXT,
  employee_range TEXT,
  hq_location TEXT,
  founded_year INTEGER,
  description TEXT,
  tech_stack TEXT DEFAULT '[]',
  tech_stack_sources TEXT DEFAULT '[]',
  decision_makers TEXT DEFAULT '[]',
  competitors TEXT DEFAULT '[]',
  funding_signals TEXT DEFAULT '[]',
  hiring_signals TEXT DEFAULT '[]',
  recent_news TEXT DEFAULT '[]',
  confidence_score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX company_intel_domain_idx ON company_intel(domain);
CREATE INDEX company_intel_expires_at_idx ON company_intel(expires_at);

CREATE TABLE discovery_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT,
  criteria TEXT NOT NULL DEFAULT '{}',
  result_count INTEGER NOT NULL DEFAULT 0,
  results TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX discovery_searches_user_id_idx ON discovery_searches(user_id);
