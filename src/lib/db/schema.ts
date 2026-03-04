import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
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
  email: text("email").notNull().unique(),
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
  index("leads_user_id_idx").on(table.userId),
  index("leads_status_idx").on(table.status),
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
]);

// ── Caching & rate limiting ──

export const hookCache = sqliteTable("hook_cache", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  urlHash: text("url_hash").notNull().unique(),
  url: text("url").notNull(),
  hooks: text("hooks", { mode: "json" }).notNull(),
  citations: text("citations", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  expiresAt: text("expires_at").notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull().unique(),
  count: integer("count").notNull().default(1),
  resetAt: text("reset_at").notNull(),
});
