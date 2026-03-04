-- Auth.js tables
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` text,
	`image` text,
	`password_hash` text,
	`tier_id` text DEFAULT 'starter' NOT NULL,
	`hooks_used_this_month` integer DEFAULT 0 NOT NULL,
	`hooks_reset_at` text DEFAULT (datetime('now')) NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`expires` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_session_token_unique` ON `sessions` (`session_token`);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` text NOT NULL,
	PRIMARY KEY (`identifier`, `token`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_tokens_token_unique` ON `verification_tokens` (`token`);
--> statement-breakpoint

-- Usage events table
CREATE TABLE `usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`),
	`event` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint

-- Add user_id columns to existing tables (nullable for backward compat)
ALTER TABLE `leads` ADD COLUMN `user_id` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `n8n_instances` ADD COLUMN `user_id` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `integrations` ADD COLUMN `user_id` text REFERENCES `users`(`id`);
--> statement-breakpoint
ALTER TABLE `api_keys` ADD COLUMN `user_id` text REFERENCES `users`(`id`);
