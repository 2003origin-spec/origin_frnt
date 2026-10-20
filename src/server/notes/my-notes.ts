/**
 * Origin Notes — My Notes: each student's own folders, typed notes and files
 * (V1/NOTES_PLAN.md §3 "My Notes", §6, §7).
 *
 * Ownership: every query filters by `owner_id = viewer.userId`, and the id
 * always comes from the session, never from the request (§10). Another
 * student's folder or file id answers "not found", exactly like a missing one.
 *
 * Bin: deleting marks the item (and, for a folder, everything inside it) with
 * `deleted_at` and a `deleted_batch` = the id that was deleted. The Bin lists
 * batch roots; restore clears a batch; removing for good deletes the rows,
 * then the stored files, and gives the space back. Bin items keep counting
 * against storage until then (as in Google Drive).
 */

import type { PoolClient } from "pg";

import { fileTypeForMime } from "@/lib/notes/file-types";
import type {
  MyBinEntry,
  MyBinPayload,
  MyCrumb,
  MyFileCard,
  MyFilePayload,
  MyFolderCard,
  MyFolderPayload,
  MySearchHit,
} from "@/lib/notes/my-types";
import { cleanFolderName, cleanTitle } from "@/lib/notes/rules";
import {
  billedTypedNoteBytes,
  binExpiresAt,
  MAX_MY_FILES,
  MAX_MY_FOLDERS,
  MY_FOLDER_MAX_DEPTH,
  TYPED_NOTE_MAX_BYTES,
  typedNoteBytes,
  type MyFileKind,
} from "@/lib/notes/storage-rules";

import { likePattern } from "./library-store";
import { createMyFileId, createMyFolderId, notesPool, toIso, toNumber, withNotesTransaction } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import { deleteNotesObject } from "./notes-storage";
import { getNotesSettings } from "./my-settings";
import { adjustUsedBytes, getStorageSummary, getStudentLimits } from "./my-storage";

export type MyViewer = { userId: string };

type Queryable = Pick<PoolClient, "query">;

const SEARCH_LIMIT = 40;
/** A folder shows at most this many files (MAX_MY_FILES bounds the whole account). */
const LIST_LIMIT = 1000;
/** Recursive folder walks stop here even if the data were ever corrupt (depth limit is 8). */
const WALK_LIMIT = 20;

/** Card columns: never the note text, which can be 200 KB each. */
export const CARD_COLUMNS = `id, title, kind, mime, bytes, page_count, duration_s, original_name, folder_id, updated_at, version`;
export const FILE_COLUMNS = `${CARD_COLUMNS}, body_md`;

/** pg_advisory_xact_lock class for My Notes (one lock per student). */
const OWNER_LOCK_CLASS = 4243;

/**
 * Serialises every My Notes write of one student (moves, deletes, restores,
 * purges, new notes and finished uploads). Checks like "can this folder move
 * there?" or "is this folder still live?" then can't race each other.
 */
export async function lockOwner(db: Queryable, ownerId: string): Promise<void> {
  await db.query(`SELECT pg_advisory_xact_lock($1, hashtext($2))`, [OWNER_LOCK_CLASS, ownerId]);
}

/** Refuses a new file once the student keeps MAX_MY_FILES (Bin included). */
export async function assertFileRoom(db: Queryable, ownerId: string): Promise<void> {
  const count = await db.query(`SELECT COUNT(*) AS n FROM notes.my_files WHERE owner_id = $1`, [ownerId]);
  if ((toNumber(count.rows[0]?.n) ?? 0) >= MAX_MY_FILES) {
    throw new NotesError(400, "too_many_files", `You can keep up to ${MAX_MY_FILES} files, Bin included. Empty the Bin or delete some you don't need.`);
  }
}

export function mapMyFile(row: Record<string, unknown>): MyFileCard {
  return {
    id: String(row.id),
    title: String(row.title),
    kind: String(row.kind) as MyFileKind,
    mime: (row.mime as string | null) ?? null,
    bytes: toNumber(row.bytes) ?? 0,
    pageCount: toNumber(row.page_count),
    durationS: toNumber(row.duration_s),
    originalName: (row.original_name as string | null) ?? null,
    folderId: (row.folder_id as string | null) ?? null,
    updatedAt: toIso(row.updated_at),
  };
}

