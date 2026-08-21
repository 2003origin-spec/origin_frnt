-- Origin Weekly Contest — per-event partition management + retention (plan §9).
--
-- The two high-volume tables (contest.answer_drafts, contest.submission_answers)
-- are LIST-partitioned by contest_id. Until now every row landed in the shared
-- _default partition, so a finished contest's ~90M rows could only be reclaimed
-- with a DELETE (dead tuples + bloat on a table every future contest also uses).
--
-- This migration adds server-side helpers that give each contest its OWN
-- partition, created at publish time (before the contest goes live, when it has
-- zero rows, so the attach is instant). Retention then reclaims a whole contest
-- as a single DROP TABLE — O(1), no bloat, no vacuum debt.
--
-- Idempotent; safe to re-run. Rollback drops the functions + columns only (never
-- the data partitions, which rollback must not destroy).

-- Retention bookkeeping on the parent contest row (keeps the retention cron
-- idempotent + cheap — it only looks at rows not yet purged/archived).
ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS drafts_purged_at TIMESTAMPTZ;
ALTER TABLE contest.contests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Deterministic partition name for a contest's per-event partition. Contest ids
-- are free-form TEXT and Postgres identifiers cap at 63 chars, so we hash the id
-- to a fixed 16-hex suffix (collision-safe in practice for the id space here).
CREATE OR REPLACE FUNCTION contest._partition_name(base text, cid text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT base || '_p_' || substr(md5(cid), 1, 16)
$$;

-- Idempotently create the dedicated partitions for one contest on BOTH
-- answer_drafts and submission_answers. Call at publish time. Safe to re-run:
-- an already-existing partition is skipped.
CREATE OR REPLACE FUNCTION contest.ensure_event_partitions(cid text)
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  dpart text := contest._partition_name('answer_drafts', cid);
  spart text := contest._partition_name('submission_answers', cid);
BEGIN
  IF to_regclass(format('contest.%I', dpart)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE contest.%I PARTITION OF contest.answer_drafts FOR VALUES IN (%L)',
      dpart, cid);
  END IF;
  IF to_regclass(format('contest.%I', spart)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE contest.%I PARTITION OF contest.submission_answers FOR VALUES IN (%L)',
      spart, cid);
  END IF;
END;
$$;

-- Drop one contest's per-event partition of a given parent, if it exists.
-- DROP TABLE on a partition detaches + drops in one shot, instantly reclaiming
-- the space. Returns TRUE if a partition was dropped, FALSE if none existed
-- (e.g. a legacy contest whose rows are still in _default — caller falls back to
-- a scoped DELETE). `base` is allowlisted so this can never drop anything else.
CREATE OR REPLACE FUNCTION contest.drop_event_partition(base text, cid text)
RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE
  part text;
BEGIN
  IF base NOT IN ('answer_drafts', 'submission_answers') THEN
    RAISE EXCEPTION 'drop_event_partition: unsupported base %', base;
  END IF;
  part := contest._partition_name(base, cid);
  IF to_regclass(format('contest.%I', part)) IS NULL THEN
    RETURN false;
  END IF;
  EXECUTE format('DROP TABLE contest.%I', part);
  RETURN true;
END;
$$;
