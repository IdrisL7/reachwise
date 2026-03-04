# GetSignalHooks

Evidence-first hooks and follow-up emails from any company URL. A SaaS platform that generates research-backed outbound sales hooks using AI, with CRM integrations, automated follow-up sequences, and per-customer workflow automation.

**Live at:** https://www.getsignalhooks.com

## Tech Stack

- **Framework:** Next.js 16.1.6 (App Router, Turbopack)
- **Language:** TypeScript
- **Database:** Turso (LibSQL/SQLite) via Drizzle ORM
- **Auth:** Auth.js v5 (NextAuth) with credentials provider, JWT sessions
- **Payments:** Stripe (Checkout, Customer Portal, Webhooks)
- **Email:** SendGrid with event webhook tracking
- **AI:** Anthropic Claude API (hook generation, email writing)
- **Search:** Brave Search API (company research)
- **Styling:** Tailwind CSS v4
- **Deployment:** Vercel (primary), Docker + Caddy (VPS option)

## Architecture

```
src/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── login/                      # Auth - sign in
│   ├── register/                   # Auth - sign up (with Stripe trial redirect)
│   ├── setup/                      # 5-step onboarding wizard
│   ├── docs/                       # API documentation
│   ├── contact/                    # Sales contact form
│   ├── followup-engine/            # Feature page
│   ├── app/                        # Authenticated dashboard
│   │   ├── page.tsx                # Dashboard (stats, quick actions)
│   │   ├── hooks/                  # Hook generator UI
│   │   ├── leads/                  # Lead management + CSV upload
│   │   ├── analytics/              # Usage analytics
│   │   └── settings/               # API keys, integrations, billing
│   ├── internal/                   # Internal admin tools
│   └── api/                        # 31 API route handlers
├── components/                     # 12 UI components
└── lib/
    ├── auth.ts                     # NextAuth configuration
    ├── stripe.ts                   # Stripe client + helpers
    ├── tiers.ts                    # Pricing tier definitions
    ├── tier-guard.ts               # Usage quota enforcement
    ├── rate-limit.ts               # Sliding window rate limiter
    ├── hooks.ts                    # Hook generation logic
    ├── db/                         # Drizzle schema + client
    ├── followup/                   # Follow-up engine (generate, sequences)
    ├── integrations/               # HubSpot + Salesforce OAuth & sync
    ├── n8n/                        # Docker container management
    ├── email/                      # SendGrid integration
    └── prospect-agent/             # LinkedIn DM automation
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | User accounts with tier, Stripe IDs, usage tracking |
| `accounts` | OAuth provider accounts (Auth.js) |
| `sessions` | Active sessions (Auth.js) |
| `verification_tokens` | Email verification tokens |
| `leads` | Sales leads with status and sequence tracking |
| `outbound_messages` | Sent/queued emails with delivery status |
| `audit_log` | Event audit trail |
| `usage_events` | User activity tracking (hooks, emails, opens, clicks) |
| `integrations` | CRM connections (HubSpot, Salesforce) |
| `n8n_instances` | Per-customer n8n workflow containers |
| `api_keys` | Self-serve API keys (SHA-256 hashed, `gsh_` prefix) |
| `claim_locks` | Distributed locks for concurrent processing |

## API Routes

### Hook & Email Generation
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/generate-hooks` | POST | Generate hooks from company URL/name |
| `/api/generate-hooks-batch` | POST | Batch hook generation (up to 75 URLs) |
| `/api/generate-followup` | POST | Generate follow-up email with angle rotation |
| `/api/generate-email` | POST | Generate email from company URL |

### Lead Management
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/leads` | POST, GET | Create/list leads |
| `/api/leads/[id]` | GET | Get lead details |
| `/api/leads/[id]/messages` | POST | Log messages for a lead |
| `/api/leads/send-followup` | POST | Send scheduled follow-up |

### Follow-Up Engine
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/followup/due` | GET | Get leads due for follow-up |
| `/api/followups/audit` | POST | Log audit event |
| `/api/followups/claim` | POST | Claim lead for processing |
| `/api/followups/pause` | POST | Pause follow-ups |
| `/api/followups/safety-check` | POST | Pre-send safety check |

### CRM Integrations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/integrations/hubspot` | GET | HubSpot connection status |
| `/api/integrations/hubspot/callback` | GET | OAuth callback |
| `/api/integrations/hubspot/sync` | POST | Trigger bidirectional sync |
| `/api/integrations/salesforce` | GET | Salesforce connection status |
| `/api/integrations/salesforce/callback` | GET | OAuth callback |
| `/api/integrations/salesforce/sync` | POST | Trigger bidirectional sync |

### Billing & Auth
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stripe/checkout` | POST | Create Stripe Checkout session |
| `/api/stripe/portal` | POST | Open Stripe Customer Portal |
| `/api/webhooks/stripe` | POST | Stripe event webhook handler |
| `/api/webhooks/sendgrid` | POST | SendGrid event webhook handler |
| `/api/auth/register` | POST | User registration |
| `/api/auth/[...nextauth]` | * | NextAuth session routes |
| `/api/api-keys` | POST, GET, DELETE | API key management |

### Workflows & Prospect Agent
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/n8n-instances` | POST, GET, PATCH | n8n container management |
| `/api/n8n-templates` | GET | List workflow templates |
| `/api/prospect-agent/search` | POST | Prospect search via Brave |
| `/api/prospect-agent/send-dms` | POST | Generate LinkedIn DMs |
| `/api/prospect-agent/dm-log` | GET | DM activity log |

