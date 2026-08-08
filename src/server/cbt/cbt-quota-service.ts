/**
 * CBT participation quota — teacher-side state, the participation meter, and the
 * enforcement guards. Admin approve/reject/set lives in cbt-quota-admin-service.
 *
 * The metered unit is a participant who ACTUALLY STARTED A TEST
 * (`cbt.room_participants.entered_test_at` stamped). It is counted exactly once
 * per participant, forever, in an append-only ledger that deliberately has no FK
 * to cbt.rooms — deleting a room must not refund a teacher's consumption.
 *
 * See V1/CBT_PARTICIPATION_QUOTA_PLAN.md.
 */

import type { Pool, PoolClient } from "pg";

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getUserPostgresPool } from "@/server/user-postgres";
import { createNotification } from "@/server/notifications";
import { getTeacherCodeSupportPhone } from "@/server/platform-settings";
import { recordAuditEvent } from "@/server/workspaces/audit";
import {
  CbtQuotaError,
  alreadyNotifiedThisPeriod,
  canAdmitParticipant,
  computeQuotaPeriod,
  deriveQuotaState,
  joinBlockMessage,
  joinBlockReason,
  normalizeRequestedAdditional,
  quotaBlockedMessage,
  type CbtQuotaCounts,
  type CbtQuotaPeriodState,
  type CbtQuotaResetMode,
  type CbtQuotaResetPolicy,
  type CbtQuotaState,
} from "@/lib/cbt/quota-model";

import { ensureCbtQuotaSchema } from "./cbt-quota-schema";
import { cbtId } from "./ids";

export { CbtQuotaError };

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

/**
 * The single kill switch consulted by every guard. With the flag off, quota
 * enforcement is a complete no-op — nothing blocks, nothing is metered away
 * (existing ledger rows are untouched), so flipping it back on restores exact
 * usage without a redeploy.
 */
export function isCbtQuotaEnforced(): boolean {
  return isFeatureEnabled("cbtParticipationQuota");
}

/**
 * Applies the quota DDL if it hasn't been applied yet. Callers that are about to
 * open their own transaction should await this FIRST, so no DDL (which needs
 * catalog locks) ever runs while their transaction is holding row locks.
 */
export async function ensureCbtQuotaReady(): Promise<void> {
  await ensureCbtQuotaSchema();
}

// ── Counting ────────────────────────────────────────────────────────────────

/** Columns that make up a teacher's renewal policy. */
export const QUOTA_POLICY_COLUMNS = `participation_quota, quota_reset_mode, quota_period_days,
  quota_period_anchor, quota_notified_at, quota_updated_at`;

export function rowToResetPolicy(row: Record<string, unknown>): CbtQuotaResetPolicy {
  const mode = (row.quota_reset_mode as CbtQuotaResetMode) ?? "none";
  return {
    mode: mode === "monthly" || mode === "days" ? mode : "none",
    periodDays:
      row.quota_period_days === null || row.quota_period_days === undefined
        ? null
        : Number(row.quota_period_days),
    anchor: row.quota_period_anchor ? new Date(row.quota_period_anchor as string) : null,
  };
}

export type CbtQuotaReadout = CbtQuotaCounts & {
  period: CbtQuotaPeriodState;
  /** Everything the teacher has ever consumed, across all cycles. */
  lifetimeUsed: number;
  notifiedAt: string | null;
};

/**
 * Counts for a teacher: the cap, consumption inside the CURRENT renewal window,
 * lifetime consumption, and the transient lobby reservations.
 *
 * The window is derived (see computeQuotaPeriod) and passed to the count query as
 * a lower bound, which is what makes the allowance "reset to 0" on renewal
 * without any job mutating rows. Accepts a client so the join path can read
 * inside the same locked transaction that inserts the participant.
 */
