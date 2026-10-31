/**
 * Origin Notes — admin management of the shared library (V1/NOTES_PLAN.md §4).
 *
 * Every write runs in one transaction that also bumps the library version (so
 * students see it on their next request) and is recorded in app.audit_events
 * after commit. Deletes are soft: folders and items go to the Bin and can be
 * restored; files stay in R2 until a later purge job (Phase 3) removes them.
 *
 * Editing a PUBLISHED note changes what students read immediately, so the
 * editor turns autosave off for live notes; drafts autosave freely.
 */

import type { PoolClient } from "pg";

import {
  breadcrumbFor,
  cleanFolderName,
  cleanTitle,
  descendantIds,
  NOTES_BODY_MAX,
  wouldCreateCycle,
} from "@/lib/notes/rules";
import type {
  NotesAccess,
  NotesAdminFolder,
  NotesAdminItem,
  NotesCrumb,
  NotesExam,
  NotesFolderKind,
  NotesFolderStatus,
  NotesItemStatus,
  NotesNoteType,
  NotesRevision,
  NotesSubject,
  NotesTree,
} from "@/lib/notes/types";
import { recordAuditEvent } from "@/server/workspaces/audit";

import {
  bumpLibraryVersion,
  createNotesFolderId,
  createNotesItemId,
  createNotesRevisionId,
  notesPool,
  toIso,
  toNumber,
  withNotesTransaction,
} from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import {
  FOLDER_COLUMNS,
  getItemRow,
  getLibraryTree,
  itemColumns,
  loadLibraryTreeWith,
  mapFolderRow,
  mapItemRow,
  type NotesItemRow,
} from "./library-store";
import { noteMarkdownPlainText } from "./markdown-validate";
import { presignNotesGet } from "./notes-storage";
import { fileTypeForMime, safeDownloadName } from "@/lib/notes/file-types";

/** A new revision row is kept when the last one is older than this, or by someone else. */
const REVISION_GAP_MS = 10 * 60 * 1000;
const SORT_STEP = 10;

export type AdminActor = { userId: string };

async function audit(
  actor: AdminActor,
  entityType: "notes_folder" | "notes_item",
  entityId: string,
  action: string,
  before?: unknown,
  after?: unknown,
): Promise<void> {
  await recordAuditEvent({
    actorUserId: actor.userId,
    workspaceId: null,
    entityType,
    entityId,
    action,
    before,
    after,
  }).catch((error) => console.error("[notes] audit write failed", error instanceof Error ? error.message : error));
}

function adminFolder(tree: NotesTree, id: string): NotesAdminFolder {
  const node = tree.nodes[id];
  return {
    id: node.id,
    parentId: node.parentId,
    name: node.name,
    kind: node.kind,
    classLevel: node.classLevel,
    subject: node.subject,
    syllabusKey: node.syllabusKey,
    ncertNumber: node.ncertNumber,
    bankChapters: node.bankChapters,
    exams: node.exams,
    access: node.access,
    status: node.status,
    sortOrder: node.sortOrder,
    updatedAt: node.updatedAt,
    counts: node.counts,
    effectiveAccess: node.effectiveAccess,
    effectiveSubject: node.effectiveSubject,
    effectiveClassLevel: node.effectiveClassLevel,
    visible: node.visible,
  };
}

async function userNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const result = await notesPool().query(`SELECT id, name FROM origin_users WHERE id = ANY($1::text[])`, [unique]);
  return new Map(result.rows.map((row) => [String(row.id), String(row.name ?? "")]));
}

