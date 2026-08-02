/**
 * CBT attempt resilience — the rules that decide whether a student who lost
 * their connection is scored or written off.
 *
 * Regression target: a disconnected student used to end up with finished_at
 * NULL forever, which the export reported as "absent" with a blank score even
 * though the server was holding their answers.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CBT_PRESENCE_WINDOW_MS,
  deriveFinalizeReason,
  finalizeRemark,
  finalizeStatusLabel,
  isCbtFinalizeReason,
  isGradedReason,
} from "@/lib/cbt/finalize-reason";
import { localDraftIsAhead } from "@/lib/cbt/local-attempt";
import { nextPhase, phaseFromState } from "@/lib/cbt/student-phase";

const NOW = Date.parse("2026-08-02T10:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

// ── deriveFinalizeReason ─────────────────────────────────────────────────────

test("a student who entered and vanished is 'expired_offline', never absent", () => {
  const reason = deriveFinalizeReason({
    enteredTestAt: iso(45 * 60_000),
    lastSeenAt: iso(20 * 60_000),
    hasDraft: true,
    now: NOW,
  });
  assert.equal(reason, "expired_offline");
  assert.equal(isGradedReason(reason), true, "their saved answers must still be graded");
});

test("a student still at the keyboard at the deadline is 'timer'", () => {
  assert.equal(
    deriveFinalizeReason({
      enteredTestAt: iso(60 * 60_000),
      lastSeenAt: iso(5_000),
      hasDraft: true,
      now: NOW,
    }),
    "timer",
  );
});

test("only a genuine no-show is 'absent' — and it is not graded", () => {
  const reason = deriveFinalizeReason({
    enteredTestAt: null,
    lastSeenAt: iso(10 * 60_000),
    hasDraft: false,
    now: NOW,
  });
  assert.equal(reason, "absent");
  assert.equal(isGradedReason(reason), false);
});

test("a draft alone rescues a student whose entered_test_at never landed", () => {
  // The heartbeat that stamps entered_test_at can be the very request that
  // failed; answers on the server prove they were sitting the paper.
  assert.equal(
    deriveFinalizeReason({ enteredTestAt: null, lastSeenAt: iso(30 * 60_000), hasDraft: true, now: NOW }),
    "expired_offline",
  );
});

test("a missing last_seen_at counts as offline, not as present", () => {
  assert.equal(
    deriveFinalizeReason({ enteredTestAt: iso(60_000), lastSeenAt: null, hasDraft: true, now: NOW }),
    "expired_offline",
  );
});

test("the offline boundary is the presence window", () => {
  const justInside = deriveFinalizeReason({
    enteredTestAt: iso(60_000),
    lastSeenAt: iso(CBT_PRESENCE_WINDOW_MS - 1_000),
    hasDraft: true,
    now: NOW,
  });
  const justOutside = deriveFinalizeReason({
    enteredTestAt: iso(60_000),
    lastSeenAt: iso(CBT_PRESENCE_WINDOW_MS + 1_000),
    hasDraft: true,
    now: NOW,
  });
  assert.equal(justInside, "timer");
  assert.equal(justOutside, "expired_offline");
});

// ── Export labels ────────────────────────────────────────────────────────────

test("the export carries the exact offline remark the teacher needs", () => {
  assert.equal(
    finalizeRemark("expired_offline", "2026-08-02T11:00:00Z"),
    "Got offline during the test and never came back",
  );
  assert.equal(finalizeStatusLabel("expired_offline", "2026-08-02T11:00:00Z"), "auto-submitted");
});

test("status/remark cover every reason", () => {
  const finishedAt = "2026-08-02T11:00:00Z";
  assert.equal(finalizeStatusLabel("manual", finishedAt), "submitted");
  assert.equal(finalizeRemark("manual", finishedAt), "");
  assert.equal(finalizeStatusLabel("absent", finishedAt), "absent");
  assert.equal(finalizeRemark("absent", finishedAt), "Never entered the test");
  assert.equal(finalizeStatusLabel("malpractice", finishedAt), "terminated");
  assert.match(finalizeRemark("malpractice", finishedAt), /integrity violations/);
  assert.match(finalizeRemark("room_closed", finishedAt), /closed by the teacher/);
  assert.match(finalizeRemark("forced_by_teacher", finishedAt), /Finalized by the teacher/);
  assert.match(finalizeRemark("timer", finishedAt), /time ended/);
});

test("an unfinished attempt reads as in progress, not absent", () => {
  assert.equal(finalizeStatusLabel("expired_offline", null), "in progress");
  assert.equal(finalizeRemark(null, null), "Test still in progress at export time");
});

test("rows still awaiting the backfill fall back to the legacy flag", () => {
  // finalize_reason is NULL for pre-deploy rows and during the chunked
  // backfill; the export must read exactly as it did before.
  const finishedAt = "2026-07-01T11:00:00Z";
  assert.equal(finalizeStatusLabel(null, finishedAt, true), "auto-submitted");
  assert.equal(finalizeStatusLabel(null, finishedAt, false), "submitted");
  assert.equal(finalizeRemark(null, finishedAt, false), "");
});

test("isCbtFinalizeReason rejects junk from the database", () => {
  assert.equal(isCbtFinalizeReason("expired_offline"), true);
  assert.equal(isCbtFinalizeReason("nonsense"), false);
  assert.equal(isCbtFinalizeReason(null), false);
  assert.equal(isCbtFinalizeReason(7), false);
});

// ── Draft revision (stale-tab protection) ────────────────────────────────────

test("the device copy is replayed only when it is genuinely ahead", () => {
  const draft = {
    rev: 12,
    answers: { 1: { selectedOption: 2 } },
    palette: {},
    savedAt: NOW,
  };
  assert.equal(localDraftIsAhead(draft, 11), true, "newer local work must be pushed up");
  assert.equal(localDraftIsAhead(draft, 12), false, "same revision is already saved");
  assert.equal(localDraftIsAhead(draft, 20), false, "an older local copy must never clobber the server");
  assert.equal(localDraftIsAhead(null, 0), false);
});

test("an empty local copy never overwrites a server draft", () => {
  assert.equal(localDraftIsAhead({ rev: 99, answers: {}, palette: {}, savedAt: NOW }, 1), false);
});

// ── Student phase ────────────────────────────────────────────────────────────

test("a finished room resolves to submitted, not back to the lobby", () => {
  // The server finalizes every open attempt before flipping a room to
  // 'finished', so there is nothing left for a returning student to do.
  assert.equal(
    phaseFromState({ room: { status: "finished" }, participant: { finishedAt: null } }),
    "submitted",
  );
});

test("a finalized attempt wins over a live room", () => {
  assert.equal(
    phaseFromState({ room: { status: "in_test" }, participant: { finishedAt: "2026-08-02T10:59:00Z" } }),
    "submitted",
  );
});

test("a student who is still running stays in the test", () => {
  assert.equal(
    phaseFromState({ room: { status: "in_test" }, participant: { finishedAt: null } }),
    "in_test",
  );
});

test("terminal phases stay terminal", () => {
  assert.equal(nextPhase("submitted", "in_test"), "submitted");
  assert.equal(nextPhase("kicked", "in_test"), "kicked");
  // …but a live student may be sent back to the join screen when their session
  // is invalidated (kicked, or resumed on another device).
  assert.equal(nextPhase("in_test", "join"), "join");
});
