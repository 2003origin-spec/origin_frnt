/**
 * Pilot scorecard against a real Postgres: a tiny hand-made pilot in an
 * isolated past period (2–3 March 2020 IST), so rows written by other tests
 * never fall inside it. Every number on the scorecard is checked.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { getPilotScorecard } from "@/server/now/admin-insights-service";
import { parseScorecardPeriod } from "@/server/now/pilot-scorecard-rules";
import { ensureBotHelper } from "@/server/now/solver-service";

import { closePool, makeId, rawPool } from "./_db";
import { NOW_SKIP, cleanupNowFixtures, seedHelper, seedStudent, setup } from "./_now";

const requestsMade: string[] = [];
const reportsMade: string[] = [];

test.after(async () => {
  if (!NOW_SKIP) {
    await rawPool().query(`DELETE FROM now.reports WHERE id = ANY($1::text[])`, [reportsMade]);
    await rawPool().query(`DELETE FROM now.requests WHERE id = ANY($1::text[])`, [requestsMade]);
  }
  await cleanupNowFixtures();
  await closePool();
});

/** An IST wall-clock time on 2 or 3 March 2020. */
const ist = (day: 2 | 3 | 5 | 10, hhmm: string) => new Date(`2020-03-${String(day).padStart(2, "0")}T${hhmm}:00+05:30`);

async function request(studentId: string, createdAt: Date, status: string) {
  const id = makeId("req");
  requestsMade.push(id);
  await rawPool().query(
    `INSERT INTO now.requests (id, student_id, question_id, subject, difficulty, price_coins, status, created_at)
     VALUES ($1, $2, 'q_scorecard', 'physics', 'easy', 40, $3, $4)`,
    [id, studentId, status, createdAt],
  );
  return id;
}

