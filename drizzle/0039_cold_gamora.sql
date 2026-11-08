CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(191) NOT NULL,
	`email` varchar(320) NOT NULL,
	`category` enum('booking','payment','subscription','account','safety','feedback','other') NOT NULL DEFAULT 'other',
	`subject` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`appointmentRef` varchar(128),
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
