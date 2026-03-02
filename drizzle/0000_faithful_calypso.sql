CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`title` text,
	`company_name` text,
	`company_website` text,
	`linkedin_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`status` text DEFAULT 'cold' NOT NULL,
	`sequence_step` integer DEFAULT 0 NOT NULL,
	`last_contacted_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leads_email_unique` ON `leads` (`email`);--> statement-breakpoint
CREATE TABLE `outbound_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`direction` text NOT NULL,
	`sequence_step` integer NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`sent_at` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