async function session(
  requestId: string,
  studentId: string,
  helperId: string,
  kind: "human" | "bot",
  times: { accepted: Date; started?: Date; ended: Date; helperJoined?: boolean },
  extra: { endedBy?: string; outcome?: string } = {},
) {
  const id = makeId("ses");
  await rawPool().query(
    `INSERT INTO now.sessions (id, request_id, helper_id, student_id, solver_kind, livekit_room, accepted_at,
                               helper_joined_at, started_at, ended_at, ended_by, outcome)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      id,
      requestId,
      helperId,
      studentId,
      kind,
      `now-${id}`,
      times.accepted,
      times.helperJoined === false ? null : (times.started ?? null),
      times.started ?? null,
      times.ended,
      extra.endedBy ?? "timer",
      extra.outcome ?? null,
    ],
  );
  return id;
}

async function offer(requestId: string, helperId: string, offeredAt: Date, response: "accepted" | "declined" | "expired") {
  await rawPool().query(
    `INSERT INTO now.offers (id, request_id, helper_id, rank, offered_at, expires_at, response, responded_at)
     VALUES ($1, $2, $3, 1, $4, $4::timestamptz + interval '25 seconds', $5, $4::timestamptz + interval '10 seconds')`,
    [makeId("off"), requestId, helperId, offeredAt, response],
  );
}

test("the scorecard reads every pass-or-fail measure from what happened in the period", { skip: NOW_SKIP }, async () => {
  await setup(); // open hours 00:00–23:59, so every request is in hours
  const botId = await ensureBotHelper();
  const a = await seedStudent();
  const b = await seedStudent();
  const c = await seedStudent();
  const solver = await seedHelper("physics");

  // Day 1: A is connected in 3 minutes and solved; B waits 12 minutes and is not solved.
  const r1 = await request(a, ist(2, "18:00"), "rated");
  const s1 = await session(r1, a, solver.helperId, "human", { accepted: ist(2, "18:02"), started: ist(2, "18:03"), ended: ist(2, "18:08") }, { outcome: "resolved" });
  await offer(r1, solver.helperId, ist(2, "18:01"), "accepted");

  const r2 = await request(b, ist(2, "18:10"), "rated");
  const s2 = await session(r2, b, solver.helperId, "human", { accepted: ist(2, "18:21"), started: ist(2, "18:22"), ended: ist(2, "18:26") }, { outcome: "unresolved" });
  await offer(r2, solver.helperId, ist(2, "18:11"), "expired");
  await offer(r2, solver.helperId, ist(2, "18:15"), "declined");
  await offer(r2, solver.helperId, ist(2, "18:20"), "accepted");

  // Day 2: A asks again; the solver accepts but never joins, then the bot takes it for 5 minutes.
  const r3 = await request(a, ist(3, "19:00"), "ended");
  await offer(r3, solver.helperId, ist(3, "19:00"), "accepted");
  await session(r3, a, solver.helperId, "human", { accepted: ist(3, "19:01"), ended: ist(3, "19:03"), helperJoined: false }, { endedBy: "no_show" });
  await session(r3, a, botId, "bot", { accepted: ist(3, "19:04"), started: ist(3, "19:05"), ended: ist(3, "19:10") });

  // C only asks in the second half and cancels: not part of repeat use.
  await request(c, ist(3, "20:00"), "cancelled");

  // Outside the period: must not count.
  const late = await request(b, ist(5, "18:00"), "cancelled");
  await offer(late, solver.helperId, ist(5, "18:00"), "declined");

  // 18 minutes online on day 1.
  for (let m = 0; m < 18; m += 1) {
    await rawPool().query(`INSERT INTO now.presence_minutes (helper_id, minute) VALUES ($1, $2)`, [
      solver.helperId,
      new Date(ist(2, "18:00").getTime() + m * 60_000),
    ]);
  }

  await rawPool().query(
    `INSERT INTO now.ratings (id, session_id, rater_id, helper_id, stars, tags, created_at) VALUES
       ($1, $2, $3, $4, 5, '{}', $5), ($6, $7, $8, $4, 3, '{not_resolved}', $9)`,
    [makeId("rt"), s1, a, solver.helperId, ist(2, "18:09"), makeId("rt"), s2, b, ist(2, "18:27")],
  );

  for (const [reason, status, at] of [
    ["abuse", "upheld", ist(2, "18:30")],
    ["child_safety", "open", ist(2, "18:31")],
    ["child_safety", "upheld", ist(10, "18:00")],
  ] as const) {
    const id = makeId("rep");
    reportsMade.push(id);
    await rawPool().query(
      `INSERT INTO now.reports (id, session_id, reporter_id, reason, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, s2, b, reason, status, at],
    );
  }

  const period = parseScorecardPeriod("2020-03-02", "2020-03-03");
  assert.ok(period && !("error" in period));
  const card = await getPilotScorecard(period);
  const row = (key: string) => card.rows.find((r) => r.key === key)!;

  assert.deepEqual(card.sample, { liveSessions: 3, evenings: 1, ready: false });
  assert.equal(card.passed, false, "far too small to judge");

  assert.equal(row("connect_within_10").value, "25% (1 of 4)");
  assert.equal(row("connect_within_10").status, "fail");
  assert.equal(row("median_connect").value, "7m 30s", "median of 3 and 12 minutes");
  assert.equal(row("accept_rate").value, "60% (3 of 5 offers)", "the offer on 5 March is outside");
  assert.equal(row("accept_rate").status, "pass");
  assert.equal(row("utilisation").value, "50% (9 of 18 min)");
  assert.equal(row("utilisation").status, "pass");
  assert.equal(row("helper_no_show").value, "33.3% (1 of 3)");
  assert.equal(row("helper_no_show").status, "fail");
  assert.equal(row("resolution").value, "50% solved · 50% not solved (2 sessions)");
  assert.equal(row("rating").value, "4.00★ · 50% not solved (2 ratings)");
  assert.equal(row("repeat_use").value, "50% (1 of 2)", "A came back, B did not; C started in the second half");
  assert.equal(row("cost_inputs").value, "1 resolved · 9 human call min · 5 bot call min");
  assert.equal(row("safety").value, "0 (plus 1 upheld abuse)", "the upheld child-safety report is after the period; the open one is not upheld");
  assert.equal(row("safety").status, "pass");
});
