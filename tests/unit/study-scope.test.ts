/**
 * Study Mode server scope — the composition of Study Mode with the premium gate.
 *
 * `getStudentScope` itself needs a database, so these tests drive the PURE
 * predicates over hand-built StudentScope values. That is exactly the surface
 * every OG Code / DPP / test call site consumes, so the truth tables here are
 * what actually decide what a student sees.
 *
 * See V1/allmd/STUDY_MODE_JEE_NEET_PCMB_PLAN_2026-08-01.md.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ALL_SUBJECTS, type Subject } from "../../src/lib/entitlements";
import { availableStudyModes, studyModeSubjects, type StudyMode } from "../../src/lib/study-mode";
import {
  clampSubjectsToScope,
  effectiveSubjectsForQuery,
  subjectVisibleUnderScope,
  throwOutOfModeForbidden,
  type StudentScope,
} from "../../src/server/study-scope";
import type { StudentGate } from "../../src/server/entitlements";

/** The gate a non-enforced (flag-off / non-student) request carries. */
const OPEN_GATE: StudentGate = { enforced: false, subjects: [], anyPremium: true };
const FREE_GATE: StudentGate = { enforced: true, subjects: [], anyPremium: false };
const premiumGate = (...subjects: Subject[]): StudentGate => ({
  enforced: true,
  subjects,
  anyPremium: subjects.length > 0,
});

/** Builds the scope exactly as getStudentScope would, without touching a DB. */
function scopeFor(
  mode: StudyMode,
  gate: StudentGate,
  { enforced = true, hasGrant = false }: { enforced?: boolean; hasGrant?: boolean } = {},
): StudentScope {
  const modeSubjects = enforced ? studyModeSubjects(mode) : [...ALL_SUBJECTS];
  const entitled = gate.enforced && gate.anyPremium ? gate.subjects : ALL_SUBJECTS;
  const subjects = enforced
    ? ALL_SUBJECTS.filter((s) => modeSubjects.includes(s) && entitled.includes(s))
    : [...ALL_SUBJECTS];
  const ownedSubjects = gate.enforced ? [...gate.subjects] : [...ALL_SUBJECTS];
  const availableModes = enforced
    ? (hasGrant
        ? (["jee", "neet", "pcmb"] as StudyMode[]).filter((m) =>
            studyModeSubjects(m).some((s) => ownedSubjects.includes(s)),
          )
        : availableStudyModes(ownedSubjects))
    : [];
  return {
    enforced,
    mode,
    explicit: true,
    modeSubjects,
    gate,
    ownedSubjects,
    availableModes,
    canChooseMode: enforced && availableModes.length > 0,
    subjects,
    starved: enforced && subjects.length === 0,
  };
}

// ── The no-op contract (flag off / teacher / admin) ───────────────────────────

test("an unenforced scope is a true no-op — every subject stays visible", () => {
  const scope = scopeFor("jee", OPEN_GATE, { enforced: false });
  for (const subject of ALL_SUBJECTS) {
    assert.ok(subjectVisibleUnderScope(subject, scope), `${subject} must stay visible`);
  }
  // Even Biology under JEE mode, because the mode is not being enforced at all.
  assert.ok(subjectVisibleUnderScope("biology", scope));
  assert.ok(!scope.starved);
});

test("an unenforced scope still honours an explicit caller filter, unclamped", () => {
  const scope = scopeFor("jee", OPEN_GATE, { enforced: false });
  assert.deepEqual(clampSubjectsToScope(["biology"], scope), ["biology"]);
  assert.deepEqual(clampSubjectsToScope(["Maths", "bio"], scope), ["mathematics", "biology"]);
});

// ── Mode alone (no premium narrowing) ────────────────────────────────────────

test("JEE mode hides Biology and nothing else", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  assert.deepEqual(scope.subjects, ["physics", "chemistry", "mathematics"]);
  assert.ok(subjectVisibleUnderScope("physics", scope));
  assert.ok(subjectVisibleUnderScope("chemistry", scope));
  assert.ok(subjectVisibleUnderScope("mathematics", scope));
  assert.ok(!subjectVisibleUnderScope("biology", scope));
});

test("NEET mode hides Mathematics and nothing else", () => {
  const scope = scopeFor("neet", OPEN_GATE);
  assert.deepEqual(scope.subjects, ["physics", "chemistry", "biology"]);
  assert.ok(!subjectVisibleUnderScope("mathematics", scope));
  assert.ok(subjectVisibleUnderScope("biology", scope));
});

