import test from "node:test";
import assert from "node:assert/strict";

import {
  EXTENSION_REQUEST_TTL_MS,
  settlementReportState,
  decidePayable,
  firstNameOnly,
  isExtensionRequestOpen,
  isShortSession,
  noShowSide,
  sessionEndsAt,
  unsettledSessionsSql,
} from "@/server/now/session-rules";
import { NO_SHOW_WINDOW_MS } from "@/server/now/types";

const base = {
  solverKind: "human" as const,
  studentJoined: true,
  helperJoined: true,
  outcome: "resolved" as const,
  ownOrLinkedAccount: false,
  reportUpheld: false,
};

test("a human session pays only with both joined, an outcome, no report, not own account", () => {
  assert.equal(decidePayable(base), true);
  assert.equal(decidePayable({ ...base, outcome: "unresolved" }), true, "an honest 'unresolved' still pays");
  assert.equal(decidePayable({ ...base, outcome: null }), false);
  assert.equal(decidePayable({ ...base, studentJoined: false }), false);
  assert.equal(decidePayable({ ...base, helperJoined: false }), false);
  assert.equal(decidePayable({ ...base, ownOrLinkedAccount: true }), false);
  assert.equal(decidePayable({ ...base, reportUpheld: true }), false);
});

test("a bot session pays without an outcome but never on an open report", () => {
  assert.equal(decidePayable({ ...base, solverKind: "bot", outcome: null }), true);
  assert.equal(decidePayable({ ...base, solverKind: "bot", outcome: null, reportUpheld: true }), false);
});

test("no-show: nobody is blamed before the window; a missing solver is blamed first", () => {
  const acceptedAt = new Date("2026-10-17T13:00:00Z");
  const early = new Date(acceptedAt.getTime() + NO_SHOW_WINDOW_MS - 1);
  const late = new Date(acceptedAt.getTime() + NO_SHOW_WINDOW_MS);
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: null, helperJoinedAt: null, now: early }), "not_yet");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: null, helperJoinedAt: null, now: late }), "both", "nobody waiting: close, don't requeue");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: acceptedAt, helperJoinedAt: null, now: late }), "helper");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: null, helperJoinedAt: acceptedAt, now: late }), "student");
  assert.equal(noShowSide({ acceptedAt, studentJoinedAt: acceptedAt, helperJoinedAt: acceptedAt, now: late }), "none");
});

test("timing helpers", () => {
  const start = new Date("2026-10-17T13:00:00Z");
  assert.equal(sessionEndsAt(start, 5).toISOString(), "2026-10-17T13:05:00.000Z");
  assert.equal(isShortSession(start, new Date(start.getTime() + 60_000)), true);
  assert.equal(isShortSession(start, new Date(start.getTime() + 3 * 60_000)), false);
  assert.equal(isShortSession(null, start), false);
  assert.equal(isExtensionRequestOpen(null, start), false);
  assert.equal(isExtensionRequestOpen(start, new Date(start.getTime() + EXTENSION_REQUEST_TTL_MS)), true);
  assert.equal(isExtensionRequestOpen(start, new Date(start.getTime() + EXTENSION_REQUEST_TTL_MS + 1)), false);
});

test("a solver only ever sees the student's first name", () => {
  assert.equal(firstNameOnly("  Meera   Iyer "), "Meera");
  assert.equal(firstNameOnly(""), "Student");
  assert.equal(firstNameOnly(null), "Student");
});

test("only the student's reports touch the solver's pay: open defers, upheld blocks", () => {
  assert.equal(settlementReportState([]), "clear");
  assert.equal(settlementReportState([{ reporterRole: "solver", status: "open" }]), "clear", "a solver reporting a student keeps their pay");
  assert.equal(settlementReportState([{ reporterRole: "student", status: "open" }]), "defer");
  assert.equal(settlementReportState([{ reporterRole: "student", status: "dismissed" }]), "clear");
  assert.equal(settlementReportState([{ reporterRole: "student", status: "upheld" }]), "upheld");
  assert.equal(
    settlementReportState([{ reporterRole: "student", status: "upheld" }, { reporterRole: "student", status: "open" }]),
    "defer",
    "wait for every open case",
  );
});

test("NOW-3: the settle sweep drains oldest first and skips sessions with an open student report", () => {
  const sql = unsettledSessionsSql(50).replace(/\s+/g, " ");
  assert.match(sql, /ORDER BY s\.ended_at ASC LIMIT 50$/);
  assert.match(sql, /NOT EXISTS \( SELECT 1 FROM now\.reports rp WHERE rp\.session_id = s\.id AND rp\.reporter_role = 'student' AND rp\.status = 'open' \)/);
  assert.match(sql, /s\.ended_at <= \$1/);
});
