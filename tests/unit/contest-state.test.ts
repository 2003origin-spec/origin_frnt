/**
 * Contest state-machine unit tests (Phase 0). Pure logic, no DB.
 *
 * Guards that matter: state is correct at EVERY window boundary; post-close
 * status flags win over time derivation; registration + start gates are
 * fail-closed; the write-grace never extends the ENDED boundary; and — the
 * load-bearing one — the derivation is timezone/DST agnostic: the same absolute
 * instant yields the same state no matter how it is expressed or what the
 * ambient TZ is.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  shouldCountViolation,
  VIOLATION_GRACE_MS,
  CONTEST_END_GRACE_SECONDS,
  areResultsPublished,
  canStartAttempt,
  isRegistrationOpen,
  isWithinWriteGrace,
  remainingSeconds,
  resolveContestState,
  type ContestWindow,
} from "@/lib/contest/contest-state";

// A canonical scheduled contest: reg opens 5 days before, closes at start,
// runs for 60 minutes. All instants are absolute (UTC here).
const REG_OPEN = new Date("2026-08-20T00:00:00Z");
const REG_CLOSE = new Date("2026-08-25T13:00:00Z");
const START = new Date("2026-08-25T13:00:00Z");
const END = new Date("2026-08-25T14:00:00Z");

function scheduled(overrides: Partial<ContestWindow> = {}): ContestWindow {
  return {
    status: "scheduled",
    regOpen: REG_OPEN,
    regClose: REG_CLOSE,
    startAt: START,
    endAt: END,
    ...overrides,
  };
}

const at = (iso: string) => new Date(iso);

test("draft contest is DRAFT regardless of clock", () => {
  const w = scheduled({ status: "draft" });
  assert.equal(resolveContestState(w, START), "DRAFT");
  assert.equal(resolveContestState(w, END), "DRAFT");
});

test("pre-close state at every boundary (UPCOMING / LIVE / ENDED)", () => {
  const w = scheduled();
  // 1ms before start → UPCOMING
  assert.equal(resolveContestState(w, at("2026-08-25T12:59:59.999Z")), "UPCOMING");
  // exactly at start → LIVE (start is inclusive)
  assert.equal(resolveContestState(w, START), "LIVE");
  // mid-window → LIVE
  assert.equal(resolveContestState(w, at("2026-08-25T13:30:00Z")), "LIVE");
  // 1ms before end → LIVE
  assert.equal(resolveContestState(w, at("2026-08-25T13:59:59.999Z")), "LIVE");
  // exactly at end → ENDED (end is exclusive of LIVE)
  assert.equal(resolveContestState(w, END), "ENDED");
  // well past end but pipeline not advanced → still ENDED (awaiting processing)
  assert.equal(resolveContestState(w, at("2026-08-26T00:00:00Z")), "ENDED");
});

test("post-close status flags WIN over time derivation", () => {
  const now = at("2026-08-25T13:30:00Z"); // clock says LIVE
  assert.equal(resolveContestState(scheduled({ status: "result_processing" }), now), "RESULT_PROCESSING");
  assert.equal(resolveContestState(scheduled({ status: "result_published" }), now), "RESULT_PUBLISHED");
  assert.equal(resolveContestState(scheduled({ status: "archived" }), now), "ARCHIVED");
  assert.equal(resolveContestState(scheduled({ status: "cancelled" }), now), "CANCELLED");
});

test("a cancelled contest is CANCELLED, unregistrable, unstartable, no results", () => {
  const w = scheduled({ status: "cancelled" });
  // even mid-window by the clock, cancelled wins
  assert.equal(resolveContestState(w, START), "CANCELLED");
  assert.equal(isRegistrationOpen(w, REG_OPEN), false);
  assert.equal(canStartAttempt(w, START), false);
  assert.equal(areResultsPublished(w), false);
});

test("scheduled contest with missing windows is UPCOMING, not a throw", () => {
  const w = scheduled({ startAt: null, endAt: null });
  assert.equal(resolveContestState(w, START), "UPCOMING");
});

test("registration window is [reg_open, end_at) — late walk-up allowed, fail-closed", () => {
  const w = scheduled();
  assert.equal(isRegistrationOpen(w, at("2026-08-19T23:59:59.999Z")), false); // before reg_open
  assert.equal(isRegistrationOpen(w, REG_OPEN), true); // at reg_open (inclusive)
  assert.equal(isRegistrationOpen(w, at("2026-08-22T00:00:00Z")), true); // mid (upcoming)
  assert.equal(isRegistrationOpen(w, at("2026-08-25T12:59:59.999Z")), true); // just before start
  // LATE REGISTRATION: open through the LIVE window until end_at.
  assert.equal(isRegistrationOpen(w, START), true); // at start (now registrable + startable)
  assert.equal(isRegistrationOpen(w, at("2026-08-25T13:45:00Z")), true); // mid-LIVE walk-up
  assert.equal(isRegistrationOpen(w, at("2026-08-25T13:59:59.999Z")), true); // 1ms before end
  assert.equal(isRegistrationOpen(w, END), false); // at end (exclusive)
  assert.equal(isRegistrationOpen(w, at("2026-08-25T14:30:00Z")), false); // past end
  // wrong status ⇒ closed even if the clock is inside the window
  assert.equal(isRegistrationOpen(scheduled({ status: "draft" }), REG_OPEN), false);
  assert.equal(isRegistrationOpen(scheduled({ status: "result_published" }), REG_OPEN), false);
  // missing windows ⇒ closed (fail-closed)
  assert.equal(isRegistrationOpen(scheduled({ regOpen: null }), REG_OPEN), false);
  assert.equal(isRegistrationOpen(scheduled({ endAt: null }), REG_OPEN), false);
});

test("canStartAttempt is true only while LIVE (late entry allowed within LIVE)", () => {
  const w = scheduled();
  assert.equal(canStartAttempt(w, at("2026-08-25T12:59:59Z")), false); // before start
  assert.equal(canStartAttempt(w, START), true); // at start
  assert.equal(canStartAttempt(w, at("2026-08-25T13:45:00Z")), true); // late entry, still LIVE
  assert.equal(canStartAttempt(w, END), false); // at end
});

test("write grace: accepted up to end_at + grace, never beyond; does not move ENDED", () => {
  const w = scheduled();
  const graceMs = CONTEST_END_GRACE_SECONDS * 1000;
  assert.equal(isWithinWriteGrace(w, END), true); // exactly at end
  assert.equal(isWithinWriteGrace(w, new Date(END.getTime() + graceMs)), true); // at end+grace (inclusive)
  assert.equal(isWithinWriteGrace(w, new Date(END.getTime() + graceMs + 1)), false); // 1ms past grace
  // grace does NOT change the displayed state: still ENDED at end and within grace
  assert.equal(resolveContestState(w, new Date(END.getTime() + 1)), "ENDED");
});

test("remainingSeconds is a display-only countdown to end_at, never negative", () => {
  const w = scheduled();
  assert.equal(remainingSeconds(w, at("2026-08-25T12:59:00Z")), 0); // UPCOMING → 0
  assert.equal(remainingSeconds(w, START), 3600); // full 60 min at start
  assert.equal(remainingSeconds(w, at("2026-08-25T13:30:00Z")), 1800); // half way
  assert.equal(remainingSeconds(w, END), 0); // at end → 0 (not LIVE)
  assert.equal(remainingSeconds(w, at("2026-08-25T15:00:00Z")), 0); // past end → 0
});

test("areResultsPublished only once published or archived", () => {
  assert.equal(areResultsPublished(scheduled({ status: "scheduled" })), false);
  assert.equal(areResultsPublished(scheduled({ status: "result_processing" })), false);
  assert.equal(areResultsPublished(scheduled({ status: "result_published" })), true);
  assert.equal(areResultsPublished(scheduled({ status: "archived" })), true);
});

test("timezone invariance: same instant expressed via different offsets → same state", () => {
  const w = scheduled();
  // 13:30 UTC expressed three ways — all the same absolute instant.
  const asUtc = at("2026-08-25T13:30:00Z");
  const asIst = at("2026-08-25T19:00:00+05:30");
  const asEst = at("2026-08-25T09:30:00-04:00");
  assert.equal(asUtc.getTime(), asIst.getTime());
  assert.equal(asUtc.getTime(), asEst.getTime());
  assert.equal(resolveContestState(w, asUtc), "LIVE");
  assert.equal(resolveContestState(w, asIst), "LIVE");
  assert.equal(resolveContestState(w, asEst), "LIVE");
});

test("DST-boundary invariance: a contest spanning a DST transition keeps exact UTC boundaries", () => {
  // US spring-forward 2026: 2026-03-08T07:00:00Z is the 2am→3am EST→EDT jump.
  // A contest running 06:30Z–07:30Z straddles it. The boundaries are absolute
  // instants, so the state at any instant is unaffected by the local-clock skip.
  const dstWindow: ContestWindow = {
    status: "scheduled",
    regOpen: at("2026-03-01T00:00:00Z"),
    regClose: at("2026-03-08T06:30:00Z"),
    startAt: at("2026-03-08T06:30:00Z"),
    endAt: at("2026-03-08T07:30:00Z"),
  };
  assert.equal(resolveContestState(dstWindow, at("2026-03-08T06:29:59Z")), "UPCOMING");
  assert.equal(resolveContestState(dstWindow, at("2026-03-08T06:30:00Z")), "LIVE");
  // the instant of the DST jump — squarely mid-contest
  assert.equal(resolveContestState(dstWindow, at("2026-03-08T07:00:00Z")), "LIVE");
  assert.equal(resolveContestState(dstWindow, at("2026-03-08T07:30:00Z")), "ENDED");
});

test("shouldCountViolation: only sustained backgrounding counts (mobile-safe)", () => {
  assert.equal(shouldCountViolation(0), false); // instant
  assert.equal(shouldCountViolation(500), false); // notification glance
  assert.equal(shouldCountViolation(VIOLATION_GRACE_MS - 1), false);
  assert.equal(shouldCountViolation(VIOLATION_GRACE_MS), true); // sustained exit
  assert.equal(shouldCountViolation(10_000), true);
});
