/** `?next=` after login (plan §8.4): only allow-listed same-origin paths come back. */

import test from "node:test";
import assert from "node:assert/strict";

import { loginReturnPath } from "@/lib/login-return";

test("the Rank Predictor is an allowed return path (query and hash dropped)", () => {
  assert.equal(loginReturnPath("/rank-predictor"), "/rank-predictor");
  assert.equal(loginReturnPath("/rank-predictor?attempt=r1#x"), "/rank-predictor");
});

test("anything else keeps today's behaviour (role home): other pages and open redirects", () => {
  for (const next of [null, "", "/dashboard", "/rank-predictor/colleges", "//evil.com", "/\\evil.com", "https://evil.com/rank-predictor", "/rank-predictor/../admin", "%2Frank-predictor"]) {
    assert.equal(loginReturnPath(next), null, String(next));
  }
});
