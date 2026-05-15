CREATE TABLE `booking_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`dayOfWeek` int,
	`specificDate` timestamp,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8) NOT NULL,
	`clientTier` enum('open','returning_only') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `availability` ADD `clientTier` enum('open','returning_only') DEFAULT 'open' NOT NULL;