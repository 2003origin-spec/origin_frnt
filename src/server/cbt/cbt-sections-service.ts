/**
 * Per-subject section scores for finished CBT attempts.
 *
 * `submitAttempt` writes `cbt.room_participants.section_scores` from the same
 * grading pass that produces the total, so anything graded after 2026-08-04
 * already has it. Attempts finished BEFORE that have `'{}'` — and rather than
 * backfilling the whole table inside the build-time migration (an unbounded
 * UPDATE holding a write transaction over live traffic), they are derived here
 * from `cbt.submission_answers`, which snapshots everything needed, and the
 * result is written back.
 *
 * That makes the backfill lazy, bounded (only rooms someone actually opens),
 * self-healing and free of any manual step — and it converges: once a room's
 * results have been viewed or exported once, no derivation runs for it again.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import {
  GENERAL_SECTION_KEY,
  canonicalSubjectLabel,
  parseSectionScores,
  type CbtSectionScore,
  type CbtSectionScores,
} from "@/lib/cbt/sections";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * Mirrors `isAnswered()` from the client model. Kept in SQL (rather than
 * pulling every submission row into Node) so deriving a 200-seat room stays one
 * aggregate query instead of tens of thousands of rows over the wire.
 *
 * `jsonb_typeof` guards each branch: a malformed draft that stored a string
 * where an array belongs must not error the whole room's results.
 */
const ATTEMPTED_SQL = `(
  COALESCE(btrim(sa.submitted_answer ->> 'answerText'), '') <> ''
  OR jsonb_typeof(sa.submitted_answer -> 'selectedOption') = 'number'
  OR (jsonb_typeof(sa.submitted_answer -> 'selectedOptions') = 'array'
      AND jsonb_array_length(sa.submitted_answer -> 'selectedOptions') > 0)
  OR (jsonb_typeof(sa.submitted_answer -> 'matrixPairs') = 'array'
      AND jsonb_array_length(sa.submitted_answer -> 'matrixPairs') > 0)
)`;

/** Same collapsing rule as `canonicalSubjectKey` — NULL/blank/"general" → general. */
const SECTION_KEY_SQL = `COALESCE(
  NULLIF(btrim(lower(sa.question_snapshot ->> 'subject')), ''),
  '${GENERAL_SECTION_KEY}'
)`;

const DERIVE_SQL = `
  SELECT sa.participant_id,
         ${SECTION_KEY_SQL}                                        AS section_key,
         (array_agg(sa.question_snapshot ->> 'subject' ORDER BY sa.position))[1] AS label,
         MIN(sa.position)                                          AS order_pos,
         COALESCE(SUM(sa.marks_awarded), 0)                        AS score,
         COALESCE(SUM(COALESCE((sa.question_snapshot ->> 'marks')::float8, 0)), 0) AS max_score,
         COUNT(*)                                                  AS question_count,
         COUNT(*) FILTER (WHERE (sa.grading_result ->> 'needsReview')::boolean IS TRUE) AS needs_review,
         COUNT(*) FILTER (WHERE (sa.grading_result ->> 'needsReview')::boolean IS NOT TRUE
                            AND NOT ${ATTEMPTED_SQL})              AS skipped,
         COUNT(*) FILTER (WHERE (sa.grading_result ->> 'needsReview')::boolean IS NOT TRUE
                            AND ${ATTEMPTED_SQL}
                            AND (sa.grading_result ->> 'isCorrect')::boolean IS TRUE) AS correct,
         COUNT(*) FILTER (WHERE (sa.grading_result ->> 'needsReview')::boolean IS NOT TRUE
                            AND ${ATTEMPTED_SQL}
                            AND (sa.grading_result ->> 'isCorrect')::boolean IS NOT TRUE) AS wrong,
         COALESCE(SUM(sa.time_spent_seconds), 0)                   AS time_seconds
    FROM cbt.submission_answers sa
   WHERE sa.room_id = $1 AND sa.participant_id = ANY($2::text[])
   GROUP BY sa.participant_id, section_key
`;

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function rowToSection(row: Record<string, unknown>): CbtSectionScore {
  const key = String(row.section_key ?? GENERAL_SECTION_KEY);
  const correct = Number(row.correct ?? 0);
  const wrong = Number(row.wrong ?? 0);
  const attempted = correct + wrong;
  return {
    key,
    label: canonicalSubjectLabel(row.label == null ? key : String(row.label)),
    order: Number(row.order_pos ?? 0),
    score: round3(Number(row.score ?? 0)),
    maxScore: round3(Number(row.max_score ?? 0)),
    questionCount: Number(row.question_count ?? 0),
    correct,
    wrong,
    skipped: Number(row.skipped ?? 0),
    needsReview: Number(row.needs_review ?? 0),
    accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    timeSeconds: Number(row.time_seconds ?? 0),
  };
}

/**
 * Fills in `section_scores` for the given finished participants that don't have
 * it yet, and writes the derived value back so the work happens at most once.
 *
 * Returns only what it derived; callers merge it over what they already read.
 * A write-back failure is swallowed: the derived numbers are still correct for
 * this response, and the next read simply derives them again.
 */
export async function deriveSectionScores(
  roomId: string,
  participantIds: string[],
): Promise<Record<string, CbtSectionScores>> {
  if (participantIds.length === 0) return {};

  const res = await pool().query(DERIVE_SQL, [roomId, participantIds]);
  const byParticipant: Record<string, CbtSectionScores> = {};
  for (const row of res.rows) {
    const participantId = String(row.participant_id);
    const sections = (byParticipant[participantId] ??= {});
    const section = rowToSection(row as Record<string, unknown>);
    sections[section.key] = section;
  }

  // Heal the rows we derived. Participants with no submission rows at all (a
  // true no-show) are deliberately left at '{}' — a blank section map is how an
  // absent attempt stays distinguishable from one that sat the paper and
  // scored zero.
  for (const [participantId, sections] of Object.entries(byParticipant)) {
    if (Object.keys(sections).length === 0) continue;
    await pool()
      .query(
        `UPDATE cbt.room_participants
            SET section_scores = $3::jsonb
          WHERE id = $1 AND room_id = $2 AND section_scores = '{}'::jsonb`,
        [participantId, roomId, JSON.stringify(sections)],
      )
      .catch(() => undefined);
  }

  return byParticipant;
}

/**
 * Reads section scores for a set of participants, deriving the ones that are
 * missing. `finishedIds` must contain only participants whose attempt is
 * finished — an in-flight attempt has no submission rows to derive from.
 */
export async function loadSectionScores(
  roomId: string,
  rows: { id: string; sectionScores: unknown; finished: boolean }[],
): Promise<Record<string, CbtSectionScores>> {
  const result: Record<string, CbtSectionScores> = {};
  const missing: string[] = [];

  for (const row of rows) {
    const parsed = parseSectionScores(row.sectionScores);
    if (Object.keys(parsed).length > 0) {
      result[row.id] = parsed;
    } else if (row.finished) {
      missing.push(row.id);
    }
  }

  if (missing.length > 0) {
    const derived = await deriveSectionScores(roomId, missing);
    for (const [participantId, sections] of Object.entries(derived)) {
      result[participantId] = sections;
    }
  }

  return result;
}
