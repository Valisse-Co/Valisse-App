CREATE TABLE `availability_offer_windows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`availabilityOfferId` int NOT NULL,
	`ordinal` int NOT NULL,
	`localDate` varchar(10) NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`endTime` varchar(5) NOT NULL,
	`audience` enum('open','returning_only') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `availability_offer_windows_id` PRIMARY KEY(`id`),
	CONSTRAINT `availability_offer_windows_offer_ordinal_unique` UNIQUE(`availabilityOfferId`,`ordinal`)
);
--> statement-breakpoint
CREATE TABLE `availability_offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`conversationId` int NOT NULL,
	`techId` int NOT NULL,
	`clientId` int NOT NULL,
	`note` text,
	`timeZone` varchar(64) NOT NULL,
	`idempotencyKey` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `availability_offers_id` PRIMARY KEY(`id`),
	CONSTRAINT `availability_offers_messageId_unique` UNIQUE(`messageId`),
	CONSTRAINT `availability_offers_tech_conversation_key_unique` UNIQUE(`techId`,`conversationId`,`idempotencyKey`)
);
--> statement-breakpoint
ALTER TABLE `messages` MODIFY COLUMN `type` enum('text','image','booking_request','booking_card','availability_offer') NOT NULL DEFAULT 'text';