/**
 * AI Feature Toggle epic — precedence truth table (doc 02 §4 / doc 07 §2).
 *
 * evaluateAiAccess is pure (no DB/Redis), so these run with zero mocks.
 * Precedence: role(non-student → deny) > flag-off(→ allow) > global-OFF >
 * user > batch(OFF wins) > workspace(OFF wins) > tier > default ON.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateAiAccess,
  type AiEvalContext,
  type RulePair,
  type RulesSnapshot,
} from "../../src/server/ai-access-eval";

function snapshot(overrides: Partial<RulesSnapshot> = {}): RulesSnapshot {
  return { v: 1, global: { o: true, e: true }, tier: {}, workspace: {}, batch: {}, ...overrides };
}

function ctx(overrides: Partial<AiEvalContext> = {}): AiEvalContext {
  return { role: "student", tier: "free", batchIds: [], wsIds: [], userRule: null, ...overrides };
}

const pair = (o: boolean | null, e: boolean | null): RulePair => ({ o, e });

test("default ON — no rules but the seeded global", () => {
  const d = evaluateAiAccess(snapshot(), ctx(), true);
  assert.equal(d.originAi, true);
  assert.equal(d.decidedBy.originAi, "default");
});

test("global kill is absolute — beats a user ON and a batch ON", () => {
  const d = evaluateAiAccess(
    snapshot({ global: { o: false, e: false }, batch: { b1: pair(true, true) } }),
    ctx({ userRule: pair(true, true), batchIds: ["b1"] }),
    true,
  );
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "global");
});

test("user override rescues a student from a batch OFF", () => {
  const d = evaluateAiAccess(
    snapshot({ batch: { b1: pair(false, false) } }),
    ctx({ userRule: pair(true, true), batchIds: ["b1"] }),
    true,
  );
  assert.equal(d.originAi, true);
  assert.equal(d.decidedBy.originAi, "user");
});

test("user override silences a student inside an enabled cluster", () => {
  const d = evaluateAiAccess(snapshot(), ctx({ userRule: pair(false, false) }), true);
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "user");
});

test("batch OFF applies to its members", () => {
  const d = evaluateAiAccess(
    snapshot({ batch: { b1: pair(false, false) } }),
    ctx({ batchIds: ["b1"] }),
    true,
  );
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "batch");
});

test("multi-batch conflict — OFF wins", () => {
  const d = evaluateAiAccess(
    snapshot({ batch: { b1: pair(true, true), b2: pair(false, false) } }),
    ctx({ batchIds: ["b1", "b2"] }),
    true,
  );
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "batch");
});

test("explicit batch ON beats workspace OFF (specific wins)", () => {
  const d = evaluateAiAccess(
    snapshot({ workspace: { ws1: pair(false, false) }, batch: { b1: pair(true, true) } }),
    ctx({ wsIds: ["ws1"], batchIds: ["b1"] }),
    true,
  );
  assert.equal(d.originAi, true);
  assert.equal(d.decidedBy.originAi, "batch");
});

test("workspace OFF covers unassigned students (no batch rules)", () => {
  const d = evaluateAiAccess(
    snapshot({ workspace: { ws1: pair(false, false) } }),
    ctx({ wsIds: ["ws1"], batchIds: [] }),
    true,
  );
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "workspace");
});

test("multi-workspace conflict — OFF wins", () => {
  const d = evaluateAiAccess(
    snapshot({ workspace: { ws1: pair(true, true), ws2: pair(false, false) } }),
    ctx({ wsIds: ["ws1", "ws2"] }),
    true,
  );
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "workspace");
});

test("tier OFF applies to that tier", () => {
  const d = evaluateAiAccess(
    snapshot({ tier: { free: pair(false, false) } }),
    ctx({ tier: "free" }),
    true,
  );
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "tier");
});

test("tier OFF does not affect the other tier", () => {
  const d = evaluateAiAccess(
    snapshot({ tier: { free: pair(false, false) } }),
    ctx({ tier: "premium" }),
    true,
  );
  assert.equal(d.originAi, true);
  assert.equal(d.decidedBy.originAi, "default");
});

for (const role of ["teacher", "admin", "cbt_teacher"]) {
  test(`role ${role} is denied regardless of rules`, () => {
    const d = evaluateAiAccess(
      snapshot({ global: { o: true, e: true }, batch: { b1: pair(true, true) } }),
      ctx({ role, batchIds: ["b1"], userRule: pair(true, true) }),
      true,
    );
    assert.equal(d.originAi, false);
    assert.equal(d.aiExplainer, false);
    assert.equal(d.decidedBy.originAi, "role");
  });
}

test("role deny wins even when the subsystem flag is off", () => {
  const d = evaluateAiAccess(snapshot(), ctx({ role: "teacher" }), false);
  assert.equal(d.originAi, false);
  assert.equal(d.decidedBy.originAi, "role");
});

test("flag-off makes the subsystem inert for students (all allowed)", () => {
  const d = evaluateAiAccess(
    snapshot({ global: { o: false, e: false } }),
    ctx({ role: "student" }),
    false,
  );
  assert.equal(d.originAi, true);
  assert.equal(d.decidedBy.originAi, "flag_off");
});

test("features are evaluated independently", () => {
  const d = evaluateAiAccess(
    snapshot({ global: { o: true, e: false } }),
    ctx(),
    true,
  );
  assert.equal(d.originAi, true);
  assert.equal(d.aiExplainer, false);
  assert.equal(d.decidedBy.aiExplainer, "global");
});

test("rules for batches the student is not in are ignored", () => {
  const d = evaluateAiAccess(
    snapshot({ batch: { bX: pair(false, false) } }),
    ctx({ batchIds: ["bY"] }),
    true,
  );
  assert.equal(d.originAi, true);
  assert.equal(d.decidedBy.originAi, "default");
});

test("a missing global row is treated as ON (defensive)", () => {
  const noGlobal = { v: 1, tier: {}, workspace: {}, batch: {} } as unknown as RulesSnapshot;
  const d = evaluateAiAccess(noGlobal, ctx(), true);
  assert.equal(d.originAi, true);
  assert.equal(d.decidedBy.originAi, "default");
});
