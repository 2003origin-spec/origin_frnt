/**
 * Group sessions (decision B95) against a real Postgres with LiveKit
 * stubbed: off by default; scheduling rules; booking holds coins (full,
 * twice, own session refused); seat cancel until an hour before; the room
 * opens 10 minutes early, the host's join makes it live and starts the
 * recording; one student holds the mic at a time; held → solver paid per
 * seat, solver no-show and cut short → every seat refunded; admin cancel.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  bookSeat,
  cancelSeat,
  endGroup,
  issueGroupTicket,
  listUpcomingGroups,
  rateGroup,
  runGroupSweep,
  scheduleGroup,
  setGroupMic,
} from "@/server/now/group-service";
import { getWalletBalance } from "@/server/now/ledger-store";
import { __setLiveKitFetchForTests } from "@/server/now/livekit";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, WELCOME, assertLedgerBalanced, cleanupNowFixtures, seedHelper, seedStudent, setFeatures, setup } from "./_now";

const saved = { ...process.env };
const calls: { method: string; body: Record<string, unknown> }[] = [];
test.before(() => {
  process.env.LIVEKIT_URL = "wss://test.livekit.invalid";
  process.env.LIVEKIT_API_KEY = "APItest";
  process.env.LIVEKIT_API_SECRET = "integration-test-livekit-secret-32b!";
  process.env.NOW_RECORDING_R2_ACCESS_KEY_ID = "rec-key";
  process.env.NOW_RECORDING_R2_SECRET_ACCESS_KEY = "rec-secret";
  process.env.NOW_RECORDING_R2_BUCKET = "origin-recordings";
  process.env.R2_ENDPOINT = "https://acct.r2.cloudflarestorage.invalid";
  __setLiveKitFetchForTests(async (url, init) => {
    calls.push({ method: url.split("/").pop() ?? "", body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(url.endsWith("StartRoomCompositeEgress") ? { egress_id: `EG_${calls.length}` } : {}), { status: 200 });
  });
});
test.after(async () => {
  __setLiveKitFetchForTests(null);
  process.env = saved;
  if (!NOW_SKIP) await setup();
  await cleanupNowFixtures();
  await closePool();
});

const code = (c: string) => (e: { code?: string }) => e.code === c;
const MIN = 60_000;
const base = Date.now();
const startsAt = new Date(base + 3 * 60 * MIN);
const at = (minFromStart: number) => new Date(startsAt.getTime() + minFromStart * MIN);
const input = (over: Partial<Parameters<typeof scheduleGroup>[1]> = {}) => ({
  subject: "physics",
  chapter: "Rotational motion",
  title: "Torque in 30 minutes",
  startsAt,
  minutes: 30,
  seats: 2,
  priceCoins: 30,
  ...over,
});

test("book, join, mic, end: the solver is paid per seat", { skip: NOW_SKIP }, async () => {
  await setup();
  const host = await seedHelper("physics");
  await assert.rejects(scheduleGroup(host.userId, input()), code("groups_off"));
  await setFeatures({ groups: true });
  await assert.rejects(scheduleGroup(host.userId, input({ subject: "chemistry" })), code("not_your_subject"));
  await assert.rejects(scheduleGroup(host.userId, input({ startsAt: new Date(base + 30 * MIN) })), code("invalid_group"));
  const g = await scheduleGroup(host.userId, input());

  const [a, b, c] = [await seedStudent(), await seedStudent(), await seedStudent()];
  assert.ok((await listUpcomingGroups(a)).some((x) => x.id === g.id));
  await bookSeat(a, g.id);
  await assert.rejects(bookSeat(a, g.id), code("already_booked"));
  await bookSeat(b, g.id);
  await assert.rejects(bookSeat(c, g.id), code("full"));
  await assert.rejects(bookSeat(host.userId, g.id), (e: { code?: string }) => e.code === "own_session" || e.code === "not_invited");
  assert.equal((await getWalletBalance(a)).available, WELCOME - 30, "seat coins held");

  // Seat cancel until an hour before: c takes b's place.
  await cancelSeat(b, g.id);
  assert.equal((await getWalletBalance(b)).available, WELCOME);
  await bookSeat(c, g.id);
  await assert.rejects(cancelSeat(c, g.id, at(-30)), code("too_late"));

  await assert.rejects(issueGroupTicket(a, g.id, at(-20)), code("not_yet"));
  const hostTicket = await issueGroupTicket(host.userId, g.id, at(-5));
  assert.equal(hostTicket.role, "host");
  assert.ok(calls.some((x) => x.method === "StartRoomCompositeEgress" && x.body.room_name === `now-group-${g.id}`), "recording started");
  const live = (await rawPool().query(`SELECT status, solver_joined_at FROM now.group_sessions WHERE id = $1`, [g.id])).rows[0];
  assert.equal(live.status, "live");
  const ticket = await issueGroupTicket(a, g.id, at(1));
  assert.equal(ticket.role, "listener");
  await assert.rejects(issueGroupTicket(b, g.id, at(1)), code("no_seat"), "cancelled seat");

  const seats = (await rawPool().query(`SELECT id, student_id FROM now.group_seats WHERE group_id = $1 AND status = 'booked'`, [g.id])).rows;
  const seatA = seats.find((s) => s.student_id === a)!.id;
  const seatC = seats.find((s) => s.student_id === c)!.id;
  calls.length = 0;
  await setGroupMic(host.userId, g.id, seatA, at(5));
  await setGroupMic(host.userId, g.id, seatC, at(6));
  const updates = calls.filter((x) => x.method === "UpdateParticipant").map((x) => [x.body.identity, (x.body.permission as { can_publish: boolean }).can_publish]);
  assert.deepEqual(updates, [[`listener-${seatA}`, true], [`listener-${seatA}`, false], [`listener-${seatC}`, true]], "one student at a time");
  await assert.rejects(setGroupMic(a, g.id, null, at(6)), code("not_found"), "only the host");

  await assert.rejects(endGroup({ userId: a }, g.id, at(20)), code("not_host"));
  const ended = await endGroup({ userId: host.userId }, g.id, at(20));
  assert.equal(ended.settleOutcome, "paid");
  assert.equal((await getWalletBalance(host.userId)).pending, 60, "two seats × 30 (no commission in tests)");
  assert.ok(calls.some((x) => x.method === "DeleteRoom"));
  await rateGroup(a, g.id, 5);
  await assert.rejects(rateGroup(c, g.id, 5), code("cannot_rate"), "c never joined");
  await assertLedgerBalanced();
});

test("solver no-show and a session cut short refund every seat", { skip: NOW_SKIP }, async () => {
  await setup();
  await setFeatures({ groups: true });
  const host = await seedHelper("physics");
  const g1 = await scheduleGroup(host.userId, input());
  const s1 = await seedStudent();
  await bookSeat(s1, g1.id);
  assert.ok((await runGroupSweep(at(11))).noShows >= 1);
  const row = (await rawPool().query(`SELECT status, settle_outcome FROM now.group_sessions WHERE id = $1`, [g1.id])).rows[0];
  assert.deepEqual(row, { status: "cancelled", settle_outcome: "refunded" });
  assert.equal((await getWalletBalance(s1)).available, WELCOME);

  const host2 = await seedHelper("physics");
  const g2 = await scheduleGroup(host2.userId, input());
  const s2 = await seedStudent();
  await bookSeat(s2, g2.id);
  await issueGroupTicket(host2.userId, g2.id, at(0));
  await endGroup({ userId: host2.userId }, g2.id, at(10));
  assert.equal((await getWalletBalance(s2)).available, WELCOME, "10 of 30 minutes: refunded");
  assert.equal((await getWalletBalance(host2.userId)).pending, 0);

  const host3 = await seedHelper("physics");
  const g3 = await scheduleGroup(host3.userId, input());
  const s3 = await seedStudent();
  await bookSeat(s3, g3.id);
  await issueGroupTicket(host3.userId, g3.id, at(0));
  assert.ok((await runGroupSweep(at(36))).ended >= 1, "ended by the timer after the planned end + grace");
  assert.equal((await getWalletBalance(host3.userId)).pending, 30);
  await assertLedgerBalanced();
});