const missingFolder = () => notFoundError("That folder");
const missingFile = () => notFoundError("That note or file");

async function liveFolder(db: Queryable, ownerId: string, folderId: string) {
  const result = await db.query(
    `SELECT id, name, parent_id FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [folderId, ownerId],
  );
  const row = result.rows[0];
  if (!row) throw missingFolder();
  return { id: String(row.id), name: String(row.name), parentId: (row.parent_id as string | null) ?? null };
}

/** Root → folder, live folders only. */
export async function myBreadcrumb(db: Queryable, ownerId: string, folderId: string | null): Promise<MyCrumb[]> {
  if (!folderId) return [];
  const result = await db.query(
    `WITH RECURSIVE up AS (
       SELECT id, name, parent_id, 0 AS depth FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
       UNION ALL
       SELECT f.id, f.name, f.parent_id, up.depth + 1 FROM notes.my_folders f JOIN up ON f.id = up.parent_id
        WHERE f.owner_id = $2 AND f.deleted_at IS NULL AND up.depth < 20
     )
     SELECT id, name FROM up ORDER BY depth DESC`,
    [folderId, ownerId],
  );
  return result.rows.map((row) => ({ id: String(row.id), name: String(row.name) }));
}

/** How many folder levels sit under `folderId`, counting itself (a leaf is 1). */
async function subtreeHeight(db: Queryable, ownerId: string, folderId: string): Promise<number> {
  const result = await db.query(
    `WITH RECURSIVE down AS (
       SELECT id, 1 AS level FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
       UNION ALL
       SELECT f.id, down.level + 1 FROM notes.my_folders f JOIN down ON f.parent_id = down.id
        WHERE f.owner_id = $2 AND f.deleted_at IS NULL AND down.level < 20
     )
     SELECT COALESCE(MAX(level), 0) AS height FROM down`,
    [folderId, ownerId],
  );
  return toNumber(result.rows[0]?.height) ?? 0;
}

async function liveSubtreeIds(db: Queryable, ownerId: string, folderId: string): Promise<string[]> {
  const result = await db.query(
    `WITH RECURSIVE down AS (
       SELECT id, 1 AS level FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
       UNION ALL
       SELECT f.id, down.level + 1 FROM notes.my_folders f JOIN down ON f.parent_id = down.id
        WHERE f.owner_id = $2 AND f.deleted_at IS NULL AND down.level < $3
     )
     SELECT DISTINCT id FROM down`,
    [folderId, ownerId, WALK_LIMIT],
  );
  return result.rows.map((row) => String(row.id));
}

// ── Reading ────────────────────────────────────────────────────────────────

export async function getMyFolder(viewer: MyViewer, folderId: string | null): Promise<MyFolderPayload> {
  await ensureNotesSchema();
  const db = notesPool();
  const folder = folderId ? await liveFolder(db, viewer.userId, folderId) : null;
  const [folders, files, breadcrumb, storage] = await Promise.all([
    db.query(
      `SELECT f.id, f.name, f.updated_at,
              (SELECT COUNT(*) FROM notes.my_folders c WHERE c.parent_id = f.id AND c.deleted_at IS NULL) AS folder_count,
              (SELECT COUNT(*) FROM notes.my_files x WHERE x.folder_id = f.id AND x.deleted_at IS NULL) AS file_count
         FROM notes.my_folders f
        WHERE f.owner_id = $1 AND f.deleted_at IS NULL AND f.parent_id IS NOT DISTINCT FROM $2
        ORDER BY lower(f.name) LIMIT $3`,
      [viewer.userId, folderId, LIST_LIMIT],
    ),
    db.query(
      `SELECT ${CARD_COLUMNS} FROM notes.my_files
        WHERE owner_id = $1 AND deleted_at IS NULL AND folder_id IS NOT DISTINCT FROM $2
        ORDER BY updated_at DESC LIMIT $3`,
      [viewer.userId, folderId, LIST_LIMIT],
    ),
    myBreadcrumb(db, viewer.userId, folderId),
    getStorageSummary(viewer.userId),
  ]);
  return {
    folder,
    breadcrumb,
    folders: folders.rows.map(
      (row): MyFolderCard => ({
        id: String(row.id),
        name: String(row.name),
        folderCount: toNumber(row.folder_count) ?? 0,
        fileCount: toNumber(row.file_count) ?? 0,
        updatedAt: toIso(row.updated_at),
      }),
    ),
    files: files.rows.map(mapMyFile),
    storage,
  };
}

export async function getMyFile(viewer: MyViewer, fileId: string): Promise<MyFilePayload> {
  await ensureNotesSchema();
  const db = notesPool();
  const result = await db.query(
    `SELECT ${FILE_COLUMNS} FROM notes.my_files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [fileId, viewer.userId],
  );
  const row = result.rows[0];
  if (!row) throw missingFile();
  const card = mapMyFile(row);
  const type = card.mime ? fileTypeForMime(card.mime) : null;
  return {
    ...card,
    breadcrumb: await myBreadcrumb(db, viewer.userId, card.folderId),
    bodyMd: card.kind === "typed" ? String(row.body_md ?? "") : null,
    version: toNumber(row.version) ?? 1,
    previewable: card.kind === "typed" || Boolean(type?.previewable),
  };
}

