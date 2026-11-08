import assert from "node:assert/strict";
import test from "node:test";

import { canCancelSeat, groupInputProblems, groupSettlement, joinWindow } from "../../src/server/now/group-rules";
import { groupParticipantGrant, micPermissionRequest } from "../../src/server/now/livekit";

const now = new Date("2026-10-20T06:00:00Z");
const good = {
  subject: "physics",
  chapter: "Rotational motion",
  title: "Torque in 30 minutes",
  startsAt: new Date(now.getTime() + 3 * 60 * 60_000),
  minutes: 30,
  seats: 10,
  priceCoins: 30,
};

test("scheduling rules (B95)", () => {
  assert.deepEqual(groupInputProblems(good, now), []);
  assert.match(groupInputProblems({ ...good, startsAt: new Date(now.getTime() + 60 * 60_000) }, now)[0], /2 hours ahead/);
  assert.match(groupInputProblems({ ...good, startsAt: new Date(now.getTime() + 15 * 24 * 60 * 60_000) }, now)[0], /14 days/);
  assert.match(groupInputProblems({ ...good, minutes: 60 }, now)[0], /20 to 45/);
  assert.match(groupInputProblems({ ...good, seats: 1 }, now)[0], /2 to 15/);
  assert.match(groupInputProblems({ ...good, priceCoins: 0 }, now)[0], /1 to 1000/);
  assert.match(groupInputProblems({ ...good, title: "Hi" }, now)[0], /title/);
  assert.match(groupInputProblems({ ...good, description: "join my telegram for notes" }, now)[0], /contact details/);
});

test("join window, seat cancelling and who is paid", () => {
  const start = new Date("2026-10-20T12:30:00Z");
  const w = joinWindow(start, 30);
  assert.equal(w.opens.toISOString(), "2026-10-20T12:20:00.000Z");
  assert.equal(w.closes.toISOString(), "2026-10-20T13:05:00.000Z");
  assert.equal(canCancelSeat(start, new Date("2026-10-20T11:30:00Z")), true, "exactly an hour before");
  assert.equal(canCancelSeat(start, new Date("2026-10-20T11:31:00Z")), false);
  const started = new Date("2026-10-20T12:31:00Z");
  assert.equal(groupSettlement({ solverJoinedAt: started, startedAt: started, endedAt: new Date("2026-10-20T12:46:00Z"), minutes: 30 }), "paid", "half the length");
  assert.equal(groupSettlement({ solverJoinedAt: started, startedAt: started, endedAt: new Date("2026-10-20T12:45:00Z"), minutes: 30 }), "refunded", "cut short");
  assert.equal(groupSettlement({ solverJoinedAt: null, startedAt: null, endedAt: started, minutes: 30 }), "refunded", "solver never came");
});

test("listeners cannot publish until the host gives them the mic", () => {
  assert.deepEqual(groupParticipantGrant("listener", "r").canPublishSources, []);
  assert.equal(groupParticipantGrant("listener", "r").canPublish, false);
  assert.equal(groupParticipantGrant("listener", "r").canPublishData, true, "a raised hand is a data message");
  assert.equal(groupParticipantGrant("host", "r").canPublish, true);
  assert.deepEqual(micPermissionRequest("r", "listener-s1", true).permission.can_publish_sources, ["MICROPHONE"]);
  assert.equal(micPermissionRequest("r", "listener-s1", false).permission.can_publish, false);
});
