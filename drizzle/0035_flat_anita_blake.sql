CREATE TABLE `calendar_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`kind` enum('available','unavailable') NOT NULL,
	`recurrence` enum('once','weekly') NOT NULL,
	`localDate` varchar(10),
	`dayOfWeek` int,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`clientTier` enum('open','returning_only') NOT NULL DEFAULT 'open',
	`title` varchar(160),
	`timeZone` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `calendar_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancellationReason` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `calendarOverrideEventId` int;