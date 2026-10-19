import test from "node:test";
import assert from "node:assert/strict";
import { jwtVerify } from "jose";

import {
  __setLiveKitFetchForTests,
  audioEgressRequest,
  createAgentDispatch,
  deleteRoom,
  getLiveKitConfig,
  mintParticipantToken,
  participantGrant,
  recordingObjectKey,
  roomNameFor,
  startAudioEgress,
  type LiveKitConfig,
} from "@/server/now/livekit";

const config: LiveKitConfig = {
  wsUrl: "wss://example.livekit.cloud",
  httpUrl: "https://example.livekit.cloud",
  apiKey: "APIkey123",
  apiSecret: "a-very-long-test-secret-of-32-bytes!!",
};

test("the student may only talk; the solver may also share a screen; nobody may create rooms", () => {
  const student = participantGrant("student", "now-nses_1");
  const solver = participantGrant("solver", "now-nses_1");
  assert.deepEqual(student.canPublishSources, ["microphone"]);
  assert.deepEqual(solver.canPublishSources, ["microphone", "screen_share", "screen_share_audio"]);
  for (const grant of [student, solver]) {
    assert.equal(grant.roomJoin, true);
    assert.equal(grant.room, "now-nses_1");
    assert.equal(grant.canPublishData, true);
    assert.equal(grant.roomCreate, undefined);
    assert.equal(grant.roomAdmin, undefined);
    assert.equal(grant.roomRecord, undefined);
    assert.ok(!grant.canPublishSources?.includes("camera"), "no camera, ever");
  }
});

test("a participant token is a LiveKit JWT for exactly one room, identity and 15 minutes", async () => {
  const token = await mintParticipantToken(config, { room: roomNameFor("nses_1"), identity: "user_1", name: "Meera", role: "student" });
  const { payload, protectedHeader } = await jwtVerify(token, new TextEncoder().encode(config.apiSecret), { issuer: config.apiKey });
  assert.equal(protectedHeader.alg, "HS256");
  assert.equal(payload.sub, "user_1");
  assert.equal(payload.name, "Meera");
  assert.deepEqual((payload.video as { room: string }).room, "now-nses_1");
  assert.equal(JSON.parse(payload.metadata as string).role, "student");
  const ttl = (payload.exp as number) - Math.floor(Date.now() / 1000);
  assert.ok(ttl > 14 * 60 && ttl <= 15 * 60, `ttl ${ttl}`);
});

test("config needs all three env vars and derives the https API URL", () => {
  const saved = { ...process.env };
  try {
    delete process.env.LIVEKIT_URL;
    assert.equal(getLiveKitConfig(), null);
    process.env.LIVEKIT_URL = "wss://x.livekit.cloud/";
    process.env.LIVEKIT_API_KEY = "k";
    process.env.LIVEKIT_API_SECRET = "s";
    assert.equal(getLiveKitConfig()?.httpUrl, "https://x.livekit.cloud");
  } finally {
    process.env = saved;
  }
});

test("server calls: DeleteRoom (404 is fine) and an audio-only OGG egress to R2", async () => {
  const calls: { url: string; body: unknown; auth: string }[] = [];
  let status = 200;
  __setLiveKitFetchForTests(async (url, init) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) });
    return new Response(status === 200 ? JSON.stringify({ egress_id: "EG_1" }) : "not found", { status });
  });
  try {
    await deleteRoom(config, "now-nses_1");
    assert.equal(calls[0].url, "https://example.livekit.cloud/twirp/livekit.RoomService/DeleteRoom");
    assert.deepEqual(calls[0].body, { room: "now-nses_1" });
    const { payload } = await jwtVerify(calls[0].auth.replace("Bearer ", ""), new TextEncoder().encode(config.apiSecret));
    assert.equal((payload.video as { roomCreate: boolean }).roomCreate, true);

    const storage = { accessKey: "a", secret: "b", endpoint: "https://acct.r2.cloudflarestorage.com", bucket: "origin", region: "auto" };
    const egressId = await startAudioEgress(config, storage, { room: "now-nses_1", objectKey: recordingObjectKey("nses_1") });
    assert.equal(egressId, "EG_1");
    assert.equal(calls[1].url, "https://example.livekit.cloud/twirp/livekit.Egress/StartRoomCompositeEgress");
    assert.deepEqual(calls[1].body, audioEgressRequest("now-nses_1", "origin-now/recordings/nses_1.ogg", storage));
    assert.equal((calls[1].body as { audio_only: boolean }).audio_only, true);

    status = 404;
    await deleteRoom(config, "now-gone"); // already gone: not an error
  } finally {
    __setLiveKitFetchForTests(null);
  }
});

test("agent dispatch sends the job metadata to the agent with a room-admin server token", async () => {
  const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
  __setLiveKitFetchForTests(async (url, init) => {
    calls.push({ url, body: JSON.parse(String(init.body)), auth: String((init.headers as Record<string, string>).Authorization) });
    return new Response(JSON.stringify({ id: "AD_1" }), { status: 200 });
  });
  try {
    const id = await createAgentDispatch(config, { room: "now-nses_1", agentName: "origin-voice-agent", metadata: "{\"mode\":\"now_solver\"}" });
    assert.equal(id, "AD_1");
    assert.equal(calls[0].url, "https://example.livekit.cloud/twirp/livekit.AgentDispatchService/CreateDispatch");
    assert.deepEqual(calls[0].body, { agent_name: "origin-voice-agent", room: "now-nses_1", metadata: '{"mode":"now_solver"}' });
    const { payload } = await jwtVerify(calls[0].auth.replace("Bearer ", ""), new TextEncoder().encode(config.apiSecret));
    assert.deepEqual(payload.video, { roomAdmin: true, room: "now-nses_1" });
  } finally {
    __setLiveKitFetchForTests(null);
  }
});