test("PCMB hides nothing", () => {
  const scope = scopeFor("pcmb", OPEN_GATE);
  assert.deepEqual(scope.subjects, ALL_SUBJECTS);
  for (const subject of ALL_SUBJECTS) {
    assert.ok(subjectVisibleUnderScope(subject, scope));
  }
});

test("loose subject spellings resolve before the mode check", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  assert.ok(subjectVisibleUnderScope("Maths", scope));
  assert.ok(subjectVisibleUnderScope("MATHEMATICS", scope));
  assert.ok(!subjectVisibleUnderScope("Bio", scope));
  assert.ok(!subjectVisibleUnderScope("  BIOLOGY  ", scope));
});

test("subject-less content survives every mode", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  for (const value of ["mixed", "all", "", "   ", null, undefined, "trivia"]) {
    assert.ok(subjectVisibleUnderScope(value, scope), `${JSON.stringify(value)} must stay visible`);
  }
});

// ── Composition with the premium gate ────────────────────────────────────────

test("a free student under an enforced gate sees nothing subject-tagged, mode aside", () => {
  // Unchanged pre-feature behaviour: the premium half of the decision runs first.
  const scope = scopeFor("pcmb", FREE_GATE);
  for (const subject of ALL_SUBJECTS) {
    assert.ok(!subjectVisibleUnderScope(subject, scope));
  }
  assert.ok(!subjectVisibleUnderScope("mixed", scope), "free gate short-circuits before `mixed`");
});

test("the effective set is the intersection of mode and entitlements", () => {
  const scope = scopeFor("jee", premiumGate("physics", "biology"));
  assert.deepEqual(scope.subjects, ["physics"]);
  assert.ok(subjectVisibleUnderScope("physics", scope));
  assert.ok(!subjectVisibleUnderScope("biology", scope), "owned, but outside JEE mode");
  assert.ok(!subjectVisibleUnderScope("chemistry", scope), "inside JEE mode, but not owned");
});

test("study mode can only narrow — never widen — what premium allows", () => {
  const gate = premiumGate("physics");
  for (const mode of ["jee", "neet", "pcmb"] as StudyMode[]) {
    const scope = scopeFor(mode, gate);
    assert.ok(
      scope.subjects.every((s) => gate.subjects.includes(s)),
      `${mode} widened past the entitlement set`,
    );
  }
});

test("a fully-entitled student sees exactly their mode's subjects", () => {
  const gate = premiumGate(...ALL_SUBJECTS);
  assert.deepEqual(scopeFor("jee", gate).subjects, ["physics", "chemistry", "mathematics"]);
  assert.deepEqual(scopeFor("neet", gate).subjects, ["physics", "chemistry", "biology"]);
  assert.deepEqual(scopeFor("pcmb", gate).subjects, ALL_SUBJECTS);
});

test("starved: JEE mode with a Biology-only subscription", () => {
  // The trap case (plan §6.1). We honour the student's explicit choice and flag
  // it, rather than silently overriding the toggle.
  const scope = scopeFor("jee", premiumGate("biology"));
  assert.deepEqual(scope.subjects, []);
  assert.ok(scope.starved);
  assert.ok(!subjectVisibleUnderScope("biology", scope));
  assert.ok(!subjectVisibleUnderScope("physics", scope));
  // Switching to NEET or PCMB rescues them — which is what the empty state offers.
  assert.ok(!scopeFor("neet", premiumGate("biology")).starved);
  assert.ok(!scopeFor("pcmb", premiumGate("biology")).starved);
});

test("a free student is never reported as starved", () => {
  // `starved` means "your mode hides everything you own"; a free student owns
  // nothing, and their empty state is the paywall, not a mode problem.
  for (const mode of ["jee", "neet", "pcmb"] as StudyMode[]) {
    assert.ok(!scopeFor(mode, FREE_GATE).starved, `${mode} misreported a free student`);
  }
});

// ── Toggle availability ──────────────────────────────────────────────────────

test("a one- or two-subject buyer is never offered the toggle", () => {
  for (const owned of [["physics"], ["biology"], ["physics", "chemistry"], ["mathematics", "biology"]] as Subject[][]) {
    const scope = scopeFor("pcmb", premiumGate(...owned));
    assert.ok(!scope.canChooseMode, `${owned.join("+")} should get no toggle`);
    assert.deepEqual(scope.availableModes, []);
  }
});

test("a free student is never offered the toggle", () => {
  const scope = scopeFor("pcmb", FREE_GATE);
  assert.ok(!scope.canChooseMode);
  assert.deepEqual(scope.ownedSubjects, []);
});