export async function searchMyNotes(viewer: MyViewer, rawQuery: string): Promise<MySearchHit[]> {
  const query = rawQuery.replace(/\s+/gu, " ").trim().slice(0, 80);
  if (query.length < 2) return [];
  await ensureNotesSchema();
  const db = notesPool();
  const pattern = likePattern(query);
  const [folders, files] = await Promise.all([
    db.query(
      `SELECT id, name, parent_id FROM notes.my_folders
        WHERE owner_id = $1 AND deleted_at IS NULL AND name ILIKE $2
        ORDER BY lower(name) LIMIT $3`,
      [viewer.userId, pattern, SEARCH_LIMIT],
    ),
    db.query(
      `SELECT ${CARD_COLUMNS} FROM notes.my_files
        WHERE owner_id = $1 AND deleted_at IS NULL AND (title ILIKE $2 OR original_name ILIKE $2)
        ORDER BY updated_at DESC LIMIT $3`,
      [viewer.userId, pattern, SEARCH_LIMIT],
    ),
  ]);
  const hits: MySearchHit[] = [];
  for (const row of folders.rows) {
    hits.push({ type: "folder", id: String(row.id), name: String(row.name), breadcrumb: await myBreadcrumb(db, viewer.userId, (row.parent_id as string | null) ?? null) });
  }
  for (const row of files.rows) {
    const file = mapMyFile(row);
    hits.push({ type: "file", file, breadcrumb: await myBreadcrumb(db, viewer.userId, file.folderId) });
  }
  return hits;
}

// ── Folders ────────────────────────────────────────────────────────────────

export async function createMyFolder(viewer: MyViewer, input: { parentId: string | null; name: string }): Promise<MyFolderCard> {
  const name = cleanFolderName(input.name);
  if (!name.ok) throw new NotesError(400, "invalid_name", name.error);
  return withNotesTransaction(async (client) => {
    await lockOwner(client, viewer.userId);
    if (input.parentId) {
      await liveFolder(client, viewer.userId, input.parentId);
      const depth = (await myBreadcrumb(client, viewer.userId, input.parentId)).length;
      if (depth + 1 > MY_FOLDER_MAX_DEPTH) {
        throw new NotesError(400, "too_deep", `Folders can go ${MY_FOLDER_MAX_DEPTH} levels deep. Put this one higher up.`);
      }
    }
    // Bin folders count too, so a full Bin can't be refilled forever.
    const count = await client.query(`SELECT COUNT(*) AS n FROM notes.my_folders WHERE owner_id = $1`, [viewer.userId]);
    if ((toNumber(count.rows[0]?.n) ?? 0) >= MAX_MY_FOLDERS) {
      throw new NotesError(400, "too_many_folders", `You can keep up to ${MAX_MY_FOLDERS} folders, Bin included. Empty the Bin or delete some you don't use.`);
    }
    const id = createMyFolderId();
    const inserted = await client.query(
      `INSERT INTO notes.my_folders (id, owner_id, parent_id, name) VALUES ($1, $2, $3, $4) RETURNING updated_at`,
      [id, viewer.userId, input.parentId, name.name],
    );
    return { id, name: name.name, folderCount: 0, fileCount: 0, updatedAt: toIso(inserted.rows[0]?.updated_at) };
  });
}

