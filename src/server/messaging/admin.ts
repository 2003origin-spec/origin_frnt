/**
 * Student messaging — admin review of reports (contract addendum 02/11/2026).
 *
 *   listReports   — open or resolved reports, newest first, 20 a page.
 *   getReport     — one report with the conversation (both sides, oldest
 *                   first; `fromMe` is relative to the reporter).
 *   resolveReport — dismiss / warn / suspend (1..90 days). The report row, the
 *                   suspension and the audit event commit together; the
 *                   reported student's in-app notification goes out after.
 *
 * Stored report status is open | reviewed (warn, suspend) | dismissed; the API
 * shows open | resolved plus the `resolution`.
 */

import type { PoolClient } from "pg";

import { createNotification } from "@/server/notifications";
import { getUserPostgresPool } from "@/server/user-postgres";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { createPrefixedId } from "@/server/workspaces/ids";

import {
  MessagingError,
  REPORT_NOTE_MAX_CHARS,
  storedReportStatus,
  suspensionDetail,
  suspensionEndsAt,
  type ReportAction,
  type ReportReason,
} from "./rules";
import { ensureMessagingSchema } from "./schema";
import { activeSuspensionEnd, type Message, type Person } from "./service";

export const ADMIN_REPORTS_PAGE_SIZE = 20;
/** The newest messages shown with a report (a conversation is capped by the daily units, so this is the whole thread in practice). */
export const ADMIN_REPORT_MESSAGES_MAX = 2000;

export type AdminReport = {
  id: string;
  reason: ReportReason;
  note: string | null;
  createdAt: string;
  status: "open" | "resolved";
  reporter: Person;
  reported: Person;
  conversationId: string;
  resolvedAt: string | null;
  resolution: ReportAction | null;
  /** The admin's note on the resolution (not shown to students). */
  resolutionNote: string | null;
};

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

const notFound = () => new MessagingError(404, "not_found", "That report doesn't exist.");

const REPORT_SELECT = `
  SELECT r.id, r.reason, r.note, r.created_at, r.status, r.conversation_id, r.reviewed_at, r.resolution, r.resolution_note,
         rp.id AS reporter_id, rp.username AS reporter_username, rp.name AS reporter_name, rp.avatar AS reporter_avatar,
         rd.id AS reported_id, rd.username AS reported_username, rd.name AS reported_name, rd.avatar AS reported_avatar
    FROM messaging.reports r
    JOIN origin_users rp ON rp.id = r.reporter_id
    JOIN origin_users rd ON rd.id = r.reported_id`;

function person(row: Record<string, unknown>, prefix: "reporter" | "reported"): Person {
  return {
    id: String(row[`${prefix}_id`]),
    username: (row[`${prefix}_username`] as string | null) ?? null,
    name: String(row[`${prefix}_name`] ?? "Student"),
    avatar: (row[`${prefix}_avatar`] as string | null) ?? null,
  };
}

export function mapReport(row: Record<string, unknown>): AdminReport {
  return {
    id: String(row.id),
    reason: row.reason as ReportReason,
    note: (row.note as string | null) ?? null,
    createdAt: iso(row.created_at),
    status: row.status === "open" ? "open" : "resolved",
    reporter: person(row, "reporter"),
    reported: person(row, "reported"),
    conversationId: String(row.conversation_id),
    resolvedAt: row.reviewed_at == null ? null : iso(row.reviewed_at),
    resolution: (row.resolution as ReportAction | null) ?? null,
    resolutionNote: (row.resolution_note as string | null) ?? null,
  };
}

export async function listReports(
  status: "open" | "resolved",
  page: number,
): Promise<{ reports: AdminReport[]; total: number }> {
  await ensureMessagingSchema();
  const where = status === "open" ? `r.status = 'open'` : `r.status <> 'open'`;
  const order = status === "open" ? `r.created_at ASC, r.id ASC` : `r.reviewed_at DESC NULLS LAST, r.id DESC`;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const p = pool();
  const [rows, count] = await Promise.all([
    p.query(`${REPORT_SELECT} WHERE ${where} ORDER BY ${order} LIMIT $1 OFFSET $2`, [
      ADMIN_REPORTS_PAGE_SIZE,
      (safePage - 1) * ADMIN_REPORTS_PAGE_SIZE,
    ]),
    p.query(`SELECT COUNT(*)::int AS n FROM messaging.reports r WHERE ${where}`),
  ]);
  return { reports: rows.rows.map(mapReport), total: Number(count.rows[0]?.n ?? 0) };
}

