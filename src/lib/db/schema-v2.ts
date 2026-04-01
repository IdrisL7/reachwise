import { index, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { users, leads } from "@/lib/db/schema";

export const accountsV2 = sqliteTable("accounts_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  domain: text("domain"),
  website: text("website"),
  linkedinUrl: text("linkedin_url"),
  status: text("status", {
    enum: ["watching", "active", "contacted", "archived"],
  }).notNull().default("watching"),
  priority: text("priority", {
    enum: ["low", "normal", "high"],
  }).notNull().default("normal"),
  ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  lastSignalAt: text("last_signal_at"),
  lastMessageAt: text("last_message_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("accounts_v2_user_domain_idx").on(table.userId, table.domain),
  index("accounts_v2_user_status_idx").on(table.userId, table.status),
  index("accounts_v2_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const signalsV2 = sqliteTable("signals_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accountsV2.id, { onDelete: "cascade" }),
  sourceUrl: text("source_url").notNull(),
  sourceType: text("source_type", {
    enum: ["first_party", "trusted_news", "semantic_web", "fallback_web"],
  }).notNull(),
  triggerType: text("trigger_type", {
    enum: ["funding", "hiring", "launch", "partnership", "expansion", "stat", "ipo"],
  }),
  title: text("title"),
  snippet: text("snippet"),
  publishedAt: text("published_at"),
  confidence: real("confidence").notNull().default(0.5),
  freshness: text("freshness", {
    enum: ["fresh", "recent", "stale", "undated"],
  }).notNull().default("undated"),
  evidenceTier: text("evidence_tier", {
    enum: ["A", "B", "C"],
  }).notNull().default("B"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("signals_v2_account_created_idx").on(table.accountId, table.createdAt),
  index("signals_v2_account_trigger_idx").on(table.accountId, table.triggerType),
  index("signals_v2_account_source_type_idx").on(table.accountId, table.sourceType),
]);

export const messagesV2 = sqliteTable("messages_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accountsV2.id, { onDelete: "cascade" }),
  signalId: text("signal_id").references(() => signalsV2.id, { onDelete: "set null" }),
  leadId: text("lead_id").references(() => leads.id, { onDelete: "set null" }),
  parentMessageId: text("parent_message_id"),
  kind: text("kind", {
    enum: ["hook", "draft", "followup"],
  }).notNull(),
  stage: text("stage", {
    enum: ["generated", "approved", "queued", "sent", "rejected"],
  }).notNull(),
  channel: text("channel").notNull().default("email"),
  subject: text("subject"),
  body: text("body").notNull(),
  tone: text("tone"),
  rationale: text("rationale"),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("messages_v2_account_created_idx").on(table.accountId, table.createdAt),
  index("messages_v2_account_stage_idx").on(table.accountId, table.stage),
  index("messages_v2_account_kind_idx").on(table.accountId, table.kind),
  index("messages_v2_signal_idx").on(table.signalId),
]);

export const outcomesV2 = sqliteTable("outcomes_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accountsV2.id, { onDelete: "cascade" }),
  messageId: text("message_id").references(() => messagesV2.id, { onDelete: "set null" }),
  signalId: text("signal_id").references(() => signalsV2.id, { onDelete: "set null" }),
  eventType: text("event_type", {
    enum: [
      "viewed",
      "copied",
      "approved",
      "sent",
      "reply_positive",
      "reply_win",
      "no_reply",
      "bounce",
      "unsubscribe",
    ],
  }).notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("outcomes_v2_account_created_idx").on(table.accountId, table.createdAt),
  index("outcomes_v2_message_event_idx").on(table.messageId, table.eventType),
  index("outcomes_v2_signal_event_idx").on(table.signalId, table.eventType),
]);

export const preferencesV2 = sqliteTable("preferences_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  scope: text("scope", {
    enum: ["global", "trigger", "segment", "account"],
  }).notNull(),
  key: text("key").notNull(),
  value: real("value").notNull(),
  confidence: real("confidence").notNull().default(0.5),
  source: text("source", {
    enum: ["learned", "pinned"],
  }).notNull(),
  accountId: text("account_id").references(() => accountsV2.id, { onDelete: "cascade" }),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  uniqueIndex("preferences_v2_unique_idx").on(
    table.userId,
    table.scope,
    table.key,
    table.source,
    table.accountId,
  ),
  index("preferences_v2_user_scope_idx").on(table.userId, table.scope),
  index("preferences_v2_user_updated_idx").on(table.userId, table.updatedAt),
]);

export const eventsV2 = sqliteTable("events_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => accountsV2.id, { onDelete: "set null" }),
  signalId: text("signal_id").references(() => signalsV2.id, { onDelete: "set null" }),
  messageId: text("message_id").references(() => messagesV2.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  payload: text("payload", { mode: "json" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("events_v2_user_created_idx").on(table.userId, table.createdAt),
  index("events_v2_account_created_idx").on(table.accountId, table.createdAt),
  index("events_v2_type_created_idx").on(table.eventType, table.createdAt),
]);

export const accountStateV2 = sqliteTable("account_state_v2", {
  accountId: text("account_id").primaryKey().references(() => accountsV2.id, { onDelete: "cascade" }),
  temperature: text("temperature", {
    enum: ["cold", "warm", "hot"],
  }).notNull().default("cold"),
  recommendedAction: text("recommended_action"),
  latestSignalSummary: text("latest_signal_summary"),
  latestMessageSummary: text("latest_message_summary"),
  nextStep: text("next_step"),
  lastOutcomeType: text("last_outcome_type"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const accountContactsV2 = sqliteTable("account_contacts_v2", {
  accountId: text("account_id").notNull().references(() => accountsV2.id, { onDelete: "cascade" }),
  leadId: text("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
  role: text("role"),
  relationship: text("relationship", {
    enum: ["primary", "secondary"],
  }).notNull().default("primary"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.leadId] }),
  index("account_contacts_v2_lead_idx").on(table.leadId),
]);

export const accountNotesV2 = sqliteTable("account_notes_v2", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text("account_id").notNull().references(() => accountsV2.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index("account_notes_v2_account_created_idx").on(table.accountId, table.createdAt),
  index("account_notes_v2_user_created_idx").on(table.userId, table.createdAt),
]);
