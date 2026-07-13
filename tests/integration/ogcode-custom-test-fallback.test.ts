/**
 * DB-backed regression test for the OGCode custom-test degraded (no
 * analytics-service) selection path.
 *
 * Guards against a real production incident: the fallback used to filter
 * AppStore.questions, which is permanently empty (OGCode moved entirely to
 * Postgres — see the seed-time comment in src/legacy/store.ts) — so it threw
 * "No questions matched" on every single invocation once the primary
 * analytics-service call failed, surfacing as an uncaught Server Action
 * error in production. A mock-store unit test would not have caught this
 * (the mock hand-populates store.questions), so this seeds the real local
 * Postgres catalog table instead.
 *
 * Skips when USER_DATABASE_URL is not configured (safe on a bare dev box).
 */

import test from "node:test";
import assert from "node:assert/strict";

import { dbConfigured, rawPool, makeId } from "./_db";
import { generateOgcodeSelectionForWorkspace } from "@/server/assessments";
import type { AppStore } from "@/legacy/store";

const maybe = dbConfigured() ? test : test.skip;

// generateOgcodeSelectionForWorkspace's fallback path no longer reads the
// store (it queries Postgres directly) — a stub is enough to satisfy the
// signature without dragging in full store construction.
const stubStore = {} as AppStore;

async function seedQuestion(row: {
  id: string;
  sourceIndex: number;
  subject: string;
  chapter: string;
  classLevel: number;
  occurrence: string;
  difficulty?: string;
}): Promise<void> {
  await rawPool().query(
    `INSERT INTO ogcode_questions
       (id, source_index, text, options, correct_option, explanation, subject, chapter,
        concept, difficulty, question_type, occurrence, class)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'mcq', $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    [
      row.id,
      row.sourceIndex,
      `Question text for ${row.id}`,
      JSON.stringify(["A", "B", "C", "D"]),
      1,
      "Explanation.",
      row.subject,
      row.chapter,
      "Concept",
      row.difficulty ?? "medium",
      row.occurrence,
      row.classLevel,
    ],
  );
}

async function cleanupQuestions(ids: string[]): Promise<void> {
  await rawPool().query(`DELETE FROM ogcode_questions WHERE id = ANY($1::text[])`, [ids]);
}

// This local Postgres carries thousands of real pre-existing catalog rows
// (persisted via a named Docker volume across dev sessions). Real subject
// names ("physics", etc.) would collide with that data — with source_index
// ASC ordering, unrelated real rows can crowd out a test's own seeded rows
// entirely. Each test uses its own synthetic, guaranteed-unique subject tag
// so its query set is fully isolated from everything else in the table.

maybe(
  "generateOgcodeSelectionForWorkspace fallback returns real catalog questions and tops up a short chapter",
  async () => {
    const prefix = makeId("ogfb");
    const subject = `physics_${prefix}`;
    const ids = [`${prefix}_1`, `${prefix}_2`, `${prefix}_3`];
    try {
      await seedQuestion({ id: ids[0], sourceIndex: 900001, subject, chapter: "Gravitation", classLevel: 11, occurrence: "JEE (2020)" });
      await seedQuestion({ id: ids[1], sourceIndex: 900002, subject, chapter: "Gravitation", classLevel: 11, occurrence: "JEE Main (2021)" });
      await seedQuestion({ id: ids[2], sourceIndex: 900003, subject, chapter: "Kinematics", classLevel: 11, occurrence: "JEE (2019)" });

      // ANALYTICS_SERVICE_URL in the test env points at a port nothing is
      // listening on, so the primary service path fails fast and this
      // exercises the fallback exclusively.
      const result = await generateOgcodeSelectionForWorkspace(stubStore, makeId("user"), {
        subject,
        difficulty: "all",
        chapter: "Gravitation",
        class_level: 11,
        exam: "JEE",
        question_count: 5,
      });

      assert.ok(result.questionIds.length > 0, "fallback must return real questions instead of throwing/empty");
      // Only 2 Gravitation rows exist for a request of 5 — the 3rd (Kinematics,
      // same synthetic subject) must be pulled in by the chapter-shortfall top-up.
      assert.ok(
        ids.every((id) => result.questionIds.includes(id)),
        "expected all 3 seeded same-subject questions to be selected when the chapter alone is short",
      );
    } finally {
      await cleanupQuestions(ids);
    }
  },
);

maybe(
  "generateOgcodeSelectionForWorkspace fallback treats class/exam as hard constraints (never relaxed)",
  async () => {
    const prefix = makeId("ogfbhard");
    const subject = `chemistry_${prefix}`;
    const matchId = `${prefix}_match`;
    const wrongClassId = `${prefix}_wrongclass`;
    const wrongExamId = `${prefix}_wrongexam`;
    const ids = [matchId, wrongClassId, wrongExamId];
    try {
      await seedQuestion({ id: matchId, sourceIndex: 900011, subject, chapter: "Thermodynamics", classLevel: 12, occurrence: "NEET (2022)" });
      await seedQuestion({ id: wrongClassId, sourceIndex: 900012, subject, chapter: "Thermodynamics", classLevel: 11, occurrence: "NEET (2022)" });
      await seedQuestion({ id: wrongExamId, sourceIndex: 900013, subject, chapter: "Thermodynamics", classLevel: 12, occurrence: "JEE (2022)" });

      const result = await generateOgcodeSelectionForWorkspace(stubStore, makeId("user"), {
        subject,
        difficulty: "all",
        class_level: 12,
        exam: "NEET",
        question_count: 10,
      });

      assert.ok(result.questionIds.includes(matchId));
      assert.ok(!result.questionIds.includes(wrongClassId), "a class-11 question must not appear under a class-12 request");
      assert.ok(!result.questionIds.includes(wrongExamId), "a JEE-only question must not appear under a NEET request");
    } finally {
      await cleanupQuestions(ids);
    }
  },
);

maybe(
  "generateOgcodeSelectionForWorkspace fallback still throws a clear error when truly nothing matches",
  async () => {
    const result = generateOgcodeSelectionForWorkspace(stubStore, makeId("user"), {
      subject: `nonexistent_subject_${makeId("x")}`,
      difficulty: "all",
      class_level: 11,
      exam: "JEE",
      question_count: 5,
    });
    await assert.rejects(result, /No questions matched/);
  },
);
