/**
 * Origin Notes — My Notes uploads (V1/NOTES_PLAN.md §8).
 *
 *   1. ticket   — check the switches, type, size and the student's limit, and
 *                 RESERVE the space in one conditional UPDATE; hand out a
 *                 signed PUT link bound to the declared Content-Type.
 *   2. browser  — PUTs the bytes straight to the private bucket.
 *   3. complete — read the real size and first bytes back, reject anything
 *                 that isn't what was declared (the reservation is released and
 *                 the object deleted), copy the checked object to its final key,
 *                 then turn the reservation into real use.
 *
 * A reservation is released exactly once: only the request that moves the
 * upload row out of `pending` gives the space back. Tickets nobody finishes
 * are expired by the daily cleanup (my-cleanup.ts).
 */

import {
  bytesMatchMime,
  extensionMatchesType,
  fileTypeForMime,
  MAGIC_SNIFF_BYTES,
  safeDownloadName,
} from "@/lib/notes/file-types";
import type { MyFileCard, MyUploadTicket } from "@/lib/notes/my-types";
import { cleanTitle, formatBytes } from "@/lib/notes/rules";
import { maxBytesForKind, PERSONAL_UPLOAD_KINDS, VOICE_MAX_SECONDS } from "@/lib/notes/storage-rules";

import { createMyFileId, createNotesUploadId, notesPool, toNumber, withNotesTransaction } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import {
  copyNotesObject,
  deleteNotesObject,
  headNotesObject,
  NotesObjectChangedError,
  presignNotesGet,
  presignNotesPut,
  readNotesObjectStart,
  uploadObjectKey,
} from "./notes-storage";
import { mapMyFile, type MyViewer } from "./my-notes";
import { blockedError, commitReservation, getStudentLimits, releaseReservation, reserveBytes } from "./my-storage";
import { assertFileRoom, lockOwner } from "./my-notes";

const TICKET_SECONDS = 15 * 60;

/** Where a student's checked file lives: notes/personal/<userId>/<fileId>.<ext>. */
export function personalObjectKey(userId: string, fileId: string, ext: string): string {
  return `notes/personal/${userId}/${fileId}.${ext}`;
}

const KIND_WORDS: Record<string, string> = {
  pdf: "PDFs",
  image: "photos",
  office: "Word and PowerPoint files",
  audio: "voice notes and audio",
  video: "videos",
};

