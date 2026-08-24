-- Paid one-time access as a subject_grants source (USER database).
-- Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §5.2 (Phase 1), decision D3.
--
-- A prepaid term purchase (Rail A) grants access by writing an
-- entitlements.subject_grants row with source='paid_order'. That reuses the
-- entitlement UNION already read by getActiveEntitlementRows() /
-- recomputeUserPremiumFlags(), so the entitlement READ PATH IS UNCHANGED.
--
-- Widens the source CHECK from ('teacher_code','admin_comp') and adds an order
-- backlink. Additive + idempotent; safe to re-run.
--
-- GUARDED: entitlements.subject_grants is created by the phase-14 migration,
-- which is NOT in the run-migrations allowlist (it was applied by hand in prod).
-- On a database that has never seen it — a fresh preview — the table is absent
-- and this file must not fail the build. It skips instead, and
-- src/server/connect/subject-grants-schema.ts creates the table with
-- 'paid_order' already in the CHECK, so the skip can never leave the DB wrong.

DO $$
BEGIN
  IF to_regclass('entitlements.subject_grants') IS NULL THEN
    RAISE NOTICE '[20260822_payments_grant_source] entitlements.subject_grants absent — skipping; the runtime-ensure creates it with paid_order already allowed.';
    RETURN;
  END IF;

  -- Widen the source CHECK. The constraint is inline in the original CREATE
  -- TABLE, so PostgreSQL named it subject_grants_source_check.
  ALTER TABLE entitlements.subject_grants
    DROP CONSTRAINT IF EXISTS subject_grants_source_check;
  ALTER TABLE entitlements.subject_grants
    ADD CONSTRAINT subject_grants_source_check
    CHECK (source IN ('teacher_code', 'admin_comp', 'paid_order'));

  -- Backlink to the paying order (NULL for teacher_code / admin_comp grants).
  ALTER TABLE entitlements.subject_grants
    ADD COLUMN IF NOT EXISTS order_id TEXT;

  -- One live paid grant per (user, subject) — mirrors the existing
  -- uq_subject_grants_active_admin_comp precedent. A re-purchase EXTENDS the
  -- existing row's expires_at rather than inserting a second one.
  CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_grants_active_paid
    ON entitlements.subject_grants(user_id, subject)
    WHERE status = 'active' AND source = 'paid_order';

  CREATE INDEX IF NOT EXISTS idx_subject_grants_order
    ON entitlements.subject_grants(order_id) WHERE order_id IS NOT NULL;
END $$;
