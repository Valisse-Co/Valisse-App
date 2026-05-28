ALTER TABLE `users` ADD `tosVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `tosAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `privacyAcceptedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `smsConsent` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `smsConsentAt` timestamp;