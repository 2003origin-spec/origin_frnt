import test from "node:test";
import assert from "node:assert/strict";

import { buildBotJobMetadata } from "@/server/now/bot-service";
import { botRuleForSubject, decideDispatch, DEFAULT_BOT_RULE } from "@/server/now/matching";
import { parseBotRule } from "@/server/now/now-settings";
import { transition } from "@/server/now/session-state";

const request = {
  id: "nreq_1",
  subject: "physics",
  chapter: "Kinematics",
  concept: "Projectile",
  difficulty: "easy" as const,
  language: "hindi",
  ai_explained: true,
  context_json: { question: { text: "Shown text", options: ["2 m", "5 m"] } },
};

test("bot job metadata matches origin-ai's NowSolverJob v1 and carries the stored solution", () => {
  const meta = buildBotJobMetadata({
    sessionId: "nses_1",
    request,
    studentName: "Meera Iyer",
    minutes: 4,
    catalog: { text: "Catalog text", correctOption: 1, explanation: "h = v^2/2g", hint: "Energy", answerText: null, correctOptions: null },
  });
  assert.equal(meta.mode, "now_solver");
  assert.equal(meta.v, 1);
  assert.equal(meta.student_first_name, "Meera", "first name only");
  assert.equal(meta.question.text, "Shown text", "the question the student actually saw");
  assert.deepEqual(meta.question.options, ["2 m", "5 m"]);
  assert.equal(meta.question.correct_option_index, 1);
  assert.equal(meta.question.explanation, "h = v^2/2g");
  assert.equal(meta.minutes, 4);
  assert.equal(meta.ai_explained, true);
  assert.equal(JSON.stringify(meta).includes("Iyer"), false, "no surname, email or id of the student");
});

test("missing catalog data degrades safely", () => {
  const meta = buildBotJobMetadata({
    sessionId: "nses_1",
    request: { ...request, context_json: {} },
    studentName: null,
    minutes: 99,
    catalog: { correctOption: 7, options: ["a"] },
  });
  assert.equal(meta.question.text, "(question text unavailable)");
  assert.equal(meta.question.correct_option_index, null, "an index past the options is dropped");
  assert.equal(meta.minutes, 30);
  assert.equal(meta.student_first_name, "Student");
});

test("the bot can be switched off per subject", () => {
  const rule = parseBotRule(JSON.stringify({ enabled: true, disabledSubjects: ["Chemistry", "history"] }));
  assert.deepEqual(rule.disabledSubjects, ["chemistry"]);
  assert.equal(botRuleForSubject(rule, "chemistry").enabled, false);
  assert.equal(botRuleForSubject(rule, "physics").enabled, true);
  assert.deepEqual(parseBotRule(JSON.stringify({ enabled: true })).disabledSubjects, []);
  const waiting = { inHumanHours: true, eligibleHumans: 0, humansOnline: 0, failedOffers: 0, waitedMs: 0, callbackOffered: false };
  assert.deepEqual(decideDispatch(waiting, botRuleForSubject(rule, "chemistry")), { action: "close_no_helper", detail: "none_online" });
  assert.equal(decideDispatch(waiting, botRuleForSubject({ ...DEFAULT_BOT_RULE }, "physics")).action, "assign_bot");
});

test("a bot that cannot be dispatched closes an accepted request as no_helper", () => {
  const result = transition("accepted", "bot_unavailable");
  assert.equal(result.ok && result.to, "no_helper");
  assert.equal(transition("live", "bot_unavailable").ok, false, "a live call is ended, not closed this way");
});
