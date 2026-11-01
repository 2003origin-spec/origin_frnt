/**
 * Origin Notes — what students can read in the shared library (V1/NOTES_PLAN.md §3).
 *
 * Visibility: an item is visible when it is published and its folder plus every
 * parent folder is published. Premium items stay listed (with a lock) so the
 * student knows they exist, but their content and files are refused. Subject
 * folders outside the student's study mode are hidden unless they ask for all.
 */

import {
  breadcrumbFor,
  defaultClassForStudent,
  effectiveItemAccess,
  isItemVisible,
  isLocked,
  practiseUrlFor,
  subjectLabel,
} from "@/lib/notes/rules";
import { fileTypeForMime, safeDownloadName } from "@/lib/notes/file-types";
import type {
  NotesFolderCard,
  NotesFolderPayload,
  NotesHomePayload,
  NotesItemCard,
  NotesItemPayload,
  NotesReportReason,
  NotesSearchHit,
  NotesSubject,
  NotesTree,
  NotesTreeNode,
} from "@/lib/notes/types";

import { createNotesReportId, notesPool } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { getItemRow, getLibraryTree, itemColumns, likePattern, listFolderItems, mapItemRow, type NotesItemRow } from "./library-store";
import { presignNotesGet } from "./notes-storage";

export type NotesViewer = {
  userId: string;
  /** Subjects the study mode allows; null = no study-mode filter. */
  modeSubjects: readonly NotesSubject[] | null;
  /** Subjects the student owns (all of them when premium isn't enforced). */
  ownedSubjects: readonly NotesSubject[];
};

function folderCard(tree: NotesTree, node: NotesTreeNode, viewer: NotesViewer): NotesFolderCard {
  return {
    id: node.id,
    name: node.name,
    kind: node.kind,
    classLevel: node.effectiveClassLevel,
    subject: node.effectiveSubject,
    ncertNumber: node.ncertNumber,
    exams: node.exams,
    noteCount: node.counts.published,
    folderCount: node.children.filter((id) => tree.nodes[id]?.visible).length,
    locked: isLocked(node.effectiveAccess, node.effectiveSubject, viewer.ownedSubjects),
  };
}

function itemCard(row: NotesItemRow, folder: NotesTreeNode, viewer: NotesViewer, starred: boolean): NotesItemCard {
  const access = effectiveItemAccess(row.access, folder);
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    noteType: row.noteType,
    pageCount: row.pageCount,
    bytes: row.bytes,
    locked: isLocked(access, folder.effectiveSubject, viewer.ownedSubjects),
    starred,
    updatedAt: row.updatedAt,
  };
}

function subjectOutsideMode(subject: NotesSubject | null, viewer: NotesViewer): boolean {
  return Boolean(viewer.modeSubjects && subject && !viewer.modeSubjects.includes(subject));
}

/** Subject folders the study mode hides (JEE hides Biology, NEET hides Maths). */
function hiddenByMode(node: NotesTreeNode, viewer: NotesViewer): boolean {
  return node.kind === "subject" && subjectOutsideMode(node.subject, viewer);
}

function visibleFolder(tree: NotesTree, folderId: string): NotesTreeNode {
  const node = tree.nodes[folderId];
  if (!node || !node.visible) throw notFoundError("That folder");
  return node;
}

async function starredIds(userId: string, itemIds: string[]): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();
  const result = await notesPool().query(
    `SELECT item_id FROM notes.stars WHERE user_id = $1 AND item_id = ANY($2::text[])`,
    [userId, itemIds],
  );
  return new Set(result.rows.map((row) => String(row.item_id)));
}

/** The visible, unlocked item or a NotesError explaining why not. */
async function readableItem(viewer: NotesViewer, itemId: string, withBody: boolean) {
  const tree = await getLibraryTree();
  const row = await getItemRow(itemId, { withBody });
  const folder = row ? tree.nodes[row.folderId] : undefined;
  if (!row || !folder || !isItemVisible(row.status, folder)) throw notFoundError("That note");
  const card = itemCard(row, folder, viewer, false);
  if (card.locked) {
    const subject = folder.effectiveSubject;
    throw new NotesError(
      403,
      "locked",
      subject ? `This note is part of ${subjectLabel(subject)} Premium.` : "This note is part of Premium.",
      { subject },
    );
  }
  return { tree, row, folder };
}

