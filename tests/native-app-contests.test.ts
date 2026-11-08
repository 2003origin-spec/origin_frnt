import test from "node:test";
import assert from "node:assert/strict";

import { FeatureDisabledError } from "../src/lib/feature-flags";
import { firstName } from "../src/server/contest/contest-ranking-service";
import { errorResponse } from "../src/server/mobile/app-api";

// V1/NATIVE_APP_API_PLAN.md — contests for the native app.

function domainError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

test("mobile errors keep a contest's own 4xx and wording", async () => {
  for (const [status, message] of [
    [404, "Contest not found."],
    [403, "This contest needs an access code."],
    [409, "Registration is closed for this contest."],
  ] as const) {
    const res = errorResponse("register", domainError(status, message));
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { detail: message });
  }
});

test("a switched-off feature is a 404, not a 500", async () => {
  const res = errorResponse("register", new FeatureDisabledError("contest"));
  assert.equal(res.status, 404);
});

test("internal errors stay generic 500s and never leak their text", async () => {
  const silence = console.error;
  console.error = () => {};
  try {
    for (const error of [new Error("USER_DATABASE_URL is not configured"), domainError(500, "pg: connection refused"), domainError(400, "")]) {
      const res = errorResponse("register", error);
      assert.equal(res.status, 500);
      assert.deepEqual(await res.json(), { detail: "Something went wrong. Please try again." });
    }
  } finally {
    console.error = silence;
  }
});

test("not signed in is a 401", () => {
  assert.equal(errorResponse("contests", new Error("Not authenticated.")).status, 401);
});

test("contest boards show first names only", () => {
  assert.equal(firstName("Asha Rao Kumar"), "Asha");
  assert.equal(firstName("  Ravi  "), "Ravi");
  assert.equal(firstName(""), "Anonymous");
  assert.equal(firstName(null), "Anonymous");
});

test("room submit refuses a body without an answers array before doing any work", async () => {
  const { NextRequest } = await import("next/server");
  const { handleAppApi } = await import("../src/server/mobile/app-api");
  const req = new NextRequest(new URL("/api/mobile/study-rooms/r1/submit", "https://www.o3origin.com"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ timeTaken: 10 }),
  });
  const res = await handleAppApi("POST", req, ["study-rooms", "r1", "submit"]);
  assert.equal(res?.status, 400);
  assert.deepEqual(await res?.json(), { detail: "answers must be an array." });
});
