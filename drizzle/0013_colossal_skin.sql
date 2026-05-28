CREATE TABLE `cancellation_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`windowHours` int NOT NULL DEFAULT 24,
	`feeType` enum('flat','percent') NOT NULL DEFAULT 'flat',
	`feeAmount` float NOT NULL DEFAULT 0,
	`gracePeriodHours` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cancellation_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `cancellation_policies_techId_unique` UNIQUE(`techId`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancelledBy` enum('client','tech');--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancellationFeeStatus` enum('none','pending','waived','charged') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancellationFeeAmount` float;