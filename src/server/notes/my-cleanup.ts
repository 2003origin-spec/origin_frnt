/**
 * Origin Notes — the daily cleanup (V1/NOTES_PLAN.md §7 "Cron").
 *
 *   1. once an upload link has expired, delete its upload copy (whatever the
 *      ticket's status: a finished link could still be re-used until then),
 *      and expire tickets nobody finished, giving their space back;
 *   2. remove Bin items older than the Bin days, files included;
 *   3. remove the files of accounts marked deleted;
 *   4. recount every meter from the file rows, so any drift is corrected.
 *
 * Idempotent and bounded per run, so it is safe to run again at any time.
 */

import { notesPool, toNumber, withNotesTransaction } from "./notes-db";
import { ensureNotesSchema } from "./notes-schema";
import { deleteNotesObject, isNotesStorageConfigured } from "./notes-storage";
import { lockOwner, purgeMyBatches } from "./my-notes";
import { getNotesSettings } from "./my-settings";
import { releaseReservation } from "./my-storage";

/** Grace after a ticket's own expiry, so a PUT that is just finishing isn't cut off. */
const EXPIRY_GRACE_MINUTES = 10;
const BATCH = 500;
/** Students recounted per transaction (each holds a lock, so keep it modest). */
const RECOUNT_BATCH = 100;

export type NotesCleanupResult = {
  expiredUploads: number;
  releasedBytes: number;
  /** Upload copies deleted after their link expired (any ticket status). */
  clearedUploadCopies: number;
  binBatchesRemoved: number;
  binBytesFreed: number;
  deletedAccounts: number;
  metersCorrected: number;
  /** Students whose cleanup failed this run (logged; retried next run). */
  studentsSkipped: number;
};

/**
 * Every upload link whose time is up gets its upload copy deleted once —
 * whatever happened to the ticket. A finished or cancelled ticket's link
 * still worked until it expired, so a re-PUT could have left a file there.
 * Pending tickets are also expired and their reserved space given back.
 */
