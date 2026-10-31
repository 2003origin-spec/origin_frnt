/**
 * Origin Notes — pure rules (no I/O), shared by the server and the browser.
 * Unit-tested in tests/notes/notes-rules.test.ts. Plan: V1/NOTES_PLAN.md §6.
 */

import type {
  NotesCrumb,
  NotesEffectiveAccess,
  NotesFolderCounts,
  NotesFolderRow,
  NotesItemStatus,
  NotesSubject,
  NotesTree,
  NotesTreeNode,
} from "./types";
import { NOTES_SUBJECTS } from "./types";

export const NOTES_NAME_MAX = 120;
export const NOTES_TITLE_MAX = 160;
/** Typed-note body cap (characters). Long chapters split into several notes. */
export const NOTES_BODY_MAX = 200_000;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/u;

/** Collapses whitespace and checks a folder name. Returns the clean name or an error. */
export function cleanFolderName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(raw ?? "").replace(/\s+/gu, " ").trim();
  if (!name) return { ok: false, error: "Give the folder a name." };
  if (name.length > NOTES_NAME_MAX) return { ok: false, error: `Keep the name under ${NOTES_NAME_MAX} characters.` };
  if (CONTROL_CHARS.test(name) || /[\\/]/u.test(name)) {
    return { ok: false, error: "The name can't contain slashes or hidden characters." };
  }
  return { ok: true, name };
}

/** Same rules for note titles, with a longer limit. */
export function cleanTitle(raw: unknown): { ok: true; title: string } | { ok: false; error: string } {
  const title = String(raw ?? "").replace(/\s+/gu, " ").trim();
  if (!title) return { ok: false, error: "Give the note a title." };
  if (title.length > NOTES_TITLE_MAX) return { ok: false, error: `Keep the title under ${NOTES_TITLE_MAX} characters.` };
  if (CONTROL_CHARS.test(title)) return { ok: false, error: "The title can't contain hidden characters." };
  return { ok: true, title };
}

export function isNotesSubject(value: unknown): value is NotesSubject {
  return typeof value === "string" && (NOTES_SUBJECTS as readonly string[]).includes(value);
}

const SUBJECT_LABELS: Record<NotesSubject, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  mathematics: "Maths",
  biology: "Biology",
};

export function subjectLabel(subject: NotesSubject | null | undefined): string {
  return subject ? SUBJECT_LABELS[subject] : "";
}

/**
 * Which class folder opens first for a student. Class 9 and 10 students start
 * at Class 10 (there is no Class 9 library yet); droppers start at Class 12.
 */
export function defaultClassForStudent(studentClass: string | null | undefined): number | null {
  const raw = String(studentClass ?? "").trim().toLowerCase();
  if (raw === "9" || raw === "10") return 10;
  if (raw === "11") return 11;
  if (raw === "12" || raw === "dropper") return 12;
  return null;
}

const EMPTY_COUNTS: NotesFolderCounts = { published: 0, inReview: 0, draft: 0 };

function compareSiblings(a: NotesFolderRow, b: NotesFolderRow): number {
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" });
}

/**
 * Builds the folder tree and resolves every inherited value top-down:
 * class level, subject and Free/Premium come from the nearest folder that sets
 * them; a folder is `visible` only when it and all of its parents are published.
 *
 * Rows whose parent is missing (or that sit in a cycle, which the move rule
 * prevents but bad data could still contain) are left out rather than looping.
 */
export function buildNotesTree(
  rows: readonly NotesFolderRow[],
  counts: Readonly<Record<string, NotesFolderCounts>> = {},
): NotesTree {
  const byParent = new Map<string | null, NotesFolderRow[]>();
  for (const row of rows) {
    const key = row.parentId ?? null;
    const list = byParent.get(key);
    if (list) list.push(row);
    else byParent.set(key, [row]);
  }
  for (const list of byParent.values()) list.sort(compareSiblings);

  const nodes: Record<string, NotesTreeNode> = {};
  const roots: string[] = [];

  type Frame = { row: NotesFolderRow; parent: NotesTreeNode | null };
  const stack: Frame[] = (byParent.get(null) ?? []).map((row) => ({ row, parent: null })).reverse();

  while (stack.length > 0) {
    const { row, parent } = stack.pop()!;
    if (nodes[row.id]) continue; // cycle or duplicate — first placement wins
    const effectiveAccess: NotesEffectiveAccess =
      row.access === "inherit" ? (parent?.effectiveAccess ?? "free") : row.access;
    const node: NotesTreeNode = {
      ...row,
      depth: parent ? parent.depth + 1 : 0,
      path: parent ? [...parent.path, parent.id] : [],
      children: [],
      effectiveClassLevel: row.classLevel ?? parent?.effectiveClassLevel ?? null,
      effectiveSubject: row.subject ?? parent?.effectiveSubject ?? null,
      effectiveAccess,
      visible: row.status === "published" && (parent ? parent.visible : true),
      counts: counts[row.id] ?? EMPTY_COUNTS,
    };
    nodes[row.id] = node;
    if (parent) parent.children.push(row.id);
    else roots.push(row.id);
    const kids = byParent.get(row.id) ?? [];
    for (let i = kids.length - 1; i >= 0; i -= 1) stack.push({ row: kids[i], parent: node });
  }

  return { nodes, roots };
}

