'use client';

/**
 * Shared board for Origin NOW calls (decision B89).
 *
 * `BoardCanvas` draws a board (read-only in the admin review). `NowRoomBoard`
 * is the live board in the room: the human solver writes on it, every stroke
 * goes to the student over the LiveKit data channel, and the solver's screen
 * saves the whole board every few seconds so a student who rejoins (and the
 * admin review) sees it. Rules and limits live in `src/lib/now-board.ts`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RoomEvent, type RemoteParticipant, type Room } from 'livekit-client';
import { Eraser, FilePlus, Image as ImageIcon, Undo2 } from 'lucide-react';

import { apiCall } from '@/lib/api';
import {
  BOARD_COLORS,
  BOARD_HEIGHT,
  BOARD_MAX_PAGES,
  BOARD_TOPIC,
  BOARD_WIDTH,
  BOARD_WIDTHS,
  applyBoardMessage,
  emptyBoard,
  isBoardEmpty,
  parseBoard,
  polylinePoints,
  type BoardMessage,
  type BoardState,
} from '@/lib/now-board';

const SAVE_EVERY_MS = 5_000;
const SEND_EVERY_MS = 40;
/** Skip points closer than this to the last one (grid units, 0.12% of the width). */
const MIN_STEP = 12;
const COLOR_NAMES = ['Black', 'Red', 'Blue', 'Green'];
const WIDTH_NAMES = ['Fine', 'Normal', 'Marker'];

