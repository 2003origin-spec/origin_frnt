-- Origin Diagnostic Graph (ODG) — Phase 2: error-type-weighted edges.
--
-- Records the classified error type (conceptual / formulaic / procedural /
-- application) for each wrong answer. The concept_edges.edge_type / weight
-- columns needed for weighted tracing were already provisioned in Phase 1, so
-- this phase only adds the events table.
--
-- Lives in the analytics/OGCODE database. Idempotent; mirrored by
-- analytics-service/app/odg/schema.py.

CREATE TABLE IF NOT EXISTS odg.error_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  concept TEXT NOT NULL,
  error_type TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'rules',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_odg_error_events_user ON odg.error_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_odg_error_events_concept ON odg.error_events (subject, concept);
