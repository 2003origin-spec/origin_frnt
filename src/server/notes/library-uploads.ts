/**
 * Origin Notes — admin file uploads into the shared library (V1/NOTES_PLAN.md §8).
 *
 *   1. ticket   — check type/size, record a pending upload, hand out a signed
 *                 PUT link bound to the declared Content-Type (15 minutes).
 *   2. browser  — PUTs the bytes straight to R2 (Vercel's ~4.5 MB body cap
 *                 rules out sending files through Next.js).
 *   3. complete — read the REAL size and first bytes back from R2, reject
 *                 anything that isn't what was declared, then copy the checked
 *                 object to its final key and delete the upload copy, so a
 *                 second PUT through the same link can't swap the file.
 *
 * Phase 3 (My Notes) reuses this flow with a storage-limit reservation added.
 */

import { bytesMatchMime, extensionMatchesType, fileTypeForMime, LIBRARY_MAX_FILE_BYTES, LIBRARY_UPLOAD_KINDS, MAGIC_SNIFF_BYTES } from "@/lib/notes/file-types";
import { cleanTitle, formatBytes } from "@/lib/notes/rules";
import type { NotesAdminItem } from "@/lib/notes/types";
import { uploadImageToR2 } from "@/server/media-storage";
import { recordAuditEvent } from "@/server/workspaces/audit";

import { getAdminItem, type AdminActor } from "./library-admin";
import { bumpLibraryVersion, createNotesItemId, createNotesUploadId, notesPool, toNumber, withNotesTransaction } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import {
  copyNotesObject,
  deleteNotesObject,
  headNotesObject,
  libraryObjectKey,
  NotesObjectChangedError,
  presignNotesPut,
  readNotesObjectStart,
  uploadObjectKey,
} from "./notes-storage";

const TICKET_SECONDS = 15 * 60;

export type LibraryUploadTicket = {
  uploadId: string;
  uploadUrl: string;
  /** Send exactly these headers with the PUT. */
  headers: Record<string, string>;
  expiresAt: string;
};

