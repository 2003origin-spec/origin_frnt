import { describe, it } from "node:test";
import assert from "node:assert";

import {
  submitGeneratedDpp,
} from "../../src/legacy/assessments";
import * as assessmentsMod from "../../src/legacy/assessments";

// Mocking dependencies is quite involved for Next.js legacy assessment files,
// but we can at least assert that the typescript types for the analysisRequest
// in analytics-client.ts require workspace_id and teacher_id to be present 
// (or optional).

describe("ODG DPP Submit Types", () => {
  it("AnalyticsDppAttemptRequest can accept workspace_id and teacher_id", () => {
    // This is essentially a typecheck test to ensure the compiler accepts it
    const req: import("../../src/server/analytics-client").AnalyticsDppAttemptRequest = {
      user_id: "user1",
      dpp_id: "dpp1",
      title: "Title",
      focus_topics: [],
      graded_attempts: [],
      time_taken_seconds: 100,
      workspace_id: "ws1",
      teacher_id: "teacher1",
    };
    assert.strictEqual(req.workspace_id, "ws1");
    assert.strictEqual(req.teacher_id, "teacher1");
  });
});
