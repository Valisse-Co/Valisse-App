ALTER TABLE `bookings` MODIFY COLUMN `status` enum('pending','confirmed','in_progress','completed','payment_due','disputed','declined','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `bookings` ADD `appointmentCodeHash` varchar(128);--> statement-breakpoint
ALTER TABLE `bookings` ADD `appointmentCodeVisibleAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `appointmentCodeFailures` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `appointmentCodeLockedUntil` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `startedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `completedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `stripeSetupIntentId` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD `stripePaymentIntentId` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD `stripeTipPaymentIntentId` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD `stripeTransferId` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD `paymentMethodStatus` enum('none','required','saved','failed') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `paymentStatus` enum('unpaid','payment_due','paid','failed','refunded') DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payoutStatus` enum('not_ready','pending_dispute_window','on_hold','released','failed') DEFAULT 'not_ready' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `payoutEligibleAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `paymentCapturedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `issueReportedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `issueReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeConnectedAccountId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeConnectedAccountReady` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeCustomerId_unique` UNIQUE(`stripeCustomerId`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeConnectedAccountId_unique` UNIQUE(`stripeConnectedAccountId`);