ALTER TABLE `conversations` ADD `clientRole` enum('client','nail_tech') DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE `conversations` ADD `techRole` enum('client','nail_tech') DEFAULT 'nail_tech' NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` ADD `senderRole` enum('client','nail_tech') DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE `reviews` ADD `photoUrls` json NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `clientCity` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `clientState` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `clientPostalCode` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `clientCountry` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `clientLat` float;--> statement-breakpoint
ALTER TABLE `users` ADD `clientLng` float;--> statement-breakpoint
ALTER TABLE `users` ADD `clientLocationVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `addressLine1` varchar(256);--> statement-breakpoint
ALTER TABLE `users` ADD `addressLine2` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `addressPostalCode` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `addressCountry` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `addressVerifiedAt` timestamp;
