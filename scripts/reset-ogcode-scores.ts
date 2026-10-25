/**
 * OGCode Scoring V2 cutover — ONE-TIME reset of every account's OGCode score
 * to zero, run ONCE on prod right after the PR merges (and after the three
 * OGCode migrations are applied).
 *
 * Scope decision (confirmed): reset OGCode-derived scores ONLY. Points earned
 * from tests, DPP, Ori mentor, pomodoro, study-corner and daily-consistency are
 * PRESERVED — because `app.user_scores.totalPoints` is a shared lump sum across
 * all sources, this script SUBTRACTS just the OGCode contribution (recomputed
 * from the point-log ledger) rather than zeroing the field.
 *
 * What it does (USER pool `app.*`, one transaction):
 *   1. Per user, sum OGCode-sourced point-log entries
 *      (activityType='practice' AND description like 'Solved/Attempted … question in …s …').
 *      Test completions share activityType='practice' but read 'Completed test: …',
 *      so they are NOT matched. DPP/Ori/pomodoro/etc. use other activityTypes.
 *   2. totalPoints := GREATEST(0, totalPoints − ogcodePoints); recompute currentTier.
 *   3. DELETE the matched OGCode point-log rows (keeps the ledger consistent).
 *   3b. (--apply only) record `ogcode_scoring_v2_reset` in app.migrations.
 *   4. Zero `data.rankScore` and `data.questionsSolved` on every `app.subject_ranks`
 *      row (these are OGCode-only). Location fields in the same JSONB are preserved.
 * Then (OGCODE pool):
 *   5. TRUNCATE `ogcode_question_progress` — per-question best_score / attempts /
 *      reveal flags, so everyone starts fresh under the new scoring.
 *
 * Left untouched by design: `analytics.test_results` (test data, feeds the
 * subject-arena leaderboard), `app.practice_attempts` (attempt history / accuracy),
 * likes / reports / option-distribution telemetry.
 *
 * NOT SAFE TO RE-RUN. The cutover ran on prod on 2026-07-12. Since then the
 * live solve path writes point logs that match OGCODE_LOG_FILTER below, so a
 * second run deletes every OGCode point earned under V2 (AIR, Hall of Fame,
 * championship standings) and truncates every student's per-question progress.
 * The only way back is a Neon PITR restore of two databases. So:
 *   - it is a DRY RUN unless `--apply` is given;
 *   - it refuses (exit 1), dry run included, once the cutover has been applied,
 *     detected by the `ogcode_scoring_v2_reset` row a real run writes to
 *     app.migrations, or by ogcode_question_progress rows older than 24 hours
 *     (V2 has been live) — unless `--force-rerun` is also given.
 * See scripts/lib/reset-ogcode-guard.mjs.
 *
 * After running, the app's in-memory store cache (5-min TTL) re-hydrates from the
 * DB on its own; a redeploy makes it immediate.
 *
 * Usage (prod secrets only at run time, never committed):
 *   cd new-frontend
 *   npx tsx --env-file=/path/to/prod.env scripts/reset-ogcode-scores.ts            # preview counts (default)
 *   npx tsx --env-file=/path/to/prod.env scripts/reset-ogcode-scores.ts --apply    # write
 *   ... --apply --force-rerun   # only if you really mean to wipe post-cutover points again
 */

import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";
import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";
import { getTierForPoints } from "@/server/gamification";

import {
  RESET_MARKER_ID,
  RESET_MARKER_NAME,
  decideResetRun,
  parseResetArgs,
} from "./lib/reset-ogcode-guard.mjs";

// Matches OGCode practice point-log rows and excludes test completions
// ("Completed test: …"), which share activityType='practice'.
const OGCODE_LOG_FILTER = `
  data->>'activityType' = 'practice'
  AND (
    data->>'description' LIKE 'Solved %question in %'
    OR data->>'description' LIKE 'Attempted %question in %'
  )`;

/** True when a previous --apply run left its ledger row in app.migrations. */
async function resetMarkerPresent(pool: NonNullable<ReturnType<typeof getUserPostgresPool>>): Promise<boolean> {
  const ledger = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('app.migrations') IS NOT NULL AS exists`,
  );
  if (!ledger.rows[0]?.exists) return false;
  const marker = await pool.query(`SELECT 1 FROM app.migrations WHERE id = $1`, [RESET_MARKER_ID]);
  return (marker.rowCount ?? 0) > 0;
}

/** True when ogcode_question_progress holds a row untouched for over 24 h,
 *  i.e. Scoring V2 has been live long enough that a reset destroys real data. */
async function staleProgressPresent(): Promise<boolean> {
  if (!isOgcodePostgresConfigured()) return false;
  const pool = getOgcodePostgresPool();
  if (!pool) return false;
  const table = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('ogcode_question_progress') IS NOT NULL AS exists`,
  );
  if (!table.rows[0]?.exists) return false;
  const stale = await pool.query(
    `SELECT 1 FROM ogcode_question_progress WHERE updated_at < NOW() - INTERVAL '24 hours' LIMIT 1`,
  );
  return (stale.rowCount ?? 0) > 0;
}

