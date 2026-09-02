/**
 * Contest completion certificate (Phase 6). Assembles the data for a printable
 * certificate from the published leaderboard snapshot — no new storage. Only
 * issued for a contest whose results are published and where the user placed
 * on the board. Read-only.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { ensureContestSchema } from "./contest-schema";
import { getContest } from "./contest-admin-service";
import { getPersonalResult } from "./contest-ranking-service";

export interface ContestCertificate {
  contestId: string;
  contestName: string;
  recipientName: string;
  rank: number | null;
  percentile: number | null;
  score: number | null;
  totalParticipants: number | null;
  issuedOn: string; // ISO date
}

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * Certificate data for a user's contest result, or null when the contest is not
 * result-published or the user did not place on the leaderboard.
 */
export async function getContestCertificate(
  contestId: string,
  userId: string,
): Promise<ContestCertificate | null> {
  await ensureContestSchema();
  const contest = await getContest(contestId);
  if (!contest || contest.status !== "result_published") return null;

  const personal = await getPersonalResult(contestId, userId);
  if (!personal || personal.rank == null) return null;

  const nameRow = await pool().query<{ name: string | null }>(
    `SELECT name FROM origin_users WHERE id = $1`,
    [userId],
  );

  return {
    contestId,
    contestName: contest.name,
    recipientName: (nameRow.rows[0]?.name || "Participant").trim(),
    rank: personal.rank,
    percentile: personal.percentile,
    score: personal.score,
    totalParticipants: personal.totalRanked ?? null,
    issuedOn: (contest.startAt ? new Date(contest.startAt) : new Date()).toISOString(),
  };
}