function adminItem(row: NotesItemRow, names: Map<string, string>): NotesAdminItem {
  return {
    id: row.id,
    folderId: row.folderId,
    kind: row.kind,
    noteType: row.noteType,
    title: row.title,
    bodyMd: row.bodyMd,
    mime: row.mime,
    bytes: row.bytes,
    pageCount: row.pageCount,
    originalName: row.originalName,
    access: row.access,
    status: row.status,
    source: row.source,
    externalKey: row.externalKey,
    version: row.version,
    reviewerName: row.reviewerName,
    reviewedAt: row.reviewedAt,
    publishedAt: row.publishedAt,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
    updatedByName: row.updatedBy ? (names.get(row.updatedBy) ?? null) : null,
  };
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getAdminTree(): Promise<{ folders: NotesAdminFolder[]; roots: string[] }> {
  const tree = await getLibraryTree();
  return { folders: Object.keys(tree.nodes).map((id) => adminFolder(tree, id)), roots: tree.roots };
}

export async function getAdminFolderView(folderId: string | null): Promise<{
  folder: NotesAdminFolder | null;
  breadcrumb: NotesCrumb[];
  folders: NotesAdminFolder[];
  items: NotesAdminItem[];
}> {
  const tree = await getLibraryTree();
  if (folderId && !tree.nodes[folderId]) throw notFoundError("That folder");
  const childIds = folderId ? tree.nodes[folderId].children : tree.roots;
  let items: NotesAdminItem[] = [];
  if (folderId) {
    const result = await notesPool().query(
      `SELECT ${itemColumns("i")} FROM notes.items i WHERE i.folder_id = $1 AND i.deleted_at IS NULL
        ORDER BY i.sort_order, lower(i.title)`,
      [folderId],
    );
    const rows = result.rows.map(mapItemRow);
    const names = await userNames(rows.map((row) => row.updatedBy));
    items = rows.map((row) => adminItem(row, names));
  }
  return {
    folder: folderId ? adminFolder(tree, folderId) : null,
    breadcrumb: folderId ? breadcrumbFor(tree, folderId) : [],
    folders: childIds.map((id) => adminFolder(tree, id)),
    items,
  };
}

export async function getAdminItem(itemId: string): Promise<{ item: NotesAdminItem; breadcrumb: NotesCrumb[] }> {
  const row = await getItemRow(itemId, { withBody: true });
  if (!row) throw notFoundError("That note");
  const tree = await getLibraryTree();
  const names = await userNames([row.updatedBy]);
  return { item: adminItem(row, names), breadcrumb: breadcrumbFor(tree, row.folderId) };
}

export async function getAdminItemFileUrl(itemId: string): Promise<string> {
  const row = await getItemRow(itemId);
  const type = fileTypeForMime(row?.mime);
  if (!row || row.kind === "typed" || !row.fileKey || !type) throw notFoundError("That file");
  return presignNotesGet(row.fileKey, { contentType: type.mime, fileName: safeDownloadName(row.originalName ?? row.title, type) });
}

export async function listRevisions(itemId: string): Promise<NotesRevision[]> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT r.id, r.version, r.title, r.created_at, u.name AS edited_by_name
       FROM notes.item_revisions r LEFT JOIN origin_users u ON u.id = r.edited_by
      WHERE r.item_id = $1 ORDER BY r.version DESC LIMIT 100`,
    [itemId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    version: toNumber(row.version) ?? 0,
    title: String(row.title),
    editedByName: (row.edited_by_name as string | null) ?? null,
    createdAt: toIso(row.created_at),
  }));
}

export async function getRevisionBody(itemId: string, revisionId: string): Promise<{ title: string; bodyMd: string | null; version: number }> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT title, body_md, version FROM notes.item_revisions WHERE id = $1 AND item_id = $2`,
    [revisionId, itemId],
  );
  if (!result.rows[0]) throw notFoundError("That version");
  return {
    title: String(result.rows[0].title),
    bodyMd: (result.rows[0].body_md as string | null) ?? null,
    version: toNumber(result.rows[0].version) ?? 0,
  };
}

// ─── Folders ──────────────────────────────────────────────────────────────────

async function nextSortOrder(client: PoolClient, table: "folders" | "items", parentColumn: string, parentId: string | null): Promise<number> {
  const result = await client.query(
    `SELECT COALESCE(MAX(sort_order), 0) AS max FROM notes.${table}
      WHERE ${parentId === null ? `${parentColumn} IS NULL` : `${parentColumn} = $1`} AND deleted_at IS NULL`,
    parentId === null ? [] : [parentId],
  );
  return (toNumber(result.rows[0]?.max) ?? 0) + SORT_STEP;
}

export type CreateFolderInput = {
  parentId: string | null;
  name: string;
  kind?: NotesFolderKind;
  classLevel?: number | null;
  subject?: NotesSubject | null;
  ncertNumber?: number | null;
  access?: NotesAccess;
};

