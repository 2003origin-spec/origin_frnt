/**
 * Origin Notes — admin side of sharing (V1/NOTES_PLAN.md §9 "Safety").
 *
 * Reports students made about files a friend shared with them. An admin can
 * open the reported file (audited: it is a student's private file), remove it
 * for good (its shares end, open reports on it close, the owner is told), or
 * block the owner from sharing (Storage tab, `sharingBlocked`).
 */

import { fileTypeForMime, safeDownloadName } from "@/lib/notes/file-types";
import type { MyFileKind } from "@/lib/notes/storage-rules";
import type { SharedReportReason } from "@/lib/notes/types";
import { createNotification } from "@/server/notifications";
import { recordAuditEvent } from "@/server/workspaces/audit";

import type { AdminActor } from "./library-admin";
import { purgeMyBatches } from "./my-notes";
import { notesPool, toIso, toIsoOrNull, toNumber, withNotesTransaction } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import { presignNotesGet } from "./notes-storage";

export type SharedReportView = {
  id: string;
  reason: SharedReportReason;
  message: string | null;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
  reporterName: string | null;
  fileId: string;
  /** Null once the file has been removed for good. */
  file: { title: string; kind: MyFileKind; bytes: number; inBin: boolean } | null;
  owner: { id: string; name: string; username: string | null; sharingBlocked: boolean } | null;
  /** How many open reports this file has in total. */
  openReportsOnFile: number;
  resolutionNote: string | null;
  resolvedAt: string | null;
};

export async function listSharedReports(status: "open" | "closed"): Promise<SharedReportView[]> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT r.id, r.reason, r.message, r.status, r.created_at, r.resolution_note, r.resolved_at, r.target_id,
            rep.name AS reporter_name,
            f.title, f.kind, f.bytes, f.deleted_at,
            COALESCE(f.owner_id, s.owner_id) AS owner_id, o.name AS owner_name, o.username AS owner_username,
            COALESCE(st.sharing_blocked, false) AS sharing_blocked,
            (SELECT COUNT(*) FROM notes.reports x
              WHERE x.target_type = 'shared_file' AND x.target_id = r.target_id AND x.status = 'open') AS open_on_file
       FROM notes.reports r
       LEFT JOIN origin_users rep ON rep.id = r.reporter_id
       LEFT JOIN notes.my_files f ON f.id = r.target_id
       LEFT JOIN notes.shares s ON s.id = r.share_id
       LEFT JOIN origin_users o ON o.id = COALESCE(f.owner_id, s.owner_id)
       LEFT JOIN notes.storage st ON st.user_id = o.id
      WHERE r.target_type = 'shared_file' AND ${status === "open" ? "r.status = 'open'" : "r.status <> 'open'"}
      ORDER BY r.created_at DESC LIMIT 200`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    reason: row.reason as SharedReportReason,
    message: (row.message as string | null) ?? null,
    status: row.status as SharedReportView["status"],
    createdAt: toIso(row.created_at),
    reporterName: (row.reporter_name as string | null) ?? null,
    fileId: String(row.target_id),
    file: row.title
      ? { title: String(row.title), kind: row.kind as MyFileKind, bytes: toNumber(row.bytes) ?? 0, inBin: row.deleted_at !== null }
      : null,
    owner: row.owner_id
      ? {
          id: String(row.owner_id),
          name: String(row.owner_name ?? "Student"),
          username: (row.owner_username as string | null) ?? null,
          sharingBlocked: Boolean(row.sharing_blocked),
        }
      : null,
    openReportsOnFile: toNumber(row.open_on_file) ?? 0,
    resolutionNote: (row.resolution_note as string | null) ?? null,
    resolvedAt: toIsoOrNull(row.resolved_at),
  }));
}

async function reportedFile(reportId: string) {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT r.id AS report_id, f.id, f.owner_id, f.title, f.kind, f.mime, f.original_name, f.file_key, f.body_md
       FROM notes.reports r
       JOIN notes.my_files f ON f.id = r.target_id
      WHERE r.id = $1 AND r.target_type = 'shared_file'`,
    [reportId],
  );
  const row = result.rows[0];
  if (!row) throw notFoundError("That reported file");
  return row;
}

/**
 * Open a reported file so an admin can judge it. A student's private file, so
 * every open is audited. Typed notes come back as text; files as a short link.
 */
export async function openReportedFile(
  reportId: string,
  actor: AdminActor,
): Promise<{ title: string; kind: MyFileKind; bodyMd: string | null; url: string | null }> {
  const row = await reportedFile(reportId);
  let url: string | null = null;
  if (row.kind !== "typed") {
    const type = fileTypeForMime(String(row.mime ?? ""));
    if (!type || !row.file_key) throw notFoundError("That reported file");
    url = presignNotesGet(String(row.file_key), {
      contentType: type.mime,
      fileName: safeDownloadName((row.original_name as string | null) || String(row.title), type),
      download: !type.previewable,
      expiresSeconds: 300,
    });
  }
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_my_file",
    entityId: String(row.id),
    action: "notes.shared_report.open",
    after: { reportId, ownerId: String(row.owner_id) },
  }).catch(() => undefined);
  return {
    title: String(row.title),
    kind: row.kind as MyFileKind,
    bodyMd: row.kind === "typed" ? String(row.body_md ?? "") : null,
    url,
  };
}

/**
 * Remove a reported file for good: every share of it ends, the file and its
 * stored copy are deleted (space given back), every open report on it is
 * closed as resolved, and the owner gets a notification.
 */
export async function removeReportedFile(reportId: string, note: string | null, actor: AdminActor): Promise<void> {
  const row = await reportedFile(reportId);
  const fileId = String(row.id);
  const ownerId = String(row.owner_id);
  const cleanNote = note?.replace(/\s+/gu, " ").trim().slice(0, 1000) || null;

  // Send it to the Bin as its own batch (so the purge takes exactly this file), then purge.
  await withNotesTransaction(async (client) => {
    await client.query(`SELECT pg_advisory_xact_lock(4243, hashtext($1))`, [ownerId]);
    await client.query(
      `UPDATE notes.my_files SET deleted_at = COALESCE(deleted_at, now()), deleted_batch = id WHERE id = $1 AND owner_id = $2`,
      [fileId, ownerId],
    );
    await client.query(
      `UPDATE notes.shares SET revoked_at = now(), revoked_by = $3
        WHERE owner_id = $1 AND target_type = 'file' AND target_id = $2 AND revoked_at IS NULL`,
      [ownerId, fileId, actor.userId],
    );
  });
  await purgeMyBatches(ownerId, [fileId]);
  const left = await notesPool().query(`SELECT 1 FROM notes.my_files WHERE id = $1`, [fileId]);
  if (left.rows[0]) {
    // The owner restored it from the Bin at that exact moment.
    throw new NotesError(409, "file_changed", "The student changed this file just now. Try again.");
  }

  await notesPool().query(
    `UPDATE notes.reports SET status = 'resolved', resolution_note = $2, resolved_by = $3, resolved_at = now()
      WHERE target_type = 'shared_file' AND target_id = $1 AND status = 'open'`,
    [fileId, cleanNote ?? "File removed", actor.userId],
  );
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_my_file",
    entityId: fileId,
    action: "notes.shared_file.remove",
    before: { title: String(row.title), ownerId },
    after: { reportId, note: cleanNote },
  }).catch(() => undefined);
  await createNotification(ownerId, {
    type: "warning",
    title: "A shared file was removed",
    message: `“${String(row.title)}” was removed by the Origin team because it broke the rules for sharing notes.`,
    href: "/notes?tab=mine",
  });
}
