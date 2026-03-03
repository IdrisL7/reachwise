CREATE TABLE `dm_log` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`dm_text` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`sent_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `prospect_leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prospect_leads` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text,
	`title` text,
	`company_name` text,
	`company_website` text,
	`linkedin_url` text,
	`linkedin_headline` text,
	`source` text DEFAULT 'prospect-agent' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`last_contacted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prospect_leads_linkedin_url_unique` ON `prospect_leads` (`linkedin_url`);