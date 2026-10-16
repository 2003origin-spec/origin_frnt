/**
 * LiveKit for Origin NOW rooms (plan doc, "LiveKit tokens and rooms are
 * narrow" and "Recording means LiveKit Egress"; build step 6).
 *
 * Tokens are LiveKit access tokens (HS256 JWTs with a `video` grant) signed
 * here with `jose`, and the two server calls (DeleteRoom, StartRoomCompositeEgress)
 * are LiveKit's Twirp JSON API over fetch — so no new dependency (decision B26).
 *
 * - One room per session, `now-<sessionId>`, identity = user id, 15-minute TTL.
 * - No `roomCreate` grant on any participant token.
 * - Student: microphone + data channel. Solver: microphone + screen share +
 *   data channel (the pointer). Nobody publishes a camera.
 * - The server ends a call by deleting the room; a token's expiry only stops new joins.
 */

import { SignJWT } from "jose";

export type RoomRole = "student" | "solver";

export const PARTICIPANT_TOKEN_TTL_SECONDS = 15 * 60;
const SERVER_TOKEN_TTL_SECONDS = 60;

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

export type LiveKitConfig = { wsUrl: string; httpUrl: string; apiKey: string; apiSecret: string };

export function getLiveKitConfig(): LiveKitConfig | null {
  const wsUrl = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  if (!wsUrl || !apiKey || !apiSecret) return null;
  const httpUrl = wsUrl.replace(/^ws(s?):\/\//u, "http$1://").replace(/\/+$/u, "");
  return { wsUrl, httpUrl, apiKey, apiSecret };
}

export function roomNameFor(sessionId: string): string {
  return `now-${sessionId}`;
}

export type VideoGrant = {
  room?: string;
  roomJoin?: boolean;
  roomCreate?: boolean;
  roomRecord?: boolean;
  roomAdmin?: boolean;
  canPublish?: boolean;
  canSubscribe?: boolean;
  canPublishData?: boolean;
  canPublishSources?: string[];
  canUpdateOwnMetadata?: boolean;
};

/** Pure: exactly what each side of a session may do in the room. */
export function participantGrant(role: RoomRole, room: string): VideoGrant {
  return {
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
    canUpdateOwnMetadata: false,
    canPublishSources: role === "solver" ? ["microphone", "screen_share", "screen_share_audio"] : ["microphone"],
  };
}

async function sign(config: LiveKitConfig, claims: Record<string, unknown>, ttlSeconds: number, subject?: string) {
  const key = new TextEncoder().encode(config.apiSecret);
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(config.apiKey)
    .setNotBefore(Math.floor(Date.now() / 1000) - 5)
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds);
  if (subject) jwt = jwt.setSubject(subject).setJti(`${subject}:${Date.now()}`);
  return jwt.sign(key);
}

export async function mintParticipantToken(
  config: LiveKitConfig,
  input: { room: string; identity: string; name: string; role: RoomRole; ttlSeconds?: number },
): Promise<string> {
  return sign(
    config,
    {
      name: input.name,
      video: participantGrant(input.role, input.room),
      metadata: JSON.stringify({ role: input.role }),
    },
    input.ttlSeconds ?? PARTICIPANT_TOKEN_TTL_SECONDS,
    input.identity,
  );
}

// ---------------------------------------------------------------------------
// Server API (Twirp JSON).

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
let fetchOverride: FetchLike | null = null;

/** Test seam. */
export function __setLiveKitFetchForTests(fn: FetchLike | null): void {
  fetchOverride = fn;
}

async function twirp<T>(config: LiveKitConfig, service: string, method: string, body: unknown, grant: VideoGrant): Promise<T> {
  const token = await sign(config, { video: grant }, SERVER_TOKEN_TTL_SECONDS);
  const doFetch = fetchOverride ?? ((url: string, init: RequestInit) => fetch(url, init));
  const res = await doFetch(`${config.httpUrl}/twirp/livekit.${service}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`LiveKit ${service}.${method} failed (${res.status}): ${text.slice(0, 200)}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }
  return (text ? JSON.parse(text) : {}) as T;
}

/** Agent name the Origin Voice worker registers with (origin-ai/app/voice_agent/worker.py). */
export function botAgentName(): string {
  return env("NOW_BOT_AGENT_NAME") ?? "origin-voice-agent";
}

/**
 * Asks LiveKit to send the Origin Voice agent into a room with this job
 * metadata (it is given to the agent only, never to room participants).
 */
export async function createAgentDispatch(
  config: LiveKitConfig,
  input: { room: string; agentName: string; metadata: string },
): Promise<string | null> {
  const res = await twirp<{ id?: string }>(
    config,
    "AgentDispatchService",
    "CreateDispatch",
    { agent_name: input.agentName, room: input.room, metadata: input.metadata },
    { roomAdmin: true, room: input.room },
  );
  return res.id ?? null;
}

/** Disconnects everyone and closes the room. A room that is already gone is fine. */
export async function deleteRoom(config: LiveKitConfig, room: string): Promise<void> {
  try {
    await twirp(config, "RoomService", "DeleteRoom", { room }, { roomCreate: true, room });
  } catch (error) {
    if ((error as { status?: number }).status === 404) return;
    throw error;
  }
}

export type RecordingStorage = {
  accessKey: string;
  secret: string;
  endpoint: string;
  bucket: string;
  region: string;
};

/**
 * Where recordings go. A dedicated R2 token (write-only on the recordings
 * prefix is the intended scope) because these credentials are handed to
 * LiveKit's Egress service; the app's own R2 key never leaves the server.
 */
export function getRecordingStorage(): RecordingStorage | null {
  const accessKey = env("NOW_RECORDING_R2_ACCESS_KEY_ID");
  const secret = env("NOW_RECORDING_R2_SECRET_ACCESS_KEY");
  const endpoint =
    env("NOW_RECORDING_R2_ENDPOINT") ??
    env("R2_ENDPOINT") ??
    env("R2_ENDPOINT_URL") ??
    (env("R2_ACCOUNT_ID") ? `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com` : null);
  const bucket = env("NOW_RECORDING_R2_BUCKET") ?? env("R2_BUCKET_NAME") ?? "origin";
  if (!accessKey || !secret || !endpoint) return null;
  return { accessKey, secret, endpoint: endpoint.replace(/\/+$/u, ""), bucket, region: "auto" };
}

export function recordingObjectKey(sessionId: string): string {
  return `origin-now/recordings/${sessionId}.ogg`;
}

/** Pure: the Egress request body (audio only, OGG, straight to R2). */
export function audioEgressRequest(room: string, objectKey: string, storage: RecordingStorage) {
  return {
    room_name: room,
    audio_only: true,
    file_outputs: [
      {
        file_type: "OGG",
        filepath: objectKey,
        disable_manifest: true,
        s3: {
          access_key: storage.accessKey,
          secret: storage.secret,
          region: storage.region,
          endpoint: storage.endpoint,
          bucket: storage.bucket,
          force_path_style: true,
        },
      },
    ],
  };
}

/** Starts the audio-only room recording; it stops by itself when the room is deleted. */
export async function startAudioEgress(
  config: LiveKitConfig,
  storage: RecordingStorage,
  input: { room: string; objectKey: string },
): Promise<string> {
  const res = await twirp<{ egress_id?: string; egressId?: string }>(
    config,
    "Egress",
    "StartRoomCompositeEgress",
    audioEgressRequest(input.room, input.objectKey, storage),
    { roomRecord: true, room: input.room },
  );
  const id = res.egress_id ?? res.egressId;
  if (!id) throw new Error("LiveKit did not return an egress id.");
  return id;
}
