/**
 * Idempotent runtime ensure for the Phase 13 subscriptions schema —
 * subscriptions.user_subscriptions + subscriptions.webhook_events.
 *
 * Per PREMIUM_AND_TEACHER_CONNECTION_PLAN.md (Phase 1.1). The subscriptions
 * schema is the source of truth for per-subject premium entitlement; the
 * legacy origin_users.is_premium / premium_expiry columns become derived
 * mirrors recomputed on every webhook (see src/server/entitlements.ts).
 *
 * Canonical SQL: src/db/migrations/20260601_phase13_subscriptions.sql
 */

import type { PoolClient } from "pg";
import { SCHEMA_DDL_LOCK_ID } from "@/server/schema-lock";

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { ensureUserSchema } from "@/server/db-users";

declare global {
  var __originSubscriptionsSchemaEnsured: boolean | undefined;
  var __originSubscriptionsSchemaPromise: Promise<void> | undefined;
}

const MIGRATION_ID = "20260601_phase13_subscriptions";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function recordMigration(client: PoolClient): Promise<void> {
  await client.query(
    "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
    [MIGRATION_ID, "phase 13 per-subject premium subscriptions"],
  );
}

export async function ensureSubscriptionsSchema(): Promise<void> {
  if (!isUserPostgresConfigured()) return;
  if (globalThis.__originSubscriptionsSchemaEnsured) return;
  if (!globalThis.__originSubscriptionsSchemaPromise) {
    globalThis.__originSubscriptionsSchemaPromise = (async () => {
      // origin_users must exist before the FK below can validate.
      await ensureUserSchema();
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        // See subject-grants-schema.ts: concurrent CREATE TABLE IF NOT EXISTS
        // races on pg_type, so the DDL is serialised by an advisory lock.
        await client.query("SELECT pg_advisory_xact_lock($1)", [SCHEMA_DDL_LOCK_ID]);

        // ensureUserSchema() creates the `app` schema but NOT app.migrations —
        // that table is only created by store-postgres/platform-settings, which
        // may not have run yet on a fresh database. Without this, the ledger
        // INSERT below throws and rolls back the entire ensure, leaving the
        // table it was meant to create absent.
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS app;
          CREATE TABLE IF NOT EXISTS app.migrations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        await client.query(`CREATE SCHEMA IF NOT EXISTS subscriptions;`);

        await client.query(`
          DO $$ BEGIN
            CREATE TYPE subscriptions.subscription_status AS ENUM (
              'created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired'
            );
          EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS subscriptions.user_subscriptions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES origin_users(id) ON DELETE CASCADE,
            subject TEXT NOT NULL CHECK (subject IN ('physics', 'chemistry', 'mathematics', 'biology')),
            razorpay_plan_id TEXT,
            razorpay_subscription_id TEXT,
            status subscriptions.subscription_status NOT NULL DEFAULT 'created',
            current_period_end TIMESTAMPTZ,
            amount_minor INTEGER NOT NULL DEFAULT 49900 CHECK (amount_minor >= 0),
            short_url TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          -- Phase 6 (plan E27): the Razorpay created_at of the last event we
          -- APPLIED. Older events are re-deliveries or out-of-order deliveries
          -- and must not walk the status backwards. NULL always accepts, so a
          -- pre-migration row behaves exactly as it did before.
          ALTER TABLE subscriptions.user_subscriptions
            ADD COLUMN IF NOT EXISTS last_event_at TIMESTAMPTZ;

          CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_user_subject
            ON subscriptions.user_subscriptions(user_id, subject);
          CREATE UNIQUE INDEX IF NOT EXISTS uq_user_subscriptions_razorpay_sub
            ON subscriptions.user_subscriptions(razorpay_subscription_id)
            WHERE razorpay_subscription_id IS NOT NULL;
          CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
            ON subscriptions.user_subscriptions(user_id, status);
          CREATE INDEX IF NOT EXISTS idx_user_subscriptions_entitlement
            ON subscriptions.user_subscriptions(user_id, status, current_period_end);
        `);

        await client.query(`
          CREATE TABLE IF NOT EXISTS subscriptions.webhook_events (
            event_id TEXT PRIMARY KEY,
            event_type TEXT,
            received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);

        await recordMigration(client);
        await client.query("COMMIT");
        globalThis.__originSubscriptionsSchemaEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    })().catch((error) => {
      globalThis.__originSubscriptionsSchemaPromise = undefined;
      throw error;
    });
  }
  await globalThis.__originSubscriptionsSchemaPromise;
}
