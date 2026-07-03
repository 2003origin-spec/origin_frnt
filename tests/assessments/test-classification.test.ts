import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyTest,
  resolveTestOrigin,
  buildTestClassificationFields,
} from "../../src/server/test-classification";

test("detects PYQ papers and their exam", () => {
  assert.deepEqual(classifyTest({ title: "JEE Main 2023 PYQ", description: "" }), {
    isPyq: true,
    examType: "jee-main",
  });
  assert.deepEqual(classifyTest({ title: "Previous Year NEET Biology", description: "" }), {
    isPyq: true,
    examType: "neet",
  });
  assert.deepEqual(classifyTest({ title: "JEE Advanced Past Paper", description: "" }), {
    isPyq: true,
    examType: "jee-advanced",
  });
});

test("a normal practice test is not a PYQ and has no exam", () => {
  assert.deepEqual(classifyTest({ title: "Circular Motion Practice Test", description: "Kinematics drills" }), {
    isPyq: false,
    examType: null,
  });
});

test("classifies exam from description when the title is generic", () => {
  const cls = classifyTest({ title: "Weekly Mock", description: "Full-length JEE Main pattern paper" });
  assert.equal(cls.examType, "jee-main");
});

test("NEET wins over a stray 'advanced' mention (most specific first)", () => {
  assert.equal(classifyTest({ title: "NEET Advanced Concepts", description: "" }).examType, "neet");
});

test("resolveTestOrigin prioritises teacher > custom > platform", () => {
  assert.equal(resolveTestOrigin({ createdByTeacher: true, isCustom: true }), "teacher");
  assert.equal(resolveTestOrigin({ isCustom: true }), "custom");
  assert.equal(resolveTestOrigin({}), "platform");
});

test("buildTestClassificationFields emits camelCase + snake_case for the payload", () => {
  const fields = buildTestClassificationFields({
    title: "JEE Main PYQ 2022",
    description: "",
    isCustom: false,
  });
  assert.equal(fields.isPyq, true);
  assert.equal(fields.is_pyq, true);
  assert.equal(fields.examType, "jee-main");
  assert.equal(fields.exam_type, "jee-main");
  assert.equal(fields.origin, "platform");
});
