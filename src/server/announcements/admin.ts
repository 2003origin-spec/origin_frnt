/**
 * Admin announcements — the database side of Admin → Announcements.
 *
 *   previewReach        — how many students an audience reaches, and how many
 *                         of them have the app (an active push device).
 *   sendAnnouncement    — check, record, deliver, count, audit.
 *   listAnnouncements   — the send history, newest first, 20 a page.
 *
 * Who counts as a student: role 'student' and account_status 'active'
 * (revoked and deleted accounts are skipped). "Premium" is the entitlement
 * source of truth — an entitled subscriptions.user_subscriptions row
 * (ENTITLED_CLAUSE, the same predicate src/server/entitlements.ts uses) or an
 * active, unexpired entitlements.subject_grants row; never the is_premium
 * mirror. The "me" audience is the sending admin's own account, whatever its
 * role.
 *
 * Sending, in order:
 *   1. one transaction, under a per-admin advisory lock: re-read this admin's
 *      sends from the last hour, apply the double-send / hourly rules
 *      (rules.ts), insert the app.announcements row with the recipient count;
 *   2. deliver (rules.ts deliverAnnouncement): in-app notification for every
 *      recipient, phone notification for those with a device, 10 at a time;
 *   3. one transaction: write the push counts + finished_at and the audit event
 *      (announcement.sent, or announcement.test for "only me").
 * The row exists before delivery starts, so a second click during a send is
 * already a double send.
 */

import type { PoolClient } from "pg";

import {
  audienceKey,
  describeAudience,
  parseAudience,
  validateAnnouncementDraft,
  type AnnouncementAudience,
  type AnnouncementDraft,
} from "@/lib/announcements";
import { ensureSubjectGrantsSchema } from "@/server/connect/subject-grants-schema";
import { ENTITLED_CLAUSE } from "@/server/entitlements";
import { createNotification } from "@/server/notifications";
import { ensureDeviceTokensSchema } from "@/server/push/device-tokens";
import { isPushConfigured, sendPushToUser } from "@/server/push/fcm";
import { ensureSubscriptionsSchema } from "@/server/subscriptions/subscriptions-schema";
import { getUserPostgresPool } from "@/server/user-postgres";
import { recordAuditEvent } from "@/server/workspaces/audit";
import { createPrefixedId } from "@/server/workspaces/ids";

import { AnnouncementError, HOUR_MS, checkSendGuards, deliverAnnouncement, type RecentSend, type Recipient } from "./rules";
import { ensureAnnouncementsSchema } from "./schema";

export const ANNOUNCEMENTS_PAGE_SIZE = 20;

export type Announcement = {
  id: string;
  title: string;
  body: string;
  link: string;
  audience: AnnouncementAudience;
  audienceLabel: string;
  test: boolean;
  sentBy: { id: string; name: string } | null;
  createdAt: string;
  /** null while it is still sending (or if a send was cut off). */
  finishedAt: string | null;
  recipients: number;
  pushAttempted: number;
  pushDelivered: number;
};

export type Reach = { students: number; withPush: number };

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

// ── Audience → SQL ───────────────────────────────────────────────────────────

const HAS_PUSH_SQL = `EXISTS (SELECT 1 FROM notif.device_tokens t WHERE t.user_id = u.id AND t.revoked_at IS NULL)`;

/**
 * The WHERE clause (over `origin_users u`) for an audience, with its params.
 * Exported for the tests. Values are always bound, never spliced.
 *
 *   class — student_class is free text from onboarding/profile ("11",
 *           "dropper", occasionally "Class 11" / "11th"); compared after
 *           dropping "class", "th" and punctuation. Droppers also match the
 *           is_dropper flag.
 *   exam  — the study mode the student picked (jee / neet), or the onboarding
 *           course text, matched the way inferStudyModeFromProfile reads it.
 */
