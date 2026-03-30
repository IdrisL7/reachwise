import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { TierId } from "@/lib/tiers";

// ── Auth tables (Auth.js / NextAuth) ──

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: text("email_verified"),
  image: text("image"),
  passwordHash: text("password_hash"), // for credentials auth
  tierId: text("tier_id").$type<TierId>().notNull().default("starter"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  hooksUsedThisMonth: integer("hooks_used_this_month").notNull().default(0),
  hooksResetAt: text("hooks_reset_at").notNull().default(sql`(datetime('now'))`),
  trialEndsAt: text("trial_ends_at"),
  passwordChangedAt: text("password_changed_at"),
  unsubscribedAt: text("unsubscribed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionToken: text("session_token").notNull().unique(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: text("expires").notNull(),
});

export const verificationTokens = sqliteTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull().unique(),
  expires: text("expires").notNull(),
}, (table) => [
  primaryKey({ columns: [table.identifier, table.token] }),
]);

// ── Usage tracking ──

export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  event: text("event", {
    enum: ["hook_generated", "email_generated", "email_sent", "email_opened", "email_clicked", "email_replied", "email_bounced", "lead_created", "followup_generated"],
  }).notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("usage_events_user_id_idx").on(table.userId),
]);

// ── Business tables ──

export const leads = sqliteTable("leads", {
  userId: text("user_id").references(() => users.id), // null = legacy/unassigned
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  name: text("name"),
  title: text("title"),
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  linkedinUrl: text("linkedin_url"),
  source: text("source").notNull().default("manual"),
  status: text("status", {
    enum: ["cold", "in_conversation", "won", "lost", "unreachable"],
  }).notNull().default("cold"),
  sequenceStep: integer("sequence_step").notNull().default(0),
  lastContactedAt: text("last_contacted_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("leads_user_email_idx").on(table.userId, table.email),
  index("leads_user_id_idx").on(table.userId),
  index("leads_status_idx").on(table.status),
  index("leads_created_at_idx").on(table.createdAt),
]);

export const claimLocks = sqliteTable("claim_locks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: text("lead_id").notNull().unique().references(() => leads.id),
  runId: text("run_id").notNull(),
  lockedAt: text("locked_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  leadId: text("lead_id").references(() => leads.id),
  event: text("event").notNull(),
  reason: text("reason"),
  runId: text("run_id"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const n8nInstances = sqliteTable("n8n_instances", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  containerId: text("container_id"),
  port: integer("port").notNull().unique(),
  status: text("status", {
    enum: ["provisioning", "running", "stopped", "error", "removed"],
  }).notNull().default("provisioning"),
  webhookUrl: text("webhook_url"),
  templates: text("templates", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  provider: text("provider", { enum: ["hubspot", "salesforce"] }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  instanceUrl: text("instance_url"), // Salesforce instance URL
  tokenExpiresAt: text("token_expires_at"),
  scopes: text("scopes"),
  metadata: text("metadata", { mode: "json" }), // provider-specific data (hub_id, org_id, etc.)
  status: text("status", { enum: ["active", "disconnected", "error"] }).notNull().default("active"),
  lastSyncAt: text("last_sync_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(), // first 8 chars for display (gsh_xxxx...)
  scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull().default(sql`'["leads","hooks","followups"]'`),
  lastUsedAt: text("last_used_at"),
  expiresAt: text("expires_at"),
  revokedAt: text("revoked_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const outboundMessages = sqliteTable("outbound_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: text("lead_id").notNull().references(() => leads.id),
  direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
  sequenceStep: integer("sequence_step").notNull(),
  channel: text("channel").notNull().default("email"),
  subject: text("subject"),
  body: text("body").notNull(),
  sentAt: text("sent_at"),
  status: text("status", {
    enum: ["draft", "queued", "sent", "failed"],
  }).notNull().default("draft"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("outbound_messages_lead_id_idx").on(table.leadId),
  index("outbound_messages_status_idx").on(table.status),
]);

// ── Caching & rate limiting ──

export const hookCache = sqliteTable("hook_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  urlHash: text("url_hash").notNull().unique(),
  url: text("url").notNull(),
  hooks: text("hooks", { mode: "json" }).notNull(),
  citations: text("citations", { mode: "json" }),
  variants: text("variants", { mode: "json" }),
  rulesVersion: integer("rules_version"),
  profileUpdatedAt: text("profile_updated_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("hook_cache_expires_at_idx").on(table.expiresAt),
]);

export const generatedHooks = sqliteTable("generated_hooks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  batchId: text("batch_id").notNull(),
  companyUrl: text("company_url").notNull(),
  companyName: text("company_name"),
  hookText: text("hook_text").notNull(),
  angle: text("angle", { enum: ["trigger", "risk", "tradeoff"] }).notNull(),
  confidence: text("confidence", { enum: ["high", "med", "low"] }).notNull(),
  evidenceTier: text("evidence_tier", { enum: ["A", "B", "C"] }).notNull(),
  qualityScore: integer("quality_score").notNull(),
  sourceSnippet: text("source_snippet"),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  sourceDate: text("source_date"),
  triggerType: text("trigger_type"),
  promise: text("promise"),
  bridgeQuality: text("bridge_quality"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("generated_hooks_user_id_idx").on(table.userId),
  index("generated_hooks_batch_id_idx").on(table.batchId),
]);

export const hookCrmPushes = sqliteTable("hook_crm_pushes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  generatedHookId: text("generated_hook_id").notNull().references(() => generatedHooks.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider", { enum: ["hubspot", "salesforce"] }).notNull(),
  crmRecordId: text("crm_record_id"),
  status: text("status", { enum: ["success", "failed"] }).notNull(),
  errorMessage: text("error_message"),
  pushedAt: text("pushed_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("hook_crm_pushes_hook_idx").on(table.generatedHookId),
  index("hook_crm_pushes_user_id_idx").on(table.userId),
]);

// ── Workspaces ──

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text("owner_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("My Workspace"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const workspaceProfiles = sqliteTable("workspace_profiles", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  whatYouSell: text("what_you_sell").notNull(),
  icpIndustry: text("icp_industry").notNull(),
  icpCompanySize: text("icp_company_size").notNull(),
  buyerRoles: text("buyer_roles", { mode: "json" }).$type<string[]>().notNull(),
  primaryOutcome: text("primary_outcome").notNull(),
  offerCategory: text("offer_category").notNull(),
  proof: text("proof", { mode: "json" }).$type<string[]>(),
  voiceTone: text("voice_tone"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(1),
  resetAt: text("reset_at").notNull(),
}, (table) => [
  index("rate_limits_reset_at_idx").on(table.resetAt),
]);

export const stripeEvents = sqliteTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: text("processed_at").notNull().default(sql`(datetime('now'))`),
});

export const companyIntel = sqliteTable("company_intel", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  domain: text("domain").notNull().unique(),
  url: text("url").notNull(),
  companyName: text("company_name"),
  industry: text("industry"),
  subIndustry: text("sub_industry"),
  employeeRange: text("employee_range"),
  hqLocation: text("hq_location"),
  foundedYear: integer("founded_year"),
  description: text("description"),
  techStack: text("tech_stack", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
  techStackSources: text("tech_stack_sources", { mode: "json" }).$type<Array<{ tech: string; source: string; evidence: string }>>().default(sql`'[]'`),
  decisionMakers: text("decision_makers", { mode: "json" }).$type<Array<{ title: string; department: string }>>().default(sql`'[]'`),
  competitors: text("competitors", { mode: "json" }).$type<Array<{ name: string; domain: string }>>().default(sql`'[]'`),
  fundingSignals: text("funding_signals", { mode: "json" }).$type<Array<{ summary: string; date: string; sourceUrl: string }>>().default(sql`'[]'`),
  hiringSignals: text("hiring_signals", { mode: "json" }).$type<Array<{ summary: string; roles: string[]; sourceUrl: string }>>().default(sql`'[]'`),
  recentNews: text("recent_news", { mode: "json" }).$type<Array<{ headline: string; date: string; sourceUrl: string }>>().default(sql`'[]'`),
  confidenceScore: real("confidence_score"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("company_intel_domain_idx").on(table.domain),
  index("company_intel_expires_at_idx").on(table.expiresAt),
]);

export const discoverySearches = sqliteTable("discovery_searches", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name"),
  criteria: text("criteria", { mode: "json" }).notNull(),
  resultCount: integer("result_count").notNull().default(0),
  results: text("results", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("discovery_searches_user_id_idx").on(table.userId),
]);

// ── Sequence types ──

export type SequenceStep = {
  order: number;
  channel: "email" | "linkedin_connection" | "linkedin_message" | "cold_call" | "video_script";
  delayDays: number;
  type: "first" | "bump" | "breakup";
  tone?: "concise" | "warm" | "direct";
};

// ── Sequences ──

export const sequences = sqliteTable("sequences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  steps: text("steps", { mode: "json" }).$type<SequenceStep[]>().notNull(),
  isDefault: integer("is_default").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("sequences_user_id_idx").on(table.userId),
]);

export const leadSequences = sqliteTable("lead_sequences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: text("lead_id").notNull().references(() => leads.id),
  sequenceId: text("sequence_id").notNull().references(() => sequences.id),
  currentStep: integer("current_step").notNull().default(0),
  status: text("status", {
    enum: ["active", "paused", "completed"],
  }).notNull().default("active"),
  approvalMode: integer("approval_mode").notNull().default(0),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  pausedAt: text("paused_at"),
  resumeAt: text("resume_at"),
  completedAt: text("completed_at"),
}, (table) => [
  index("lead_sequences_lead_id_idx").on(table.leadId),
  index("lead_sequences_sequence_id_idx").on(table.sequenceId),
  index("lead_sequences_status_idx").on(table.status),
]);

// ── Intent scoring tables ──

export const intentSignals = sqliteTable("intent_signals", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: text("lead_id").references(() => leads.id),
  companyUrl: text("company_url").notNull(),
  signalType: text("signal_type", {
    enum: ["hiring", "funding", "tech_change", "growth", "news"],
  }).notNull(),
  summary: text("summary").notNull(),
  confidence: real("confidence").notNull(),
  sourceUrl: text("source_url"),
  rawEvidence: text("raw_evidence"),
  detectedAt: text("detected_at").notNull(),
  scoreContribution: integer("score_contribution").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
}, (table) => [
  index("intent_signals_lead_id_idx").on(table.leadId),
  index("intent_signals_company_url_idx").on(table.companyUrl),
  index("intent_signals_expires_at_idx").on(table.expiresAt),
]);

export const leadScores = sqliteTable("lead_scores", {
  leadId: text("lead_id").primaryKey().references(() => leads.id),
  score: integer("score").notNull().default(0),
  temperature: text("temperature", {
    enum: ["hot", "warm", "cold"],
  }).notNull().default("cold"),
  signalsCount: integer("signals_count").notNull().default(0),
  lastScoredAt: text("last_scored_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("lead_scores_score_idx").on(table.score),
  index("lead_scores_temperature_idx").on(table.temperature),
]);

// ── Watchlist ──

export const watchlist = sqliteTable("watchlist", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  domain: text("domain").notNull(),
  addedAt: text("added_at").notNull().default(sql`(datetime('now'))`),
  lastCheckedAt: text("last_checked_at"),
  lastSignalAt: text("last_signal_at"),
  lastSignalType: text("last_signal_type"),
}, (table) => [
  index("watchlist_user_id_idx").on(table.userId),
]);

// ── Drafts (watchlist-generated hooks pending approval) ──

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  domain: text("domain"),
  hookText: text("hook_text").notNull(),
  source: text("source", { enum: ["manual", "watchlist"] }).notNull().default("manual"),
  watchlistId: text("watchlist_id").references(() => watchlist.id, { onDelete: "set null" }),
  approved: integer("approved"), // null = pending, 1 = approved, 0 = rejected
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("drafts_user_id_idx").on(table.userId),
  index("drafts_approved_idx").on(table.approved),
]);

// ── Notifications ──

// ── Demo email capture ──

export const demoSignups = sqliteTable("demo_signups", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  source: text("source").notNull().default("demo_gate"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("demo_signups_email_idx").on(table.email),
]);

// ── Shared hooks (public) ──

export const sharedHooks = sqliteTable("shared_hooks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  hookText: text("hook_text").notNull(),
  sourceTitle: text("source_title"),
  sourceUrl: text("source_url"),
  sourceSnippet: text("source_snippet"),
  evidenceTier: text("evidence_tier"),
  triggerType: text("trigger_type"),
  promise: text("promise"),
  bridgeQuality: text("bridge_quality"),
  angle: text("angle"),
  targetCompanyName: text("target_company_name"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// ── User templates ──

export const userTemplates = sqliteTable("user_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  signal: text("signal").notNull(),
  trigger: text("trigger").notNull(),
  hook: text("hook").notNull(),
  promise: text("promise"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("user_templates_user_id_idx").on(table.userId),
]);

// ── Notifications ──

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  type: text("type", {
    enum: ["draft_pending", "sequence_completed", "lead_replied", "auto_paused"],
  }).notNull(),
  title: text("title").notNull(),
  body: text("body"),
  leadId: text("lead_id").references(() => leads.id),
  messageId: text("message_id").references(() => outboundMessages.id),
  read: integer("read").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("notifications_user_id_idx").on(table.userId),
  index("notifications_read_idx").on(table.read),
]);
