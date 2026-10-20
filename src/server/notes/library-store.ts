/**
 * Origin Notes — shared-library row access and the cached folder tree.
 *
 * The whole folder tree is small (a few hundred folders), so it is loaded in
 * one query, resolved in memory (`buildNotesTree`) and kept per process. Every
 * admin write bumps `notes.library_state.version` in the same transaction;
 * each read checks that one number and reloads the tree only when it moved.
 * No time-based cache: a publish shows up on the next request.
 */

import type { PoolClient } from "pg";

import { buildNotesTree } from "@/lib/notes/rules";
import type {
  NotesAccess,
  NotesExam,
  NotesFolderCounts,
  NotesFolderKind,
  NotesFolderRow,
  NotesFolderStatus,
  NotesItemKind,
  NotesItemStatus,
  NotesNoteType,
  NotesSubject,
  NotesTree,
} from "@/lib/notes/types";

import { notesPool, toIso, toIsoOrNull, toNumber } from "./notes-db";
import { ensureNotesSchema } from "./notes-schema";

declare global {
  var __originNotesTreeCache: { version: number; tree: NotesTree } | undefined;
  var __originNotesTreeLoading: Promise<{ version: number; tree: NotesTree }> | undefined;
}

type Queryable = Pick<PoolClient, "query">;

export const FOLDER_COLUMNS = `id, parent_id, name, kind, class_level, subject, syllabus_key, ncert_number,
  bank_chapters, exams, access, status, sort_order, updated_at`;

export function mapFolderRow(row: Record<string, unknown>): NotesFolderRow {
  return {
    id: String(row.id),
    parentId: (row.parent_id as string | null) ?? null,
    name: String(row.name),
    kind: row.kind as NotesFolderKind,
    classLevel: toNumber(row.class_level),
    subject: (row.subject as NotesSubject | null) ?? null,
    syllabusKey: (row.syllabus_key as string | null) ?? null,
    ncertNumber: toNumber(row.ncert_number),
    bankChapters: Array.isArray(row.bank_chapters) ? (row.bank_chapters as string[]) : [],
    exams: Array.isArray(row.exams) ? (row.exams as NotesExam[]) : [],
    access: row.access as NotesAccess,
    status: row.status as NotesFolderStatus,
    sortOrder: toNumber(row.sort_order) ?? 0,
    updatedAt: toIso(row.updated_at),
  };
}

export type NotesItemRow = {
  id: string;
  folderId: string;
  kind: NotesItemKind;
  noteType: NotesNoteType;
  title: string;
  bodyMd: string | null;
  fileKey: string | null;
  mime: string | null;
  bytes: number | null;
  pageCount: number | null;
  originalName: string | null;
  access: NotesAccess;
  status: NotesItemStatus;
  source: "admin" | "import";
  externalKey: string | null;
  importHash: string | null;
  version: number;
  reviewerName: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
  deletedAt: string | null;
};

/** Columns for item rows; `body_md` only when asked for (it can be large). */
export function itemColumns(alias = "i", withBody = false): string {
  const cols = [
    "id", "folder_id", "kind", "note_type", "title", "file_key", "mime", "bytes", "page_count",
    "original_name", "access", "status", "source", "external_key", "import_hash", "version",
    "reviewer_name", "reviewed_at", "published_at", "sort_order", "updated_at", "updated_by", "deleted_at",
  ];
  if (withBody) cols.push("body_md");
  return cols.map((col) => `${alias}.${col}`).join(", ");
}

