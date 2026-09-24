CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`details` text DEFAULT '[]' NOT NULL,
	`finished_at` integer NOT NULL,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_quiz_idx` ON `attempts` (`quiz_id`,`finished_at`);--> statement-breakpoint
CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`action` text DEFAULT 'created' NOT NULL,
	`created_at` integer NOT NULL,
	`seen_at` integer
);
--> statement-breakpoint
CREATE INDEX `inbox_ref_idx` ON `inbox_items` (`kind`,`ref_id`);--> statement-breakpoint
CREATE INDEX `inbox_created_idx` ON `inbox_items` (`created_at`);--> statement-breakpoint
CREATE TABLE `oauth_clients` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`redirect_uris` text NOT NULL,
	`secret_hash` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE TABLE `oauth_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`code_challenge` text NOT NULL,
	`scope` text NOT NULL,
	`resource` text,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `oauth_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`access_hash` text NOT NULL,
	`refresh_hash` text NOT NULL,
	`prev_refresh_hash` text,
	`rotated_at` integer,
	`scope` text NOT NULL,
	`resource` text,
	`access_expires_at` integer NOT NULL,
	`refresh_expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tokens_access_idx` ON `oauth_tokens` (`access_hash`);--> statement-breakpoint
CREATE INDEX `tokens_refresh_idx` ON `oauth_tokens` (`refresh_hash`);--> statement-breakpoint
CREATE INDEX `tokens_prev_refresh_idx` ON `oauth_tokens` (`prev_refresh_hash`);--> statement-breakpoint
CREATE TABLE `page_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`title` text NOT NULL,
	`heading` text,
	`kicker` text,
	`content_md` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `revisions_page_idx` ON `page_revisions` (`page_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text,
	`parent_id` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`heading` text,
	`kicker` text,
	`lesson_date` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`content_md` text DEFAULT '' NOT NULL,
	`topics` text DEFAULT '[]' NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`content_updated_at` integer,
	`deleted_at` integer,
	`last_opened_at` integer,
	`read_progress` real DEFAULT 0 NOT NULL,
	`topic_progress` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pages_tree_idx` ON `pages` (`subject_id`,`parent_id`,`sort`);--> statement-breakpoint
CREATE INDEX `pages_parent_idx` ON `pages` (`parent_id`);--> statement-breakpoint
CREATE INDEX `pages_opened_idx` ON `pages` (`last_opened_at`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`prompt` text NOT NULL,
	`answers` text DEFAULT '[]' NOT NULL,
	`explanation` text,
	`topic_id` text,
	FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `questions_quiz_idx` ON `questions` (`quiz_id`,`sort`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`title` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'claude' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quizzes_page_idx` ON `quizzes` (`page_id`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`hue` real NOT NULL,
	`lightness` real DEFAULT 0.82 NOT NULL,
	`chroma` real DEFAULT 0.1 NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `subjects_sort_idx` ON `subjects` (`sort`);