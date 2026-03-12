CREATE TABLE `generated_hooks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`company_url` text NOT NULL,
	`company_name` text,
	`hook_text` text NOT NULL,
	`angle` text NOT NULL,
	`confidence` text NOT NULL,
	`evidence_tier` text NOT NULL,
	`quality_score` integer NOT NULL,
	`source_snippet` text,
	`source_url` text,
	`source_title` text,
	`source_date` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generated_hooks_user_id_idx` ON `generated_hooks` (`user_id`);--> statement-breakpoint
CREATE INDEX `generated_hooks_batch_id_idx` ON `generated_hooks` (`batch_id`);--> statement-breakpoint

CREATE TABLE `hook_crm_pushes` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_hook_id` text NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`crm_record_id` text,
	`status` text NOT NULL,
	`error_message` text,
	`pushed_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`generated_hook_id`) REFERENCES `generated_hooks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `hook_crm_pushes_hook_idx` ON `hook_crm_pushes` (`generated_hook_id`);--> statement-breakpoint
CREATE INDEX `hook_crm_pushes_user_id_idx` ON `hook_crm_pushes` (`user_id`);