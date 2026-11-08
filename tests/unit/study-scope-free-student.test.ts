/**
 * P1 — zero-purchase students must never generate or open premium tests.
 *
 * Root cause pinned here: `getStudentScope` used to fall back to ALL_SUBJECTS
 * when the student owned nothing, so `scope.subjects` — the field every test
 * builder read — was the full JEE/NEET/PCMB set for a FREE student. The fix
 * adds two gate-derived fields (`entitledSubjects`, `premiumLocked`) and moves
 * every premium surface onto them, while `scope.subjects` keeps its padded
 * value so the OG Code sample pool / QOTD / search stay alive.
 *
 * `getStudentScope` is driven for real here: with no USER_DATABASE_URL the
 * entitlement read returns `[]`, which is exactly a free student under an
 * enforced gate, and the mode read falls back to the default. No DB needed.
 *
 * See V1/docs/bug-fixes/05-payments-entitlements.md §P1.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ALL_SUBJECTS, type Subject } from "../../src/lib/entitlements";
import { ALL_EXAM_PRESETS, getExamBlueprint } from "../../src/lib/exam-blueprints";
import { studyModeSubjects, type StudyMode } from "../../src/lib/study-mode";
import { shouldRedirectFreeStudent, type StudentGate } from "../../src/server/entitlements";
import {
  allowedSubjectsForPremiumSurface,
  assertTestSubjectsOpenable,
  clampSubjectsTo,
  clampSubjectsToScope,
  getStudentScope,
  narrowingSubjectsFilter,
  subjectVisibleUnderMode,
  subjectVisibleUnderScope,
  throwPremiumRequired,
  type StudentScope,
} from "../../src/server/study-scope";
import {
  PresetLockedError,
  createFullLengthTest,
  describePresetAvailability,
  missingSubjectsForPreset,
} from "../../src/server/assessments/full-test-service";
import { createCustomTest } from "../../src/server/assessments";
import type { AppStore, StoredUser } from "../../src/legacy/store";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const OPEN_GATE: StudentGate = { enforced: false, subjects: [], anyPremium: true };
const FREE_GATE: StudentGate = { enforced: true, subjects: [], anyPremium: false };
const premiumGate = (...subjects: Subject[]): StudentGate => ({
  enforced: true,
  subjects,
  anyPremium: subjects.length > 0,
});

/** Hand-built scope with the SAME derivation getStudentScope uses. */
function scopeFor(
  mode: StudyMode,
  gate: StudentGate,
  { enforced = true }: { enforced?: boolean } = {},
): StudentScope {
  const modeSubjects = enforced ? studyModeSubjects(mode) : [...ALL_SUBJECTS];
  const entitled = gate.enforced && gate.anyPremium ? gate.subjects : ALL_SUBJECTS;
  const subjects = enforced
    ? ALL_SUBJECTS.filter((s) => modeSubjects.includes(s) && entitled.includes(s))
    : [...ALL_SUBJECTS];
  return {
    enforced,
    mode,
    explicit: true,
    modeSubjects,
    gate,
    ownedSubjects: gate.enforced ? [...gate.subjects] : [...ALL_SUBJECTS],
    availableModes: [],
    canChooseMode: false,
    subjects,
    starved: enforced && subjects.length === 0,
    entitledSubjects: gate.enforced
      ? ALL_SUBJECTS.filter((s) => modeSubjects.includes(s) && gate.subjects.includes(s))
      : [...modeSubjects],
    premiumLocked: gate.enforced && !gate.anyPremium,
  };
}

type Err403 = Error & { status?: number; code?: string; missing?: Subject[] };

const isPremiumRequired = (err: Err403): boolean => {
  assert.equal(err.status, 403, "routes branch on `status === 403`");
  assert.equal(err.code, "premium_required");
  assert.match(err.message, /subscription/i);
  return true;
};

const FLAGS = {
  premium: "TEACHER_LAUNCH_PREMIUM_SUBSCRIPTIONS",
  modes: "TEACHER_LAUNCH_STUDY_MODES",
} as const;

