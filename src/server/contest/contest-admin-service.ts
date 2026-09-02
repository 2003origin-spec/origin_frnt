/**
 * Admin contest builder — server-side CRUD + schedule + publish-freeze for the
 * Weekly Contest (plan Phase 0). Admin-owned (no teacher FK); writes to the
 * isolated contest.* schema only. Forks the shape of cbt-tests-service.ts.
 *
 * Lifecycle: createContest → (updateContest while draft) → publishContest,
 * which validates the schedule + scoring guardrail, freezes the selected
 * questions into contest.contest_questions (immutable snapshot), stamps
 * duration_seconds, and flips status draft → scheduled. Once scheduled the
 * paper is frozen and only the pipeline advances it further (plan §2).
 */

import { createId } from "@/legacy/store";
import {
  DEFAULT_CONTEST_SCORING,
  durationSeconds,
  normalizeScoringConfig,
  validateSchedule,
  validateScoringConfig,
  type ContestScoringConfig,
} from "@/lib/contest/contest-config";
import type { ContestStatus } from "@/lib/contest/contest-state";
import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function contestError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export interface ContestRecord {
  id: string;
  name: string;
  subjects: string[];
  topics: Record<string, string[]>;
  bannerUrl: string | null;
  regOpen: string | null;
  regClose: string | null;
  startAt: string | null;
  endAt: string | null;
  displayTz: string;
  durationSeconds: number | null;
  scoringConfig: ContestScoringConfig;
  ogcodeReward: number;
  status: ContestStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  accessMode: "open" | "code" | "premium";
  registrationCap: number | null;
}

