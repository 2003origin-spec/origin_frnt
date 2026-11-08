import assert from "node:assert/strict";
import test from "node:test";

import {
  BOARD_HEIGHT,
  BOARD_MAX_PAGES,
  BOARD_MAX_POINTS_PER_STROKE,
  BOARD_WIDTH,
  applyBoardMessage,
  cleanPoints,
  emptyBoard,
  isBoardEmpty,
  parseBoard,
  polylinePoints,
  type BoardState,
} from "../../src/lib/now-board";

const start = (state: BoardState, id = "s1", pts = [10, 20]) => applyBoardMessage(state, { t: "s", p: state.page, id, c: 1, w: 1, pts });

test("a stroke starts, grows and is undone", () => {
  let b = start(emptyBoard());
  b = applyBoardMessage(b, { t: "a", p: 0, id: "s1", pts: [30, 40, 50, 60] });
  assert.deepEqual(b.pages[0].strokes, [{ id: "s1", color: 1, width: 1, points: [10, 20, 30, 40, 50, 60] }]);
  assert.equal(isBoardEmpty(b), false);
  b = applyBoardMessage(b, { t: "u", p: 0 });
  assert.equal(isBoardEmpty(b), true);
});

test("points are rounded and clamped to the board; malformed messages change nothing", () => {
  const b = start(emptyBoard(), "s1", [-5, 99_999, 12.6, 7.4]);
  assert.deepEqual(b.pages[0].strokes[0].points, [0, BOARD_HEIGHT, 13, 7]);
  const before = emptyBoard();
  for (const bad of [
    null,
    "x",
    { t: "s", p: 0, id: "s1", c: 9, w: 1, pts: [1, 2] }, // unknown colour
    { t: "s", p: 0, id: "s1", c: 0, w: 5, pts: [1, 2] }, // unknown width
    { t: "s", p: 0, id: "bad id!", c: 0, w: 0, pts: [1, 2] },
    { t: "s", p: 3, id: "s1", c: 0, w: 0, pts: [1, 2] }, // no such page
    { t: "s", p: 0, id: "s1", c: 0, w: 0, pts: [1] }, // odd point list
    { t: "s", p: 0, id: "s1", c: 0, w: 0, pts: [1, "2"] },
    { t: "a", p: 0, id: "nope", pts: [1, 2] },
    { t: "zz" },
  ]) {
    assert.equal(applyBoardMessage(before, bad), before, JSON.stringify(bad));
  }
});

test("a stroke cannot grow past the point limit and ids are unique per page", () => {
  const many = Array.from({ length: BOARD_MAX_POINTS_PER_STROKE * 2 }, (_, i) => i % 100);
  let b = start(emptyBoard(), "s1", many);
  assert.equal(b.pages[0].strokes[0].points.length, BOARD_MAX_POINTS_PER_STROKE * 2);
  const full = b;
  b = applyBoardMessage(b, { t: "a", p: 0, id: "s1", pts: [1, 2] });
  assert.equal(b, full, "no room left on this stroke");
  assert.equal(start(full, "s1"), full, "the same id twice is refused");
});

test("pages: new, go to, clear, figure; at most ten", () => {
  let b = start(emptyBoard());
  b = applyBoardMessage(b, { t: "n" });
  assert.equal(b.page, 1);
  b = applyBoardMessage(b, { t: "f", p: 1, on: true });
  assert.equal(b.pages[1].figure, true);
  b = applyBoardMessage(b, { t: "g", p: 0 });
  assert.equal(b.page, 0);
  b = applyBoardMessage(b, { t: "x", p: 0 });
  assert.equal(b.pages[0].strokes.length, 0);
  for (let i = 0; i < 20; i += 1) b = applyBoardMessage(b, { t: "n" });
  assert.equal(b.pages.length, BOARD_MAX_PAGES);
});

test("a saved board is checked whole", () => {
  const good = applyBoardMessage(start(emptyBoard()), { t: "n" });
  assert.deepEqual(parseBoard(JSON.parse(JSON.stringify(good))), good);
  assert.equal(parseBoard(null), null);
  assert.equal(parseBoard({ pages: [] }), null);
  assert.equal(parseBoard({ pages: Array.from({ length: 11 }, () => ({ strokes: [] })) }), null);
  const dup = { pages: [{ strokes: [{ id: "a", color: 0, width: 0, points: [1, 2] }, { id: "a", color: 0, width: 0, points: [3, 4] }] }] };
  assert.equal(parseBoard(dup), null, "duplicate stroke ids");
  assert.equal(parseBoard({ pages: [{ strokes: [] }], page: 7 })?.page, 0, "an out-of-range page falls back to the first");
  assert.equal(cleanPoints([BOARD_WIDTH + 1, 0], 10)?.[0], BOARD_WIDTH);
  assert.equal(polylinePoints([1, 2, 3, 4]), "1,2 3,4");
});
