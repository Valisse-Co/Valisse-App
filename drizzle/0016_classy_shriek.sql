CREATE TABLE `smart_match_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int,
	`serviceCategory` varchar(128) NOT NULL,
	`questions` json NOT NULL,
	`rules` json NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `smart_match_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `smart_match_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`techId` int NOT NULL,
	`serviceCategory` varchar(128) NOT NULL,
	`answers` json NOT NULL,
	`outcome` enum('match','recommend','review') NOT NULL,
	`recommendedService` varchar(128),
	`photoUrls` json NOT NULL DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `smart_match_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `needsReview` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `reviewAnswers` json;--> statement-breakpoint
ALTER TABLE `bookings` ADD `reviewRecommendedService` varchar(128);--> statement-breakpoint
ALTER TABLE `bookings` ADD `reviewPhotoUrls` json;--> statement-breakpoint
ALTER TABLE `tech_services` ADD `smartMatchEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `smartMatchEnabled` boolean DEFAULT true NOT NULL;