export async function getReport(
  id: string,
  now: number = Date.now(),
): Promise<{ report: AdminReport; messages: Message[]; suspendedUntil: string | null }> {
  await ensureMessagingSchema();
  const p = pool();
  const result = await p.query(`${REPORT_SELECT} WHERE r.id = $1`, [id]);
  if (!result.rows[0]) throw notFound();
  const report = mapReport(result.rows[0]);
  const [messages, suspendedUntil] = await Promise.all([
    p.query(
      `SELECT id, body, sender_id, created_at, units FROM messaging.messages
        WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT ${ADMIN_REPORT_MESSAGES_MAX}`,
      [report.conversationId],
    ),
    activeSuspensionEnd(p, report.reported.id, now),
  ]);
  return {
    report,
    messages: messages.rows.reverse().map((row) => ({
      id: String(row.id),
      text: String(row.body),
      fromMe: row.sender_id === report.reporter.id,
      at: iso(row.created_at),
      units: Number(row.units),
    })),
    suspendedUntil: suspendedUntil ? suspendedUntil.toISOString() : null,
  };
}

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export const WARN_NOTIFICATION = {
  type: "warning" as const,
  title: "A warning about your messages",
  message: "A student reported messages from you. Keep messages kind and about studies. More reports can pause messaging on your account.",
  href: "/messages",
};

export function suspendNotification(endsAt: Date) {
  return {
    type: "warning" as const,
    title: "Messaging paused",
    message: `${suspensionDetail(endsAt)} You can still read your messages.`,
    href: "/messages",
  };
}

/**
 * Resolve an open report. `days` is required (1..90, checked by the caller)
 * for `suspend`. A second resolve of the same report answers 409.
 */
export async function resolveReport(
  adminId: string,
  id: string,
  input: { action: ReportAction; days?: number | null; note?: string | null },
  now: number = Date.now(),
): Promise<{ report: AdminReport }> {
  await ensureMessagingSchema();
  const note = input.note?.replace(/\u0000/g, "").trim().slice(0, REPORT_NOTE_MAX_CHARS) || null;
  if (input.action === "suspend" && !input.days) {
    throw new MessagingError(400, "invalid_days", "Choose how many days to suspend (1 to 90).");
  }
  const at = new Date(now);
  const endsAt = input.action === "suspend" ? suspensionEndsAt(now, input.days!) : null;

  const outcome = await withTransaction(async (client) => {
    const locked = await client.query(
      `SELECT id, status, reported_id, conversation_id FROM messaging.reports WHERE id = $1 FOR UPDATE`,
      [id],
    );
    const row = locked.rows[0];
    if (!row) throw notFound();
    if (row.status !== "open") throw new MessagingError(409, "already_resolved", "This report is already resolved.");
    const reportedId = String(row.reported_id);
    await client.query(
      `UPDATE messaging.reports
          SET status = $2, resolution = $3, resolution_note = $4, reviewed_at = $5::timestamptz, reviewed_by = $6
        WHERE id = $1`,
      [id, storedReportStatus(input.action), input.action, note, at.toISOString(), adminId],
    );
    let suspensionId: string | null = null;
    if (endsAt) {
      suspensionId = createPrefixedId("msus");
      await client.query(
        `INSERT INTO messaging.suspensions (id, user_id, report_id, starts_at, ends_at, note, created_by)
         VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7)`,
        [suspensionId, reportedId, id, at.toISOString(), endsAt.toISOString(), note, adminId],
      );
    }
    // In the same transaction: the audit row commits or rolls back with the change.
    await recordAuditEvent(
      {
        actorUserId: adminId,
        workspaceId: null,
        entityType: "messaging_report",
        entityId: id,
        action: `messaging.report.${input.action}`,
        before: { status: "open" },
        after: {
          action: input.action,
          reportedUserId: reportedId,
          conversationId: String(row.conversation_id),
          note,
          ...(endsAt ? { days: input.days, suspensionId, suspendedUntil: endsAt.toISOString() } : {}),
        },
      },
      { client },
    );
    return { reportedId };
  });

  if (input.action === "warn") await createNotification(outcome.reportedId, WARN_NOTIFICATION);
  if (endsAt) await createNotification(outcome.reportedId, suspendNotification(endsAt));

  const result = await pool().query(`${REPORT_SELECT} WHERE r.id = $1`, [id]);
  if (!result.rows[0]) throw notFound();
  return { report: mapReport(result.rows[0]) };
}
