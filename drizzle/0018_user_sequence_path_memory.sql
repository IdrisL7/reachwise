CREATE TABLE `user_sequence_path_memory` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_role` text,
	`lead_segment` text,
	`sequence_type` text NOT NULL,
	`from_channel` text,
	`to_channel` text NOT NULL,
	`attempt_count` real DEFAULT 0 NOT NULL,
	`no_reply_count` real DEFAULT 0 NOT NULL,
	`positive_reply_count` real DEFAULT 0 NOT NULL,
	`reply_win_count` real DEFAULT 0 NOT NULL,
	`unsubscribe_count` real DEFAULT 0 NOT NULL,
	`wrong_person_count` real DEFAULT 0 NOT NULL,
	`unreachable_count` real DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sequence_path_memory_unique_idx` ON `user_sequence_path_memory` (`user_id`,`target_role`,`lead_segment`,`sequence_type`,`from_channel`,`to_channel`);
--> statement-breakpoint
CREATE INDEX `user_sequence_path_memory_user_id_idx` ON `user_sequence_path_memory` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_sequence_path_memory_updated_at_idx` ON `user_sequence_path_memory` (`updated_at`);
