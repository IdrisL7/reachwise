CREATE TABLE `user_retrieval_memory` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `target_role` text,
  `source_type` text NOT NULL,
  `trigger_type` text,
  `view_count` real DEFAULT 0 NOT NULL,
  `engagement_count` real DEFAULT 0 NOT NULL,
  `email_use_count` real DEFAULT 0 NOT NULL,
  `win_count` real DEFAULT 0 NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `user_retrieval_memory_unique_idx`
  ON `user_retrieval_memory` (`user_id`,`target_role`,`source_type`,`trigger_type`);

CREATE INDEX `user_retrieval_memory_user_id_idx`
  ON `user_retrieval_memory` (`user_id`);

CREATE INDEX `user_retrieval_memory_updated_at_idx`
  ON `user_retrieval_memory` (`updated_at`);
