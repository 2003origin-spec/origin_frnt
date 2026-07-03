/**
 * Server-persisted notifications (Phase 6).
 *
 * Replaces the localStorage-only NotificationContext with a durable store so
 * notifications survive a device change and can be emitted by server events that
 * happen while the user is offline (e.g. someone follows you).
 *
 * Direct-write table (`app.notifications`, USER db) — deliberately NOT a store
 * collection, so emitting from any server flow is a single INSERT and never
 * depends on the store's scoped-persist plumbing. Schema self-applies on first
 * use (idempotent), mirroring the other runtime-ensure modules.
 */

import { createId } from "@/server/store";
import { getUserPostgresPool, isUserPostgresConfigured } from "@/server/user-postgres";

declare global {
  var __originNotificationsSchemaReady: Promise<void> | undefined;
}

export type NotificationType = "info" | "success" | "warning";

export type NotificationRecord = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

const SCHEMA_SQL = `
  CREATE SCHEMA IF NOT EXISTS app;
  CREATE TABLE IF NOT EXISTS app.notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    href TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON app.notifications (user_id, created_at DESC);
`;

async function ensureNotificationsSchema(): Promise<void> {
  const pool = getUserPostgresPool();
  if (!pool) return;
  if (!globalThis.__originNotificationsSchemaReady) {
    globalThis.__originNotificationsSchemaReady = pool
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((error) => {
        globalThis.__originNotificationsSchemaReady = undefined;
        throw error;
      });
  }
  await globalThis.__originNotificationsSchemaReady;
}

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  href: string | null;
  read: boolean;
  created_at: Date | string;
};

function mapRow(row: NotificationRow): NotificationRecord {
  const type: NotificationType =
    row.type === "success" || row.type === "warning" ? row.type : "info";
  return {
    id: row.id,
    type,
    title: row.title,
    message: row.message ?? "",
    href: row.href ?? null,
    read: Boolean(row.read),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

/**
 * Emit a notification for a user. Best-effort: never throws to the caller, so a
 * notification failure can't break the flow that triggered it (follow, etc.).
 */
export async function createNotification(
  userId: string,
  input: { type?: NotificationType; title: string; message?: string; href?: string | null },
): Promise<void> {
  if (!isUserPostgresConfigured() || !userId) return;
  try {
    await ensureNotificationsSchema();
    const pool = getUserPostgresPool();
    if (!pool) return;
    await pool.query(
      `INSERT INTO app.notifications (id, user_id, type, title, message, href)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        createId("notif"),
        userId,
        input.type ?? "info",
        input.title,
        input.message ?? "",
        input.href ?? null,
      ],
    );
  } catch (error) {
    console.error("[notifications] createNotification failed:", error instanceof Error ? error.message : error);
  }
}

export async function listNotifications(
  userId: string,
  options: { limit?: number } = {},
): Promise<{ notifications: NotificationRecord[]; unreadCount: number }> {
  const empty = { notifications: [], unreadCount: 0 };
  if (!isUserPostgresConfigured() || !userId) return empty;
  try {
    await ensureNotificationsSchema();
    const pool = getUserPostgresPool();
    if (!pool) return empty;
    const limit = Math.min(100, Math.max(1, options.limit ?? 30));
    const [rows, unread] = await Promise.all([
      pool.query<NotificationRow>(
        `SELECT id, type, title, message, href, read, created_at
           FROM app.notifications
          WHERE user_id = $1
          ORDER BY created_at DESC
          LIMIT $2`,
        [userId, limit],
      ),
      pool.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM app.notifications WHERE user_id = $1 AND read = false`,
        [userId],
      ),
    ]);
    return {
      notifications: rows.rows.map(mapRow),
      unreadCount: Number(unread.rows[0]?.n ?? 0),
    };
  } catch (error) {
    console.error("[notifications] listNotifications failed:", error instanceof Error ? error.message : error);
    return empty;
  }
}

/** Mark one (by id) or all of a user's notifications read. */
export async function markNotificationsRead(userId: string, id?: string | null): Promise<void> {
  if (!isUserPostgresConfigured() || !userId) return;
  try {
    await ensureNotificationsSchema();
    const pool = getUserPostgresPool();
    if (!pool) return;
    if (id) {
      await pool.query(`UPDATE app.notifications SET read = true WHERE user_id = $1 AND id = $2`, [userId, id]);
    } else {
      await pool.query(`UPDATE app.notifications SET read = true WHERE user_id = $1 AND read = false`, [userId]);
    }
  } catch (error) {
    console.error("[notifications] markNotificationsRead failed:", error instanceof Error ? error.message : error);
  }
}
