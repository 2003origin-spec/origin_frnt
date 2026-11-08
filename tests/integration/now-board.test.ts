/**
 * Shared board (decision B89) against a real Postgres: only when switched
 * on, only the human solver saves it (during the call and for ten minutes
 * after), both sides and the admin review read it, and oversized or
 * malformed boards are refused.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { applyBoardMessage, emptyBoard } from "@/lib/now-board";
import { getSessionReview } from "@/server/now/admin-insights-service";
import { BOARD_SAVE_GRACE_MS, getSessionBoard, saveSessionBoard } from "@/server/now/board-service";

import { closePool, rawPool } from "./_db";
import { NOW_SKIP, acceptedHumanSession, cleanupNowFixtures, seedUser, setFeatures, setup } from "./_now";

test.after(async () => {
  if (!NOW_SKIP) await setup();
  await cleanupNowFixtures();
  await closePool();
});

const code = (c: string) => (e: { code?: string }) => e.code === c;
const drawn = applyBoardMessage(emptyBoard(), { t: "s", p: 0, id: "s1", c: 2, w: 1, pts: [100, 200, 300, 400] });

test("the solver saves the board; the student and the admin review read it", { skip: NOW_SKIP }, async () => {
  const { student, solver, sessionId } = await acceptedHumanSession();
  await assert.rejects(saveSessionBoard(solver.userId, sessionId, drawn), code("board_off"), "off by default");
  await setFeatures({ board: true });

  assert.equal(await getSessionBoard(student, sessionId), null, "nothing drawn yet");
  const { bytes } = await saveSessionBoard(solver.userId, sessionId, drawn);
  assert.ok(bytes > 0);
  assert.deepEqual(await getSessionBoard(student, sessionId), drawn);
  assert.deepEqual(await getSessionBoard(solver.userId, sessionId), drawn);
  assert.deepEqual((await getSessionReview(sessionId))?.board, drawn);

  await assert.rejects(saveSessionBoard(student, sessionId, emptyBoard()), code("not_found"), "students cannot write the board");
  const stranger = await seedUser("Stranger");
  await assert.rejects(getSessionBoard(stranger, sessionId), code("not_found"));
  await assert.rejects(saveSessionBoard(solver.userId, sessionId, { pages: [] }), code("invalid_board"));
  const huge = { pages: [{ strokes: [{ id: "big", color: 0, width: 0, points: Array.from({ length: 2_999 * 2 }, () => 1234.5678) }] }] };
  await assert.rejects(saveSessionBoard(solver.userId, sessionId, { ...huge, pad: "x".repeat(300_000) }), code("board_too_large"));
});

test("the final board can be saved for ten minutes after the call ends, not later", { skip: NOW_SKIP }, async () => {
  const { solver, sessionId } = await acceptedHumanSession();
  await setFeatures({ board: true });
  // How the call ended does not matter here, only when.
  const ended = new Date();
  await rawPool().query(`UPDATE now.sessions SET ended_at = $2 WHERE id = $1`, [sessionId, ended]);
  await saveSessionBoard(solver.userId, sessionId, drawn, new Date(ended.getTime() + BOARD_SAVE_GRACE_MS - 1_000));
  await assert.rejects(
    saveSessionBoard(solver.userId, sessionId, drawn, new Date(ended.getTime() + BOARD_SAVE_GRACE_MS + 1_000)),
    code("session_ended"),
  );
});
