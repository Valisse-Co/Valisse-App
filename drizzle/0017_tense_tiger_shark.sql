CREATE TABLE `booking_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`techId` int NOT NULL,
	`serviceLines` json NOT NULL,
	`totalPriceInCents` int NOT NULL DEFAULT 0,
	`totalDurationMinutes` int NOT NULL DEFAULT 0,
	`techNote` text,
	`status` enum('pending','accepted','declined') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `booking_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `booking_service_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`techServiceId` int,
	`serviceName` varchar(128) NOT NULL,
	`lineType` enum('primary','addon','upgrade') NOT NULL DEFAULT 'primary',
	`priceInCents` int NOT NULL DEFAULT 0,
	`durationMinutes` int NOT NULL DEFAULT 0,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_service_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_album_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`postId` int NOT NULL,
	`collectionId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_album_memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `last_minute_slots` MODIFY COLUMN `slotDate` varchar(10) NOT NULL;--> statement-breakpoint
ALTER TABLE `smart_match_responses` MODIFY COLUMN `outcome` enum('match','recommend','addon','review','bundle') NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `addonServiceId` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD `revisionStatus` enum('none','pending','accepted','declined') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `last_minute_slots` ADD `startTime` varchar(5) NOT NULL;--> statement-breakpoint
ALTER TABLE `last_minute_slots` ADD `endTime` varchar(5) NOT NULL;--> statement-breakpoint
ALTER TABLE `last_minute_slots` ADD `isPushed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `last_minute_slots` ADD `expiresAt` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `privacy_settings` ADD `hideApproxLocation` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `smartMatchPriceReviewThresholdCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `fullAddress` text;--> statement-breakpoint
ALTER TABLE `users` ADD `addressCity` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `addressState` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `fuzzedLat` float;--> statement-breakpoint
ALTER TABLE `users` ADD `fuzzedLng` float;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `last_minute_slots` DROP COLUMN `duration`;--> statement-breakpoint
ALTER TABLE `last_minute_slots` DROP COLUMN `isBooked`;