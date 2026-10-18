CREATE TABLE `appointment_fee_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`ruleType` enum('cancellation','late_arrival','no_show') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`noticeHours` int NOT NULL DEFAULT 24,
	`gracePeriodMinutes` int NOT NULL DEFAULT 60,
	`thresholdMode` enum('fixed_minutes','percent_of_final_duration') NOT NULL DEFAULT 'fixed_minutes',
	`thresholdValue` int NOT NULL DEFAULT 15,
	`feeType` enum('flat','percent_service_total') NOT NULL DEFAULT 'flat',
	`flatFeeInCents` int NOT NULL DEFAULT 0,
	`feePercentBasisPoints` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_fee_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `appointment_fee_rules_techId_ruleType_unique` UNIQUE(`techId`,`ruleType`)
);
--> statement-breakpoint
CREATE TABLE `booking_fee_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`clientId` int NOT NULL,
	`techId` int NOT NULL,
	`feeType` enum('cancellation','late_arrival','no_show') NOT NULL,
	`status` enum('eligible_pending_tech','voided_arrived','waived','charging','charged','charge_failed','disputed','upheld','refunded') NOT NULL DEFAULT 'eligible_pending_tech',
	`amountInCents` int NOT NULL,
	`policySnapshot` json NOT NULL,
	`eligibleAt` timestamp NOT NULL,
	`eligibilityReason` text,
	`notifiedAt` timestamp,
	`smsNotifiedAt` timestamp,
	`techConfirmedAt` timestamp,
	`techConfirmedBy` int,
	`waivedAt` timestamp,
	`waivedBy` int,
	`chargedAt` timestamp,
	`chargeFailureReason` text,
	`stripePaymentIntentId` varchar(255),
	`payoutEligibleAt` timestamp,
	`payoutStatus` enum('not_ready','pending_dispute_window','on_hold','released','failed') NOT NULL DEFAULT 'not_ready',
	`stripeTransferId` varchar(255),
	`clientDisputedAt` timestamp,
	`clientDisputeReason` text,
	`adminResolvedAt` timestamp,
	`adminResolvedBy` int,
	`adminResolutionNote` text,
	`stripeRefundId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_fee_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_fee_events_stripePaymentIntentId_unique` UNIQUE(`stripePaymentIntentId`),
	CONSTRAINT `booking_fee_events_bookingId_feeType_unique` UNIQUE(`bookingId`,`feeType`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `arrivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `arrivalMethod` enum('client_code');--> statement-breakpoint
ALTER TABLE `bookings` ADD `feePolicyVersion` varchar(1024);--> statement-breakpoint
ALTER TABLE `bookings` ADD `feePolicySnapshot` json;--> statement-breakpoint
ALTER TABLE `bookings` ADD `feePolicyAcknowledgedAt` timestamp;