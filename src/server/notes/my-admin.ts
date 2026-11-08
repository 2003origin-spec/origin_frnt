/**
 * Origin Notes — admin Storage tab (V1/NOTES_PLAN.md §4 "Storage").
 *
 * Totals, the biggest users, and a lookup for one student: their usage, file
 * names and sizes, a personal limit (with a reason), and upload/sharing
 * blocks. Admins see names and sizes only — never a student's private file
 * (that needs a report, Phase 4). Every change is audited.
 */

import { effectiveLimitBytes } from "@/lib/notes/storage-rules";
import { recordAuditEvent } from "@/server/workspaces/audit";

import type { AdminActor } from "./library-admin";
import { likePattern } from "./library-store";
import { notesPool, toIso, toNumber } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import { getNotesSettings } from "./my-settings";
import { isPremiumStudent, readMeter } from "./my-storage";

export type StorageUserRow = {
  userId: string;
  name: string | null;
  email: string | null;
  usedBytes: number;
  limitBytes: number;
  fileCount: number;
  uploadsBlocked: boolean;
};

export type StorageOverview = {
  totalUsedBytes: number;
  totalFiles: number;
  studentsWithFiles: number;
  byKind: { kind: string; files: number; bytes: number }[];
  topUsers: StorageUserRow[];
};

export type StorageUserDetail = StorageUserRow & {
  reservedBytes: number;
  premium: boolean;
  limitOverrideBytes: number | null;
  overrideReason: string | null;
  sharingBlocked: boolean;
  blockReason: string | null;
  files: { id: string; title: string; kind: string; bytes: number; createdAt: string; inBin: boolean }[];
};

async function limitFor(userId: string, overrideBytes: number | null): Promise<number> {
  const [settings, premium] = await Promise.all([getNotesSettings(), isPremiumStudent(userId)]);
  return effectiveLimitBytes({ overrideBytes, premium, settings });
}

