/**
 * Origin NOW shared board (decision B89): a 4:3 board under the question
 * where a human solver writes and draws while the student watches.
 *
 * Shared by the room screen and the server, so it has no imports. The
 * board is a fixed 4:3 surface (not the question text, which wraps
 * differently on every screen), and coordinates are whole numbers on a
 * 10000 × 7500 grid, so a stroke lands in the same place for both sides.
 *
 * Live updates travel as small messages on the LiveKit data channel
 * (`applyBoardMessage`); the solver's screen also saves the whole board to
 * the server every few seconds, which is what a late joiner loads and what
 * admins see in the session review (`parseBoard` checks it).
 */

export const BOARD_TOPIC = "board";
export const BOARD_WIDTH = 10_000;
export const BOARD_HEIGHT = 7_500;
export const BOARD_MAX_PAGES = 10;
export const BOARD_MAX_STROKES_PER_PAGE = 400;
export const BOARD_MAX_POINTS_PER_STROKE = 1_500;
/** Saved boards larger than this are refused (about 4–5 dense pages). */
export const BOARD_MAX_BYTES = 256 * 1024;

/** Pen colours by index: ink, red, blue, green. */
export const BOARD_COLORS = ["#111827", "#dc2626", "#2563eb", "#16a34a"] as const;
/** Pen widths by index, in grid units: fine, normal, marker. */
export const BOARD_WIDTHS = [18, 32, 70] as const;

export type BoardStroke = {
  id: string;
  color: number;
  width: number;
  /** Flat [x0, y0, x1, y1, …] on the grid. */
  points: number[];
};

export type BoardPage = {
  strokes: BoardStroke[];
  /** Show the question's figure behind this page. */
  figure: boolean;
};

export type BoardState = {
  pages: BoardPage[];
  /** The page both sides are looking at. */
  page: number;
};

export type BoardMessage =
  | { t: "s"; p: number; id: string; c: number; w: number; pts: number[] }
  | { t: "a"; p: number; id: string; pts: number[] }
  | { t: "u"; p: number }
  | { t: "x"; p: number }
  | { t: "n" }
  | { t: "g"; p: number }
  | { t: "f"; p: number; on: boolean };

export function emptyBoard(): BoardState {
  return { pages: [{ strokes: [], figure: false }], page: 0 };
}

const STROKE_ID = /^[A-Za-z0-9_-]{1,24}$/;

function isIndex(value: unknown, length: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < length;
}

/** Whole grid coordinates in pairs, clamped to the board; null if malformed. */
export function cleanPoints(raw: unknown, room: number): number[] | null {
  if (!Array.isArray(raw) || raw.length % 2 !== 0 || raw.length === 0) return null;
  if (raw.length / 2 > room) return null;
  const out: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const v = raw[i];
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    const max = i % 2 === 0 ? BOARD_WIDTH : BOARD_HEIGHT;
    out.push(Math.min(max, Math.max(0, Math.round(v))));
  }
  return out;
}

/**
 * Applies one live message. Anything malformed or over a limit leaves the
 * board as it was (the other side is never trusted to stay in bounds).
 */
