-- Origin Diagnostic Graph (ODG): apply each graded attempt to mastery once.
--
-- Long-term mastery is a running BKT update (the stored mastery is the prior),
-- so applying the same evidence twice moves it twice. Next retries the analysis
-- call (analysis-jobs.ts, up to 5 attempts, 3 s timeout) after Python may
-- already have saved. persist_student_mastery claims a row here in the same
-- transaction as the mastery upsert and skips the update when the row exists.
--
-- source_type is 'test' or 'dpp'; source_id is the test_id / dpp_id.
-- evidence_hash fingerprints the request's answers and time taken, so a retry
-- (identical stored request) is skipped while a genuine retake of the same
-- test still counts.
--
-- Lives in the analytics/OGCODE database. Idempotent; mirrored by
-- analytics-service/app/odg/schema.py (and ensured at runtime by
-- analytics-service/app/odg/mastery.py).

CREATE TABLE IF NOT EXISTS odg.applied_attempts (
  user_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, source_type, source_id, evidence_hash)
);

CREATE INDEX IF NOT EXISTS idx_odg_applied_attempts_applied_at
  ON odg.applied_attempts (applied_at);
