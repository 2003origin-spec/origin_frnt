/**
 * Origin Notes — sharing My Notes with mutual friends (V1/NOTES_PLAN.md §9, Phase 4).
 *
 * Who: only two students who follow each other in Origin Social. What: one
 * file or one folder (a folder includes everything inside it, even files
 * added later). The friend gets read-only access: open, play, download.
 *
 * Every open re-checks everything, so access ends the moment any of these
 * changes — and the answer is then a plain "not found", the same as for an
 * id that never existed:
 *   - the share is still active (not unshared);
 *   - both students still follow each other;
 *   - the shared item (and, inside a folder, every folder on the way) is not
 *     in the Bin;
 *   - neither student is blocked from sharing, and the owner's account is active;
 *   - the `notesSharing`/`studentSocial` flags and the Settings switch are on.
 */

import { isFeatureEnabled } from "@/lib/feature-flags";
import { fileTypeForMime, safeDownloadName } from "@/lib/notes/file-types";
import type {
  MyCrumb,
  MyFolderCard,
  ShareFriend,
  ShareOut,
  SharePerson,
  SharedEntry,
  SharedFilePayload,
  SharedFolderPayload,
  SharedWithMePayload,
  ShareTargetType,
} from "@/lib/notes/my-types";
import type { SharedReportReason } from "@/lib/notes/types";
import { createNotification } from "@/server/notifications";
import { areMutualFollowers, listMutualFollowers } from "@/server/social/social-service";
import { ensureSocialSchema } from "@/server/social/social-schema";
import { createPrefixedId } from "@/server/workspaces/ids";

import { CARD_COLUMNS, FILE_COLUMNS, mapMyFile, myBreadcrumb, type MyViewer } from "./my-notes";
import { getNotesSettings } from "./my-settings";
import { createNotesReportId, notesPool, toIso, toNumber, withNotesTransaction } from "./notes-db";
import { NotesError, notFoundError } from "./notes-errors";
import { ensureNotesSchema } from "./notes-schema";
import { presignNotesGet } from "./notes-storage";

/** New shares one student may create in 24 hours (on top of the per-hour rate limit). */
export const SHARE_DAILY_CAP = 50;
/** Friends one share request may name at once. */
export const SHARE_BATCH_MAX = 20;

const createShareId = () => createPrefixedId("nshr");
const missing = () => notFoundError("That shared note");

type ShareRow = { id: string; ownerId: string; recipientId: string; targetType: ShareTargetType; targetId: string; createdAt: string };

// ── Switches and blocks ─────────────────────────────────────────────────────

/** Sharing is on only when both flags AND the admin switch are on. */
export async function sharingSwitchedOn(): Promise<boolean> {
  if (!isFeatureEnabled("notesSharing") || !isFeatureEnabled("studentSocial")) return false;
  return (await getNotesSettings()).sharingEnabled;
}

async function requireSharingOn(): Promise<void> {
  if (!(await sharingSwitchedOn())) {
    throw new NotesError(403, "sharing_off", "Sharing notes with friends is switched off right now.");
  }
}

async function sharingBlocked(userId: string): Promise<boolean> {
  const row = await notesPool().query(`SELECT sharing_blocked FROM notes.storage WHERE user_id = $1`, [userId]);
  return Boolean(row.rows[0]?.sharing_blocked);
}

function person(row: Record<string, unknown>, prefix = ""): SharePerson {
  return {
    id: String(row[`${prefix}id`]),
    name: String(row[`${prefix}name`] ?? "Student"),
    username: (row[`${prefix}username`] as string | null) ?? null,
    avatar: (row[`${prefix}avatar`] as string | null) ?? null,
  };
}

async function personById(userId: string): Promise<SharePerson> {
  const row = await notesPool().query(`SELECT id, name, username, avatar FROM origin_users WHERE id = $1`, [userId]);
  return row.rows[0] ? person(row.rows[0]) : { id: userId, name: "Student", username: null, avatar: null };
}

