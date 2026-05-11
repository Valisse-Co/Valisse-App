ALTER TABLE `users` ADD `hasDualRole` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `activeMode` enum('client','nail_tech') DEFAULT 'client' NOT NULL;