async function main() {
  const args = parseResetArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`[reset-ogcode] ${args.error}`);
    console.error("[reset-ogcode] usage: reset-ogcode-scores.ts [--apply] [--force-rerun]   (dry run by default)");
    process.exit(1);
  }
  const dryRun = !args.apply;

  if (!isUserPostgresConfigured()) {
    console.error("USER_DATABASE_URL is not set — load the prod env file before running.");
    process.exit(1);
  }
  const userPool = getUserPostgresPool();
  if (!userPool) {
    console.error("USER pool unavailable.");
    process.exit(1);
  }

  const decision = decideResetRun({
    apply: args.apply,
    forceRerun: args.forceRerun,
    markerPresent: await resetMarkerPresent(userPool),
    staleProgressPresent: await staleProgressPresent(),
  });
  if (!decision.proceed) {
    console.error("[reset-ogcode] REFUSING — the Scoring V2 cutover has already been applied:");
    for (const reason of decision.reasons) console.error(`[reset-ogcode]   - ${reason}`);
    if (decision.hint) console.error(`[reset-ogcode] ${decision.hint}`);
    process.exit(decision.exitCode);
  }
  if (decision.reasons.length) {
    console.warn("[reset-ogcode] --force-rerun given; proceeding despite:");
    for (const reason of decision.reasons) console.warn(`[reset-ogcode]   - ${reason}`);
  }

  const label = dryRun ? "[reset-ogcode DRY-RUN]" : "[reset-ogcode]";
  const client = await userPool.connect();
  try {
    await client.query("BEGIN");

    // 1. Per-user OGCode point contribution (for preview + subtract).
    const og = await client.query<{ user_id: string; pts: string; n: string }>(
      `SELECT user_id,
              COALESCE(SUM((data->>'points')::numeric), 0) AS pts,
              COUNT(*) AS n
         FROM app.point_logs
        WHERE ${OGCODE_LOG_FILTER}
        GROUP BY user_id`,
    );
    const ogTotalRows = og.rows.length;
    const ogTotalLogs = og.rows.reduce((s, r) => s + Number(r.n), 0);
    const ogTotalPoints = og.rows.reduce((s, r) => s + Number(r.pts), 0);

    // 2. Subtract OGCode points from the shared total (floored at 0).
    const updated = await client.query<{ user_id: string; new_total: string }>(
      `WITH og AS (
         SELECT user_id, COALESCE(SUM((data->>'points')::numeric), 0) AS pts
           FROM app.point_logs
          WHERE ${OGCODE_LOG_FILTER}
          GROUP BY user_id
       )
       UPDATE app.user_scores us
          SET data = jsonb_set(
                us.data,
                '{totalPoints}',
                to_jsonb(GREATEST(0, COALESCE((us.data->>'totalPoints')::numeric, 0) - og.pts))
              ),
              updated_at = NOW()
         FROM og
        WHERE us.user_id = og.user_id
        RETURNING us.user_id, (us.data->>'totalPoints')::numeric AS new_total`,
    );

    // 2b. Recompute currentTier for each affected user from its new total.
    for (const row of updated.rows) {
      const tier = getTierForPoints(Number(row.new_total));
      await client.query(
        `UPDATE app.user_scores
            SET data = jsonb_set(data, '{currentTier}', to_jsonb($2::text))
          WHERE user_id = $1`,
        [row.user_id, tier],
      );
    }

    // 3. Delete the matched OGCode point-log rows.
    const deletedLogs = await client.query(
      `DELETE FROM app.point_logs WHERE ${OGCODE_LOG_FILTER}`,
    );

    // 4. Zero OGCode rank fields, preserving location prefs in the same JSONB.
    const ranks = await client.query(
      `UPDATE app.subject_ranks
          SET data = jsonb_set(
                jsonb_set(data, '{rankScore}', '0'::jsonb),
                '{questionsSolved}', '0'::jsonb
              ),
              updated_at = NOW()
        WHERE COALESCE((data->>'rankScore')::numeric, 0) <> 0
           OR COALESCE((data->>'questionsSolved')::numeric, 0) <> 0`,
    );

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      // Ledger row in the same transaction as the point wipe, so the next run
      // is refused even if the OGCODE-pool truncate below fails.
      await client.query(`
        CREATE TABLE IF NOT EXISTS app.migrations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(
        "INSERT INTO app.migrations (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        [RESET_MARKER_ID, RESET_MARKER_NAME],
      );
      await client.query("COMMIT");
    }

    console.log(
      `${label} USER pool: ${ogTotalRows} user(s) had OGCode points ` +
        `(${ogTotalLogs} log rows, ${ogTotalPoints} pts total); ` +
        `adjusted ${updated.rowCount} user_scores row(s), ` +
        `${dryRun ? "would delete" : "deleted"} ${deletedLogs.rowCount} OGCode log(s), ` +
        `${dryRun ? "would zero" : "zeroed"} ${ranks.rowCount} subject_ranks row(s).`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  // 5. Per-question progress (OGCODE pool). Separate pool, so separate step.
  if (!isOgcodePostgresConfigured()) {
    console.warn(`${label} OGCODE_DATABASE_URL not set — skipped ogcode_question_progress reset.`);
  } else {
    const ogcodePool = getOgcodePostgresPool();
    if (ogcodePool) {
      const before = await ogcodePool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM ogcode_question_progress`,
      );
      if (!dryRun) {
        await ogcodePool.query(`TRUNCATE ogcode_question_progress`);
      }
      console.log(
        `${label} OGCODE pool: ${dryRun ? "would truncate" : "truncated"} ` +
          `ogcode_question_progress (${before.rows[0]?.count ?? 0} row(s)).`,
      );
    }
  }

  console.log(`${label} done.${dryRun ? " (no changes written; pass --apply to write)" : ""}`);
  process.exit(0);
}

main().catch((error) => {
  console.error("[reset-ogcode] failed", error);
  process.exit(1);
});
