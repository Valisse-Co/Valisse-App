CREATE TABLE `email_auth_rate_limits` (
	`bucketHash` varchar(64) NOT NULL,
	`windowStartedAt` timestamp(3) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`lastRequestedAt` timestamp(3),
	`updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `email_auth_rate_limits_bucketHash` PRIMARY KEY(`bucketHash`)
);
--> statement-breakpoint
CREATE TABLE `email_auth_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`purpose` enum('verify_email','reset_password') NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`expiresAt` timestamp(3) NOT NULL,
	`consumedAt` timestamp(3),
	`deliveredAt` timestamp(3),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `email_auth_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_auth_tokens_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationRequired` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `sessionVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `email_auth_tokens_user_purpose_idx` ON `email_auth_tokens` (`userId`,`purpose`,`id`);--> statement-breakpoint
CREATE INDEX `email_auth_tokens_expires_idx` ON `email_auth_tokens` (`expiresAt`);
--> statement-breakpoint
UPDATE `users` SET `emailVerificationRequired` = true WHERE `onboardingCompleted` = false;