export async function createMyUpload(
  viewer: MyViewer,
  input: { folderId: string | null; fileName: string; mime: string; bytes: number; title?: string | null },
): Promise<MyUploadTicket> {
  const type = fileTypeForMime(input.mime);
  if (!type || !PERSONAL_UPLOAD_KINDS.includes(type.kind)) {
    throw new NotesError(400, "unsupported_type", "That kind of file can't go in My Notes. Use a PDF, photo, Word, PowerPoint, audio or video file.");
  }
  if (!extensionMatchesType(input.fileName, type)) {
    throw new NotesError(400, "unsupported_type", `That file name doesn't end in .${type.ext}. Check the file and try again.`);
  }
  if (!Number.isFinite(input.bytes) || input.bytes <= 0) throw new NotesError(400, "empty_file", "That file is empty.");
  const title = input.title ? cleanTitle(input.title) : null;
  if (title && !title.ok) throw new NotesError(400, "invalid_title", title.error);

  await ensureNotesSchema();
  const { settings, meter, limitBytes } = await getStudentLimits(viewer.userId);
  if (!settings.uploadsEnabled) throw new NotesError(503, "uploads_off", "Uploads are paused for a while. Please try again later.");
  if (meter.uploadsBlocked) throw blockedError(meter.blockReason);
  if (!settings.allowedKinds.includes(type.kind)) {
    throw new NotesError(400, "kind_off", `Uploading ${KIND_WORDS[type.kind] ?? "this kind of file"} is turned off right now.`);
  }
  const maxBytes = maxBytesForKind(type.kind, settings);
  if (input.bytes > maxBytes) {
    throw new NotesError(413, "too_large", `${type.label} files can be up to ${formatBytes(maxBytes)}. This one is ${formatBytes(input.bytes)}.`);
  }
  if (input.folderId) {
    const folder = await notesPool().query(
      `SELECT 1 FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
      [input.folderId, viewer.userId],
    );
    if (!folder.rows[0]) throw notFoundError("That folder");
  }
  await assertFileRoom(notesPool(), viewer.userId);

  const uploadId = createNotesUploadId();
  const uploadKey = uploadObjectKey(uploadId);
  // Sign first: if storage isn't configured this throws before anything is reserved.
  const bytes = Math.round(input.bytes);
  // The link is bound to this exact size: R2 refuses a body of any other length.
  const uploadUrl = presignNotesPut(uploadKey, type.mime, bytes, TICKET_SECONDS);
  const expiresAt = new Date(Date.now() + TICKET_SECONDS * 1000);
  // Reserve and record the ticket together, so the nightly recount never sees
  // reserved space without its ticket (or the other way round).
  await withNotesTransaction(async (client) => {
    await reserveBytes(viewer.userId, bytes, limitBytes, client);
    await client.query(
      `INSERT INTO notes.uploads (id, scope, user_id, folder_id, upload_key, declared_mime, declared_bytes, original_name, title, expires_at)
       VALUES ($1, 'personal', $2, $3, $4, $5, $6, $7, $8, $9)`,
      [uploadId, viewer.userId, input.folderId, uploadKey, type.mime, bytes, input.fileName.slice(0, 200), title?.ok ? title.title : null, expiresAt],
    );
  });
  return { uploadId, uploadUrl, headers: { "Content-Type": type.mime }, expiresAt: expiresAt.toISOString() };
}

/** Moves a pending upload to `status` and gives its space back — once. */
async function closeUpload(uploadId: string, userId: string, status: "rejected" | "expired", reason: string | null): Promise<void> {
  await withNotesTransaction(async (client) => {
    const closed = await client.query(
      `UPDATE notes.uploads SET status = $3, reject_reason = $4 WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING declared_bytes`,
      [uploadId, userId, status, reason],
    );
    if (closed.rows[0]) await releaseReservation(client, userId, toNumber(closed.rows[0].declared_bytes) ?? 0);
  });
}

async function reject(viewer: MyViewer, uploadId: string, uploadKey: string, code: string, message: string): Promise<never> {
  await closeUpload(uploadId, viewer.userId, "rejected", code).catch(() => undefined);
  await deleteNotesObject(uploadKey).catch(() => undefined);
  throw new NotesError(400, code, message);
}

/** Cancels an upload the student gave up on, so the space comes back at once. */
export async function cancelMyUpload(viewer: MyViewer, uploadId: string): Promise<void> {
  await ensureNotesSchema();
  const found = await notesPool().query(
    `SELECT upload_key FROM notes.uploads WHERE id = $1 AND user_id = $2 AND scope = 'personal' AND status = 'pending'`,
    [uploadId, viewer.userId],
  );
  if (!found.rows[0]) return;
  await closeUpload(uploadId, viewer.userId, "rejected", "cancelled");
  await deleteNotesObject(String(found.rows[0].upload_key)).catch(() => undefined);
}

export async function completeMyUpload(
  viewer: MyViewer,
  uploadId: string,
  input: { pageCount?: number | null; durationS?: number | null },
): Promise<MyFileCard> {
  await ensureNotesSchema();
  const found = await notesPool().query(
    `SELECT id, folder_id, upload_key, declared_mime, declared_bytes, original_name, title, status, expires_at
       FROM notes.uploads WHERE id = $1 AND user_id = $2 AND scope = 'personal'`,
    [uploadId, viewer.userId],
  );
  const upload = found.rows[0];
  if (!upload) throw notFoundError("That upload");
  if (upload.status !== "pending") throw new NotesError(409, "upload_finished", "This upload was already finished. Upload the file again.");
  const uploadKey = String(upload.upload_key);
  if (new Date(upload.expires_at as string | Date).getTime() < Date.now()) {
    await closeUpload(uploadId, viewer.userId, "expired", null);
    await deleteNotesObject(uploadKey).catch(() => undefined);
    throw new NotesError(410, "upload_expired", "This upload took too long and expired. Upload the file again.");
  }
  const declaredBytes = toNumber(upload.declared_bytes) ?? 0;
  const type = fileTypeForMime(String(upload.declared_mime));
  if (!type) return reject(viewer, uploadId, uploadKey, "unsupported_type", "That file type isn't allowed.");

  // A pause, a block or a type switched off after the ticket was issued still applies.
  const { settings, meter } = await getStudentLimits(viewer.userId);
  if (!settings.uploadsEnabled) return reject(viewer, uploadId, uploadKey, "uploads_off", "Uploads are paused for a while. Please try again later.");
  if (meter.uploadsBlocked) return reject(viewer, uploadId, uploadKey, "uploads_blocked", blockedError(meter.blockReason).message);
  if (!settings.allowedKinds.includes(type.kind)) {
    return reject(viewer, uploadId, uploadKey, "kind_off", `Uploading ${KIND_WORDS[type.kind] ?? "this kind of file"} is turned off right now.`);
  }

  const stored = await headNotesObject(uploadKey);
  // Not there yet: keep the ticket (and the space) so the student can retry the PUT.
  if (!stored) throw new NotesError(409, "upload_missing", "The file didn't reach storage. Check your connection and try again.");
  if (stored.bytes <= 0) return reject(viewer, uploadId, uploadKey, "empty_file", "That file is empty.");
  if (stored.bytes !== declaredBytes) {
    return reject(viewer, uploadId, uploadKey, "size_mismatch", "The uploaded file isn't the one you picked. Upload it again.");
  }

  const fileId = createMyFileId();
  const finalKey = personalObjectKey(viewer.userId, fileId, type.ext);
  try {
    // Both reads are pinned to the ETag HEAD saw, so a file swapped in through
    // the still-valid upload link is never checked or copied in its place.
    const head = await readNotesObjectStart(uploadKey, MAGIC_SNIFF_BYTES, stored.etag);
    if (!bytesMatchMime(head, type.mime)) {
      return reject(viewer, uploadId, uploadKey, "type_mismatch", `That file isn't really a ${type.label.toLowerCase()} file. Pick the original file.`);
    }
    await copyNotesObject(uploadKey, finalKey, stored.etag);
  } catch (error) {
    if (error instanceof NotesObjectChangedError) {
      await deleteNotesObject(finalKey).catch(() => undefined);
      return reject(viewer, uploadId, uploadKey, "file_changed", "The file changed while it was being checked. Upload it again.");
    }
    throw error;
  }
  const copied = await headNotesObject(finalKey);
  if (!copied || copied.bytes !== stored.bytes) {
    await deleteNotesObject(finalKey).catch(() => undefined);
    return reject(viewer, uploadId, uploadKey, "file_changed", "The file changed while it was being checked. Upload it again.");
  }
  await deleteNotesObject(uploadKey).catch((error) =>
    console.error("[notes] upload copy not deleted", error instanceof Error ? error.message : error),
  );

  const originalName = String(upload.original_name ?? "");
  const fallbackTitle = originalName.replace(/\.[^.]+$/u, "").replace(/[_-]+/gu, " ").trim() || type.label;
  const titleCheck = cleanTitle(upload.title ?? fallbackTitle);
  const title = titleCheck.ok ? titleCheck.title : type.label;
  const pageCount =
    type.kind === "pdf" && Number.isInteger(input.pageCount) && (input.pageCount ?? 0) > 0 && (input.pageCount ?? 0) < 10_000 ? input.pageCount : null;
  const durationS =
    (type.kind === "audio" || type.kind === "video") && Number.isFinite(input.durationS) && (input.durationS ?? 0) > 0
      ? Math.min(Math.round(input.durationS ?? 0), type.kind === "audio" ? VOICE_MAX_SECONDS * 4 : 24 * 3600)
      : null;

  try {
    return await withNotesTransaction(async (client) => {
      // Same lock as folder deletes, so the folder can't go to the Bin between this check and the insert.
      await lockOwner(client, viewer.userId);
      const closed = await client.query(
        `UPDATE notes.uploads SET status = 'done', final_key = $3, result_id = $4 WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
        [uploadId, viewer.userId, finalKey, fileId],
      );
      if (!closed.rows[0]) throw new NotesError(409, "upload_finished", "This upload was already finished.");
      // The folder may have gone to the Bin meanwhile: then the file lands at the top level.
      const folder = upload.folder_id
        ? await client.query(`SELECT 1 FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [upload.folder_id, viewer.userId])
        : null;
      const folderId = folder?.rows[0] ? String(upload.folder_id) : null;
      await commitReservation(client, viewer.userId, declaredBytes, stored.bytes);
      const inserted = await client.query(
        `INSERT INTO notes.my_files (id, owner_id, folder_id, kind, title, original_name, file_key, mime, bytes, page_count, duration_s)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, title, kind, mime, bytes, page_count, duration_s, original_name, folder_id, updated_at`,
        [fileId, viewer.userId, folderId, type.kind, title, originalName.slice(0, 200), finalKey, type.mime, stored.bytes, pageCount, durationS],
      );
      return mapMyFile(inserted.rows[0]);
    });
  } catch (error) {
    // Don't leave an orphaned copy behind if the row could not be written.
    await deleteNotesObject(finalKey).catch(() => undefined);
    throw error;
  }
}

/** Short-lived link to one of the student's own files. Office files always download. */
export async function getMyFileUrl(viewer: MyViewer, fileId: string, download: boolean): Promise<string> {
  await ensureNotesSchema();
  const found = await notesPool().query(
    `SELECT kind, title, original_name, file_key, mime FROM notes.my_files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [fileId, viewer.userId],
  );
  const row = found.rows[0];
  if (!row || !row.file_key) throw notFoundError("That file");
  const type = fileTypeForMime(String(row.mime));
  if (!type) throw notFoundError("That file");
  return presignNotesGet(String(row.file_key), {
    contentType: type.mime,
    fileName: safeDownloadName((row.original_name as string | null) || String(row.title), type),
    download: download || !type.previewable,
    // Video seeks keep fetching ranges, so its link lives longer (plan §10).
    expiresSeconds: type.kind === "video" ? 3600 : 600,
  });
}
