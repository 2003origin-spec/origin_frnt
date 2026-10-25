/**
 * Shared board of a human call (decision B89). Live strokes travel on the
 * LiveKit data channel between the two screens; this keeps the latest whole
 * board the solver's screen saved, so a student who rejoins sees it and
 * admins can review it with the session.
 */

import { BOARD_MAX_BYTES, parseBoard, type BoardState } from "@/lib/now-board";
import { getUserPostgresPool } from "@/server/user-postgres";

import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";

/** The solver's screen may still save the final board this long after the call ended. */
export const BOARD_SAVE_GRACE_MS = 10 * 60_000;

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

type SessionRow = {
  student_id: string;
  helper_user_id: string;
  solver_kind: "human" | "bot";
  ended_at: Date | null;
};

async function loadSession(sessionId: string): Promise<SessionRow | null> {
  const res = await (await db()).query<SessionRow>(
    `SELECT s.student_id, h.user_id AS helper_user_id, s.solver_kind, s.ended_at
       FROM now.sessions s JOIN now.helpers h ON h.id = s.helper_id
      WHERE s.id = $1`,
    [sessionId],
  );
  return res.rows[0] ?? null;
}

/** Is the board switched on for calls? (Settings → Extra parts.) */
export async function isBoardEnabled(): Promise<boolean> {
  return (await getNowSettings()).features.board;
}

/** Saves the whole board; only the human solver of the session, during the call or just after. */
export async function saveSessionBoard(userId: string, sessionId: string, raw: unknown, now: Date = new Date()): Promise<{ bytes: number }> {
  if (!(await isBoardEnabled())) throw new NowError(403, "board_off", "The shared board is not switched on.");
  const session = await loadSession(sessionId);
  if (!session || session.helper_user_id !== userId || session.solver_kind !== "human") {
    throw new NowError(404, "not_found", "Session not found.");
  }
  if (session.ended_at && now.getTime() - session.ended_at.getTime() > BOARD_SAVE_GRACE_MS) {
    throw new NowError(409, "session_ended", "This session has ended.");
  }
  const json = JSON.stringify(raw ?? null);
  const bytes = Buffer.byteLength(json, "utf8");
  if (bytes > BOARD_MAX_BYTES) throw new NowError(413, "board_too_large", "The board is full. Clear a page to keep writing.");
  const board = parseBoard(raw);
  if (!board) throw new NowError(400, "invalid_board", "The board could not be saved.");
  await (await db()).query(
    `INSERT INTO now.session_boards (session_id, board, bytes, updated_at) VALUES ($1, $2::jsonb, $3, $4)
     ON CONFLICT (session_id) DO UPDATE SET board = EXCLUDED.board, bytes = EXCLUDED.bytes, updated_at = EXCLUDED.updated_at`,
    [sessionId, JSON.stringify(board), bytes, now],
  );
  return { bytes };
}

async function readBoard(sessionId: string): Promise<BoardState | null> {
  const res = await (await db()).query<{ board: unknown }>(`SELECT board FROM now.session_boards WHERE session_id = $1`, [sessionId]);
  return res.rows[0] ? parseBoard(res.rows[0].board) : null;
}

/** The saved board for the student or the solver of the session (null when nothing was drawn). */
export async function getSessionBoard(userId: string, sessionId: string): Promise<BoardState | null> {
  const session = await loadSession(sessionId);
  if (!session || (session.student_id !== userId && session.helper_user_id !== userId)) {
    throw new NowError(404, "not_found", "Session not found.");
  }
  return readBoard(sessionId);
}

/** For the admin session review (the admin route checks the role). */
export async function getSessionBoardForAdmin(sessionId: string): Promise<BoardState | null> {
  return readBoard(sessionId);
}