// ── Owner side ──────────────────────────────────────────────────────────────

async function ownedTarget(ownerId: string, type: ShareTargetType, id: string): Promise<{ id: string; title: string }> {
  const result =
    type === "file"
      ? await notesPool().query(`SELECT id, title FROM notes.my_files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId])
      : await notesPool().query(`SELECT id, name AS title FROM notes.my_folders WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`, [id, ownerId]);
  const row = result.rows[0];
  if (!row) throw notFoundError(type === "file" ? "That note or file" : "That folder");
  return { id: String(row.id), title: String(row.title) };
}

/** Mutual friends for the share sheet, each marked if they already have this item. */
export async function listShareFriends(
  viewer: MyViewer,
  input: { query?: string; targetType?: ShareTargetType; targetId?: string },
): Promise<ShareFriend[]> {
  await requireSharingOn();
  await ensureNotesSchema();
  const friends = await listMutualFollowers(viewer.userId, input.query ?? "", 50);
  const shared = new Map<string, string>();
  if (input.targetType && input.targetId) {
    await ownedTarget(viewer.userId, input.targetType, input.targetId);
    const rows = await notesPool().query(
      `SELECT id, recipient_id FROM notes.shares
        WHERE owner_id = $1 AND target_type = $2 AND target_id = $3 AND revoked_at IS NULL`,
      [viewer.userId, input.targetType, input.targetId],
    );
    for (const row of rows.rows) shared.set(String(row.recipient_id), String(row.id));
  }
  return friends.map((friend) => ({
    id: friend.id,
    name: friend.name,
    username: friend.username,
    avatar: friend.avatar,
    shareId: shared.get(friend.id) ?? null,
  }));
}

export async function listSharesOut(viewer: MyViewer, target?: { type: ShareTargetType; id: string }): Promise<ShareOut[]> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `SELECT s.id, s.target_type, s.target_id, s.created_at,
            u.id AS r_id, u.name AS r_name, u.username AS r_username, u.avatar AS r_avatar,
            COALESCE(f.title, d.name) AS target_title
       FROM notes.shares s
       JOIN origin_users u ON u.id = s.recipient_id
       LEFT JOIN notes.my_files f ON s.target_type = 'file' AND f.id = s.target_id AND f.owner_id = s.owner_id
       LEFT JOIN notes.my_folders d ON s.target_type = 'folder' AND d.id = s.target_id AND d.owner_id = s.owner_id
      WHERE s.owner_id = $1 AND s.revoked_at IS NULL
        AND ($2::text IS NULL OR (s.target_type = $2 AND s.target_id = $3))
      ORDER BY s.created_at DESC
      LIMIT 500`,
    [viewer.userId, target?.type ?? null, target?.id ?? null],
  );
  return result.rows.map((row) => ({
    shareId: String(row.id),
    recipient: person(row, "r_"),
    targetType: row.target_type as ShareTargetType,
    targetId: String(row.target_id),
    targetTitle: String(row.target_title ?? "Deleted item"),
    createdAt: toIso(row.created_at),
  }));
}

/**
 * Share one of my files or folders with mutual friends. Friends who already
 * have it are skipped; anyone who isn't a mutual friend answers "not found".
 */
export async function createShares(
  viewer: MyViewer,
  input: { targetType: ShareTargetType; targetId: string; recipientIds: string[] },
): Promise<ShareOut[]> {
  await requireSharingOn();
  await ensureNotesSchema();
  if (await sharingBlocked(viewer.userId)) {
    throw new NotesError(403, "sharing_blocked", "Sharing is turned off for your account. Contact support if this is a mistake.");
  }
  const recipients = [...new Set(input.recipientIds)].filter((id) => id !== viewer.userId);
  if (recipients.length === 0) throw new NotesError(400, "no_friends", "Pick at least one friend.");
  if (recipients.length > SHARE_BATCH_MAX) throw new NotesError(400, "too_many_friends", `Share with up to ${SHARE_BATCH_MAX} friends at a time.`);
  const target = await ownedTarget(viewer.userId, input.targetType, input.targetId);
  for (const recipient of recipients) {
    // Same answer as for an unknown id, so the sheet can't be used to probe who follows whom.
    if (!(await areMutualFollowers(viewer.userId, recipient))) throw notFoundError("That friend");
  }

  const created = await withNotesTransaction(async (client) => {
    // One student's shares are counted under their own lock, so the daily cap holds.
    await client.query(`SELECT pg_advisory_xact_lock(4244, hashtext($1))`, [viewer.userId]);
    const today = await client.query(
      `SELECT COUNT(*) AS n FROM notes.shares WHERE owner_id = $1 AND created_at > now() - interval '24 hours'`,
      [viewer.userId],
    );
    const used = toNumber(today.rows[0]?.n) ?? 0;
    if (used + recipients.length > SHARE_DAILY_CAP) {
      throw new NotesError(429, "share_cap", `You can share up to ${SHARE_DAILY_CAP} times a day. Try again tomorrow.`);
    }
    const ids: { id: string; recipient: string }[] = [];
    for (const recipient of recipients) {
      const id = createShareId();
      const inserted = await client.query(
        `INSERT INTO notes.shares (id, owner_id, recipient_id, target_type, target_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (target_type, target_id, recipient_id) WHERE revoked_at IS NULL DO NOTHING
         RETURNING id`,
        [id, viewer.userId, recipient, input.targetType, target.id],
      );
      if (inserted.rows[0]) ids.push({ id, recipient });
    }
    return ids;
  });

  if (created.length > 0) {
    const me = await personById(viewer.userId);
    for (const share of created) {
      await createNotification(share.recipient, {
        type: "info",
        title: "Notes shared with you",
        message: `${me.name} shared “${target.title}” with you`,
        href: input.targetType === "file" ? `/notes?tab=shared&share=${share.id}&sfile=${target.id}` : `/notes?tab=shared&share=${share.id}`,
      });
    }
  }
  return listSharesOut(viewer, { type: input.targetType, id: target.id });
}

/** Unshare. Only the owner can, and the friend loses access at once. */
export async function revokeShare(viewer: MyViewer, shareId: string): Promise<void> {
  await ensureNotesSchema();
  const result = await notesPool().query(
    `UPDATE notes.shares SET revoked_at = now(), revoked_by = $2 WHERE id = $1 AND owner_id = $2 AND revoked_at IS NULL RETURNING id`,
    [shareId, viewer.userId],
  );
  if (!result.rows[0]) throw notFoundError("That share");
}

// ── Friend side ─────────────────────────────────────────────────────────────

/**
 * SQL conditions (on alias `s`) for a share the recipient may still use.
 * Kept in one place so the list and every single open agree exactly.
 */
const USABLE_SHARE = `
  s.revoked_at IS NULL
  AND EXISTS (SELECT 1 FROM social.follows a WHERE a.follower_id = s.owner_id AND a.following_id = s.recipient_id)
  AND EXISTS (SELECT 1 FROM social.follows b WHERE b.follower_id = s.recipient_id AND b.following_id = s.owner_id)
  AND NOT EXISTS (SELECT 1 FROM notes.storage st WHERE st.user_id IN (s.owner_id, s.recipient_id) AND st.sharing_blocked)
  AND EXISTS (SELECT 1 FROM origin_users o WHERE o.id = s.owner_id AND COALESCE(o.account_status, 'active') = 'active')
  AND (
    (s.target_type = 'file' AND EXISTS (
       SELECT 1 FROM notes.my_files f WHERE f.id = s.target_id AND f.owner_id = s.owner_id AND f.deleted_at IS NULL))
    OR (s.target_type = 'folder' AND EXISTS (
       SELECT 1 FROM notes.my_folders d WHERE d.id = s.target_id AND d.owner_id = s.owner_id AND d.deleted_at IS NULL))
  )`;

/** A share this viewer may open right now, or "not found". */
async function usableShare(viewer: MyViewer, shareId: string): Promise<ShareRow> {
  await requireSharingOn();
  await ensureNotesSchema();
  await ensureSocialSchema();
  const result = await notesPool().query(
    `SELECT s.id, s.owner_id, s.recipient_id, s.target_type, s.target_id, s.created_at
       FROM notes.shares s
      WHERE s.id = $1 AND s.recipient_id = $2 AND ${USABLE_SHARE}`,
    [shareId, viewer.userId],
  );
  const row = result.rows[0];
  if (!row) throw missing();
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    recipientId: String(row.recipient_id),
    targetType: row.target_type as ShareTargetType,
    targetId: String(row.target_id),
    createdAt: toIso(row.created_at),
  };
}

export async function listSharedWithMe(viewer: MyViewer): Promise<SharedWithMePayload> {
  await requireSharingOn();
  await ensureNotesSchema();
  await ensureSocialSchema();
  const result = await notesPool().query(
    `SELECT s.id AS share_id, s.target_type, s.target_id, s.created_at AS shared_at,
            o.id AS o_id, o.name AS o_name, o.username AS o_username, o.avatar AS o_avatar,
            d.name AS folder_name,
            f.id, f.title, f.kind, f.mime, f.bytes, f.page_count, f.duration_s, f.original_name, f.folder_id, f.updated_at
       FROM notes.shares s
       JOIN origin_users o ON o.id = s.owner_id
       LEFT JOIN notes.my_files f ON s.target_type = 'file' AND f.id = s.target_id
       LEFT JOIN notes.my_folders d ON s.target_type = 'folder' AND d.id = s.target_id
      WHERE s.recipient_id = $1 AND ${USABLE_SHARE}
      ORDER BY o.name, s.created_at DESC
      LIMIT 500`,
    [viewer.userId],
  );
  const groups = new Map<string, { owner: SharePerson; entries: SharedEntry[] }>();
  for (const row of result.rows) {
    const owner = person(row, "o_");
    const group = groups.get(owner.id) ?? { owner, entries: [] };
    const file = row.target_type === "file" ? mapMyFile(row) : null;
    group.entries.push({
      shareId: String(row.share_id),
      type: row.target_type as ShareTargetType,
      title: file ? file.title : String(row.folder_name ?? "Folder"),
      file,
      sharedAt: toIso(row.shared_at),
    });
    groups.set(owner.id, group);
  }
  return { groups: [...groups.values()] };
}

/**
 * The live folder chain from the shared folder down to `folderId`, or null
 * when `folderId` isn't inside the shared folder (or something on the way is
 * in the Bin).
 */
async function chainInsideShare(share: ShareRow, folderId: string | null): Promise<MyCrumb[] | null> {
  if (!folderId) return null;
  const chain = await myBreadcrumb(notesPool(), share.ownerId, folderId);
  const at = chain.findIndex((crumb) => crumb.id === share.targetId);
  return at === -1 ? null : chain.slice(at);
}

export async function getSharedFolder(viewer: MyViewer, shareId: string, folderId: string | null): Promise<SharedFolderPayload> {
  const share = await usableShare(viewer, shareId);
  if (share.targetType !== "folder") throw missing();
  const at = folderId ?? share.targetId;
  const breadcrumb = await chainInsideShare(share, at);
  if (!breadcrumb) throw missing();
  const db = notesPool();
  const [folders, files] = await Promise.all([
    db.query(
      `SELECT f.id, f.name, f.updated_at,
              (SELECT COUNT(*) FROM notes.my_folders c WHERE c.parent_id = f.id AND c.deleted_at IS NULL) AS folder_count,
              (SELECT COUNT(*) FROM notes.my_files x WHERE x.folder_id = f.id AND x.deleted_at IS NULL) AS file_count
         FROM notes.my_folders f
        WHERE f.owner_id = $1 AND f.parent_id = $2 AND f.deleted_at IS NULL
        ORDER BY lower(f.name) LIMIT 1000`,
      [share.ownerId, at],
    ),
    db.query(
      `SELECT ${CARD_COLUMNS} FROM notes.my_files
        WHERE owner_id = $1 AND folder_id = $2 AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 1000`,
      [share.ownerId, at],
    ),
  ]);
  return {
    shareId,
    owner: await personById(share.ownerId),
    folder: { id: at, name: breadcrumb[breadcrumb.length - 1]?.name ?? "Folder" },
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
  };
}

/** A file in a share: the shared file itself, or a live file inside the shared folder. */
async function sharedFileRow(share: ShareRow, fileId: string) {
  const result = await notesPool().query(
    `SELECT ${FILE_COLUMNS}, file_key FROM notes.my_files WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [fileId, share.ownerId],
  );
  const row = result.rows[0];
  if (!row) throw missing();
  if (share.targetType === "file") {
    if (String(row.id) !== share.targetId) throw missing();
    return { row, breadcrumb: [] as MyCrumb[] };
  }
  const breadcrumb = await chainInsideShare(share, (row.folder_id as string | null) ?? null);
  if (!breadcrumb) throw missing();
  return { row, breadcrumb };
}

export async function getSharedFile(viewer: MyViewer, shareId: string, fileId: string): Promise<SharedFilePayload> {
  const share = await usableShare(viewer, shareId);
  const { row, breadcrumb } = await sharedFileRow(share, fileId);
  const card = mapMyFile(row);
  const type = card.mime ? fileTypeForMime(card.mime) : null;
  return {
    ...card,
    breadcrumb,
    bodyMd: card.kind === "typed" ? String(row.body_md ?? "") : null,
    version: toNumber(row.version) ?? 1,
    previewable: card.kind === "typed" || Boolean(type?.previewable),
    shareId,
    owner: await personById(share.ownerId),
  };
}

export async function getSharedFileUrl(viewer: MyViewer, shareId: string, fileId: string, download: boolean): Promise<string> {
  const share = await usableShare(viewer, shareId);
  const { row } = await sharedFileRow(share, fileId);
  const type = fileTypeForMime(String(row.mime ?? ""));
  if (!row.file_key || !type) throw missing();
  return presignNotesGet(String(row.file_key), {
    contentType: type.mime,
    fileName: safeDownloadName((row.original_name as string | null) || String(row.title), type),
    download: download || !type.previewable,
    expiresSeconds: type.kind === "video" ? 3600 : 600,
  });
}

/** Report a file a friend shared. One open report per student per file; it reaches admin Reports. */
export async function reportSharedFile(
  viewer: MyViewer,
  shareId: string,
  fileId: string,
  reason: SharedReportReason,
  message: string | null,
): Promise<{ id: string }> {
  const share = await usableShare(viewer, shareId);
  await sharedFileRow(share, fileId);
  const existing = await notesPool().query(
    `UPDATE notes.reports SET reason = $3, message = $4, created_at = now()
      WHERE reporter_id = $1 AND target_type = 'shared_file' AND target_id = $2 AND status = 'open'
      RETURNING id`,
    [viewer.userId, fileId, reason, message?.slice(0, 1000) ?? null],
  );
  if (existing.rows[0]) return { id: String(existing.rows[0].id) };
  const id = createNotesReportId();
  await notesPool().query(
    `INSERT INTO notes.reports (id, reporter_id, target_type, target_id, reason, message, share_id)
     VALUES ($1, $2, 'shared_file', $3, $4, $5, $6)`,
    [id, viewer.userId, fileId, reason, message?.slice(0, 1000) ?? null, shareId],
  );
  return { id };
}
