/**
 * Origin Notes — the My Notes storage meter (V1/NOTES_PLAN.md §8).
 *
 * `notes.storage` holds, per student, the bytes in use (files plus Bin) and
 * the bytes reserved by uploads still in flight. Space is reserved with ONE
 * conditional UPDATE, so two uploads started at the same moment can't both
 * slip past the limit (the same idea as the CBT participation quota).
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import type { PoolClient } from "pg";

import type { MyStorageSummary } from "@/lib/notes/my-types";
import {
  effectiveLimitBytes,
  STORAGE_FULL_MESSAGE,
  storageLevel,
  storagePercent,
  TYPED_NOTE_MAX_BYTES,
  type NotesSettings,
} from "@/lib/notes/storage-rules";
import { getEntitledSubjects } from "@/server/entitlements";

import { notesPool, toNumber } from "./notes-db";
import { NotesError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import { getNotesSettings } from "./my-settings";

type Queryable = Pick<PoolClient, "query">;

export type MeterRow = {
  usedBytes: number;
  reservedBytes: number;
  overrideBytes: number | null;
  uploadsBlocked: boolean;
  sharingBlocked: boolean;
  blockReason: string | null;
};

/** Owning any premium subject earns the premium limit. Entitlements stay dark (empty) until premium launches. */
export async function isPremiumStudent(userId: string): Promise<boolean> {
  try {
    return (await getEntitledSubjects(userId)).length > 0;
  } catch {
    return false;
  }
}

