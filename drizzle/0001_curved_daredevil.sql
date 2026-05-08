CREATE TABLE `availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `availability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`techId` int NOT NULL,
	`postId` int,
	`serviceType` varchar(128),
	`scheduledAt` timestamp NOT NULL,
	`duration` int NOT NULL DEFAULT 60,
	`status` enum('pending','confirmed','declined','cancelled','completed') NOT NULL DEFAULT 'pending',
	`depositPaid` boolean NOT NULL DEFAULT false,
	`notes` text,
	`techNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`coverImageUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`techId` int NOT NULL,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`followerId` int NOT NULL,
	`followingId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `follows_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `last_minute_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`slotDate` timestamp NOT NULL,
	`duration` int NOT NULL DEFAULT 60,
	`note` text,
	`isBooked` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `last_minute_slots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`postId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `likes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderId` int NOT NULL,
	`content` text,
	`imageUrl` text,
	`bookingId` int,
	`type` enum('text','image','booking_request','booking_card') NOT NULL DEFAULT 'text',
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(256) NOT NULL,
	`body` text,
	`relatedId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`likes` int NOT NULL DEFAULT 0,
	`saves` int NOT NULL DEFAULT 0,
	`bookingsFromPost` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `post_analytics_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_analytics_postId_unique` UNIQUE(`postId`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` int NOT NULL,
	`imageUrls` json NOT NULL,
	`caption` text,
	`style` varchar(64),
	`shape` varchar(64),
	`color` varchar(64),
	`location` text,
	`isPromoted` boolean NOT NULL DEFAULT false,
	`promotedUntil` timestamp,
	`status` enum('published','draft','hidden') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingId` int NOT NULL,
	`clientId` int NOT NULL,
	`techId` int NOT NULL,
	`rating` int NOT NULL,
	`text` text,
	`photoUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_bookingId_unique` UNIQUE(`bookingId`)
);
--> statement-breakpoint
CREATE TABLE `saved_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`postId` int NOT NULL,
	`collectionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `saved_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('trial','active','expired','cancelled','waived') NOT NULL DEFAULT 'trial',
	`tier` enum('free_trial','growth','monthly') NOT NULL DEFAULT 'free_trial',
	`trialStartedAt` timestamp NOT NULL DEFAULT (now()),
	`trialEndsAt` timestamp,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`followersAtTrialEnd` int DEFAULT 0,
	`growthBonusUnlocked` boolean NOT NULL DEFAULT false,
	`adminNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `userType` enum('client','nail_tech') DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `location` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `onboardingCompleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stylePreferences` json;--> statement-breakpoint
ALTER TABLE `users` ADD `colorPreferences` json;--> statement-breakpoint
ALTER TABLE `users` ADD `businessName` text;--> statement-breakpoint
ALTER TABLE `users` ADD `services` json;--> statement-breakpoint
ALTER TABLE `users` ADD `priceRange` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `instagramHandle` varchar(64);