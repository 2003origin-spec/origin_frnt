/**
 * The form → request body step, shared by the /rank-predictor page and the
 * landing widget. Both must send the SAME body for the same marks: the free
 * check counter is a set of input hashes (plan §8.3), so "See full details"
 * from the landing page re-runs the same input without using a second check.
 */

import { EXAM_SUBJECTS } from '@/lib/rank-predictor/subjects';
import type { PredictInput, RankCategory, RankPredictorExam, SourceKind } from '@/lib/rank-predictor/types';
import { validatePredictRequest } from '@/lib/rank-predictor/validate';

export type PredictForm = {
  exam: RankPredictorExam;
  /** Raw box text per subject id ("" = not filled yet). */
  marks: Record<string, string>;
  category: RankCategory;
  pwd: boolean;
  homeState: string;
  shift: string;
  source?: { kind: SourceKind; resultId?: string };
};

export type BuiltInput = { input: PredictInput } | { error: { field: string; message: string } };

export function buildPredictInput(form: PredictForm): BuiltInput {
  const numeric: Record<string, unknown> = {};
  for (const box of EXAM_SUBJECTS[form.exam]) {
    const raw = (form.marks[box.id] ?? '').trim();
    numeric[box.id] = raw === '' ? Number.NaN : Number(raw);
  }
  const body = {
    exam: form.exam,
    marks: numeric,
    category: form.category,
    pwd: form.pwd,
    // State rank is NEET only; the shift picker is JEE Main only.
    ...(form.exam === 'neet' && form.homeState ? { homeState: form.homeState } : {}),
    ...(form.exam === 'jee-main' && form.shift ? { jeeMainShift: form.shift } : {}),
    ...(form.source ? { source: form.source } : {}),
  };
  const checked = validatePredictRequest(body);
  if (!checked.ok) return { error: { field: checked.field, message: checked.message } };
  return { input: checked.value };
}

/** Live total of the filled boxes (empty or half-typed boxes count as 0). */
export function marksTotal(exam: RankPredictorExam, marks: Record<string, string>): number {
  return EXAM_SUBJECTS[exam].reduce((acc, b) => acc + (Number.parseInt(marks[b.id] ?? '', 10) || 0), 0);
}
