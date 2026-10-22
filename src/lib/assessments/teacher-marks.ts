/**
 * Bounds for the per-question marks a teacher types into a test.
 *
 * They used to be a bare `z.number()` (the column is DOUBLE PRECISION), so a
 * question could be worth 1e9 — and a teacher-shared DPP scored with those
 * marks. Real papers use single digits (+4/-1, +3/-1, +4/-2); 100 is far beyond
 * any real scheme while still rejecting absurd or non-finite values.
 *
 * Negative marks accept EITHER sign: the authoring UIs send a positive
 * magnitude (QuestionPicker, the room builder) while storage and the blueprint
 * presets keep it negative, and every consumer canonicalises the sign
 * (canonicalNegativeMarks in ./source-stack). Only the magnitude is bounded.
 */

import { z } from "zod";

export const TEACHER_MAX_MARKS = 100;

/** Marks for a correct answer: 0..100. */
export const TEACHER_MARKS_SCHEMA = z.number().finite().min(0).max(TEACHER_MAX_MARKS);

/** Negative marking magnitude ≤ 100, either sign (canonicalised downstream). */
export const TEACHER_NEGATIVE_MARKS_SCHEMA = z
  .number()
  .finite()
  .min(-TEACHER_MAX_MARKS)
  .max(TEACHER_MAX_MARKS);