/** Root-first breadcrumb for a folder, including the folder itself. */
export function breadcrumbFor(tree: NotesTree, folderId: string): NotesCrumb[] {
  const node = tree.nodes[folderId];
  if (!node) return [];
  return [...node.path, node.id].map((id) => ({ id, name: tree.nodes[id]?.name ?? "" }));
}

/**
 * True when moving `folderId` under `newParentId` would put the folder inside
 * itself (directly or through any of its children).
 */
export function wouldCreateCycle(tree: NotesTree, folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === folderId) return true;
  const target = tree.nodes[newParentId];
  if (!target) return false;
  return target.path.includes(folderId);
}

/** Every folder id inside `folderId` (excluding it), depth-first. */
export function descendantIds(tree: NotesTree, folderId: string): string[] {
  const out: string[] = [];
  const stack = [...(tree.nodes[folderId]?.children ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    out.push(id);
    stack.push(...(tree.nodes[id]?.children ?? []));
  }
  return out;
}

/** An item's Free/Premium setting after inheritance from its folder. */
export function effectiveItemAccess(
  itemAccess: "inherit" | NotesEffectiveAccess,
  folder: Pick<NotesTreeNode, "effectiveAccess">,
): NotesEffectiveAccess {
  return itemAccess === "inherit" ? folder.effectiveAccess : itemAccess;
}

/** Students see an item only when it is published and its folder chain is visible. */
export function isItemVisible(status: NotesItemStatus, folder: Pick<NotesTreeNode, "visible"> | undefined): boolean {
  return status === "published" && Boolean(folder?.visible);
}

/**
 * Premium lock decision. `ownedSubjects` is the student's effective owned set
 * (ALL subjects when premium enforcement is off). Premium content with no
 * subject is unlocked by owning any subject.
 */
export function isLocked(
  access: NotesEffectiveAccess,
  subject: NotesSubject | null,
  ownedSubjects: readonly NotesSubject[],
): boolean {
  if (access === "free") return false;
  if (!subject) return ownedSubjects.length === 0;
  return !ownedSubjects.includes(subject);
}

/** Deep link into OG Code filtered to a chapter, or null when the folder isn't linked. */
export function practiseUrlFor(node: Pick<NotesTreeNode, "bankChapters" | "effectiveSubject" | "effectiveClassLevel">): string | null {
  const chapters = node.bankChapters.filter((chapter) => chapter.trim().length > 0);
  if (chapters.length === 0 || !node.effectiveSubject) return null;
  const params = new URLSearchParams();
  params.set("subjects", node.effectiveSubject);
  if (node.effectiveClassLevel) params.set("classes", String(node.effectiveClassLevel));
  for (const chapter of chapters) params.append("h_chapters", chapter);
  return `/ogcode?${params.toString()}`;
}

/** Lower-case, dash-separated slug for keys ("Motion in a Plane" → "motion-in-a-plane"). */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/&/gu, " and ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
}

/** "2.4 MB" style sizes for file rows. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

/** Reorders `ids` so `movingId` sits at `toIndex`; unknown ids are ignored. */
export function moveInList(ids: readonly string[], movingId: string, toIndex: number): string[] {
  const from = ids.indexOf(movingId);
  if (from === -1) return [...ids];
  const next = ids.filter((id) => id !== movingId);
  const clamped = Math.max(0, Math.min(toIndex, next.length));
  next.splice(clamped, 0, movingId);
  return next;
}
