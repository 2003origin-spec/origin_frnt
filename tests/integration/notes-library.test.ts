/**
 * Origin Notes — shared library against a real Postgres (V1/NOTES_PLAN.md §14).
 * Needs USER_DATABASE_URL (and OGCODE_DATABASE_URL, same DB) pointing at a
 * THROWAWAY database. Run:
 *   USER_DATABASE_URL=… OGCODE_DATABASE_URL=… npx tsx --conditions=react-server --test tests/integration/notes-library.test.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { ensureUserSchema } from "@/server/db-users";
import { ensureWorkspaceSchema } from "@/server/workspaces/schema";
import { ensureNotesSchema } from "@/server/notes/notes-schema";
import { NotesError } from "@/server/notes/notes-errors";
import {
  createFolder,
  createTypedNote,
  deleteFolder,
  getAdminFolderView,
  listBin,
  moveFolder,
  restoreFromBin,
  setItemStatus,
  updateFolder,
  updateItem,
} from "@/server/notes/library-admin";
import { createStandardFolders } from "@/server/notes/library-skeleton";
import { applyImport, previewImport } from "@/server/notes/library-import";
import { getLibraryTree } from "@/server/notes/library-store";
import { listReports, resolveReport } from "@/server/notes/library-reports";
import {
  getNotesFolder,
  getNotesHome,
  getNotesItem,
  getNotesItemFileUrl,
  listStarredNotes,
  reportNotesItem,
  searchNotes,
  setNotesStar,
  type NotesViewer,
} from "@/server/notes/library-student";
import { getUserPostgresPool } from "@/server/user-postgres";

import { dbConfigured, makeId } from "./_db";

const skip = !dbConfigured();

const adminId = makeId("user_notes_admin");
const studentId = makeId("user_notes_student");
const admin = { userId: adminId };
const ALL = ["physics", "chemistry", "mathematics", "biology"] as const;
const viewer: NotesViewer = { userId: studentId, modeSubjects: null, ownedSubjects: [...ALL] };

function pool() {
  const p = getUserPostgresPool();
  if (!p) throw new Error("no pool");
  return p;
}

async function expectNotesError(promise: Promise<unknown>, code: string): Promise<NotesError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof NotesError, `expected NotesError(${code}), got ${String(error)}`);
    assert.equal(error.code, code);
    return error;
  }
  assert.fail(`expected NotesError(${code})`);
}

const SAMPLE_FILE = (title: string, body: string) => `---
title: "${title}"
type: formula_sheet
chapter: c11.physics.motion-in-a-plane
---

${body}
`;

test("notes library end to end", { skip }, async (t) => {
  await ensureUserSchema();
  await ensureWorkspaceSchema();
  await ensureNotesSchema();
  await pool().query(
    `INSERT INTO origin_users (id, name, email, role, password_hash) VALUES
       ($1, 'Notes Admin', $2, 'admin', 'test-no-login'),
       ($3, 'Notes Student', $4, 'student', 'test-no-login')
     ON CONFLICT (id) DO NOTHING`,
    [adminId, `${adminId}@example.com`, studentId, `${studentId}@example.com`],
  );
  // Start from an empty library so counts are exact.
  await pool().query(`TRUNCATE notes.folders, notes.items, notes.item_revisions, notes.stars, notes.views, notes.reports, notes.uploads CASCADE`);

  await t.test("standard folders: 3 classes, 12 subjects, 137 chapters; safe to re-run", async () => {
    const first = await createStandardFolders(admin);
    assert.deepEqual(first, { created: 152, adopted: 0, skipped: 0 });
    const again = await createStandardFolders(admin);
    assert.deepEqual(again, { created: 0, adopted: 0, skipped: 152 });
    const tree = await getLibraryTree();
    const chapters = Object.values(tree.nodes).filter((n) => n.kind === "chapter");
    assert.equal(chapters.length, 137);
    const motion = chapters.find((n) => n.syllabusKey === "c11.physics.motion-in-a-plane");
    assert.ok(motion);
    assert.equal(motion.effectiveSubject, "physics");
    assert.equal(motion.effectiveClassLevel, 11);
    assert.deepEqual(motion.bankChapters, ["Motion in a Plane"]);
    assert.equal(motion.visible, false, "everything starts as a draft");
  });

  const tree0 = await getLibraryTree();
  const node = (key: string) => Object.values(tree0.nodes).find((n) => n.syllabusKey === key)!;
  const class11 = node("c11");
  const physics11 = node("c11.physics");
  const motion = node("c11.physics.motion-in-a-plane");

  let noteId = "";
  await t.test("drafts are invisible; publishing the chapter with its parents shows it", async () => {
    const note = await createTypedNote(
      { folderId: motion.id, title: "Projectile basics", noteType: "short_notes", bodyMd: "Range is $R = u^2\\sin 2\\theta / g$ for level ground." },
      admin,
    );
    noteId = note.id;
    assert.equal((await getNotesHome(viewer, "11")).classes.length, 0);
    await expectNotesError(getNotesItem(viewer, noteId), "not_found");

    await updateFolder(motion.id, { status: "published", publishParents: true }, admin);
    const home = await getNotesHome(viewer, "11");
    assert.deepEqual(home.classes.map((c) => c.name), ["Class 11"]);
    const chapter = await getNotesFolder(viewer, motion.id, false);
    assert.equal(chapter.items.length, 0, "the note itself is still a draft");
    assert.match(chapter.folder.practiseUrl ?? "", /h_chapters=Motion\+in\+a\+Plane/u);

    await setItemStatus(noteId, "published", null, admin);
    const item = await getNotesItem(viewer, noteId);
    assert.equal(item.item.title, "Projectile basics");
    assert.deepEqual(item.breadcrumb.map((c) => c.name), ["Class 11", "Physics", "Motion in a Plane"]);
  });

  await t.test("a stale editor gets a version conflict instead of overwriting", async () => {
    const saved = await updateItem(noteId, { baseVersion: 1, bodyMd: "Updated body" }, admin);
    assert.equal(saved.version, 2);
    const conflict = await expectNotesError(updateItem(noteId, { baseVersion: 1, bodyMd: "Old tab" }, admin), "version_conflict");
    assert.equal(conflict.extra.currentVersion, 2);
  });

  await t.test("premium folders lock their notes for students who don't own the subject", async () => {
    await updateFolder(physics11.id, { access: "premium" }, admin);
    const freeStudent: NotesViewer = { ...viewer, ownedSubjects: [] };
    const listing = await getNotesFolder(freeStudent, motion.id, false);
    assert.equal(listing.items[0]?.locked, true);
    const locked = await getNotesItem(freeStudent, noteId);
    assert.equal(locked.item.locked, true);
    assert.equal(locked.item.subject, "physics");
    assert.equal(locked.item.bodyMd, null, "a locked note never sends its text");
    const refused = await expectNotesError(getNotesItemFileUrl(freeStudent, noteId, false), "locked");
    assert.equal(refused.extra.subject, "physics");
    const owner: NotesViewer = { ...viewer, ownedSubjects: ["physics"] };
    assert.equal((await getNotesItem(owner, noteId)).item.locked, false);

    // Search never shows (or matches on) a locked note's text: only its title or chapter name.
    assert.deepEqual(await searchNotes(freeStudent, "updated body"), [], "body words of a locked note find nothing");
    const byTitle = await searchNotes(freeStudent, "projectile basics");
    assert.deepEqual(byTitle.map((h) => [h.id, h.locked, h.snippet]), [[noteId, true, null]]);
    const ownerHits = await searchNotes(owner, "updated body");
    assert.equal(ownerHits[0]?.id, noteId);
    assert.ok(ownerHits[0]?.snippet?.includes("Updated body"), "an unlocked note still gets its snippet");
    await updateFolder(physics11.id, { access: "inherit" }, admin);
  });

  await t.test("study mode hides subjects outside it unless the student asks for all", async () => {
    await updateFolder(node("c11.biology").id, { status: "published" }, admin);
    const jee: NotesViewer = { ...viewer, modeSubjects: ["physics", "chemistry", "mathematics"] };
    const hidden = await getNotesFolder(jee, class11.id, false);
    assert.deepEqual(hidden.folders.map((f) => f.name), ["Physics"]);
    assert.equal(hidden.hiddenSubjects, 1);
    const all = await getNotesFolder(jee, class11.id, true);
    assert.deepEqual(all.folders.map((f) => f.name), ["Physics", "Biology"]);
  });

  await t.test("a folder can't be moved inside itself", async () => {
    await expectNotesError(moveFolder(class11.id, motion.id, admin), "cycle");
  });

  await t.test("import: create, unchanged, admin-edited conflict, review before publish", async () => {
    const file = { name: "formula-sheet.md", text: SAMPLE_FILE("Motion in a Plane: Formula Sheet", ":::formula{title=\"Range\"}\n$$R = \\frac{u^2 \\sin 2\\theta}{g}$$\n:::\n") };
    const preview = await previewImport([file, { name: "broken.md", text: SAMPLE_FILE("Broken", "$\\frac{1}{$") }]);
    assert.equal(preview[0].action, "create");
    assert.equal(preview[1].action, "error");
    assert.equal(preview[1].errors[0].line, 7, "line numbers point into the original file");

    const applied = await applyImport([file], admin);
    assert.equal(applied[0].action, "create");
    assert.equal((await previewImport([file]))[0].action, "unchanged");

    const view = await getAdminFolderView(motion.id);
    const imported = view.items.find((i) => i.externalKey === "c11.physics.motion-in-a-plane.formula-sheet");
    assert.ok(imported);
    assert.equal(imported.status, "draft");
    assert.equal(imported.source, "import");

    const changed = { ...file, text: file.text.replace("Range", "Horizontal range") };
    assert.equal((await previewImport([changed]))[0].action, "update", "untouched drafts take re-imports");
    await updateItem(imported.id, { baseVersion: imported.version, bodyMd: "Edited in the app" }, admin);
    assert.equal((await previewImport([changed]))[0].action, "conflict", "app edits are never overwritten");

    await expectNotesError(setItemStatus(imported.id, "published", null, admin), "review_required");
    const published = await setItemStatus(imported.id, "published", "Mrs. Rao (Physics)", admin);
    assert.equal(published.reviewerName, "Mrs. Rao (Physics)");
    assert.ok(published.publishedAt);
  });

  await t.test("stars, search, continue reading and reports", async () => {
    await setNotesStar(viewer, noteId, true);
    assert.deepEqual((await listStarredNotes(viewer)).map((s) => s.id), [noteId]);
    const hits = await searchNotes(viewer, "updated body");
    assert.deepEqual(hits.map((h) => h.id), [noteId]);
    await getNotesItem(viewer, noteId);
    const home = await getNotesHome(viewer, "11");
    assert.equal(home.continueReading?.id, noteId);
    assert.equal(home.starredCount, 1);

    const report = await reportNotesItem(viewer, noteId, "mistake", "The range formula sign is wrong");
    const again = await reportNotesItem(viewer, noteId, "mistake", "Actually it's the angle");
    assert.equal(again.id, report.id, "one open report per student per note");
    const open = await listReports("open");
    assert.equal(open.length, 1);
    assert.equal(open[0].message, "Actually it's the angle");
    await resolveReport(report.id, "resolved", "Fixed in v3", admin);
    assert.equal((await listReports("open")).length, 0);
  });

  await t.test("deleting a folder sends it and its notes to the Bin; restore brings them back", async () => {
    const extra = await createFolder({ parentId: motion.id, name: "Extra practice" }, admin);
    await createTypedNote({ folderId: extra.id, title: "Extra 1", noteType: "practice", bodyMd: "Q" }, admin);
    const moved = await deleteFolder(extra.id, admin);
    assert.deepEqual(moved, { folders: 1, items: 1 });
    const bin = await listBin();
    assert.ok(bin.some((e) => e.type === "folder" && e.id === extra.id));
    assert.ok(!bin.some((e) => e.type === "item" && e.name === "Extra 1"), "items deleted with their folder are listed under it");
    await restoreFromBin("folder", extra.id, admin);
    const view = await getAdminFolderView(extra.id);
    assert.deepEqual(view.items.map((i) => i.title), ["Extra 1"]);
  });

  await t.test("cleanup", async () => {
    await pool().query(`TRUNCATE notes.folders, notes.items, notes.item_revisions, notes.stars, notes.views, notes.reports, notes.uploads CASCADE`);
    await pool().query(`DELETE FROM app.audit_events WHERE actor_user_id = $1`, [adminId]);
    await pool().query(`DELETE FROM origin_users WHERE id IN ($1, $2)`, [adminId, studentId]);
    await pool().end();
  });
});
