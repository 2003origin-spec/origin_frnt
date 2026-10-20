import test from "node:test";
import assert from "node:assert/strict";

import {
  breadcrumbFor,
  buildNotesTree,
  cleanFolderName,
  cleanTitle,
  defaultClassForStudent,
  descendantIds,
  effectiveItemAccess,
  formatBytes,
  isItemVisible,
  isLocked,
  moveInList,
  practiseUrlFor,
  slugify,
  wouldCreateCycle,
} from "../../src/lib/notes/rules";
import type { NotesFolderRow } from "../../src/lib/notes/types";

function folder(id: string, parentId: string | null, extra: Partial<NotesFolderRow> = {}): NotesFolderRow {
  return {
    id,
    parentId,
    name: id,
    kind: "folder",
    classLevel: null,
    subject: null,
    syllabusKey: null,
    ncertNumber: null,
    bankChapters: [],
    exams: [],
    access: "inherit",
    status: "published",
    sortOrder: 0,
    updatedAt: "2026-10-18T00:00:00.000Z",
    ...extra,
  };
}

const ROWS: NotesFolderRow[] = [
  folder("c11", null, { kind: "class", classLevel: 11, sortOrder: 20 }),
  folder("c10", null, { kind: "class", classLevel: 10, sortOrder: 10 }),
  folder("phy", "c11", { kind: "subject", subject: "physics" }),
  folder("mip", "phy", { kind: "chapter", ncertNumber: 3, bankChapters: ["Motion in a Plane"] }),
  folder("extra", "mip", { status: "draft" }),
  folder("bio", "c11", { kind: "subject", subject: "biology", access: "premium" }),
  folder("cell", "bio", { kind: "chapter", access: "free" }),
];

test("the tree resolves class, subject, access and visibility from parents", () => {
  const tree = buildNotesTree(ROWS, { mip: { published: 4, inReview: 1, draft: 0 } });
  assert.deepEqual(tree.roots, ["c10", "c11"], "roots follow sort order");
  const mip = tree.nodes.mip;
  assert.equal(mip.effectiveClassLevel, 11);
  assert.equal(mip.effectiveSubject, "physics");
  assert.equal(mip.effectiveAccess, "free");
  assert.equal(mip.depth, 2);
  assert.deepEqual(mip.path, ["c11", "phy"]);
  assert.equal(mip.counts.published, 4);
  assert.equal(tree.nodes.extra.visible, false, "a draft folder is hidden");
  assert.equal(tree.nodes.bio.effectiveAccess, "premium");
  assert.equal(tree.nodes.cell.effectiveAccess, "free", "a child can override a premium parent");
});

test("a published folder under a draft parent stays hidden", () => {
  const tree = buildNotesTree([folder("a", null, { status: "draft" }), folder("b", "a")]);
  assert.equal(tree.nodes.b.visible, false);
});

test("orphans and cycles are dropped instead of looping", () => {
  const tree = buildNotesTree([folder("x", "missing"), folder("p", "q"), folder("q", "p"), folder("root", null)]);
  assert.deepEqual(Object.keys(tree.nodes), ["root"]);
});

test("cycle check: a folder can't move under itself or its descendants", () => {
  const tree = buildNotesTree(ROWS);
  assert.equal(wouldCreateCycle(tree, "c11", "mip"), true);
  assert.equal(wouldCreateCycle(tree, "phy", "phy"), true);
  assert.equal(wouldCreateCycle(tree, "mip", "c10"), false);
  assert.equal(wouldCreateCycle(tree, "mip", null), false);
  assert.deepEqual(descendantIds(tree, "phy").sort(), ["extra", "mip"]);
});

test("breadcrumbs run from the top folder down", () => {
  const tree = buildNotesTree(ROWS);
  assert.deepEqual(breadcrumbFor(tree, "mip").map((c) => c.id), ["c11", "phy", "mip"]);
  assert.deepEqual(breadcrumbFor(tree, "nope"), []);
});

test("item access and visibility", () => {
  const tree = buildNotesTree(ROWS);
  assert.equal(effectiveItemAccess("inherit", tree.nodes.bio), "premium");
  assert.equal(effectiveItemAccess("free", tree.nodes.bio), "free");
  assert.equal(isItemVisible("published", tree.nodes.mip), true);
  assert.equal(isItemVisible("in_review", tree.nodes.mip), false);
  assert.equal(isItemVisible("published", tree.nodes.extra), false);
  assert.equal(isItemVisible("published", undefined), false);
});

test("premium locks follow the subjects a student owns", () => {
  assert.equal(isLocked("free", "physics", []), false);
  assert.equal(isLocked("premium", "physics", []), true);
  assert.equal(isLocked("premium", "physics", ["physics"]), false);
  assert.equal(isLocked("premium", "physics", ["biology"]), true);
  assert.equal(isLocked("premium", null, []), true);
  assert.equal(isLocked("premium", null, ["biology"]), false);
});

test("practise links carry every bank spelling of the chapter", () => {
  const url = practiseUrlFor({
    bankChapters: ["Organic Chemistry – Some Basic Principles and Techniques", "Organic Chemistry \\u2013 Some Basic Principles and Techniques"],
    effectiveSubject: "chemistry",
    effectiveClassLevel: 11,
  });
  assert.ok(url);
  const params = new URLSearchParams(url.split("?")[1]);
  assert.equal(params.get("subjects"), "chemistry");
  assert.equal(params.get("classes"), "11");
  assert.equal(params.getAll("h_chapters").length, 2);
  assert.equal(practiseUrlFor({ bankChapters: [], effectiveSubject: "physics", effectiveClassLevel: 11 }), null);
  assert.equal(practiseUrlFor({ bankChapters: ["X"], effectiveSubject: null, effectiveClassLevel: 11 }), null);
});

test("names and titles are cleaned and checked", () => {
  assert.deepEqual(cleanFolderName("  Motion   in a Plane "), { ok: true, name: "Motion in a Plane" });
  assert.equal(cleanFolderName("").ok, false);
  assert.equal(cleanFolderName("a/b").ok, false);
  assert.equal(cleanFolderName("x".repeat(121)).ok, false);
  assert.equal(cleanTitle("Formula sheet").ok, true);
  assert.equal(cleanTitle("bad\u0007title").ok, false);
});

test("own class first: 9/10 → 10, droppers → 12", () => {
  assert.equal(defaultClassForStudent("9"), 10);
  assert.equal(defaultClassForStudent("10"), 10);
  assert.equal(defaultClassForStudent(" 11 "), 11);
  assert.equal(defaultClassForStudent("Dropper"), 12);
  assert.equal(defaultClassForStudent(null), null);
});

test("small helpers", () => {
  assert.equal(slugify("Cell: The Unit of Life"), "cell-the-unit-of-life");
  assert.equal(slugify("Acids, Bases & Salts"), "acids-bases-and-salts");
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2_500_000), "2.4 MB");
  assert.equal(formatBytes(null), "");
  assert.deepEqual(moveInList(["a", "b", "c"], "c", 0), ["c", "a", "b"]);
  assert.deepEqual(moveInList(["a", "b", "c"], "a", 9), ["b", "c", "a"]);
});
