/**
 * Admin-side orchestration for the CBT participation quota — the /admin/cbt
 * panel. Lists every teacher's cap + live usage, sets/clears a cap directly, and
 * approves/rejects a teacher's "I need more" request.
 *
 * Contract order copied from code-access-admin-service: store DML → side effects
 * → recordAuditEvent → createNotification.
 *
 * See V1/CBT_PARTICIPATION_QUOTA_PLAN.md.
 */

import type { Pool } from "pg";

import {
  CbtQuotaError,
  alreadyNotifiedThisPeriod,
  computeQuotaPeriod,
  deriveQuotaState,
  describeResetPolicy,
  normalizeQuotaInput,
  normalizeResetPolicy,
  proposedGrantTotal,
  type CbtQuotaResetInput,
  type CbtQuotaResetPolicy,
  type CbtQuotaState,
} from "@/lib/cbt/quota-model";
import { getUserPostgresPool } from "@/server/user-postgres";
import { createNotification } from "@/server/notifications";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { ensureCbtQuotaSchema } from "./cbt-quota-schema";
import { isCbtQuotaEnforced, readQuotaCounts, rowToResetPolicy } from "./cbt-quota-service";

function pool(): Pool {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

const MAX_NOTE_LENGTH = 500;

export type CbtTeacherQuotaRow = CbtQuotaState & {
  teacherId: string;
  email: string;
  displayName: string | null;
  teacherStatus: "active" | "disabled";
  userId: string | null;
  quotaUpdatedAt: string | null;
  /** Consumption across every cycle, next to the current window's `used`. */
  lifetimeUsed: number;
  /** True once the teacher has been told their cap is full. */
  notified: boolean;
  /** Set when this teacher has an open request awaiting a decision. */
  pendingRequestId: string | null;
  pendingRequestAdditional: number | null;
};

export type CbtQuotaRequestRow = {
  id: string;
  teacherId: string;
  email: string;
  displayName: string | null;
  requestedBy: string | null;
  requestedAdditional: number;
  note: string | null;
  usedAtRequest: number;
  quotaAtRequest: number | null;
  createdAt: string;
  /** Live numbers, so an admin never decides off a stale snapshot. */
  currentQuota: number | null;
  currentUsed: number;
  /** What the "Approve" button pre-fills: current cap + what was asked for. */
  proposedTotal: number;
};

export type CbtQuotaOverview = {
  enforced: boolean;
  teachers: CbtTeacherQuotaRow[];
  requests: CbtQuotaRequestRow[];
};

/**
 * Everything the admin panel needs: every teacher with their cap, their renewal
 * policy, consumption inside the current cycle, lifetime consumption and live
 * lobby holds — plus the pending request queue.
 *
 * Usage is counted per teacher over a DIFFERENT window (each has their own
 * anchor), so the windows are computed in JS and fed back as a VALUES join
 * rather than trying to express calendar-month arithmetic per row in SQL.
 */
export async function getCbtQuotaOverview(now: Date = new Date()): Promise<CbtQuotaOverview> {
  await ensureCbtQuotaSchema();

  const teachersRes = await pool().query(
    `SELECT t.id, t.email, t.display_name, t.status, t.user_id,
            t.participation_quota AS quota, t.quota_updated_at, t.quota_notified_at,
            t.quota_reset_mode, t.quota_period_days, t.quota_period_anchor,
            (SELECT COUNT(*)::int
               FROM cbt.room_participants p
               JOIN cbt.rooms r ON r.id = p.room_id
              WHERE r.teacher_id = t.id
                AND r.status IN ('lobby', 'in_test')
                AND p.kicked = FALSE
                AND NOT EXISTS (
                  SELECT 1 FROM cbt.participation_ledger l2 WHERE l2.participant_id = p.id
                )) AS held,
            (SELECT q.id FROM cbt.participation_requests q
              WHERE q.teacher_id = t.id AND q.status = 'pending'
              ORDER BY q.created_at DESC LIMIT 1) AS pending_request_id,
            (SELECT q.requested_additional FROM cbt.participation_requests q
              WHERE q.teacher_id = t.id AND q.status = 'pending'
              ORDER BY q.created_at DESC LIMIT 1) AS pending_request_additional
       FROM cbt.teachers t
      ORDER BY (t.participation_quota IS NOT NULL) DESC, t.created_at DESC`,
  );

  // Per-teacher renewal window, then one count query bounded by each window.
  const periods = new Map(
    teachersRes.rows.map((row) => [String(row.id), computeQuotaPeriod(rowToResetPolicy(row), now)]),
  );
  const usage = new Map<string, { used: number; lifetimeUsed: number }>();
  if (teachersRes.rows.length > 0) {
    const ids = teachersRes.rows.map((row) => String(row.id));
    const starts = ids.map((id) => {
      const start = periods.get(id)?.start;
      return start ? new Date(start) : null;
    });
    const usageRes = await pool().query(
      `WITH bounds AS (
         SELECT * FROM UNNEST($1::text[], $2::timestamptz[]) AS b(teacher_id, period_start)
       )
       SELECT b.teacher_id,
              (SELECT COUNT(*)::int FROM cbt.participation_ledger l
                WHERE l.teacher_id = b.teacher_id
                  AND (b.period_start IS NULL OR l.counted_at >= b.period_start)) AS used,
              (SELECT COUNT(*)::int FROM cbt.participation_ledger l
                WHERE l.teacher_id = b.teacher_id) AS lifetime_used
         FROM bounds b`,
      [ids, starts],
    );
    for (const row of usageRes.rows) {
      usage.set(String(row.teacher_id), {
        used: Number(row.used ?? 0),
        lifetimeUsed: Number(row.lifetime_used ?? 0),
      });
    }
  }

  // `current_used` comes from the per-teacher window computed above, not from a
  // lifetime count — an admin deciding a request must see the same number the
  // teacher sees.
  const requestsRes = await pool().query(
    `SELECT q.*, t.email, t.display_name, t.participation_quota AS current_quota
       FROM cbt.participation_requests q
       JOIN cbt.teachers t ON t.id = q.teacher_id
      WHERE q.status = 'pending'
      ORDER BY q.created_at ASC`,
  );

  return {
    enforced: isCbtQuotaEnforced(),
    teachers: teachersRes.rows.map((row) => {
      const quota = row.quota === null || row.quota === undefined ? null : Number(row.quota);
      const teacherId = String(row.id);
      const counts = usage.get(teacherId) ?? { used: 0, lifetimeUsed: 0 };
      return {
        ...deriveQuotaState(
          { quota, used: counts.used, held: Number(row.held ?? 0) },
          periods.get(teacherId),
        ),
        lifetimeUsed: counts.lifetimeUsed,
        teacherId,
        email: String(row.email),
        displayName: row.display_name ? String(row.display_name) : null,
        teacherStatus: row.status === "disabled" ? ("disabled" as const) : ("active" as const),
        userId: row.user_id ? String(row.user_id) : null,
        quotaUpdatedAt: row.quota_updated_at
          ? new Date(row.quota_updated_at as string).toISOString()
          : null,
        notified: alreadyNotifiedThisPeriod(
          row.quota_notified_at ? new Date(row.quota_notified_at as string) : null,
          periods.get(teacherId) ?? computeQuotaPeriod({ mode: "none", periodDays: null, anchor: null }, now),
        ),
        pendingRequestId: row.pending_request_id ? String(row.pending_request_id) : null,
        pendingRequestAdditional:
          row.pending_request_additional === null || row.pending_request_additional === undefined
            ? null
            : Number(row.pending_request_additional),
      };
    }),
    requests: requestsRes.rows.map((row) => {
      const currentQuota =
        row.current_quota === null || row.current_quota === undefined ? null : Number(row.current_quota);
      const requestedAdditional = Number(row.requested_additional ?? 0);
      const teacherId = String(row.teacher_id);
      return {
        id: String(row.id),
        teacherId,
        email: String(row.email),
        displayName: row.display_name ? String(row.display_name) : null,
        requestedBy: row.requested_by ? String(row.requested_by) : null,
        requestedAdditional,
        note: row.note ? String(row.note) : null,
        usedAtRequest: Number(row.used_at_request ?? 0),
        quotaAtRequest:
          row.quota_at_request === null || row.quota_at_request === undefined
            ? null
            : Number(row.quota_at_request),
        createdAt: new Date(row.created_at as string).toISOString(),
        currentQuota,
        currentUsed: usage.get(teacherId)?.used ?? 0,
        proposedTotal: proposedGrantTotal(currentQuota, requestedAdditional),
      };
    }),
  };
}

/**
 * Writes a teacher's cap, and optionally their renewal policy.
 *
 * `quota === null` clears the cap (back to unlimited). `reset === undefined`
 * leaves the existing renewal policy alone — approving a request should not
 * silently change someone's billing cycle.
 *
 * Raising the cap above current usage clears `quota_notified_at`, so a future
 * exhaustion notifies again; nothing else has to be "reactivated" because both
 * the blocked state and the renewal window are derived, not stored.
 */
async function writeQuota(
  teacherId: string,
  quota: number | null,
  reset?: CbtQuotaResetPolicy,
): Promise<{
  email: string;
  userId: string | null;
  previousQuota: number | null;
  previousReset: CbtQuotaResetPolicy;
}> {
  await ensureCbtQuotaSchema();
  const before = await pool().query(
    `SELECT email, user_id, participation_quota, quota_reset_mode, quota_period_days, quota_period_anchor
       FROM cbt.teachers WHERE id = $1`,
    [teacherId],
  );
  if (!before.rows[0]) throw new CbtQuotaError(404, "CBT teacher not found.", "teacher_not_found");

  // Usage compared against the cap must be read under the policy we are ABOUT to
  // store: switching a lifetime cap to monthly resets the effective count, and
  // the notification stamp has to follow that, not the old window.
  const effectiveReset = reset ?? rowToResetPolicy(before.rows[0]);
  const nextPeriod = computeQuotaPeriod(effectiveReset);

  await pool().query(
    `UPDATE cbt.teachers
        SET participation_quota = $2,
            quota_reset_mode    = $3,
            quota_period_days   = $4,
            quota_period_anchor = $5,
            quota_updated_at    = NOW(),
            updated_at          = NOW()
      WHERE id = $1`,
    [
      teacherId,
      quota,
      effectiveReset.mode,
      effectiveReset.mode === "days" ? effectiveReset.periodDays : null,
      effectiveReset.mode === "none" ? null : effectiveReset.anchor,
    ],
  );

  // Now that the policy is stored, re-read usage through the NEW window and drop
  // the notification stamp unless they are still over the cap.
  const used = (await readQuotaCounts(teacherId)).used;
  const stillExhausted = quota !== null && used >= quota;
  const windowStart = nextPeriod.start ? new Date(nextPeriod.start) : null;
  await pool().query(
    `UPDATE cbt.teachers
        SET quota_notified_at = CASE
              WHEN $2::boolean
                AND ($3::timestamptz IS NULL OR quota_notified_at >= $3::timestamptz)
              THEN quota_notified_at
              ELSE NULL END
      WHERE id = $1`,
    [teacherId, stillExhausted, windowStart],
  );

  return {
    email: String(before.rows[0].email),
    userId: before.rows[0].user_id ? String(before.rows[0].user_id) : null,
    previousQuota:
      before.rows[0].participation_quota === null || before.rows[0].participation_quota === undefined
        ? null
        : Number(before.rows[0].participation_quota),
    previousReset: rowToResetPolicy(before.rows[0]),
  };
}

export type SetQuotaResult = {
  quota: number | null;
  used: number;
  held: number;
  /** The renewal window now in force. */
  periodStart: string | null;
  periodEnd: string | null;
  resetLabel: string;
  /** Set when the new cap is at or below what the teacher has already consumed. */
  warning: string | null;
};

/**
 * Admin sets (or clears) a teacher's participation cap and renewal policy.
 *
 * `reset` omitted leaves the existing renewal policy untouched, so an admin can
 * bump a number without accidentally re-anchoring a billing cycle.
 */
export async function setTeacherParticipationQuota(input: {
  actorUserId: string;
  teacherId: string;
  quota: unknown;
  reset?: CbtQuotaResetInput;
  requestIdHeader?: string | null;
}): Promise<SetQuotaResult> {
  const quota = normalizeQuotaInput(input.quota);
  const reset = input.reset === undefined ? undefined : normalizeResetPolicy(input.reset);
  const { email, userId, previousQuota, previousReset } = await writeQuota(input.teacherId, quota, reset);
  const counts = await readQuotaCounts(input.teacherId);
  const resetLabel = describeResetPolicy(counts.period);

  let warning: string | null = null;
  if (quota !== null && counts.used >= quota) {
    warning =
      `This cap (${quota.toLocaleString("en-IN")}) is at or below the ${counts.used.toLocaleString("en-IN")} ` +
      "participations already used in the current cycle, so the teacher is blocked from opening new rooms " +
      "immediately. Tests already running are not interrupted.";
  } else if (quota !== null && counts.used + counts.held >= quota) {
    warning =
      `The teacher has ${counts.held.toLocaleString("en-IN")} student(s) waiting in open rooms, which ` +
      "reserves every remaining seat. No new student can join until those rooms finish.";
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "cbt_teacher",
    entityId: input.teacherId,
    action: quota === null ? "cbt_quota.cleared" : "cbt_quota.set",
    before: {
      quota: previousQuota,
      resetMode: previousReset.mode,
      periodDays: previousReset.periodDays,
      anchor: previousReset.anchor?.toISOString() ?? null,
    },
    after: {
      quota,
      used: counts.used,
      held: counts.held,
      email,
      resetMode: counts.period.mode,
      periodDays: counts.period.periodDays,
      anchor: counts.period.anchor,
      periodStart: counts.period.start,
      periodEnd: counts.period.end,
    },
    requestId: input.requestIdHeader ?? null,
  });

  if (userId) {
    await createNotification(userId, {
      type: quota === null ? "success" : "info",
      title: quota === null ? "CBT participation limit removed" : "CBT participation limit updated",
      message:
        quota === null
          ? "You can now run tests without a participation cap."
          : `Your CBT participation limit is now ${quota.toLocaleString("en-IN")} (${resetLabel}) — ` +
            `${counts.used.toLocaleString("en-IN")} used this cycle.`,
      href: "/cbt/rooms",
    });
  }

  return {
    quota,
    used: counts.used,
    held: counts.held,
    periodStart: counts.period.start,
    periodEnd: counts.period.end,
    resetLabel,
    warning,
  };
}

