CREATE TABLE `document` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`mime` text DEFAULT 'application/pdf' NOT NULL,
	`storage_path` text NOT NULL,
	`uploaded_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`extracted_at` integer,
	`extraction_status` text DEFAULT 'pending' NOT NULL,
	`error_code` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "document_status_ck" CHECK("document"."extraction_status" IN ('pending','extracting','done','error'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_user_sha_uniq` ON `document` (`user_id`,`sha256`);--> statement-breakpoint
CREATE INDEX `document_user_idx` ON `document` (`user_id`);--> statement-breakpoint
CREATE INDEX `document_uploaded_at_idx` ON `document` (`uploaded_at`);--> statement-breakpoint
CREATE TABLE `extraction` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`field_name` text NOT NULL,
	`field_value` text,
	`confidence` text NOT NULL,
	`reasoning` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "extraction_confidence_ck" CHECK("extraction"."confidence" IN ('high','medium','low')),
	CONSTRAINT "extraction_field_ck" CHECK("extraction"."field_name" IN ('dokumenten_typ','ausstellende_behoerde','ausstellungsort','bundesland','ausstellungsdatum','voller_name'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `extraction_doc_field_uniq` ON `extraction` (`document_id`,`field_name`);--> statement-breakpoint
CREATE INDEX `extraction_doc_idx` ON `extraction` (`document_id`);--> statement-breakpoint
CREATE TABLE `extraction_log` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_eur` real NOT NULL,
	`claude_model` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `extraction_log_doc_idx` ON `extraction_log` (`document_id`);