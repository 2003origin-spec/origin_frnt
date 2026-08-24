/**
 * Stage B step 8 of the cutover runbook: remove test-mode payment data before
 * the account starts moving real money.
 *
 * Why this exists rather than the three-line DELETE the runbook used to carry
 * ------------------------------------------------------------------------
 * `DELETE FROM payments.orders WHERE livemode = false` does NOT remove the
 * access those orders bought. `entitlements.subject_grants.order_id` has **no
 * foreign key** to `payments.orders` — deliberately, so a grant survives ledger
 * maintenance — which means the documented purge leaves every test-mode
 * purchase as an *active premium grant with no order behind it*. Students who
 * "bought" with a Razorpay test card would keep paid access after cutover, and
 * nothing in the ledger would explain why.
 *
 * So the order matters, and it is the reverse of the dependency order:
 *   1. revoke the grants those test orders created  (no FK — must be first)
 *   2. recompute the derived premium flags for the affected users
 *   3. refunds → payments → orders → events        (FKs cascade downward)
 *   4. coupon redemptions attached to those orders
 *
 * Everything is scoped by `livemode = false`. A live row is never touched, and
 * the script refuses to run at all when RAZORPAY_MODE is not test unless you
 * say so explicitly.
 *
 * Usage
 * -----
 *   npx tsx --env-file=.env.local scripts/purge-test-payments.ts          # dry run
 *   npx tsx --env-file=.env.local scripts/purge-test-payments.ts --apply  # execute
 *
 * Dry run is the default and prints exactly what would be deleted. `--apply`
 * runs the whole thing in ONE transaction, so it either fully lands or not at
 * all. Plan: V1/RAZORPAY_PAYMENTS_PLAN.md §12 Stage B.
 */

import { recomputeUserPremiumFlags } from "@/server/entitlements";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

const apply = process.argv.includes("--apply");
const force = process.argv.includes("--force");

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exit(1);
}

async function main() {
  if (!isUserPostgresConfigured()) fail("USER_DATABASE_URL is not configured.");

  const mode = process.env.RAZORPAY_MODE?.trim().toLowerCase() === "live" ? "live" : "test";
  if (mode === "live" && !force) {
    fail(
      "RAZORPAY_MODE=live. This purge only ever deletes livemode=false rows, so it is " +
        "safe — but running it against a live deployment is almost never what you " +
        "meant. Re-run with --force if it is.",
    );
  }

  // `?? fail(...)` rather than an if-guard: `fail` returns `never`, so this
  // narrows `pool` to a real Pool for the nested helpers below too.
  const pool = getUserPostgresPool() ?? fail("USER_DATABASE_URL is not configured.");

  /** Counts first, so a dry run and the real run report the same numbers. */
  async function survey() {
    const res = await pool.query(`
      SELECT
        (SELECT count(*)::int FROM payments.orders   WHERE livemode = false) AS orders,
        (SELECT count(*)::int FROM payments.payments WHERE livemode = false) AS payments,
        (SELECT count(*)::int FROM payments.refunds  WHERE livemode = false) AS refunds,
        (SELECT count(*)::int FROM payments.events   WHERE livemode = false) AS events,
        (SELECT count(*)::int FROM entitlements.subject_grants g
           JOIN payments.orders o ON o.id = g.order_id
          WHERE g.source = 'paid_order' AND o.livemode = false) AS grants,
        (SELECT count(DISTINCT g.user_id)::int FROM entitlements.subject_grants g
           JOIN payments.orders o ON o.id = g.order_id
          WHERE g.source = 'paid_order' AND o.livemode = false) AS grant_users,
        (SELECT count(*)::int FROM pricing.coupon_redemptions r
           JOIN payments.orders o ON o.id = r.order_id
          WHERE o.livemode = false) AS coupon_redemptions,
        (SELECT count(*)::int FROM payments.orders WHERE livemode = true) AS live_orders_untouched
    `);
    return res.rows[0] as Record<string, number>;
  }

  const before = await survey();
  console.log("\nTest-mode payment data (livemode = false):");
  console.log(`  orders ................ ${before.orders}`);
  console.log(`  payments .............. ${before.payments}`);
  console.log(`  refunds ............... ${before.refunds}`);
  console.log(`  webhook events ........ ${before.events}`);
  console.log(`  paid grants ........... ${before.grants}  (across ${before.grant_users} user(s))`);
  console.log(`  coupon redemptions .... ${before.coupon_redemptions}`);
  console.log(`\n  live orders (untouched) ${before.live_orders_untouched}`);

  if (!apply) {
    console.log(
      "\nDry run — nothing was deleted. Re-run with --apply to execute.\n" +
        "The paid grants above are the ones a plain DELETE on payments.orders would\n" +
        "have LEFT BEHIND as active premium access.\n",
    );
    await pool.end();
    process.exit(0);
  }

  const client = await pool.connect();
  let affectedUsers: string[] = [];
  try {
    await client.query("BEGIN");

    // 1. The users whose flags must be recomputed afterwards — captured before
    //    the rows they are derived from disappear.
    const users = await client.query<{ user_id: string }>(
      `SELECT DISTINCT g.user_id
         FROM entitlements.subject_grants g
         JOIN payments.orders o ON o.id = g.order_id
        WHERE g.source = 'paid_order' AND o.livemode = false`,
    );
    affectedUsers = users.rows.map((row) => row.user_id);

    // 2. Grants first: no FK means nothing else will remove them.
    const grants = await client.query(
      `DELETE FROM entitlements.subject_grants g
        USING payments.orders o
        WHERE o.id = g.order_id AND g.source = 'paid_order' AND o.livemode = false`,
    );

    // 3. Coupon holds/redemptions pointing at those orders.
    const redemptions = await client.query(
      `DELETE FROM pricing.coupon_redemptions r
        USING payments.orders o
        WHERE o.id = r.order_id AND o.livemode = false`,
    );

    // 4. Money rows, dependency order. Refunds cascade from payments, but they are
    //    deleted explicitly so the reported count is real rather than implied.
    const refunds = await client.query(`DELETE FROM payments.refunds WHERE livemode = false`);
    const payments = await client.query(`DELETE FROM payments.payments WHERE livemode = false`);
    const orders = await client.query(`DELETE FROM payments.orders WHERE livemode = false`);
    const events = await client.query(`DELETE FROM payments.events WHERE livemode = false`);

    await client.query("COMMIT");
    console.log("\nDeleted:");
    console.log(`  grants ${grants.rowCount} · coupon redemptions ${redemptions.rowCount} · refunds ${refunds.rowCount} · payments ${payments.rowCount} · orders ${orders.rowCount} · events ${events.rowCount}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    fail(`Purge failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    client.release();
  }

  // 5. Outside the transaction: is_premium / premium_expiry are derived mirrors,
  //    and recomputing them reads the rows the commit above just settled.
  let recomputed = 0;
  for (const userId of affectedUsers) {
    try {
      await recomputeUserPremiumFlags(userId);
      recomputed += 1;
    } catch (error) {
      console.error(`  ! flag recompute failed for ${userId}: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`  premium flags recomputed for ${recomputed}/${affectedUsers.length} user(s)`);

  const after = await survey();
  const clean =
    after.orders === 0 && after.payments === 0 && after.refunds === 0 && after.events === 0 && after.grants === 0;
  console.log(clean ? "\nTest-mode data purged.\n" : `\nSome rows remain: ${JSON.stringify(after)}\n`);
  await pool.end();
  process.exit(clean ? 0 : 1);
}

main().catch((error) => {
  console.error("[purge-test-payments] failed", error);
  process.exit(1);
});
