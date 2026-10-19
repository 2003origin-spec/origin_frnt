import assert from "node:assert/strict";
import test from "node:test";

import { launchChecklist, launchVerdict, type LaunchFacts } from "../../src/server/now/launch-check-rules";

function ready(overrides: Partial<LaunchFacts> = {}): LaunchFacts {
  return {
    tablesPresent: true,
    coinPackOrderKind: true,
    coinRedemptionGrantSource: true,
    addonMigrations: [{ id: "20261018_origin_now_roster", applied: true }],
    env: {
      redis: true,
      livekit: true,
      recording: true,
      recordingBucket: "ok",
      privateFiles: "ok",
      email: true,
      cronSecret: true,
      qstash: true,
      razorpay: true,
      kycKey: true,
      webPush: true,
      fcm: true,
    },
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
  for (const key of ["qstash", "razorpay", "kycKey", "webPush", "fcm"] as const) {
    const f = ready({ env: { ...ready().env, [key]: false } });
    const v = launchVerdict(launchChecklist(f));
    assert.deepEqual([v.ready, v.warnings], [true, 1], key);
  }
});

test("a recording bucket that is missing or the public image bucket blocks launch (B87)", () => {
  const withBucket = (recordingBucket: LaunchFacts["env"]["recordingBucket"]) => ready({ env: { ...ready().env, recordingBucket } });

  assert.equal(item(withBucket("ok"), "env_recording_bucket").status, "ok");

  const unset = item(withBucket("not_set"), "env_recording_bucket");
  assert.equal(unset.status, "missing");
  assert.match(unset.detail, /not recorded/);
  assert.match(unset.fix!, /NOW_RECORDING_R2_BUCKET/);

  const exposed = item(withBucket("public"), "env_recording_bucket");
  assert.equal(exposed.status, "missing");
  assert.match(exposed.detail, /public image bucket \(R2_BUCKET_NAME\)/);
  assert.match(exposed.fix!, /never R2_BUCKET_NAME/);

  for (const problem of ["not_set", "public"] as const) {
    assert.deepEqual(launchVerdict(launchChecklist(withBucket(problem))), { ready: false, missing: 1, warnings: 0 }, problem);
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

test("the private file bucket is required and never the public one (B96)", () => {
  const withFiles = (privateFiles: LaunchFacts["env"]["privateFiles"]) => ready({ env: { ...ready().env, privateFiles } });
  assert.equal(item(withFiles("ok"), "env_private_files").status, "ok");
  assert.equal(item(withFiles("not_set"), "env_private_files").status, "missing");
  const exposed = item(withFiles("public"), "env_private_files");
  assert.equal(exposed.status, "missing");
  assert.match(exposed.detail, /public image bucket/);
  assert.equal(launchVerdict(launchChecklist(withFiles("not_set"))).ready, false);
});