test("a full four-subject owner gets all three modes", () => {
  const scope = scopeFor("pcmb", premiumGate(...ALL_SUBJECTS));
  assert.ok(scope.canChooseMode);
  assert.deepEqual(scope.availableModes, ["jee", "neet", "pcmb"]);
});

test("a single-bundle owner sees the toggle with only their bundle selectable", () => {
  const jeeOwner = scopeFor("jee", premiumGate("physics", "chemistry", "mathematics"));
  assert.ok(jeeOwner.canChooseMode, "the toggle is still shown — the unowned modes explain themselves");
  assert.deepEqual(jeeOwner.availableModes, ["jee"]);

  const neetOwner = scopeFor("neet", premiumGate("physics", "chemistry", "biology"));
  assert.ok(neetOwner.canChooseMode);
  assert.deepEqual(neetOwner.availableModes, ["neet"]);
});

test("a selectable mode can never starve the student", () => {
  // The whole point of gating on full ownership: every offered mode is fully
  // owned, so its intersection with the entitlement set is the mode itself.
  const ownedSets: Subject[][] = [
    [...ALL_SUBJECTS],
    ["physics", "chemistry", "mathematics"],
    ["physics", "chemistry", "biology"],
  ];
  for (const owned of ownedSets) {
    const gate = premiumGate(...owned);
    for (const mode of availableStudyModes(owned)) {
      const scope = scopeFor(mode, gate);
      assert.ok(!scope.starved, `${mode} starved an owner of ${owned.join("+")}`);
      assert.deepEqual(scope.subjects, studyModeSubjects(mode));
    }
  }
});

test("starvation remains reachable when an entitlement LAPSES after the choice", () => {
  // Owned PCMB, chose JEE, then P/C/M lapsed leaving only Biology. The stored
  // choice still applies (we never silently rewrite it) — hence the empty state.
  const scope = scopeFor("jee", premiumGate("biology"));
  assert.ok(scope.starved);
  assert.ok(!scope.canChooseMode, "and they can no longer switch out via the toggle");
});

test("an unenforced scope offers no toggle but still reports full ownership", () => {
  const scope = scopeFor("jee", OPEN_GATE, { enforced: false });
  assert.ok(!scope.canChooseMode, "no toggle when the feature itself is off");
  assert.deepEqual(scope.ownedSubjects, ALL_SUBJECTS, "billing must not decide what a dev/teacher sees");
});

// ── clampSubjectsToScope / effectiveSubjectsForQuery ─────────────────────────

test("no caller filter is distinguishable from an empty result", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  // null = "the caller asked for no subject filter" → the caller substitutes the scope.
  assert.equal(clampSubjectsToScope(null, scope), null);
  assert.equal(clampSubjectsToScope(undefined, scope), null);
  assert.equal(clampSubjectsToScope([], scope), null);
  // [] = "the caller filtered, and nothing survived" → the query can only be empty.
  assert.deepEqual(clampSubjectsToScope(["biology"], scope), []);
});

test("clampSubjectsToScope drops out-of-mode picks and normalises the rest", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  assert.deepEqual(clampSubjectsToScope(["physics", "biology"], scope), ["physics"]);
  assert.deepEqual(clampSubjectsToScope(["Maths", "bio", "phy"], scope), ["physics", "mathematics"]);
  assert.deepEqual(clampSubjectsToScope(["nonsense"], scope), []);
});

test("clampSubjectsToScope returns canonical order regardless of caller order", () => {
  const scope = scopeFor("pcmb", OPEN_GATE);
  assert.deepEqual(
    clampSubjectsToScope(["biology", "physics", "mathematics", "chemistry"], scope),
    ALL_SUBJECTS,
  );
});

test("clampSubjectsToScope dedupes repeated picks", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  assert.deepEqual(clampSubjectsToScope(["physics", "phy", "Physics"], scope), ["physics"]);
});

test("effectiveSubjectsForQuery substitutes the scope when the caller filtered nothing", () => {
  const scope = scopeFor("neet", OPEN_GATE);
  assert.deepEqual(effectiveSubjectsForQuery(null, scope), ["physics", "chemistry", "biology"]);
  assert.deepEqual(effectiveSubjectsForQuery(["mathematics"], scope), []);
  assert.deepEqual(effectiveSubjectsForQuery(["biology"], scope), ["biology"]);
});

