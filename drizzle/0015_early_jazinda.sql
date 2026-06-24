ALTER TABLE `posts` ADD `colors` json DEFAULT ('[]') NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `serviceId` int;