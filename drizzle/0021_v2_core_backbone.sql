CREATE TABLE `accounts_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `company_name` text NOT NULL,
  `domain` text,
  `website` text,
  `linkedin_url` text,
  `status` text DEFAULT 'watching' NOT NULL,
  `priority` text DEFAULT 'normal' NOT NULL,
  `owner_user_id` text,
  `last_signal_at` text,
  `last_message_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE UNIQUE INDEX `accounts_v2_user_domain_idx`
  ON `accounts_v2` (`user_id`,`domain`);

CREATE INDEX `accounts_v2_user_status_idx`
  ON `accounts_v2` (`user_id`,`status`);

CREATE INDEX `accounts_v2_user_updated_idx`
  ON `accounts_v2` (`user_id`,`updated_at`);


CREATE TABLE `signals_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `source_url` text NOT NULL,
  `source_type` text NOT NULL,
  `trigger_type` text,
  `title` text,
  `snippet` text,
  `published_at` text,
  `confidence` real DEFAULT 0.5 NOT NULL,
  `freshness` text DEFAULT 'undated' NOT NULL,
  `evidence_tier` text DEFAULT 'B' NOT NULL,
  `metadata` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `signals_v2_account_created_idx`
  ON `signals_v2` (`account_id`,`created_at`);

CREATE INDEX `signals_v2_account_trigger_idx`
  ON `signals_v2` (`account_id`,`trigger_type`);

CREATE INDEX `signals_v2_account_source_type_idx`
  ON `signals_v2` (`account_id`,`source_type`);


CREATE TABLE `messages_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `signal_id` text,
  `lead_id` text,
  `parent_message_id` text,
  `kind` text NOT NULL,
  `stage` text NOT NULL,
  `channel` text DEFAULT 'email' NOT NULL,
  `subject` text,
  `body` text NOT NULL,
  `tone` text,
  `rationale` text,
  `metadata` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`signal_id`) REFERENCES `signals_v2`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`parent_message_id`) REFERENCES `messages_v2`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `messages_v2_account_created_idx`
  ON `messages_v2` (`account_id`,`created_at`);

CREATE INDEX `messages_v2_account_stage_idx`
  ON `messages_v2` (`account_id`,`stage`);

CREATE INDEX `messages_v2_account_kind_idx`
  ON `messages_v2` (`account_id`,`kind`);

CREATE INDEX `messages_v2_signal_idx`
  ON `messages_v2` (`signal_id`);


CREATE TABLE `outcomes_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL,
  `message_id` text,
  `signal_id` text,
  `event_type` text NOT NULL,
  `metadata` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`message_id`) REFERENCES `messages_v2`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`signal_id`) REFERENCES `signals_v2`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `outcomes_v2_account_created_idx`
  ON `outcomes_v2` (`account_id`,`created_at`);

CREATE INDEX `outcomes_v2_message_event_idx`
  ON `outcomes_v2` (`message_id`,`event_type`);

CREATE INDEX `outcomes_v2_signal_event_idx`
  ON `outcomes_v2` (`signal_id`,`event_type`);


CREATE TABLE `preferences_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `scope` text NOT NULL,
  `key` text NOT NULL,
  `value` real NOT NULL,
  `confidence` real DEFAULT 0.5 NOT NULL,
  `source` text NOT NULL,
  `account_id` text,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `preferences_v2_unique_idx`
  ON `preferences_v2` (`user_id`,`scope`,`key`,`source`,`account_id`);

CREATE INDEX `preferences_v2_user_scope_idx`
  ON `preferences_v2` (`user_id`,`scope`);

CREATE INDEX `preferences_v2_user_updated_idx`
  ON `preferences_v2` (`user_id`,`updated_at`);


CREATE TABLE `events_v2` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `account_id` text,
  `signal_id` text,
  `message_id` text,
  `event_type` text NOT NULL,
  `payload` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`signal_id`) REFERENCES `signals_v2`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`message_id`) REFERENCES `messages_v2`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `events_v2_user_created_idx`
  ON `events_v2` (`user_id`,`created_at`);

CREATE INDEX `events_v2_account_created_idx`
  ON `events_v2` (`account_id`,`created_at`);

CREATE INDEX `events_v2_type_created_idx`
  ON `events_v2` (`event_type`,`created_at`);


CREATE TABLE `account_state_v2` (
  `account_id` text PRIMARY KEY NOT NULL,
  `temperature` text DEFAULT 'cold' NOT NULL,
  `recommended_action` text,
  `latest_signal_summary` text,
  `latest_message_summary` text,
  `next_step` text,
  `last_outcome_type` text,
  `updated_at` text DEFAULT (datetime('now')) NOT NULL,
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE cascade
);


CREATE TABLE `account_contacts_v2` (
  `account_id` text NOT NULL,
  `lead_id` text NOT NULL,
  `role` text,
  `relationship` text DEFAULT 'primary' NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  PRIMARY KEY (`account_id`,`lead_id`),
  FOREIGN KEY (`account_id`) REFERENCES `accounts_v2`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `account_contacts_v2_lead_idx`
  ON `account_contacts_v2` (`lead_id`);