export function BoardCanvas({
  state,
  figureUrl,
  className,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  svgRef,
}: {
  state: BoardState;
  figureUrl?: string | null;
  className?: string;
  onPointerDown?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: React.PointerEvent<SVGSVGElement>) => void;
  svgRef?: React.Ref<SVGSVGElement>;
}) {
  const page = state.pages[state.page] ?? state.pages[0];
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`}
      className={`aspect-[4/3] w-full max-w-full rounded-md border bg-white ${className ?? ''}`}
      role="img"
      aria-label={`Shared board, page ${state.page + 1} of ${state.pages.length}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {page.figure && figureUrl && (
        <image href={figureUrl} x={0} y={0} width={BOARD_WIDTH} height={BOARD_HEIGHT} preserveAspectRatio="xMidYMid meet" opacity={0.9} />
      )}
      {page.strokes.map((stroke) =>
        stroke.points.length === 2 ? (
          <circle
            key={stroke.id}
            cx={stroke.points[0]}
            cy={stroke.points[1]}
            r={BOARD_WIDTHS[stroke.width] / 2}
            fill={BOARD_COLORS[stroke.color]}
          />
        ) : (
          <polyline
            key={stroke.id}
            points={polylinePoints(stroke.points)}
            fill="none"
            stroke={BOARD_COLORS[stroke.color]}
            strokeWidth={BOARD_WIDTHS[stroke.width]}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
    </svg>
  );
}

function strokeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * The live board in the room. `room` is the connected LiveKit room (null
 * while not connected); only the solver's messages are applied.
 */
export function NowRoomBoard({
  room,
  role,
  sessionId,
  figureUrl,
  roleOf,
}: {
  room: Room | null;
  role: 'student' | 'solver';
  sessionId: string;
  figureUrl: string | null;
  roleOf: (participant: RemoteParticipant | undefined) => string | null;
}) {
  const [board, setBoard] = useState<BoardState>(emptyBoard);
  const [color, setColor] = useState(0);
  const [width, setWidth] = useState(1);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The latest board for event handlers; written together with the state by `commit`.
  const boardRef = useRef(board);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drawing = useRef<{ id: string; page: number; lastX: number; lastY: number } | null>(null);
  const outbox = useRef<number[]>([]);
  const lastSent = useRef(0);
  const dirty = useRef(false);
  const refetchTimer = useRef<number | null>(null);
  const isSolver = role === 'solver';

  const commit = useCallback((next: BoardState) => {
    boardRef.current = next;
    setBoard(next);
  }, []);

  const loadSaved = useCallback(async () => {
    try {
      const res = (await apiCall(`/now/sessions/${encodeURIComponent(sessionId)}/board`)) as { board: unknown };
      const saved = parseBoard(res.board);
      if (saved) commit(saved);
    } catch {
      // Nothing saved yet, or the call is over: keep what is on screen.
    }
  }, [commit, sessionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = (await apiCall(`/now/sessions/${encodeURIComponent(sessionId)}/board`)) as { board: unknown };
        const saved = parseBoard(res.board);
        if (saved && !cancelled) commit(saved);
      } catch {
        // Nothing saved yet: start empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [commit, sessionId]);

  // Student: apply the solver's live messages. A stroke we never saw the start of means we
  // joined mid-stroke or missed messages, so reload the saved board shortly after.
  useEffect(() => {
    if (!room || isSolver) return;
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== BOARD_TOPIC || roleOf(participant) !== 'solver') return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload)) as BoardMessage;
        const before = boardRef.current;
        const after = applyBoardMessage(before, msg);
        if (after === before && msg.t === 'a') {
          if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
          refetchTimer.current = window.setTimeout(() => void loadSaved(), SAVE_EVERY_MS + 1_000);
        }
        commit(after);
      } catch {
        // Ignore anything that is not a board message.
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
      if (refetchTimer.current) window.clearTimeout(refetchTimer.current);
    };
  }, [commit, isSolver, loadSaved, room, roleOf]);

  const send = useCallback(
    (msg: BoardMessage) => {
      if (!room) return;
      void room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true, topic: BOARD_TOPIC })
        .catch(() => undefined);
    },
    [room],
  );

  /** Solver: apply locally, send to the student, remember to save. */
  const act = useCallback(
    (msg: BoardMessage) => {
      const next = applyBoardMessage(boardRef.current, msg);
      if (next === boardRef.current) return;
      commit(next);
      dirty.current = true;
      send(msg);
    },
    [commit, send],
  );

  const save = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    try {
      await apiCall(`/now/sessions/${encodeURIComponent(sessionId)}/board`, {
        method: 'PUT',
        body: JSON.stringify({ board: boardRef.current }),
      });
      setSaveError(null);
    } catch (err) {
      dirty.current = true;
      setSaveError(err instanceof Error ? err.message : 'The board could not be saved.');
    }
  }, [sessionId]);

  // Solver: save every few seconds while something changed, and once more when leaving.
  useEffect(() => {
    if (!isSolver) return;
    const id = window.setInterval(() => void save(), SAVE_EVERY_MS);
    return () => {
      window.clearInterval(id);
      void save();
    };
  }, [isSolver, save]);

  const flush = useCallback(() => {
    const stroke = drawing.current;
    if (!stroke || outbox.current.length === 0) return;
    const pts = outbox.current;
    outbox.current = [];
    lastSent.current = performance.now();
    act({ t: 'a', p: stroke.page, id: stroke.id, pts });
  }, [act]);

  const toGrid = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * BOARD_WIDTH),
      y: Math.round(((event.clientY - rect.top) / rect.height) * BOARD_HEIGHT),
    };
  };

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!isSolver || !room) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = toGrid(event);
    const id = strokeId();
    drawing.current = { id, page: boardRef.current.page, lastX: x, lastY: y };
    outbox.current = [];
    act({ t: 's', p: boardRef.current.page, id, c: color, w: width, pts: [x, y] });
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const stroke = drawing.current;
    if (!stroke) return;
    const { x, y } = toGrid(event);
    if (Math.hypot(x - stroke.lastX, y - stroke.lastY) < MIN_STEP) return;
    stroke.lastX = x;
    stroke.lastY = y;
    outbox.current.push(x, y);
    if (performance.now() - lastSent.current >= SEND_EVERY_MS) flush();
  };

  const onPointerUp = () => {
    flush();
    drawing.current = null;
  };

  const page = board.pages[board.page];
  const toolButton = 'inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs disabled:opacity-50';

  return (
    <div className="flex flex-col gap-2" data-testid="now-board">
      {isSolver && (
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Board tools">
          {BOARD_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              aria-label={`${COLOR_NAMES[i]} pen`}
              aria-pressed={color === i}
              onClick={() => setColor(i)}
              className={`h-7 w-7 rounded-full border-2 ${color === i ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          {BOARD_WIDTHS.map((w, i) => (
            <button
              key={w}
              type="button"
              aria-pressed={width === i}
              onClick={() => setWidth(i)}
              className={`${toolButton} ${width === i ? 'border-primary text-primary' : ''}`}
            >
              {WIDTH_NAMES[i]}
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-border" aria-hidden />
          <button type="button" className={toolButton} onClick={() => act({ t: 'u', p: board.page })} disabled={page.strokes.length === 0}>
            <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
          </button>
          <button type="button" className={toolButton} onClick={() => act({ t: 'x', p: board.page })} disabled={page.strokes.length === 0}>
            <Eraser className="h-3.5 w-3.5" aria-hidden /> Clear page
          </button>
          {figureUrl && (
            <button
              type="button"
              className={`${toolButton} ${page.figure ? 'border-primary text-primary' : ''}`}
              aria-pressed={page.figure}
              onClick={() => act({ t: 'f', p: board.page, on: !page.figure })}
            >
              <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Question figure
            </button>
          )}
          <button type="button" className={toolButton} onClick={() => act({ t: 'n' })} disabled={board.pages.length >= BOARD_MAX_PAGES}>
            <FilePlus className="h-3.5 w-3.5" aria-hidden /> New page
          </button>
        </div>
      )}
      <BoardCanvas
        state={board}
        figureUrl={figureUrl}
        svgRef={svgRef}
        className={isSolver && room ? 'cursor-crosshair touch-none' : ''}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {board.pages.length > 1 &&
          board.pages.map((_, i) => (
            <button
              key={i}
              type="button"
              disabled={!isSolver}
              aria-current={board.page === i ? 'page' : undefined}
              onClick={() => act({ t: 'g', p: i })}
              className={`h-7 min-w-7 rounded-md border px-2 ${board.page === i ? 'border-primary font-semibold text-primary' : ''}`}
            >
              {i + 1}
            </button>
          ))}
        <span>
          {isSolver
            ? 'Write with your mouse, pen or finger. The student sees it as you write; the board is kept with the session.'
            : isBoardEmpty(board)
              ? 'Your solver can write on this board during the call.'
              : 'Your solver’s board. It stays with this session.'}
        </span>
        {saveError && <span className="text-red-600">{saveError}</span>}
      </div>
    </div>
  );
}
