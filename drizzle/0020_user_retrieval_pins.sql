CREATE TABLE `user_retrieval_pins` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `target_role` text,
  `source_type` text NOT NULL,
  `trigger_type` text,
  `boost` real DEFAULT 1.1 NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_retrieval_pins_unique_idx` ON `user_retrieval_pins` (`user_id`,`target_role`,`source_type`,`trigger_type`);
--> statement-breakpoint
CREATE INDEX `user_retrieval_pins_user_id_idx` ON `user_retrieval_pins` (`user_id`);
--> statement-breakpoint
CREATE INDEX `user_retrieval_pins_updated_at_idx` ON `user_retrieval_pins` (`updated_at`);
