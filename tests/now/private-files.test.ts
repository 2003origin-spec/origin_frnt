import assert from "node:assert/strict";
import test from "node:test";

import { getPrivateFilesBucket, requirePrivateFilesBucket } from "../../src/server/now/private-files";

function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  try {
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("private files use R2_PRIVATE_BUCKET and never the public image bucket (B96)", () => {
  withEnv({ R2_PRIVATE_BUCKET: "origin-private", R2_BUCKET_NAME: "origin" }, () => {
    assert.deepEqual(getPrivateFilesBucket(), { name: "origin-private", problem: null });
    assert.equal(requirePrivateFilesBucket(), "origin-private");
  });
  withEnv({ R2_PRIVATE_BUCKET: undefined }, () => {
    assert.deepEqual(getPrivateFilesBucket(), { name: null, problem: "not_set" });
    assert.throws(() => requirePrivateFilesBucket(), (e: { code?: string }) => e.code === "storage_unavailable");
  });
  withEnv({ R2_PRIVATE_BUCKET: "Origin", R2_BUCKET_NAME: undefined }, () => {
    assert.deepEqual(getPrivateFilesBucket(), { name: null, problem: "public" }, "the public bucket's default name counts too");
  });
  withEnv({ R2_PRIVATE_BUCKET: "media", R2_BUCKET_NAME: "media" }, () => {
    assert.equal(getPrivateFilesBucket().problem, "public");
  });
});
