-- Origin Diagnostic Graph (ODG) — Phase 4: temporal decay + burnout.
--
-- The decayed_mastery column and last_seen_at index were provisioned in Phase 1,
-- so decay itself is a compute change (analytics-service/app/odg/decay.py driven by
-- POST /v1/odg/recompute-decay). This migration only adds an index that makes
-- "which of a student's concepts are now below the revision threshold" fast.
--
-- Lives in the analytics/OGCODE database. Idempotent.

CREATE INDEX IF NOT EXISTS idx_odg_mastery_user_decayed
  ON odg.student_node_mastery (user_id, decayed_mastery);
