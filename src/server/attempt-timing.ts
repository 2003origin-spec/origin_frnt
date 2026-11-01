/**
 * How long a self test / DPP attempt took, decided by the server.
 *
 * The client used to send `timeTaken` and the server added it, unbounded, to
 * `user.totalStudyTime` — a negative or tiny value shrank study time, and the
 * subject-arena board ranks by solved / studyMinutes. Now:
 *
 *   - when the server recorded the attempt start (`analytics.attempt_starts`,
 *     written by `POST /api/assessments/{tests|dpps}/:id/start`), the time is
 *     `clamp(now - started_at, 0, duration)` and the client value is ignored;
 *   - when no start row exists (an old client that never calls /start), the
 *     client value is only clamped to `[0, duration]` and tagged `client`.
 *
 * Per-question `timeSpent` (OGCode speed points, timed-practice scoring) is
 * still client-sent and out of scope here.
 * Spec: V1/docs/bug-fixes/03-grading-points.md (G7).
 *
 * Pure — no DB — so it is unit-testable.
 */

/** Cap used when the assessment carries no duration (6 hours). */
export const DEFAULT_ATTEMPT_CAP_SECONDS = 6 * 3600;

export type TimeTakenSource = "server" | "client";

export type ServerTimeTakenInput = {
  /** When the server recorded the attempt start, or null when it did not. */
  startedAt: Date | string | null;
  /** The assessment's duration in seconds; null/0/invalid → 6 h cap. */
  durationSeconds: number | null | undefined;
  /** What the client claimed. Used only when there is no start row. */
  clientSeconds: unknown;
  /** Injectable clock (ms since epoch) for tests. */
  now?: number;
};

function capSeconds(durationSeconds: number | null | undefined): number {
  const d = Number(durationSeconds);
  return Number.isFinite(d) && d > 0 ? Math.round(d) : DEFAULT_ATTEMPT_CAP_SECONDS;
}

function clamp(value: number, cap: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(cap, Math.round(value)));
}

/** Duration in seconds from a minutes field (persisted tests, DPP plans, seeded tests). */
export function minutesToSeconds(minutes: number | null | undefined): number | null {
  const m = Number(minutes);
  return Number.isFinite(m) && m > 0 ? Math.round(m * 60) : null;
}

export function serverTimeTakenSeconds(input: ServerTimeTakenInput): {
  seconds: number;
  source: TimeTakenSource;
} {
  const cap = capSeconds(input.durationSeconds);
  if (input.startedAt) {
    const startedMs = new Date(input.startedAt).getTime();
    if (Number.isFinite(startedMs)) {
      const now = input.now ?? Date.now();
      return { seconds: clamp((now - startedMs) / 1000, cap), source: "server" };
    }
  }
  const client = typeof input.clientSeconds === "number" ? input.clientSeconds : Number(input.clientSeconds);
  return { seconds: clamp(client, cap), source: "client" };
}
