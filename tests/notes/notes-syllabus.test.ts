import test from "node:test";
import assert from "node:assert/strict";

import { NOTES_SYLLABUS, chapterLabel, listSyllabusChapters } from "../../src/lib/notes/syllabus";

test("137 chapter folders: 27 + 57 + 53, matching the plan's Appendix A", () => {
  const chapters = listSyllabusChapters();
  assert.equal(chapters.length, 137);
  const perClass = Object.fromEntries(NOTES_SYLLABUS.map((cls) => [cls.classLevel, cls.subjects.reduce((n, s) => n + s.chapters.length, 0)]));
  assert.deepEqual(perClass, { 10: 27, 11: 57, 12: 53 });
});

test("every key is unique and shaped c<class>.<subject>.<slug>", () => {
  const keys = [
    ...NOTES_SYLLABUS.map((c) => c.key),
    ...NOTES_SYLLABUS.flatMap((c) => c.subjects.map((s) => s.key)),
    ...listSyllabusChapters().map((c) => c.key),
  ];
  assert.equal(new Set(keys).size, keys.length);
  for (const chapter of listSyllabusChapters()) {
    assert.match(chapter.key, /^c(10|11|12)\.(physics|chemistry|mathematics|biology)\.[a-z0-9-]+$/u);
  }
});

test("NCERT numbers are unique within a subject; exam-only folders have none", () => {
  for (const cls of NOTES_SYLLABUS) {
    for (const sub of cls.subjects) {
      const numbers = sub.chapters.map((c) => c.ncertNumber).filter((n): n is number => n !== null);
      assert.equal(new Set(numbers).size, numbers.length, `${sub.key} repeats an NCERT number`);
    }
  }
  const examOnly = listSyllabusChapters().filter((c) => c.ncertNumber === null).map((c) => c.key);
  assert.deepEqual(examOnly.sort(), [
    "c11.chemistry.p-block-elements-groups-13-14",
    "c12.chemistry.p-block-elements-groups-15-18",
    "c12.chemistry.principles-related-to-practical-chemistry",
    "c12.physics.experimental-skills",
  ]);
});

test("bank links: Class 11/12 numbered chapters are linked except Linear Programming; Class 10 is set on prod", () => {
  for (const chapter of listSyllabusChapters()) {
    if (chapter.classLevel === 10) assert.deepEqual(chapter.bankChapters, [], chapter.key);
    else if (chapter.ncertNumber === null || chapter.key === "c12.mathematics.linear-programming") assert.deepEqual(chapter.bankChapters, [], chapter.key);
    else assert.ok(chapter.bankChapters.length >= 1, `${chapter.key} has no bank link`);
  }
  const organic = listSyllabusChapters().find((c) => c.key === "c11.chemistry.organic-chemistry-some-basic-principles-and-techniques");
  assert.equal(organic?.bankChapters.length, 2, "both bank spellings of the organic chapter");
});

test("exam tags: Maths is JEE, Biology NEET, Physics/Chemistry both, Class 10 boards", () => {
  for (const chapter of listSyllabusChapters()) {
    if (chapter.classLevel === 10) assert.deepEqual(chapter.exams, ["boards"]);
    else if (chapter.subject === "biology") assert.deepEqual(chapter.exams, ["neet"]);
    else if (chapter.subject === "mathematics") assert.ok(["jee", "boards"].includes(chapter.exams[0]));
    else assert.deepEqual(chapter.exams, ["jee", "neet"]);
  }
});

test("chapter labels", () => {
  assert.equal(chapterLabel("Motion in a Plane", 3), "Ch 3 · Motion in a Plane");
  assert.equal(chapterLabel("Experimental Skills", null), "Experimental Skills");
});
