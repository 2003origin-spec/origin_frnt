import test from "node:test";
import assert from "node:assert/strict";

import { classifyTokenRefreshStatus } from "../src/lib/api";

test("refresh status classification only expires sessions on terminal auth failures", () => {
  assert.equal(classifyTokenRefreshStatus(200), "ok");
  assert.equal(classifyTokenRefreshStatus(204), "ok");
  assert.equal(classifyTokenRefreshStatus(400), "expired");
  assert.equal(classifyTokenRefreshStatus(401), "expired");
  assert.equal(classifyTokenRefreshStatus(403), "expired");
  assert.equal(classifyTokenRefreshStatus(429), "transient");
  assert.equal(classifyTokenRefreshStatus(500), "transient");
  assert.equal(classifyTokenRefreshStatus(503), "transient");
});
