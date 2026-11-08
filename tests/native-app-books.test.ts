import assert from "node:assert/strict";
import test from "node:test";

import { appBooks } from "../src/server/mobile/books";

test("app books: every website NCERT book with a PDF folder, subjects normalised", () => {
  const books = appBooks();
  assert.ok(books.length >= 12);
  assert.ok(books.every((b) => ["physics", "chemistry", "mathematics", "biology"].includes(b.subject)));
  assert.ok(books.every((b) => b.bookClass === "11" || b.bookClass === "12"));
});

test("app books: chapter paths are URL-encoded under /books", () => {
  const phy = appBooks().find((b) => b.id === "ncert-phy-11-1");
  assert.ok(phy);
  const ch1 = phy.chapters.find((c) => c.id === "ch1");
  assert.equal(ch1?.path, "/books/11/Physics/Part1/Chapter%201.pdf");
  assert.equal(phy.chapters[0].title, "Prelims");
  assert.ok(phy.chapters.every((c) => c.path.startsWith("/books/") && !c.path.includes(" ") && !c.path.includes("..")));
});
