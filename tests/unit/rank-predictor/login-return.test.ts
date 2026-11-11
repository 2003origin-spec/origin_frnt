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

test("the exam pages are allowed return paths, so login comes back to the same exam page", async () => {
  const { loginHrefFor, signupHrefFor, LOGIN_HREF, SIGNUP_HREF } = await import("@/sections/RankPredictor/login-links");
  for (const path of ["/rank-predictor/neet", "/rank-predictor/jee-main", "/rank-predictor/jee-advanced"]) {
    assert.equal(loginReturnPath(path), path, path);
    for (const href of [loginHrefFor(path), signupHrefFor(path)]) {
      assert.equal(loginReturnPath(new URL(href, "https://www.o3origin.com").searchParams.get("next")), path, href);
    }
  }
  // The default links are unchanged.
  assert.equal(LOGIN_HREF, "/auth?next=%2Frank-predictor");
  assert.equal(SIGNUP_HREF, "/auth?mode=signup&next=%2Frank-predictor");
});
