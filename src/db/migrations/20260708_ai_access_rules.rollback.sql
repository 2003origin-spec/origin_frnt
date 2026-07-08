-- Rollback for 20260708_ai_access_rules.sql — AI Feature Toggle epic.
-- Additive migration; dropping the table is harmless (Redis projections
-- self-heal to empty and the resolver fails open to ON). Run manually
-- against Neon only if fully reverting the epic.

BEGIN;
DROP INDEX IF EXISTS idx_origin_users_role_premium;
DROP TABLE IF EXISTS app.ai_access_rules;
DELETE FROM app.migrations WHERE id = '20260708_ai_access_rules';
COMMIT;
