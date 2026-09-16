CREATE TABLE `availability_service_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`availabilityId` int NOT NULL,
	`techServiceId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `availability_service_selections_id` PRIMARY KEY(`id`),
	CONSTRAINT `availability_service_selections_availability_service_unique` UNIQUE(`availabilityId`,`techServiceId`)
);