async function withFlags<T>(values: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const before: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(values)) {
    before[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// ── The honest fields ────────────────────────────────────────────────────────

test("a zero-entitlement student is premiumLocked with no entitled subject, in every mode", () => {
  for (const mode of ["jee", "neet", "pcmb"] as StudyMode[]) {
    const scope = scopeFor(mode, FREE_GATE);
    assert.deepEqual(scope.entitledSubjects, [], `${mode}: owns nothing`);
    assert.equal(scope.premiumLocked, true, `${mode}: locked`);
  }
});

test("scope.subjects stays the MODE set for a free student (OG Code pool / QOTD / search depend on it)", () => {
  // This is the padded value that caused P1 — it is kept on purpose, and the
  // premium surfaces simply stop reading it.
  assert.deepEqual(scopeFor("jee", FREE_GATE).subjects, ["physics", "chemistry", "mathematics"]);
  assert.deepEqual(scopeFor("neet", FREE_GATE).subjects, ["physics", "chemistry", "biology"]);
  assert.deepEqual(scopeFor("pcmb", FREE_GATE).subjects, ALL_SUBJECTS);
  // ...and OG Code's mode-only predicate still lets the free pool through.
  assert.ok(subjectVisibleUnderMode("physics", scopeFor("jee", FREE_GATE)));
  assert.ok(narrowingSubjectsFilter(scopeFor("jee", FREE_GATE)) != null, "QOTD/search still get a mode filter");
});

test("a Physics-only buyer is entitled to Physics and nothing else", () => {
  const scope = scopeFor("pcmb", premiumGate("physics"));
  assert.deepEqual(scope.entitledSubjects, ["physics"]);
  assert.equal(scope.premiumLocked, false);
  // Study Mode can still narrow (never widen) the entitlement.
  assert.deepEqual(scopeFor("neet", premiumGate("physics", "mathematics")).entitledSubjects, ["physics"]);
});

test("entitledSubjects is ALL_SUBJECTS only when neither the gate nor the mode is enforced", () => {
  assert.deepEqual(scopeFor("jee", OPEN_GATE, { enforced: false }).entitledSubjects, ALL_SUBJECTS);
  // Mode on, gate off (flag off / dev): the mode alone decides.
  assert.deepEqual(scopeFor("jee", OPEN_GATE).entitledSubjects, ["physics", "chemistry", "mathematics"]);
  // Gate on, mode off: the gate alone decides.
  assert.deepEqual(scopeFor("jee", premiumGate("biology"), { enforced: false }).entitledSubjects, ["biology"]);
});

// ── subjectVisibleUnderScope: gate first, mode second ────────────────────────

test("a free student sees no subject-tagged premium content, even with Study Mode switched off", () => {
  // The dormant kill-switch: TEACHER_LAUNCH_STUDY_MODES=0 used to short-circuit
  // to `true` before the premium gate was consulted.
  const scope = scopeFor("pcmb", FREE_GATE, { enforced: false });
  for (const subject of [...ALL_SUBJECTS, "mixed", "all", ""]) {
    assert.ok(!subjectVisibleUnderScope(subject, scope), `${JSON.stringify(subject)} leaked through`);
  }
});

test("with Study Mode off and premium on, an unowned subject is still hidden", () => {
  const scope = scopeFor("pcmb", premiumGate("physics"), { enforced: false });
  assert.ok(subjectVisibleUnderScope("physics", scope));
  assert.ok(!subjectVisibleUnderScope("biology", scope), "not owned");
  assert.ok(!subjectVisibleUnderScope("chemistry", scope), "not owned");
  assert.ok(subjectVisibleUnderScope("mixed", scope), "subject-less content still shows for a buyer");
});

test("with both gate and mode off everything is visible", () => {
  const scope = scopeFor("jee", OPEN_GATE, { enforced: false });
  for (const subject of [...ALL_SUBJECTS, "mixed", "nonsense"]) {
    assert.ok(subjectVisibleUnderScope(subject, scope));
  }
});

test("mode still narrows a buyer: owned-but-out-of-mode stays hidden", () => {
  const scope = scopeFor("jee", premiumGate("physics", "biology"));
  assert.ok(subjectVisibleUnderScope("physics", scope));
  assert.ok(!subjectVisibleUnderScope("biology", scope), "owned, outside JEE mode");
  assert.ok(!subjectVisibleUnderScope("chemistry", scope), "in mode, not owned");
});

// ── clampSubjectsTo / allowedSubjectsForPremiumSurface ───────────────────────

test("clampSubjectsTo keeps the null / [] contract of clampSubjectsToScope", () => {
  assert.equal(clampSubjectsTo(null, ["physics"]), null);
  assert.equal(clampSubjectsTo([], ["physics"]), null);
  assert.deepEqual(clampSubjectsTo(["biology"], ["physics"]), []);
  assert.deepEqual(clampSubjectsTo(["bio", "Maths", "phy"], ["physics", "mathematics"]), ["physics", "mathematics"]);
  // null = unrestricted: picks are only canonicalised.
  assert.deepEqual(clampSubjectsTo(["bio", "phy"], null), ["physics", "biology"]);
  // Agrees with the scope-based clamp for every enforced case.
  const scope = scopeFor("jee", premiumGate("physics", "chemistry"));
  assert.deepEqual(clampSubjectsTo(["physics", "biology"], scope.subjects), clampSubjectsToScope(["physics", "biology"], scope));
});

test("a free student's premium draw set is [] (refuse), never null (unrestricted)", () => {
  assert.deepEqual(allowedSubjectsForPremiumSurface(scopeFor("pcmb", FREE_GATE)), []);
  assert.deepEqual(allowedSubjectsForPremiumSurface(scopeFor("pcmb", FREE_GATE, { enforced: false })), []);
  assert.deepEqual(allowedSubjectsForPremiumSurface(scopeFor("jee", premiumGate("physics", "biology"))), ["physics"]);
  assert.equal(allowedSubjectsForPremiumSurface(scopeFor("jee", OPEN_GATE, { enforced: false })), null);
});

test("throwPremiumRequired carries the 403 shape the API routes already map", () => {
  assert.throws(() => throwPremiumRequired(scopeFor("pcmb", FREE_GATE)), isPremiumRequired);
  assert.throws(
    () => throwPremiumRequired(scopeFor("pcmb", FREE_GATE), "Full-length mocks"),
    (err: Err403) => err.message.startsWith("Full-length mocks"),
  );
});

// ── Full-length presets ──────────────────────────────────────────────────────

test("missingSubjectsForPreset lists every subject of every preset for a free student", () => {
  for (const preset of ALL_EXAM_PRESETS) {
    const blueprint = getExamBlueprint(preset);
    assert.deepEqual(missingSubjectsForPreset(blueprint, scopeFor("pcmb", FREE_GATE)), [...blueprint.subjects]);
    // Study Mode off must not unlock anything either.
    assert.deepEqual(
      missingSubjectsForPreset(blueprint, scopeFor("pcmb", FREE_GATE, { enforced: false })),
      [...blueprint.subjects],
      `${preset} unlocked by the Study Mode kill-switch`,
    );
  }
  // JEE Main specifically, as the spec names it.
  assert.deepEqual(
    missingSubjectsForPreset(getExamBlueprint("jee-main"), scopeFor("jee", FREE_GATE)),
    ["physics", "chemistry", "mathematics"],
  );
});

test("missingSubjectsForPreset is [] for an open gate with mode off, and exact for a partial buyer", () => {
  const jeeMain = getExamBlueprint("jee-main");
  assert.deepEqual(missingSubjectsForPreset(jeeMain, scopeFor("jee", OPEN_GATE, { enforced: false })), []);
  assert.deepEqual(missingSubjectsForPreset(jeeMain, scopeFor("jee", premiumGate(...ALL_SUBJECTS))), []);
  assert.deepEqual(missingSubjectsForPreset(jeeMain, scopeFor("jee", premiumGate("physics"))), ["chemistry", "mathematics"]);
  // Gate off, mode on: the mode alone locks NEET for a JEE-mode student.
  assert.deepEqual(missingSubjectsForPreset(getExamBlueprint("neet"), scopeFor("jee", OPEN_GATE)), ["biology"]);
});

test("every preset card is locked for a free student", () => {
  const cards = describePresetAvailability(scopeFor("pcmb", FREE_GATE), ALL_EXAM_PRESETS);
  assert.equal(cards.length, ALL_EXAM_PRESETS.length);
  for (const card of cards) {
    assert.ok(card.locked, `${card.preset} unlocked`);
    assert.equal(card.lockReason?.kind, "missing_subjects");
  }
});

test("createFullLengthTest refuses a free scope with 403 premium_required before touching the bank", async () => {
  await assert.rejects(
    createFullLengthTest({ userId: "u_free", preset: "jee-main", scope: scopeFor("pcmb", FREE_GATE) }),
    isPremiumRequired,
  );
  // ...and the kill-switch variant.
  await assert.rejects(
    createFullLengthTest({ userId: "u_free", preset: "neet", scope: scopeFor("pcmb", FREE_GATE, { enforced: false }) }),
    isPremiumRequired,
  );
});

test("createFullLengthTest locks a partial buyer with PresetLockedError naming the gap", async () => {
  await assert.rejects(
    createFullLengthTest({ userId: "u_phy", preset: "jee-main", scope: scopeFor("jee", premiumGate("physics")) }),
    (err: Err403) => {
      assert.ok(err instanceof PresetLockedError);
      assert.equal(err.status, 403);
      assert.deepEqual(err.missing, ["chemistry", "mathematics"]);
      assert.match(err.message, /Chemistry and Mathematics/);
      return true;
    },
  );
});

// ── The real getStudentScope, no DB ──────────────────────────────────────────

test("getStudentScope: a free student is premiumLocked whether or not Study Mode is enforced", async () => {
  for (const modesFlag of ["1", "0"]) {
    await withFlags({ [FLAGS.premium]: "1", [FLAGS.modes]: modesFlag }, async () => {
      const scope = await getStudentScope("user_free", "student");
      assert.equal(scope.gate.enforced, true);
      assert.equal(scope.enforced, modesFlag === "1");
      assert.equal(scope.premiumLocked, true, `modes=${modesFlag}`);
      assert.deepEqual(scope.entitledSubjects, []);
      assert.ok(scope.subjects.length > 0, "the padded set survives for OG Code paging");
      for (const subject of ALL_SUBJECTS) {
        assert.ok(!subjectVisibleUnderScope(subject, scope), `modes=${modesFlag}: ${subject} leaked`);
      }
      assert.deepEqual(
        missingSubjectsForPreset(getExamBlueprint("jee-main"), scope),
        ["physics", "chemistry", "mathematics"],
      );
    });
  }
});

test("getStudentScope: a teacher / flag-off request is fully open", async () => {
  await withFlags({ [FLAGS.premium]: "1", [FLAGS.modes]: "1" }, async () => {
    const teacher = await getStudentScope("user_teacher", "teacher");
    assert.equal(teacher.premiumLocked, false);
    assert.deepEqual(teacher.entitledSubjects, ALL_SUBJECTS);
    assert.deepEqual(missingSubjectsForPreset(getExamBlueprint("neet"), teacher), []);
  });
  await withFlags({ [FLAGS.premium]: "0", [FLAGS.modes]: "0" }, async () => {
    const dev = await getStudentScope("user_dev", "student");
    assert.equal(dev.premiumLocked, false);
    assert.deepEqual(dev.entitledSubjects, ALL_SUBJECTS);
    assert.equal(allowedSubjectsForPremiumSurface(dev), null);
  });
});

test("the /tests page redirect and premiumLocked agree for the same student", async () => {
  await withFlags({ [FLAGS.premium]: "1", [FLAGS.modes]: "1" }, async () => {
    const free = await getStudentScope("user_free", "student");
    assert.equal(shouldRedirectFreeStudent({ role: "student", entitledSubjects: [] }), free.premiumLocked);
    assert.equal(shouldRedirectFreeStudent({ role: "student", entitledSubjects: ["physics"] }), scopeFor("pcmb", premiumGate("physics")).premiumLocked);
    assert.equal(shouldRedirectFreeStudent({ role: "teacher", entitledSubjects: [] }), (await getStudentScope("t", "teacher")).premiumLocked);
  });
  await withFlags({ [FLAGS.premium]: "0" }, async () => {
    assert.equal(shouldRedirectFreeStudent({ role: "student", entitledSubjects: [] }), (await getStudentScope("user_free", "student")).premiumLocked);
  });
});

// ── createCustomTest: the service entry point behind POST /api/assessments/tests/custom ──

test("createCustomTest refuses a free student with 403 premium_required, on both the service and fallback paths", async () => {
  // The refusal fires before the try/catch whose catch-all used to route every
  // failure into the fallback builder, so nothing is selected or persisted. The
  // store stub proves nothing is read from it either.
  const user = { id: "user_free", role: "student" } as StoredUser;
  const store = {} as AppStore;
  await withFlags({ [FLAGS.premium]: "1", [FLAGS.modes]: "1" }, async () => {
    await assert.rejects(createCustomTest(store, user, { subject: "physics", question_count: 10 }), isPremiumRequired);
    await assert.rejects(createCustomTest(store, user, { subjects: ["physics", "chemistry"], question_count: 10 }), isPremiumRequired);
    await assert.rejects(createCustomTest(store, user, { subject: "mixed", question_count: 10 }), isPremiumRequired);
    await assert.rejects(
      createCustomTest(store, user, { subject_question_counts: { physics: 5, chemistry: 5 } }),
      isPremiumRequired,
    );
  });
  // Study Mode off is not a way around it.
  await withFlags({ [FLAGS.premium]: "1", [FLAGS.modes]: "0" }, async () => {
    await assert.rejects(createCustomTest(store, user, { subject: "physics", question_count: 10 }), isPremiumRequired);
  });
});

// ── Opening a seeded / own test (assertTestOpenableUnderScope) ───────────────

const isOutOfMode = (err: Err403): boolean => {
  assert.equal(err.status, 403);
  assert.equal(err.code, "out_of_study_mode");
  return true;
};
const isOutsideSubscription = (err: Err403): boolean => {
  assert.equal(err.status, 403);
  assert.equal(err.code, undefined);
  assert.equal(err.message, "This test is outside your subscription.");
  return true;
};
const opens = (scope: StudentScope, subject: string, presetSubjects: readonly Subject[] | null = null) => () =>
  assertTestSubjectsOpenable(scope, { subject, presetSubjects });

test("full-length mock hidden only by study mode gets the mode-switch 403, not the subscription one", () => {
  const jeeMain = getExamBlueprint("jee-main").subjects;
  const pcmbBuyer = premiumGate("physics", "chemistry", "mathematics", "biology");
  // a PCMB subscriber who built a JEE Main mock, then switched to NEET mode
  assert.throws(opens(scopeFor("neet", pcmbBuyer), "mixed", jeeMain), isOutOfMode);
  // back in JEE mode it opens
  assert.doesNotThrow(opens(scopeFor("jee", pcmbBuyer), "mixed", jeeMain));
  // Study Mode off, premium gate on: nothing hides it
  assert.doesNotThrow(opens(scopeFor("neet", pcmbBuyer, { enforced: false }), "mixed", jeeMain));
});

test("full-length mock with an UNOWNED subject is still outside the subscription, in any mode", () => {
  const jeeMain = getExamBlueprint("jee-main").subjects;
  const pcb = premiumGate("physics", "chemistry", "biology");
  assert.throws(opens(scopeFor("neet", pcb), "mixed", jeeMain), isOutsideSubscription);
  assert.throws(opens(scopeFor("jee", pcb), "mixed", jeeMain), isOutsideSubscription);
  assert.throws(opens(scopeFor("jee", FREE_GATE), "mixed", jeeMain), isPremiumRequired);
});

test("single-subject test: owned-but-out-of-mode vs unowned (unchanged)", () => {
  const pcmbBuyer = premiumGate("physics", "chemistry", "mathematics", "biology");
  assert.throws(opens(scopeFor("jee", pcmbBuyer), "biology"), isOutOfMode);
  assert.throws(opens(scopeFor("jee", premiumGate("physics")), "chemistry"), isOutsideSubscription);
  assert.doesNotThrow(opens(scopeFor("jee", premiumGate("physics")), "physics"));
  // premium gate off, Study Mode on: an out-of-mode subject is a mode problem, never a billing one
  assert.throws(opens(scopeFor("jee", OPEN_GATE), "biology"), isOutOfMode);
  assert.doesNotThrow(opens(scopeFor("jee", OPEN_GATE, { enforced: false }), "biology"));
});

