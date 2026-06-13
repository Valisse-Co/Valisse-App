CREATE TABLE `blocked_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockerId` int NOT NULL,
	`blockedId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blocked_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `blocked_users_blockerId_blockedId_unique` UNIQUE(`blockerId`,`blockedId`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`inApp` boolean NOT NULL DEFAULT true,
	`sms` boolean NOT NULL DEFAULT false,
	`email` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_userId_type_unique` UNIQUE(`userId`,`type`)
);
--> statement-breakpoint
CREATE TABLE `privacy_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`profilePrivate` boolean NOT NULL DEFAULT false,
	`hideBookingHistory` boolean NOT NULL DEFAULT false,
	`hideFromNearMe` boolean NOT NULL DEFAULT false,
	`discoverVisible` boolean NOT NULL DEFAULT true,
	`hideExactAddress` boolean NOT NULL DEFAULT false,
	`messagePermission` enum('anyone','booked_only') NOT NULL DEFAULT 'anyone',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `privacy_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `privacy_settings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `tech_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`category` varchar(64) NOT NULL,
	`customName` varchar(128),
	`photoKey` text,
	`photoUrl` text,
	`priceInCents` int NOT NULL DEFAULT 0,
	`durationMinutes` int NOT NULL DEFAULT 60,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tech_services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `businessAddress` text;--> statement-breakpoint
ALTER TABLE `users` ADD `licenseNumber` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `yearsExperience` int;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarKey` text;--> statement-breakpoint
ALTER TABLE `users` ADD `darkMode` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `deactivatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `connectedProvider` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` enum('trial','active','expired','cancelled') DEFAULT 'trial';--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionTrialEndsAt` timestamp;