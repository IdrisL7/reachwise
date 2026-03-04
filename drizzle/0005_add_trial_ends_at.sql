-- Add trial_ends_at for trial enforcement
ALTER TABLE `users` ADD COLUMN `trial_ends_at` text;