/** Approves a pending request by setting the teacher's NEW TOTAL cap. */
export async function approveParticipationRequest(input: {
  actorUserId: string;
  requestId: string;
  grantedQuota: unknown;
  note?: string | null;
  requestIdHeader?: string | null;
}): Promise<SetQuotaResult> {
  await ensureCbtQuotaSchema();
  const quota = normalizeQuotaInput(input.grantedQuota);
  if (quota === null) {
    throw new CbtQuotaError(
      400,
      "Enter the new total participation limit to grant. To remove the cap entirely, clear it from the teacher row instead.",
      "invalid_quota",
    );
  }
  const note = (input.note ?? "").trim().slice(0, MAX_NOTE_LENGTH) || null;

  // Claim the request first: whoever wins this UPDATE owns the decision, so two
  // admins clicking Approve cannot both grant.
  const decided = await pool().query(
    `UPDATE cbt.participation_requests
        SET status = 'approved', granted_quota = $2, admin_note = $3,
            decided_by = $4, decided_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *`,
    [input.requestId, quota, note, input.actorUserId],
  );
  if (!decided.rows[0]) {
    throw new CbtQuotaError(409, "This request is no longer pending.", "request_not_pending");
  }
  const teacherId = String(decided.rows[0].teacher_id);
  const requestedBy = decided.rows[0].requested_by ? String(decided.rows[0].requested_by) : null;

  // The renewal policy is deliberately NOT passed: approving extra
  // participations must not re-anchor the teacher's billing cycle.
  const { email, userId, previousQuota } = await writeQuota(teacherId, quota);
  const counts = await readQuotaCounts(teacherId);
  const resetLabel = describeResetPolicy(counts.period);

  let warning: string | null = null;
  if (counts.used >= quota) {
    warning =
      `The granted total (${quota.toLocaleString("en-IN")}) is at or below the ` +
      `${counts.used.toLocaleString("en-IN")} participations already used this cycle, so the teacher stays blocked.`;
  }

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "cbt_participation_request",
    entityId: input.requestId,
    action: "cbt_quota_request.approved",
    before: { quota: previousQuota },
    after: { quota, used: counts.used, email, note, periodEnd: counts.period.end },
    requestId: input.requestIdHeader ?? null,
  });

  const recipient = requestedBy ?? userId;
  if (recipient) {
    await createNotification(recipient, {
      type: "success",
      title: "More CBT participations approved",
      message:
        `Your participation limit is now ${quota.toLocaleString("en-IN")} (${resetLabel}) — ` +
        `${counts.used.toLocaleString("en-IN")} used this cycle.`,
      href: "/cbt/rooms",
    });
  }

  return {
    quota,
    used: counts.used,
    held: counts.held,
    periodStart: counts.period.start,
    periodEnd: counts.period.end,
    resetLabel,
    warning,
  };
}

