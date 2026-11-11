/** `?next=` after login (plan §8.4): only allow-listed same-origin paths come back. */

import test from "node:test";
import assert from "node:assert/strict";

import { loginReturnPath } from "@/lib/login-return";

test("the Rank Predictor is an allowed return path (query and hash dropped)", () => {
  assert.equal(loginReturnPath("/rank-predictor"), "/rank-predictor");
  assert.equal(loginReturnPath("/rank-predictor?attempt=r1#x"), "/rank-predictor");
});

test("the college finder (Stage 6) is also an allowed return path", () => {
  assert.equal(loginReturnPath("/rank-predictor/colleges"), "/rank-predictor/colleges");
  assert.equal(loginReturnPath("/rank-predictor/colleges?x=1"), "/rank-predictor/colleges");
});

test("anything else keeps today's behaviour (role home): other pages and open redirects", () => {
  for (const next of [null, "", "/dashboard", "/rank-predictor/other", "//evil.com", "/\\evil.com", "https://evil.com/rank-predictor", "/rank-predictor/../admin", "%2Frank-predictor"]) {
    assert.equal(loginReturnPath(next), null, String(next));
  }
});
