/**
 * k6 load test — Origin Weekly Contest game-day shape (Phase 9).
 *
 * V1/CONTEST_ORBIT_IMPLEMENTATION_PLAN.md §9 (hardening & game-day)
 *
 * Models the two peaks the architecture is built to absorb:
 *
 *   1. start_at READ BURST — at the gun, every registered student pulls the
 *      immutable paper (GET /api/contest/paper) and starts an attempt
 *      (POST /api/contest/start). The paper is edge/immutable-cached with a
 *      single-flight fill, so this burst should be served without touching the
 *      hot Neon path. Watch `contest_paper_duration_ms` p95 and the 5xx rate.
 *
 *   2. end_at WRITE SPIKE — throughout the attempt each student autosaves to the
 *      Redis draft buffer (POST /api/contest/answers, monotonic `rev`, never the
 *      hot Neon path); at the deadline everyone submits at once
 *      (POST /api/contest/submit, FOR-UPDATE idempotent). Watch
 *      `contest_answers_duration_ms` and `contest_submit_duration_ms`.
 *
 * Each VU runs one full student lifecycle per iteration:
 *   paper → start → state/autosave × N → submit.
 *
 * NOT WIRED INTO CI. k6 isn't in the build image. Run against a staging deploy
 * with the `contest` flag ON and a real, LIVE contest that the seeded students
 * are registered for:
 *
 *   brew install k6   # one-time
 *   BASE_URL=https://staging.o3origin.com \
 *   CONTEST_ID=contest_xxx \
 *   STUDENT_TOKENS=jwt1,jwt2,jwt3,... \
 *   STUDENT_CSRFS=csrf1,csrf2,csrf3,... \
 *     k6 run tests/load/contest-game-day.k6.js
 *
 * Required env:
 *   BASE_URL        — frontend base URL (no trailing slash)
 *   CONTEST_ID      — a LIVE contest id the seeded students are registered for
 *   STUDENT_TOKENS  — comma-separated `origin_access` JWTs, one per seeded student
 *   STUDENT_CSRFS   — comma-separated `origin_csrf` values, aligned 1:1 with tokens
 * Optional env:
 *   PEAK_VUS        — hold concurrency (default 200). Scale 10k→100k→1M by running
 *                     many k6 load-generators in parallel across machines.
 *   AUTOSAVES       — autosaves per attempt (default 8)
 *
 * Because attempts use a single-active-session guard, each VU must use its OWN
 * student token — never share one across VUs. Seed at least PEAK_VUS students.
 */

import http from "k6/http";
import { check, sleep, fail } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const CONTEST_ID = __ENV.CONTEST_ID || "";
const TOKENS = (__ENV.STUDENT_TOKENS || "").split(",").map((s) => s.trim()).filter(Boolean);
const CSRFS = (__ENV.STUDENT_CSRFS || "").split(",").map((s) => s.trim()).filter(Boolean);
const PEAK_VUS = Number(__ENV.PEAK_VUS) || 200;
const AUTOSAVES = Number(__ENV.AUTOSAVES) || 8;

const paperDur = new Trend("contest_paper_duration_ms", true);
const startDur = new Trend("contest_start_duration_ms", true);
const answersDur = new Trend("contest_answers_duration_ms", true);
const submitDur = new Trend("contest_submit_duration_ms", true);
const okRate = new Rate("contest_request_ok");
const rlRate = new Rate("contest_rate_limited");
const err5xx = new Counter("contest_5xx");

export const options = {
  scenarios: {
    // A single ramping journey; the read-burst emerges from the ramp to PEAK and
    // the submit-spike from many VUs reaching the end of their lifecycle together.
    game_day: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: Math.ceil(PEAK_VUS / 4) }, // gun approaches
        { duration: "15s", target: PEAK_VUS },                 // start_at read burst
        { duration: "3m",  target: PEAK_VUS },                 // steady autosave window
        { duration: "30s", target: 0 },                        // deadline → submit spike drains
      ],
      gracefulStop: "30s",
    },
  },
  thresholds: {
    contest_request_ok: ["rate>0.98"],
    contest_5xx: ["count<1"],
    // Cached paper must stay fast even under the burst.
    contest_paper_duration_ms: ["p(95)<600"],
    // Buffered autosave never hits hot Neon — should be quick.
    contest_answers_duration_ms: ["p(95)<500"],
    // Submit does real work (grade + claim) but is one-shot per student.
    contest_submit_duration_ms: ["p(95)<1500"],
    contest_rate_limited: ["rate<0.05"],
  },
};

export function setup() {
  if (!CONTEST_ID) fail("Set CONTEST_ID to a live contest id");
  if (!TOKENS.length || TOKENS.length !== CSRFS.length) {
    fail("STUDENT_TOKENS and STUDENT_CSRFS must be non-empty and equal length (1 per seeded student)");
  }
  if (TOKENS.length < PEAK_VUS) {
    // Not fatal — VUs wrap around the pool — but single-active-session will make
    // overlapping VUs on the same token fight. Warn loudly.
    console.warn(`WARN: ${TOKENS.length} tokens < PEAK_VUS ${PEAK_VUS}; seed more students to avoid session contention`);
  }
  return { contestId: CONTEST_ID };
}

function auth(i) {
  const idx = i % TOKENS.length;
  return {
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": CSRFS[idx],
      Cookie: `origin_access=${TOKENS[idx]}; origin_csrf=${CSRFS[idx]}`,
    },
  };
}

function track(res, dur) {
  if (dur) dur.add(res.timings.duration);
  okRate.add(res.status >= 200 && res.status < 300);
  rlRate.add(res.status === 429);
  if (res.status >= 500) err5xx.add(1);
  check(res, { "no 5xx": (r) => r.status < 500 });
}

export default function (data) {
  const a = auth(__VU);
  const cid = data.contestId;

  // 1) start_at read burst: pull the immutable paper.
  const paper = http.get(`${BASE_URL}/api/contest/paper?contestId=${cid}`, { ...a, tags: { ep: "paper" } });
  track(paper, paperDur);

  // 2) start the attempt (idempotent resume if already started).
  const start = http.post(`${BASE_URL}/api/contest/start`, JSON.stringify({ contestId: cid }), { ...a, tags: { ep: "start" } });
  track(start, startDur);

  // 3) steady autosave window — write to the Redis draft buffer, monotonic rev.
  for (let rev = 1; rev <= AUTOSAVES; rev += 1) {
    const body = JSON.stringify({
      contestId: cid,
      answers: { [String(rev)]: rev % 4 },
      palette: { [String(rev)]: "answered" },
      times: { [String(rev)]: 5 },
      rev,
    });
    const save = http.post(`${BASE_URL}/api/contest/answers`, body, { ...a, tags: { ep: "answers" } });
    track(save, answersDur);
    // occasional clock poll, like the real client
    if (rev % 3 === 0) {
      const st = http.get(`${BASE_URL}/api/contest/state?contestId=${cid}`, { ...a, tags: { ep: "state" } });
      track(st, null);
    }
    sleep(1);
  }

  // 4) end_at write spike: submit (FOR-UPDATE idempotent — a retry is a no-op).
  const submit = http.post(`${BASE_URL}/api/contest/submit`, JSON.stringify({ contestId: cid }), { ...a, tags: { ep: "submit" } });
  track(submit, submitDur);
}
