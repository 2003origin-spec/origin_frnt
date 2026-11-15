/**
 * Study Music routes through the real route files and handleAppApi, with a
 * fake pg pool (an in-memory music.tracks / user_prefs / listen_sessions),
 * stubbed auth, flag, rate limit and R2 reads (V1/STUDY_MUSIC_PLAN.md §11.1):
 *   - admin: every verb is 403 for a non-admin; upload checks (token, size,
 *     magic bytes, sha256); publish refused without licence fields; retire;
 *     delete only draft/retired; audit events; works while the flag is off;
 *   - student (website + app doors): flag off → refused; admins refused;
 *     only published tracks listed; links only for published (bad uuid and
 *     retired → 404); 429 from the link limit; prefs validation; listen
 *     validation and "another user's session → 404".
 * The SQL itself (GREATEST / wall-clock cap, IST day) runs against a real
 * Postgres in tests/integration/study-music.test.ts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { createFakePool, stubModules, userPostgresStub, type FakeResult } from "./_module-stubs";

process.env.R2_ENDPOINT = "http://127.0.0.1:9466";
process.env.R2_ACCESS_KEY_ID = "dev";
process.env.R2_SECRET_ACCESS_KEY = "dev-secret";
process.env.R2_PRIVATE_BUCKET = "private-dev";
process.env.R2_BUCKET_NAME = "public-dev";

const pool = createFakePool();
const audits: { action: string; entityId: string }[] = [];
const objects = new Map<string, Uint8Array>();
const deleted: string[] = [];
let role: "admin" | "student" | "teacher" = "admin";
let userId = "u_admin";
let flagOn = true;
let rateLimited = false;

stubModules({
  "@/server/user-postgres": userPostgresStub(pool),
  "@/server/authz": (real: { AuthzError: new (status: number, message: string) => Error }) =>
    new Proxy(real, {
      get(target, key, receiver) {
        if (key === "requireAdmin") {
          return async () => {
            if (role !== "admin") throw new target.AuthzError(403, "You do not have permission to perform this action.");
            return { userId, role };
          };
        }
        if (key === "requireRole") {
          return async (_req: unknown, roles: string[]) => {
            if (!roles.includes(role)) throw new target.AuthzError(403, "You do not have permission to perform this action.");
            return { userId, role };
          };
        }
        if (key === "getAuthContext") return async () => ({ userId, role });
        return Reflect.get(target, key, receiver);
      },
    }),
  "@/server/feature-flags-runtime": (real: object) => ({
    ...real,
    isFeatureEnabledRuntime: async () => flagOn,
    requireFeatureEnabledRuntime: async (flag: string) => {
      const { FeatureDisabledError } = await import("../../src/lib/feature-flags");
      if (!flagOn) throw new FeatureDisabledError(flag as never);
    },
  }),
  "@/lib/rate-limit": (real: object) => ({
    ...real,
    checkRateLimit: async () => (rateLimited ? new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 }) : null),
  }),
  "@/server/shared-mutation-limit": (real: object) => ({ ...real, checkSharedMutationLimit: async () => null }),
  "@/server/workspaces/audit": (real: object) => ({
    ...real,
    recordAuditEvent: async (input: { action: string; entityId: string }) => {
      audits.push({ action: input.action, entityId: input.entityId });
    },
  }),
  "@/server/media-storage": (real: object) => ({
    ...real,
    headR2Object: async ({ objectKey }: { objectKey: string }) => {
      const body = objects.get(objectKey);
      return body ? { sizeBytes: body.length, etag: '"x"' } : null;
    },
    readR2ObjectStart: async ({ objectKey, bytes }: { objectKey: string; bytes: number }) => {
      const body = objects.get(objectKey);
      return body ? body.slice(0, bytes) : null;
    },
    deleteR2Object: async ({ objectKey }: { objectKey: string }) => {
      deleted.push(objectKey);
      objects.delete(objectKey);
    },
  }),
});

(globalThis as { __originMusicSchemaEnsured?: boolean }).__originMusicSchemaEnsured = true;

// ── In-memory music tables ───────────────────────────────────────────────────

type Row = Record<string, unknown>;
let tracks: Row[] = [];
let prefs: Row[] = [];
let sessions: Row[] = [];

const COLS: Record<string, string> = {
  title: "title", artist: "artist", mood: "mood", duration_seconds: "duration_seconds", loopable: "loopable",
  allow_offline: "allow_offline", sort_order: "sort_order", source_url: "source_url", licence_name: "licence_name",
  licence_url: "licence_url", attribution_required: "attribution_required", attribution_text: "attribution_text",
  licence_proof_key: "licence_proof_key",
};

function fakeDb() {
  pool.handler = (sql, params): FakeResult | undefined => {
    const p = params as unknown[];
    if (sql.startsWith("SELECT") && sql.includes("FROM music.tracks WHERE status = 'published'")) {
      return { rows: tracks.filter((t) => t.status === "published") };
    }
    if (sql.startsWith("SELECT") && sql.includes("FROM music.tracks WHERE id = $1")) return { rows: tracks.filter((t) => t.id === p[0]) };
    if (sql.startsWith("SELECT") && sql.includes("FROM music.tracks") && sql.includes("ORDER BY CASE status")) return { rows: [...tracks] };
    if (sql.startsWith("INSERT INTO music.tracks")) {
      if (tracks.some((t) => t.object_key === p[7])) throw Object.assign(new Error("duplicate"), { code: "23505" });
      const row: Row = {
        id: p[0], title: p[1], artist: p[2], mood: p[3], duration_seconds: p[4], loopable: p[5], allow_offline: p[6],
        object_key: p[7], mime_type: p[8], size_bytes: String(p[9]), sha256: p[10], source_url: p[11], licence_name: p[12],
        licence_url: p[13], attribution_required: p[14], attribution_text: p[15], licence_proof_key: p[16], status: "draft",
        sort_order: p[17], created_by: p[18], created_at: new Date(), updated_at: new Date(), published_at: null,
      };
      tracks.push(row);
      return { rows: [row] };
    }
    if (sql.startsWith("UPDATE music.tracks SET status = 'published'")) {
      const row = tracks.find((t) => t.id === p[0] && t.status === "draft");
      if (!row) return { rows: [] };
      Object.assign(row, { status: "published", published_at: new Date() });
      return { rows: [row] };
    }
    if (sql.startsWith("UPDATE music.tracks SET status = 'retired'")) {
      const row = tracks.find((t) => t.id === p[0] && t.status === "published");
      if (!row) return { rows: [] };
      row.status = "retired";
      return { rows: [row] };
    }
    if (sql.startsWith("UPDATE music.tracks SET")) {
      const row = tracks.find((t) => t.id === p[0]);
      if (!row) return { rows: [] };
      for (const [, col, idx] of sql.matchAll(/(\w+) = \$(\d+)/gu)) if (COLS[col]) row[col] = p[Number(idx) - 1];
      return { rows: [row] };
    }
    if (sql.startsWith("DELETE FROM music.tracks")) {
      const row = tracks.find((t) => t.id === p[0] && (t.status === "draft" || t.status === "retired"));
      if (!row) return { rows: [] };
      tracks = tracks.filter((t) => t !== row);
      sessions = sessions.filter((s) => s.track_id !== row.id);
      return { rows: [row] };
    }
    if (sql.includes("FROM music.user_prefs WHERE user_id")) return { rows: prefs.filter((r) => r.user_id === p[0]) };
    if (sql.includes("INSERT INTO music.user_prefs")) {
      let row = prefs.find((r) => r.user_id === p[0]);
      if (!row) prefs.push((row = { user_id: p[0], pause_during_tests: true, default_mood: "lofi" }));
      if (p[1] !== null) row.pause_during_tests = p[1];
      if (p[2] !== null) row.default_mood = p[2];
      return { rows: [row] };
    }
    if (sql.includes("INSERT INTO music.listen_sessions")) {
      const [id, uid, platform, trackId, seconds, focus] = p as [string, string, string, string, number, number];
      const track = tracks.find((t) => t.id === trackId && (t.status === "published" || t.status === "retired"));
      const existing = sessions.find((s) => s.id === id);
      if (existing) {
        if (existing.user_id !== uid || existing.track_id !== trackId) return { rows: [] };
        existing.seconds = Math.max(Number(existing.seconds), seconds);
        existing.focus_seconds = Math.min(Math.max(Number(existing.focus_seconds), focus), Number(existing.seconds));
        return { rows: [{ id }] };
      }
      if (!track) return { rows: [] };
      sessions.push({ id, user_id: uid, track_id: trackId, platform, seconds, focus_seconds: focus });
      return { rows: [{ id }] };
    }
    if (sql.includes("FROM music.listen_sessions")) {
      const mine = sessions.filter((s) => s.user_id === p[0]);
      return { rows: [{ seconds: mine.reduce((a, s) => a + Number(s.seconds), 0), focus_seconds: mine.reduce((a, s) => a + Number(s.focus_seconds), 0) }] };
    }
    return undefined;
  };
}

function reset() {
  pool.reset();
  fakeDb();
  tracks = [];
  prefs = [];
  sessions = [];
  audits.length = 0;
  deleted.length = 0;
  objects.clear();
  role = "admin";
  userId = "u_admin";
  flagOn = true;
  rateLimited = false;
}

// ── Callers ──────────────────────────────────────────────────────────────────

async function req(method: string, url: string, body?: unknown) {
  const { NextRequest } = await import("next/server");
  return new NextRequest(new URL(url, "https://www.o3origin.com"), {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function admin(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown) {
  const route = await import("../../src/app/api/admin/music/[[...slug]]/route");
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const context = { params: Promise.resolve(segments.length ? { slug: segments } : {}) };
  return route[method](await req(method, `/api/admin/music${path}`, body), context);
}

async function web(method: "GET" | "PUT" | "POST", path: string, body?: unknown) {
  const route = await import("../../src/app/api/music/[[...slug]]/route");
  const segments = path.split("/").filter(Boolean);
  const context = { params: Promise.resolve(segments.length ? { slug: segments } : {}) };
  return route[method](await req(method, `/api/music${path}`, body), context);
}

async function app(method: string, path: string, body?: unknown) {
  const { handleAppApi } = await import("../../src/server/mobile/app-api");
  return (await handleAppApi(method, await req(method, `/api/mobile/music/${path}`, body), ["music", ...path.split("/")]))!;
}

const M4A = (() => {
  const bytes = new Uint8Array(4000);
  bytes.set([0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]);
  for (let i = 12; i < bytes.length; i += 1) bytes[i] = i % 251;
  return bytes;
})();
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

const META = {
  title: "Test tone",
  artist: "Origin",
  mood: "lofi",
  durationSeconds: 30,
  sourceUrl: "https://www.o3origin.com/",
  licenceName: "Made by Origin",
  licenceUrl: "https://www.o3origin.com/",
  attributionRequired: false,
  attributionText: "‘Test tone’ by Origin",
};

/** Presign + "upload" (into the fake bucket) + create a draft. */
async function createDraft(body: Uint8Array = M4A, extra: Record<string, unknown> = {}) {
  const pres = await admin("POST", "/presign", { kind: "audio", contentType: "audio/mp4", size: body.length });
  assert.equal(pres.status, 200);
  const { objectKey, uploadToken, uploadHeaders, uploadUrl } = await pres.json();
  assert.match(objectKey, /^music\/tracks\/[0-9a-f-]{36}\.m4a$/);
  assert.deepEqual(uploadHeaders, { "Content-Type": "audio/mp4" });
  assert.match(uploadUrl, /^http:\/\/127\.0\.0\.1:9466\/private-dev\/music\/tracks\//);
  assert.match(uploadUrl, /X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost/);
  objects.set(objectKey, body);
  return admin("POST", "/tracks", { ...META, objectKey, uploadToken, sha256: sha(body), ...extra });
}

async function publishedTrack(): Promise<string> {
  const created = await createDraft();
  const { track } = await created.json();
  assert.equal((await admin("POST", `/tracks/${track.id}/publish`)).status, 200);
  return track.id;
}

// ── Admin ────────────────────────────────────────────────────────────────────

test("admin: a non-admin gets 403 on every admin verb", async () => {
  reset();
  role = "student";
  userId = "u_student";
  const id = "0b0e2c1e-1111-4111-8111-111111111111";
  const calls: [Parameters<typeof admin>[0], string][] = [
    ["GET", ""],
    ["POST", "/presign"],
    ["POST", "/tracks"],
    ["PATCH", `/tracks/${id}`],
    ["POST", `/tracks/${id}/publish`],
    ["POST", `/tracks/${id}/retire`],
    ["DELETE", `/tracks/${id}`],
    ["GET", `/tracks/${id}/preview-url`],
  ];
  for (const [method, path] of calls) {
    const res = await admin(method, path, method === "GET" || method === "DELETE" ? undefined : {});
    assert.equal(res.status, 403, `${method} ${path}`);
  }
  role = "teacher";
  assert.equal((await admin("GET", "")).status, 403);
  assert.equal(pool.queries.length, 0, "nothing reached the database");
});

test("admin: upload → draft → publish → retire → delete, audited, while the student flag is OFF", async () => {
  reset();
  flagOn = false;
  const created = await createDraft();
  assert.equal(created.status, 201);
  const { track } = await created.json();
  assert.equal(track.status, "draft");
  assert.equal(track.sizeBytes, M4A.length);
  assert.equal(track.sha256, sha(M4A));

  const list = await (await admin("GET", "")).json();
  assert.equal(list.tracks.length, 1);
  assert.equal(list.storageBytes, M4A.length);
  assert.equal(list.studentsCanSee, false, "the banner shows");

  assert.equal((await admin("DELETE", `/tracks/${track.id}`)).status, 200 /* a draft may be deleted */ );
  const again = await (await createDraft()).json();
  assert.equal((await admin("POST", `/tracks/${again.track.id}/publish`)).status, 200);
  assert.equal((await admin("DELETE", `/tracks/${again.track.id}`)).status, 409, "published can't be deleted");
  assert.equal((await admin("POST", `/tracks/${again.track.id}/publish`)).status, 409, "only drafts publish");
  assert.equal((await admin("POST", `/tracks/${again.track.id}/retire`)).status, 200);
  assert.equal((await admin("POST", `/tracks/${again.track.id}/retire`)).status, 409);
  assert.equal((await admin("POST", `/tracks/${again.track.id}/publish`)).status, 409, "retired stays retired");
  const del = await admin("DELETE", `/tracks/${again.track.id}`);
  assert.equal(del.status, 200);
  assert.ok(deleted.includes(again.track.objectKey), "the audio object is removed");
  assert.deepEqual(
    audits.map((a) => a.action),
    ["music.track.created", "music.track.deleted", "music.track.created", "music.track.published", "music.track.retired", "music.track.deleted"],
  );
});

test("admin: the upload must be the one signed — token, size, type and hash", async () => {
  reset();
  const pres = await (await admin("POST", "/presign", { kind: "audio", contentType: "audio/mp4", size: M4A.length })).json();
  const body = { ...META, objectKey: pres.objectKey, uploadToken: pres.uploadToken, sha256: sha(M4A) };

  // Not uploaded yet.
  assert.equal((await admin("POST", "/tracks", body)).status, 409);
  // Uploaded with a different size than signed.
  objects.set(pres.objectKey, M4A.slice(0, 100));
  assert.equal((await admin("POST", "/tracks", body)).status, 409);
  // Right size but not audio.
  const html = new Uint8Array(M4A.length).fill(0x3c);
  objects.set(pres.objectKey, html);
  assert.equal((await (await admin("POST", "/tracks", { ...body, sha256: sha(html) })).json()).code, "not_audio");
  // Real file, wrong hash.
  objects.set(pres.objectKey, M4A);
  assert.equal((await (await admin("POST", "/tracks", { ...body, sha256: "0".repeat(64) })).json()).code, "sha256_mismatch");
  // A token issued to another admin, or for another key.
  userId = "u_admin_2";
  assert.equal((await admin("POST", "/tracks", body)).status, 403);
  userId = "u_admin";
  assert.equal((await admin("POST", "/tracks", { ...body, objectKey: "imports/uploads/x/a.pdf" })).status, 400);
  assert.equal((await admin("POST", "/tracks", { ...body, objectKey: `music/tracks/../${pres.objectKey}` })).status, 400);
  // Finally the real thing works, once.
  assert.equal((await admin("POST", "/tracks", body)).status, 201);
  assert.equal((await admin("POST", "/tracks", body)).status, 409, "one upload, one track");
});

test("admin: presign refuses wrong types and sizes; publish refuses missing licence fields", async () => {
  reset();
  assert.equal((await admin("POST", "/presign", { kind: "audio", contentType: "audio/ogg", size: 10 })).status, 400);
  assert.equal((await admin("POST", "/presign", { kind: "audio", contentType: "audio/mp4", size: 15 * 1024 * 1024 + 1 })).status, 400);
  assert.equal((await admin("POST", "/presign", { kind: "proof", contentType: "image/svg+xml", size: 10 })).status, 400);
  assert.equal((await createDraft(M4A, { licenceUrl: "http://insecure.example/" })).status, 400);

  const { track } = await (await createDraft()).json();
  // A row with a blank licence field (edited by hand on Neon) can't be published.
  const row = tracks.find((t) => t.id === track.id)!;
  row.attribution_text = "";
  const res = await admin("POST", `/tracks/${track.id}/publish`);
  assert.equal(res.status, 400);
  assert.match((await res.json()).detail, /credit text/);
  row.attribution_text = "ok";
  // The file has gone missing from storage.
  objects.delete(track.objectKey);
  assert.equal((await (await admin("POST", `/tracks/${track.id}/publish`)).json()).code, "file_missing");
});

test("admin: edit changes text fields, refuses blanks, never the file; preview link is 5 minutes", async () => {
  reset();
  const { track } = await (await createDraft()).json();
  const res = await admin("PATCH", `/tracks/${track.id}`, { title: "Renamed", sortOrder: 3 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).track.title, "Renamed");
  assert.equal((await admin("PATCH", `/tracks/${track.id}`, { sourceUrl: "" })).status, 400);
  assert.equal((await admin("PATCH", `/tracks/${track.id}`, { objectKey: "music/tracks/x.m4a" })).status, 400, "only unknown field → nothing to change");
  assert.equal((await admin("PATCH", "/tracks/not-a-uuid", { title: "x" })).status, 404);
  const preview = await (await admin("GET", `/tracks/${track.id}/preview-url`)).json();
  assert.match(preview.url, /X-Amz-Expires=300&/);
  assert.equal((await admin("GET", `/tracks/${track.id}/preview-url?what=proof`)).status, 404, "no proof stored");
});

// ── Student ──────────────────────────────────────────────────────────────────

function asStudent(id = "u_student") {
  role = "student";
  userId = id;
}

test("student: flag off → both doors refuse; admin routes still work", async () => {
  reset();
  await publishedTrack();
  flagOn = false;
  asStudent();
  assert.equal((await web("GET", "/tracks")).status, 404);
  assert.equal((await app("GET", "tracks")).status, 404);
  role = "admin";
  userId = "u_admin";
  assert.equal((await admin("GET", "")).status, 200);
});

test("student: published tracks only, with credit, prefs and today; admins are refused", async () => {
  reset();
  const publishedId = await publishedTrack();
  await createDraft(); // a draft never shows
  asStudent();
  for (const res of [await web("GET", "/tracks"), await app("GET", "tracks")]) {
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cache-control"), "private, max-age=300");
    const body = await res.json();
    assert.deepEqual(body.tracks.map((t: { id: string }) => t.id), [publishedId]);
    const [t] = body.tracks;
    assert.equal(t.objectKey, undefined, "no storage key to students");
    assert.equal(t.version, t.sha256.slice(0, 16));
    assert.deepEqual(Object.keys(t.credit).sort(), ["licenceName", "licenceUrl", "required", "sourceUrl", "text"]);
    assert.deepEqual(body.prefs, { pauseDuringTests: true, defaultMood: "lofi" });
    assert.deepEqual(body.today, { seconds: 0, focusSeconds: 0 });
  }
  role = "teacher";
  assert.equal((await web("GET", "/tracks")).status, 200, "teachers listen too (D6)");
  role = "admin";
  assert.equal((await web("GET", "/tracks")).status, 403);
});

test("student: signed link only for a published uuid; retired → 404; limit → 429", async () => {
  reset();
  const id = await publishedTrack();
  asStudent();
  const res = await web("GET", `/tracks/${id}/url`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "private, no-store");
  const { url, expiresAt } = await res.json();
  assert.match(url, /\/private-dev\/music\/tracks\/.+\.m4a\?/);
  assert.match(url, /X-Amz-Expires=3600&/);
  assert.match(url, /X-Amz-SignedHeaders=host&/);
  assert.ok(Date.parse(expiresAt) > Date.now() + 3500_000);
  assert.equal((await app("GET", `tracks/${id}/url`)).status, 200);

  assert.equal((await web("GET", "/tracks/not-a-uuid/url")).status, 404);
  assert.equal((await web("GET", "/tracks/0b0e2c1e-1111-4111-8111-111111111111/url")).status, 404);
  rateLimited = true;
  assert.equal((await web("GET", `/tracks/${id}/url`)).status, 429);
  rateLimited = false;

  role = "admin";
  userId = "u_admin";
  await admin("POST", `/tracks/${id}/retire`);
  asStudent();
  assert.equal((await web("GET", `/tracks/${id}/url`)).status, 404);
  assert.deepEqual((await (await web("GET", "/tracks")).json()).tracks, []);
});

test("student: prefs reject unknown moods and non-booleans; save round-trips", async () => {
  reset();
  asStudent();
  assert.equal((await web("PUT", "/prefs", { defaultMood: "jazz" })).status, 400);
  assert.equal((await web("PUT", "/prefs", { pauseDuringTests: "no" })).status, 400);
  assert.equal((await web("PUT", "/prefs", {})).status, 400);
  const saved = await web("PUT", "/prefs", { pauseDuringTests: false });
  assert.deepEqual((await saved.json()).prefs, { pauseDuringTests: false, defaultMood: "lofi" });
  const viaApp = await app("PUT", "prefs", { defaultMood: "nature" });
  assert.deepEqual((await viaApp.json()).prefs, { pauseDuringTests: false, defaultMood: "nature" });
});

test("student: listen validates, records the platform, and another user's session → 404", async () => {
  reset();
  const trackId = await publishedTrack();
  asStudent();
  const sessionId = "33333333-3333-4333-8333-333333333333";
  assert.equal((await web("POST", "/listen", { sessionId: "x", trackId, seconds: 1, focusSeconds: 0 })).status, 400);
  assert.equal((await web("POST", "/listen", { sessionId, trackId, seconds: -1, focusSeconds: 0 })).status, 400);
  const first = await web("POST", "/listen", { sessionId, trackId, seconds: 50, focusSeconds: 20 });
  assert.equal(first.status, 200);
  assert.deepEqual((await first.json()).today, { seconds: 50, focusSeconds: 20 });
  const insert = pool.matching("INSERT INTO music.listen_sessions").at(-1)!;
  assert.equal(insert.params[2], "web");
  assert.match(insert.sql, /GREATEST\(music\.listen_sessions\.seconds/);
  assert.match(insert.sql, /now\(\) - music\.listen_sessions\.started_at/, "capped by wall-clock time");
  assert.match(insert.sql, /WHERE music\.listen_sessions\.user_id = \$2/, "never updates another user's row");

  const otherSession = "44444444-4444-4444-8444-444444444444";
  assert.equal((await app("POST", "listen", { sessionId: otherSession, trackId, seconds: 10, focusSeconds: 0 })).status, 200);
  assert.equal(pool.matching("INSERT INTO music.listen_sessions").at(-1)!.params[2], "android");

  asStudent("u_someone_else");
  assert.equal((await web("POST", "/listen", { sessionId, trackId, seconds: 99, focusSeconds: 0 })).status, 404);
  assert.equal((await web("POST", "/listen", { sessionId: "55555555-5555-4555-8555-555555555555", trackId: "0b0e2c1e-1111-4111-8111-111111111111", seconds: 1, focusSeconds: 0 })).status, 404, "unknown track");
});

test("unknown paths and methods are 404, never 500", async () => {
  reset();
  asStudent();
  assert.equal((await web("GET", "/nope")).status, 404);
  assert.equal((await web("POST", "/tracks")).status, 404);
  role = "admin";
  userId = "u_admin";
  assert.equal((await admin("GET", "/nope")).status, 404);
  assert.equal((await admin("POST", "/tracks/x/explode")).status, 404);
});

test("play-link lifetime: 1 h; STUDY_MUSIC_LINK_SECONDS shortens it outside production only", async () => {
  const { playLinkSeconds } = await import("../../src/server/music/student-api");
  assert.equal(playLinkSeconds({}), 3600);
  assert.equal(playLinkSeconds({ STUDY_MUSIC_LINK_SECONDS: "90" }), 90);
  assert.equal(playLinkSeconds({ NODE_ENV: "production", STUDY_MUSIC_LINK_SECONDS: "90" }), 3600, "never in production");
  for (const bad of ["30", "5000", "abc", "90.5", ""]) assert.equal(playLinkSeconds({ STUDY_MUSIC_LINK_SECONDS: bad }), 3600, bad);
});
