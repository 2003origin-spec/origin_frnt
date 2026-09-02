/**
 * Contest access & eligibility (Phase 5). Access modes (open / code / premium),
 * single-use access codes, and cap-aware registration with an overflow waitlist.
 *
 * The registration itself lives in contest-registration-service; this module
 * owns the gate (eligibility + code redemption + seat/waitlist decision) that it
 * calls, plus the admin code CRUD.
 */

import { randomBytes } from "node:crypto";

import { getUserPostgresPool } from "@/server/user-postgres";
import { getEntitledSubjects } from "@/server/entitlements";

import { ensureContestSchema } from "./contest-schema";

export type ContestAccessMode = "open" | "code" | "premium";

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function accessError(status: number, message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** A short, unambiguous code (no 0/O/1/I). */
function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

// ─── Admin: access-code CRUD ─────────────────────────────────────────────────

export interface AccessCodeRow {
  code: string;
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

/** Generate `count` fresh single-use codes for a contest (max 500 per call). */
export async function generateAccessCodes(contestId: string, count: number): Promise<string[]> {
  await ensureContestSchema();
  const n = Math.max(1, Math.min(500, Math.trunc(count)));
  const codes: string[] = [];
  for (let i = 0; i < n; i++) codes.push(makeCode());
  // Bulk insert; a rare collision is dropped by the PK conflict (fewer rows is fine).
  const values = codes.map((_, i) => `($1, $${i + 2})`).join(", ");
  await pool().query(
    `INSERT INTO contest.access_codes (contest_id, code) VALUES ${values}
     ON CONFLICT (contest_id, code) DO NOTHING`,
    [contestId, ...codes],
  );
  return codes;
}

export async function listAccessCodes(contestId: string): Promise<AccessCodeRow[]> {
  await ensureContestSchema();
  const res = await pool().query<{ code: string; redeemed_by: string | null; redeemed_at: string | null; created_at: string }>(
    `SELECT code, redeemed_by, redeemed_at, created_at FROM contest.access_codes
       WHERE contest_id = $1 ORDER BY created_at`,
    [contestId],
  );
  return res.rows.map((r) => ({
    code: r.code,
    redeemedBy: r.redeemed_by,
    redeemedAt: r.redeemed_at ? new Date(r.redeemed_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

// ─── Registration-time gate ──────────────────────────────────────────────────

export interface ContestAccessConfig {
  accessMode: ContestAccessMode;
  registrationCap: number | null;
}

/** Read a contest's access config (defaults for legacy rows: open / uncapped). */
export async function getContestAccessConfig(contestId: string): Promise<ContestAccessConfig | null> {
  await ensureContestSchema();
  const res = await pool().query<{ access_mode: string; registration_cap: number | null }>(
    `SELECT access_mode, registration_cap FROM contest.contests WHERE id = $1`,
    [contestId],
  );
  if (!res.rows[0]) return null;
  return {
    accessMode: (res.rows[0].access_mode as ContestAccessMode) ?? "open",
    registrationCap: res.rows[0].registration_cap,
  };
}

/**
 * Enforce eligibility for `access_mode` BEFORE a registration insert. Throws 403
 * when the user may not register. For 'code' mode the supplied code is redeemed
 * atomically (marked to this user); an invalid/used code is rejected. 'premium'
 * requires at least one entitled subject. 'open' always passes.
 *
 * Returns the redeemed code (if any) so the caller can surface it.
 */
export async function enforceContestEligibility(input: {
  contestId: string;
  userId: string;
  accessMode: ContestAccessMode;
  code?: string | null;
}): Promise<{ redeemedCode?: string }> {
  if (input.accessMode === "open") return {};

  if (input.accessMode === "premium") {
    const subjects = await getEntitledSubjects(input.userId).catch(() => []);
    if (!subjects.length) {
      throw accessError(403, "This is a premium contest — an active subscription is required to register.");
    }
    return {};
  }

  // 'code' mode: redeem a single-use code atomically. A user who already redeemed
  // one for this contest passes (idempotent re-registration).
  const alreadyMine = await pool().query(
    `SELECT code FROM contest.access_codes WHERE contest_id = $1 AND redeemed_by = $2 LIMIT 1`,
    [input.contestId, input.userId],
  );
  if (alreadyMine.rows[0]) return { redeemedCode: alreadyMine.rows[0].code };

  const code = (input.code ?? "").trim().toUpperCase();
  if (!code) throw accessError(403, "This contest requires an access code to register.");

  const redeemed = await pool().query(
    `UPDATE contest.access_codes
        SET redeemed_by = $2, redeemed_at = NOW()
      WHERE contest_id = $1 AND code = $3 AND redeemed_by IS NULL
      RETURNING code`,
    [input.contestId, input.userId, code],
  );
  if (!redeemed.rows[0]) throw accessError(403, "That access code is invalid or has already been used.");
  return { redeemedCode: redeemed.rows[0].code };
}

/**
 * Decide the registration status given the cap: 'registered' while confirmed
 * seats remain, else 'waitlisted'. Counts only confirmed seats. Null cap =
 * always 'registered'.
 */
export async function seatStatusForNewRegistration(
  contestId: string,
  cap: number | null,
): Promise<"registered" | "waitlisted"> {
  if (cap == null) return "registered";
  const res = await pool().query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM contest.registrations WHERE contest_id = $1 AND status = 'registered'`,
    [contestId],
  );
  return (res.rows[0]?.n ?? 0) < cap ? "registered" : "waitlisted";
}

/**
 * Promote the earliest waitlisted registrations into confirmed seats up to the
 * cap (FIFO). Called after an un-register frees a seat. Best-effort; returns the
 * number promoted.
 */
export async function promoteFromWaitlist(contestId: string, cap: number | null): Promise<number> {
  if (cap == null) return 0;
  const res = await pool().query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM contest.registrations WHERE contest_id = $1 AND status = 'registered'`,
    [contestId],
  );
  const free = cap - (res.rows[0]?.n ?? 0);
  if (free <= 0) return 0;
  const promoted = await pool().query(
    `UPDATE contest.registrations SET status = 'registered'
      WHERE (contest_id, user_id) IN (
        SELECT contest_id, user_id FROM contest.registrations
         WHERE contest_id = $1 AND status = 'waitlisted'
         ORDER BY registered_at ASC LIMIT $2
      )`,
    [contestId, free],
  );
  return promoted.rowCount ?? 0;
}
