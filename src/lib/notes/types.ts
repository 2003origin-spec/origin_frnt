/**
 * Origin Notes — shared, client-safe types (V1/NOTES_PLAN.md §6).
 *
 * Deliberately named `Notes*`: the bare `Note` type in `src/types/index.ts`
 * already means "NCERT reader annotation" (legacy app.notes store), and the two
 * must never be confused.
 */

export const NOTES_SUBJECTS = ["physics", "chemistry", "mathematics", "biology"] as const;
export type NotesSubject = (typeof NOTES_SUBJECTS)[number];

export const NOTES_CLASS_LEVELS = [9, 10, 11, 12] as const;
export type NotesClassLevel = (typeof NOTES_CLASS_LEVELS)[number];

export const NOTES_FOLDER_KINDS = ["class", "subject", "chapter", "folder"] as const;
export type NotesFolderKind = (typeof NOTES_FOLDER_KINDS)[number];

/** `inherit` = take the nearest parent folder's setting (root default: free). */
export const NOTES_ACCESS_VALUES = ["inherit", "free", "premium"] as const;
export type NotesAccess = (typeof NOTES_ACCESS_VALUES)[number];
export type NotesEffectiveAccess = "free" | "premium";

export const NOTES_FOLDER_STATUSES = ["draft", "published"] as const;
export type NotesFolderStatus = (typeof NOTES_FOLDER_STATUSES)[number];

export const NOTES_ITEM_STATUSES = ["draft", "in_review", "published"] as const;
export type NotesItemStatus = (typeof NOTES_ITEM_STATUSES)[number];

/** Shared-library item kinds. Phase 1 uploads accept pdf + image only. */
export const NOTES_ITEM_KINDS = ["typed", "pdf", "image"] as const;
export type NotesItemKind = (typeof NOTES_ITEM_KINDS)[number];

export const NOTES_NOTE_TYPES = ["formula_sheet", "short_notes", "key_points", "practice", "other"] as const;
export type NotesNoteType = (typeof NOTES_NOTE_TYPES)[number];

export const NOTES_EXAMS = ["jee", "neet", "boards"] as const;
export type NotesExam = (typeof NOTES_EXAMS)[number];

export const NOTES_REPORT_REASONS = ["mistake", "unclear", "broken", "other"] as const;

/** Why a student reports a file a friend shared (Phase 4). */
export const SHARED_REPORT_REASONS = ["inappropriate", "copyright", "spam", "other"] as const;
export type SharedReportReason = (typeof SHARED_REPORT_REASONS)[number];
export type NotesReportReason = (typeof NOTES_REPORT_REASONS)[number];

/** One `notes.folders` row as the server reads it (own values, not inherited). */
export type NotesFolderRow = {
  id: string;
  parentId: string | null;
  name: string;
  kind: NotesFolderKind;
  classLevel: number | null;
  subject: NotesSubject | null;
  syllabusKey: string | null;
  /** NCERT chapter number shown as "Ch 3"; null for non-chapter and exam-only folders. */
  ncertNumber: number | null;
  bankChapters: string[];
  exams: NotesExam[];
  access: NotesAccess;
  status: NotesFolderStatus;
  sortOrder: number;
  updatedAt: string;
};

/** Per-folder item counts used to build the tree. */
export type NotesFolderCounts = {
  published: number;
  inReview: number;
  draft: number;
};

/** A folder with every inherited value resolved (see `buildNotesTree`). */
export type NotesTreeNode = NotesFolderRow & {
  depth: number;
  /** Ancestor ids, root first, excluding the node itself. */
  path: string[];
  children: string[];
  effectiveClassLevel: number | null;
  effectiveSubject: NotesSubject | null;
  effectiveAccess: NotesEffectiveAccess;
  /** The folder and every ancestor are published. */
  visible: boolean;
  counts: NotesFolderCounts;
};

export type NotesTree = {
  nodes: Record<string, NotesTreeNode>;
  roots: string[];
};

export type NotesCrumb = { id: string; name: string };

// ─── Student-facing payloads ──────────────────────────────────────────────────

export type NotesFolderCard = {
  id: string;
  name: string;
  kind: NotesFolderKind;
  classLevel: number | null;
  subject: NotesSubject | null;
  ncertNumber: number | null;
  exams: NotesExam[];
  /** Published notes directly inside this folder. */
  noteCount: number;
  /** Visible sub-folders. */
  folderCount: number;
  locked: boolean;
};

export type NotesItemCard = {
  id: string;
  title: string;
  kind: NotesItemKind;
  noteType: NotesNoteType;
  pageCount: number | null;
  bytes: number | null;
  locked: boolean;
  starred: boolean;
  updatedAt: string;
};

export type NotesHomePayload = {
  classes: NotesFolderCard[];
  /** Student's own class, opened first. */
  ownClassLevel: number | null;
  continueReading: (NotesItemCard & { breadcrumb: NotesCrumb[] }) | null;
  starredCount: number;
};

export type NotesFolderPayload = {
  folder: NotesFolderCard & { practiseUrl: string | null };
  breadcrumb: NotesCrumb[];
  folders: NotesFolderCard[];
  items: NotesItemCard[];
  /** Subject folders hidden by the student's study mode ("Show all subjects"). */
  hiddenSubjects: number;
  showingAllSubjects: boolean;
};

export type NotesItemPayload = {
  item: NotesItemCard & {
    bodyMd: string | null;
    fileUrl: string | null;
    mime: string | null;
    folderId: string;
    /** The folder's subject — names the Premium plan that unlocks a locked note. */
    subject: NotesSubject | null;
  };
  breadcrumb: NotesCrumb[];
  prevId: string | null;
  nextId: string | null;
  practiseUrl: string | null;
};

export type NotesSearchHit = NotesItemCard & { breadcrumb: NotesCrumb[]; snippet: string | null };

// ─── Admin payloads ───────────────────────────────────────────────────────────

export type NotesAdminFolder = NotesFolderRow & {
  counts: NotesFolderCounts;
  effectiveAccess: NotesEffectiveAccess;
  effectiveSubject: NotesSubject | null;
  effectiveClassLevel: number | null;
  visible: boolean;
};

export type NotesAdminItem = {
  id: string;
  folderId: string;
  kind: NotesItemKind;
  noteType: NotesNoteType;
  title: string;
  bodyMd: string | null;
  mime: string | null;
  bytes: number | null;
  pageCount: number | null;
  originalName: string | null;
  access: NotesAccess;
  status: NotesItemStatus;
  source: "admin" | "import";
  externalKey: string | null;
  version: number;
  reviewerName: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  sortOrder: number;
  updatedAt: string;
  updatedByName: string | null;
};

export type NotesRevision = {
  id: string;
  version: number;
  title: string;
  editedByName: string | null;
  createdAt: string;
};
