CREATE TABLE `n8n_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`container_id` text,
	`port` integer NOT NULL,
	`status` text DEFAULT 'provisioning' NOT NULL,
	`webhook_url` text,
	`templates` text DEFAULT '[]',
	`error_message` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `n8n_instances_port_unique` ON `n8n_instances` (`port`);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`instance_url` text,
	`token_expires_at` text,
	`scopes` text,
	`metadata` text,
	`status` text DEFAULT 'active' NOT NULL,
	`last_sync_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`scopes` text DEFAULT '["leads","hooks","followups"]' NOT NULL,
	`last_used_at` text,
	`expires_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);