export interface ContestQuestionInput {
  questionId: string;
  subject?: string | null;
  sectionId?: string | null;
  /** Frozen stem/options/correct-answer snapshot (as scored). */
  snapshot: Record<string, unknown>;
  marks?: number | null;
  negativeMarks?: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapRow(row: any): ContestRecord {
  return {
    id: row.id,
    name: row.name,
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    topics: row.topics && typeof row.topics === "object" ? row.topics : {},
    bannerUrl: row.banner_url ?? null,
    regOpen: row.reg_open ? new Date(row.reg_open).toISOString() : null,
    regClose: row.reg_close ? new Date(row.reg_close).toISOString() : null,
    startAt: row.start_at ? new Date(row.start_at).toISOString() : null,
    endAt: row.end_at ? new Date(row.end_at).toISOString() : null,
    displayTz: row.display_tz ?? "Asia/Kolkata",
    durationSeconds: row.duration_seconds ?? null,
    scoringConfig: normalizeScoringConfig(row.scoring_config),
    ogcodeReward: row.ogcode_reward ?? 0,
    status: row.status as ContestStatus,
    createdBy: row.created_by ?? null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    accessMode: (row.access_mode as "open" | "code" | "premium") ?? "open",
    registrationCap: row.registration_cap ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const SELECT_COLS = `id, name, subjects, topics, banner_url, reg_open, reg_close,
  start_at, end_at, display_tz, duration_seconds, scoring_config, ogcode_reward,
  status, created_by, created_at, updated_at, published_at, access_mode, registration_cap`;

export interface CreateContestInput {
  name?: string;
  subjects?: string[];
  topics?: Record<string, string[]>;
  bannerUrl?: string | null;
  displayTz?: string;
  scoringConfig?: unknown;
  ogcodeReward?: number;
}

export async function createContest(
  adminId: string,
  input: CreateContestInput,
): Promise<ContestRecord> {
  await ensureContestSchema();
  const name = (input.name ?? "").trim();
  if (!name) throw contestError(400, "A contest name is required.");
  const id = createId("contest");
  const scoring = normalizeScoringConfig(input.scoringConfig ?? DEFAULT_CONTEST_SCORING);
  const reward = Number.isFinite(input.ogcodeReward) ? Math.max(0, Math.floor(input.ogcodeReward!)) : 0;
  await pool().query(
    `INSERT INTO contest.contests
       (id, name, subjects, topics, banner_url, display_tz, scoring_config, ogcode_reward, status, created_by)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7::jsonb, $8, 'draft', $9)`,
    [
      id,
      name,
      JSON.stringify(input.subjects ?? []),
      JSON.stringify(input.topics ?? {}),
      input.bannerUrl?.trim() || null,
      input.displayTz?.trim() || "Asia/Kolkata",
      JSON.stringify(scoring),
      reward,
      adminId,
    ],
  );
  const created = await getContest(id);
  if (!created) throw contestError(500, "Failed to create contest.");
  return created;
}

/**
 * Clone a contest into a fresh DRAFT — copies the config (subjects, topics,
 * scoring, reward, display tz) so an admin can re-run a proven contest next week
 * in one click, then just set the new schedule + publish. The pragmatic version
 * of recurring auto-scheduling. Copies NO schedule, registrations, or frozen
 * paper — those are per-event.
 */
export async function cloneContest(sourceId: string, adminId: string): Promise<ContestRecord> {
  await ensureContestSchema();
  const src = await getContest(sourceId);
  if (!src) throw contestError(404, "Contest to clone not found.");
  return createContest(adminId, {
    name: `${src.name} (copy)`.slice(0, 120),
    subjects: src.subjects,
    topics: src.topics,
    scoringConfig: src.scoringConfig,
    ogcodeReward: src.ogcodeReward,
    displayTz: src.displayTz,
    bannerUrl: src.bannerUrl,
  });
}

export async function getContest(id: string): Promise<ContestRecord | null> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT ${SELECT_COLS} FROM contest.contests WHERE id = $1`,
    [id],
  );
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function listContests(): Promise<ContestRecord[]> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT ${SELECT_COLS} FROM contest.contests ORDER BY COALESCE(start_at, created_at) DESC`,
  );
  return res.rows.map(mapRow);
}

/**
 * IDs of contests currently LIVE (status='scheduled' AND NOW() ∈ [start_at,
 * end_at + grace)). Used by the drain cron to know which buffers to flush. The
 * grace window keeps a just-ended contest in the drain set long enough to catch
 * final autosaves. Cheap indexed query on (status, start_at).
 */
export async function listLiveContestIds(graceSeconds = 30): Promise<string[]> {
  await ensureContestSchema();
  const res = await pool().query(
    `SELECT id FROM contest.contests
       WHERE status = 'scheduled'
         AND start_at IS NOT NULL AND end_at IS NOT NULL
         AND NOW() >= start_at
         AND NOW() < end_at + ($1 || ' seconds')::interval`,
    [String(Math.max(0, Math.floor(graceSeconds)))],
  );
  return res.rows.map((r) => r.id as string);
}

export interface UpdateContestInput {
  name?: string;
  subjects?: string[];
  topics?: Record<string, string[]>;
  bannerUrl?: string | null;
  displayTz?: string;
  scoringConfig?: unknown;
  ogcodeReward?: number;
  regOpen?: string | null;
  regClose?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  accessMode?: "open" | "code" | "premium";
  registrationCap?: number | null;
}

/** Update a DRAFT contest. Once published (status='scheduled'+) the paper and
 *  schedule are frozen, so edits are rejected. */
export async function updateContest(id: string, patch: UpdateContestInput): Promise<ContestRecord> {
  await ensureContestSchema();
  const existing = await getContest(id);
  if (!existing) throw contestError(404, "Contest not found.");
  if (existing.status !== "draft") {
    throw contestError(409, "Only draft contests can be edited; this one is already published.");
  }

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  const push = (frag: string, val: unknown) => {
    sets.push(frag.replace("$$", `$${i}`));
    vals.push(val);
    i += 1;
  };

  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) throw contestError(400, "Contest name cannot be empty.");
    push("name = $$", n);
  }
  if (patch.subjects !== undefined) push("subjects = $$::jsonb", JSON.stringify(patch.subjects));
  if (patch.topics !== undefined) push("topics = $$::jsonb", JSON.stringify(patch.topics));
  if (patch.bannerUrl !== undefined) push("banner_url = $$", patch.bannerUrl?.trim() || null);
  if (patch.displayTz !== undefined) push("display_tz = $$", patch.displayTz?.trim() || "Asia/Kolkata");
  if (patch.scoringConfig !== undefined) {
    push("scoring_config = $$::jsonb", JSON.stringify(normalizeScoringConfig(patch.scoringConfig)));
  }
  if (patch.ogcodeReward !== undefined) {
    const r = Number.isFinite(patch.ogcodeReward) ? Math.max(0, Math.floor(patch.ogcodeReward!)) : 0;
    push("ogcode_reward = $$", r);
  }
  if (patch.regOpen !== undefined) push("reg_open = $$", patch.regOpen);
  if (patch.regClose !== undefined) push("reg_close = $$", patch.regClose);
  if (patch.startAt !== undefined) push("start_at = $$", patch.startAt);
  if (patch.endAt !== undefined) push("end_at = $$", patch.endAt);
  if (patch.accessMode !== undefined) push("access_mode = $$", patch.accessMode);
  if (patch.registrationCap !== undefined) {
    const cap = patch.registrationCap == null ? null : Math.max(1, Math.floor(patch.registrationCap));
    push("registration_cap = $$", cap);
  }

  if (sets.length === 0) return existing;

  vals.push(id);
  await pool().query(
    `UPDATE contest.contests SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${i}`,
    vals,
  );
  const updated = await getContest(id);
  if (!updated) throw contestError(500, "Failed to update contest.");
  return updated;
}

