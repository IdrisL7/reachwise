DROP INDEX IF EXISTS `leads_email_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `leads_user_email_idx` ON `leads` (`user_id`, `email`);
