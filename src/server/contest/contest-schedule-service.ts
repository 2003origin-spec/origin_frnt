/**
 * Recurring contest schedules — auto-scheduling. A schedule is a template the
 * cron uses to create + auto-publish the next contest every `cadence_days`, so a
 * weekly contest runs set-and-forget. The cron composes the same steps as the
 * admin flow (create → set window → resolve paper → publish-freeze).
 *
 * Idempotency: the runner advances `next_start_at` forward in the same
 * transaction it creates the occurrence, under FOR UPDATE SKIP LOCKED — so a
 * concurrent/re-run tick never double-creates.
 */

import { getUserPostgresPool } from "@/server/user-postgres";
import { createId } from "@/legacy/store";

import { normalizeScoringConfig } from "@/lib/contest/contest-config";
import { createContest, updateContest, publishContest } from "./contest-admin-service";
import { resolveContestQuestions } from "./contest-question-selection";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function scheduleError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

export interface ScheduleSelection {
  subject: string;
  count: number;
  topics?: string[];
}

export interface ContestSchedule {
  id: string;
  name: string;
  subjects: string[];
  durationMinutes: number;
  regLeadDays: number;
  cadenceDays: number;
  nextStartAt: string;
  runCount: number;
  active: boolean;
  lastContestId: string | null;
}

export interface CreateScheduleInput {
  name: string;
  subjects: string[];
  topics?: Record<string, string[]>;
  selections: ScheduleSelection[];
  durationMinutes: number;
  regLeadDays?: number;
  cadenceDays?: number;
  scoringConfig?: unknown;
  ogcodeReward?: number;
  displayTz?: string;
  firstStartAt: string; // ISO — when the FIRST occurrence starts
}

const DAY_MS = 86_400_000;

function mapRow(r: {
  id: string; name: string; subjects: unknown; duration_minutes: number; reg_lead_days: number;
  cadence_days: number; next_start_at: string; run_count: number; active: boolean; last_contest_id: string | null;
}): ContestSchedule {
  return {
    id: r.id,
    name: r.name,
    subjects: Array.isArray(r.subjects) ? (r.subjects as string[]) : [],
    durationMinutes: r.duration_minutes,
    regLeadDays: r.reg_lead_days,
    cadenceDays: r.cadence_days,
    nextStartAt: new Date(r.next_start_at).toISOString(),
    runCount: r.run_count,
    active: r.active,
    lastContestId: r.last_contest_id,
  };
}

export async function createSchedule(adminId: string, input: CreateScheduleInput): Promise<ContestSchedule> {
  await ensureContestSchema();
  const name = (input.name ?? "").trim();
  if (!name) throw scheduleError(400, "A schedule name is required.");
  if (!input.selections?.length) throw scheduleError(400, "At least one subject selection is required.");
  if (!(input.durationMinutes > 0)) throw scheduleError(400, "Duration must be positive.");
  const first = new Date(input.firstStartAt);
  if (Number.isNaN(first.getTime())) throw scheduleError(400, "Invalid first-start date.");
  if (first.getTime() <= Date.now()) throw scheduleError(400, "First start must be in the future.");
  const cadence = Number.isFinite(input.cadenceDays) && input.cadenceDays! > 0 ? Math.trunc(input.cadenceDays!) : 7;
  const lead = Number.isFinite(input.regLeadDays) && input.regLeadDays! >= 0 ? Math.trunc(input.regLeadDays!) : 5;

  const id = createId("csched");
  await pool().query(
    `INSERT INTO contest.schedules
       (id, name, subjects, topics, selections, duration_minutes, reg_lead_days, cadence_days,
        scoring_config, ogcode_reward, display_tz, next_start_at, created_by)
     VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7,$8,$9::jsonb,$10,$11,$12,$13)`,
    [
      id, name, JSON.stringify(input.subjects ?? []), JSON.stringify(input.topics ?? {}),
      JSON.stringify(input.selections), input.durationMinutes, lead, cadence,
      JSON.stringify(normalizeScoringConfig(input.scoringConfig)),
      Number.isFinite(input.ogcodeReward) ? Math.max(0, Math.floor(input.ogcodeReward!)) : 0,
      input.displayTz?.trim() || "Asia/Kolkata", first.toISOString(), adminId,
    ],
  );
  const created = await getSchedule(id);
  if (!created) throw scheduleError(500, "Failed to create schedule.");
  return created;
}

