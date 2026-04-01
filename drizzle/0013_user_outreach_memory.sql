CREATE TABLE `user_outreach_memory` (
	`user_id` text PRIMARY KEY NOT NULL,
	`short_count` real DEFAULT 0 NOT NULL,
	`medium_count` real DEFAULT 0 NOT NULL,
	`long_count` real DEFAULT 0 NOT NULL,
	`direct_count` real DEFAULT 0 NOT NULL,
	`conversational_count` real DEFAULT 0 NOT NULL,
	`formal_count` real DEFAULT 0 NOT NULL,
	`operator_count` real DEFAULT 0 NOT NULL,
	`email_count` real DEFAULT 0 NOT NULL,
	`linkedin_connection_count` real DEFAULT 0 NOT NULL,
	`linkedin_message_count` real DEFAULT 0 NOT NULL,
	`cold_call_count` real DEFAULT 0 NOT NULL,
	`video_script_count` real DEFAULT 0 NOT NULL,
	`concise_tone_count` real DEFAULT 0 NOT NULL,
	`warm_tone_count` real DEFAULT 0 NOT NULL,
	`direct_tone_count` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `user_outreach_memory_updated_at_idx` ON `user_outreach_memory` (`updated_at`);
