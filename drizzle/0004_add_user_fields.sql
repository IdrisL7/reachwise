-- Add password_changed_at for session invalidation after password reset
ALTER TABLE `users` ADD COLUMN `password_changed_at` text;
--> statement-breakpoint
-- Add unsubscribed_at for email unsubscribe preference
ALTER TABLE `users` ADD COLUMN `unsubscribed_at` text;
--> statement-breakpoint
-- Performance indexes
CREATE INDEX IF NOT EXISTS `idx_leads_user_id` ON `leads` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_usage_events_user_id` ON `usage_events` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_usage_events_user_created` ON `usage_events` (`user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_outbound_messages_lead_id` ON `outbound_messages` (`lead_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_outbound_messages_status` ON `outbound_messages` (`lead_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_verification_tokens_identifier` ON `verification_tokens` (`identifier`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_api_keys_user_id` ON `api_keys` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_integrations_user_id` ON `integrations` (`user_id`);