async function clearExpiredUploads(): Promise<{ count: number; bytes: number; cleared: number }> {
  const rows = await withNotesTransaction(async (client) => {
    const due = await client.query(
      `SELECT id, scope, user_id, upload_key, declared_bytes, status FROM notes.uploads
        WHERE cleared_at IS NULL AND expires_at < now() - make_interval(mins => $1)
        ORDER BY expires_at LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [EXPIRY_GRACE_MINUTES, BATCH],
    );
    // Lock order matches "complete" (upload row, then meter), so the two can't deadlock.
    for (const row of due.rows) {
      if (row.status === "pending" && row.scope === "personal") {
        await releaseReservation(client, String(row.user_id), toNumber(row.declared_bytes) ?? 0);
      }
    }
    await client.query(
      `UPDATE notes.uploads SET status = CASE WHEN status = 'pending' THEN 'expired' ELSE status END, cleared_at = now()
        WHERE id = ANY($1::text[])`,
      [due.rows.map((row) => String(row.id))],
    );
    return due.rows;
  });
  if (isNotesStorageConfigured()) {
    for (const row of rows) {
      await deleteNotesObject(String(row.upload_key)).catch(() => undefined);
    }
  }
  const expired = rows.filter((row) => row.status === "pending");
  const bytes = expired.filter((row) => row.scope === "personal").reduce((sum, row) => sum + (toNumber(row.declared_bytes) ?? 0), 0);
  return { count: expired.length, bytes, cleared: rows.length };
}

/** One owner's failure (a timeout, a bad row) is logged and skipped, never stopping the run. */
async function eachOwner(owners: Map<string, string[]>, work: (owner: string, ids: string[]) => Promise<number>): Promise<{ total: number; failed: number }> {
  let total = 0;
  let failed = 0;
  for (const [owner, ids] of owners) {
    try {
      total += await work(owner, ids);
    } catch (error) {
      failed += 1;
      console.error("[notes] cleanup skipped one student", owner, error instanceof Error ? error.message : error);
    }
  }
  return { total, failed };
}

async function purgeOldBin(binDays: number): Promise<{ batches: number; bytes: number; failed: number }> {
  const roots = await notesPool().query(
    `SELECT owner_id, id FROM notes.my_folders
      WHERE deleted_at IS NOT NULL AND deleted_batch = id AND deleted_at < now() - make_interval(days => $1)
     UNION ALL
     SELECT owner_id, id FROM notes.my_files
      WHERE deleted_at IS NOT NULL AND deleted_batch = id AND deleted_at < now() - make_interval(days => $1)
     LIMIT $2`,
    [binDays, BATCH],
  );
  const byOwner = new Map<string, string[]>();
  for (const row of roots.rows) {
    const owner = String(row.owner_id);
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), String(row.id)]);
  }
  const { total, failed } = await eachOwner(byOwner, async (owner, ids) => (await purgeMyBatches(owner, ids)).bytes);
  return { batches: roots.rows.length, bytes: total, failed };
}

async function purgeDeletedAccounts(): Promise<{ accounts: number; failed: number }> {
  const accounts = await notesPool().query(
    `SELECT DISTINCT u.id FROM origin_users u
      WHERE u.account_status = 'deleted'
        AND (EXISTS (SELECT 1 FROM notes.my_files f WHERE f.owner_id = u.id)
             OR EXISTS (SELECT 1 FROM notes.my_folders d WHERE d.owner_id = u.id))
      LIMIT 50`,
  );
  const owners = new Map(accounts.rows.map((row) => [String(row.id), [] as string[]]));
  const { total, failed } = await eachOwner(owners, async (owner) => {
    // Send everything to the Bin (top items become batch roots), then remove it for good.
    await withNotesTransaction(async (client) => {
      await lockOwner(client, owner);
      await client.query(
        `UPDATE notes.my_folders SET deleted_at = COALESCE(deleted_at, now()),
                deleted_batch = CASE WHEN parent_id IS NULL THEN id ELSE COALESCE(deleted_batch, id) END
          WHERE owner_id = $1`,
        [owner],
      );
      await client.query(
        `UPDATE notes.my_files SET deleted_at = COALESCE(deleted_at, now()),
                deleted_batch = CASE WHEN folder_id IS NULL THEN id ELSE COALESCE(deleted_batch, id) END
          WHERE owner_id = $1`,
        [owner],
      );
    });
    const roots = await notesPool().query(
      `SELECT id FROM notes.my_folders WHERE owner_id = $1 AND deleted_batch = id
       UNION ALL SELECT id FROM notes.my_files WHERE owner_id = $1 AND deleted_batch = id`,
      [owner],
    );
    await purgeMyBatches(owner, roots.rows.map((r) => String(r.id)));
    await notesPool().query(`DELETE FROM notes.storage WHERE user_id = $1`, [owner]);
    return 1;
  });
  return { accounts: total, failed };
}

/**
 * Recount used (files incl. Bin) and reserved (live tickets), a batch of
 * students at a time. Each student's lock and meter row are held while their
 * numbers are counted and written, so a ticket made at the same moment is
 * either fully counted or not started — never wiped.
 */
async function recountMeters(): Promise<number> {
  const users = await notesPool().query(`SELECT user_id FROM notes.storage ORDER BY user_id`);
  let corrected = 0;
  for (let i = 0; i < users.rows.length; i += RECOUNT_BATCH) {
    const ids = users.rows.slice(i, i + RECOUNT_BATCH).map((row) => String(row.user_id));
    corrected += await withNotesTransaction(async (client) => {
      for (const id of ids) await lockOwner(client, id);
      await client.query(`SELECT user_id FROM notes.storage WHERE user_id = ANY($1::text[]) ORDER BY user_id FOR UPDATE`, [ids]);
      const result = await client.query(
        `WITH used AS (
           SELECT owner_id, SUM(bytes) AS used FROM notes.my_files WHERE owner_id = ANY($1::text[]) GROUP BY owner_id
         ), reserved AS (
           SELECT user_id, SUM(declared_bytes) AS reserved FROM notes.uploads
            WHERE user_id = ANY($1::text[]) AND scope = 'personal' AND status = 'pending' GROUP BY user_id
         )
         UPDATE notes.storage s
            SET used_bytes = COALESCE(u.used, 0), reserved_bytes = COALESCE(r.reserved, 0), updated_at = now()
           FROM notes.storage s2
           LEFT JOIN used u ON u.owner_id = s2.user_id
           LEFT JOIN reserved r ON r.user_id = s2.user_id
          WHERE s.user_id = s2.user_id AND s.user_id = ANY($1::text[])
            AND (s.used_bytes <> COALESCE(u.used, 0) OR s.reserved_bytes <> COALESCE(r.reserved, 0))
          RETURNING s.user_id`,
        [ids],
      );
      return result.rows.length;
    });
  }
  return corrected;
}

export async function runNotesCleanup(): Promise<NotesCleanupResult> {
  await ensureNotesSchema();
  const settings = await getNotesSettings();
  const uploads = await clearExpiredUploads();
  const bin = await purgeOldBin(settings.binDays);
  const deleted = await purgeDeletedAccounts();
  const metersCorrected = await recountMeters();
  return {
    expiredUploads: uploads.count,
    releasedBytes: uploads.bytes,
    clearedUploadCopies: uploads.cleared,
    binBatchesRemoved: bin.batches,
    binBytesFreed: bin.bytes,
    deletedAccounts: deleted.accounts,
    metersCorrected,
    studentsSkipped: bin.failed + deleted.failed,
  };
}
