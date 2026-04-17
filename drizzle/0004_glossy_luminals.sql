CREATE TABLE `case_document` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`document_id` text NOT NULL,
	`position` integer NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `case`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_document_doc_uniq` ON `case_document` (`document_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `case_document_case_doc_uniq` ON `case_document` (`case_id`,`document_id`);--> statement-breakpoint
CREATE INDEX `case_document_case_pos_idx` ON `case_document` (`case_id`,`position`);--> statement-breakpoint
CREATE TABLE `case` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`person_name` text NOT NULL,
	`person_birthdate` text,
	`notes` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "case_status_ck" CHECK("case"."status" IN ('open','ready_for_pdf','pdf_generated'))
);
--> statement-breakpoint
CREATE INDEX `case_user_idx` ON `case` (`user_id`);--> statement-breakpoint
CREATE INDEX `case_user_updated_idx` ON `case` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `laufliste` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`user_id` text NOT NULL,
	`pdf_storage_path` text NOT NULL,
	`generated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`document_count` integer NOT NULL,
	`file_size` integer NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `case`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `laufliste_case_idx` ON `laufliste` (`case_id`);--> statement-breakpoint
CREATE INDEX `laufliste_case_generated_idx` ON `laufliste` (`case_id`,`generated_at`);