# GetSignalHooks Outreach Pipeline

5-stage LinkedIn -> enrichment -> validation -> draft -> send workflow.

## Env vars

Required:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN` (if needed by Turso)
- `TAVILY_API_KEY`
- `HUNTER_API_KEY`
- `ANTHROPIC_API_KEY`
- `SENDGRID_API_KEY` (stage 5)

Optional:

- `SENDGRID_FROM_EMAIL` (default: `hello@getsignalhooks.com`)
- `SENDGRID_FROM_NAME` (default: `Idris from GetSignalHooks`)
- `SENDGRID_WEBHOOK_TOKEN` (protect webhook)
- `OUTREACH_LLM_MODEL` (default `claude-3-5-sonnet-latest`)

## Stage 1-4 runner

```bash
node scripts/outreach/pipeline-runner.mjs --csv ./leads.csv --limit 100
```

What it does:
1. Imports CSV into `outreach_leads` with status `imported`
2. Enriches each company via Tavily and stores JSON in `company_research` (`enriched`)
3. Finds email via Hunter (confidence > 70) and updates status (`email_found`/`email_not_found`)
4. Drafts personalized email subject/body via Anthropic (`email_drafted`)

## Human review

Review drafts in DB and set `reviewed = 1` for rows you approve.

## Stage 5 sender

```bash
node scripts/outreach/send-queue.mjs --max-daily 50 --limit 20
```

Behavior:
- Sends only rows with `status='email_drafted'`, `reviewed=1`, `sent_at IS NULL`
- Max 50/day (configurable)
- 60-90 second randomized delay between sends
- SendGrid click/open tracking enabled
- Adds `lead_id` in `customArgs`

## SendGrid webhook

- Endpoint: `POST /api/outreach/sendgrid-webhook`
- Optionally require header: `x-outreach-webhook-token: $SENDGRID_WEBHOOK_TOKEN`
- Updates `opened_at`, `clicked_at`, `replied`, `bounced` on `outreach_leads`

## CSV import endpoint

- Endpoint: `POST /api/outreach/import`
- Multipart form field: `file` (CSV)
- Required columns:
  - `first_name`, `last_name`, `full_name`, `title`, `company_name`, `company_website`, `linkedin_url`, `location`, `industry`, `employee_count`
- Dedupes by `linkedin_url` OR `company_website`
