/**
 * CBT student room phase — pure logic, shared by CbtRoomContext and unit tests.
 *
 * The `terminal` rule is the client half of the "no re-attempt after submit"
 * guarantee: once a student has submitted (or been kicked, or the room closed),
 * no later state fetch, realtime event, or bfcache restore may move them back
 * into the test. The server already refuses every write/read for a finished
 * attempt (409); this keeps the UI honest so the player never re-mounts.
 */

export type CbtStudentPhase =
  | "checking"
  | "join"
  | "lobby"
  | "in_test"
  | "submitted"
  | "closed"
  | "kicked";

const TERMINAL_PHASES: ReadonlySet<CbtStudentPhase> = new Set<CbtStudentPhase>([
  "submitted",
  "closed",
  "kicked",
]);

/** Terminal phases are final for the student — the test can never re-open. */
export function isTerminalPhase(phase: CbtStudentPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

/** Minimal server-state shape needed to derive the phase. */
export type PhaseStateInput = {
  room: { status: string };
  participant: { finishedAt: string | null };
};

/**
 * Authoritative phase from a freshly fetched room state. `finishedAt` (set by
 * submit, the timer auto-submit, or the server-side finalization of a student
 * who went offline) always wins over `in_test`, so a returning student resolves
 * to `submitted`.
 *
 * A `finished` room resolves to `submitted` too: the server finalizes every
 * open attempt before flipping a room to that status, so there is nothing left
 * for the student to do. Without this it fell through to `lobby` and a student
 * returning after the deadline saw a waiting-room screen forever.
 */
export function phaseFromState(state: PhaseStateInput): CbtStudentPhase {
  if (state.room.status === "closed") return "closed";
  if (state.participant.finishedAt) return "submitted";
  if (state.room.status === "finished") return "submitted";
  if (state.room.status === "in_test") return "in_test";
  return "lobby";
}

/**
 * Apply an incoming phase while honouring terminality: once the student is in a
 * terminal phase, it sticks. Every `setPhase` that can be reached after submit
 * (state refresh, SSE events, bfcache re-check) must route through this.
 */
export function nextPhase(prev: CbtStudentPhase, incoming: CbtStudentPhase): CbtStudentPhase {
  return isTerminalPhase(prev) ? prev : incoming;
}
