CREATE TABLE `booking_match_assessments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`serviceCategory` varchar(128) NOT NULL,
	`answers` json NOT NULL,
	`outcome` enum('match','recommendation','review') NOT NULL,
	`recommendedService` varchar(128),
	`recommendedAddOns` json NOT NULL DEFAULT ('[]'),
	`explanation` text,
	`photoUrls` json NOT NULL DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_match_assessments_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_match_assessments_bookingId_unique` UNIQUE(`bookingId`)
);