export function applyBoardMessage(state: BoardState, raw: unknown): BoardState {
  if (!raw || typeof raw !== "object") return state;
  const msg = raw as Record<string, unknown>;
  const pageAt = (p: unknown) => (isIndex(p, state.pages.length) ? (p as number) : null);
  const withPage = (index: number, page: BoardPage): BoardState => ({
    ...state,
    pages: state.pages.map((existing, i) => (i === index ? page : existing)),
  });

  switch (msg.t) {
    case "s": {
      const p = pageAt(msg.p);
      if (p === null || typeof msg.id !== "string" || !STROKE_ID.test(msg.id)) return state;
      if (!isIndex(msg.c, BOARD_COLORS.length) || !isIndex(msg.w, BOARD_WIDTHS.length)) return state;
      const page = state.pages[p];
      if (page.strokes.length >= BOARD_MAX_STROKES_PER_PAGE || page.strokes.some((s) => s.id === msg.id)) return state;
      const points = cleanPoints(msg.pts, BOARD_MAX_POINTS_PER_STROKE);
      if (!points) return state;
      return withPage(p, { ...page, strokes: [...page.strokes, { id: msg.id, color: msg.c as number, width: msg.w as number, points }] });
    }
    case "a": {
      const p = pageAt(msg.p);
      if (p === null || typeof msg.id !== "string") return state;
      const page = state.pages[p];
      const index = page.strokes.findIndex((s) => s.id === msg.id);
      if (index < 0) return state;
      const stroke = page.strokes[index];
      const points = cleanPoints(msg.pts, BOARD_MAX_POINTS_PER_STROKE - stroke.points.length / 2);
      if (!points) return state;
      const strokes = page.strokes.slice();
      strokes[index] = { ...stroke, points: [...stroke.points, ...points] };
      return withPage(p, { ...page, strokes });
    }
    case "u": {
      const p = pageAt(msg.p);
      if (p === null) return state;
      const page = state.pages[p];
      return page.strokes.length === 0 ? state : withPage(p, { ...page, strokes: page.strokes.slice(0, -1) });
    }
    case "x": {
      const p = pageAt(msg.p);
      if (p === null) return state;
      return withPage(p, { ...state.pages[p], strokes: [] });
    }
    case "n": {
      if (state.pages.length >= BOARD_MAX_PAGES) return state;
      return { pages: [...state.pages, { strokes: [], figure: false }], page: state.pages.length };
    }
    case "g": {
      const p = pageAt(msg.p);
      return p === null ? state : { ...state, page: p };
    }
    case "f": {
      const p = pageAt(msg.p);
      if (p === null || typeof msg.on !== "boolean") return state;
      return withPage(p, { ...state.pages[p], figure: msg.on });
    }
    default:
      return state;
  }
}

/**
 * Checks a whole saved board (from the solver's screen, or the database).
 * Returns null when it is not a valid board or breaks a limit.
 */
export function parseBoard(raw: unknown): BoardState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as { pages?: unknown; page?: unknown };
  if (!Array.isArray(value.pages) || value.pages.length === 0 || value.pages.length > BOARD_MAX_PAGES) return null;
  const pages: BoardPage[] = [];
  for (const rawPage of value.pages) {
    if (!rawPage || typeof rawPage !== "object") return null;
    const page = rawPage as { strokes?: unknown; figure?: unknown };
    if (!Array.isArray(page.strokes) || page.strokes.length > BOARD_MAX_STROKES_PER_PAGE) return null;
    const strokes: BoardStroke[] = [];
    const ids = new Set<string>();
    for (const rawStroke of page.strokes) {
      if (!rawStroke || typeof rawStroke !== "object") return null;
      const s = rawStroke as Record<string, unknown>;
      if (typeof s.id !== "string" || !STROKE_ID.test(s.id) || ids.has(s.id)) return null;
      if (!isIndex(s.color, BOARD_COLORS.length) || !isIndex(s.width, BOARD_WIDTHS.length)) return null;
      const points = cleanPoints(s.points, BOARD_MAX_POINTS_PER_STROKE);
      if (!points) return null;
      ids.add(s.id);
      strokes.push({ id: s.id, color: s.color as number, width: s.width as number, points });
    }
    pages.push({ strokes, figure: page.figure === true });
  }
  return { pages, page: isIndex(value.page, pages.length) ? (value.page as number) : 0 };
}

/** True when the board has nothing drawn on any page. */
export function isBoardEmpty(state: BoardState): boolean {
  return state.pages.every((p) => p.strokes.length === 0);
}

/** "x0,y0 x1,y1 …" for an SVG polyline. */
export function polylinePoints(points: readonly number[]): string {
  const parts: string[] = [];
  for (let i = 0; i + 1 < points.length; i += 2) parts.push(`${points[i]},${points[i + 1]}`);
  return parts.join(" ");
}
