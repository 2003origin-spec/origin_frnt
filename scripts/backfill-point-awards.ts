/**
 * Point-awards backfill — run ONCE on prod after 20261022_point_awards.sql.
 * Companion to bug-fix G6 (docs/bug-fixes/03-grading-points.md).
 *
 * What it does
 *   1. Seeds `app.point_awards` claims from the historical FIRST rewardable
 *      attempt per (user, test) and (user, dpp) — the first attempt with a
 *      positive score, which is the one the runtime would have claimed — so
 *      those assessments are never re-awarded.
 *   2. Lists suspected farmers: `app.point_logs` rows whose referenceId is an
 *      attempt of a test/DPP but NOT that user's first rewardable attempt.
 *   3. Only DEDUCTS: for each farmer, newTotal = GREATEST(0, stored
 *      totalPoints − points of the duplicate awards). It never rebuilds a total
 *      from app.point_logs: the old whole-store-rewrite race (N3) erased log
 *      rows and score rows independently, so the log is not a complete ledger
 *      and a recompute would also strip legitimate points (review M8). The dry
 *      run prints both the applied deduct-only total and the ledger sum, for
 *      comparison. Non-farmers whose stored total differs from their log sum
 *      are reported, never touched.
 *
 * Default is a DRY RUN: nothing is written. `--apply` seeds the claims, flags
 * the farmed point_logs rows with `data.farmed = true` and subtracts exactly
 * the points of the rows it flagged (in the same transaction, with the score
 * row locked), and touches no other point_logs. Re-running is safe: claims are
 * ON CONFLICT DO NOTHING, and flagged rows are skipped, so nothing is deducted
 * twice. The pure planning lives in src/server/point-awards-backfill.ts.
 *
 * Usage (secrets only at migration time, never committed):
 *   cd new-frontend
 *   npx tsx --env-file=/path/to/prod.env scripts/backfill-point-awards.ts --dry-run
 *   npx tsx --env-file=/path/to/prod.env scripts/backfill-point-awards.ts --apply
 *
 * Needs USER_DATABASE_URL (app.*) and OGCODE_DATABASE_URL (analytics.*).
 */

import { getTierForPoints } from "@/server/gamification";
import { ensurePointAwardsSchema } from "@/server/point-awards";
import {
  deductFarmedPoints,
  farmedAwardPoints,
  planPointAwardsBackfill,
  type BackfillAttempt as Attempt,
  type BackfillPointLog as PointLogRow,
} from "@/server/point-awards-backfill";
import { getOgcodePostgresPool } from "@/server/postgres";
import { getUserPostgresPool } from "@/server/user-postgres";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if (apply && args.has("--dry-run")) {
  console.error("Pass either --dry-run or --apply, not both.");
  process.exit(1);
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function loadAttempts(): Promise<Attempt[]> {
  const ogcode = getOgcodePostgresPool();
  if (!ogcode) throw new Error("OGCODE_DATABASE_URL is not set.");
  const tests = await ogcode.query<{ id: string; user_id: string; test_id: string; score: number; created_at: string }>(
    `SELECT id, user_id, test_id, score, created_at
       FROM analytics.test_results
      ORDER BY user_id, test_id, created_at ASC, id ASC`,
  );
  const dpps = await ogcode.query<{ id: string; user_id: string; dpp_id: string; score: number | null; created_at: string }>(
    `SELECT id, user_id, dpp_id, score, created_at
       FROM analytics.dpp_attempts
      ORDER BY user_id, dpp_id, created_at ASC, id ASC`,
  );
  return [
    ...tests.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      awardKey: `test:${row.test_id}`,
      score: asNumber(row.score),
      createdAt: String(row.created_at),
    })),
    ...dpps.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      awardKey: `dpp:${row.dpp_id}`,
      score: asNumber(row.score),
      createdAt: String(row.created_at),
    })),
  ];
}

