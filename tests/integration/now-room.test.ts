/**
 * Origin NOW live room against a real Postgres: who gets a LiveKit ticket and
 * with what rights, the room is deleted whenever the server ends a session,
 * recording starts when the call goes live and its key is stored, recordings
 * are purged after retention unless a report is open, and every admin open is
 * logged. LiveKit and R2 are replaced by fetch stubs (no network).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { jwtVerify } from "jose";

import { cancelRequest, createRequest, getCurrentOffer, heartbeatHelper, respondToOffer } from "@/server/now/dispatch-service";
import { __setLiveKitFetchForTests } from "@/server/now/livekit";
import { clearPresence } from "@/server/now/now-realtime";
import { getRecordingLinkForAdmin, issueRoomTicket, purgeExpiredRecordings } from "@/server/now/room-service";
import { endSession, handleNoShow, joinSession } from "@/server/now/session-service";
import { NO_SHOW_WINDOW_MS } from "@/server/now/types";

import { closePool, rawPool } from "./_db";
import {
  NOW_SKIP,
  cleanupNowFixtures,
  helpersMade,
  seedAttemptedQuestion,
  seedHelper,
  seedStudent,
  seedUser,
  sessionOf,
  setup,
} from "./_now";

const SECRET = "integration-test-livekit-secret-32b!";
const savedEnv = { ...process.env };
type Call = { method: string; body: Record<string, unknown> };
const calls: Call[] = [];

test.before(() => {
  process.env.LIVEKIT_URL = "wss://test.livekit.invalid";
  process.env.LIVEKIT_API_KEY = "APItest";
  process.env.LIVEKIT_API_SECRET = SECRET;
  process.env.NOW_RECORDING_R2_ACCESS_KEY_ID = "rec-key";
  process.env.NOW_RECORDING_R2_SECRET_ACCESS_KEY = "rec-secret";
  process.env.NOW_RECORDING_R2_BUCKET = "origin-recordings";
  process.env.R2_ENDPOINT = "https://acct.r2.cloudflarestorage.invalid";
  process.env.R2_ACCESS_KEY_ID = "app-key";
  process.env.R2_SECRET_ACCESS_KEY = "app-secret";
  __setLiveKitFetchForTests(async (url, init) => {
    calls.push({ method: url.split("/").pop() ?? "", body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(url.endsWith("StartRoomCompositeEgress") ? { egress_id: `EG_${calls.length}` } : {}), {
      status: 200,
    });
  });
});

test.after(async () => {
  __setLiveKitFetchForTests(null);
  process.env = savedEnv;
  await cleanupNowFixtures();
  await closePool();
});

async function acceptedHumanSession() {
  await setup();
  for (const id of helpersMade) await clearPresence(id); // earlier tests' solvers must not take the offer
  const student = await seedStudent();
  const solver = await seedHelper("physics");
  await heartbeatHelper(solver.userId, null);
  const request = await createRequest(student, { questionId: await seedAttemptedQuestion(student, "physics") });
  const offer = (await getCurrentOffer(solver.userId))!;
  const { sessionId } = await respondToOffer(solver.userId, offer.offerId, "accept", null);
  return { student, solver, requestId: request.id, sessionId: sessionId! };
}

function callsFor(method: string, room: string) {
  return calls.filter((c) => c.method === method && (c.body.room === room || c.body.room_name === room));
}

test("tickets: student talks, solver may share; strangers and ended sessions are refused", { skip: NOW_SKIP }, async () => {
  const { student, solver, requestId, sessionId } = await acceptedHumanSession();

  const studentTicket = await issueRoomTicket(student, sessionId);
  assert.equal(studentTicket.role, "student");
  assert.equal(studentTicket.canScreenShare, false);
  assert.equal(studentTicket.recorded, true);
  assert.equal(studentTicket.peerName, "Ravi");
  const { payload } = await jwtVerify(studentTicket.token, new TextEncoder().encode(SECRET));
  assert.equal(payload.sub, `student-${sessionId}`, "a per-role identity, never the user id");
  assert.deepEqual((payload.video as { canPublishSources: string[] }).canPublishSources, ["microphone"]);
  assert.equal((payload.video as { room: string }).room, `now-${sessionId}`);

  const solverTicket = await issueRoomTicket(solver.userId, sessionId);
  assert.equal(solverTicket.role, "solver");
  assert.equal(solverTicket.canScreenShare, true);
  assert.equal(solverTicket.peerName, "Meera", "a solver sees the student's first name only");

  const stranger = await seedUser("Someone Else");
  await assert.rejects(issueRoomTicket(stranger, sessionId), /not found/i);

  // No LiveKit config → a clear 503, not a crash.
  const url = process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_URL;
  await assert.rejects(issueRoomTicket(student, sessionId), /not available/);
  process.env.LIVEKIT_URL = url;

  await cancelRequest(student, requestId);
  await assert.rejects(issueRoomTicket(student, sessionId), /ended/);
  assert.equal(callsFor("DeleteRoom", `now-${sessionId}`).length, 1, "cancel closes the room");
});

test("going live starts the recording; ending deletes the room", { skip: NOW_SKIP }, async () => {
  const { student, solver, sessionId } = await acceptedHumanSession();
  await joinSession(student, sessionId);
  assert.equal(callsFor("StartRoomCompositeEgress", `now-${sessionId}`).length, 0, "no recording before both join");
  await joinSession(solver.userId, sessionId);

  const egress = callsFor("StartRoomCompositeEgress", `now-${sessionId}`);
  assert.equal(egress.length, 1);
  assert.equal(egress[0].body.audio_only, true);
  const output = (egress[0].body.file_outputs as { filepath: string; s3: { bucket: string; access_key: string } }[])[0];
  assert.equal(output.filepath, `origin-now/recordings/${sessionId}.ogg`);
  assert.equal(output.s3.bucket, "origin-recordings");
  assert.equal(output.s3.access_key, "rec-key", "the dedicated recording key, not the app's R2 key");
  const live = await sessionOf((await rawPool().query(`SELECT request_id FROM now.sessions WHERE id = $1`, [sessionId])).rows[0].request_id);
  assert.equal(live.recording_key, `origin-now/recordings/${sessionId}.ogg`);
  assert.ok(live.recording_egress_id);

  await endSession({ userId: solver.userId }, sessionId, { outcome: "resolved" });
  assert.equal(callsFor("DeleteRoom", `now-${sessionId}`).length, 1);
  await assert.rejects(issueRoomTicket(student, sessionId), /ended/);
});

test("a no-show also closes the room; missing storage is logged, not fatal", { skip: NOW_SKIP }, async () => {
  const { student, sessionId } = await acceptedHumanSession();
  const savedKey = process.env.NOW_RECORDING_R2_ACCESS_KEY_ID;
  delete process.env.NOW_RECORDING_R2_ACCESS_KEY_ID;
  try {
    assert.equal((await issueRoomTicket(student, sessionId)).recorded, false, "the room says honestly it is not recorded");
    await joinSession(student, sessionId);
    assert.equal(await handleNoShow(sessionId, new Date(Date.now() + NO_SHOW_WINDOW_MS + 1_000)), "helper");
    assert.equal(callsFor("DeleteRoom", `now-${sessionId}`).length, 1);
  } finally {
    process.env.NOW_RECORDING_R2_ACCESS_KEY_ID = savedKey;
  }
});

test("retention: old recordings are deleted unless a report is open; admin opens are logged", { skip: NOW_SKIP }, async () => {
  const { student, solver, sessionId } = await acceptedHumanSession();
  await joinSession(student, sessionId);
  await joinSession(solver.userId, sessionId);
  await endSession({ userId: solver.userId }, sessionId, { outcome: "partial" });

  const admin = await seedUser("Admin Person");
  const link = await getRecordingLinkForAdmin(admin, sessionId, "Checking a parent's complaint");
  assert.match(link.url, /origin-recordings\/origin-now\/recordings\//);
  assert.match(link.url, /X-Amz-Expires=600/);
  const accessed = await rawPool().query(
    `SELECT actor, payload FROM now.events WHERE session_id = $1 AND type = 'recording.accessed'`,
    [sessionId],
  );
  assert.equal(accessed.rows.length, 1);
  assert.equal(accessed.rows[0].actor, admin);

  // An open report keeps the recording past retention.
  await rawPool().query(
    `INSERT INTO now.reports (id, session_id, reporter_id, reason) VALUES ($1, $2, $3, 'abuse')`,
    [`rep_${sessionId}`, sessionId, student],
  );
  const later = new Date(Date.now() + 31 * 24 * 60 * 60_000);
  const deletes: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    deletes.push(`${init?.method ?? "GET"} ${String(input)}`);
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    await purgeExpiredRecordings(later);
    assert.equal(deletes.filter((d) => d.includes(sessionId)).length, 0);

    await rawPool().query(`UPDATE now.reports SET status = 'dismissed' WHERE session_id = $1`, [sessionId]);
    await purgeExpiredRecordings(later);
    assert.equal(deletes.filter((d) => d.includes(sessionId)).length, 1);
    assert.match(deletes.find((d) => d.includes(sessionId))!, /^DELETE .*origin-recordings/);
  } finally {
    globalThis.fetch = realFetch;
  }
  const row = await rawPool().query(`SELECT recording_key, recording_deleted_at FROM now.sessions WHERE id = $1`, [sessionId]);
  assert.equal(row.rows[0].recording_key, null);
  assert.ok(row.rows[0].recording_deleted_at);
  await assert.rejects(getRecordingLinkForAdmin(admin, sessionId, "Looking again later"), /no recording/i);
});
