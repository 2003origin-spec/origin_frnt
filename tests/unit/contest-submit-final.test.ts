/**
 * Contest submit: the final autosave is never dropped (C3) and the end-time
 * grace is enforced on writes (C4).
 *
 *  - runFinalSaveThenSubmit: the pure ordering/retry the attempt hook uses.
 *  - applySubmitFinal: the submit-carried final draft goes through the same
 *    rev CAS as /answers (in-memory draft buffer; no Redis in unit tests).
 *  - isWriteWindowOpen / isContestWriteOpen: /answers 409s after end + grace.
 *  - resolveFinalizeReason: a late manual submit is finalized as 'deadline'.
 *  - planContestSubmit: a superseded tab can't flag or close-as-malpractice
 *    the live attempt; a plain superseded submit still finalizes.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CONTEST_END_GRACE_SECONDS } from "@/lib/contest/contest-state";
import {
  FINAL_SAVE_ATTEMPTS,
  isContestWriteOpen,
  planContestSubmit,
  resolveFinalizeReason,
  runFinalSaveThenSubmit,
  type FinalSaveOutcome,
} from "@/lib/contest/submit-flow";
import {
  __resetSessionRegistryForTests,
  claimActiveSession,
  isActiveSession,
} from "@/server/contest/contest-session-registry";
import {
  __resetLocalDraftBufferForTests,
  readContestDraft,
  saveContestDraft,
} from "@/server/contest/contest-draft-store";
import {
  __resetContestWriteWindowCacheForTests,
  applySubmitFinal,
  isContestWriteWindowOpenCached,
  isWriteWindowOpen,
  WRITE_WINDOW_CACHE_TTL_MS,
  type ContestWriteWindow,
} from "@/server/contest/contest-submit-service";
import {
  __setWindowCacheRedisForTests,
  invalidateContestWindow,
} from "@/server/contest/contest-window-cache";

const END = new Date("2026-10-22T10:00:00Z");
const at = (offsetSeconds: number) => new Date(END.getTime() + offsetSeconds * 1000);
const noSleep = async () => undefined;

// ── C3: client ordering / retry ─────────────────────────────────────────────

test("final save is flushed once (forced) BEFORE submit", async () => {
  const calls: string[] = [];
  let outcome: FinalSaveOutcome | null = null;
  await runFinalSaveThenSubmit({
    flush: async (opts) => {
      assert.equal(opts.force, true);
      calls.push("flush");
      return 7;
    },
    bumpRev: () => {
      calls.push("bump");
      return 99;
    },
    submit: async (o) => {
      calls.push("submit");
      outcome = o;
    },
    sleep: noSleep,
  });
  assert.deepEqual(calls, ["flush", "submit"]);
  assert.deepEqual(outcome, { saved: true, rev: 7 });
});

test("two failed final saves then success → submit with saved=true", async () => {
  let n = 0;
  const sleeps: number[] = [];
  let outcome: FinalSaveOutcome | null = null;
  await runFinalSaveThenSubmit({
    flush: async () => {
      n += 1;
      if (n < 3) throw new Error("save_failed_503");
      return n;
    },
    bumpRev: () => assert.fail("rev must not be bumped when a save landed"),
    submit: async (o) => {
      outcome = o;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  assert.equal(n, 3);
  assert.deepEqual(sleeps, [400, 800]);
  assert.deepEqual(outcome, { saved: true, rev: 3 });
});

test("every final save fails → submit still runs, carrying a bumped rev", async () => {
  let flushes = 0;
  let rev = 5;
  let outcome: FinalSaveOutcome | null = null;
  await runFinalSaveThenSubmit({
    flush: async () => {
      flushes += 1;
      rev += 1; // the hook bumps its rev before every send, even a failed one
      throw new Error("network");
    },
    bumpRev: () => {
      rev += 1;
      return rev;
    },
    submit: async (o) => {
      outcome = o;
    },
    sleep: noSleep,
  });
  assert.equal(flushes, FINAL_SAVE_ATTEMPTS);
  assert.deepEqual(outcome, { saved: false, rev: 9 });
});

// ── C3: server applies `final` through the CAS ──────────────────────────────

test("submit final with a newer rev is applied before grading", async () => {
  __resetLocalDraftBufferForTests();
  await saveContestDraft("c1", "u1", { answers: { "1": { selectedOption: 0 } }, rev: 3 });

  const res = await applySubmitFinal(
    "c1",
    "u1",
    { answers: { "1": { selectedOption: 2 }, "2": { selectedOption: 1 } }, rev: 4 },
    true,
  );
  assert.deepEqual(res, { applied: true, rev: 4 });
  const draft = await readContestDraft("c1", "u1");
  assert.equal(draft?.rev, 4);
  assert.deepEqual(draft?.answers, { "1": { selectedOption: 2 }, "2": { selectedOption: 1 } });
});

test("submit final with a stale rev is ignored; the buffer keeps the higher rev", async () => {
  __resetLocalDraftBufferForTests();
  await saveContestDraft("c1", "u1", { answers: { "1": { selectedOption: 3 } }, rev: 6 });

  for (const rev of [5, 6]) {
    const res = await applySubmitFinal("c1", "u1", { answers: { "1": { selectedOption: 0 } }, rev }, true);
    assert.deepEqual(res, { applied: false, reason: "stale_draft" });
  }
  const draft = await readContestDraft("c1", "u1");
  assert.equal(draft?.rev, 6);
  assert.deepEqual(draft?.answers, { "1": { selectedOption: 3 } });
});

test("submit final after end + grace is dropped; grading uses the buffered draft", async () => {
  __resetLocalDraftBufferForTests();
  await saveContestDraft("c1", "u1", { answers: { "1": { selectedOption: 1 } }, rev: 2 });

  const res = await applySubmitFinal("c1", "u1", { answers: { "1": { selectedOption: 0 } }, rev: 9 }, false);
  assert.deepEqual(res, { applied: false, reason: "contest_ended" });
  const draft = await readContestDraft("c1", "u1");
  assert.equal(draft?.rev, 2);
});

// ── C4: write window on /answers ────────────────────────────────────────────

test("answers are accepted up to end + grace and 409 contest_ended after", () => {
  const open = (s: number) => isWriteWindowOpen({ endAt: END, serverNow: at(s) });
  assert.equal(open(-60), true);
  assert.equal(open(0), true);
  assert.equal(open(CONTEST_END_GRACE_SECONDS), true);
  assert.equal(open(CONTEST_END_GRACE_SECONDS + 1), false);
  assert.equal(open(3600), false);
});

test("write window is fail-closed for an unknown contest or a missing end_at", () => {
  assert.equal(isWriteWindowOpen(null), false);
  assert.equal(isWriteWindowOpen({ endAt: null, serverNow: at(0) }), false);
  assert.equal(isContestWriteOpen(END.toISOString(), at(5)), true);
});

// ── C4: late manual submit is finalized as 'deadline', never rejected ───────

test("late manual submit → finalize_reason 'deadline'", () => {
  assert.equal(resolveFinalizeReason("manual", END, at(-1)), "manual");
  assert.equal(resolveFinalizeReason("manual", END, at(CONTEST_END_GRACE_SECONDS)), "manual");
  assert.equal(resolveFinalizeReason("manual", END, at(CONTEST_END_GRACE_SECONDS + 1)), "deadline");
  assert.equal(resolveFinalizeReason("manual", END.toISOString(), at(600)), "deadline");
});

test("non-manual reasons and contests without end_at pass through unchanged", () => {
  assert.equal(resolveFinalizeReason("auto", END, at(600)), "auto");
  assert.equal(resolveFinalizeReason("deadline", END, at(600)), "deadline");
  assert.equal(resolveFinalizeReason("manual", null, at(600)), "manual");
});

// ── C4 hot path: cached write-window gate (no Neon read per autosave) ──────

function windowLoader(endAt: Date | null) {
  const state = { endAt, calls: 0 };
  const load = async (): Promise<ContestWriteWindow | null> => {
    state.calls += 1;
    return state.endAt === undefined ? null : { endAt: state.endAt, serverNow: clock.now };
  };
  return { state, load };
}
const clock = { now: at(-600) };
const now = () => clock.now;

test("cached gate: repeated autosaves inside the TTL read the DB once", async () => {
  __resetContestWriteWindowCacheForTests();
  clock.now = at(-600);
  const { state, load } = windowLoader(END);
  for (let i = 0; i < 20; i += 1) {
    assert.equal(await isContestWriteWindowOpenCached("c-hot", { load, now }), true);
  }
  assert.equal(state.calls, 1);
  clock.now = new Date(at(-600).getTime() + WRITE_WINDOW_CACHE_TTL_MS + 1);
  assert.equal(await isContestWriteWindowOpenCached("c-hot", { load, now }), true);
  assert.equal(state.calls, 2, "refreshed after the TTL");
});

test("cached gate: concurrent misses share one DB read", async () => {
  __resetContestWriteWindowCacheForTests();
  clock.now = at(-600);
  const { state, load } = windowLoader(END);
  const results = await Promise.all(
    Array.from({ length: 10 }, () => isContestWriteWindowOpenCached("c-burst", { load, now })),
  );
  assert.ok(results.every(Boolean));
  assert.equal(state.calls, 1);
});

test("cached gate: closes after end + grace, and a closed verdict is confirmed on the DB", async () => {
  __resetContestWriteWindowCacheForTests();
  clock.now = at(-2); // all checks below stay inside one cache TTL
  const { state, load } = windowLoader(END);
  assert.equal(await isContestWriteWindowOpenCached("c-end", { load, now }), true);
  clock.now = at(CONTEST_END_GRACE_SECONDS);
  assert.equal(await isContestWriteWindowOpenCached("c-end", { load, now }), true, "grace is inclusive");
  assert.equal(state.calls, 1);
  clock.now = at(CONTEST_END_GRACE_SECONDS + 1);
  assert.equal(await isContestWriteWindowOpenCached("c-end", { load, now }), false);
  assert.equal(state.calls, 2, "closed by cache → confirmed on the DB");
  // Confirmed-closed is cached: further late saves don't hit the DB.
  assert.equal(await isContestWriteWindowOpenCached("c-end", { load, now }), false);
  assert.equal(state.calls, 2);
});

test("cached gate: an extended end_at is picked up instead of closing a live attempt", async () => {
  __resetContestWriteWindowCacheForTests();
  clock.now = at(-60);
  const { state, load } = windowLoader(END);
  assert.equal(await isContestWriteWindowOpenCached("c-ext", { load, now }), true);
  state.endAt = at(600); // admin extends by 10 minutes
  clock.now = at(CONTEST_END_GRACE_SECONDS + 5); // still inside the cache TTL
  assert.equal(await isContestWriteWindowOpenCached("c-ext", { load, now }), true);
  assert.equal(state.calls, 2);
});

test("cached gate: unknown contest or missing end_at is closed", async () => {
  __resetContestWriteWindowCacheForTests();
  clock.now = at(-60);
  assert.equal(await isContestWriteWindowOpenCached("c-none", { load: async () => null, now }), false);
  assert.equal(
    await isContestWriteWindowOpenCached("c-null", { load: async () => ({ endAt: null, serverNow: at(-60) }), now }),
    false,
  );
});

test("superseded session: a 3rd-strike malpractice submit is refused, never flags the live attempt", async () => {
  __resetSessionRegistryForTests();
  await claimActiveSession("c-dev", "u1", "phone");
  await claimActiveSession("c-dev", "u1", "laptop"); // student moved to the laptop
  const phoneActive = await isActiveSession("c-dev", "u1", "phone");
  assert.equal(phoneActive, false);
  assert.deepEqual(planContestSubmit({ activeSession: phoneActive, malpractice: true, violationCount: 3 }), {
    kind: "refuse",
    detail: "session_superseded",
  });
});

test("superseded session: a plain submit still finalizes, without its strikes or its final draft", () => {
  assert.deepEqual(planContestSubmit({ activeSession: false, violationCount: 2 }), {
    kind: "submit",
    writeFinal: false,
    reason: "manual",
    violationCount: undefined,
    malpractice: false,
  });
  assert.deepEqual(planContestSubmit({ activeSession: false, malpractice: false }), {
    kind: "submit",
    writeFinal: false,
    reason: "manual",
    violationCount: undefined,
    malpractice: false,
  });
});

test("active session: malpractice is an auto close that keeps its flags; plain submit is manual", async () => {
  __resetSessionRegistryForTests();
  await claimActiveSession("c-dev2", "u1", "laptop");
  const active = await isActiveSession("c-dev2", "u1", "laptop");
  assert.equal(active, true);
  assert.deepEqual(planContestSubmit({ activeSession: active, malpractice: true, violationCount: 3 }), {
    kind: "submit",
    writeFinal: true,
    reason: "auto",
    violationCount: 3,
    malpractice: true,
  });
  assert.deepEqual(planContestSubmit({ activeSession: active, violationCount: 1 }), {
    kind: "submit",
    writeFinal: true,
    reason: "manual",
    violationCount: 1,
    malpractice: false,
  });
});

// ── contest-answer-key F9 x contest-submit-window: one invalidation clears this cache ──

test("cached gate: an admin ending the contest early closes a cached 'open' at once", async () => {
  __resetContestWriteWindowCacheForTests();
  __setWindowCacheRedisForTests(null);
  clock.now = at(-600);
  const { state, load } = windowLoader(END);
  assert.equal(await isContestWriteWindowOpenCached("c-early", { load, now }), true);
  // Admin ends it now: end_at moves to the past, then the service invalidates.
  state.endAt = at(-600 - CONTEST_END_GRACE_SECONDS - 1);
  await invalidateContestWindow("c-early");
  assert.equal(await isContestWriteWindowOpenCached("c-early", { load, now }), false, "no stale open inside the TTL");
  assert.equal(state.calls, 2, "the invalidation forced a fresh DB read");
});

test("cached gate: a read in flight across an invalidation is answered but not cached", async () => {
  __resetContestWriteWindowCacheForTests();
  __setWindowCacheRedisForTests(null);
  clock.now = at(-600);
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const staleOpen: ContestWriteWindow = { endAt: END, serverNow: clock.now };
  const load = async (): Promise<ContestWriteWindow | null> => {
    calls += 1;
    if (calls === 1) {
      await gate; // read the pre-cancel row, return it after the invalidation
      return staleOpen;
    }
    return { endAt: at(-601 - CONTEST_END_GRACE_SECONDS), serverNow: clock.now };
  };
  const inFlight = isContestWriteWindowOpenCached("c-race", { load, now });
  await invalidateContestWindow("c-race");
  release();
  assert.equal(await inFlight, true, "the caller that started before the cancel gets its answer");
  assert.equal(await isContestWriteWindowOpenCached("c-race", { load, now }), false, "the stale verdict was not cached");
  assert.equal(calls, 2);
});