/** Rejects a pending request. The teacher's cap is left untouched. */
export async function rejectParticipationRequest(input: {
  actorUserId: string;
  requestId: string;
  note?: string | null;
  requestIdHeader?: string | null;
}): Promise<void> {
  await ensureCbtQuotaSchema();
  const note = (input.note ?? "").trim().slice(0, MAX_NOTE_LENGTH) || null;

  const decided = await pool().query(
    `UPDATE cbt.participation_requests
        SET status = 'rejected', admin_note = $2, decided_by = $3,
            decided_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING teacher_id, requested_by`,
    [input.requestId, note, input.actorUserId],
  );
  if (!decided.rows[0]) {
    throw new CbtQuotaError(409, "This request is no longer pending.", "request_not_pending");
  }
  const teacherId = String(decided.rows[0].teacher_id);
  const requestedBy = decided.rows[0].requested_by ? String(decided.rows[0].requested_by) : null;

  await recordAuditEvent({
    actorUserId: input.actorUserId,
    workspaceId: null,
    entityType: "cbt_participation_request",
    entityId: input.requestId,
    action: "cbt_quota_request.rejected",
    after: { note },
    requestId: input.requestIdHeader ?? null,
  });

  const teacher = await pool().query(`SELECT user_id FROM cbt.teachers WHERE id = $1`, [teacherId]);
  const recipient = requestedBy ?? (teacher.rows[0]?.user_id ? String(teacher.rows[0].user_id) : null);
  if (recipient) {
    await createNotification(recipient, {
      type: "info",
      title: "CBT participation request update",
      message: note
        ? `Your request for more participations needs a follow-up: ${note}`
        : "Your request for more participations was not approved. Please contact the team.",
      href: "/cbt/rooms",
    });
  }
}
