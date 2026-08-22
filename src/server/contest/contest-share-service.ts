/**
 * Public, sanitized, revocable contest share links (plan Phase 8 growth loop).
 *
 * A participant opts in (POST /api/contest/share) to mint ONE unguessable slug
 * for their result; the public page `/contest/share/[slug]` renders a SANITIZED
 * card — first name, rank, percentile, score, ORBIT — and a "Beat my ORBIT" CTA
 * to the landing. NEVER exposes answers, email, full name, or user id. Only for
 * a RESULT_PUBLISHED contest the user actually finished. Revocable (soft) →
 * public read 404s once revoked.
 */

import { randomBytes } from "node:crypto";

import { getUserPostgresPool } from "@/server/user-postgres";

import { getPersonalResult } from "./contest-ranking-service";
import { getOrbitSummary } from "./contest-orbit-service";
import { ensureContestSchema } from "./contest-schema";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function shareError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** First name / initial only — never the full name (privacy). */
function firstNameOnly(name: string | null | undefined): string {
  const n = String(name ?? "").trim();
  if (!n) return "An Origin scholar";
  return n.split(/\s+/)[0];
}

/**
 * Mint (or return the existing) share slug for the caller's result. Idempotent:
 * re-sharing reuses the same slug and un-revokes it. Gated: results published +
 * the caller has a finished attempt.
 */
export async function getOrCreateShareSlug(contestId: string, userId: string): Promise<string> {
  await ensureContestSchema();
  const p = pool();

  const contest = await p.query(`SELECT status FROM contest.contests WHERE id = $1`, [contestId]);
  if (!contest.rows[0]) throw shareError(404, "Contest not found.");
  const status = contest.rows[0].status;
  if (status !== "result_published" && status !== "archived") {
    throw shareError(403, "Results are not published yet.");
  }
  const attempt = await p.query(
    `SELECT 1 FROM contest.attempts WHERE contest_id = $1 AND user_id = $2 AND finished_at IS NOT NULL`,
    [contestId, userId],
  );
  if (!attempt.rows[0]) throw shareError(403, "Only participants can share a result.");

  const slug = randomBytes(12).toString("base64url"); // ~16 unguessable chars
  const res = await p.query<{ slug: string }>(
    `INSERT INTO contest.share_links (slug, contest_id, user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (contest_id, user_id) DO UPDATE SET revoked = false
     RETURNING slug`,
    [slug, contestId, userId],
  );
  return res.rows[0].slug;
}

/** Soft-revoke the caller's share slug for a contest (public read then 404s). */
export async function revokeShareSlug(contestId: string, userId: string): Promise<void> {
  await ensureContestSchema();
  await pool().query(
    `UPDATE contest.share_links SET revoked = true WHERE contest_id = $1 AND user_id = $2`,
    [contestId, userId],
  );
}

export interface PublicShareCard {
  contestName: string;
  displayName: string;
  rank: number | null;
  percentile: number | null;
  score: number | null;
  totalRanked: number | null;
  orbit: { rating: number; tier: string; provisional: boolean } | null;
  orbitChange: number | null;
}

/**
 * Sanitized public read for a slug. Returns null (→ 404) when the slug is
 * unknown, revoked, or the contest isn't published. NEVER returns answers/email/
 * full name/user id.
 */
export async function getPublicShareCard(slug: string): Promise<PublicShareCard | null> {
  await ensureContestSchema();
  const p = pool();

  const link = await p.query<{ contest_id: string; user_id: string }>(
    `SELECT l.contest_id, l.user_id
       FROM contest.share_links l
       JOIN contest.contests c ON c.id = l.contest_id
      WHERE l.slug = $1 AND l.revoked = false
        AND c.status IN ('result_published', 'archived')`,
    [slug],
  );
  const row = link.rows[0];
  if (!row) return null;
  const { contest_id: contestId, user_id: userId } = row;

  const [meta, personal, attempt, orbit, orbitDelta] = await Promise.all([
    p.query<{ name: string; contest_name: string }>(
      `SELECT u.name AS name, c.name AS contest_name
         FROM origin_users u, contest.contests c
        WHERE u.id = $1 AND c.id = $2`,
      [userId, contestId],
    ),
    getPersonalResult(contestId, userId),
    p.query<{ score: number }>(
      `SELECT score FROM contest.attempts WHERE contest_id = $1 AND user_id = $2 AND finished_at IS NOT NULL`,
      [contestId, userId],
    ),
    getOrbitSummary(userId),
    p.query<{ rating_change: number }>(
      `SELECT rating_change FROM contest.orbit_history WHERE contest_id = $1 AND user_id = $2`,
      [contestId, userId],
    ),
  ]);

  return {
    contestName: meta.rows[0]?.contest_name ?? "Origin Weekly",
    displayName: firstNameOnly(meta.rows[0]?.name),
    rank: personal?.rank ?? null,
    percentile: personal?.percentile ?? null,
    score: attempt.rows[0] ? Number(attempt.rows[0].score) : (personal?.score ?? null),
    totalRanked: personal?.totalRanked ?? null,
    orbit: orbit ? { rating: Math.round(orbit.rating), tier: orbit.tier, provisional: orbit.provisional } : null,
    orbitChange: orbitDelta.rows[0] ? Math.round(Number(orbitDelta.rows[0].rating_change)) : null,
  };
}
