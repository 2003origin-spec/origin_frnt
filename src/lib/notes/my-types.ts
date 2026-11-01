/**
 * Origin Notes — My Notes payloads shared by the API and the student UI
 * (V1/NOTES_PLAN.md §3 "My Notes", §7).
 */

import type { NotesFileKind } from "./file-types";
import type { MyFileKind, StorageLevel } from "./storage-rules";

export type MyStorageSummary = {
  usedBytes: number;
  reservedBytes: number;
  limitBytes: number;
  percent: number;
  level: StorageLevel;
  /** Bytes still held by items in the Bin (they count until the Bin is emptied). */
  binBytes: number;
  binCount: number;
  premium: boolean;
  hasPersonalLimit: boolean;
  uploadsEnabled: boolean;
  uploadsBlocked: boolean;
  /** Sharing with friends is switched on (flags + admin switch). */
  sharingOn: boolean;
  /** An admin turned sharing off for this student. */
  sharingBlocked: boolean;
  allowedKinds: NotesFileKind[];
  maxFileBytes: number;
  maxVideoBytes: number;
  typedMaxBytes: number;
  binDays: number;
};

export type MyCrumb = { id: string; name: string };

export type MyFolderCard = {
  id: string;
  name: string;
  folderCount: number;
  fileCount: number;
  updatedAt: string;
};

export type MyFileCard = {
  id: string;
  title: string;
  kind: MyFileKind;
  mime: string | null;
  bytes: number;
  pageCount: number | null;
  durationS: number | null;
  originalName: string | null;
  folderId: string | null;
  updatedAt: string;
};

export type MyFolderPayload = {
  folder: { id: string; name: string; parentId: string | null } | null;
  breadcrumb: MyCrumb[];
  folders: MyFolderCard[];
  files: MyFileCard[];
  storage: MyStorageSummary;
};

export type MyFilePayload = MyFileCard & {
  breadcrumb: MyCrumb[];
  bodyMd: string | null;
  version: number;
  /** pdf.js / <img> / <audio> / <video> can show it in the app. */
  previewable: boolean;
};

export type MyBinEntry = {
  id: string;
  type: "folder" | "file";
  title: string;
  kind: MyFileKind | null;
  /** Total bytes it frees when removed for good (a folder counts everything inside). */
  bytes: number;
  itemCount: number;
  deletedAt: string;
  expiresAt: string;
};

export type MyBinPayload = { entries: MyBinEntry[]; storage: MyStorageSummary };

export type MySearchHit =
  | { type: "folder"; id: string; name: string; breadcrumb: MyCrumb[] }
  | { type: "file"; file: MyFileCard; breadcrumb: MyCrumb[] };

export type MyUploadTicket = {
  uploadId: string;
  uploadUrl: string;
  /** Send exactly these headers with the PUT. */
  headers: Record<string, string>;
  expiresAt: string;
};

// ── Sharing with mutual friends (Phase 4) ──────────────────────────────────

export type ShareTargetType = "file" | "folder";

export type SharePerson = { id: string; name: string; username: string | null; avatar: string | null };

/** A mutual friend in the share sheet; `shareId` is set when they already have this item. */
export type ShareFriend = SharePerson & { shareId: string | null };

export type ShareOut = {
  shareId: string;
  recipient: SharePerson;
  targetType: ShareTargetType;
  targetId: string;
  targetTitle: string;
  createdAt: string;
};

export type SharedEntry = {
  shareId: string;
  type: ShareTargetType;
  title: string;
  /** For a shared file. */
  file: MyFileCard | null;
  sharedAt: string;
};

export type SharedWithMePayload = {
  groups: { owner: SharePerson; entries: SharedEntry[] }[];
};

export type SharedFolderPayload = {
  shareId: string;
  owner: SharePerson;
  folder: { id: string; name: string };
  /** From the shared folder down to this one. */
  breadcrumb: MyCrumb[];
  folders: MyFolderCard[];
  files: MyFileCard[];
};

export type SharedFilePayload = MyFilePayload & { shareId: string; owner: SharePerson };
