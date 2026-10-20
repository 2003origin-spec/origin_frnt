/**
 * Recordings never land in the public bucket (decision B87): the bucket is
 * NOW_RECORDING_R2_BUCKET, else R2_PRIVATE_BUCKET, and the public image bucket
 * R2_BUCKET_NAME ("origin" when unset) counts as not set — so calls go
 * unrecorded instead, and admin playback refuses to sign a link.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  audioEgressRequest,
  getRecordingBucket,
  getRecordingStorage,
  hasRecordingCredentials,
  recordingObjectKey,
} from "@/server/now/livekit";
import { NowError } from "@/server/now/now-http";
import { getRecordingLinkForAdmin } from "@/server/now/room-service";

const KEYS = [
  "NOW_RECORDING_R2_ACCESS_KEY_ID",
  "NOW_RECORDING_R2_SECRET_ACCESS_KEY",
  "NOW_RECORDING_R2_ENDPOINT",
  "NOW_RECORDING_R2_BUCKET",
  "R2_PRIVATE_BUCKET",
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
  "R2_ENDPOINT_URL",
  "R2_ACCOUNT_ID",
] as const;
type Env = Partial<Record<(typeof KEYS)[number], string>>;

/** Runs fn with exactly these recording-related env vars set; the others unset. */
async function withEnv<T>(vars: Env, fn: () => T | Promise<T>): Promise<T> {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) {
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const base: Env = {
  NOW_RECORDING_R2_ACCESS_KEY_ID: "rec-key",
  NOW_RECORDING_R2_SECRET_ACCESS_KEY: "rec-secret",
  R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com/",
  R2_BUCKET_NAME: "origin-public",
};

test("recordings go to NOW_RECORDING_R2_BUCKET with the dedicated key", async () => {
  await withEnv({ ...base, NOW_RECORDING_R2_BUCKET: "origin-recordings" }, () => {
    assert.deepEqual(getRecordingBucket(), { name: "origin-recordings", problem: null });
    const storage = getRecordingStorage();
    assert.deepEqual(storage, {
      accessKey: "rec-key",
      secret: "rec-secret",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      bucket: "origin-recordings",
      region: "auto",
    });
    const egress = audioEgressRequest("now-nses_1", recordingObjectKey("nses_1"), storage!);
    assert.equal(egress.file_outputs[0].s3.bucket, "origin-recordings");
  });
});

test("without NOW_RECORDING_R2_BUCKET the shared private bucket R2_PRIVATE_BUCKET is used", async () => {
  await withEnv({ ...base, R2_PRIVATE_BUCKET: "origin-private" }, () => {
    assert.deepEqual(getRecordingBucket(), { name: "origin-private", problem: null });
    assert.equal(getRecordingStorage()?.bucket, "origin-private");
  });
  await withEnv({ ...base, NOW_RECORDING_R2_BUCKET: "origin-recordings", R2_PRIVATE_BUCKET: "origin-private" }, () => {
    assert.equal(getRecordingStorage()?.bucket, "origin-recordings", "the recordings bucket wins");
  });
});

test("no private bucket set means no recording, not the public R2_BUCKET_NAME or 'origin'", async () => {
  await withEnv(base, () => {
    assert.deepEqual(getRecordingBucket(), { name: null, problem: "not_set" });
    assert.equal(getRecordingStorage(), null, "the old fallback returned R2_BUCKET_NAME here");
    assert.equal(hasRecordingCredentials(), true, "the key alone does not turn recording on");
  });
  await withEnv({ ...base, R2_BUCKET_NAME: undefined }, () => {
    assert.equal(getRecordingStorage(), null, "the old fallback returned 'origin' here");
  });
});

test("a bucket that is the public image bucket counts as not set", async () => {
  const cases: Env[] = [
    { NOW_RECORDING_R2_BUCKET: "origin-public" },
    { NOW_RECORDING_R2_BUCKET: "  Origin-Public " },
    { R2_PRIVATE_BUCKET: "origin-public" },
    // A wrong explicit setting is reported, never silently swapped for another bucket.
    { NOW_RECORDING_R2_BUCKET: "origin-public", R2_PRIVATE_BUCKET: "origin-private" },
    // With R2_BUCKET_NAME unset the app's default bucket is "origin".
    { R2_BUCKET_NAME: undefined, NOW_RECORDING_R2_BUCKET: "origin" },
  ];
  for (const vars of cases) {
    await withEnv({ ...base, ...vars }, () => {
      assert.deepEqual(getRecordingBucket(), { name: null, problem: "public" }, JSON.stringify(vars));
      assert.equal(getRecordingStorage(), null, JSON.stringify(vars));
    });
  }
});

test("the key, its secret and an endpoint are all needed; the endpoint falls back to the app's R2 settings", async () => {
  const bucket: Env = { NOW_RECORDING_R2_BUCKET: "origin-recordings", R2_BUCKET_NAME: "origin-public" };
  const keys: Env = { NOW_RECORDING_R2_ACCESS_KEY_ID: "k", NOW_RECORDING_R2_SECRET_ACCESS_KEY: "s" };
  await withEnv({ ...bucket, NOW_RECORDING_R2_SECRET_ACCESS_KEY: "s", R2_ENDPOINT: "https://e" }, () => {
    assert.equal(hasRecordingCredentials(), false);
    assert.equal(getRecordingStorage(), null);
  });
  await withEnv({ ...bucket, ...keys }, () => {
    assert.equal(getRecordingStorage(), null, "no endpoint anywhere");
  });
  await withEnv({ ...bucket, ...keys, R2_ACCOUNT_ID: "acct" }, () => {
    assert.equal(getRecordingStorage()?.endpoint, "https://acct.r2.cloudflarestorage.com");
  });
  await withEnv({ ...bucket, ...keys, R2_ENDPOINT: "https://app.example", NOW_RECORDING_R2_ENDPOINT: "https://rec.example/" }, () => {
    assert.equal(getRecordingStorage()?.endpoint, "https://rec.example");
  });
});

test("admin playback is refused without a private bucket, before anything is signed or read", async () => {
  for (const vars of [base, { ...base, NOW_RECORDING_R2_BUCKET: "origin-public" }]) {
    await withEnv(vars, () =>
      assert.rejects(getRecordingLinkForAdmin("admin_1", "nses_1", "Checking a complaint"), (error: unknown) => {
        assert.ok(error instanceof NowError);
        assert.equal(error.status, 503);
        assert.equal(error.code, "recording_unavailable");
        return true;
      }),
    );
  }
});
