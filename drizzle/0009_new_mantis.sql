CREATE TABLE `tech_follows` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`techId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tech_follows_id` PRIMARY KEY(`id`)
);
