import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const leads = sqliteTable("leads", {
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
});
