/**
 * Origin Notes — My Notes against a real Postgres (V1/NOTES_PLAN.md §14).
 * Needs USER_DATABASE_URL (and OGCODE_DATABASE_URL, same DB) pointing at a
 * THROWAWAY database — it empties the My Notes tables. The upload checks also
 * need storage; point R2_* at the local stand-in (scripts/dev-fake-r2.ts):
 *
 *   USER_DATABASE_URL=… OGCODE_DATABASE_URL=… \
 *   R2_ENDPOINT=http://127.0.0.1:9466 R2_ACCESS_KEY_ID=dev R2_SECRET_ACCESS_KEY=dev-secret R2_NOTES_BUCKET=notes-dev \
 *   npx tsx --conditions=react-server --test tests/integration/notes-my-notes.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ensureUserSchema } from "@/server/db-users";
import { ensureWorkspaceSchema } from "@/server/workspaces/schema";
import { ensureNotesSchema } from "@/server/notes/notes-schema";
import { NotesError } from "@/server/notes/notes-errors";
import {
  createMyFolder,
  createMyTypedNote,
  deleteMyFile,
  deleteMyFolder,
  emptyMyBin,
  getMyFile,
  getMyFolder,
  listMyBin,
  purgeFromMyBin,
  restoreFromMyBin,
  searchMyNotes,
  updateMyFile,
  updateMyFolder,
} from "@/server/notes/my-notes";
import { getStorageSummary, reserveBytes } from "@/server/notes/my-storage";
import { cancelMyUpload, completeMyUpload, createMyUpload, getMyFileUrl } from "@/server/notes/my-uploads";
import { runNotesCleanup } from "@/server/notes/my-cleanup";
import { getStorageUser, updateStorageUser } from "@/server/notes/my-admin";
import {
  copyNotesObject,
  deleteNotesObject,
  headNotesObject,
  isNotesStorageConfigured,
  NotesObjectChangedError,
  putNotesObject,
} from "@/server/notes/notes-storage";
import { getUserPostgresPool } from "@/server/user-postgres";

import { dbConfigured, makeId } from "./_db";

const skip = !dbConfigured();

const adminId = makeId("user_mynotes_admin");
const aliceId = makeId("user_mynotes_alice");
const bobId = makeId("user_mynotes_bob");
const admin = { userId: adminId };
const alice = { userId: aliceId };
const bob = { userId: bobId };

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

async function meter(userId: string) {
  const row = (await pool().query(`SELECT used_bytes, reserved_bytes FROM notes.storage WHERE user_id = $1`, [userId])).rows[0];
  return { used: Number(row?.used_bytes ?? 0), reserved: Number(row?.reserved_bytes ?? 0) };
}

const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n% test\n"), Buffer.alloc(2000, 0x20), Buffer.from("\n%%EOF\n")]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(500, 1)]);

async function putStatus(url: string, headers: Record<string, string>, body: Buffer): Promise<number> {
  const response = await fetch(url, { method: "PUT", headers, body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer });
  await response.arrayBuffer().catch(() => undefined);
  return response.status;
}

async function put(url: string, headers: Record<string, string>, body: Buffer): Promise<void> {
  const status = await putStatus(url, headers, body);
  assert.ok(status >= 200 && status < 300, `PUT failed (${status})`);
}

test("My Notes end to end", { skip }, async (t) => {
  await ensureUserSchema();
  await ensureWorkspaceSchema();
  await ensureNotesSchema();
  await pool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES
       ($1, 'My Notes Admin', $2, 'admin', 'test-no-login'),
       ($3, 'Alice', $4, 'student', 'test-no-login'),
       ($5, 'Bob', $6, 'student', 'test-no-login')
     ON CONFLICT (id) DO NOTHING`,
    [adminId, `${adminId}@example.com`, aliceId, `${aliceId}@example.com`, bobId, `${bobId}@example.com`],
  );
  await pool().query(`TRUNCATE notes.my_files, notes.my_folders, notes.storage CASCADE`);
  await pool().query(`DELETE FROM notes.uploads WHERE scope = 'personal'`);

  let physics = "";
  let notesId = "";
  await t.test("folders nest up to 8 levels, names are unique per folder", async () => {
    physics = (await createMyFolder(alice, { parentId: null, name: "Physics" })).id;
    await expectCode(createMyFolder(alice, { parentId: null, name: "physics" }), "23505");
    let parent = physics;
    for (let depth = 2; depth <= 8; depth += 1) parent = (await createMyFolder(alice, { parentId: parent, name: `Level ${depth}` })).id;
    await expectCode(createMyFolder(alice, { parentId: parent, name: "Level 9" }), "too_deep");
    // Bob can have his own "Physics".
    await createMyFolder(bob, { parentId: null, name: "Physics" });
    const root = await getMyFolder(alice, null);
    assert.deepEqual(root.folders.map((f) => f.name), ["Physics"]);
  });

  await t.test("a folder can't move inside itself", async () => {
    const child = (await getMyFolder(alice, physics)).folders[0];
    await expectCode(updateMyFolder(alice, physics, { parentId: child.id }), "move_into_self");
  });

  await t.test("typed notes count towards storage as they grow and shrink", async () => {
    const note = await createMyTypedNote(alice, { folderId: physics, title: "Kinematics", bodyMd: "v = u + at" });
    notesId = note.id;
    assert.equal((await meter(aliceId)).used, 1024, "every typed note costs at least 1 KB");
    const big = "v = u + at. ".repeat(200);
    const longer = await updateMyFile(alice, note.id, { bodyMd: big, baseVersion: 1 });
    assert.equal(longer.version, 2);
    assert.equal(longer.bytes, Buffer.byteLength(big));
    assert.equal((await meter(aliceId)).used, longer.bytes);
    await expectCode(updateMyFile(alice, note.id, { bodyMd: "stale", baseVersion: 1 }), "edit_conflict");
    await updateMyFile(alice, note.id, { bodyMd: "", baseVersion: 2 });
    assert.equal((await meter(aliceId)).used, 1024, "an empty note still costs 1 KB");
  });

  await t.test("another student's folders and files answer 'not found'", async () => {
    await expectCode(getMyFolder(bob, physics), "not_found");
    await expectCode(getMyFile(bob, notesId), "not_found");
    await expectCode(updateMyFile(bob, notesId, { title: "Mine now" }), "not_found");
    await expectCode(deleteMyFile(bob, notesId), "not_found");
    await expectCode(deleteMyFolder(bob, physics), "not_found");
    await expectCode(createMyFolder(bob, { parentId: physics, name: "Sneaky" }), "not_found");
    await expectCode(createMyTypedNote(bob, { folderId: physics, title: "Sneaky", bodyMd: "x" }), "not_found");
    await expectCode(getMyFileUrl(bob, notesId, false), "not_found");
    assert.equal((await searchMyNotes(bob, "Kinematics")).length, 0);
    assert.equal((await searchMyNotes(alice, "kinema")).length, 1);
    // Still Alice's, unchanged.
    assert.equal((await getMyFile(alice, notesId)).title, "Kinematics");
  });

  await t.test("two opposite moves at the same moment can't make a folder loop", async () => {
    const a = (await createMyFolder(alice, { parentId: null, name: "Loop A" })).id;
    const b = (await createMyFolder(alice, { parentId: null, name: "Loop B" })).id;
    const results = await Promise.allSettled([updateMyFolder(alice, a, { parentId: b }), updateMyFolder(alice, b, { parentId: a })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1, "one move wins, the other is refused");
    const rows = (await pool().query(`SELECT id, parent_id FROM notes.my_folders WHERE id = ANY($1::text[])`, [[a, b]])).rows;
    const parent = new Map(rows.map((r) => [String(r.id), r.parent_id as string | null]));
    assert.ok(!(parent.get(a) === b && parent.get(b) === a), "no cycle");
    await deleteMyFolder(alice, parent.get(a) === b ? b : a);
    await emptyMyBin(alice);
  });

  await t.test("restoring a folder whose name is taken brings it back renamed", async () => {
    const old = (await createMyFolder(alice, { parentId: null, name: "Chemistry" })).id;
    await deleteMyFolder(alice, old);
    await createMyFolder(alice, { parentId: null, name: "Chemistry" });
    await restoreFromMyBin(alice, old);
    const names = (await getMyFolder(alice, null)).folders.map((f) => f.name).sort();
    assert.deepEqual(names.filter((n) => n.startsWith("Chemistry")), ["Chemistry", "Chemistry (restored)"]);
    for (const folder of (await getMyFolder(alice, null)).folders.filter((f) => f.name.startsWith("Chemistry"))) await deleteMyFolder(alice, folder.id);
    await emptyMyBin(alice);
  });

  await t.test("restore and empty-the-Bin at the same moment never lose a restored folder", async () => {
    for (let round = 0; round < 5; round += 1) {
      const folder = (await createMyFolder(alice, { parentId: null, name: `Race ${round}` })).id;
      const note = await createMyTypedNote(alice, { folderId: folder, title: "Inside", bodyMd: "x" });
      await deleteMyFolder(alice, folder);
      const [restored] = await Promise.allSettled([restoreFromMyBin(alice, folder), emptyMyBin(alice)]);
      if (restored.status === "fulfilled") {
        assert.equal((await getMyFile(alice, note.id)).folderId, folder, "a restore that said OK really kept the folder and its note");
        await deleteMyFolder(alice, folder);
      }
      await emptyMyBin(alice);
    }
  });

  await t.test("the Bin: delete, restore, delete for good gives the space back", async () => {
    const before = (await meter(aliceId)).used;
    await deleteMyFolder(alice, physics);
    assert.equal((await getMyFolder(alice, null)).folders.length, 0);
    const bin = await listMyBin(alice);
    assert.equal(bin.entries.length, 1);
    assert.equal(bin.entries[0].type, "folder");
    assert.equal(bin.entries[0].bytes, before);
    assert.equal((await meter(aliceId)).used, before, "Bin items still count");
    await expectCode(restoreFromMyBin(bob, physics), "not_found");
    await restoreFromMyBin(alice, physics);
    assert.equal((await getMyFile(alice, notesId)).folderId, physics);

    // A file whose folder is gone comes back at the top level.
    await deleteMyFile(alice, notesId);
    await deleteMyFolder(alice, physics);
    await restoreFromMyBin(alice, notesId);
    assert.equal((await getMyFile(alice, notesId)).folderId, null);

    await purgeFromMyBin(alice, physics);
    assert.equal((await pool().query(`SELECT COUNT(*) AS n FROM notes.my_folders WHERE owner_id = $1`, [aliceId])).rows[0].n, "0");
    await deleteMyFile(alice, notesId);
    const freed = await emptyMyBin(alice);
    assert.equal(freed.files, 1);
    assert.equal((await meter(aliceId)).used, 0);
  });

  await t.test("a personal limit needs a reason; two reservations can't both overshoot it", async () => {
    await expectCode(updateStorageUser(aliceId, { limitOverrideBytes: 1000 }, admin), "reason_required");
    const detail = await updateStorageUser(aliceId, { limitOverrideBytes: 1000, overrideReason: "test" }, admin);
    assert.equal(detail.limitBytes, 1000);
    const results = await Promise.allSettled([reserveBytes(aliceId, 600, 1000), reserveBytes(aliceId, 600, 1000)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    assert.equal((rejected.reason as NotesError).code, "storage_full");
    assert.equal((await meter(aliceId)).reserved, 600);
    await pool().query(`UPDATE notes.storage SET reserved_bytes = 0 WHERE user_id = $1`, [aliceId]);
    await expectCode(createMyTypedNote(alice, { folderId: null, title: "Too big", bodyMd: "x".repeat(1200) }), "storage_full");
    assert.equal((await getStorageSummary(aliceId)).hasPersonalLimit, true);
  });

  await t.test("blocked uploads stop typed notes from growing too", async () => {
    await expectCode(updateStorageUser(aliceId, { uploadsBlocked: true }, admin), "reason_required");
    await updateStorageUser(aliceId, { uploadsBlocked: true, blockReason: "testing" }, admin);
    await expectCode(createMyTypedNote(alice, { folderId: null, title: "Blocked", bodyMd: "x" }), "uploads_blocked");
    await updateStorageUser(aliceId, { uploadsBlocked: false, limitOverrideBytes: null }, admin);
    assert.equal((await getStorageUser(aliceId)).uploadsBlocked, false);
  });

  await t.test("uploads: real file checked, fakes refused, space reserved then committed", { skip: !isNotesStorageConfigured() }, async () => {
    const ticket = await createMyUpload(alice, { folderId: null, fileName: "notes.pdf", mime: "application/pdf", bytes: PDF.length });
    assert.equal((await meter(aliceId)).reserved, PDF.length);
    await put(ticket.uploadUrl, ticket.headers, PDF);
    const file = await completeMyUpload(alice, ticket.uploadId, { pageCount: 1 });
    assert.equal(file.kind, "pdf");
    assert.equal(file.bytes, PDF.length);
    assert.deepEqual(await meter(aliceId), { used: PDF.length, reserved: 0 });
    assert.match(await getMyFileUrl(alice, file.id, false), /X-Amz-Signature=/u);
    await expectCode(completeMyUpload(alice, ticket.uploadId, {}), "upload_finished");

    // A PNG renamed to .pdf is refused and its space comes back.
    const fake = await createMyUpload(alice, { folderId: null, fileName: "fake.pdf", mime: "application/pdf", bytes: PNG.length });
    await put(fake.uploadUrl, fake.headers, PNG);
    await expectCode(completeMyUpload(alice, fake.uploadId, {}), "type_mismatch");
    assert.deepEqual(await meter(aliceId), { used: PDF.length, reserved: 0 });

    // The link is bound to the declared size: a bigger body is refused by storage itself.
    const small = await createMyUpload(alice, { folderId: null, fileName: "small.pdf", mime: "application/pdf", bytes: 100 });
    assert.equal(await putStatus(small.uploadUrl, small.headers, PDF), 403);
    await expectCode(completeMyUpload(alice, small.uploadId, {}), "upload_missing");
    await cancelMyUpload(alice, small.uploadId);
    assert.equal((await meter(aliceId)).reserved, 0);

    // The copy only goes ahead for the exact object that was checked.
    await putNotesObject("notes/uploads/etag-test", PDF, "application/pdf");
    await assert.rejects(copyNotesObject("notes/uploads/etag-test", "notes/uploads/etag-copy", '"not-the-etag"'), NotesObjectChangedError);
    await deleteNotesObject("notes/uploads/etag-test");

    // A pause or a block after the ticket still stops the upload, and gives the space back.
    const late = await createMyUpload(alice, { folderId: null, fileName: "late.pdf", mime: "application/pdf", bytes: PDF.length });
    await put(late.uploadUrl, late.headers, PDF);
    await updateStorageUser(aliceId, { uploadsBlocked: true, blockReason: "testing" }, admin);
    await expectCode(completeMyUpload(alice, late.uploadId, {}), "uploads_blocked");
    await updateStorageUser(aliceId, { uploadsBlocked: false }, admin);
    assert.equal((await meter(aliceId)).reserved, 0);

    // A re-used link after "complete" leaves a copy; the cleanup deletes it once the link has expired.
    const again = await createMyUpload(alice, { folderId: null, fileName: "again.pdf", mime: "application/pdf", bytes: PDF.length });
    await put(again.uploadUrl, again.headers, PDF);
    await completeMyUpload(alice, again.uploadId, {});
    await put(again.uploadUrl, again.headers, PDF);
    const uploadKey = (await pool().query(`SELECT upload_key FROM notes.uploads WHERE id = $1`, [again.uploadId])).rows[0].upload_key as string;
    assert.ok(await headNotesObject(uploadKey), "the re-PUT copy is there");
    await pool().query(`UPDATE notes.uploads SET expires_at = now() - interval '1 hour' WHERE id = $1`, [again.uploadId]);
    await runNotesCleanup();
    assert.equal(await headNotesObject(uploadKey), null, "cleanup deleted the leftover copy");
    assert.ok((await pool().query(`SELECT cleared_at FROM notes.uploads WHERE id = $1`, [again.uploadId])).rows[0].cleared_at);

    // Types the browser shouldn't send at all.
    await expectCode(createMyUpload(alice, { folderId: null, fileName: "page.html", mime: "text/html", bytes: 10 }), "unsupported_type");
    await expectCode(createMyUpload(alice, { folderId: null, fileName: "x.exe", mime: "application/pdf", bytes: 10 }), "unsupported_type");
  });

  await t.test("cleanup: expired tickets give space back, old Bin items go, meters are recounted", async () => {
    await pool().query(`INSERT INTO notes.storage (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [bobId]);
    await pool().query(
      `INSERT INTO notes.uploads (id, scope, user_id, upload_key, declared_mime, declared_bytes, original_name, expires_at)
       VALUES ($1, 'personal', $2, 'notes/uploads/test-expired', 'application/pdf', 700, 'x.pdf', now() - interval '1 hour')`,
      [makeId("nupl"), bobId],
    );
    await pool().query(`UPDATE notes.storage SET reserved_bytes = 700 WHERE user_id = $1`, [bobId]);
    const old = await createMyTypedNote(bob, { folderId: null, title: "Old", bodyMd: "12345" });
    assert.equal((await meter(bobId)).used, 1024);
    await deleteMyFile(bob, old.id);
    await pool().query(`UPDATE notes.my_files SET deleted_at = now() - interval '40 days' WHERE id = $1`, [old.id]);
    await pool().query(`UPDATE notes.storage SET used_bytes = used_bytes + 999 WHERE user_id = $1`, [aliceId]);

    const result = await runNotesCleanup();
    assert.ok(result.expiredUploads >= 1);
    assert.ok(result.binBatchesRemoved >= 1);
    assert.ok(result.metersCorrected >= 1);
    assert.deepEqual(await meter(bobId), { used: 0, reserved: 0 });
    assert.equal((await meter(aliceId)).used, isNotesStorageConfigured() ? 2 * PDF.length : 0, "drift corrected from the file rows");
    const again = await runNotesCleanup();
    assert.equal(again.expiredUploads, 0);
    assert.equal(again.metersCorrected, 0, "idempotent");
  });
});
