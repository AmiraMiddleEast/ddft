CREATE TABLE `behoerden_authority` (
	`id` text PRIMARY KEY NOT NULL,
	`state_id` text NOT NULL,
	`regierungsbezirk_id` text,
	`document_type_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text NOT NULL,
	`phone` text,
	`email` text,
	`website` text,
	`office_hours` text,
	`notes` text,
	`special_rules` text,
	`needs_review` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`state_id`) REFERENCES `behoerden_state`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`regierungsbezirk_id`) REFERENCES `behoerden_regierungsbezirk`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`document_type_id`) REFERENCES `behoerden_document_type`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `authority_lookup_idx` ON `behoerden_authority` (`state_id`,`document_type_id`,`regierungsbezirk_id`);--> statement-breakpoint
CREATE INDEX `authority_state_idx` ON `behoerden_authority` (`state_id`);--> statement-breakpoint
CREATE TABLE `behoerden_document_type` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `behoerden_regierungsbezirk` (
	`id` text PRIMARY KEY NOT NULL,
	`state_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	FOREIGN KEY (`state_id`) REFERENCES `behoerden_state`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rbz_state_slug_uniq` ON `behoerden_regierungsbezirk` (`state_id`,`slug`);--> statement-breakpoint
CREATE INDEX `rbz_state_idx` ON `behoerden_regierungsbezirk` (`state_id`);--> statement-breakpoint
CREATE TABLE `behoerden_state` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`hat_regierungsbezirke` integer DEFAULT false NOT NULL,
	`besonderheiten` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document_review` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`approved_by_user_id` text NOT NULL,
	`approved_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`corrected_fields` text NOT NULL,
	`resolved_authority_id` text,
	`lookup_status` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_authority_id`) REFERENCES `behoerden_authority`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "doc_review_status_ck" CHECK("document_review"."lookup_status" IN ('matched','ambiguous','not_found'))
);
--> statement-breakpoint
CREATE INDEX `doc_review_doc_idx` ON `document_review` (`document_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_document` (
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
	`review_status` text DEFAULT 'pending' NOT NULL,
	`reviewed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "document_status_ck" CHECK("__new_document"."extraction_status" IN ('pending','extracting','done','error')),
	CONSTRAINT "document_review_status_ck" CHECK("__new_document"."review_status" IN ('pending','approved'))
);
--> statement-breakpoint
INSERT INTO `__new_document`("id", "user_id", "filename", "size", "sha256", "mime", "storage_path", "uploaded_at", "extracted_at", "extraction_status", "error_code", "review_status", "reviewed_at") SELECT "id", "user_id", "filename", "size", "sha256", "mime", "storage_path", "uploaded_at", "extracted_at", "extraction_status", "error_code", "review_status", "reviewed_at" FROM `document`;--> statement-breakpoint
DROP TABLE `document`;--> statement-breakpoint
ALTER TABLE `__new_document` RENAME TO `document`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `document_user_sha_uniq` ON `document` (`user_id`,`sha256`);--> statement-breakpoint
CREATE INDEX `document_user_idx` ON `document` (`user_id`);--> statement-breakpoint
CREATE INDEX `document_uploaded_at_idx` ON `document` (`uploaded_at`);