export async function createFolder(input: CreateFolderInput, actor: AdminActor): Promise<NotesAdminFolder> {
  const clean = cleanFolderName(input.name);
  if (!clean.ok) throw new NotesError(400, "invalid_name", clean.error);
  const id = createNotesFolderId();
  await withNotesTransaction(async (client) => {
    if (input.parentId) {
      const parent = await client.query(`SELECT 1 FROM notes.folders WHERE id = $1 AND deleted_at IS NULL`, [input.parentId]);
      if (!parent.rows[0]) throw notFoundError("The parent folder");
    }
    const sortOrder = await nextSortOrder(client, "folders", "parent_id", input.parentId);
    await client.query(
      `INSERT INTO notes.folders (id, parent_id, name, kind, class_level, subject, ncert_number, access, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [
        id,
        input.parentId,
        clean.name,
        input.kind ?? "folder",
        input.classLevel ?? null,
        input.subject ?? null,
        input.ncertNumber ?? null,
        input.access ?? "inherit",
        sortOrder,
        actor.userId,
      ],
    );
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_folder", id, "notes.folder.create", undefined, { name: clean.name, parentId: input.parentId });
  const tree = await getLibraryTree();
  return adminFolder(tree, id);
}

export type UpdateFolderInput = {
  name?: string;
  access?: NotesAccess;
  status?: NotesFolderStatus;
  bankChapters?: string[];
  exams?: NotesExam[];
  classLevel?: number | null;
  subject?: NotesSubject | null;
  ncertNumber?: number | null;
  kind?: NotesFolderKind;
  /** Publishing a folder can publish its parent folders too. */
  publishParents?: boolean;
};

export async function updateFolder(folderId: string, input: UpdateFolderInput, actor: AdminActor): Promise<NotesAdminFolder> {
  const sets: string[] = [];
  const values: unknown[] = [folderId];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (input.name !== undefined) {
    const clean = cleanFolderName(input.name);
    if (!clean.ok) throw new NotesError(400, "invalid_name", clean.error);
    push("name", clean.name);
  }
  if (input.access !== undefined) push("access", input.access);
  if (input.status !== undefined) push("status", input.status);
  if (input.bankChapters !== undefined) {
    const chapters = [...new Set(input.bankChapters.map((c) => c.trim()).filter(Boolean))].slice(0, 6);
    push("bank_chapters", chapters);
  }
  if (input.exams !== undefined) push("exams", [...new Set(input.exams)]);
  if (input.classLevel !== undefined) push("class_level", input.classLevel);
  if (input.subject !== undefined) push("subject", input.subject);
  if (input.ncertNumber !== undefined) push("ncert_number", input.ncertNumber);
  if (input.kind !== undefined) push("kind", input.kind);
  if (sets.length === 0) throw new NotesError(400, "nothing_to_change", "Nothing to change.");

  let before: unknown;
  await withNotesTransaction(async (client) => {
    const current = await client.query(`SELECT ${FOLDER_COLUMNS} FROM notes.folders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [folderId]);
    if (!current.rows[0]) throw notFoundError("That folder");
    before = mapFolderRow(current.rows[0]);
    values.push(actor.userId);
    await client.query(
      `UPDATE notes.folders SET ${sets.join(", ")}, updated_by = $${values.length}, updated_at = now() WHERE id = $1`,
      values,
    );
    if (input.status === "published" && input.publishParents) {
      const tree = await loadLibraryTreeWith(client);
      const path = tree.nodes[folderId]?.path ?? [];
      if (path.length > 0) {
        await client.query(
          `UPDATE notes.folders SET status = 'published', updated_by = $2, updated_at = now()
            WHERE id = ANY($1::text[]) AND status <> 'published'`,
          [path, actor.userId],
        );
      }
    }
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_folder", folderId, "notes.folder.update", before, input);
  const tree = await getLibraryTree();
  return adminFolder(tree, folderId);
}

export async function moveFolder(folderId: string, newParentId: string | null, actor: AdminActor): Promise<NotesAdminFolder> {
  let before: string | null = null;
  await withNotesTransaction(async (client) => {
    // Lock all folder rows so two concurrent moves can't build a cycle together.
    await client.query(`SELECT id FROM notes.folders WHERE deleted_at IS NULL FOR UPDATE`);
    const tree = await loadLibraryTreeWith(client);
    const node = tree.nodes[folderId];
    if (!node) throw notFoundError("That folder");
    if (newParentId && !tree.nodes[newParentId]) throw notFoundError("The destination folder");
    if (wouldCreateCycle(tree, folderId, newParentId)) {
      throw new NotesError(400, "cycle", "A folder can't be moved inside itself.");
    }
    before = node.parentId;
    const sortOrder = await nextSortOrder(client, "folders", "parent_id", newParentId);
    await client.query(
      `UPDATE notes.folders SET parent_id = $2, sort_order = $3, updated_by = $4, updated_at = now() WHERE id = $1`,
      [folderId, newParentId, sortOrder, actor.userId],
    );
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_folder", folderId, "notes.folder.move", { parentId: before }, { parentId: newParentId });
  const tree = await getLibraryTree();
  return adminFolder(tree, folderId);
}

/** Sets sort order to the given sequence. Every id must belong to `parentId`. */
export async function reorder(
  kind: "folders" | "items",
  parentId: string | null,
  orderedIds: string[],
  actor: AdminActor,
): Promise<void> {
  const ids = [...new Set(orderedIds)];
  if (ids.length === 0 || ids.length > 500) throw new NotesError(400, "invalid_order", "Send the new order of this folder's contents.");
  if (kind === "items" && !parentId) throw new NotesError(400, "invalid_order", "Notes always sit inside a folder.");
  await withNotesTransaction(async (client) => {
    const column = kind === "folders" ? "parent_id" : "folder_id";
    const owned = await client.query(
      `SELECT id FROM notes.${kind}
        WHERE id = ANY($1::text[]) AND deleted_at IS NULL AND ${parentId === null ? `${column} IS NULL` : `${column} = $2`}`,
      parentId === null ? [ids] : [ids, parentId],
    );
    if (owned.rows.length !== ids.length) throw new NotesError(400, "invalid_order", "Some of those aren't in this folder any more. Refresh and try again.");
    await client.query(
      `UPDATE notes.${kind} AS t SET sort_order = o.position * ${SORT_STEP}, updated_at = now()
         FROM unnest($1::text[]) WITH ORDINALITY AS o(id, position)
        WHERE t.id = o.id`,
      [ids],
    );
    await bumpLibraryVersion(client);
  });
  await audit(actor, kind === "folders" ? "notes_folder" : "notes_item", parentId ?? "root", `notes.${kind}.reorder`, undefined, { order: ids });
}

/** Moves a folder, everything inside it and all their notes to the Bin. */
export async function deleteFolder(folderId: string, actor: AdminActor): Promise<{ folders: number; items: number }> {
  let counts = { folders: 0, items: 0 };
  await withNotesTransaction(async (client) => {
    const tree = await loadLibraryTreeWith(client);
    if (!tree.nodes[folderId]) throw notFoundError("That folder");
    const ids = [folderId, ...descendantIds(tree, folderId)];
    // One shared timestamp marks the batch, so Restore brings back exactly this delete.
    const stamp = await client.query(`SELECT now() AS at`);
    const at = stamp.rows[0].at;
    const items = await client.query(
      `UPDATE notes.items SET deleted_at = $2, deleted_by = $3 WHERE folder_id = ANY($1::text[]) AND deleted_at IS NULL`,
      [ids, at, actor.userId],
    );
    const folders = await client.query(
      `UPDATE notes.folders SET deleted_at = $2, deleted_by = $3 WHERE id = ANY($1::text[]) AND deleted_at IS NULL`,
      [ids, at, actor.userId],
    );
    counts = { folders: folders.rowCount ?? 0, items: items.rowCount ?? 0 };
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_folder", folderId, "notes.folder.delete", undefined, counts);
  return counts;
}

export type BinEntry = {
  type: "folder" | "item";
  id: string;
  name: string;
  deletedAt: string;
  deletedByName: string | null;
  /** Where it was: the parent folder's name, or "Library" for the top level. */
  from: string;
};

export async function listBin(): Promise<BinEntry[]> {
  await ensureNotesSchema();
  const pool = notesPool();
  const [folders, items] = await Promise.all([
    pool.query(
      `SELECT f.id, f.name, f.deleted_at, u.name AS by_name, p.name AS parent_name
         FROM notes.folders f
         LEFT JOIN notes.folders p ON p.id = f.parent_id
         LEFT JOIN origin_users u ON u.id = f.deleted_by
        WHERE f.deleted_at IS NOT NULL
          AND (f.parent_id IS NULL OR p.deleted_at IS NULL OR p.deleted_at <> f.deleted_at)
        ORDER BY f.deleted_at DESC LIMIT 200`,
    ),
    pool.query(
      `SELECT i.id, i.title, i.deleted_at, u.name AS by_name, f.name AS folder_name
         FROM notes.items i
         JOIN notes.folders f ON f.id = i.folder_id
         LEFT JOIN origin_users u ON u.id = i.deleted_by
        WHERE i.deleted_at IS NOT NULL AND (f.deleted_at IS NULL OR f.deleted_at <> i.deleted_at)
        ORDER BY i.deleted_at DESC LIMIT 200`,
    ),
  ]);
  const entries: BinEntry[] = [
    ...folders.rows.map((row) => ({
      type: "folder" as const,
      id: String(row.id),
      name: String(row.name),
      deletedAt: toIso(row.deleted_at),
      deletedByName: (row.by_name as string | null) ?? null,
      from: (row.parent_name as string | null) ?? "Library",
    })),
    ...items.rows.map((row) => ({
      type: "item" as const,
      id: String(row.id),
      name: String(row.title),
      deletedAt: toIso(row.deleted_at),
      deletedByName: (row.by_name as string | null) ?? null,
      from: String(row.folder_name ?? ""),
    })),
  ];
  return entries.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
}

export async function restoreFromBin(type: "folder" | "item", id: string, actor: AdminActor): Promise<void> {
  await withNotesTransaction(async (client) => {
    if (type === "item") {
      const row = await client.query(
        `SELECT i.deleted_at, f.deleted_at AS folder_deleted FROM notes.items i JOIN notes.folders f ON f.id = i.folder_id WHERE i.id = $1`,
        [id],
      );
      if (!row.rows[0]?.deleted_at) throw notFoundError("That note in the Bin");
      if (row.rows[0].folder_deleted) throw new NotesError(409, "parent_deleted", "Restore its folder first.");
      await client.query(`UPDATE notes.items SET deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE id = $1`, [id]);
    } else {
      const row = await client.query(
        `SELECT f.deleted_at, p.deleted_at AS parent_deleted FROM notes.folders f LEFT JOIN notes.folders p ON p.id = f.parent_id WHERE f.id = $1`,
        [id],
      );
      const at = row.rows[0]?.deleted_at;
      if (!at) throw notFoundError("That folder in the Bin");
      if (row.rows[0].parent_deleted) throw new NotesError(409, "parent_deleted", "Restore its parent folder first.");
      // Everything deleted in the same batch comes back together.
      const all = await client.query(
        `WITH RECURSIVE sub AS (
           SELECT id FROM notes.folders WHERE id = $1
           UNION ALL
           SELECT f.id FROM notes.folders f JOIN sub ON f.parent_id = sub.id WHERE f.deleted_at = $2
         ) SELECT id FROM sub`,
        [id, at],
      );
      const ids = all.rows.map((r) => String(r.id));
      await client.query(`UPDATE notes.folders SET deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE id = ANY($1::text[])`, [ids]);
      await client.query(
        `UPDATE notes.items SET deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE folder_id = ANY($1::text[]) AND deleted_at = $2`,
        [ids, at],
      );
    }
    await bumpLibraryVersion(client);
  });
  await audit(actor, type === "folder" ? "notes_folder" : "notes_item", id, `notes.${type}.restore`);
}

// ─── Items ────────────────────────────────────────────────────────────────────

function cleanBody(raw: unknown): string {
  const body = String(raw ?? "").replace(/\r\n?/gu, "\n");
  if (body.length > NOTES_BODY_MAX) {
    throw new NotesError(400, "too_long", "This note is too long. Split it into two notes.");
  }
  return body;
}

async function insertRevision(client: PoolClient, itemId: string, version: number, title: string, bodyMd: string | null, actor: AdminActor) {
  await client.query(
    `INSERT INTO notes.item_revisions (id, item_id, version, title, body_md, edited_by)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (item_id, version) DO NOTHING`,
    [createNotesRevisionId(), itemId, version, title, bodyMd, actor.userId],
  );
}

export type CreateTypedNoteInput = {
  folderId: string;
  title: string;
  noteType: NotesNoteType;
  bodyMd: string;
  access?: NotesAccess;
};

export async function createTypedNote(input: CreateTypedNoteInput, actor: AdminActor): Promise<NotesAdminItem> {
  const title = cleanTitle(input.title);
  if (!title.ok) throw new NotesError(400, "invalid_title", title.error);
  const body = cleanBody(input.bodyMd);
  const id = createNotesItemId();
  await withNotesTransaction(async (client) => {
    const folder = await client.query(`SELECT 1 FROM notes.folders WHERE id = $1 AND deleted_at IS NULL`, [input.folderId]);
    if (!folder.rows[0]) throw notFoundError("That folder");
    const sortOrder = await nextSortOrder(client, "items", "folder_id", input.folderId);
    await client.query(
      `INSERT INTO notes.items (id, folder_id, kind, note_type, title, body_md, body_text, access, sort_order, created_by, updated_by)
       VALUES ($1, $2, 'typed', $3, $4, $5, $6, $7, $8, $9, $9)`,
      [id, input.folderId, input.noteType, title.title, body, noteMarkdownPlainText(body), input.access ?? "inherit", sortOrder, actor.userId],
    );
    await insertRevision(client, id, 1, title.title, body, actor);
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_item", id, "notes.item.create", undefined, { folderId: input.folderId, title: title.title });
  return (await getAdminItem(id)).item;
}

export type UpdateItemInput = {
  baseVersion: number;
  title?: string;
  noteType?: NotesNoteType;
  bodyMd?: string;
  access?: NotesAccess;
};

/**
 * Saves an edit. `baseVersion` is the version the editor loaded; if someone
 * else saved since, nothing is written and a 409 carries the current version
 * so the editor can offer "load theirs" or "overwrite".
 */
export async function updateItem(itemId: string, input: UpdateItemInput, actor: AdminActor): Promise<NotesAdminItem> {
  let changedContent = false;
  await withNotesTransaction(async (client) => {
    const current = await client.query(
      `SELECT ${itemColumns("i", true)} FROM notes.items i WHERE i.id = $1 AND i.deleted_at IS NULL FOR UPDATE`,
      [itemId],
    );
    if (!current.rows[0]) throw notFoundError("That note");
    const row = mapItemRow(current.rows[0]);
    if (row.version !== input.baseVersion) {
      const names = await userNames([row.updatedBy]);
      throw new NotesError(409, "version_conflict", "Someone else saved this note while you were editing.", {
        currentVersion: row.version,
        updatedByName: row.updatedBy ? (names.get(row.updatedBy) ?? null) : null,
        updatedAt: row.updatedAt,
      });
    }
    const title = input.title === undefined ? row.title : cleanTitle(input.title);
    if (typeof title !== "string" && !title.ok) throw new NotesError(400, "invalid_title", title.error);
    const nextTitle = typeof title === "string" ? title : title.title;
    if (input.bodyMd !== undefined && row.kind !== "typed") {
      throw new NotesError(400, "not_typed", "Only typed notes have text to edit.");
    }
    const nextBody = input.bodyMd === undefined ? row.bodyMd : cleanBody(input.bodyMd);
    changedContent = nextTitle !== row.title || nextBody !== row.bodyMd;
    const nextVersion = changedContent ? row.version + 1 : row.version;
    await client.query(
      `UPDATE notes.items
          SET title = $2, body_md = $3, body_text = $4, note_type = $5, access = $6,
              version = $7, updated_by = $8, updated_at = now()
        WHERE id = $1`,
      [
        itemId,
        nextTitle,
        nextBody,
        row.kind === "typed" && nextBody !== null ? noteMarkdownPlainText(nextBody) : null,
        input.noteType ?? row.noteType,
        input.access ?? row.access,
        nextVersion,
        actor.userId,
      ],
    );
    if (changedContent) {
      const last = await client.query(
        `SELECT edited_by, created_at FROM notes.item_revisions WHERE item_id = $1 ORDER BY version DESC LIMIT 1`,
        [itemId],
      );
      const lastAt = last.rows[0]?.created_at ? new Date(last.rows[0].created_at).getTime() : 0;
      const byOther = last.rows[0]?.edited_by !== actor.userId;
      if (!last.rows[0] || byOther || Date.now() - lastAt > REVISION_GAP_MS) {
        await insertRevision(client, itemId, nextVersion, nextTitle, nextBody, actor);
      }
    }
    await bumpLibraryVersion(client);
  });
  if (changedContent || input.access !== undefined || input.noteType !== undefined) {
    await audit(actor, "notes_item", itemId, "notes.item.update", undefined, {
      title: input.title,
      noteType: input.noteType,
      access: input.access,
      bodyChanged: input.bodyMd !== undefined,
    });
  }
  return (await getAdminItem(itemId)).item;
}

/**
 * Draft → In review → Published. Notes written by the importer (Claude's notes)
 * cannot be published until a reviewer's name is recorded (plan §13).
 */
export async function setItemStatus(
  itemId: string,
  status: NotesItemStatus,
  reviewerName: string | null,
  actor: AdminActor,
): Promise<NotesAdminItem> {
  let before: NotesItemStatus | null = null;
  await withNotesTransaction(async (client) => {
    const current = await client.query(
      `SELECT ${itemColumns("i")} FROM notes.items i WHERE i.id = $1 AND i.deleted_at IS NULL FOR UPDATE`,
      [itemId],
    );
    if (!current.rows[0]) throw notFoundError("That note");
    const row = mapItemRow(current.rows[0]);
    before = row.status;
    const reviewer = reviewerName?.replace(/\s+/gu, " ").trim().slice(0, 80) || row.reviewerName;
    if (status === "published" && row.source === "import" && !reviewer) {
      throw new NotesError(400, "review_required", "Add the name of the teacher who checked this note before publishing it.");
    }
    await client.query(
      `UPDATE notes.items
          SET status = $2,
              reviewer_name = $3,
              reviewed_by = CASE WHEN $3::text IS DISTINCT FROM reviewer_name THEN $4 ELSE reviewed_by END,
              reviewed_at = CASE WHEN $3::text IS DISTINCT FROM reviewer_name THEN now() ELSE reviewed_at END,
              published_at = CASE WHEN $2 = 'published' THEN COALESCE(published_at, now()) ELSE published_at END,
              updated_by = $4, updated_at = now()
        WHERE id = $1`,
      [itemId, status, reviewer ?? null, actor.userId],
    );
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_item", itemId, "notes.item.status", { status: before }, { status, reviewerName });
  return (await getAdminItem(itemId)).item;
}

export async function moveItem(itemId: string, folderId: string, actor: AdminActor): Promise<NotesAdminItem> {
  let from: string | null = null;
  await withNotesTransaction(async (client) => {
    const current = await client.query(`SELECT folder_id FROM notes.items WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [itemId]);
    if (!current.rows[0]) throw notFoundError("That note");
    from = String(current.rows[0].folder_id);
    const folder = await client.query(`SELECT 1 FROM notes.folders WHERE id = $1 AND deleted_at IS NULL`, [folderId]);
    if (!folder.rows[0]) throw notFoundError("The destination folder");
    const sortOrder = await nextSortOrder(client, "items", "folder_id", folderId);
    await client.query(
      `UPDATE notes.items SET folder_id = $2, sort_order = $3, updated_by = $4, updated_at = now() WHERE id = $1`,
      [itemId, folderId, sortOrder, actor.userId],
    );
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_item", itemId, "notes.item.move", { folderId: from }, { folderId });
  return (await getAdminItem(itemId)).item;
}

export async function deleteItem(itemId: string, actor: AdminActor): Promise<void> {
  await withNotesTransaction(async (client) => {
    const result = await client.query(
      `UPDATE notes.items SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL`,
      [itemId, actor.userId],
    );
    if (!result.rowCount) throw notFoundError("That note");
    await bumpLibraryVersion(client);
  });
  await audit(actor, "notes_item", itemId, "notes.item.delete");
}

/** Brings an old version back as a new version (history is never rewritten). */
export async function restoreRevision(itemId: string, revisionId: string, actor: AdminActor): Promise<NotesAdminItem> {
  const revision = await getRevisionBody(itemId, revisionId);
  const current = await getItemRow(itemId);
  if (!current) throw notFoundError("That note");
  const restored = await updateItem(
    itemId,
    { baseVersion: current.version, title: revision.title, bodyMd: revision.bodyMd ?? undefined },
    actor,
  );
  await audit(actor, "notes_item", itemId, "notes.item.restore_version", undefined, { fromVersion: revision.version });
  return restored;
}