export async function createLibraryUpload(
  input: { folderId: string; fileName: string; mime: string; bytes: number; title?: string | null },
  actor: AdminActor,
): Promise<LibraryUploadTicket> {
  const type = fileTypeForMime(input.mime);
  if (!type || !LIBRARY_UPLOAD_KINDS.includes(type.kind)) {
    throw new NotesError(400, "unsupported_type", "Upload a PDF or a photo (JPG, PNG or WebP).");
  }
  if (!extensionMatchesType(input.fileName, type)) {
    throw new NotesError(400, "unsupported_type", `That file name doesn't end in .${type.ext}. Check the file and try again.`);
  }
  if (!Number.isFinite(input.bytes) || input.bytes <= 0) throw new NotesError(400, "empty_file", "That file is empty.");
  if (input.bytes > LIBRARY_MAX_FILE_BYTES) {
    throw new NotesError(413, "too_large", `Files can be up to ${formatBytes(LIBRARY_MAX_FILE_BYTES)}. This one is ${formatBytes(input.bytes)}.`);
  }
  const title = input.title ? cleanTitle(input.title) : null;
  if (title && !title.ok) throw new NotesError(400, "invalid_title", title.error);

  await ensureNotesSchema();
  const folder = await notesPool().query(`SELECT 1 FROM notes.folders WHERE id = $1 AND deleted_at IS NULL`, [input.folderId]);
  if (!folder.rows[0]) throw notFoundError("That folder");

  const uploadId = createNotesUploadId();
  const uploadKey = uploadObjectKey(uploadId);
  // Signing first: if storage isn't configured this throws before any row exists.
  // Bound to this exact size: R2 refuses a body of any other length.
  const uploadUrl = presignNotesPut(uploadKey, type.mime, Math.round(input.bytes), TICKET_SECONDS);
  const expiresAt = new Date(Date.now() + TICKET_SECONDS * 1000);
  await notesPool().query(
    `INSERT INTO notes.uploads (id, scope, user_id, folder_id, upload_key, declared_mime, declared_bytes, original_name, title, expires_at)
     VALUES ($1, 'library', $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      uploadId,
      actor.userId,
      input.folderId,
      uploadKey,
      type.mime,
      Math.round(input.bytes),
      input.fileName.slice(0, 200),
      title?.ok ? title.title : null,
      expiresAt,
    ],
  );
  return { uploadId, uploadUrl, headers: { "Content-Type": type.mime }, expiresAt: expiresAt.toISOString() };
}

async function reject(uploadId: string, uploadKey: string, reason: string, message: string): Promise<never> {
  await notesPool()
    .query(`UPDATE notes.uploads SET status = 'rejected', reject_reason = $2 WHERE id = $1`, [uploadId, reason])
    .catch(() => undefined);
  await deleteNotesObject(uploadKey).catch(() => undefined);
  throw new NotesError(400, reason, message);
}

export async function completeLibraryUpload(
  uploadId: string,
  input: { pageCount?: number | null },
  actor: AdminActor,
): Promise<NotesAdminItem> {
  await ensureNotesSchema();
  const pool = notesPool();
  const found = await pool.query(
    `SELECT id, user_id, folder_id, upload_key, declared_mime, declared_bytes, original_name, title, status, expires_at
       FROM notes.uploads WHERE id = $1 AND scope = 'library'`,
    [uploadId],
  );
  const upload = found.rows[0];
  if (!upload || upload.user_id !== actor.userId) throw notFoundError("That upload");
  if (upload.status !== "pending") throw new NotesError(409, "upload_finished", "This upload was already finished. Upload the file again.");
  const uploadKey = String(upload.upload_key);
  const declaredBytes = toNumber(upload.declared_bytes) ?? 0;
  const type = fileTypeForMime(String(upload.declared_mime));
  if (!type) return reject(uploadId, uploadKey, "unsupported_type", "That file type isn't allowed.");

  const stored = await headNotesObject(uploadKey);
  if (!stored) {
    throw new NotesError(409, "upload_missing", "The file didn't reach storage. Check your connection and upload it again.");
  }
  if (stored.bytes <= 0) return reject(uploadId, uploadKey, "empty_file", "That file is empty.");
  if (stored.bytes !== declaredBytes || stored.bytes > LIBRARY_MAX_FILE_BYTES) {
    return reject(uploadId, uploadKey, "size_mismatch", "The uploaded file isn't the one you picked. Upload it again.");
  }

  const itemId = createNotesItemId();
  const finalKey = libraryObjectKey(itemId, type.ext);
  try {
    // Pinned to the ETag HEAD saw: a file swapped in through the link isn't checked or copied.
    const head = await readNotesObjectStart(uploadKey, MAGIC_SNIFF_BYTES, stored.etag);
    if (!bytesMatchMime(head, type.mime)) {
      return reject(uploadId, uploadKey, "type_mismatch", `That file isn't really a ${type.label.toLowerCase()}. Pick the original file.`);
    }
    await copyNotesObject(uploadKey, finalKey, stored.etag);
  } catch (error) {
    if (error instanceof NotesObjectChangedError) {
      await deleteNotesObject(finalKey).catch(() => undefined);
      return reject(uploadId, uploadKey, "file_changed", "The file changed while it was being checked. Upload it again.");
    }
    throw error;
  }
  await deleteNotesObject(uploadKey).catch((error) =>
    console.error("[notes] upload copy not deleted", error instanceof Error ? error.message : error),
  );

  const originalName = String(upload.original_name ?? "");
  const fallbackTitle = originalName.replace(/\.[^.]+$/u, "").replace(/[_-]+/gu, " ").trim() || type.label;
  const titleCheck = cleanTitle(upload.title ?? fallbackTitle);
  const title = titleCheck.ok ? titleCheck.title : type.label;
  const pageCount =
    type.kind === "pdf" && Number.isInteger(input.pageCount) && (input.pageCount ?? 0) > 0 && (input.pageCount ?? 0) < 10_000
      ? input.pageCount
      : null;

  try {
    await withNotesTransaction(async (client) => {
      const folder = await client.query(`SELECT 1 FROM notes.folders WHERE id = $1 AND deleted_at IS NULL`, [upload.folder_id]);
      if (!folder.rows[0]) throw notFoundError("The folder (it was deleted while uploading)");
      const sort = await client.query(
        `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM notes.items WHERE folder_id = $1 AND deleted_at IS NULL`,
        [upload.folder_id],
      );
      await client.query(
        `INSERT INTO notes.items (id, folder_id, kind, title, file_key, mime, bytes, page_count, original_name, sort_order, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
        [itemId, upload.folder_id, type.kind, title, finalKey, type.mime, stored.bytes, pageCount, originalName.slice(0, 200), toNumber(sort.rows[0]?.next) ?? 10, actor.userId],
      );
      // Only the first "complete" wins: a second one at the same moment can't create a second item.
      const closed = await client.query(
        `UPDATE notes.uploads SET status = 'done', final_key = $2, result_id = $3 WHERE id = $1 AND status = 'pending' RETURNING id`,
        [uploadId, finalKey, itemId],
      );
      if (!closed.rows[0]) throw new NotesError(409, "upload_finished", "This upload was already finished.");
      await bumpLibraryVersion(client);
    });
  } catch (error) {
    // Don't leave an orphaned copy behind if the row could not be written.
    await deleteNotesObject(finalKey).catch(() => undefined);
    throw error;
  }

  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_item",
    entityId: itemId,
    action: "notes.item.upload",
    after: { folderId: upload.folder_id, mime: type.mime, bytes: stored.bytes },
  }).catch(() => undefined);
  return (await getAdminItem(itemId)).item;
}

const DIAGRAM_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Diagram images inside typed notes. Small (the editor shrinks photos first),
 * so they go through this route as multipart and into the PUBLIC image bucket
 * like question images — they carry nothing private, and public URLs let
 * notes render without signing every image.
 */
export async function uploadNoteDiagram(request: Request, actor: AdminActor): Promise<{ url: string }> {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new NotesError(400, "no_file", "Pick an image to upload.");
  if (file.size > DIAGRAM_MAX_BYTES) throw new NotesError(413, "too_large", "Diagrams can be up to 4 MB. Use a smaller image.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const type = fileTypeForMime(file.type);
  if (!type || type.kind !== "image" || !bytesMatchMime(bytes.subarray(0, MAGIC_SNIFF_BYTES), type.mime)) {
    throw new NotesError(400, "unsupported_type", "Upload a JPG, PNG or WebP image.");
  }
  let url: string;
  try {
    const stored = await uploadImageToR2({ userId: actor.userId, purpose: "notes_diagram", fileName: file.name, mimeType: type.mime, body: bytes });
    url = stored.publicUrl;
  } catch (error) {
    console.error("[notes] diagram upload failed", error instanceof Error ? error.message : error);
    throw new NotesError(503, "storage_not_configured", "Image uploads aren't working here (R2 settings missing or R2 refused). Try again later.");
  }
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType: "notes_item",
    entityId: "diagram",
    action: "notes.diagram.upload",
    after: { url, bytes: bytes.length },
  }).catch(() => undefined);
  return { url };
}