export async function readQuotaCounts(
  teacherId: string,
  client?: PoolClient,
  now: Date = new Date(),
): Promise<CbtQuotaReadout> {
  await ensureCbtQuotaSchema();
  const runner = client ?? pool();

  const teacher = await runner.query(
    `SELECT ${QUOTA_POLICY_COLUMNS} FROM cbt.teachers WHERE id = $1`,
    [teacherId],
  );
  const trow = teacher.rows[0];
  if (!trow) throw new CbtQuotaError(404, "CBT teacher not found.", "teacher_not_found");

  const period = computeQuotaPeriod(rowToResetPolicy(trow), now);
  const windowStart = period.start ? new Date(period.start) : null;

  const res = await runner.query(
    `SELECT (SELECT COUNT(*)::int FROM cbt.participation_ledger l
              WHERE l.teacher_id = $1
                AND ($2::timestamptz IS NULL OR l.counted_at >= $2::timestamptz)) AS used,
            (SELECT COUNT(*)::int FROM cbt.participation_ledger l
              WHERE l.teacher_id = $1) AS lifetime_used,
            (SELECT COUNT(*)::int
               FROM cbt.room_participants p
               JOIN cbt.rooms r ON r.id = p.room_id
              WHERE r.teacher_id = $1
                AND r.status IN ('lobby', 'in_test')
                AND p.kicked = FALSE
                AND NOT EXISTS (
                  SELECT 1 FROM cbt.participation_ledger l2 WHERE l2.participant_id = p.id
                )) AS held`,
    [teacherId, windowStart],
  );
  const row = res.rows[0] ?? {};

  return {
    quota:
      trow.participation_quota === null || trow.participation_quota === undefined
        ? null
        : Number(trow.participation_quota),
    used: Number(row.used ?? 0),
    lifetimeUsed: Number(row.lifetime_used ?? 0),
    held: Number(row.held ?? 0),
    period,
    notifiedAt: trow.quota_notified_at ? new Date(trow.quota_notified_at as string).toISOString() : null,
  };
}

/**
 * Counts as the guards see them. With the flag off this reports `quota: null`,
 * so every derived status is `unlimited` and every guard short-circuits — the
 * stored cap is preserved, just not enforced.
 */
async function readEnforcedCounts(teacherId: string, client?: PoolClient): Promise<CbtQuotaReadout> {
  const counts = await readQuotaCounts(teacherId, client);
  return isCbtQuotaEnforced() ? counts : { ...counts, quota: null };
}