async function loadPointLogs(): Promise<PointLogRow[]> {
  const user = getUserPostgresPool();
  if (!user) throw new Error("USER_DATABASE_URL is not set.");
  const result = await user.query<{ id: string; user_id: string; data: Record<string, unknown> }>(
    `SELECT id, user_id, data FROM app.point_logs`,
  );
  const rows: PointLogRow[] = [];
  for (const row of result.rows) {
    const data = row.data ?? {};
    // Verify the JSON key names before trusting them (the collection store
    // serialises StoredPointLog as-is: points / activityType / referenceId).
    if (!("points" in data) || !("activityType" in data)) {
      throw new Error(
        `app.point_logs.${row.id} has unexpected keys ${JSON.stringify(Object.keys(data))}; expected points/activityType/referenceId.`,
      );
    }
    rows.push({
      id: row.id,
      userId: row.user_id,
      points: asNumber(data.points),
      activityType: String(data.activityType ?? ""),
      referenceId: typeof data.referenceId === "string" ? data.referenceId : null,
      farmedAlready: data.farmed === true,
    });
  }
  return rows;
}

async function loadStoredTotals(): Promise<Map<string, number>> {
  const user = getUserPostgresPool();
  if (!user) throw new Error("USER_DATABASE_URL is not set.");
  const result = await user.query<{ user_id: string; total: string | null }>(
    `SELECT user_id, data->>'totalPoints' AS total FROM app.user_scores`,
  );
  return new Map(result.rows.map((row) => [row.user_id, asNumber(row.total)]));
}

async function loadKnownUserIds(): Promise<Set<string>> {
  const user = getUserPostgresPool();
  if (!user) throw new Error("USER_DATABASE_URL is not set.");
  const result = await user.query<{ id: string }>(`SELECT id FROM origin_users`);
  return new Set(result.rows.map((row) => row.id));
}