export async function updateMyFolder(
  viewer: MyViewer,
  folderId: string,
  input: { name?: string; parentId?: string | null },
): Promise<void> {
  await withNotesTransaction(async (client) => {
    // Without the lock, "A into B" and "B into A" at the same moment both pass the check.
    await lockOwner(client, viewer.userId);
    const folder = await liveFolder(client, viewer.userId, folderId);
    if (input.name !== undefined) {
      const name = cleanFolderName(input.name);
      if (!name.ok) throw new NotesError(400, "invalid_name", name.error);
      await client.query(`UPDATE notes.my_folders SET name = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`, [folderId, viewer.userId, name.name]);
    }
    if (input.parentId !== undefined && input.parentId !== folder.parentId) {
      const target = input.parentId;
      if (target) {
        await liveFolder(client, viewer.userId, target);
        const inside = await liveSubtreeIds(client, viewer.userId, folderId);
        if (inside.includes(target)) throw new NotesError(400, "move_into_self", "A folder can't go inside itself.");
        const depth = (await myBreadcrumb(client, viewer.userId, target)).length;
        if (depth + (await subtreeHeight(client, viewer.userId, folderId)) > MY_FOLDER_MAX_DEPTH) {
          throw new NotesError(400, "too_deep", `Folders can go ${MY_FOLDER_MAX_DEPTH} levels deep. Move it somewhere higher up.`);
        }
      }
      await client.query(`UPDATE notes.my_folders SET parent_id = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`, [folderId, viewer.userId, target]);
    }
  });
}

/** To the Bin, with everything inside it. */
export async function deleteMyFolder(viewer: MyViewer, folderId: string): Promise<void> {
  await withNotesTransaction(async (client) => {
    await lockOwner(client, viewer.userId);
    await liveFolder(client, viewer.userId, folderId);
    const ids = await liveSubtreeIds(client, viewer.userId, folderId);
    await client.query(
      `UPDATE notes.my_folders SET deleted_at = now(), deleted_batch = $3 WHERE owner_id = $1 AND id = ANY($2::text[]) AND deleted_at IS NULL`,
      [viewer.userId, ids, folderId],
    );
    await client.query(
      `UPDATE notes.my_files SET deleted_at = now(), deleted_batch = $3 WHERE owner_id = $1 AND folder_id = ANY($2::text[]) AND deleted_at IS NULL`,
      [viewer.userId, ids, folderId],
    );
  });
}

// ── Typed notes and files ──────────────────────────────────────────────────

export async function createMyTypedNote(
  viewer: MyViewer,
  input: { folderId: string | null; title: string; bodyMd: string },
): Promise<MyFileCard> {
  const title = cleanTitle(input.title);
  if (!title.ok) throw new NotesError(400, "invalid_title", title.error);
  if (typedNoteBytes(input.bodyMd) > TYPED_NOTE_MAX_BYTES) throw new NotesError(413, "too_long", "This note is too long. Split it into two notes.");
  const bytes = billedTypedNoteBytes(input.bodyMd);
  const { limitBytes } = await getStudentLimits(viewer.userId);
  return withNotesTransaction(async (client) => {
    await lockOwner(client, viewer.userId);
    if (input.folderId) await liveFolder(client, viewer.userId, input.folderId);
    await assertFileRoom(client, viewer.userId);
    await adjustUsedBytes(client, viewer.userId, bytes, limitBytes);
    const id = createMyFileId();
    const inserted = await client.query(
      `INSERT INTO notes.my_files (id, owner_id, folder_id, kind, title, body_md, bytes)
       VALUES ($1, $2, $3, 'typed', $4, $5, $6) RETURNING ${CARD_COLUMNS}`,
      [id, viewer.userId, input.folderId, title.title, input.bodyMd, bytes],
    );
    return mapMyFile(inserted.rows[0]);
  });
}