export function audienceWhere(audience: AnnouncementAudience, adminId: string): { sql: string; params: unknown[] } {
  if (audience.kind === "me") return { sql: `u.id = $1`, params: [adminId] };
  const parts = [`u.role = 'student'`, `COALESCE(u.account_status, 'active') = 'active'`];
  const params: unknown[] = [];
  if (audience.studentClass) {
    params.push(audience.studentClass);
    const cls = `regexp_replace(lower(COALESCE(u.student_class, '')), '(class|th|[^a-z0-9])', '', 'g') = $${params.length}`;
    parts.push(audience.studentClass === "dropper" ? `(${cls} OR u.is_dropper)` : cls);
  }
  if (audience.exam === "jee") parts.push(`(u.study_mode = 'jee' OR u.selected_course ~* '(jee|engineering)')`);
  if (audience.exam === "neet") parts.push(`(u.study_mode = 'neet' OR u.selected_course ~* '(neet|aipmt|medical)')`);
  if (audience.premiumOnly) {
    parts.push(`(
      EXISTS (SELECT 1 FROM subscriptions.user_subscriptions s WHERE s.user_id = u.id AND ${ENTITLED_CLAUSE})
      OR EXISTS (SELECT 1 FROM entitlements.subject_grants g
                  WHERE g.user_id = u.id AND g.status = 'active' AND (g.expires_at IS NULL OR g.expires_at > NOW()))
    )`);
  }
  return { sql: parts.join(" AND "), params };
}

async function ensureAudienceTables(audience: AnnouncementAudience): Promise<void> {
  await ensureDeviceTokensSchema();
  if (audience.kind === "students" && audience.premiumOnly) {
    await Promise.all([ensureSubscriptionsSchema(), ensureSubjectGrantsSchema()]);
  }
}

export function requireAudience(value: unknown): AnnouncementAudience {
  const audience = parseAudience(value);
  if (!audience) throw new AnnouncementError(400, "invalid_audience", "Choose who gets this announcement.");
  return audience;
}

export async function previewReach(audience: AnnouncementAudience, adminId: string): Promise<{ reach: Reach; pushConfigured: boolean }> {
  await ensureAudienceTables(audience);
  const where = audienceWhere(audience, adminId);
  const result = await pool().query(
    `SELECT COUNT(*)::int AS students, COUNT(*) FILTER (WHERE ${HAS_PUSH_SQL})::int AS with_push
       FROM origin_users u WHERE ${where.sql}`,
    where.params,
  );
  const row = result.rows[0] ?? {};
  return {
    reach: { students: Number(row.students ?? 0), withPush: Number(row.with_push ?? 0) },
    pushConfigured: isPushConfigured(),
  };
}

async function listRecipients(audience: AnnouncementAudience, adminId: string): Promise<Recipient[]> {
  await ensureAudienceTables(audience);
  const where = audienceWhere(audience, adminId);
  const result = await pool().query(
    `SELECT u.id, ${HAS_PUSH_SQL} AS has_push FROM origin_users u WHERE ${where.sql} ORDER BY u.id`,
    where.params,
  );
  return result.rows.map((row) => ({ userId: String(row.id), hasPush: Boolean(row.has_push) }));
}

// ── History ──────────────────────────────────────────────────────────────────

const SELECT = `
  SELECT a.id, a.title, a.body, a.link, a.audience, a.test, a.sent_by, a.created_at, a.finished_at,
         a.recipients, a.push_attempted, a.push_delivered, s.name AS sender_name
    FROM app.announcements a
    LEFT JOIN origin_users s ON s.id = a.sent_by`;

export function mapAnnouncement(row: Record<string, unknown>): Announcement {
  const stored = typeof row.audience === "string" ? (JSON.parse(row.audience) as unknown) : row.audience;
  const audience = parseAudience(stored) ?? { kind: "students", studentClass: null, exam: null, premiumOnly: false };
  return {
    id: String(row.id),
    title: String(row.title),
    body: String(row.body),
    link: String(row.link),
    audience,
    audienceLabel: describeAudience(audience),
    test: Boolean(row.test),
    sentBy: row.sent_by ? { id: String(row.sent_by), name: String(row.sender_name ?? "Admin") } : null,
    createdAt: iso(row.created_at),
    finishedAt: row.finished_at == null ? null : iso(row.finished_at),
    recipients: Number(row.recipients ?? 0),
    pushAttempted: Number(row.push_attempted ?? 0),
    pushDelivered: Number(row.push_delivered ?? 0),
  };
}

