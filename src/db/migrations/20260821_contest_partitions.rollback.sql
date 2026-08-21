-- Rollback for 20260821_contest_partitions.sql.
-- Drops the helper functions and the retention-bookkeeping columns ONLY.
-- Never drops the per-event data partitions (that would destroy contest data);
-- they remain valid partitions of their parents.

DROP FUNCTION IF EXISTS contest.drop_event_partition(text, text);
DROP FUNCTION IF EXISTS contest.ensure_event_partitions(text);
DROP FUNCTION IF EXISTS contest._partition_name(text, text);

ALTER TABLE contest.contests DROP COLUMN IF EXISTS archived_at;
ALTER TABLE contest.contests DROP COLUMN IF EXISTS drafts_purged_at;
