-- 20261020_origin_now_store_refund_kind: allows the `store_refund` ledger kind
-- (coins back for a store order cancelled before it ships, or an unpaid
-- rupee checkout; decisions B91, B92). Guarded: it only replaces the check
-- when `store_refund` is missing. Mirrored at runtime by
-- ensureStoreRefundLedgerKind() (src/server/now/store-refund-kind.ts), which
-- runs before the first such refund.
-- Plan: V1/ORIGIN_NOW_PLAN.md. NOT in scripts/run-migrations.mjs (decision B2).

DO $$
DECLARE constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
    FROM pg_constraint
   WHERE conrelid = 'now.ledger_transfers'::regclass AND conname = 'ledger_transfers_kind_check';
  IF constraint_def IS NULL OR position('store_refund' IN constraint_def) = 0 THEN
    ALTER TABLE now.ledger_transfers DROP CONSTRAINT IF EXISTS ledger_transfers_kind_check;
    ALTER TABLE now.ledger_transfers ADD CONSTRAINT ledger_transfers_kind_check CHECK (kind IN (
      'welcome_grant', 'pack_purchase', 'promo_bonus', 'session_hold', 'session_capture',
      'session_release', 'extension', 'tip', 'commission', 'transfer', 'store_spend',
      'expiry', 'admin_adjustment', 'pack_refund', 'store_refund'
    ));
  END IF;
END $$;

INSERT INTO app.migrations (id, name) VALUES ('20261020_origin_now_store_refund_kind', 'origin now: store_refund ledger kind')
  ON CONFLICT (id) DO NOTHING;
