import test from "node:test";
import assert from "node:assert/strict";

import {
  scoreMatch,
  rankAndMergeResults,
  type SearchResult,
} from "../../src/server/search/search-service";

test("scoreMatch ranks exact > prefix > word-start > substring > none", () => {
  assert.equal(scoreMatch("Circular Motion", "circular motion"), 100);
  assert.equal(scoreMatch("Circular Motion", "circ"), 80);
  assert.equal(scoreMatch("Uniform Circular Motion", "circ"), 60);
  // Genuine substring (not a word start): "circular" sits inside "semicircular".
  const substringScore = scoreMatch("Semicircular Arc", "circular");
  assert.ok(substringScore > 0 && substringScore < 60);
  assert.equal(scoreMatch("Thermodynamics", "optics"), 0);
});

test("scoreMatch is empty-safe", () => {
  assert.equal(scoreMatch("", "x"), 0);
  assert.equal(scoreMatch("something", ""), 0);
  assert.equal(scoreMatch(null, "x"), 0);
  assert.equal(scoreMatch(undefined, "x"), 0);
});

function result(type: SearchResult["type"], id: string, score: number): SearchResult {
  return { type, id, title: id, subtitle: "", href: `/${type}/${id}`, score };
}

test("rankAndMergeResults sorts by score desc and caps at the limit", () => {
  const merged = rankAndMergeResults(
    [result("test", "a", 40), result("question", "b", 90), result("nav", "c", 60)],
    2,
  );
  assert.deepEqual(merged.map((r) => r.id), ["b", "c"]);
});

test("rankAndMergeResults dedupes by type + id", () => {
  const merged = rankAndMergeResults(
    [result("test", "a", 90), result("test", "a", 10), result("question", "a", 50)],
    10,
  );
  // Same type+id collapses (first wins); different type with same id survives.
  assert.equal(merged.length, 2);
  assert.deepEqual(merged.map((r) => `${r.type}:${r.id}`), ["test:a", "question:a"]);
});

test("rankAndMergeResults keeps domain order for equal scores (stable)", () => {
  const merged = rankAndMergeResults(
    [result("test", "t", 60), result("person", "p", 60), result("nav", "n", 60)],
    10,
  );
  assert.deepEqual(merged.map((r) => r.id), ["t", "p", "n"]);
});