export async function updateMyFile(
  viewer: MyViewer,
  fileId: string,
  input: { title?: string; folderId?: string | null; bodyMd?: string; baseVersion?: number },
): Promise<MyFilePayload> {
  const { limitBytes } = input.bodyMd !== undefined ? await getStudentLimits(viewer.userId) : { limitBytes: 0 };
  await withNotesTransaction(async (client) => {
    await lockOwner(client, viewer.userId);
    const found = await client.query(
      `SELECT id, kind, bytes, version, folder_id FROM notes.my_files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE`,
      [fileId, viewer.userId],
    );
    const row = found.rows[0];
    if (!row) throw missingFile();
    if (input.title !== undefined) {
      const title = cleanTitle(input.title);
      if (!title.ok) throw new NotesError(400, "invalid_title", title.error);
      await client.query(`UPDATE notes.my_files SET title = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`, [fileId, viewer.userId, title.title]);
    }
    if (input.folderId !== undefined && input.folderId !== row.folder_id) {
      if (input.folderId) await liveFolder(client, viewer.userId, input.folderId);
      await client.query(`UPDATE notes.my_files SET folder_id = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`, [fileId, viewer.userId, input.folderId]);
    }
    if (input.bodyMd !== undefined) {
      if (row.kind !== "typed") throw new NotesError(400, "not_typed", "Only typed notes can be edited.");
      if (input.baseVersion !== undefined && input.baseVersion !== toNumber(row.version)) {
        throw new NotesError(409, "edit_conflict", "This note was changed somewhere else (another phone or tab). Reload it, then make your change again.");
      }
      if (typedNoteBytes(input.bodyMd) > TYPED_NOTE_MAX_BYTES) throw new NotesError(413, "too_long", "This note is too long. Split it into two notes.");
      const bytes = billedTypedNoteBytes(input.bodyMd);
      await adjustUsedBytes(client, viewer.userId, bytes - (toNumber(row.bytes) ?? 0), limitBytes);
      await client.query(
        `UPDATE notes.my_files SET body_md = $3, bytes = $4, version = version + 1, updated_at = now() WHERE id = $1 AND owner_id = $2`,
        [fileId, viewer.userId, input.bodyMd, bytes],
      );
    }
  });
  return getMyFile(viewer, fileId);
}

export async function deleteMyFile(viewer: MyViewer, fileId: string): Promise<void> {
  await withNotesTransaction(async (client) => {
    await lockOwner(client, viewer.userId);
    const result = await client.query(
      `UPDATE notes.my_files SET deleted_at = now(), deleted_batch = id WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id`,
      [fileId, viewer.userId],
    );
    if (!result.rows[0]) throw missingFile();
  });
}

// ── Bin ────────────────────────────────────────────────────────────────────

export async function listMyBin(viewer: MyViewer): Promise<MyBinPayload> {
  await ensureNotesSchema();
  const db = notesPool();
  const settings = await getNotesSettings();
  const [folders, files, storage] = await Promise.all([
    db.query(
      `SELECT f.id, f.name, f.deleted_at,
              COALESCE((SELECT SUM(x.bytes) FROM notes.my_files x WHERE x.owner_id = $1 AND x.deleted_batch = f.id), 0) AS bytes,
              (SELECT COUNT(*) FROM notes.my_files x WHERE x.owner_id = $1 AND x.deleted_batch = f.id) AS file_count
         FROM notes.my_folders f
        WHERE f.owner_id = $1 AND f.deleted_at IS NOT NULL AND f.deleted_batch = f.id`,
      [viewer.userId],
    ),
    db.query(
      `SELECT id, title, kind, bytes, deleted_at FROM notes.my_files
        WHERE owner_id = $1 AND deleted_at IS NOT NULL AND deleted_batch = id`,
      [viewer.userId],
    ),
    getStorageSummary(viewer.userId),
  ]);
  const entry = (row: Record<string, unknown>, type: "folder" | "file"): MyBinEntry => {
    const deletedAt = row.deleted_at instanceof Date ? row.deleted_at : new Date(String(row.deleted_at));
    return {
      id: String(row.id),
      type,
      title: String(type === "folder" ? row.name : row.title),
      kind: type === "file" ? (String(row.kind) as MyFileKind) : null,
      bytes: toNumber(row.bytes) ?? 0,
      itemCount: type === "folder" ? toNumber(row.file_count) ?? 0 : 1,
      deletedAt: deletedAt.toISOString(),
      expiresAt: binExpiresAt(deletedAt, settings.binDays).toISOString(),
    };
  };
  const entries = [...folders.rows.map((row) => entry(row, "folder")), ...files.rows.map((row) => entry(row, "file"))].sort(
    (a, b) => b.deletedAt.localeCompare(a.deletedAt),
  );
  return { entries, storage };
}

