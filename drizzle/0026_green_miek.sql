CREATE TABLE `qa_appointment_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adminId` int NOT NULL,
	`clientId` int NOT NULL,
	`techId` int NOT NULL,
	`bookingId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qa_appointment_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `qa_appointment_runs_bookingId_unique` UNIQUE(`bookingId`)
);
--> statement-breakpoint
ALTER TABLE `bookings` ADD `isQaTest` boolean DEFAULT false NOT NULL;