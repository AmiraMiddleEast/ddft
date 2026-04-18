CREATE TABLE `cogs_kammer` (
	`id` text PRIMARY KEY NOT NULL,
	`bundesland_key` text NOT NULL,
	`bundesland_name` text NOT NULL,
	`beruf` text NOT NULL,
	`kammer_name` text,
	`kammer_website` text,
	`zustaendige_stelle` text NOT NULL,
	`zustaendige_stelle_hinweis` text,
	`direct_url_good_standing` text,
	`antragsverfahren` text,
	`erforderliche_dokumente` text,
	`fuehrungszeugnis_o_erforderlich` text,
	`fuehrungszeugnis_o_empfaenger` text NOT NULL,
	`kontakt_email` text,
	`kontakt_telefon` text,
	`kontakt_adresse` text,
	`besonderheiten` text,
	`quellen` text,
	`daten_vollstaendig` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cogs_kammer_bl_beruf_uniq` ON `cogs_kammer` (`bundesland_key`,`beruf`);--> statement-breakpoint
CREATE INDEX `cogs_kammer_beruf_idx` ON `cogs_kammer` (`beruf`);--> statement-breakpoint
ALTER TABLE `case` ADD `beruf` text;--> statement-breakpoint
ALTER TABLE `case` ADD `wohnsitz_bundesland` text;--> statement-breakpoint
ALTER TABLE `case` ADD `arbeitsort_bundesland` text;--> statement-breakpoint
ALTER TABLE `case` ADD `nrw_subregion` text;--> statement-breakpoint
ALTER TABLE `document` ADD `vorbeglaubigung_status` text;--> statement-breakpoint
ALTER TABLE `document` ADD `resolved_authority_id` text;