export async function getNotesHome(viewer: NotesViewer, studentClass: string | null): Promise<NotesHomePayload> {
  const tree = await getLibraryTree();
  const ownClassLevel = defaultClassForStudent(studentClass);
  const roots = tree.roots.map((id) => tree.nodes[id]).filter((node) => node?.visible);
  const ordered = [
    ...roots.filter((node) => node.kind === "class" && node.effectiveClassLevel === ownClassLevel),
    ...roots.filter((node) => !(node.kind === "class" && node.effectiveClassLevel === ownClassLevel)),
  ];

  const pool = notesPool();
  const [recent, stars] = await Promise.all([
    pool.query(
      `SELECT ${itemColumns("i")} FROM notes.views v JOIN notes.items i ON i.id = v.item_id
        WHERE v.user_id = $1 AND i.deleted_at IS NULL AND i.status = 'published'
        ORDER BY v.last_viewed_at DESC LIMIT 10`,
      [viewer.userId],
    ),
    pool.query(
      `SELECT i.folder_id FROM notes.stars s JOIN notes.items i ON i.id = s.item_id
        WHERE s.user_id = $1 AND i.deleted_at IS NULL AND i.status = 'published'`,
      [viewer.userId],
    ),
  ]);

  let continueReading: NotesHomePayload["continueReading"] = null;
  for (const raw of recent.rows) {
    const row = mapItemRow(raw);
    const folder = tree.nodes[row.folderId];
    if (!folder?.visible) continue;
    continueReading = { ...itemCard(row, folder, viewer, false), breadcrumb: breadcrumbFor(tree, folder.id) };
    break;
  }
  const starredCount = stars.rows.filter((row) => tree.nodes[String(row.folder_id)]?.visible).length;

  return {
    classes: ordered.map((node) => folderCard(tree, node, viewer)),
    ownClassLevel,
    continueReading,
    starredCount,
  };
}

export async function getNotesFolder(viewer: NotesViewer, folderId: string, showAll: boolean): Promise<NotesFolderPayload> {
  const tree = await getLibraryTree();
  const node = visibleFolder(tree, folderId);
  const children = node.children.map((id) => tree.nodes[id]).filter((child) => child?.visible);
  const hidden = showAll ? [] : children.filter((child) => hiddenByMode(child, viewer));
  const shown = children.filter((child) => !hidden.includes(child));

  const rows = await listFolderItems(folderId, { publishedOnly: true });
  const stars = await starredIds(viewer.userId, rows.map((row) => row.id));

  return {
    folder: { ...folderCard(tree, node, viewer), practiseUrl: practiseUrlFor(node) },
    breadcrumb: breadcrumbFor(tree, node.id),
    folders: shown.map((child) => folderCard(tree, child, viewer)),
    items: rows.map((row) => itemCard(row, node, viewer, stars.has(row.id))),
    hiddenSubjects: hidden.length,
    showingAllSubjects: showAll,
  };
}

export async function getNotesItem(viewer: NotesViewer, itemId: string): Promise<NotesItemPayload> {
  const tree = await getLibraryTree();
  const row = await getItemRow(itemId, { withBody: true });
  const folder = row ? tree.nodes[row.folderId] : undefined;
  if (!row || !folder || !isItemVisible(row.status, folder)) throw notFoundError("That note");
  const siblings = (await listFolderItems(folder.id, { publishedOnly: true })).map((item) => item.id);
  const index = siblings.indexOf(row.id);
  const stars = await starredIds(viewer.userId, [row.id]);
  const card = itemCard(row, folder, viewer, stars.has(row.id));

  // A locked note still answers 200 with its title, so the reader can show
  // what it is and how to unlock it; the text and the file stay withheld.
  if (!card.locked) {
    // A view is bookkeeping: never fail the read because it could not be saved.
    await notesPool()
      .query(
        `INSERT INTO notes.views (user_id, item_id) VALUES ($1, $2)
         ON CONFLICT (user_id, item_id) DO UPDATE
           SET view_count = notes.views.view_count + 1, last_viewed_at = now()`,
        [viewer.userId, row.id],
      )
      .catch((error) => console.error("[notes] view not recorded", error instanceof Error ? error.message : error));
  }

  return {
    item: {
      ...card,
      bodyMd: !card.locked && row.kind === "typed" ? row.bodyMd : null,
      fileUrl: !card.locked && row.kind !== "typed" ? `/api/notes/library/items/${encodeURIComponent(row.id)}/file` : null,
      mime: row.mime,
      folderId: folder.id,
      subject: folder.effectiveSubject,
    },
    breadcrumb: breadcrumbFor(tree, folder.id),
    prevId: index > 0 ? siblings[index - 1] : null,
    nextId: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
    practiseUrl: practiseUrlFor(folder),
  };
}

/** Short-lived signed link to a library file the viewer may open. */
export async function getNotesItemFileUrl(viewer: NotesViewer, itemId: string, download: boolean): Promise<string> {
  const { row } = await readableItem(viewer, itemId, false);
  const type = fileTypeForMime(row.mime);
  if (row.kind === "typed" || !row.fileKey || !type) throw notFoundError("That file");
  return presignNotesGet(row.fileKey, {
    contentType: type.mime,
    fileName: safeDownloadName(row.originalName ?? row.title, type),
    download,
  });
}

