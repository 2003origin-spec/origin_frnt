/**
 * Runtime mirror of 20261020_origin_now_store_refund_kind.sql: lets the
 * ledger record `store_refund` (decisions B91, B92). Kept out of the add-on
 * list because it replaces a check constraint (the add-ons only add). Guarded:
 * no DDL when the kind is already allowed. Call it before a transaction that
 * may post a store refund.
 */

import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureNowSchema } from "./now-schema";

declare global {
  var __originStoreRefundKindEnsured: boolean | undefined;
}

export const STORE_REFUND_KIND_MIGRATION_ID = "20261020_origin_now_store_refund_kind";

export async function ensureStoreRefundLedgerKind(): Promise<void> {
  if (globalThis.__originStoreRefundKindEnsured) return;
  await ensureNowSchema();
  const pool = getUserPostgresPool();
  if (!pool) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);
    await client.query(`
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
      END $$;`);
    await client.query(`INSERT INTO app.migrations (id, name) VALUES ($1, 'origin now: store_refund ledger kind') ON CONFLICT (id) DO NOTHING`, [
      STORE_REFUND_KIND_MIGRATION_ID,
    ]);
    await client.query("COMMIT");
    globalThis.__originStoreRefundKindEnsured = true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
