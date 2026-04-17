DROP INDEX `doc_review_doc_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `doc_review_doc_uniq` ON `document_review` (`document_id`);