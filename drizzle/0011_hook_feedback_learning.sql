ALTER TABLE `generated_hooks` ADD COLUMN `buyer_tension_id` text;
--> statement-breakpoint
ALTER TABLE `generated_hooks` ADD COLUMN `structural_variant` text;
--> statement-breakpoint
ALTER TABLE `generated_hooks` ADD COLUMN `target_role` text;
--> statement-breakpoint
ALTER TABLE `generated_hooks` ADD COLUMN `selector_score` real;
--> statement-breakpoint
ALTER TABLE `generated_hooks` ADD COLUMN `ranking_score` real;
--> statement-breakpoint
ALTER TABLE `generated_hooks` ADD COLUMN `role_fit_score` real;
--> statement-breakpoint
ALTER TABLE `generated_hooks` ADD COLUMN `non_overlap_score` real;
--> statement-breakpoint
CREATE INDEX `generated_hooks_company_url_idx` ON `generated_hooks` (`company_url`);
--> statement-breakpoint

CREATE TABLE `hook_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_hook_id` text NOT NULL,
	`user_id` text NOT NULL,
	`event` text NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`generated_hook_id`) REFERENCES `generated_hooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hook_outcomes_hook_idx` ON `hook_outcomes` (`generated_hook_id`);
--> statement-breakpoint
CREATE INDEX `hook_outcomes_user_id_idx` ON `hook_outcomes` (`user_id`);
--> statement-breakpoint
CREATE INDEX `hook_outcomes_event_idx` ON `hook_outcomes` (`event`);
--> statement-breakpoint

CREATE TABLE `buyer_tension_outcomes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`buyer_tension_id` text,
	`target_role` text,
	`trigger_type` text,
	`angle` text,
	`structural_variant` text,
	`impressions` integer DEFAULT 0 NOT NULL,
	`copies` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`emails_used` integer DEFAULT 0 NOT NULL,
	`reply_wins` integer DEFAULT 0 NOT NULL,
	`positive_replies` integer DEFAULT 0 NOT NULL,
	`last_event_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `buyer_tension_outcomes_unique_idx` ON `buyer_tension_outcomes` (`user_id`,`buyer_tension_id`,`target_role`,`trigger_type`,`angle`,`structural_variant`);
--> statement-breakpoint
CREATE INDEX `buyer_tension_outcomes_user_id_idx` ON `buyer_tension_outcomes` (`user_id`);
