CREATE TABLE `post_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`reporterId` int NOT NULL,
	`reason` enum('nudity','stolen_content','spam','harassment','violence','other') NOT NULL,
	`note` text,
	`status` enum('pending','dismissed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_reports_reporterId_postId_unique` UNIQUE(`reporterId`,`postId`)
);
