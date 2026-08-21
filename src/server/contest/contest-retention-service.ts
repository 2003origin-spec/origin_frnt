/**
 * Contest data retention (plan Phase 9). Reclaims the two high-volume, per-event
 * partitioned tables once a contest is done, in two stages:
 *
 *   1. purgeDrafts()  — as soon as a contest is result_published, its
 *      answer_drafts partition is DROPped. Drafts are a durable checkpoint of the
 *      live Redis buffer; once results publish, contest.submission_answers is the
 *      immutable record and the drafts are pure dead weight.
 *
 *   2. archiveOldContests() — a result_published contest older than the retention
 *      window (published_at + CONTEST_RETENTION_ARCHIVE_DAYS, default 90d) has its
 *      submission_answers partition DROPped and status set to 'archived'. The
 *      permanent record (leaderboard_snapshot + orbit_history + reward_ledger)
 *      survives — those are small and FK'd to the contest row, which is NOT
 *      deleted. We refuse to archive a contest that had participants but has no
 *      leaderboard rollup, so raw data is never destroyed before it's summarised.
 *
 * Reclaiming a whole contest is a single DROP TABLE — O(1), no dead tuples, no
 * vacuum debt on the tables every future contest shares. For a legacy contest
 * whose rows are still in the _default partition (published before per-event
 * partitions existed), drop_event_partition returns false and we fall back to a
 * scoped DELETE.
 *
 * Both passes are idempotent (driven by drafts_purged_at / archived_at markers)
 * and safe to run every cron tick.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/** Retention window before a published contest's raw answers are dropped and it
 * is archived. Overridable via env for game-day tuning. */
export function retentionArchiveDays(): number {
  const raw = Number(process.env.CONTEST_RETENTION_ARCHIVE_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 90;
}

export interface RetentionResult {
  draftsPurged: string[];
  archived: string[];
  skipped: { id: string; reason: string }[];
}

/**
 * Drop the answer_drafts partition for every published/archived contest not yet
 * purged. Idempotent via the drafts_purged_at marker.
 */
export async function purgeDrafts(limit = 20): Promise<string[]> {
  const p = pool();
  const rows = await p.query<{ id: string }>(
    `SELECT id FROM contest.contests
      WHERE status IN ('result_published','archived')
        AND drafts_purged_at IS NULL
      ORDER BY published_at ASC NULLS FIRST
      LIMIT $1`,
    [limit],
  );
  const purged: string[] = [];
  for (const { id } of rows.rows) {
    const dropped = await p.query<{ drop_event_partition: boolean }>(
      `SELECT contest.drop_event_partition('answer_drafts', $1)`,
      [id],
    );
    // Legacy fallback: rows still live in the shared _default partition.
    if (!dropped.rows[0]?.drop_event_partition) {
      await p.query(`DELETE FROM contest.answer_drafts WHERE contest_id = $1`, [id]);
    }
    await p.query(`UPDATE contest.contests SET drafts_purged_at = NOW() WHERE id = $1`, [id]);
    purged.push(id);
  }
  return purged;
}

/**
 * Archive published contests past the retention window: drop the raw
 * submission_answers partition and flip status → 'archived'. Refuses to archive
 * a contest that had participants but no leaderboard rollup (would destroy
 * un-summarised data).
 */
export async function archiveOldContests(limit = 20): Promise<{ archived: string[]; skipped: { id: string; reason: string }[] }> {
  const p = pool();
  const days = retentionArchiveDays();
  const rows = await p.query<{ id: string }>(
    `SELECT id FROM contest.contests
      WHERE status = 'result_published'
        AND archived_at IS NULL
        AND published_at IS NOT NULL
        AND NOW() >= published_at + ($1 || ' days')::interval
      ORDER BY published_at ASC
      LIMIT $2`,
    [String(days), limit],
  );

  const archived: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const { id } of rows.rows) {
    // Safety: never drop raw answers unless the permanent rollup exists (or the
    // contest genuinely had no participants).
    const guard = await p.query<{ has_leaderboard: boolean; has_submissions: boolean }>(
      `SELECT
         EXISTS (SELECT 1 FROM contest.leaderboard_snapshot WHERE contest_id = $1) AS has_leaderboard,
         EXISTS (SELECT 1 FROM contest.submission_answers   WHERE contest_id = $1) AS has_submissions`,
      [id],
    );
    const { has_leaderboard, has_submissions } = guard.rows[0] ?? { has_leaderboard: false, has_submissions: false };
    if (has_submissions && !has_leaderboard) {
      skipped.push({ id, reason: "no leaderboard rollup — refusing to drop raw answers" });
      continue;
    }

    const dropped = await p.query<{ drop_event_partition: boolean }>(
      `SELECT contest.drop_event_partition('submission_answers', $1)`,
      [id],
    );
    if (!dropped.rows[0]?.drop_event_partition) {
      await p.query(`DELETE FROM contest.submission_answers WHERE contest_id = $1`, [id]);
    }
    await p.query(
      `UPDATE contest.contests SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id],
    );
    archived.push(id);
  }
  return { archived, skipped };
}

/**
 * One retention tick: purge drafts of published contests, then archive+reclaim
 * contests past the retention window. Called by the internal cron.
 */
export async function runContestRetention(limit = 20): Promise<RetentionResult> {
  await ensureContestSchema();
  const draftsPurged = await purgeDrafts(limit);
  const { archived, skipped } = await archiveOldContests(limit);
  return { draftsPurged, archived, skipped };
}
