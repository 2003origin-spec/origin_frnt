/**
 * Contest Prep Score + Contest Accuracy — pure aggregation (plan Phase 2c,
 * contest-design §3). Turns a student's per-subject practice tallies into the
 * two gamification metrics the pre-contest module surfaces:
 *
 *  - Contest Accuracy: overall correct / attempted (0..100%), real-time.
 *  - Contest Prep Score: a 0..100 readiness bar. Per subject, readiness =
 *    coverage × accuracy, where coverage = min(1, attempted / target). The prep
 *    score is the mean readiness across the contest's subjects (a subject with
 *    zero practice contributes 0), so a student is only "fully prepped" once
 *    they've practised enough in EVERY subject and are getting them right.
 */

/** Practice questions per subject to be considered fully "covered". */
export const PRACTICE_TARGET_PER_SUBJECT = 20;

export interface SubjectTally {
  attempted: number;
  correct: number;
}

export interface SubjectReadiness {
  subject: string;
  attempted: number;
  correct: number;
  accuracy: number; // 0..1
  coverage: number; // 0..1 (attempted / target, capped)
  readiness: number; // 0..1 (coverage × accuracy)
}

export interface PracticeMetrics {
  prepScore: number; // 0..100
  accuracy: number; // 0..100 (overall)
  attempted: number;
  correct: number;
  perSubject: SubjectReadiness[];
}

function tallyOf(perSubject: Record<string, unknown>, subject: string): SubjectTally {
  const raw = (perSubject?.[subject] ?? {}) as Record<string, unknown>;
  const attempted = Number(raw.attempted);
  const correct = Number(raw.correct);
  return {
    attempted: Number.isFinite(attempted) && attempted > 0 ? Math.floor(attempted) : 0,
    correct: Number.isFinite(correct) && correct > 0 ? Math.floor(correct) : 0,
  };
}

/**
 * Compute the prep score + accuracy for a contest whose subjects are `subjects`,
 * given the stored `per_subject` tallies. `target` defaults to
 * PRACTICE_TARGET_PER_SUBJECT.
 */
export function computePracticeMetrics(
  subjects: string[],
  perSubject: Record<string, unknown>,
  target = PRACTICE_TARGET_PER_SUBJECT,
): PracticeMetrics {
  const t = Math.max(1, Math.floor(target));
  const list = subjects.length ? subjects : Object.keys(perSubject ?? {});

  let totalAttempted = 0;
  let totalCorrect = 0;
  let readinessSum = 0;

  const perSubjectOut: SubjectReadiness[] = list.map((subject) => {
    const { attempted, correct } = tallyOf(perSubject, subject);
    totalAttempted += attempted;
    totalCorrect += correct;
    const accuracy = attempted > 0 ? correct / attempted : 0;
    const coverage = Math.min(1, attempted / t);
    const readiness = coverage * accuracy;
    readinessSum += readiness;
    return { subject, attempted, correct, accuracy, coverage, readiness };
  });

  const prepScore = list.length ? Math.round((readinessSum / list.length) * 100) : 0;
  const accuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  return {
    prepScore,
    accuracy,
    attempted: totalAttempted,
    correct: totalCorrect,
    perSubject: perSubjectOut,
  };
}