export async function searchNotes(viewer: NotesViewer, rawQuery: string): Promise<NotesSearchHit[]> {
  const query = rawQuery.replace(/\s+/gu, " ").trim().slice(0, 80);
  if (query.length < 2) return [];
  const tree = await getLibraryTree();
  const result = await notesPool().query(
    `SELECT ${itemColumns("i")}, i.body_text, f.name AS folder_name
       FROM notes.items i JOIN notes.folders f ON f.id = i.folder_id
      WHERE i.deleted_at IS NULL AND i.status = 'published' AND f.deleted_at IS NULL
        AND (i.title ILIKE $1 OR f.name ILIKE $1 OR i.body_text ILIKE $1)
      ORDER BY (i.title ILIKE $1) DESC, (f.name ILIKE $1) DESC, i.updated_at DESC
      LIMIT 60`,
    [likePattern(query)],
  );
  const hits: NotesSearchHit[] = [];
  const needle = query.toLowerCase();
  for (const raw of result.rows) {
    const row = mapItemRow(raw);
    const folder = tree.nodes[row.folderId];
    if (!folder?.visible || subjectOutsideMode(folder.effectiveSubject, viewer)) continue;
    const card = itemCard(row, folder, viewer, false);
    // A locked note's text never leaves the server: it can only be found by its
    // title or chapter name, and it gets no snippet (D16).
    if (card.locked && !row.title.toLowerCase().includes(needle) && !String(raw.folder_name ?? "").toLowerCase().includes(needle)) continue;
    const text = card.locked ? "" : typeof raw.body_text === "string" ? raw.body_text : "";
    const at = text.toLowerCase().indexOf(needle);
    const snippet = at === -1 ? null : `${at > 40 ? "…" : ""}${text.slice(Math.max(0, at - 40), at + needle.length + 60)}…`;
    hits.push({ ...card, breadcrumb: breadcrumbFor(tree, folder.id), snippet });
    if (hits.length >= 30) break;
  }
  return hits;
}

export async function setNotesStar(viewer: NotesViewer, itemId: string, starred: boolean): Promise<void> {
  const tree = await getLibraryTree();
  const row = await getItemRow(itemId);
  if (!row || !isItemVisible(row.status, tree.nodes[row.folderId])) throw notFoundError("That note");
  if (starred) {
    await notesPool().query(
      `INSERT INTO notes.stars (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [viewer.userId, itemId],
    );
  } else {
    await notesPool().query(`DELETE FROM notes.stars WHERE user_id = $1 AND item_id = $2`, [viewer.userId, itemId]);
  }
}

async function listByJoin(viewer: NotesViewer, sql: string): Promise<NotesSearchHit[]> {
  const tree = await getLibraryTree();
  const result = await notesPool().query(sql, [viewer.userId]);
  const out: NotesSearchHit[] = [];
  for (const raw of result.rows) {
    const row = mapItemRow(raw);
    const folder = tree.nodes[row.folderId];
    if (!folder?.visible) continue;
    out.push({ ...itemCard(row, folder, viewer, Boolean(raw.is_starred)), breadcrumb: breadcrumbFor(tree, folder.id), snippet: null });
  }
  return out;
}

export function listStarredNotes(viewer: NotesViewer): Promise<NotesSearchHit[]> {
  return listByJoin(
    viewer,
    `SELECT ${itemColumns("i")}, TRUE AS is_starred
       FROM notes.stars s JOIN notes.items i ON i.id = s.item_id
      WHERE s.user_id = $1 AND i.deleted_at IS NULL AND i.status = 'published'
      ORDER BY s.created_at DESC LIMIT 100`,
  );
}

export function listRecentNotes(viewer: NotesViewer): Promise<NotesSearchHit[]> {
  return listByJoin(
    viewer,
    `SELECT ${itemColumns("i")}, (s.item_id IS NOT NULL) AS is_starred
       FROM notes.views v JOIN notes.items i ON i.id = v.item_id
       LEFT JOIN notes.stars s ON s.item_id = v.item_id AND s.user_id = v.user_id
      WHERE v.user_id = $1 AND i.deleted_at IS NULL AND i.status = 'published'
      ORDER BY v.last_viewed_at DESC LIMIT 30`,
  );
}

export async function reportNotesItem(
  viewer: NotesViewer,
  itemId: string,
  reason: NotesReportReason,
  message: string | null,
): Promise<{ id: string }> {
  const tree = await getLibraryTree();
  const row = await getItemRow(itemId);
  if (!row || !isItemVisible(row.status, tree.nodes[row.folderId])) throw notFoundError("That note");
  // One open report per student per note: a second tap updates the message.
  const existing = await notesPool().query(
    `SELECT id FROM notes.reports WHERE reporter_id = $1 AND target_type = 'library_item' AND target_id = $2 AND status = 'open'`,
    [viewer.userId, itemId],
  );
  if (existing.rows[0]) {
    await notesPool().query(`UPDATE notes.reports SET reason = $2, message = $3, created_at = now() WHERE id = $1`, [
      existing.rows[0].id,
      reason,
      message,
    ]);
    return { id: String(existing.rows[0].id) };
  }
  const id = createNotesReportId();
  await notesPool().query(
    `INSERT INTO notes.reports (id, reporter_id, target_type, target_id, reason, message)
     VALUES ($1, $2, 'library_item', $3, $4, $5)`,
    [id, viewer.userId, itemId, reason, message],
  );
  return { id };
}