## Pricing Tiers

| Tier | Price | Hooks/Month | Batch Size | Key Features |
|------|-------|-------------|------------|--------------|
| Starter | £29 | 200 | 10 | Evidence-first hooks, 7-day free trial |
| Pro | £149 | 750 | 75 | + Follow-Up Engine, n8n templates |
| Concierge | £499 | 10,000 | 75 | + Done-for-you setup, priority support |

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm

### Local Development

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp deploy/.env.example .env.local
# Fill in your API keys (see Environment Variables below)

# Run development server
pnpm dev
```

Open http://localhost:3000

### Environment Variables

**Required:**
| Variable | Description |
|----------|-------------|
| `TURSO_DATABASE_URL` | Turso database URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `CLAUDE_API_KEY` | Anthropic API key for hook/email generation |
| `BRAVE_API_KEY` | Brave Search API key for company research |
| `AUTH_SECRET` | Auth.js secret (generate: `openssl rand -base64 32`) |
| `AUTH_URL` | App URL (e.g. `http://localhost:3000`) |
| `FOLLOWUP_ENGINE_API_TOKEN` | Internal API auth token |
| `SENDGRID_API_KEY` | SendGrid API key for email sending |
| `SENDGRID_FROM_EMAIL` | Verified sender email address |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_STARTER` | Stripe Price ID for Starter tier |
| `STRIPE_PRICE_PRO` | Stripe Price ID for Pro tier |
| `STRIPE_PRICE_CONCIERGE` | Stripe Price ID for Concierge tier |

**Optional (CRM integrations):**
| Variable | Description |
|----------|-------------|
| `HUBSPOT_CLIENT_ID` | HubSpot OAuth app client ID |
| `HUBSPOT_CLIENT_SECRET` | HubSpot OAuth app client secret |
| `SALESFORCE_CLIENT_ID` | Salesforce Connected App client ID |
| `SALESFORCE_CLIENT_SECRET` | Salesforce Connected App client secret |

**Optional (Prospect Agent):**
| Variable | Description |
|----------|-------------|
| `TURSO_PROSPECT_DATABASE_URL` | Separate Turso DB for prospect agent |
| `TURSO_PROSPECT_AUTH_TOKEN` | Prospect DB auth token |

**Optional (VPS/Docker deployment):**
| Variable | Description |
|----------|-------------|
| `N8N_DOCKER_IMAGE` | n8n Docker image (default: `n8nio/n8n:latest`) |
| `N8N_PORT_START` / `N8N_PORT_END` | Port range for n8n containers |
| `N8N_DOCKER_NETWORK` | Docker network name |
| `APP_DOMAIN` / `N8N_DOMAIN` | Domain names for Caddy |
| `CADDY_ADMIN_URL` | Caddy admin API URL |

### Database Migrations

Migrations are in `drizzle/`. Run them against your Turso database:

```bash
# Using Turso CLI
turso db shell <your-db-name> < drizzle/0000_faithful_calypso.sql
turso db shell <your-db-name> < drizzle/0001_add_api_keys.sql
turso db shell <your-db-name> < drizzle/0002_add_users_and_usage.sql
turso db shell <your-db-name> < drizzle/0003_add_stripe_fields.sql
```

Or paste each file's contents into the Turso dashboard shell (remove `--> statement-breakpoint` lines).

## Deployment

### Vercel (Primary)

The app is deployed to Vercel at https://www.getsignalhooks.com.

```bash
# Deploy
vercel --yes --prod
```

Add all environment variables in Vercel project settings before deploying.

### Docker / VPS

For self-hosted deployment with n8n container management:

```bash
# One-command VPS setup
scp deploy/setup-vps.sh user@your-server:~/
ssh user@your-server 'chmod +x setup-vps.sh && ./setup-vps.sh'
```

Or manually:
```bash
docker compose up -d
```

This runs the Next.js app + Caddy reverse proxy with automatic SSL.

## Stripe Setup

1. Create 3 products in Stripe Dashboard (Starter £29, Pro £149, Concierge £499) as monthly recurring
2. Copy Price IDs to `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_CONCIERGE`
3. Create webhook endpoint at `https://your-domain.com/api/webhooks/stripe`
4. Subscribe to events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copy webhook signing secret to `STRIPE_WEBHOOK_SECRET`

## SendGrid Setup

1. Create SendGrid account and API key
2. Verify sender domain with DNS records (CNAME + TXT for DKIM/DMARC)
3. Set `SENDGRID_API_KEY` and `SENDGRID_FROM_EMAIL`

## Key Features

- **Evidence-First Hooks**: AI generates hooks anchored on real public signals (earnings, hiring, tech changes) with evidence tier classification (A/B/C) and source citations
- **Follow-Up Engine**: Automated multi-step email sequences with angle rotation to avoid repetition
- **CRM Sync**: Bidirectional sync with HubSpot and Salesforce (OAuth, auto-refresh tokens)
- **Per-Customer n8n**: Isolated Docker containers for workflow automation per user
- **Tier-Based Access**: Monthly quota enforcement with automatic reset
- **API Key System**: Self-serve `gsh_` prefixed keys with SHA-256 hashing and scope control
- **Rate Limiting**: In-memory sliding window with different limits per endpoint and auth status
- **Email Analytics**: SendGrid webhook tracking for opens, clicks, bounces, and replies