test("effectiveSubjectsForQuery returns a copy, not the scope's own array", () => {
  const scope = scopeFor("neet", OPEN_GATE);
  const result = effectiveSubjectsForQuery(null, scope);
  result.push("mathematics");
  assert.deepEqual(scope.subjects, ["physics", "chemistry", "biology"]);
});

// ── The 403 path ─────────────────────────────────────────────────────────────

test("throwOutOfModeForbidden carries the 403 shape the API routes already map", () => {
  const scope = scopeFor("jee", OPEN_GATE);
  assert.throws(
    () => throwOutOfModeForbidden("biology", scope),
    (err: Error & { status?: number; code?: string; mode?: string }) => {
      assert.equal(err.status, 403, "routes branch on `status === 403`");
      assert.equal(err.code, "out_of_study_mode");
      assert.equal(err.mode, "jee");
      assert.match(err.message, /Biology/, "names the subject so the UI can explain");
      return true;
    },
  );
});


// ── Granted vs paid: how access was obtained changes toggle eligibility ──────

test("a granted student with a partial subject set still gets the toggle", () => {
  // admin_comp / teacher_code students are treated more permissively than
  // partial PURCHASERS: they didn't choose their subject set, so we don't punish
  // them for it. A mode is offered while it still leaves them something.
  const scope = scopeFor("pcmb", premiumGate("physics", "chemistry"), { hasGrant: true });
  assert.ok(scope.canChooseMode, "granted students always get the toggle");
  assert.deepEqual(scope.availableModes, ["jee", "neet", "pcmb"]);
});

test("the same partial subject set from a PURCHASE gets no toggle", () => {
  // The contrast that makes the rule meaningful — identical entitlements, but
  // bought rather than granted.
  const scope = scopeFor("pcmb", premiumGate("physics", "chemistry"), { hasGrant: false });
  assert.ok(!scope.canChooseMode);
  assert.deepEqual(scope.availableModes, []);
});

test("a granted student is never offered a mode that would leave them nothing", () => {
  // Granted Biology only: NEET/PCMB still contain Biology, JEE does not — so JEE
  // is withheld rather than offered as a route to a blank app.
  const scope = scopeFor("neet", premiumGate("biology"), { hasGrant: true });
  assert.deepEqual(scope.availableModes, ["neet", "pcmb"]);
  assert.ok(!scope.availableModes.includes("jee"));
  for (const mode of scope.availableModes) {
    assert.ok(!scopeFor(mode, premiumGate("biology"), { hasGrant: true }).starved);
  }
});

test("a fully-comped student (the common admin_comp shape) gets all three modes", () => {
  // Premium Pro comps grant all four subjects, so grant and purchase rules agree.
  const granted = scopeFor("pcmb", premiumGate(...ALL_SUBJECTS), { hasGrant: true });
  const paid = scopeFor("pcmb", premiumGate(...ALL_SUBJECTS), { hasGrant: false });
  assert.deepEqual(granted.availableModes, ["jee", "neet", "pcmb"]);
  assert.deepEqual(paid.availableModes, granted.availableModes);
});

test("a free student gets no toggle even if flagged as granted", () => {
  // Defensive: a revoked/expired grant leaves hasGrant true with zero subjects.
  // Owning nothing must still mean no toggle.
  const scope = scopeFor("pcmb", FREE_GATE, { hasGrant: true });
  assert.ok(!scope.canChooseMode);
  assert.deepEqual(scope.availableModes, []);
});

// ── Regression: the stale write-back that reverted saved modes ──────────────

test("the user snapshot upsert must never write the study-mode columns", async () => {
  // The bug this pins: `persistUser: true` (8 call sites, including OG Code and
  // test submit) writes a WHOLE user row from `cachedStore` — a per-lambda
  // snapshot with a 5-minute TTL. While study_mode was in that column list, any
  // of those writes from a stale instance silently reverted the student's saved
  // mode in Postgres, and nulled study_mode_prompted_at with it.
  //
  // Columns owned by a dedicated action must stay out of snapshot upserts.
  const { USER_SNAPSHOT_COLUMNS, USER_SNAPSHOT_EXCLUDED_COLUMNS } = await import(
    "../../src/server/store-postgres"
  );
  const columns = new Set<string>(USER_SNAPSHOT_COLUMNS);
  for (const excluded of USER_SNAPSHOT_EXCLUDED_COLUMNS) {
    assert.ok(
      !columns.has(excluded),
      `${excluded} is action-owned and must not be written by the snapshot upsert`,
    );
  }
  assert.equal(USER_SNAPSHOT_COLUMNS.length, 28, "column list changed — re-check the exclusions");
});
