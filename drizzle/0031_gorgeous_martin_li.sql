ALTER TABLE `users` ADD `stripeTestConnectedAccountId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeTestConnectedAccountReady` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeTestConnectedAccountId_unique` UNIQUE(`stripeTestConnectedAccountId`);