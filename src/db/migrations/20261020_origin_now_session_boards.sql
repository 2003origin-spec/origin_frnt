-- 20261020_origin_now_session_boards: the shared board of a human call (decision B89),
-- saved by the solver's screen while the call runs, for late joiners and the
-- admin session review. New table only; idempotent. Apply AFTER 20261016_origin_now_core.sql.
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

CREATE TABLE IF NOT EXISTS now.session_boards (
  session_id TEXT PRIMARY KEY REFERENCES now.sessions(id) ON DELETE CASCADE,
  board JSONB NOT NULL,
  bytes INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app.migrations (id, name) VALUES ('20261020_origin_now_session_boards', 'origin now: shared board of a call')
  ON CONFLICT (id) DO NOTHING;
