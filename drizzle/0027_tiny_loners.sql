ALTER TABLE `bookings` ADD `stripeRefundId` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD `stripeTipRefundId` varchar(255);--> statement-breakpoint
ALTER TABLE `bookings` ADD `tipStatus` enum('none','declined','paid','refunded') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `tipAmountInCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `issueResolution` enum('none','payout_released','full_refund','partial_refund') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `issueResolutionNote` text;--> statement-breakpoint
ALTER TABLE `bookings` ADD `issueResolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `bookings` ADD `issueResolvedBy` int;--> statement-breakpoint
ALTER TABLE `bookings` ADD `refundAmountInCents` int DEFAULT 0 NOT NULL;