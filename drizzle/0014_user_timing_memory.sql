CREATE TABLE `user_timing_memory` (
	`user_id` text PRIMARY KEY NOT NULL,
	`fresh_signal_count` real DEFAULT 0 NOT NULL,
	`recent_signal_count` real DEFAULT 0 NOT NULL,
	`stale_signal_count` real DEFAULT 0 NOT NULL,
	`undated_signal_count` real DEFAULT 0 NOT NULL,
	`weekday_morning_count` real DEFAULT 0 NOT NULL,
	`weekday_afternoon_count` real DEFAULT 0 NOT NULL,
	`weekday_evening_count` real DEFAULT 0 NOT NULL,
	`weekend_count` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX `user_timing_memory_updated_at_idx` ON `user_timing_memory` (`updated_at`);
