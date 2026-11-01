/**
 * Per-user on-device caches: one student's notifications and private PDF
 * notes must never be shown to the next person who signs in on the device.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  LEGACY_NOTIFICATIONS_KEY,
  clearUserLocalCaches,
  legacyPdfNotesStorageKey,
  loadPdfNotes,
  notificationsStorageKey,
  parseStoredNotifications,
  pdfNotesStorageKey,
} from "@/lib/user-scoped-storage";

test("keys are namespaced by user", () => {
  assert.notEqual(notificationsStorageKey("a"), notificationsStorageKey("b"));
  assert.notEqual(notificationsStorageKey("a"), LEGACY_NOTIFICATIONS_KEY);
  const url = "https://cdn.example.com/x.pdf";
  assert.notEqual(pdfNotesStorageKey("a", url), pdfNotesStorageKey("b", url));
  assert.equal(pdfNotesStorageKey(null, url), pdfNotesStorageKey(undefined, url));
  assert.ok(!pdfNotesStorageKey("a", url).includes("/"));
});

test("parseStoredNotifications revives dates and drops junk", () => {
  const raw = JSON.stringify([
    { id: "n1", title: "t", message: "m", type: "info", read: false, createdAt: "2026-10-01T00:00:00Z" },
    { id: 7 },
    null,
    { id: "n2", createdAt: "not a date" },
  ]);
  const parsed = parseStoredNotifications(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, "n1");
  assert.ok(parsed[0].createdAt instanceof Date);
  assert.deepEqual(parseStoredNotifications("{oops"), []);
  assert.deepEqual(parseStoredNotifications(JSON.stringify({ id: "x" })), []);
  assert.deepEqual(parseStoredNotifications(null), []);
});

test("clearUserLocalCaches drops that user's and the legacy notifications only", () => {
  const map = new Map<string, string>([
    [LEGACY_NOTIFICATIONS_KEY, "[]"],
    [notificationsStorageKey("a"), "[]"],
    [notificationsStorageKey("b"), "[]"],
    [pdfNotesStorageKey("a", "u"), "my notes"],
  ]);
  clearUserLocalCaches({ removeItem: (k) => void map.delete(k) }, "a");
  assert.deepEqual([...map.keys()].sort(), [notificationsStorageKey("b"), pdfNotesStorageKey("a", "u")].sort());
  assert.doesNotThrow(() => clearUserLocalCaches({ removeItem: () => { throw new Error("blocked"); } }, "a"));
  assert.doesNotThrow(() => clearUserLocalCaches(null, "a"));
});

function mem(entries: Record<string, string> = {}) {
  const map = new Map(Object.entries(entries));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

test("PDF notes saved under the old URL-only key are claimed once, not lost", () => {
  const url = "https://cdn.example.com/physics ch1.pdf";
  const legacyKey = legacyPdfNotesStorageKey(url);
  assert.equal(legacyKey, "origin_pdf_notes_https___cdn_example_com_physics_ch1_pdf", "matches the pre-namespacing key");

  const s = mem({ [legacyKey]: "my old notes" });
  assert.equal(loadPdfNotes(s, "u1", url), "my old notes");
  assert.equal(s.map.get(pdfNotesStorageKey("u1", url)), "my old notes");
  assert.ok(!s.map.has(legacyKey), "legacy key deleted after the claim");
  // The next account on the device does not get them.
  assert.equal(loadPdfNotes(s, "u2", url), null);
});

test("PDF notes migration never overwrites the user's own notes, and guests never claim", () => {
  const url = "https://cdn.example.com/x.pdf";
  const legacyKey = legacyPdfNotesStorageKey(url);
  const s = mem({ [legacyKey]: "old", [pdfNotesStorageKey("u1", url)]: "mine" });
  assert.equal(loadPdfNotes(s, "u1", url), "mine");
  assert.equal(s.map.get(legacyKey), "old", "untouched when the user already has notes");

  const g = mem({ [legacyKey]: "old" });
  assert.equal(loadPdfNotes(g, null, url), null);
  assert.equal(g.map.get(legacyKey), "old", "left for the signed-in owner");
  assert.equal(loadPdfNotes(null, "u1", url), null);
});
