/**
 * Origin Notes — sharing My Notes with mutual friends, against a real Postgres
 * (V1/NOTES_PLAN.md §9). Needs USER_DATABASE_URL (and OGCODE_DATABASE_URL, same
 * DB) pointing at a THROWAWAY database — it empties the My Notes tables, so run
 * it on its own (`--test-concurrency=1` with the other notes suites):
 *
 *   USER_DATABASE_URL=… OGCODE_DATABASE_URL=… \
 *   npx tsx --conditions=react-server --test tests/integration/notes-sharing.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ensureUserSchema } from "@/server/db-users";
import { ensureWorkspaceSchema } from "@/server/workspaces/schema";
import { ensureSocialSchema } from "@/server/social/social-schema";
import { ensureNotesSchema } from "@/server/notes/notes-schema";
import { NotesError } from "@/server/notes/notes-errors";
import { createMyFolder, createMyTypedNote, deleteMyFile, deleteMyFolder, emptyMyBin, restoreFromMyBin, updateMyFile } from "@/server/notes/my-notes";
import {
  createShares,
  getSharedFile,
  getSharedFolder,
  listShareFriends,
  listSharedWithMe,
  listSharesOut,
  reportSharedFile,
  revokeShare,
  SHARE_DAILY_CAP,
} from "@/server/notes/my-shares";
import { listSharedReports, removeReportedFile } from "@/server/notes/my-shares-admin";
import { getStorageUser, updateStorageUser } from "@/server/notes/my-admin";
import { updateNotesSettings } from "@/server/notes/my-settings";
import { getStorageSummary } from "@/server/notes/my-storage";
import { getUserPostgresPool } from "@/server/user-postgres";

import { dbConfigured, makeId } from "./_db";

const skip = !dbConfigured();

// The server code checks the flags itself; turn sharing on for this run.
process.env.TEACHER_LAUNCH_NOTES_SHARING = "1";
process.env.TEACHER_LAUNCH_STUDENT_SOCIAL = "1";

const adminId = makeId("user_share_admin");
const aliceId = makeId("user_share_alice");
const bobId = makeId("user_share_bob");
const carolId = makeId("user_share_carol");
const admin = { userId: adminId };
const alice = { userId: aliceId };
const bob = { userId: bobId };
const carol = { userId: carolId };

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("no pool");
  return p;
}

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const actual = error instanceof NotesError ? error.code : (error as { code?: string }).code;
    assert.equal(actual, code, `expected ${code}, got ${String(error)}`);
    return;
  }
  assert.fail(`expected ${code}`);
}

async function follow(from: string, to: string) {
  await pool().query(`INSERT INTO social.follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [from, to]);
}
async function unfollow(from: string, to: string) {
  await pool().query(`DELETE FROM social.follows WHERE follower_id = $1 AND following_id = $2`, [from, to]);
}

test("Sharing My Notes with mutual friends", { skip }, async (t) => {
  await ensureUserSchema();
  await ensureWorkspaceSchema();
  // Earlier runs of the other notes suites leave users without a username, and
  // Social's one-time backfill would give every "Alice" the same handle. Give
  // them the unique fallback handle first so the Social schema can apply.
  await pool().query(`ALTER TABLE origin_users ADD COLUMN IF NOT EXISTS username TEXT`);
  await pool().query(`UPDATE origin_users SET username = 'user_' || LOWER(id) WHERE username IS NULL OR TRIM(username) = ''`);
  await ensureSocialSchema();
  await ensureNotesSchema();
  const tag = Math.random().toString(36).slice(2, 8);
  await pool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash, username) VALUES
       ($1, 'Share Admin', $2, 'admin', 'test-no-login', NULL),
       ($3, 'Alice', $4, 'student', 'test-no-login', $5),
       ($6, 'Bob', $7, 'student', 'test-no-login', $8),
       ($9, 'Carol', $10, 'student', 'test-no-login', $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      adminId, `${adminId}@example.com`,
      aliceId, `${aliceId}@example.com`, `alice_${tag}`,
      bobId, `${bobId}@example.com`, `bob_${tag}`,
      carolId, `${carolId}@example.com`, `carol_${tag}`,
    ],
  );
  await pool().query(`TRUNCATE notes.my_files, notes.my_folders, notes.storage, notes.shares CASCADE`);
  await pool().query(`DELETE FROM notes.reports WHERE target_type = 'shared_file'`);
  await updateNotesSettings({ sharingEnabled: true }, admin);

  // Alice and Bob follow each other; Alice follows Carol, who doesn't follow back.
  await follow(aliceId, bobId);
  await follow(bobId, aliceId);
  await follow(aliceId, carolId);

  const physics = (await createMyFolder(alice, { parentId: null, name: "Physics" })).id;
  const waves = (await createMyFolder(alice, { parentId: physics, name: "Waves" })).id;
  const kinematics = (await createMyTypedNote(alice, { folderId: physics, title: "Kinematics", bodyMd: "v = u + at" })).id;
  const sound = (await createMyTypedNote(alice, { folderId: waves, title: "Sound", bodyMd: "v = f λ" })).id;
  const diary = (await createMyTypedNote(alice, { folderId: null, title: "Diary", bodyMd: "private" })).id;
  let folderShare = "";

  await t.test("only mutual friends are offered and accepted", async () => {
    const friends = await listShareFriends(alice, { targetType: "folder", targetId: physics });
    assert.deepEqual(friends.map((f) => f.id), [bobId]);
    assert.equal(friends[0].shareId, null);
    await expectCode(createShares(alice, { targetType: "folder", targetId: physics, recipientIds: [carolId] }), "not_found");
    await expectCode(createShares(bob, { targetType: "folder", targetId: physics, recipientIds: [aliceId] }), "not_found");
    const storage = await getStorageSummary(aliceId);
    assert.equal(storage.sharingOn, true);
    assert.equal(storage.sharingBlocked, false);
  });

  await t.test("sharing a folder twice keeps one share", async () => {
    const first = await createShares(alice, { targetType: "folder", targetId: physics, recipientIds: [bobId, aliceId] });
    assert.equal(first.length, 1, "sharing with yourself is ignored");
    folderShare = first[0].shareId;
    const again = await createShares(alice, { targetType: "folder", targetId: physics, recipientIds: [bobId] });
    assert.equal(again.length, 1);
    assert.equal(again[0].shareId, folderShare);
    const friends = await listShareFriends(alice, { targetType: "folder", targetId: physics });
    assert.equal(friends[0].shareId, folderShare);
  });

  await t.test("the friend sees the folder, everything inside it, and nothing else", async () => {
    const mine = await listSharedWithMe(bob);
    assert.equal(mine.groups.length, 1);
    assert.equal(mine.groups[0].owner.id, aliceId);
    assert.deepEqual(mine.groups[0].entries.map((e) => [e.type, e.title]), [["folder", "Physics"]]);

    const top = await getSharedFolder(bob, folderShare, null);
    assert.deepEqual(top.folders.map((f) => f.name), ["Waves"]);
    assert.deepEqual(top.files.map((f) => f.title), ["Kinematics"]);
    const inner = await getSharedFolder(bob, folderShare, waves);
    assert.deepEqual(inner.breadcrumb.map((c) => c.name), ["Physics", "Waves"]);
    assert.equal((await getSharedFile(bob, folderShare, sound)).bodyMd, "v = f λ");

    await expectCode(getSharedFile(bob, folderShare, diary), "not_found");
    await expectCode(getSharedFolder(carol, folderShare, null), "not_found");
    await expectCode(getSharedFolder(alice, folderShare, null), "not_found");
    assert.equal((await listSharedWithMe(carol)).groups.length, 0);
  });

  await t.test("new files appear; files moved out disappear", async () => {
    const later = (await createMyTypedNote(alice, { folderId: waves, title: "Doppler", bodyMd: "f' = f (v ± vo)/(v ∓ vs)" })).id;
    assert.equal((await getSharedFile(bob, folderShare, later)).title, "Doppler");
    await updateMyFile(alice, later, { folderId: null });
    await expectCode(getSharedFile(bob, folderShare, later), "not_found");
  });

  await t.test("the Bin pauses access and restoring brings it back", async () => {
    await deleteMyFolder(alice, waves);
    await expectCode(getSharedFile(bob, folderShare, sound), "not_found");
    await expectCode(getSharedFolder(bob, folderShare, waves), "not_found");
    await restoreFromMyBin(alice, waves);
    assert.equal((await getSharedFile(bob, folderShare, sound)).title, "Sound");
  });

  await t.test("unfollowing ends access at once; following back restores it", async () => {
    await unfollow(bobId, aliceId);
    await expectCode(getSharedFolder(bob, folderShare, null), "not_found");
    assert.equal((await listSharedWithMe(bob)).groups.length, 0);
    await follow(bobId, aliceId);
    assert.equal((await getSharedFolder(bob, folderShare, null)).folder.name, "Physics");
  });

  await t.test("a sharing block hides everything the student shared", async () => {
    await getStorageUser(aliceId);
    await updateStorageUser(aliceId, { sharingBlocked: true, blockReason: "test" }, admin);
    await expectCode(getSharedFolder(bob, folderShare, null), "not_found");
    await expectCode(createShares(alice, { targetType: "file", targetId: diary, recipientIds: [bobId] }), "sharing_blocked");
    assert.equal((await getStorageSummary(aliceId)).sharingBlocked, true);
    await updateStorageUser(aliceId, { sharingBlocked: false }, admin);
    assert.equal((await getSharedFolder(bob, folderShare, null)).folder.name, "Physics");
  });

  await t.test("the admin switch turns sharing off everywhere", async () => {
    await updateNotesSettings({ sharingEnabled: false }, admin);
    try {
      await expectCode(getSharedFolder(bob, folderShare, null), "sharing_off");
      await expectCode(createShares(alice, { targetType: "file", targetId: diary, recipientIds: [bobId] }), "sharing_off");
      assert.equal((await getStorageSummary(aliceId)).sharingOn, false);
    } finally {
      await updateNotesSettings({ sharingEnabled: true }, admin);
    }
  });

  await t.test("a shared file; only the owner can unshare", async () => {
    const [share] = await createShares(alice, { targetType: "file", targetId: diary, recipientIds: [bobId] });
    assert.equal((await getSharedFile(bob, share.shareId, diary)).bodyMd, "private");
    await expectCode(getSharedFile(bob, share.shareId, kinematics), "not_found");
    await expectCode(getSharedFolder(bob, share.shareId, null), "not_found");
    assert.equal((await listSharesOut(alice)).length, 2);
    await expectCode(revokeShare(bob, share.shareId), "not_found");
    await revokeShare(alice, share.shareId);
    await expectCode(getSharedFile(bob, share.shareId, diary), "not_found");
    // Sharing again later makes a new share.
    const [again] = await createShares(alice, { targetType: "file", targetId: diary, recipientIds: [bobId] });
    assert.notEqual(again.shareId, share.shareId);
  });

  await t.test("removing an item from the Bin for good ends its shares", async () => {
    const [share] = await createShares(alice, { targetType: "file", targetId: kinematics, recipientIds: [bobId] });
    await deleteMyFile(alice, kinematics);
    await emptyMyBin(alice);
    const row = (await pool().query(`SELECT revoked_at FROM notes.shares WHERE id = $1`, [share.shareId])).rows[0];
    assert.ok(row.revoked_at, "the share is revoked");
  });

  await t.test("reports reach admin; removing the file ends access and closes them", async () => {
    const first = await reportSharedFile(bob, folderShare, sound, "copyright", "From a paid course");
    const second = await reportSharedFile(bob, folderShare, sound, "spam", null);
    assert.equal(second.id, first.id, "one open report per student per file");
    const open = await listSharedReports("open");
    assert.equal(open.length, 1);
    assert.equal(open[0].reason, "spam");
    assert.equal(open[0].owner?.id, aliceId);
    assert.equal(open[0].file?.title, "Sound");

    await removeReportedFile(first.id, "copyright", admin);
    await expectCode(getSharedFile(bob, folderShare, sound), "not_found");
    assert.equal((await pool().query(`SELECT 1 FROM notes.my_files WHERE id = $1`, [sound])).rows.length, 0);
    assert.equal((await listSharedReports("open")).length, 0);
    const closed = await listSharedReports("closed");
    assert.equal(closed[0].status, "resolved");
    assert.equal(closed[0].file, null);
  });

  await t.test(`at most ${SHARE_DAILY_CAP} new shares a day`, async () => {
    const used = Number((await pool().query(`SELECT COUNT(*) AS n FROM notes.shares WHERE owner_id = $1`, [aliceId])).rows[0].n);
    for (let i = used; i < SHARE_DAILY_CAP; i += 1) {
      await pool().query(
        `INSERT INTO notes.shares (id, owner_id, recipient_id, target_type, target_id) VALUES ($1, $2, $3, 'file', $4)`,
        [makeId("nshr"), aliceId, bobId, makeId("nmfi")],
      );
    }
    const extra = (await createMyTypedNote(alice, { folderId: null, title: "Extra", bodyMd: "x" })).id;
    await expectCode(createShares(alice, { targetType: "file", targetId: extra, recipientIds: [bobId] }), "share_cap");
  });
});
