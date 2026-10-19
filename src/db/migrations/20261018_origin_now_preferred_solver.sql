-- 20261018_origin_now_preferred_solver: "Ask again" — a student can ask one of
-- their own solvers first. Stores that choice on the request; matching offers
-- that solver first when they are online and free, then carries on as usual.
-- Additive, nullable, guarded so an already-correct database issues no DDL.
-- Apply AFTER 20261016_origin_now_core.sql.
-- Mirrored at runtime by NOW_ADDON_MIGRATIONS (src/server/now/now-schema.ts).
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'now' AND table_name = 'requests' AND column_name = 'preferred_helper_id'
  ) THEN
    ALTER TABLE now.requests ADD COLUMN preferred_helper_id TEXT REFERENCES now.helpers(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO app.migrations (id, name) VALUES ('20261018_origin_now_preferred_solver', 'origin now: ask a chosen solver first')
  ON CONFLICT (id) DO NOTHING;
