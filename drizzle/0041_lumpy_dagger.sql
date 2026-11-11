CREATE TABLE `automatic_payout_legs` (
	`id` varchar(36) NOT NULL,
	`mode` enum('live','test') NOT NULL,
	`kind` enum('service','tip','appointment_fee') NOT NULL,
	`bookingId` int NOT NULL,
	`feeEventId` int,
	`techId` int NOT NULL,
	`clientId` int NOT NULL,
	`customerId` varchar(255) NOT NULL,
	`destination` varchar(255) NOT NULL,
	`paymentIntentId` varchar(255) NOT NULL,
	`chargeId` varchar(255) NOT NULL,
	`amountInCents` bigint NOT NULL,
	`originalGrossInCents` bigint NOT NULL,
	`currency` enum('usd') NOT NULL,
	`cutoff` timestamp(3) NOT NULL,
	`state` enum('ready','dispatching','transferred','needs_reconciliation','blocked') NOT NULL DEFAULT 'ready',
	`transferId` varchar(255),
	`firstAttemptAt` timestamp(3),
	`attemptedAt` timestamp(3),
	`leaseToken` varchar(36),
	`leaseUntil` timestamp(3),
	`reason` enum('provider_uncertain','persistence_uncertain','reconciliation_required','reconciliation_not_found','reconciliation_conflict','source_changed','issue_hold','preflight_deferred','provider_rejected'),
	`reasonAt` timestamp(3),
	`transferredAt` timestamp(3),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `automatic_payout_legs_id` PRIMARY KEY(`id`),
	CONSTRAINT `automatic_payout_legs_transferId_unique` UNIQUE(`transferId`),
	CONSTRAINT `automatic_payout_legs_mode_payment_unique` UNIQUE(`mode`,`paymentIntentId`)
);
--> statement-breakpoint
ALTER TABLE `operations_jobs` MODIFY COLUMN `executionMode` enum('observe_only','execute','payouts_only') NOT NULL DEFAULT 'observe_only';--> statement-breakpoint
ALTER TABLE `operations_runs` MODIFY COLUMN `executionMode` enum('observe_only','execute','payouts_only') NOT NULL;--> statement-breakpoint
ALTER TABLE `operations_jobs` ADD `payoutsFrom` timestamp(3);--> statement-breakpoint
ALTER TABLE `operations_jobs` ADD `payoutsApprovedAt` timestamp(3);--> statement-breakpoint
ALTER TABLE `automatic_payout_legs` ADD CONSTRAINT `automatic_payout_legs_bookingId_bookings_id_fk` FOREIGN KEY (`bookingId`) REFERENCES `bookings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `automatic_payout_legs` ADD CONSTRAINT `automatic_payout_legs_feeEventId_booking_fee_events_id_fk` FOREIGN KEY (`feeEventId`) REFERENCES `booking_fee_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `automatic_payout_legs` ADD CONSTRAINT `automatic_payout_legs_techId_users_id_fk` FOREIGN KEY (`techId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `automatic_payout_legs` ADD CONSTRAINT `automatic_payout_legs_clientId_users_id_fk` FOREIGN KEY (`clientId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `automatic_payout_legs_booking_kind_idx` ON `automatic_payout_legs` (`bookingId`,`kind`);--> statement-breakpoint
CREATE INDEX `automatic_payout_legs_state_lease_idx` ON `automatic_payout_legs` (`state`,`leaseUntil`);