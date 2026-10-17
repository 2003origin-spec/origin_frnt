import assert from "node:assert/strict";
import test from "node:test";

import { launchChecklist, launchVerdict, type LaunchFacts } from "../../src/server/now/launch-check-rules";

function ready(overrides: Partial<LaunchFacts> = {}): LaunchFacts {
  return {
    tablesPresent: true,
    coinPackOrderKind: true,
    coinRedemptionGrantSource: true,
    addonMigrations: [{ id: "20261018_origin_now_roster", applied: true }],
    env: { redis: true, livekit: true, recording: true, email: true, cronSecret: true, qstash: true, razorpay: true, kycKey: true, webPush: true },
    pricesSaved: true,
    packsOnSale: 2,
    welcomeCoinsSet: true,
    agreementIsDraft: false,
    botRow: true,
    solvers: { physics: 3, chemistry: 2, mathematics: 0, biology: 1 },
    cohort: 12,
    storeItemsOnSale: 3,
    flagOn: false,
    killSwitchOn: false,
    ...overrides,
  };
}
const item = (f: LaunchFacts, key: string) => launchChecklist(f).find((i) => i.key === key)!;

test("a fully set-up system is ready even with the flag still off", () => {
  const items = launchChecklist(ready());
  assert.deepEqual(launchVerdict(items), { ready: true, missing: 0, warnings: 0 });
  assert.equal(item(ready(), "switch_flag").status, "info");
  assert.equal(item(ready(), "setup_solvers_mathematics").status, "info", "only the pilot subjects are judged");
});

test("a skipped coin-pack migration is caught and points at migration 2", () => {
  const i = item(ready({ coinPackOrderKind: false }), "db_coin_pack");
  assert.equal(i.status, "missing");
  assert.match(i.fix!, /migration 2/);
  assert.equal(launchVerdict(launchChecklist(ready({ coinPackOrderKind: false }))).ready, false);
});

test("required services are missing when unset, optional ones only need checking", () => {
  for (const key of ["redis", "livekit", "recording", "email", "cronSecret"] as const) {
    const f = ready({ env: { ...ready().env, [key]: false } });
    assert.equal(launchVerdict(launchChecklist(f)).ready, false, key);
  }
  for (const key of ["qstash", "razorpay", "kycKey", "webPush"] as const) {
    const f = ready({ env: { ...ready().env, [key]: false } });
    const v = launchVerdict(launchChecklist(f));
    assert.deepEqual([v.ready, v.warnings], [true, 1], key);
  }
});

test("pilot subjects need two verified solvers; the kill switch blocks launch", () => {
  assert.equal(item(ready({ solvers: { physics: 1, chemistry: 2 } }), "setup_solvers_physics").status, "warn");
  assert.equal(item(ready({ solvers: { physics: 0, chemistry: 2 } }), "setup_solvers_physics").status, "missing");
  assert.equal(item(ready({ killSwitchOn: true }), "switch_kill").status, "missing");
  assert.equal(item(ready({ pricesSaved: false }), "setup_prices").status, "missing");
  assert.equal(item(ready({ agreementIsDraft: true }), "setup_agreement").status, "warn");
});

test("an unreadable kill switch is flagged for checking, not assumed off", () => {
  assert.equal(item(ready({ killSwitchOn: null }), "switch_kill").status, "warn");
});
