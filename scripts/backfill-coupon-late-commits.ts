/**
 * One-off backfill for bug-fix P2 (docs/bug-fixes/05-payments-entitlements.md):
 * coupon holds that were released while the order was still payable, after
 * which the payment succeeded anyway.
 *
 * Every such order was settled at its DISCOUNTED amount, but the hold had been
 * given back, so `pricing.coupons.times_redeemed` and the per-user count are
 * each one short per occurrence. This re-commits those holds through the same
 * `commitOrRecommitCoupon` the capture path now uses, so the caps reflect what
 * actually happened. A row that pushes a coupon past `max_redemptions` is
 * committed with `overrun = TRUE` and the order gets `notes.coupon_overrun`
 * (admins may then see times_redeemed > max_redemptions — that is the truth).
 *
 * Touches ONLY pricing.coupons / pricing.coupon_redemptions counters and the
 * order's notes. Never changes an amount, a status, a grant or a payment.
 *
 * Usage (secrets only at migration time, never committed):
 *   cd new-frontend
 *   npx tsx --env-file=.env.local scripts/backfill-coupon-late-commits.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-coupon-late-commits.ts --apply
 *
 * Dry run is the default: every row is processed inside a transaction that is
 * ROLLED BACK, so the printed outcomes are exactly what --apply would commit.
 * Idempotent: a re-run finds no released rows for already re-committed orders.
 *
 * Rollout order: migration 20261021_coupon_redemption_overrun.sql → deploy →
 * --dry-run → --apply.
 */

import Module from "node:module";

// `coupons-service` is marked `server-only` for Next.js; under plain tsx that
// marker module throws on import. Neutralise it for this one-off, exactly as
// the unit suite does, before the service is loaded below.
const ORIGINAL_LOAD = (Module as unknown as { _load: (...args: unknown[]) => unknown })._load;
(Module as unknown as { _load: (...args: unknown[]) => unknown })._load = function patched(
  ...args: unknown[]
) {
  if (args[0] === "server-only") return {};
  return ORIGINAL_LOAD.apply(this, args);
};

type LeakedRow = {
  order_id: string;
  user_id: string;
  coupon_code: string;
  subject: string | null;
  kind: string;
  discount_minor: number;
  redemption_id: string;
};

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply || process.argv.includes("--dry-run");
  const label = dryRun ? "[coupon-late-commits DRY-RUN]" : "[coupon-late-commits]";

  if (!process.env.USER_DATABASE_URL) {
    console.error("USER_DATABASE_URL is not set — load the env file before running.");
    process.exit(1);
  }

  const { getUserPostgresPool } = await import("@/server/user-postgres");
  const { ensurePricingSchema } = await import("@/server/pricing/pricing-schema");
  const { commitOrRecommitCoupon } = await import("@/server/pricing/coupons-service");

  const pool = getUserPostgresPool();
  if (!pool) throw new Error("USER_DATABASE_URL is not configured");
  // Guarantees the `overrun` column exists (no-op once the migration ran).
  await ensurePricingSchema();

  // Sizing query from the spec: paid orders whose hold is still `released`.
  const leaked = await pool.query<LeakedRow>(
    `SELECT o.id AS order_id, o.user_id, o.coupon_code, o.subject, o.kind::text AS kind,
            o.discount_minor, r.id AS redemption_id
       FROM payments.orders o
       JOIN pricing.coupon_redemptions r ON r.order_id = o.id AND r.code = o.coupon_code
      WHERE o.status = 'paid' AND r.state = 'released'
      ORDER BY o.paid_at ASC NULLS LAST, o.id ASC`,
  );
  console.log(`${label} ${leaked.rowCount ?? 0} paid order(s) with a released coupon hold.`);
  if ((leaked.rowCount ?? 0) === 0) {
    await pool.end();
    return;
  }

  const totals = { committed: 0, recommitted: 0, overrun: 0, failed: 0 };
  for (const row of leaked.rows) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Same lock as applyPaymentSuccess so a live capture for this student
      // cannot interleave with the backfill.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [row.user_id]);
      const outcome = await commitOrRecommitCoupon(
        {
          code: row.coupon_code,
          userId: row.user_id,
          orderId: row.order_id,
          subject: row.subject,
          targetKind: row.kind === "bundle_term" ? "bundle" : "subject",
          amountDiscountedMinor: Number(row.discount_minor) || 0,
        },
        client,
      );
      if (outcome === "overrun") {
        await client.query(
          `UPDATE payments.orders SET notes = notes || '{"coupon_overrun":true}'::jsonb WHERE id = $1`,
          [row.order_id],
        );
      }
      await client.query(dryRun ? "ROLLBACK" : "COMMIT");
      totals[outcome] += 1;
      console.log(
        `${label} ${dryRun ? "would commit" : "committed"} ${row.coupon_code} on ${row.order_id} ` +
          `(user ${row.user_id}, redemption ${row.redemption_id}) → ${outcome}`,
      );
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      totals.failed += 1;
      console.error(
        `${label} FAILED ${row.coupon_code} on ${row.order_id}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      client.release();
    }
  }

  console.log(
    `${label} done: ${totals.recommitted} recommitted, ${totals.overrun} overrun (cap oversold, flagged), ` +
      `${totals.committed} already committed, ${totals.failed} failed.`,
  );
  if (dryRun) console.log(`${label} nothing was written. Re-run with --apply to commit.`);
  await pool.end();
  if (totals.failed > 0) process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
