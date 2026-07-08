-- AI Feature Toggle epic — per-scope admin-controlled AI access rules.
-- See V1/ai-feature-toggle/ (docs 01–08). Postgres is the source of truth;
-- Upstash Redis holds projections (ai-access:rules blob + ai-access:uctx:<id>).
-- Additive + idempotent. Mirrors src/server/ai-access-schema.ts (runtime-ensure),
-- so production self-applies this on first use — no manual migration step.

BEGIN;

CREATE TABLE IF NOT EXISTS app.ai_access_rules (
  scope_type TEXT NOT NULL CHECK (scope_type IN ('global','tier','workspace','batch','user')),
  scope_id   TEXT NOT NULL DEFAULT '',
  -- NULL = inherit from the next-less-specific scope. The global row is always explicit.
  ori_enabled       BOOLEAN,
  explainer_enabled BOOLEAN,
  updated_by TEXT REFERENCES origin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_type, scope_id),
  CONSTRAINT ai_rules_tier_ids  CHECK (scope_type <> 'tier'   OR scope_id IN ('free','premium')),
  CONSTRAINT ai_rules_global_id CHECK (
    scope_type <> 'global'
    OR (scope_id = '' AND ori_enabled IS NOT NULL AND explainer_enabled IS NOT NULL)
  )
);

-- Seed the global row ON (idempotent). Launch posture: nothing changes for
-- students until an admin flips something.
INSERT INTO app.ai_access_rules (scope_type, scope_id, ori_enabled, explainer_enabled)
VALUES ('global', '', TRUE, TRUE)
ON CONFLICT (scope_type, scope_id) DO NOTHING;

-- Supports the admin tier lists (students?tier=…) and the tier student counts.
CREATE INDEX IF NOT EXISTS idx_origin_users_role_premium
  ON origin_users (role, is_premium);

INSERT INTO app.migrations (id, name)
VALUES ('20260708_ai_access_rules', 'AI feature toggle — app.ai_access_rules')
ON CONFLICT (id) DO NOTHING;

COMMIT;