export function mapItemRow(row: Record<string, unknown>): NotesItemRow {
  return {
    id: String(row.id),
    folderId: String(row.folder_id),
    kind: row.kind as NotesItemKind,
    noteType: row.note_type as NotesNoteType,
    title: String(row.title),
    bodyMd: typeof row.body_md === "string" ? row.body_md : null,
    fileKey: (row.file_key as string | null) ?? null,
    mime: (row.mime as string | null) ?? null,
    bytes: toNumber(row.bytes),
    pageCount: toNumber(row.page_count),
    originalName: (row.original_name as string | null) ?? null,
    access: row.access as NotesAccess,
    status: row.status as NotesItemStatus,
    source: (row.source as "admin" | "import") ?? "admin",
    externalKey: (row.external_key as string | null) ?? null,
    importHash: (row.import_hash as string | null) ?? null,
    version: toNumber(row.version) ?? 1,
    reviewerName: (row.reviewer_name as string | null) ?? null,
    reviewedAt: toIsoOrNull(row.reviewed_at),
    publishedAt: toIsoOrNull(row.published_at),
    sortOrder: toNumber(row.sort_order) ?? 0,
    updatedAt: toIso(row.updated_at),
    updatedBy: (row.updated_by as string | null) ?? null,
    deletedAt: toIsoOrNull(row.deleted_at),
  };
}

async function loadTree(db: Queryable): Promise<NotesTree> {
  const [folders, counts] = await Promise.all([
    db.query(`SELECT ${FOLDER_COLUMNS} FROM notes.folders WHERE deleted_at IS NULL`),
    db.query(
      `SELECT folder_id,
              count(*) FILTER (WHERE status = 'published') AS published,
              count(*) FILTER (WHERE status = 'in_review') AS in_review,
              count(*) FILTER (WHERE status = 'draft')     AS draft
         FROM notes.items
        WHERE deleted_at IS NULL
        GROUP BY folder_id`,
    ),
  ]);
  const byFolder: Record<string, NotesFolderCounts> = {};
  for (const row of counts.rows) {
    byFolder[String(row.folder_id)] = {
      published: toNumber(row.published) ?? 0,
      inReview: toNumber(row.in_review) ?? 0,
      draft: toNumber(row.draft) ?? 0,
    };
  }
  return buildNotesTree(folders.rows.map(mapFolderRow), byFolder);
}

async function currentVersion(db: Queryable): Promise<number> {
  const result = await db.query(`SELECT version FROM notes.library_state WHERE id`);
  return toNumber(result.rows[0]?.version) ?? 0;
}

/** The resolved folder tree (drafts included — callers filter on `visible`). */
export async function getLibraryTree(): Promise<NotesTree> {
  await ensureNotesSchema();
  const pool = notesPool();
  const version = await currentVersion(pool);
  const cached = globalThis.__originNotesTreeCache;
  if (cached && cached.version === version) return cached.tree;
  if (!globalThis.__originNotesTreeLoading) {
    globalThis.__originNotesTreeLoading = (async () => {
      // Read the version again with the rows: if a write lands in between, the
      // next request sees a newer version and reloads — never a stale tree.
      const tree = await loadTree(pool);
      const entry = { version, tree };
      globalThis.__originNotesTreeCache = entry;
      return entry;
    })().finally(() => {
      globalThis.__originNotesTreeLoading = undefined;
    });
  }
  return (await globalThis.__originNotesTreeLoading).tree;
}

/** A fresh tree read inside a transaction (admin writes check moves against it). */
export async function loadLibraryTreeWith(client: Queryable): Promise<NotesTree> {
  return loadTree(client);
}

export async function getItemRow(itemId: string, options: { withBody?: boolean; includeDeleted?: boolean } = {}): Promise<NotesItemRow | null> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT ${itemColumns("i", options.withBody)} FROM notes.items i
      WHERE i.id = $1 ${options.includeDeleted ? "" : "AND i.deleted_at IS NULL"}`,
    [itemId],
  );
  return result.rows[0] ? mapItemRow(result.rows[0]) : null;
}

export async function listFolderItems(folderId: string, options: { publishedOnly: boolean }): Promise<NotesItemRow[]> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT ${itemColumns("i")} FROM notes.items i
      WHERE i.folder_id = $1 AND i.deleted_at IS NULL ${options.publishedOnly ? "AND i.status = 'published'" : ""}
      ORDER BY i.sort_order, lower(i.title)`,
    [folderId],
  );
  return result.rows.map(mapItemRow);
}

/** Escapes LIKE wildcards in user search text. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/gu, (c) => `\\${c}`)}%`;
}
