/**
 * Launch readiness check (decision B86) against a real Postgres: it reports
 * what the database really holds, and never echoes a secret's value.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getLaunchReadiness } from "@/server/now/launch-check-service";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, cleanupNowFixtures, seedHelper, setup } from "./_now";

test.after(async () => {
  await cleanupNowFixtures();
  await closePool();
});

test("the check reads the real database state and shows env vars only as set / not set", { skip: NOW_SKIP }, async () => {
  await setup();
  await seedHelper("physics");
  const before = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "very-secret-cron-value-123";
  try {
    const result = await getLaunchReadiness();
    const byKey = new Map(result.items.map((i) => [i.key, i]));

    assert.equal(byKey.get("db_tables")?.status, "ok");
    const enumRow = await rawPool().query(
      `SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace
                        WHERE n.nspname = 'payments' AND t.typname = 'order_kind' AND e.enumlabel = 'coin_pack') AS ok`,
    );
    assert.equal(byKey.get("db_coin_pack")?.status, enumRow.rows[0].ok ? "ok" : "missing", "matches pg_enum");

    const verified = await rawPool().query(
      `SELECT count(DISTINCT h.id)::int AS n FROM now.helpers h JOIN now.helper_expertise e ON e.helper_id = h.id
        WHERE h.kind = 'human' AND h.verification_status = 'verified' AND e.subject = 'physics'`,
    );
    assert.match(byKey.get("setup_solvers_physics")!.detail, new RegExp(`^${verified.rows[0].n} verified`));
    assert.equal(byKey.get("setup_prices")?.status, "missing", "setup() empties now.prices, so the placeholders are in use");
    assert.equal(byKey.get("env_cron")?.status, "ok");

    const json = JSON.stringify(result);
    assert.equal(json.includes("very-secret-cron-value-123"), false, "never echoes a secret");
    assert.equal(result.ready, launchReadyFromItems(result.items));
  } finally {
    if (before === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = before;
  }
});

function launchReadyFromItems(items: { status: string }[]): boolean {
  return !items.some((i) => i.status === "missing");
}