async function uniqueRestoreName(client: Queryable, ownerId: string, parentId: string | null, name: string, selfId: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? name : `${name} (restored${attempt === 1 ? "" : ` ${attempt}`})`.slice(0, 120);
    const clash = await client.query(
      `SELECT 1 FROM notes.my_folders
        WHERE owner_id = $1 AND deleted_at IS NULL AND parent_id IS NOT DISTINCT FROM $2 AND lower(name) = lower($3) AND id <> $4`,
      [ownerId, parentId, candidate, selfId],
    );
    if (!clash.rows[0]) return candidate;
  }
  return `${name} (${selfId.slice(-4)})`.slice(0, 120);
}

/**
 * Puts a Bin entry back. If its folder is gone, it comes back at the top
 * level; a folder whose name is now taken comes back as "Name (restored)".
 * The target and the name are worked out BEFORE anything is un-deleted, so
 * the unique-name rule never trips.
 */
export async function restoreFromMyBin(viewer: MyViewer, batchId: string): Promise<void> {
  await withNotesTransaction(async (client) => {
    await lockOwner(client, viewer.userId);
    const folder = await client.query(
      `SELECT id, name, parent_id FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_batch = id AND deleted_at IS NOT NULL`,
      [batchId, viewer.userId],
    );
    const file = folder.rows[0]
      ? null
      : await client.query(
          `SELECT id, folder_id FROM notes.my_files WHERE id = $1 AND owner_id = $2 AND deleted_batch = id AND deleted_at IS NOT NULL`,
          [batchId, viewer.userId],
        );
    if (!folder.rows[0] && !file?.rows[0]) throw notFoundError("That item in the Bin");

    const parentLive = async (parentId: string | null) => {
      if (!parentId) return null;
      const live = await client.query(`SELECT 1 FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [parentId, viewer.userId]);
      return live.rows[0] ? parentId : null;
    };

    if (folder.rows[0]) {
      const parentId = await parentLive((folder.rows[0].parent_id as string | null) ?? null);
      const name = await uniqueRestoreName(client, viewer.userId, parentId, String(folder.rows[0].name), batchId);
      // The root first, already under its final parent and name.
      await client.query(
        `UPDATE notes.my_folders SET deleted_at = NULL, deleted_batch = NULL, parent_id = $3, name = $4, updated_at = now()
          WHERE id = $1 AND owner_id = $2`,
        [batchId, viewer.userId, parentId, name],
      );
    } else if (file?.rows[0]) {
      const folderId = await parentLive((file.rows[0].folder_id as string | null) ?? null);
      await client.query(`UPDATE notes.my_files SET folder_id = $3, updated_at = now() WHERE id = $1 AND owner_id = $2`, [batchId, viewer.userId, folderId]);
    }
    await client.query(`UPDATE notes.my_folders SET deleted_at = NULL, deleted_batch = NULL WHERE owner_id = $1 AND deleted_batch = $2`, [viewer.userId, batchId]);
    await client.query(`UPDATE notes.my_files SET deleted_at = NULL, deleted_batch = NULL WHERE owner_id = $1 AND deleted_batch = $2`, [viewer.userId, batchId]);
  });
}

/**
 * Removes Bin batches for good: the rows (a folder takes everything under it
 * that is in the Bin, even items deleted separately before), then the stored
 * files, and gives the space back. Returns how many bytes were freed.
 *
 * Runs under the student's lock, and only ever touches rows that are in the
 * Bin. If anything live still pointed into a doomed folder, the folder foreign
 * keys (NO ACTION) make the delete fail and roll back instead of losing it.
 */
export async function purgeMyBatches(ownerId: string, batchIds: readonly string[]): Promise<{ bytes: number; files: number }> {
  if (batchIds.length === 0) return { bytes: 0, files: 0 };
  const { keys, bytes, files } = await withNotesTransaction(async (client) => {
    await lockOwner(client, ownerId);
    const folderIds = await client.query(
      `WITH RECURSIVE down AS (
         SELECT id, 1 AS level FROM notes.my_folders
          WHERE owner_id = $1 AND id = ANY($2::text[]) AND deleted_batch = id AND deleted_at IS NOT NULL
         UNION ALL
         SELECT f.id, down.level + 1 FROM notes.my_folders f JOIN down ON f.parent_id = down.id
          WHERE f.owner_id = $1 AND f.deleted_at IS NOT NULL AND down.level < $3
       )
       SELECT DISTINCT id FROM down`,
      [ownerId, batchIds, WALK_LIMIT],
    );
    const folders = folderIds.rows.map((row) => String(row.id));
    const doomed = await client.query(
      `SELECT id, file_key, bytes FROM notes.my_files
        WHERE owner_id = $1 AND deleted_at IS NOT NULL AND (deleted_batch = ANY($2::text[]) OR folder_id = ANY($3::text[]))
        FOR UPDATE`,
      [ownerId, batchIds, folders],
    );
    const fileIds = doomed.rows.map((row) => String(row.id));
    const total = doomed.rows.reduce((sum, row) => sum + (toNumber(row.bytes) ?? 0), 0);
    await client.query(`DELETE FROM notes.my_files WHERE owner_id = $1 AND id = ANY($2::text[])`, [ownerId, fileIds]);
    await client.query(`DELETE FROM notes.my_folders WHERE owner_id = $1 AND id = ANY($2::text[])`, [ownerId, folders]);
    // Shares of anything removed for good end too (a share of a Bin item only pauses).
    await client.query(
      `UPDATE notes.shares SET revoked_at = now()
        WHERE owner_id = $1 AND revoked_at IS NULL
          AND ((target_type = 'file' AND target_id = ANY($2::text[])) OR (target_type = 'folder' AND target_id = ANY($3::text[])))`,
      [ownerId, fileIds, folders],
    );
    await client.query(`UPDATE notes.storage SET used_bytes = GREATEST(0, used_bytes - $2), updated_at = now() WHERE user_id = $1`, [ownerId, total]);
    return {
      keys: doomed.rows.map((row) => row.file_key as string | null).filter((key): key is string => Boolean(key)),
      bytes: total,
      files: fileIds.length,
    };
  });
  // Rows first, objects after: a failed delete leaves an orphan object (costs a
  // little), never a file row whose bytes are gone.
  for (const key of keys) {
    await deleteNotesObject(key).catch((error) => console.error("[notes] stored file not deleted", key, error instanceof Error ? error.message : error));
  }
  return { bytes, files };
}

export async function purgeFromMyBin(viewer: MyViewer, batchId: string): Promise<void> {
  await ensureNotesSchema();
  const exists = await notesPool().query(
    `SELECT 1 FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_batch = id AND deleted_at IS NOT NULL
     UNION ALL
     SELECT 1 FROM notes.my_files WHERE id = $1 AND owner_id = $2 AND deleted_batch = id AND deleted_at IS NOT NULL`,
    [batchId, viewer.userId],
  );
  if (!exists.rows[0]) throw notFoundError("That item in the Bin");
  await purgeMyBatches(viewer.userId, [batchId]);
}

export async function emptyMyBin(viewer: MyViewer): Promise<{ bytes: number; files: number }> {
  await ensureNotesSchema();
  const roots = await notesPool().query(
    `SELECT id FROM notes.my_folders WHERE owner_id = $1 AND deleted_at IS NOT NULL AND deleted_batch = id
     UNION ALL
     SELECT id FROM notes.my_files WHERE owner_id = $1 AND deleted_at IS NOT NULL AND deleted_batch = id`,
    [viewer.userId],
  );
  return purgeMyBatches(viewer.userId, roots.rows.map((row) => String(row.id)));
}
