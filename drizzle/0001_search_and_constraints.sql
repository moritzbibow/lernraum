-- Sibling slugs must be unique among live (not soft-deleted) rows.
CREATE UNIQUE INDEX `subjects_slug_live` ON `subjects` (`slug`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_sibling_slug_live` ON `pages` (coalesce(`subject_id`, ''), coalesce(`parent_id`, ''), `slug`) WHERE `deleted_at` IS NULL;
--> statement-breakpoint
-- Full-text search over pages. The trigram tokenizer matches substrings, which
-- suits German compounds ("kompensation" finds "Superkompensation").
CREATE VIRTUAL TABLE `pages_fts` USING fts5(
  page_id UNINDEXED,
  title,
  topics,
  body,
  tokenize = 'trigram remove_diacritics 1'
);
--> statement-breakpoint
CREATE TRIGGER `pages_fts_ai` AFTER INSERT ON `pages` BEGIN
  INSERT INTO pages_fts(page_id, title, topics, body) VALUES (
    new.id,
    new.title || coalesce(' ' || new.heading, ''),
    coalesce((SELECT group_concat(json_extract(value, '$.title'), ' · ') FROM json_each(new.topics)), ''),
    new.content_md
  );
END;
--> statement-breakpoint
CREATE TRIGGER `pages_fts_ad` AFTER DELETE ON `pages` BEGIN
  DELETE FROM pages_fts WHERE page_id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER `pages_fts_au` AFTER UPDATE OF title, heading, topics, content_md ON `pages` BEGIN
  DELETE FROM pages_fts WHERE page_id = old.id;
  INSERT INTO pages_fts(page_id, title, topics, body) VALUES (
    new.id,
    new.title || coalesce(' ' || new.heading, ''),
    coalesce((SELECT group_concat(json_extract(value, '$.title'), ' · ') FROM json_each(new.topics)), ''),
    new.content_md
  );
END;
