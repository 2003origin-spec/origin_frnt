/**
 * Phase 13 — incident control unit tests.
 *
 * Tests the in-memory fallback path (Redis unconfigured) so they can
 * run in plain unit-test CI. Verifies:
 *  - flag overrides round-trip via setFlagOverride/getFlagOverride;
 *  - setFlagOverride("clear") removes the override;
 *  - kill-switch path matching uses the FLAG_KILL_PREFIXES table;
 *  - rate-limit mode round-trips and divisor() returns the right scalar;
 *  - lockdown mode is recognised by isLockdown();
 *  - the snapshot is rebuilt after a mutation (no stale read).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  FLAG_KILL_PREFIXES,
  KILL_SWITCH_EXEMPT_PREFIXES,
  findKillSwitchForPath,
  isKillSwitchExemptPath,
  getFlagOverride,
  getIncidentSnapshot,
  getRateLimitMode,
  isLockdown,
  rateLimitDivisor,
  setFlagOverride,
  setRateLimitMode,
  type RateLimitMode,
} from "../../src/server/incidents";

const root = new URL("../..", import.meta.url).pathname;

test("Phase 13: setFlagOverride('off') is read back as false", async () => {
  await setFlagOverride("teacherTests", "off");
  const v = await getFlagOverride("teacherTests");
  assert.equal(v, false);
  await setFlagOverride("teacherTests", "clear");
});

test("Phase 13: setFlagOverride('on') is read back as true", async () => {
  await setFlagOverride("teacherRooms", "on");
  const v = await getFlagOverride("teacherRooms");
  assert.equal(v, true);
  await setFlagOverride("teacherRooms", "clear");
});

test("Phase 13: setFlagOverride('clear') removes the override", async () => {
  await setFlagOverride("studyMaterials", "off");
  await setFlagOverride("studyMaterials", "clear");
  const v = await getFlagOverride("studyMaterials");
  assert.equal(v, null);
});

test("Phase 13: findKillSwitchForPath matches a killed flag's prefix", async () => {
  await setFlagOverride("documentImport", "off");
  const matched = await findKillSwitchForPath("/api/admin/import-jobs");
  assert.equal(matched, "documentImport");
  // Unrelated path shouldn't match
  const unrelated = await findKillSwitchForPath("/api/users/login");
  assert.equal(unrelated, null);
  await setFlagOverride("documentImport", "clear");
});

test("Phase 13: findKillSwitchForPath ignores 'forced on' overrides", async () => {
  await setFlagOverride("documentImport", "on");
  const matched = await findKillSwitchForPath("/api/admin/import-jobs");
  assert.equal(matched, null);
  await setFlagOverride("documentImport", "clear");
});

// Audit fix R-6 (A-18): documentImport used to list
// `/api/teacher/workspaces` as a kill prefix, which over-matched —
// killing it took down questions/tests/rooms too. The matcher is now
// a function scoped to the `/import-jobs` segment.
test("R-6 A-18: documentImport kill-switch is scoped to import-jobs", async () => {
  await setFlagOverride("documentImport", "off");
  // Should match
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/import-jobs"),
    "documentImport",
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/import-jobs/job_y"),
    "documentImport",
  );
  assert.equal(
    await findKillSwitchForPath("/api/admin/import-jobs"),
    "documentImport",
  );
  assert.equal(
    await findKillSwitchForPath("/api/admin/import-jobs/job_y"),
    "documentImport",
  );
  // Should NOT match — sibling teacher surfaces stay up
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/questions"),
    null,
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/tests"),
    null,
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces/ws_x/rooms"),
    null,
  );
  assert.equal(
    await findKillSwitchForPath("/api/teacher/workspaces"),
    null,
  );
  await setFlagOverride("documentImport", "clear");
});

// Contest (Phase 9): killing the `contest` flag 404s the STUDENT surfaces but
// must NOT take down the internal drain/finalize/publish crons (buffered answers
// still need to persist to Neon during an incident) nor the admin management
// surface (so an admin can still cancel/reschedule to stop the bleeding).
test("Phase 9: contest kill-switch scopes to student surfaces only", async () => {
  await setFlagOverride("contest", "off");
  // Should match — every student contest surface
  for (const p of [
    "/api/contest/register",
    "/api/contest/paper",
    "/api/contest/start",
    "/api/contest/submit",
    "/api/contest/answers",
    "/api/contest/state",
    "/api/contest/result",
    "/api/contest/leaderboard",
    "/api/contest/practice",
    "/api/contest/dpp",
  ]) {
    assert.equal(await findKillSwitchForPath(p), "contest", `expected kill for ${p}`);
  }
  // Should NOT match — internal crons keep draining/finalizing/publishing
  for (const p of [
    "/api/internal/contest/drain",
    "/api/internal/contest/finalize",
    "/api/internal/contest/publish-results",
    "/api/internal/contest/reminders",
  ]) {
    assert.equal(await findKillSwitchForPath(p), null, `cron must survive: ${p}`);
  }
  // Should NOT match — admin can still cancel/reschedule the live contest
  assert.equal(await findKillSwitchForPath("/api/admin/contest"), null);
  assert.equal(await findKillSwitchForPath("/api/admin/contest/c_x/cancel"), null);
  await setFlagOverride("contest", "clear");
});

// N13 (docs/bug-fixes/13-new-infra-android.md finding 2): the matcher already
// listed /api/cbt-student, but the middleware returned on the `public` policy
// branch before ever consulting it. The matcher is asserted here; the ordering
// is asserted end-to-end in tests/middleware-kill-switch-csrf.test.ts.
test("N13: cbtModule kill-switch reaches the anonymous /api/cbt-student surface and the admin allowlist", async () => {
  await setFlagOverride("cbtModule", "off");
  try {
    for (const p of [
      "/api/cbt-student/join",
      "/api/cbt-student/state",
      "/api/cbt-student/answers",
      "/api/cbt/rooms",
      "/api/admin/cbt/teachers",
    ]) {
      assert.equal(await findKillSwitchForPath(p), "cbtModule", `expected kill for ${p}`);
    }
    // The shared drain keeps auto-submitting stranded attempts during an incident.
    assert.equal(await findKillSwitchForPath("/api/internal/cbt/drain"), null);
  } finally {
    await setFlagOverride("cbtModule", "clear");
  }
});

// Ops hazard: `adminControlCenter: ["/api/admin"]` also matched
// /api/admin/incidents/*, so killing it 503'd the un-kill POST and the
// operator was locked out until Redis was edited by hand.
test("adminControlCenter kill leaves the incidents endpoints (the un-kill POST) and launch reachable", async () => {
  await setFlagOverride("adminControlCenter", "off");
  try {
    for (const p of ["/api/admin/users", "/api/admin/ogcode/publish", "/api/admin/import-jobs", "/api/admin/cbt/teachers"]) {
      assert.equal(await findKillSwitchForPath(p), "adminControlCenter", `expected kill for ${p}`);
    }
    for (const p of [
      "/api/admin/incidents",
      "/api/admin/incidents/kill_switch",
      "/api/admin/incidents/rate_limit",
      "/api/admin/incidents/force_logout",
      "/api/admin/launch",
    ]) {
      assert.equal(await findKillSwitchForPath(p), null, `${p} must survive its own kill switch`);
    }
    // A sibling that merely shares the prefix string is still killed.
    assert.equal(await findKillSwitchForPath("/api/admin/incidents-archive"), "adminControlCenter");
    assert.equal(await findKillSwitchForPath("/api/admin/launchpad"), "adminControlCenter");
  } finally {
    await setFlagOverride("adminControlCenter", "clear");
  }
});

test("no kill-switch matcher can ever refuse the incidents endpoints, even with every flag killed", async () => {
  const flags = Object.keys(FLAG_KILL_PREFIXES) as Array<keyof typeof FLAG_KILL_PREFIXES>;
  try {
    for (const flag of flags) await setFlagOverride(flag, "off");
    for (const p of ["/api/admin/incidents", "/api/admin/incidents/kill_switch", "/api/admin/launch"]) {
      assert.equal(await findKillSwitchForPath(p), null, p);
      assert.equal(isKillSwitchExemptPath(p), true, p);
    }
    // The un-kill itself still works while everything is killed.
    await setFlagOverride("adminControlCenter", "clear");
    assert.equal(await findKillSwitchForPath("/api/admin/users"), null);
  } finally {
    for (const flag of flags) await setFlagOverride(flag, "clear");
  }
  assert.deepEqual([...KILL_SWITCH_EXEMPT_PREFIXES], ["/api/admin/incidents", "/api/admin/launch"]);
  assert.equal(isKillSwitchExemptPath("/api/admin/incidents-archive"), false);
  assert.equal(isKillSwitchExemptPath("/api/admin"), false);
});

test("N13: every flag with a kill-switch matcher is selectable from the /admin/incidents action route", () => {
  // The runbook says "/admin/incidents → contest → off"; until N13 the zod enum
  // in the action route did not list `contest` (or `cbtModule`/`originNow`), so
  // the documented lever was a 400 at the API. Pin the two lists together.
  const source = readFileSync(
    join(root, "src/app/api/admin/incidents/[action]/route.ts"),
    "utf8",
  );
  const enumBlock = source.match(/const FLAG_KEYS = \[([\s\S]*?)\] as const;/);
  assert.ok(enumBlock, "FLAG_KEYS enum not found");
  const selectable = new Set(
    [...enumBlock![1].matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]),
  );
  const missing = Object.keys(FLAG_KILL_PREFIXES).filter((flag) => !selectable.has(flag));
  assert.deepEqual(missing, [], "add these flags to FLAG_KEYS in the incidents action route");
});

test("Phase 13: rate-limit mode round-trips", async () => {
  for (const mode of ["relaxed", "normal", "strict", "lockdown"] as RateLimitMode[]) {
    await setRateLimitMode(mode);
    assert.equal(await getRateLimitMode(), mode);
  }
  await setRateLimitMode("normal");
});

test("Phase 13: rateLimitDivisor returns expected scalars", () => {
  assert.equal(rateLimitDivisor("relaxed"), 0.5);
  assert.equal(rateLimitDivisor("normal"), 1);
  assert.equal(rateLimitDivisor("strict"), 2);
  assert.equal(rateLimitDivisor("lockdown"), Number.POSITIVE_INFINITY);
});

test("Phase 13: isLockdown only matches lockdown", () => {
  assert.equal(isLockdown("lockdown"), true);
  assert.equal(isLockdown("strict"), false);
  assert.equal(isLockdown("normal"), false);
  assert.equal(isLockdown("relaxed"), false);
});

test("Phase 13: getIncidentSnapshot reflects mutations", async () => {
  await setFlagOverride("paidEnrollment", "off");
  await setRateLimitMode("strict");
  const snap = await getIncidentSnapshot();
  assert.equal(snap.flagOverrides.paidEnrollment, false);
  assert.equal(snap.rateLimitMode, "strict");
  await setFlagOverride("paidEnrollment", "clear");
  await setRateLimitMode("normal");
});

test("Phase 13: every kill-switch entry references a real flag", () => {
  for (const flag of Object.keys(FLAG_KILL_PREFIXES)) {
    const matcher = FLAG_KILL_PREFIXES[flag as keyof typeof FLAG_KILL_PREFIXES];
    assert.ok(matcher !== undefined, `flag ${flag} has a matcher`);
    if (Array.isArray(matcher)) {
      assert.ok(matcher.length > 0, `flag ${flag} has at least one prefix`);
      for (const p of matcher) {
        assert.match(p, /^\/api\//, `prefix ${p} should be an /api/ path`);
      }
    } else {
      assert.equal(typeof matcher, "function", `flag ${flag} matcher is callable`);
    }
  }
});
