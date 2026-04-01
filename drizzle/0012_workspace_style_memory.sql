CREATE TABLE `workspace_style_memory` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`short_count` real DEFAULT 0 NOT NULL,
	`medium_count` real DEFAULT 0 NOT NULL,
	`long_count` real DEFAULT 0 NOT NULL,
	`direct_count` real DEFAULT 0 NOT NULL,
	`conversational_count` real DEFAULT 0 NOT NULL,
	`formal_count` real DEFAULT 0 NOT NULL,
	`operator_count` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_style_memory_user_id_idx` ON `workspace_style_memory` (`user_id`);
