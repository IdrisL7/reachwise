CREATE TABLE `account_notes_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `user_id` text NOT NULL,
  `body` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `account_notes_v2_account_created_idx`
  ON `account_notes_v2` (`account_id`,`created_at`);

CREATE INDEX `account_notes_v2_user_created_idx`
  ON `account_notes_v2` (`user_id`,`created_at`);
