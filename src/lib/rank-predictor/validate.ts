/**
 * Strict request validation for POST /api/public/rank-predictor (plan §7.1,
 * OWASP Input Validation): enums, whole numbers in each subject's range,
 * unknown keys rejected at every level. Pure and client-safe, so the form
 * shows the same messages before sending.
 */

import { isIndianState } from "./states";
import { EXAM_SUBJECTS } from "./subjects";
import { RANK_CATEGORIES, RANK_PREDICTOR_EXAMS, type PredictInput, type RankCategory, type RankPredictorExam } from "./types";

export const MAX_BODY_BYTES = 2048;

export type PredictRequest = PredictInput & { hp?: string };

export type ValidationResult = { ok: true; value: PredictRequest } | { ok: false; field: string; message: string };

const TOP_KEYS = new Set(["exam", "marks", "wrong", "category", "pwd", "gender", "homeState", "jeeMainShift", "source", "hp"]);
const SOURCE_KEYS = new Set(["kind", "resultId"]);
const GENDERS = new Set(["female", "male", "other"]);
const SOURCE_KINDS = new Set(["manual", "attempt", "avg3"]);
const RESULT_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SHIFT_ID = /^\d{4}-\d{2}-\d{2}-S[12]$/;

function fail(field: string, message: string): ValidationResult {
  return { ok: false, field, message };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownKey(obj: Record<string, unknown>, allowed: Set<string>): string | null {
  for (const key of Object.keys(obj)) if (!allowed.has(key)) return key;
  return null;
}

/**
 * `shiftIds`: the JEE Main shift ids the data has (only real 2024 tables);
 * pass null on the client, where the server re-checks.
 */
export function validatePredictRequest(body: unknown, shiftIds: ReadonlySet<string> | null = null): ValidationResult {
  if (!isPlainObject(body)) return fail("body", "Send a JSON object.");
  const extra = unknownKey(body, TOP_KEYS);
  if (extra) return fail(extra, `Unknown field "${extra}".`);

  const exam = body.exam;
  if (typeof exam !== "string" || !(RANK_PREDICTOR_EXAMS as readonly string[]).includes(exam)) {
    return fail("exam", "Pick NEET, JEE Main or JEE Advanced.");
  }
  const examId = exam as RankPredictorExam;
  const boxes = EXAM_SUBJECTS[examId];

  if (!isPlainObject(body.marks)) return fail("marks", "Enter your marks for each subject.");
  const marksExtra = unknownKey(body.marks, new Set(boxes.map((b) => b.id)));
  if (marksExtra) return fail(`marks.${marksExtra}`, `"${marksExtra}" is not a subject in this exam.`);
  const marks: Record<string, number> = {};
  for (const box of boxes) {
    const value = body.marks[box.id];
    if (typeof value !== "number" || !Number.isInteger(value)) {
      return fail(`marks.${box.id}`, `${box.label} marks must be a whole number.`);
    }
    if (value < box.min || value > box.max) {
      return fail(`marks.${box.id}`, `${box.label} marks must be between ${box.min} and ${box.max}.`);
    }
    marks[box.id] = value;
  }

  let wrong: Record<string, number> | undefined;
  if (body.wrong !== undefined) {
    if (!isPlainObject(body.wrong)) return fail("wrong", "Wrong answers must be a list per subject.");
    const asked = boxes.filter((b) => b.questions !== null);
    const wrongExtra = unknownKey(body.wrong, new Set(asked.map((b) => b.id)));
    if (wrongExtra) return fail(`wrong.${wrongExtra}`, `Wrong answers are not used for "${wrongExtra}".`);
    wrong = {};
    for (const box of asked) {
      const value = body.wrong[box.id];
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > (box.questions ?? 0)) {
        return fail(`wrong.${box.id}`, `${box.label} wrong answers must be a whole number from 0 to ${box.questions}.`);
      }
      wrong[box.id] = value;
    }
  }

  const category = body.category;
  if (typeof category !== "string" || !(RANK_CATEGORIES as readonly string[]).includes(category)) {
    return fail("category", "Pick your category.");
  }
  if (typeof body.pwd !== "boolean") return fail("pwd", "Say whether you are a PwD candidate.");

  if (body.gender !== undefined && body.gender !== null && (typeof body.gender !== "string" || !GENDERS.has(body.gender))) {
    return fail("gender", "Unknown gender value.");
  }

  let homeState: string | null = null;
  if (body.homeState !== undefined && body.homeState !== null && body.homeState !== "") {
    if (!isIndianState(body.homeState)) return fail("homeState", "Pick a state from the list.");
    homeState = body.homeState;
  }

  let jeeMainShift: string | null = null;
  if (body.jeeMainShift !== undefined && body.jeeMainShift !== null && body.jeeMainShift !== "") {
    if (examId !== "jee-main") return fail("jeeMainShift", "A shift is only used for JEE Main.");
    if (typeof body.jeeMainShift !== "string" || !SHIFT_ID.test(body.jeeMainShift) || (shiftIds && !shiftIds.has(body.jeeMainShift))) {
      return fail("jeeMainShift", "Unknown JEE Main shift.");
    }
    jeeMainShift = body.jeeMainShift;
  }

  let source: PredictInput["source"];
  if (body.source !== undefined) {
    if (!isPlainObject(body.source)) return fail("source", "Unknown source.");
    const sourceExtra = unknownKey(body.source, SOURCE_KEYS);
    if (sourceExtra) return fail(`source.${sourceExtra}`, `Unknown field "${sourceExtra}".`);
    const kind = body.source.kind;
    if (typeof kind !== "string" || !SOURCE_KINDS.has(kind)) return fail("source.kind", "Unknown source kind.");
    const resultId = body.source.resultId;
    if (resultId !== undefined && (typeof resultId !== "string" || !RESULT_ID.test(resultId))) {
      return fail("source.resultId", "Unknown test attempt.");
    }
    source = { kind: kind as "manual" | "attempt" | "avg3", ...(resultId ? { resultId } : {}) };
  }

  let hp: string | undefined;
  if (body.hp !== undefined) {
    if (typeof body.hp !== "string" || body.hp.length > 200) return fail("hp", "Invalid field.");
    hp = body.hp;
  }

  return {
    ok: true,
    value: {
      exam: examId,
      marks,
      ...(wrong ? { wrong } : {}),
      category: category as RankCategory,
      pwd: body.pwd,
      homeState,
      jeeMainShift,
      ...(source ? { source } : {}),
      ...(hp !== undefined ? { hp } : {}),
    },
  };
}
