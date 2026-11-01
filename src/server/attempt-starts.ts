/**
 * Server-recorded attempt starts for self tests and DPPs (`analytics.attempt_starts`).
 *
 * `POST /api/assessments/{tests|dpps}/:id/start` records the start; submit
 * reads it to compute the time taken (see `attempt-timing.ts`). One OPEN row
 * per (user, kind, assessment): a second /start while the attempt is open
 * keeps the FIRST start time, so calling /start again just before submitting
 * cannot shrink the measured time. Submit marks the row consumed.
 *
 * OGCODE pool, next to the other `analytics.*` tables. Every call here is
 * best-effort on the submit path — a failure falls back to the clamped client
 * value; it never blocks a submission.
 *
 * Canonical SQL: src/db/migrations/20261022_attempt_starts.sql
 * Spec: V1/docs/bug-fixes/03-grading-points.md (G7).
 */

import { randomUUID } from "node:crypto";

import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";
import { SCHEMA_DDL_LOCK_ID, SCHEMA_DDL_LOCK_SQL } from "@/server/schema-lock";
import { DEFAULT_ATTEMPT_CAP_SECONDS, serverTimeTakenSeconds, type TimeTakenSource } from "@/server/attempt-timing";

export type AttemptKind = "test" | "dpp";

declare global {
  var __originAttemptStartsEnsured: boolean | undefined;
  var __originAttemptStartsPromise: Promise<void> | undefined;
}

function pool() {
  const p = getOgcodePostgresPool();
  if (!p) throw new Error("OGCODE_DATABASE_URL is not configured");
  return p;
}

export async function ensureAttemptStartsSchema(): Promise<void> {
  if (!isOgcodePostgresConfigured()) return;
  if (globalThis.__originAttemptStartsEnsured) return;
  if (!globalThis.__originAttemptStartsPromise) {
    globalThis.__originAttemptStartsPromise = (async () => {
      const client = await pool().connect();
      try {
        await client.query("BEGIN");
        // Shared DDL lock — see src/server/schema-lock.ts.
        await client.query(SCHEMA_DDL_LOCK_SQL, [SCHEMA_DDL_LOCK_ID]);
        await client.query(`
          CREATE SCHEMA IF NOT EXISTS analytics;
          CREATE TABLE IF NOT EXISTS analytics.attempt_starts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('test', 'dpp')),
            assessment_id TEXT NOT NULL,
            started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            consumed_result_id TEXT,
            consumed_at TIMESTAMPTZ
          );
          CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_starts_open
            ON analytics.attempt_starts (user_id, kind, assessment_id)
            WHERE consumed_result_id IS NULL;
        `);
        await client.query("COMMIT");
        globalThis.__originAttemptStartsEnsured = true;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    })().finally(() => {
      globalThis.__originAttemptStartsPromise = undefined;
    });
  }
  await globalThis.__originAttemptStartsPromise;
}

/** Grace past the duration before an open start counts as abandoned. */
const STALE_GRACE_SECONDS = 10 * 60;

/**
 * Record the start of an attempt, or return the already-open one. Idempotent:
 * while the open row is within `duration + grace` its `started_at` is never
 * moved forward. An abandoned row (older than that) is restarted, so a test
 * opened weeks ago and never submitted does not credit a full duration.
 */
export async function recordAttemptStart(
  userId: string,
  kind: AttemptKind,
  assessmentId: string,
  durationSeconds: number | null = null,
): Promise<{ id: string; startedAt: string }> {
  await ensureAttemptStartsSchema();
  const staleAfterSeconds =
    (durationSeconds && durationSeconds > 0 ? durationSeconds : DEFAULT_ATTEMPT_CAP_SECONDS) + STALE_GRACE_SECONDS;
  const result = await pool().query<{ id: string; started_at: Date }>(
    `INSERT INTO analytics.attempt_starts (id, user_id, kind, assessment_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, kind, assessment_id) WHERE consumed_result_id IS NULL
     DO UPDATE SET started_at = CASE
       WHEN analytics.attempt_starts.started_at < NOW() - make_interval(secs => $5::double precision)
         THEN NOW()
       ELSE analytics.attempt_starts.started_at
     END
     RETURNING id, started_at`,
    [`attempt_${randomUUID()}`, userId, kind, assessmentId, staleAfterSeconds],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Could not record the attempt start.");
  return { id: row.id, startedAt: new Date(row.started_at).toISOString() };
}

/** The open start row for this attempt, if the client called /start. */
export async function getOpenAttemptStart(
  userId: string,
  kind: AttemptKind,
  assessmentId: string,
): Promise<{ id: string; startedAt: Date } | null> {
  await ensureAttemptStartsSchema();
  const result = await pool().query<{ id: string; started_at: Date }>(
    `SELECT id, started_at FROM analytics.attempt_starts
      WHERE user_id = $1 AND kind = $2 AND assessment_id = $3 AND consumed_result_id IS NULL
      LIMIT 1`,
    [userId, kind, assessmentId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, startedAt: new Date(row.started_at) } : null;
}

/** Close the start row once the submission it timed has been persisted. */
export async function markAttemptStartConsumed(startId: string, resultId: string): Promise<void> {
  await ensureAttemptStartsSchema();
  await pool().query(
    `UPDATE analytics.attempt_starts
        SET consumed_result_id = $2, consumed_at = NOW()
      WHERE id = $1 AND consumed_result_id IS NULL`,
    [startId, resultId],
  );
}

export type ResolvedTimeTaken = {
  seconds: number;
  source: TimeTakenSource;
  /** The start row to consume after the result is persisted, when there was one. */
  startId: string | null;
};

/**
 * The submit path's single entry point: look up the open start (best-effort)
 * and compute the time taken from it, falling back to the clamped client value.
 */
export async function resolveAttemptTimeTaken(input: {
  userId: string;
  kind: AttemptKind;
  assessmentId: string;
  durationSeconds: number | null;
  clientSeconds: unknown;
  /** Skip the start lookup (room submissions carry the room's own clock). */
  skipStartLookup?: boolean;
}): Promise<ResolvedTimeTaken> {
  let start: { id: string; startedAt: Date } | null = null;
  if (!input.skipStartLookup && isOgcodePostgresConfigured()) {
    try {
      start = await getOpenAttemptStart(input.userId, input.kind, input.assessmentId);
    } catch (error) {
      console.error("[attempt-starts] start lookup failed; using the clamped client time", {
        kind: input.kind,
        assessmentId: input.assessmentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const { seconds, source } = serverTimeTakenSeconds({
    startedAt: start?.startedAt ?? null,
    durationSeconds: input.durationSeconds,
    clientSeconds: input.clientSeconds,
  });
  return { seconds, source, startId: start?.id ?? null };
}

/** Best-effort consume; a failure only leaves the row open for the next attempt to time from. */
export async function consumeAttemptStartQuietly(startId: string | null, resultId: string): Promise<void> {
  if (!startId) return;
  try {
    await markAttemptStartConsumed(startId, resultId);
  } catch (error) {
    console.error("[attempt-starts] failed to mark the start consumed", {
      startId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
