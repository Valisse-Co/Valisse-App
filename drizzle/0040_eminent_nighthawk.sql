CREATE TABLE `operations_jobs` (
	`jobId` int AUTO_INCREMENT NOT NULL,
	`jobKey` varchar(64) NOT NULL DEFAULT 'appointment_operations',
	`environment` enum('production','development') NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`callbackPath` varchar(255) NOT NULL DEFAULT '/api/scheduled/release-payouts',
	`cronExpression` varchar(128) NOT NULL DEFAULT '0 */5 * * * *',
	`scheduleEnabled` boolean NOT NULL DEFAULT false,
	`executionMode` enum('observe_only','execute') NOT NULL DEFAULT 'observe_only',
	`schedulerVerifiedAt` timestamp(3),
	`providerLastExecutedAt` timestamp(3),
	`providerNextExecutionAt` timestamp(3),
	`leaseToken` varchar(64),
	`leaseUntil` timestamp(3),
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	`updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `operations_jobs_jobId` PRIMARY KEY(`jobId`),
	CONSTRAINT `operations_jobs_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`),
	CONSTRAINT `operations_jobs_key_environment_unique` UNIQUE(`jobKey`,`environment`)
);
--> statement-breakpoint
CREATE TABLE `operations_runs` (
	`id` varchar(36) NOT NULL,
	`jobId` int NOT NULL,
	`environment` enum('production','development') NOT NULL,
	`executionMode` enum('observe_only','execute') NOT NULL,
	`status` enum('running','succeeded','partial_failure','failed','abandoned') NOT NULL DEFAULT 'running',
	`startedAt` timestamp(3) NOT NULL,
	`completedAt` timestamp(3),
	`steps` json NOT NULL,
	`source` enum('heartbeat') NOT NULL DEFAULT 'heartbeat',
	`createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
	CONSTRAINT `operations_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `operations_runs` ADD CONSTRAINT `operations_runs_jobId_operations_jobs_jobId_fk` FOREIGN KEY (`jobId`) REFERENCES `operations_jobs`(`jobId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `operations_runs_environment_started_idx` ON `operations_runs` (`environment`,`startedAt`);--> statement-breakpoint
CREATE INDEX `operations_runs_status_started_idx` ON `operations_runs` (`status`,`startedAt`);--> statement-breakpoint
CREATE INDEX `operations_runs_job_status_idx` ON `operations_runs` (`jobId`,`status`);