export async function getSchedule(id: string): Promise<ContestSchedule | null> {
  await ensureContestSchema();
  const res = await pool().query(`SELECT * FROM contest.schedules WHERE id = $1`, [id]);
  return res.rows[0] ? mapRow(res.rows[0]) : null;
}

export async function listSchedules(): Promise<ContestSchedule[]> {
  await ensureContestSchema();
  const res = await pool().query(`SELECT * FROM contest.schedules ORDER BY created_at DESC`);
  return res.rows.map(mapRow);
}

export async function setScheduleActive(id: string, active: boolean): Promise<void> {
  await ensureContestSchema();
  await pool().query(`UPDATE contest.schedules SET active = $2, updated_at = NOW() WHERE id = $1`, [id, active]);
}

export async function deleteSchedule(id: string): Promise<void> {
  await ensureContestSchema();
  await pool().query(`DELETE FROM contest.schedules WHERE id = $1`, [id]);
}

export interface ScheduleRunResult {
  created: string[];   // contest ids created this tick
  advanced: string[];  // schedule ids caught-up but not yet due
}

/**
 * One auto-schedule tick: for each active schedule, catch up past occurrences,
 * and when the registration-lead window has opened, create + publish the next
 * contest and advance the schedule. Idempotent + crash-safe (per-schedule txn,
 * next_start_at advanced with the create).
 */
export async function runDueSchedules(): Promise<ScheduleRunResult> {
  await ensureContestSchema();
  const created: string[] = [];
  const advanced: string[] = [];
  const now = Date.now();

  // Candidate schedules whose registration window may have opened.
  const due = await pool().query<{ id: string }>(
    `SELECT id FROM contest.schedules
      WHERE active = true
        AND next_start_at - (reg_lead_days || ' days')::interval <= NOW()`,
  );

  for (const { id } of due.rows) {
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT * FROM contest.schedules WHERE id = $1 AND active = true FOR UPDATE SKIP LOCKED`,
        [id],
      );
      const s = locked.rows[0];
      if (!s) { await client.query("ROLLBACK"); continue; }

      const cadenceMs = s.cadence_days * DAY_MS;
      const leadMs = s.reg_lead_days * DAY_MS;
      const durationMs = s.duration_minutes * 60_000;
      let start = new Date(s.next_start_at).getTime();
      // Catch up: never create a contest whose start is already in the past.
      while (start <= now) start += cadenceMs;

      let didCreate = false;
      let contestId: string | null = s.last_contest_id;
      if (now >= start - leadMs) {
        // Registration window is open → create + publish this occurrence.
        const occurrence = s.run_count + 1;
        const c = await createContest(s.created_by ?? "system", {
          name: `${s.name} #${occurrence}`,
          subjects: Array.isArray(s.subjects) ? s.subjects : [],
          topics: s.topics && typeof s.topics === "object" ? s.topics : {},
          scoringConfig: s.scoring_config,
          ogcodeReward: s.ogcode_reward,
          displayTz: s.display_tz,
        });
        await updateContest(c.id, {
          regOpen: new Date(start - leadMs).toISOString(),
          regClose: new Date(start).toISOString(),
          startAt: new Date(start).toISOString(),
          endAt: new Date(start + durationMs).toISOString(),
        });
        const questions = await resolveContestQuestions({
          contestId: c.id,
          selections: (Array.isArray(s.selections) ? s.selections : []) as ScheduleSelection[],
        });
        await publishContest(c.id, questions);
        contestId = c.id;
        didCreate = true;
        created.push(c.id);
      } else {
        advanced.push(id);
      }

      await client.query(
        `UPDATE contest.schedules
            SET next_start_at = $2,
                run_count = run_count + $3,
                last_contest_id = $4,
                updated_at = NOW()
          WHERE id = $1`,
        [id, new Date(didCreate ? start + cadenceMs : start).toISOString(), didCreate ? 1 : 0, contestId],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      // One schedule failing must not block the others.
      console.error(`[contest schedule] ${id} failed:`, err);
    } finally {
      client.release();
    }
  }

  return { created, advanced };
}
