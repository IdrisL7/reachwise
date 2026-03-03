import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const prospectLeads = sqliteTable("prospect_leads", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email"),
  name: text("name"),
  title: text("title"),
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  linkedinUrl: text("linkedin_url").unique(),
  linkedinHeadline: text("linkedin_headline"),
  source: text("source").notNull().default("prospect-agent"),
  status: text("status", {
    enum: ["new", "dm_queued", "dm_sent", "replied", "converted", "lost"],
  }).notNull().default("new"),
  lastContactedAt: text("last_contacted_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const dmLog = sqliteTable("dm_log", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  leadId: text("lead_id").notNull().references(() => prospectLeads.id),
  dmText: text("dm_text").notNull(),
  status: text("status", {
    enum: ["queued", "approved", "sent", "failed", "rejected"],
  }).notNull().default("queued"),
  error: text("error"),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
