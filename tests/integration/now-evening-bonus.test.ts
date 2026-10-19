/**
 * Pilot evening bonus (pilot readiness item 5) against a real Postgres, on a
 * fixed evening in January 2030: who is paid, that a re-run pays nobody
 * twice, that the coins are spendable at once, and that "off" pays nothing.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { payEveningBonuses } from "@/server/now/evening-bonus-service";
import { getWalletBalance } from "@/server/now/ledger-store";
import { runNowNightly } from "@/server/now/session-service";
import { setSetting } from "@/server/platform-settings";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, assertLedgerBalanced, cleanupNowFixtures, helpersMade, seedHelper, setup } from "./_now";

test.after(async () => {
  if (!NOW_SKIP) {
    await rawPool().query(`DELETE FROM now.roster WHERE helper_id = ANY($1::text[])`, [helpersMade]);
    await rawPool().query(`DELETE FROM now.presence_minutes WHERE helper_id = ANY($1::text[])`, [helpersMade]);
    await setSetting("now_evening_bonus", JSON.stringify({ enabled: false, coins: 0, minOnlinePercent: 90, requireRoster: true }), null);
  }
  await cleanupNowFixtures();
  await closePool();
});

const ist = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`);
const EVENING = "2030-01-07";
const NIGHT = ist("2030-01-08", "02:00"); // when the nightly job runs

async function online(helperId: string, minutes: number) {
  for (let m = 0; m < minutes; m += 1) {
    await rawPool().query(`INSERT INTO now.presence_minutes (helper_id, minute) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      helperId,
      new Date(ist(EVENING, "18:00").getTime() + m * 60_000),
    ]);
  }
}

test("solvers online for 90% of a rostered shift get the bonus once", { skip: NOW_SKIP }, async () => {
  await setup();
  await setSetting("now_open_hours", JSON.stringify({ from: "18:00", to: "22:00", days: [0, 1, 2, 3, 4, 5, 6] }), null);
  try {
    const full = await seedHelper("physics"); // rostered, 216 of 240 minutes (90%)
    const notRostered = await seedHelper("physics"); // the whole shift, never ticked the evening
    const short = await seedHelper("physics"); // rostered, 100 minutes
    const paused = await seedHelper("physics"); // rostered, whole shift, but restricted
    for (const h of [full, short, paused]) {
      await rawPool().query(`INSERT INTO now.roster (helper_id, day, subject) VALUES ($1, $2, 'physics')`, [h.helperId, EVENING]);
    }
    await online(full.helperId, 216);
    await online(notRostered.helperId, 240);
    await online(short.helperId, 100);
    await online(paused.helperId, 240);
    await rawPool().query(`UPDATE now.helpers SET verification_status = 'restricted' WHERE id = $1`, [paused.helperId]);

    await setSetting("now_evening_bonus", JSON.stringify({ enabled: false, coins: 25, minOnlinePercent: 90, requireRoster: true }), null);
    assert.deepEqual(await payEveningBonuses(NIGHT), { enabled: false, evenings: [], paid: 0, coins: 0 }, "off pays nothing");

    await setSetting("now_evening_bonus", JSON.stringify({ enabled: true, coins: 25, minOnlinePercent: 90, requireRoster: true }), null);
    assert.equal((await payEveningBonuses(ist(EVENING, "21:00"))).evenings.includes(EVENING), false, "not before the shift ends");

    const first = await runNowNightly(NIGHT);
    assert.equal(first.eveningBonus?.paid, 1);
    assert.equal(first.eveningBonus?.coins, 25);
    assert.ok(first.eveningBonus?.evenings.includes(EVENING));
    const again = await payEveningBonuses(NIGHT);
    assert.equal(again.paid, 0, "a second run pays nobody twice");

    const balances = await Promise.all([full, notRostered, short, paused].map((h) => getWalletBalance(h.userId, NIGHT)));
    assert.deepEqual(
      balances.map((b) => b.available),
      [25, 0, 0, 0],
      "only the rostered solver online for 90% is paid, and it is spendable at once",
    );

    // With the roster rule off, the solver who never ticked the evening qualifies too.
    await setSetting("now_evening_bonus", JSON.stringify({ enabled: true, coins: 25, minOnlinePercent: 90, requireRoster: false }), null);
    assert.equal((await payEveningBonuses(NIGHT)).paid, 1);
    assert.equal((await getWalletBalance(notRostered.userId, NIGHT)).available, 25);
    await assertLedgerBalanced();
  } finally {
    await setup();
  }
});