export async function listAnnouncements(page: number): Promise<{ announcements: Announcement[]; total: number; pageSize: number }> {
  await ensureAnnouncementsSchema();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const p = pool();
  const [rows, count] = await Promise.all([
    p.query(`${SELECT} ORDER BY a.created_at DESC, a.id DESC LIMIT $1 OFFSET $2`, [
      ANNOUNCEMENTS_PAGE_SIZE,
      (safePage - 1) * ANNOUNCEMENTS_PAGE_SIZE,
    ]),
    p.query(`SELECT COUNT(*)::int AS n FROM app.announcements`),
  ]);
  return {
    announcements: rows.rows.map(mapAnnouncement),
    total: Number(count.rows[0]?.n ?? 0),
    pageSize: ANNOUNCEMENTS_PAGE_SIZE,
  };
}

// ── Send ─────────────────────────────────────────────────────────────────────

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

export function requireDraft(input: { title?: unknown; body?: unknown; link?: unknown }): AnnouncementDraft {
  const checked = validateAnnouncementDraft(input);
  if (!checked.ok) {
    const first = checked.errors.title ?? checked.errors.body ?? checked.errors.link ?? "Check the announcement.";
    throw new AnnouncementError(400, "invalid_announcement", first);
  }
  return checked.draft;
}

/**
 * Send an announcement. `draft` and `audience` are already validated
 * (requireDraft / requireAudience). Throws AnnouncementError for 400 (nobody
 * matches), 409 (double send) and 429 (hourly limit).
 */
export async function sendAnnouncement(
  adminId: string,
  draft: AnnouncementDraft,
  audience: AnnouncementAudience,
  now: number = Date.now(),
): Promise<{ announcement: Announcement }> {
  await ensureAnnouncementsSchema();
  const test = audience.kind === "me";
  const recipients = await listRecipients(audience, adminId);
  if (recipients.length === 0) {
    throw new AnnouncementError(400, "no_recipients", "No students match this audience.");
  }

  const id = createPrefixedId("ann");
  await withTransaction(async (client) => {
    // Serialise one admin's sends so two clicks can't both pass the checks.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`announcements:${adminId}`]);
    const recent = await client.query(
      `SELECT title, body, audience, test, created_at FROM app.announcements
        WHERE sent_by = $1 AND created_at > $2::timestamptz`,
      [adminId, new Date(now - HOUR_MS).toISOString()],
    );
    const sends: RecentSend[] = recent.rows.flatMap((row) => {
      const stored = typeof row.audience === "string" ? (JSON.parse(row.audience) as unknown) : row.audience;
      const parsed = parseAudience(stored);
      return parsed
        ? [{ title: String(row.title), body: String(row.body), audience: parsed, test: Boolean(row.test), createdAt: new Date(iso(row.created_at)) }]
        : [];
    });
    checkSendGuards(sends, { draft, audience, test }, now);
    await client.query(
      `INSERT INTO app.announcements (id, title, body, link, audience, sent_by, test, recipients, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::timestamptz)`,
      [id, draft.title, draft.body, draft.link, JSON.stringify(audience), adminId, test, recipients.length, new Date(now).toISOString()],
    );
  });

  const counts = await deliverAnnouncement(recipients, {
    pushConfigured: isPushConfigured(),
    notify: (userId) => createNotification(userId, { type: "info", title: draft.title, message: draft.body, href: draft.link }),
    push: (userId) =>
      sendPushToUser(userId, {
        title: draft.title,
        body: draft.body,
        route: draft.link,
        data: { type: "announcement", announcementId: id },
      }),
  });

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE app.announcements SET push_attempted = $2, push_delivered = $3, finished_at = now() WHERE id = $1`,
      [id, counts.pushAttempted, counts.pushDelivered],
    );
    await recordAuditEvent(
      {
        actorUserId: adminId,
        workspaceId: null,
        entityType: "announcement",
        entityId: id,
        action: test ? "announcement.test" : "announcement.sent",
        after: {
          title: draft.title,
          link: draft.link,
          audience,
          audienceKey: audienceKey(audience),
          recipients: recipients.length,
          notified: counts.notified,
          pushAttempted: counts.pushAttempted,
          pushDelivered: counts.pushDelivered,
        },
      },
      { client },
    );
  });

  const result = await pool().query(`${SELECT} WHERE a.id = $1`, [id]);
  if (!result.rows[0]) throw new Error("announcement row vanished after send");
  return { announcement: mapAnnouncement(result.rows[0]) };
}
