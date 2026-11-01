/**
 * `ogcode:import:replace` and `origin-ai:vectors:import:replace` are documented
 * local-setup steps that delete/truncate whatever database `.env.local` points
 * at. These pin the host guard and the OGCode import's owned-rows planning, so
 * a replace never reaches prod by accident and never deletes contributed or
 * contest-import questions.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CONFIRM_HOST_ENV,
  PROD_OVERRIDE_FLAG,
  checkDestructiveTarget,
  databaseHostOf,
  isLocalDatabaseHost,
  queryHostsOf,
  withoutGuardFlags,
} from "../../scripts/lib/destructive-db-guard.mjs";
import { BANK_ID_PATTERN, isBankOwnedRow, planBankImport } from "../../scripts/lib/ogcode-import-plan.mjs";

const root = new URL("../..", import.meta.url).pathname;
const NEON = "postgresql://u:p@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const NEON_HOST = "ep-cool-name-123456.ap-southeast-1.aws.neon.tech";

// ── host check ──────────────────────────────────────────────────────────────

test("isLocalDatabaseHost: loopback names and addresses only", () => {
  for (const host of ["localhost", "LOCALHOST", "127.0.0.1", "127.1.2.3", "::1", "[::1]", "db.localhost"]) {
    assert.equal(isLocalDatabaseHost(host), true, host);
  }
  for (const host of [NEON_HOST, "localhost.evil.com", "127.0.0.1.nip.io", "10.0.0.5", "postgres", "", null]) {
    assert.equal(isLocalDatabaseHost(host), false, String(host));
  }
});

test("databaseHostOf: parses the URL host, not a substring", () => {
  assert.equal(databaseHostOf("postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode"), "127.0.0.1");
  assert.equal(databaseHostOf(NEON), NEON_HOST);
  assert.equal(databaseHostOf("postgresql+asyncpg://u:p@LocalHost:5432/db"), "localhost");
  assert.equal(databaseHostOf("postgresql://u:p@[::1]:5432/db"), "::1");
  assert.equal(databaseHostOf("postgresql:///db?host=/var/run/postgresql"), "/var/run/postgresql");
  // A password or db name containing "localhost" must not make a remote URL look local.
  assert.equal(databaseHostOf(`postgresql://u:localhost@${NEON_HOST}/localhost`), NEON_HOST);
  assert.equal(databaseHostOf("not a url"), null);
  assert.equal(databaseHostOf(""), null);
  assert.equal(databaseHostOf(undefined), null);
});

test("checkDestructiveTarget: local hosts are allowed with no flags", () => {
  const r = checkDestructiveTarget({
    connectionString: "postgresql://origin:origin123@127.0.0.1:54329/origin_v1_ogcode",
    argv: [],
    env: {},
    action: "test",
  });
  assert.equal(r.allowed, true);
  assert.equal(r.local, true);
});

test("checkDestructiveTarget: a socket path is local", () => {
  const r = checkDestructiveTarget({
    connectionString: "postgresql:///db?host=/var/run/postgresql",
    argv: [],
    env: {},
    action: "test",
  });
  assert.equal(r.allowed, true);
});

test("checkDestructiveTarget: a remote host is refused by default", () => {
  const r = checkDestructiveTarget({ connectionString: NEON, argv: ["--replace"], env: {}, action: "test" });
  assert.equal(r.allowed, false);
  assert.match(r.reason, new RegExp(PROD_OVERRIDE_FLAG));
  assert.match(r.reason, new RegExp(CONFIRM_HOST_ENV));
});

test("checkDestructiveTarget: the flag alone is not enough", () => {
  const r = checkDestructiveTarget({ connectionString: NEON, argv: [PROD_OVERRIDE_FLAG], env: {}, action: "test" });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /does not match/);
});

test("checkDestructiveTarget: the env confirmation alone is not enough", () => {
  const r = checkDestructiveTarget({
    connectionString: NEON,
    argv: [],
    env: { [CONFIRM_HOST_ENV]: NEON_HOST },
    action: "test",
  });
  assert.equal(r.allowed, false);
});

test("checkDestructiveTarget: an env confirmation naming a different host is refused", () => {
  const r = checkDestructiveTarget({
    connectionString: NEON,
    argv: [PROD_OVERRIDE_FLAG],
    env: { [CONFIRM_HOST_ENV]: "ep-other-host.neon.tech" },
    action: "test",
  });
  assert.equal(r.allowed, false);
});

test("checkDestructiveTarget: flag + matching host confirmation allows a remote host", () => {
  const r = checkDestructiveTarget({
    connectionString: NEON,
    argv: [PROD_OVERRIDE_FLAG],
    env: { [CONFIRM_HOST_ENV]: ` ${NEON_HOST.toUpperCase()} ` },
    action: "test",
  });
  assert.equal(r.allowed, true);
  assert.equal(r.local, false);
});

test("checkDestructiveTarget: an unparseable URL fails closed", () => {
  const r = checkDestructiveTarget({
    connectionString: "garbage",
    argv: [PROD_OVERRIDE_FLAG],
    env: { [CONFIRM_HOST_ENV]: "garbage" },
    action: "test",
  });
  assert.equal(r.allowed, false);
});

test("R3-12: a URL with several host= values is refused, even with the override", () => {
  const attack = `postgres://u:p@localhost/db?host=localhost&host=${NEON_HOST}`;
  assert.deepEqual(queryHostsOf(attack), ["localhost", NEON_HOST]);
  assert.equal(databaseHostOf(attack), null);
  for (const [argv, env] of [
    [[], {}],
    [[PROD_OVERRIDE_FLAG], { [CONFIRM_HOST_ENV]: NEON_HOST }],
    [[PROD_OVERRIDE_FLAG], { [CONFIRM_HOST_ENV]: "localhost" }],
  ] as const) {
    const r = checkDestructiveTarget({ connectionString: attack, argv, env, action: "test" });
    assert.equal(r.allowed, false);
    assert.match(r.reason, /names 2 hosts/);
  }
  // two LOCAL host values are still ambiguous: refused
  const twoLocal = checkDestructiveTarget({
    connectionString: "postgres://u:p@localhost/db?host=localhost&host=127.0.0.1",
    argv: [],
    env: {},
    action: "test",
  });
  assert.equal(twoLocal.allowed, false);
});

test("R3-12: the host the guard judges is the host pg actually connects to", async () => {
  const { parse } = await import("pg-connection-string");
  const urls = [
    "postgres://u:p@localhost/db",
    `postgres://u:p@localhost/db?host=${NEON_HOST}`,
    `postgres://u:p@${NEON_HOST}/db?host=localhost`,
    "postgresql:///db?host=/var/run/postgresql",
  ];
  for (const url of urls) assert.equal(databaseHostOf(url), parse(url).host?.toLowerCase(), url);
});

test("R3-12: a single non-local host= value is refused; an empty one fails closed", () => {
  const remote = checkDestructiveTarget({
    connectionString: `postgres://u:p@localhost/db?host=${NEON_HOST}`,
    argv: [],
    env: {},
    action: "test",
  });
  assert.equal(remote.allowed, false);
  assert.equal(remote.host, NEON_HOST);
  assert.equal(databaseHostOf("postgres://u:p@localhost/db?host="), null);
});

// ── arg parsing ─────────────────────────────────────────────────────────────

test("withoutGuardFlags strips only the override flag", () => {
  assert.deepEqual(withoutGuardFlags(["import", "--replace", PROD_OVERRIDE_FLAG, "--file", "x"]), [
    "import",
    "--replace",
    "--file",
    "x",
  ]);
});

// ── owned-rows filter ───────────────────────────────────────────────────────

test("isBankOwnedRow: only importer-minted ids without contributed/contest flags", () => {
  assert.equal(isBankOwnedRow({ id: "ogcode_phy_0001", source_index: 1 }), true);
  assert.equal(isBankOwnedRow({ id: "ogcode_nf_chem_0042", source_index: 2 }), true);
  assert.equal(isBankOwnedRow({ id: "ogcode_phy_0001", source_index: 1, is_contributed: true }), false);
  assert.equal(isBankOwnedRow({ id: "ogcode_bio_0003", source_index: 3, is_contest_import: true }), false);
  assert.equal(isBankOwnedRow({ id: "contest-manual:u1:1700000000000", source_index: 9 }), false);
  assert.equal(isBankOwnedRow({ id: "3f2b9c1e-0000-4000-8000-000000000000", source_index: 9 }), false);
  assert.equal(BANK_ID_PATTERN.test("ogcode_phy_0001x"), false);
});

const bank = (code: string, n: number) =>
  Array.from({ length: n }, (_, i) => `ogcode_${code}_${String(i + 1).padStart(4, "0")}`);

test("planBankImport: an empty table numbers the bank 1..N", () => {
  const ids = bank("phy", 3);
  const plan = planBankImport({ incomingIds: ids, existingRows: [], replace: false });
  assert.deepEqual([...plan.sourceIndexById.values()], [1, 2, 3]);
  assert.deepEqual(plan.parking, []);
  assert.deepEqual(plan.staleOwnedIds, []);
  assert.deepEqual(plan.protectedIds, []);
});

test("planBankImport: a grown bank skips indices held by contributed rows (no UNIQUE collision)", () => {
  // Bank was 1..3, then a contributed row took MAX+1 = 4 and a contest import took 5.
  const existingRows = [
    ...bank("phy", 3).map((id, i) => ({ id, source_index: i + 1, is_contributed: false, is_contest_import: false })),
    { id: "q_teacher_1", source_index: 4, is_contributed: true, is_contest_import: false },
    { id: "contest:job:1", source_index: 5, is_contributed: true, is_contest_import: true },
  ];
  const incomingIds = bank("phy", 5);
  const plan = planBankImport({ incomingIds, existingRows, replace: false });

  assert.deepEqual(
    incomingIds.map((id) => plan.sourceIndexById.get(id)),
    [1, 2, 3, 6, 7],
  );
  const finalIndices = [...plan.sourceIndexById.values(), 4, 5];
  assert.equal(new Set(finalIndices).size, finalIndices.length, "source_index stays unique");
  // The three existing bank rows are parked on distinct negative indices first.
  assert.equal(plan.parking.length, 3);
  assert.ok(plan.parking.every((p) => p.source_index < 0));
  assert.equal(new Set(plan.parking.map((p) => p.source_index)).size, 3);
});

test("planBankImport: --replace deletes only stale bank rows, never contributed/contest rows", () => {
  const existingRows = [
    { id: "ogcode_phy_0001", source_index: 1, is_contributed: false, is_contest_import: false },
    { id: "ogcode_phy_0002", source_index: 2, is_contributed: false, is_contest_import: false },
    { id: "q_teacher_1", source_index: 3, is_contributed: true, is_contest_import: false },
    { id: "contest:job:1", source_index: 4, is_contributed: true, is_contest_import: true },
  ];
  const plan = planBankImport({ incomingIds: ["ogcode_phy_0001"], existingRows, replace: true });
  assert.deepEqual(plan.staleOwnedIds, ["ogcode_phy_0002"]);
  assert.equal(plan.sourceIndexById.get("ogcode_phy_0001"), 1);
});

test("planBankImport: --replace frees a stale bank row's index; a plain import keeps it reserved", () => {
  const existingRows = [
    { id: "ogcode_phy_0001", source_index: 1, is_contributed: false, is_contest_import: false },
    { id: "ogcode_chem_0001", source_index: 2, is_contributed: false, is_contest_import: false },
  ];
  const incomingIds = ["ogcode_phy_0001", "ogcode_phy_0002"];
  const replaced = planBankImport({ incomingIds, existingRows, replace: true });
  assert.deepEqual([...replaced.sourceIndexById.values()], [1, 2]);
  const kept = planBankImport({ incomingIds, existingRows, replace: false });
  assert.deepEqual([...kept.sourceIndexById.values()], [1, 3]);
  assert.deepEqual(kept.staleOwnedIds, ["ogcode_chem_0001"]);
});

test("planBankImport: a bank id already owned by a contributed row is skipped, not overwritten", () => {
  const existingRows = [{ id: "ogcode_phy_0001", source_index: 1, is_contributed: true, is_contest_import: false }];
  const plan = planBankImport({ incomingIds: ["ogcode_phy_0001", "ogcode_phy_0002"], existingRows, replace: true });
  assert.deepEqual(plan.protectedIds, ["ogcode_phy_0001"]);
  assert.equal(plan.sourceIndexById.has("ogcode_phy_0001"), false);
  assert.equal(plan.sourceIndexById.get("ogcode_phy_0002"), 2);
  assert.deepEqual(plan.staleOwnedIds, []);
});

test("planBankImport: parking indices avoid existing negative indices", () => {
  const existingRows = [
    { id: "ogcode_phy_0001", source_index: 1, is_contributed: false, is_contest_import: false },
    { id: "legacy_odd", source_index: -4, is_contributed: false, is_contest_import: false },
  ];
  const plan = planBankImport({ incomingIds: ["ogcode_phy_0001"], existingRows, replace: false });
  assert.deepEqual(plan.parking, [{ id: "ogcode_phy_0001", source_index: -5 }]);
});

test("planBankImport: duplicate incoming ids are rejected", () => {
  assert.throws(() => planBankImport({ incomingIds: ["a", "a"], existingRows: [], replace: false }), /Duplicate/);
});

// ── the scripts actually use the guard ──────────────────────────────────────

test("both replace scripts call the host guard and no longer wipe whole tables blindly", () => {
  const ogcode = readFileSync(`${root}scripts/import-ogcode-questions.mjs`, "utf8");
  assert.match(ogcode, /checkDestructiveTarget\(/);
  assert.match(ogcode, /planBankImport\(/);
  assert.doesNotMatch(ogcode, /DELETE FROM ogcode_questions"\)/);
  assert.match(ogcode, /WHERE ogcode_questions\.is_contributed = FALSE/);

  const vectors = readFileSync(`${root}scripts/origin-ai-vectors.mjs`, "utf8");
  assert.match(vectors, /checkDestructiveTarget\(/);
  const guardAt = vectors.indexOf("checkDestructiveTarget(");
  const truncateAt = vectors.indexOf("TRUNCATE origin_ai.concept_embeddings");
  assert.ok(guardAt > 0 && guardAt < truncateAt, "guard runs before the TRUNCATE");
});
