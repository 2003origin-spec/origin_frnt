/**
 * Team contests (Phase 5 remainder). Create a team, join via code, and a team
 * leaderboard where a team's score is the sum of its members' contest scores.
 * Members attempt individually — no change to the attempt/grading flow.
 */

import { randomBytes } from "node:crypto";

import { getUserPostgresPool } from "@/server/user-postgres";
import { createId } from "@/legacy/store";

import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function teamError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function makeJoinCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = randomBytes(6);
  return Array.from(b, (x) => a[x % a.length]).join("");
}

export interface ContestTeam {
  id: string;
  name: string;
  joinCode: string;
  captainId: string;
  memberCount: number;
}

/** Create a team for a contest; the creator becomes captain + first member. */
export async function createTeam(input: { contestId: string; userId: string; name: string }): Promise<ContestTeam> {
  await ensureContestSchema();
  const name = input.name.trim().slice(0, 60);
  if (!name) throw teamError(400, "A team name is required.");
  const existing = await pool().query(`SELECT 1 FROM contest.team_members WHERE contest_id = $1 AND user_id = $2`, [input.contestId, input.userId]);
  if (existing.rows[0]) throw teamError(409, "You are already in a team for this contest.");
  const id = createId("team");
  const joinCode = makeJoinCode();
  await pool().query(
    `INSERT INTO contest.teams (id, contest_id, name, join_code, captain_id) VALUES ($1, $2, $3, $4, $5)`,
    [id, input.contestId, name, joinCode, input.userId],
  );
  await pool().query(
    `INSERT INTO contest.team_members (team_id, contest_id, user_id) VALUES ($1, $2, $3)`,
    [id, input.contestId, input.userId],
  );
  return { id, name, joinCode, captainId: input.userId, memberCount: 1 };
}

/** Join a team by its code (one team per user per contest). */
export async function joinTeam(input: { contestId: string; userId: string; joinCode: string }): Promise<ContestTeam> {
  await ensureContestSchema();
  const team = await pool().query<{ id: string; name: string; join_code: string; captain_id: string }>(
    `SELECT id, name, join_code, captain_id FROM contest.teams WHERE contest_id = $1 AND join_code = $2`,
    [input.contestId, input.joinCode.trim().toUpperCase()],
  );
  if (!team.rows[0]) throw teamError(404, "No team with that code for this contest.");
  try {
    await pool().query(
      `INSERT INTO contest.team_members (team_id, contest_id, user_id) VALUES ($1, $2, $3)`,
      [team.rows[0].id, input.contestId, input.userId],
    );
  } catch {
    throw teamError(409, "You are already in a team for this contest.");
  }
  const count = await pool().query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM contest.team_members WHERE team_id = $1`, [team.rows[0].id]);
  return { id: team.rows[0].id, name: team.rows[0].name, joinCode: team.rows[0].join_code, captainId: team.rows[0].captain_id, memberCount: count.rows[0]?.n ?? 1 };
}

/** The user's team for a contest (or null). */
export async function getMyTeam(contestId: string, userId: string): Promise<ContestTeam | null> {
  await ensureContestSchema();
  const res = await pool().query<{ id: string; name: string; join_code: string; captain_id: string; n: number }>(
    `SELECT t.id, t.name, t.join_code, t.captain_id,
            (SELECT COUNT(*)::int FROM contest.team_members m WHERE m.team_id = t.id) AS n
       FROM contest.team_members tm JOIN contest.teams t ON t.id = tm.team_id
      WHERE tm.contest_id = $1 AND tm.user_id = $2`,
    [contestId, userId],
  );
  if (!res.rows[0]) return null;
  return { id: res.rows[0].id, name: res.rows[0].name, joinCode: res.rows[0].join_code, captainId: res.rows[0].captain_id, memberCount: res.rows[0].n };
}

/** Team leaderboard: teams ranked by the sum of members' contest scores. */
export async function getTeamLeaderboard(contestId: string, limit = 100): Promise<{ rank: number; teamName: string; totalScore: number; memberCount: number }[]> {
  await ensureContestSchema();
  const res = await pool().query<{ name: string; total: number; members: number }>(
    `SELECT t.name,
            COALESCE(SUM(l.score), 0) AS total,
            COUNT(DISTINCT m.user_id) AS members
       FROM contest.teams t
       JOIN contest.team_members m ON m.team_id = t.id
       LEFT JOIN contest.leaderboard_snapshot l ON l.contest_id = t.contest_id AND l.user_id = m.user_id
      WHERE t.contest_id = $1
      GROUP BY t.id, t.name
      ORDER BY total DESC
      LIMIT $2`,
    [contestId, Math.max(1, Math.min(500, limit))],
  );
  return res.rows.map((r, i) => ({ rank: i + 1, teamName: r.name, totalScore: Number(r.total), memberCount: Number(r.members) }));
}