export async function ensureMeter(db: Queryable, userId: string): Promise<void> {
  await db.query(`INSERT INTO notes.storage (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
}

function mapMeter(row: Record<string, unknown> | undefined): MeterRow {
  return {
    usedBytes: toNumber(row?.used_bytes) ?? 0,
    reservedBytes: toNumber(row?.reserved_bytes) ?? 0,
    overrideBytes: toNumber(row?.limit_override_bytes),
    uploadsBlocked: Boolean(row?.uploads_blocked),
    sharingBlocked: Boolean(row?.sharing_blocked),
    blockReason: (row?.block_reason as string | null) ?? null,
  };
}

export async function readMeter(db: Queryable, userId: string, forUpdate = false): Promise<MeterRow> {
  await ensureMeter(db, userId);
  const result = await db.query(
    `SELECT used_bytes, reserved_bytes, limit_override_bytes, uploads_blocked, sharing_blocked, block_reason
       FROM notes.storage WHERE user_id = $1${forUpdate ? " FOR UPDATE" : ""}`,
    [userId],
  );
  return mapMeter(result.rows[0]);
}

export type StudentLimits = { settings: NotesSettings; premium: boolean; limitBytes: number; meter: MeterRow };

export async function getStudentLimits(userId: string): Promise<StudentLimits> {
  await ensureNotesSchema();
  const [settings, premium, meter] = await Promise.all([getNotesSettings(), isPremiumStudent(userId), readMeter(notesPool(), userId)]);
  return { settings, premium, meter, limitBytes: effectiveLimitBytes({ overrideBytes: meter.overrideBytes, premium, settings }) };
}

export async function getStorageSummary(userId: string): Promise<MyStorageSummary> {
  const { settings, premium, meter, limitBytes } = await getStudentLimits(userId);
  const bin = await notesPool().query(
    `SELECT COALESCE(SUM(bytes), 0) AS bytes,
            COUNT(*) FILTER (WHERE deleted_batch = id) AS roots
       FROM notes.my_files WHERE owner_id = $1 AND deleted_at IS NOT NULL`,
    [userId],
  );
  const binFolders = await notesPool().query(
    `SELECT COUNT(*) AS roots FROM notes.my_folders WHERE owner_id = $1 AND deleted_at IS NOT NULL AND deleted_batch = id`,
    [userId],
  );
  return {
    usedBytes: meter.usedBytes,
    reservedBytes: meter.reservedBytes,
    limitBytes,
    percent: storagePercent(meter.usedBytes, limitBytes),
    level: storageLevel(meter.usedBytes, limitBytes),
    binBytes: toNumber(bin.rows[0]?.bytes) ?? 0,
    binCount: (toNumber(bin.rows[0]?.roots) ?? 0) + (toNumber(binFolders.rows[0]?.roots) ?? 0),
    premium,
    hasPersonalLimit: meter.overrideBytes !== null,
    uploadsEnabled: settings.uploadsEnabled,
    uploadsBlocked: meter.uploadsBlocked,
    sharingOn: isFeatureEnabled("notesSharing") && isFeatureEnabled("studentSocial") && settings.sharingEnabled,
    sharingBlocked: meter.sharingBlocked,
    allowedKinds: settings.allowedKinds,
    maxFileBytes: settings.maxFileBytes,
    maxVideoBytes: settings.maxVideoBytes,
    typedMaxBytes: TYPED_NOTE_MAX_BYTES,
    binDays: settings.binDays,
  };
}

export function blockedError(reason: string | null): NotesError {
  return new NotesError(
    403,
    "uploads_blocked",
    reason ? `Uploads are turned off for your account: ${reason}` : "Uploads are turned off for your account. Contact support if this is a mistake.",
  );
}

export function fullError(): NotesError {
  return new NotesError(413, "storage_full", STORAGE_FULL_MESSAGE);
}

/**
 * Reserve `bytes` for an upload. One statement checks the limit AND reserves,
 * so concurrent tickets serialise on the row and can never overshoot.
 */
export async function reserveBytes(userId: string, bytes: number, limitBytes: number, db: Queryable = notesPool()): Promise<void> {
  await ensureMeter(db, userId);
  const result = await db.query(
    `UPDATE notes.storage
        SET reserved_bytes = reserved_bytes + $2, updated_at = now()
      WHERE user_id = $1 AND NOT uploads_blocked AND used_bytes + reserved_bytes + $2 <= $3
      RETURNING user_id`,
    [userId, bytes, limitBytes],
  );
  if (result.rows[0]) return;
  const meter = await readMeter(db, userId);
  if (meter.uploadsBlocked) throw blockedError(meter.blockReason);
  throw fullError();
}

/** Give back an in-flight reservation (rejected, expired or abandoned upload). */
export async function releaseReservation(db: Queryable, userId: string, bytes: number): Promise<void> {
  await db.query(
    `UPDATE notes.storage SET reserved_bytes = GREATEST(0, reserved_bytes - $2), updated_at = now() WHERE user_id = $1`,
    [userId, bytes],
  );
}

/** A checked upload becomes a file: its reservation turns into real use. */
export async function commitReservation(db: Queryable, userId: string, reservedBytes: number, realBytes: number): Promise<void> {
  await db.query(
    `UPDATE notes.storage
        SET reserved_bytes = GREATEST(0, reserved_bytes - $2), used_bytes = used_bytes + $3, updated_at = now()
      WHERE user_id = $1`,
    [userId, reservedBytes, realBytes],
  );
}

/**
 * Typed notes change size as they are edited. Growing must fit the limit (and
 * respects an uploads block); shrinking always works.
 */
export async function adjustUsedBytes(db: Queryable, userId: string, delta: number, limitBytes: number): Promise<void> {
  if (delta === 0) return;
  await ensureMeter(db, userId);
  if (delta < 0) {
    await db.query(
      `UPDATE notes.storage SET used_bytes = GREATEST(0, used_bytes + $2), updated_at = now() WHERE user_id = $1`,
      [userId, delta],
    );
    return;
  }
  const result = await db.query(
    `UPDATE notes.storage SET used_bytes = used_bytes + $2, updated_at = now()
      WHERE user_id = $1 AND NOT uploads_blocked AND used_bytes + reserved_bytes + $2 <= $3
      RETURNING user_id`,
    [userId, delta, limitBytes],
  );
  if (result.rows[0]) return;
  const meter = await readMeter(db, userId);
  if (meter.uploadsBlocked) throw blockedError(meter.blockReason);
  throw fullError();
}