export async function getStorageOverview(): Promise<StorageOverview> {
  await ensureNotesSchema();
  const db = notesPool();
  const [totals, kinds, top] = await Promise.all([
    db.query(`SELECT COALESCE(SUM(bytes), 0) AS bytes, COUNT(*) AS files, COUNT(DISTINCT owner_id) AS owners FROM notes.my_files`),
    db.query(`SELECT kind, COUNT(*) AS files, COALESCE(SUM(bytes), 0) AS bytes FROM notes.my_files GROUP BY kind ORDER BY 3 DESC`),
    db.query(
      `SELECT s.user_id, s.used_bytes, s.limit_override_bytes, s.uploads_blocked, u.name, u.email,
              (SELECT COUNT(*) FROM notes.my_files f WHERE f.owner_id = s.user_id) AS file_count
         FROM notes.storage s JOIN origin_users u ON u.id = s.user_id
        WHERE s.used_bytes > 0
        ORDER BY s.used_bytes DESC LIMIT 20`,
    ),
  ]);
  const topUsers: StorageUserRow[] = [];
  for (const row of top.rows) {
    const userId = String(row.user_id);
    topUsers.push({
      userId,
      name: (row.name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      usedBytes: toNumber(row.used_bytes) ?? 0,
      limitBytes: await limitFor(userId, toNumber(row.limit_override_bytes)),
      fileCount: toNumber(row.file_count) ?? 0,
      uploadsBlocked: Boolean(row.uploads_blocked),
    });
  }
  return {
    totalUsedBytes: toNumber(totals.rows[0]?.bytes) ?? 0,
    totalFiles: toNumber(totals.rows[0]?.files) ?? 0,
    studentsWithFiles: toNumber(totals.rows[0]?.owners) ?? 0,
    byKind: kinds.rows.map((row) => ({ kind: String(row.kind), files: toNumber(row.files) ?? 0, bytes: toNumber(row.bytes) ?? 0 })),
    topUsers,
  };
}

/** Find students by email, phone, name or id (students only). */
export async function findStorageUsers(rawQuery: string): Promise<StorageUserRow[]> {
  const query = rawQuery.trim().slice(0, 120);
  if (query.length < 2) return [];
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT u.id, u.name, u.email, s.used_bytes, s.limit_override_bytes, s.uploads_blocked,
            (SELECT COUNT(*) FROM notes.my_files f WHERE f.owner_id = u.id) AS file_count
       FROM origin_users u LEFT JOIN notes.storage s ON s.user_id = u.id
      WHERE u.role = 'student' AND (u.id = $1 OR u.email ILIKE $2 OR u.mobile ILIKE $2 OR u.name ILIKE $2)
      ORDER BY s.used_bytes DESC NULLS LAST, u.name
      LIMIT 10`,
    [query, likePattern(query)],
  );
  const rows: StorageUserRow[] = [];
  for (const row of result.rows) {
    const userId = String(row.id);
    rows.push({
      userId,
      name: (row.name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      usedBytes: toNumber(row.used_bytes) ?? 0,
      limitBytes: await limitFor(userId, toNumber(row.limit_override_bytes)),
      fileCount: toNumber(row.file_count) ?? 0,
      uploadsBlocked: Boolean(row.uploads_blocked),
    });
  }
  return rows;
}

export async function getStorageUser(userId: string): Promise<StorageUserDetail> {
  await ensureNotesSchema();
  const db = notesPool();
  const user = await db.query(`SELECT id, name, email, role FROM origin_users WHERE id = $1`, [userId]);
  if (!user.rows[0] || user.rows[0].role !== "student") throw notFoundError("That student");
  const meter = await readMeter(db, userId);
  const extra = await db.query(`SELECT override_reason FROM notes.storage WHERE user_id = $1`, [userId]);
  const files = await db.query(
    `SELECT id, title, kind, bytes, created_at, deleted_at FROM notes.my_files WHERE owner_id = $1 ORDER BY bytes DESC LIMIT 200`,
    [userId],
  );
  return {
    userId,
    name: (user.rows[0].name as string | null) ?? null,
    email: (user.rows[0].email as string | null) ?? null,
    usedBytes: meter.usedBytes,
    reservedBytes: meter.reservedBytes,
    limitBytes: await limitFor(userId, meter.overrideBytes),
    premium: await isPremiumStudent(userId),
    limitOverrideBytes: meter.overrideBytes,
    overrideReason: (extra.rows[0]?.override_reason as string | null) ?? null,
    fileCount: files.rows.length,
    uploadsBlocked: meter.uploadsBlocked,
    sharingBlocked: meter.sharingBlocked,
    blockReason: meter.blockReason,
    files: files.rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      kind: String(row.kind),
      bytes: toNumber(row.bytes) ?? 0,
      createdAt: toIso(row.created_at),
      inBin: row.deleted_at !== null,
    })),
  };
}

export type StorageUserPatch = {
  limitOverrideBytes?: number | null;
  overrideReason?: string | null;
  uploadsBlocked?: boolean;
  sharingBlocked?: boolean;
  blockReason?: string | null;
};

export async function updateStorageUser(userId: string, patch: StorageUserPatch, actor: AdminActor): Promise<StorageUserDetail> {
  const before = await getStorageUser(userId);
  const reason = patch.overrideReason?.replace(/\s+/gu, " ").trim().slice(0, 300) || null;
  if (patch.limitOverrideBytes !== undefined && patch.limitOverrideBytes !== null && !reason) {
    throw new NotesError(400, "reason_required", "Add a reason for the personal limit (for example “topper, needs space for videos”).");
  }
  const blockReason = patch.blockReason?.replace(/\s+/gu, " ").trim().slice(0, 300) || null;
  const blocking = patch.uploadsBlocked === true || patch.sharingBlocked === true;
  if (blocking && !blockReason && !before.blockReason) {
    throw new NotesError(400, "reason_required", "Add a reason for the block. The student sees it.");
  }
  const sets: string[] = [];
  const values: unknown[] = [userId];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (patch.limitOverrideBytes !== undefined) {
    push("limit_override_bytes", patch.limitOverrideBytes);
    push("override_reason", patch.limitOverrideBytes === null ? null : reason);
    push("override_by", patch.limitOverrideBytes === null ? null : actor.userId);
  }
  if (patch.uploadsBlocked !== undefined) push("uploads_blocked", patch.uploadsBlocked);
  if (patch.sharingBlocked !== undefined) push("sharing_blocked", patch.sharingBlocked);
  if (patch.blockReason !== undefined || blocking) push("block_reason", blockReason ?? before.blockReason);
  if (sets.length > 0) {
    await notesPool().query(`UPDATE notes.storage SET ${sets.join(", ")}, updated_at = now() WHERE user_id = $1`, values);
  }
  const after = await getStorageUser(userId);
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_storage",
    entityId: userId,
    action: "notes.storage.update",
    before: {
      limitOverrideBytes: before.limitOverrideBytes,
      uploadsBlocked: before.uploadsBlocked,
      sharingBlocked: before.sharingBlocked,
      blockReason: before.blockReason,
    },
    after: {
      limitOverrideBytes: after.limitOverrideBytes,
      overrideReason: after.overrideReason,
      uploadsBlocked: after.uploadsBlocked,
      sharingBlocked: after.sharingBlocked,
      blockReason: after.blockReason,
    },
  }).catch(() => undefined);
  return after;
}
