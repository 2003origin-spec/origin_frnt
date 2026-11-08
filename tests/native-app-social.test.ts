import test from "node:test";
import assert from "node:assert/strict";

import { errorResponse } from "../src/server/mobile/app-api";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from "../src/server/social/username";

// V1/NATIVE_APP_API_PLAN.md — friends (social) and friend challenges for the native app.

async function call(method: string, path: string, body?: unknown) {
  const { NextRequest } = await import("next/server");
  const { handleAppApi } = await import("../src/server/mobile/app-api");
  const req = new NextRequest(new URL(`/api/mobile/${path}`, "https://www.o3origin.com"), {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return handleAppApi(method, req, path.split("?")[0].split("/"));
}

test("username problems reach the student as a 400 with the action's wording", async () => {
  for (const message of [
    `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters using lowercase letters, numbers, or underscores.`,
    "That username is already taken.",
    "Nothing to update.",
  ]) {
    const res = errorResponse("social/settings", new Error(message));
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { detail: message });
  }
});

test("a challenge needs a recipient before any work is done", async () => {
  const res = await call("POST", "ogcode/q1/challenge", { toUserId: "  " });
  assert.equal(res?.status, 400);
  assert.deepEqual(await res?.json(), { detail: "toUserId is required." });
});

test("unknown social paths fall through to a 404 from the catch-all", async () => {
  assert.equal(await call("GET", "social/nope"), null);
  assert.equal(await call("DELETE", "social/settings"), null);
});
