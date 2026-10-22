/**
 * Round-3 R3-10: every analysis request carries its persisted result / DPP
 * attempt id, so ODG applies mastery once per sitting — retries of one job
 * dedupe, while a retake with identical answers and time still counts.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { withAttemptId } from "../../src/server/analysis-jobs";

test("withAttemptId tags the request with the persisted id, keeping one already set", () => {
  const request = { user_id: "u", test_id: "t", attempt_id: undefined as string | null | undefined };
  assert.deepEqual(withAttemptId(request, "res_1"), { user_id: "u", test_id: "t", attempt_id: "res_1" });
  assert.equal(withAttemptId({ attempt_id: "res_0" }, "res_1").attempt_id, "res_0");
  assert.equal(withAttemptId({ attempt_id: null }, "res_1").attempt_id, "res_1");
  // the stored job payload is not mutated
  assert.equal(request.attempt_id, undefined);
});

test("both job processors send the attempt id (queued jobs from before the field included)", () => {
  const src = readFileSync(new URL("../../src/server/analysis-jobs.ts", import.meta.url), "utf8");
  assert.match(src, /analyzeSubmittedTestWithService\(withAttemptId\(payload\.request, payload\.resultId\)\)/);
  assert.match(src, /analyzeDppAttemptWithService\(withAttemptId\(payload\.request, payload\.attemptId\)\)/);
});
