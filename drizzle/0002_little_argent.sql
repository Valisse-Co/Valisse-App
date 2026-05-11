CREATE TABLE `schedule_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`blockDate` timestamp NOT NULL,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8) NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schedule_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `availability` ADD `breakStart` varchar(8);--> statement-breakpoint
ALTER TABLE `availability` ADD `breakEnd` varchar(8);