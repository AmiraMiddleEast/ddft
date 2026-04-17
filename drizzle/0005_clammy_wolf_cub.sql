CREATE TABLE `document_version` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`storage_path` text NOT NULL,
	`sha256` text NOT NULL,
	`size` integer NOT NULL,
	`uploaded_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doc_version_doc_num_uniq` ON `document_version` (`document_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `doc_version_doc_idx` ON `document_version` (`document_id`);--> statement-breakpoint
ALTER TABLE `document` ADD `version` integer DEFAULT 1 NOT NULL;