-- Rename diff_summary → event_label in content_log_body
ALTER TABLE "content_log_body" RENAME COLUMN "diff_summary" TO "event_label";