/**
 * Publish a draft contest: validate the schedule + scoring guardrail, freeze the
 * supplied question set into contest.contest_questions (immutable), stamp
 * duration_seconds, and flip status draft → scheduled. Atomic (one transaction).
 * Rejects if not draft, if the schedule/scoring is invalid, or if no questions.
 *
 * NOTE: pool-shortfall detection (does the OGCode bank actually contain enough
 * questions for the chosen topics/counts) is wired in a later checklist item via
 * full-test-builder; this function trusts the caller-resolved `questions` list.
 */
export async function publishContest(
  id: string,
  questions: ContestQuestionInput[],
): Promise<ContestRecord> {
  await ensureContestSchema();
  const existing = await getContest(id);
  if (!existing) throw contestError(404, "Contest not found.");
  if (existing.status !== "draft") {
    throw contestError(409, "This contest is already published.");
  }
  if (!questions.length) {
    throw contestError(400, "A contest needs at least one question to publish.");
  }

  const schedule = {
    regOpen: existing.regOpen ? new Date(existing.regOpen) : null,
    regClose: existing.regClose ? new Date(existing.regClose) : null,
    startAt: existing.startAt ? new Date(existing.startAt) : null,
    endAt: existing.endAt ? new Date(existing.endAt) : null,
  };
  const sched = validateSchedule(schedule);
  if (!sched.ok) throw contestError(400, sched.error);

  const scoring = validateScoringConfig(existing.scoringConfig);
  if (!scoring.ok) throw contestError(400, scoring.error);

  const duration = durationSeconds(schedule.startAt, schedule.endAt);

  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    // Guard against a concurrent publish: re-check status under a row lock.
    const locked = await client.query(
      `SELECT status FROM contest.contests WHERE id = $1 FOR UPDATE`,
      [id],
    );
    if (!locked.rows[0]) throw contestError(404, "Contest not found.");
    if (locked.rows[0].status !== "draft") throw contestError(409, "This contest is already published.");

    // Freeze the paper. Clear any prior (defensive) then insert the snapshot.
    await client.query(`DELETE FROM contest.contest_questions WHERE contest_id = $1`, [id]);
    for (let pos = 0; pos < questions.length; pos += 1) {
      const q = questions[pos];
      await client.query(
        `INSERT INTO contest.contest_questions
           (contest_id, position, question_id, subject, section_id, snapshot, marks, negative_marks)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
        [
          id,
          pos,
          q.questionId,
          q.subject ?? null,
          q.sectionId ?? null,
          JSON.stringify(q.snapshot),
          q.marks ?? null,
          q.negativeMarks ?? null,
        ],
      );
    }

    await client.query(
      `UPDATE contest.contests
         SET status = 'scheduled', duration_seconds = $2, published_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [id, duration],
    );
    // Give this contest its OWN partitions on answer_drafts + submission_answers
    // NOW — before it goes live and any row exists, so the attach is instant.
    // Retention later reclaims the whole contest as a single DROP TABLE (§9).
    await client.query(`SELECT contest.ensure_event_partitions($1)`, [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const published = await getContest(id);
  if (!published) throw contestError(500, "Failed to publish contest.");
  // Pre-warm the immutable paper cache so the start_at read burst is served
  // from cache. Best-effort: a cache miss just triggers a single-flight fill at
  // first read. Lazy import avoids a server/client cache-module cycle at build.
  try {
    const { prewarmContestPaper } = await import("./contest-paper-cache");
    await prewarmContestPaper(id);
  } catch {
    /* non-fatal — getContestPaper single-flights on first read */
  }
  return published;
}

export interface RescheduleInput {
  regOpen: string;
  regClose: string;
  startAt: string;
  endAt: string;
}

/**
 * Move a published (scheduled) contest's window BEFORE it goes live. Allowed
 * only while status='scheduled' AND the contest is still UPCOMING (now <
 * start_at) — once it is LIVE or ENDED the window is fixed. Re-validates the
 * schedule, recomputes duration, and keeps all registrations (they carry over).
 */
export async function rescheduleContest(id: string, input: RescheduleInput): Promise<ContestRecord> {
  await ensureContestSchema();
  const existing = await getContest(id);
  if (!existing) throw contestError(404, "Contest not found.");
  if (existing.status !== "scheduled") {
    throw contestError(409, "Only a scheduled (published, not-yet-run) contest can be rescheduled.");
  }
  if (existing.startAt && new Date(existing.startAt).getTime() <= Date.now()) {
    throw contestError(409, "The contest has already started; it can no longer be rescheduled.");
  }
  const schedule = {
    regOpen: new Date(input.regOpen),
    regClose: new Date(input.regClose),
    startAt: new Date(input.startAt),
    endAt: new Date(input.endAt),
  };
  const sched = validateSchedule(schedule);
  if (!sched.ok) throw contestError(400, sched.error);
  const duration = durationSeconds(schedule.startAt, schedule.endAt);

  await pool().query(
    `UPDATE contest.contests
       SET reg_open = $2, reg_close = $3, start_at = $4, end_at = $5,
           duration_seconds = $6, updated_at = NOW()
     WHERE id = $1 AND status = 'scheduled'`,
    [id, input.regOpen, input.regClose, input.startAt, input.endAt, duration],
  );
  const updated = await getContest(id);
  if (!updated) throw contestError(500, "Failed to reschedule contest.");
  return updated;
}

/**
 * Cancel a contest before it finishes. Allowed from 'draft' or 'scheduled' while
 * the contest is not already ENDED. Sets status='cancelled' (a terminal state
 * distinct from 'archived'); registration records are retained. Idempotent-ish:
 * cancelling an already-cancelled contest is a 409.
 */
export async function cancelContest(id: string): Promise<ContestRecord> {
  await ensureContestSchema();
  const existing = await getContest(id);
  if (!existing) throw contestError(404, "Contest not found.");
  if (existing.status !== "draft" && existing.status !== "scheduled") {
    throw contestError(409, `A ${existing.status} contest cannot be cancelled.`);
  }
  if (existing.status === "scheduled" && existing.endAt && new Date(existing.endAt).getTime() <= Date.now()) {
    throw contestError(409, "The contest has already ended; it can no longer be cancelled.");
  }
  await pool().query(
    `UPDATE contest.contests SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND status IN ('draft','scheduled')`,
    [id],
  );
  const updated = await getContest(id);
  if (!updated) throw contestError(500, "Failed to cancel contest.");
  return updated;
}

/**
 * Incident control: atomically extend a LIVE (or scheduled-not-yet-started)
 * contest's deadline by `addMinutes` for EVERYONE, without corrupting idempotency
 * keys — the paper is unchanged (no cache bust), the timer/grace/finalize all key
 * off end_at, so bumping end_at just moves the deadline. Guarded on
 * `end_at > NOW()` so a just-ended contest can't be extended in a race (that
 * would resurrect it after finalize). Duration is bumped to match.
 */
export async function extendContest(id: string, addMinutes: number): Promise<ContestRecord> {
  await ensureContestSchema();
  if (!Number.isFinite(addMinutes) || addMinutes <= 0 || addMinutes > 180) {
    throw contestError(400, "Extension must be between 1 and 180 minutes.");
  }
  const existing = await getContest(id);
  if (!existing) throw contestError(404, "Contest not found.");
  if (existing.status !== "scheduled") {
    throw contestError(409, `A ${existing.status} contest cannot be extended.`);
  }
  if (!existing.endAt) throw contestError(409, "Contest has no end time to extend.");
  if (new Date(existing.endAt).getTime() <= Date.now()) {
    throw contestError(409, "The contest has already ended; it can no longer be extended.");
  }
  const res = await pool().query(
    `UPDATE contest.contests
       SET end_at = end_at + ($2 || ' minutes')::interval,
           duration_seconds = COALESCE(duration_seconds, 0) + $3,
           updated_at = NOW()
     WHERE id = $1 AND status = 'scheduled' AND end_at > NOW()`,
    [id, String(addMinutes), addMinutes * 60],
  );
  if (res.rowCount === 0) throw contestError(409, "The contest just ended; extend is no longer possible.");
  const updated = await getContest(id);
  if (!updated) throw contestError(500, "Failed to extend contest.");
  return updated;
}