async function main() {
  const userPool = getUserPostgresPool();
  if (!userPool) {
    console.error("USER_DATABASE_URL is not set — load the prod env file before running.");
    process.exit(1);
  }
  console.log(`[point-awards backfill] mode: ${apply ? "APPLY" : "dry-run"}`);

  const [attempts, logs, storedTotals, knownUsers] = await Promise.all([
    loadAttempts(),
    loadPointLogs(),
    loadStoredTotals(),
    loadKnownUserIds(),
  ]);

  const { firstRewardable, farmedLogs, farmers, nonFarmerMismatches } = planPointAwardsBackfill({
    attempts,
    logs,
    storedTotals,
  });

  const seedable = firstRewardable.filter((attempt) => knownUsers.has(attempt.userId));
  const skippedUnknownUsers = firstRewardable.length - seedable.length;

  console.log(
    `[point-awards backfill] attempts=${attempts.length} first-rewardable=${firstRewardable.length} ` +
      `(seedable=${seedable.length}, skipped for deleted users=${skippedUnknownUsers}) ` +
      `point_logs=${logs.length} farmed-logs=${farmedLogs.length} farmers=${farmers.length}`,
  );

  if (farmers.length > 0) {
    console.log("\nSuspected farmers (extra awards beyond the first rewardable attempt):");
    console.log(
      "user_id | extra_awards | farmed_points | stored_totalPoints -> APPLIED deduct-only total (delta) | ledger sum (NOT applied)",
    );
    let ledgerWouldStripLegit = 0;
    for (const entry of [...farmers].sort((a, b) => b.farmedPoints - a.farmedPoints)) {
      const stored = entry.storedTotal ?? 0;
      const delta = entry.newTotal - stored;
      if (entry.ledgerTotal < entry.newTotal) ledgerWouldStripLegit += 1;
      console.log(
        `${entry.userId} | ${entry.extraAwards} | ${entry.farmedPoints} | ${stored} -> ${entry.newTotal} (${delta >= 0 ? "+" : ""}${delta}) | ${entry.ledgerTotal}`,
      );
    }
    console.log(
      `\n${ledgerWouldStripLegit} farmer(s) have a ledger sum BELOW the deduct-only total: a ledger recompute ` +
        "would also have removed legitimate points there, so it is not used.",
    );
  } else {
    console.log("\nNo farmed awards found.");
  }

  if (nonFarmerMismatches.length > 0) {
    console.log(
      `\nWARNING: ${nonFarmerMismatches.length} non-farmer user(s) have stored totalPoints != ledger sum ` +
        `(reported only; these are NOT touched). First 10:`,
    );
    for (const row of nonFarmerMismatches.slice(0, 10)) {
      console.log(`${row.userId} | stored=${row.stored} | ledger=${row.ledger}`);
    }
  } else {
    console.log("\nSanity: every non-farmer's stored totalPoints equals the ledger sum.");
  }

  if (!apply) {
    console.log("\nDry run — nothing written. Re-run with --apply to seed claims and deduct the farmed points.");
    return;
  }

  await ensurePointAwardsSchema(userPool);
  const client = await userPool.connect();
  try {
    await client.query("BEGIN");

    let claimsInserted = 0;
    const CHUNK = 500;
    for (let start = 0; start < seedable.length; start += CHUNK) {
      const slice = seedable.slice(start, start + CHUNK);
      const values: unknown[] = [];
      const tuples = slice.map((attempt, index) => {
        const base = index * 5;
        values.push(attempt.userId, attempt.awardKey, attempt.score, attempt.id, attempt.createdAt);
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5})`;
      });
      const result = await client.query(
        `INSERT INTO app.point_awards (user_id, award_key, points, reference_id, created_at)
         VALUES ${tuples.join(",")}
         ON CONFLICT (user_id, award_key) DO NOTHING`,
        values,
      );
      claimsInserted += result.rowCount ?? 0;
    }

    // Per farmer: flag its not-yet-flagged farmed rows and subtract exactly the
    // points of the rows THIS run flagged, against the locked current total.
    let usersUpdated = 0;
    let logsFlagged = 0;
    let pointsDeducted = 0;
    for (const entry of farmers) {
      const flagged = await client.query<{ points: string | null }>(
        `UPDATE app.point_logs
            SET data = data || '{"farmed": true}'::jsonb
          WHERE id = ANY($1::text[])
            AND user_id = $2
            AND (data->>'farmed') IS DISTINCT FROM 'true'
          RETURNING data->>'points' AS points`,
        [entry.farmedLogIds, entry.userId],
      );
      logsFlagged += flagged.rowCount ?? 0;
      const deduction = flagged.rows.reduce((sum, row) => sum + farmedAwardPoints(asNumber(row.points)), 0);
      if (deduction <= 0) continue;

      const current = await client.query<{ total: string | null }>(
        `SELECT data->>'totalPoints' AS total FROM app.user_scores WHERE user_id = $1 FOR UPDATE`,
        [entry.userId],
      );
      if (!current.rows[0]) continue;
      const total = deductFarmedPoints(asNumber(current.rows[0].total), deduction);
      const result = await client.query(
        `UPDATE app.user_scores
            SET data = jsonb_set(
                  jsonb_set(data, '{totalPoints}', to_jsonb($2::numeric)),
                  '{currentTier}', to_jsonb($3::text)),
                updated_at = NOW()
          WHERE user_id = $1`,
        [entry.userId, total, getTierForPoints(total)],
      );
      usersUpdated += result.rowCount ?? 0;
      pointsDeducted += deduction;
    }

    await client.query("COMMIT");
    console.log(
      `\n[point-awards backfill] applied: claims inserted=${claimsInserted}, ` +
        `user_scores deducted=${usersUpdated} (points=${pointsDeducted}), point_logs flagged=${logsFlagged}`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[point-awards backfill] failed", error);
    process.exit(1);
  });