export type CbtParticipationRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type CbtParticipationRequest = {
  id: string;
  teacherId: string;
  requestedBy: string | null;
  requestedAdditional: number;
  note: string | null;
  status: CbtParticipationRequestStatus;
  usedAtRequest: number;
  quotaAtRequest: number | null;
  grantedQuota: number | null;
  adminNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRequest(row: Record<string, unknown>): CbtParticipationRequest {
  return {
    id: String(row.id),
    teacherId: String(row.teacher_id),
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    requestedAdditional: Number(row.requested_additional ?? 0),
    note: row.note ? String(row.note) : null,
    status: (row.status as CbtParticipationRequestStatus) ?? "pending",
    usedAtRequest: Number(row.used_at_request ?? 0),
    quotaAtRequest:
      row.quota_at_request === null || row.quota_at_request === undefined
        ? null
        : Number(row.quota_at_request),
    grantedQuota:
      row.granted_quota === null || row.granted_quota === undefined ? null : Number(row.granted_quota),
    adminNote: row.admin_note ? String(row.admin_note) : null,
    decidedBy: row.decided_by ? String(row.decided_by) : null,
    decidedAt: row.decided_at ? new Date(row.decided_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  };
}

export type CbtTeacherQuotaState = CbtQuotaState & {
  /** False when the platform kill switch is off — the UI then hides the meter. */
  enforced: boolean;
  /** Consumption across every cycle, shown alongside the current window. */
  lifetimeUsed: number;
  pendingRequest: CbtParticipationRequest | null;
  /** Admin-editable number to discuss pricing; reused from the code-access flow. */
  supportPhone: string | null;
};

/** Everything the CBT navbar meter and the quota banner need. */
export async function getCbtQuotaState(teacherId: string): Promise<CbtTeacherQuotaState> {
  const [counts, pending, supportPhone] = await Promise.all([
    readEnforcedCounts(teacherId),
    getPendingParticipationRequest(teacherId),
    getTeacherCodeSupportPhone(),
  ]);
  return {
    ...deriveQuotaState(counts, counts.period),
    enforced: isCbtQuotaEnforced(),
    lifetimeUsed: counts.lifetimeUsed,
    pendingRequest: pending,
    supportPhone,
  };
}

// ── Metering ────────────────────────────────────────────────────────────────

/**
 * Records one participation, idempotently.
 *
 * Called from the two server paths that stamp `entered_test_at` (the in-test
 * heartbeat and the first answer autosave). `PRIMARY KEY (participant_id)` +
 * `ON CONFLICT DO NOTHING` is what makes rejoin / resume / reclaim / a second
 * device count once, with no read-modify-write and no row lock. The `WHERE
 * entered_test_at IS NOT NULL` guard means a lobby-only student is never billed.
 *
 * Deliberately never denies and never throws: a student mid-exam cannot fix
 * their teacher's quota, and a bookkeeping hiccup must not break the paper. The
 * caller ignores the result; the drain's reconcile sweep is the safety net.
 */
export async function recordParticipation(participantId: string, roomId: string): Promise<boolean> {
  if (!isCbtQuotaEnforced()) return false;
  try {
    await ensureCbtQuotaSchema();
    const res = await pool().query(
      `INSERT INTO cbt.participation_ledger
         (participant_id, teacher_id, room_id, room_name, display_name, student_code)
       SELECT p.id, r.teacher_id, r.id, r.name, p.display_name, p.student_code
         FROM cbt.room_participants p
         JOIN cbt.rooms r ON r.id = p.room_id
        WHERE p.id = $1 AND p.room_id = $2 AND p.entered_test_at IS NOT NULL
       ON CONFLICT (participant_id) DO NOTHING
       RETURNING teacher_id`,
      [participantId, roomId],
    );
    const teacherId = res.rows[0]?.teacher_id as string | undefined;
    if (!teacherId) return false;
    // This call is the one that consumed the seat, so the "you're full" check
    // runs exactly once per exhaustion episode.
    await notifyIfExhausted(teacherId);
    return true;
  } catch (error) {
    console.error(
      "[cbt-quota] recordParticipation failed",
      participantId,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

/**
 * Emits the "your quota limit is full" notification the first time a teacher
 * crosses their cap *in the current renewal cycle*.
 *
 * Dedupe is `quota_notified_at >= current window start`, so a renewal re-arms it
 * with no extra bookkeeping — the same reason nothing has to "reset" the counter.
 * An admin raising the cap clears the stamp outright.
 */
export async function notifyIfExhausted(teacherId: string): Promise<boolean> {
  try {
    const counts = await readEnforcedCounts(teacherId);
    if (counts.quota === null || counts.used < counts.quota) return false;
    if (alreadyNotifiedThisPeriod(counts.notifiedAt, counts.period)) return false;

    // Claim the notification atomically: whichever concurrent request wins the
    // UPDATE is the one that sends it. The same window predicate is repeated in
    // SQL so two requests in the same cycle cannot both claim.
    const windowStart = counts.period.start ? new Date(counts.period.start) : null;
    const claimed = await pool().query(
      `UPDATE cbt.teachers SET quota_notified_at = NOW(), updated_at = NOW()
        WHERE id = $1
          AND (quota_notified_at IS NULL
               OR ($2::timestamptz IS NOT NULL AND quota_notified_at < $2::timestamptz))
        RETURNING user_id, email, participation_quota`,
      [teacherId, windowStart],
    );
    const row = claimed.rows[0];
    if (!row) return false;

    await recordAuditEvent({
      actorUserId: null,
      workspaceId: null,
      entityType: "cbt_teacher",
      entityId: teacherId,
      action: "cbt_quota.exhausted",
      after: {
        quota: counts.quota,
        used: counts.used,
        email: row.email,
        periodStart: counts.period.start,
        periodEnd: counts.period.end,
      },
      requestId: null,
    });

    if (row.user_id) {
      const renewal =
        counts.period.end && counts.period.daysUntilReset !== null
          ? ` It renews in ${counts.period.daysUntilReset} day${counts.period.daysUntilReset === 1 ? "" : "s"}.`
          : "";
      await createNotification(String(row.user_id), {
        type: "warning",
        title: "CBT participation limit reached",
        message:
          `Your quota of ${Number(counts.quota).toLocaleString("en-IN")} test participations is full. ` +
          `Your room links and codes are blocked until you request more.${renewal}`,
        href: "/cbt/rooms",
      });
    }
    return true;
  } catch (error) {
    console.error(
      "[cbt-quota] notifyIfExhausted failed",
      teacherId,
      error instanceof Error ? error.message : error,
    );
    return false;
  }
}

// ── Guards ──────────────────────────────────────────────────────────────────

/**
 * Blocks a teacher action once the cap is consumed. Used by room creation and
 * by code reveal/regeneration — the latter IS the "code is blocked" rule, since
 * only `code_hash` is stored and the plaintext is unobtainable anywhere else.
 */
export async function assertQuotaNotExhausted(teacherId: string): Promise<void> {
  const counts = await readEnforcedCounts(teacherId);
  if (deriveQuotaState(counts, counts.period).blocked) {
    throw new CbtQuotaError(403, quotaBlockedMessage(counts.quota, counts.period), "quota_exhausted");
  }
}

/**
 * Seat admission, inside the caller's transaction.
 *
 * `SELECT … FOR UPDATE` on the teacher row serialises seat allocation per
 * teacher, so two students cannot both take the last seat. A teacher with no cap
 * skips the lock entirely, which is why grandfathered teachers see no change in
 * join behaviour or latency.
 */
export async function assertJoinAllowed(client: PoolClient, teacherId: string): Promise<void> {
  if (!isCbtQuotaEnforced()) return;
  await ensureCbtQuotaSchema();

  const capRes = await client.query(
    `SELECT participation_quota AS quota FROM cbt.teachers WHERE id = $1 FOR UPDATE`,
    [teacherId],
  );
  const rawQuota = capRes.rows[0]?.quota;
  if (rawQuota === null || rawQuota === undefined) return; // unlimited — nothing to serialise

  const counts = await readQuotaCounts(teacherId, client);
  if (canAdmitParticipant(counts)) return;

  const reason = joinBlockReason(counts) ?? "exhausted";
  throw new CbtQuotaError(409, joinBlockMessage(reason), `quota_${reason}`);
}

/** Is this room's teacher out of quota? Drives the public landing page notice. */
export async function isRoomQuotaBlocked(teacherId: string): Promise<boolean> {
  if (!isCbtQuotaEnforced()) return false;
  try {
    const counts = await readEnforcedCounts(teacherId);
    // Both states stop a NEW student from joining, so the public page must say
    // so rather than showing a join form that is guaranteed to fail.
    return counts.quota !== null && counts.used + counts.held >= counts.quota;
  } catch (error) {
    // A read failure must not take down the student landing page; the
    // transactional join check remains authoritative.
    console.error("[cbt-quota] isRoomQuotaBlocked failed", error instanceof Error ? error.message : error);
    return false;
  }
}

// ── Requests ────────────────────────────────────────────────────────────────

export async function getPendingParticipationRequest(
  teacherId: string,
): Promise<CbtParticipationRequest | null> {
  await ensureCbtQuotaSchema();
  const res = await pool().query(
    `SELECT * FROM cbt.participation_requests
      WHERE teacher_id = $1 AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1`,
    [teacherId],
  );
  return res.rows[0] ? mapRequest(res.rows[0]) : null;
}

const MAX_NOTE_LENGTH = 500;

/**
 * Teacher asks for more participations. One open request per teacher, enforced
 * by the partial unique index → 409 rather than a silent second row.
 */
export async function createParticipationRequest(input: {
  teacherId: string;
  actorUserId: string | null;
  requestedAdditional: number;
  note?: string | null;
  requestIdHeader?: string | null;
}): Promise<CbtParticipationRequest> {
  const additional = normalizeRequestedAdditional(input.requestedAdditional);
  const counts = await readQuotaCounts(input.teacherId);
  const note = (input.note ?? "").trim().slice(0, MAX_NOTE_LENGTH) || null;

  try {
    const res = await pool().query(
      `INSERT INTO cbt.participation_requests
         (id, teacher_id, requested_by, requested_additional, note, status,
          used_at_request, quota_at_request)
       VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
       RETURNING *`,
      [
        cbtId("cbtqreq"),
        input.teacherId,
        input.actorUserId,
        additional,
        note,
        counts.used,
        counts.quota,
      ],
    );
    const request = mapRequest(res.rows[0]);

    await recordAuditEvent({
      actorUserId: input.actorUserId,
      workspaceId: null,
      entityType: "cbt_participation_request",
      entityId: request.id,
      action: "cbt_quota_request.created",
      after: {
        requestedAdditional: additional,
        quota: counts.quota,
        used: counts.used,
        note,
      },
      requestId: input.requestIdHeader ?? null,
    });

    return request;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new CbtQuotaError(
        409,
        "You already have a pending request for more participations.",
        "request_pending",
      );
    }
    throw error;
  }
}

/** Teacher withdraws their own pending request. */
export async function cancelParticipationRequest(input: {
  teacherId: string;
  requestId: string;
  actorUserId: string | null;
  requestIdHeader?: string | null;
}): Promise<CbtParticipationRequest> {
  await ensureCbtQuotaSchema();
  const res = await pool().query(
    `UPDATE cbt.participation_requests
        SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND teacher_id = $2 AND status = 'pending'
      RETURNING *`,
    [input.requestId, input.teacherId],
  );
  if (!res.rows[0]) {
    throw new CbtQuotaError(404, "No matching pending request to withdraw.", "request_not_found");
  }
  const request = mapRequest(res.rows[0]);

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "cbt_participation_request",
    entityId: request.id,
    action: "cbt_quota_request.cancelled",
    before: { status: "pending" },
    after: { status: "cancelled" },
    requestId: input.requestIdHeader ?? null,
  });

  return request;
}

// ── Reconcile (cron safety net) ─────────────────────────────────────────────

/** How far back (in days) the sweep will repair a missed metering write. */
export const CBT_RECONCILE_WINDOW_DAYS = 2;

/**
 * Inserts ledger rows for participants who entered a test but whose metering
 * INSERT failed (a DB blip, or a deploy that landed mid-test).
 *
 * Scoped by **entered_test_at**, not by room status: this is a repair for writes
 * missed in the last couple of days, NOT a historical backfill. Scoping by room
 * status alone was a real bug — a room that is `finished` but never explicitly
 * closed keeps `ended_at NULL` forever, so the sweep would have charged every
 * participant a teacher has ever had (73 of them on this database) the first
 * time it ran, making them exhausted the moment an admin set their first quota.
 */
export async function reconcileCbtParticipations(
  limit = 500,
): Promise<{ inserted: number; teachers: number }> {
  if (!isCbtQuotaEnforced()) return { inserted: 0, teachers: 0 };
  await ensureCbtQuotaSchema();

  // The candidate SELECT is a CTE so `LIMIT` cannot be misread as part of the
  // INSERT's ON CONFLICT clause.
  const res = await pool().query(
    `WITH candidates AS (
       SELECT p.id AS participant_id, r.teacher_id, r.id AS room_id, r.name AS room_name,
              p.display_name, p.student_code, p.entered_test_at
         FROM cbt.room_participants p
         JOIN cbt.rooms r ON r.id = p.room_id
        WHERE p.entered_test_at IS NOT NULL
          AND p.entered_test_at > NOW() - make_interval(days => $2::int)
          AND r.status IN ('lobby', 'in_test', 'finished')
          AND NOT EXISTS (
            SELECT 1 FROM cbt.participation_ledger l WHERE l.participant_id = p.id
          )
        ORDER BY p.entered_test_at ASC
        LIMIT $1
     )
     INSERT INTO cbt.participation_ledger
       (participant_id, teacher_id, room_id, room_name, display_name, student_code, counted_at)
     SELECT participant_id, teacher_id, room_id, room_name, display_name, student_code, entered_test_at
       FROM candidates
     ON CONFLICT (participant_id) DO NOTHING
     RETURNING teacher_id`,
    [Math.min(Math.max(limit, 1), 5_000), CBT_RECONCILE_WINDOW_DAYS],
  );

  const teacherIds = [...new Set(res.rows.map((row) => String(row.teacher_id)))];
  for (const teacherId of teacherIds) {
    await notifyIfExhausted(teacherId);
  }
  return { inserted: res.rowCount ?? 0, teachers: teacherIds.length };
}
