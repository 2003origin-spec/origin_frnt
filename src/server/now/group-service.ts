/**
 * Group sessions (decision B95): a verified solver schedules a session on a
 * chapter; students book seats with coins (held per seat, like a call);
 * in the room the solver speaks and shares a screen, students listen and
 * raise a hand, and the solver hands one of them the mic at a time. Recorded
 * like calls. When it ends: held → the solver is paid per seat (pending
 * 24 h); solver no-show or cut short → every seat refunded. Off until
 * Settings → Extra parts → "Group sessions". Rules in group-rules.ts.
 */

import { deleteR2Object } from "@/server/media-storage";
import { getUserPostgresPool } from "@/server/user-postgres";
import { createPrefixedId } from "@/server/workspaces/ids";

import { logEvent } from "./dispatch-service";
import {
  GROUP_MAX_UPCOMING,
  HOST_NO_SHOW_MS,
  OVERRUN_GRACE_MS,
  canCancelSeat,
  groupInputProblems,
  groupSettlement,
  joinWindow,
  type GroupInput,
} from "./group-rules";
import { sessionCapture, sessionHold, sessionRelease, type Transfer } from "./ledger-rules";
import { postTransfers, withNowTransaction } from "./ledger-store";
import {
  PARTICIPANT_TOKEN_TTL_SECONDS,
  deleteRoom,
  getLiveKitConfig,
  getRecordingBucket,
  getRecordingStorage,
  groupRoomName,
  mintParticipantToken,
  startAudioEgress,
  updateParticipantMic,
  type GroupRole,
} from "./livekit";
import { getNowAccess } from "./now-access";
import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { firstNameOnly } from "./session-rules";
import { isNowSubject } from "./solver-rules";
import { ensureWelcomeGrant } from "./wallet-service";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function requireGroups() {
  const settings = await getNowSettings();
  if (!settings.features.groups) throw new NowError(404, "groups_off", "Group sessions are not switched on.");
  return settings;
}

type GroupRow = {
  id: string;
  helper_id: string;
  subject: string;
  chapter: string;
  title: string;
  description: string | null;
  starts_at: Date;
  minutes: number;
  seats: number;
  price_coins: number;
  status: "scheduled" | "live" | "ended" | "cancelled";
  solver_joined_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  mic_seat_id: string | null;
  settle_outcome: "paid" | "refunded" | null;
  cancel_reason: string | null;
  recording_key: string | null;
};

export type GroupView = {
  id: string;
  subject: string;
  chapter: string;
  title: string;
  description: string | null;
  startsAt: string;
  minutes: number;
  seats: number;
  seatsTaken: number;
  priceCoins: number;
  status: GroupRow["status"];
  solverName: string;
  settleOutcome: GroupRow["settle_outcome"];
  cancelReason: string | null;
  /** Student: their seat, if booked. */
  mySeat: { id: string; status: string; stars: number | null } | null;
  /** The room is open now. */
  canJoin: boolean;
  /** Student: may cancel the seat for its coins. */
  canCancelSeat: boolean;
};

function view(r: GroupRow & { solver_name: string | null; taken: number }, mySeat: GroupView["mySeat"], now: Date): GroupView {
  const window = joinWindow(r.starts_at, r.minutes);
  const open = (r.status === "scheduled" || r.status === "live") && now >= window.opens && now <= window.closes;
  return {
    id: r.id,
    subject: r.subject,
    chapter: r.chapter,
    title: r.title,
    description: r.description,
    startsAt: r.starts_at.toISOString(),
    minutes: r.minutes,
    seats: r.seats,
    seatsTaken: r.taken,
    priceCoins: r.price_coins,
    status: r.status,
    solverName: r.solver_name ?? "Solver",
    settleOutcome: r.settle_outcome,
    cancelReason: r.cancel_reason,
    mySeat,
    canJoin: open,
    canCancelSeat: Boolean(mySeat && mySeat.status === "booked" && r.status === "scheduled" && canCancelSeat(r.starts_at, now)),
  };
}

const SELECT = `SELECT g.*, h.display_name AS solver_name,
                       (SELECT count(*)::int FROM now.group_seats s WHERE s.group_id = g.id AND s.status <> 'cancelled') AS taken
                  FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id`;

async function requireSolver(userId: string) {
  const res = await (await db()).query<{ id: string; verification_status: string }>(
    `SELECT id, verification_status FROM now.helpers WHERE user_id = $1 AND kind = 'human'`,
    [userId],
  );
  const helper = res.rows[0];
  if (!helper) throw new NowError(404, "not_a_solver", "This account is not an Origin NOW solver.");
  if (helper.verification_status !== "verified") throw new NowError(403, "restricted", "Your solver account is on hold.");
  return helper;
}

// ---------------------------------------------------------------------------
// Solver.

export async function scheduleGroup(solverUserId: string, input: GroupInput, now: Date = new Date()): Promise<GroupView> {
  await requireGroups();
  const helper = await requireSolver(solverUserId);
  const subject = input.subject?.trim().toLowerCase();
  if (!isNowSubject(subject)) throw new NowError(400, "invalid_subject", "Pick a subject.");
  const problems = groupInputProblems(input, now);
  if (problems.length) throw new NowError(400, "invalid_group", problems.join(" "));
  const pool = await db();
  const covers = await pool.query(`SELECT 1 FROM now.helper_expertise WHERE helper_id = $1 AND subject = $2 LIMIT 1`, [helper.id, subject]);
  if (!covers.rows.length) throw new NowError(403, "not_your_subject", "You can only run sessions in your own subjects.");
  const upcoming = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM now.group_sessions WHERE helper_id = $1 AND status IN ('scheduled', 'live')`,
    [helper.id],
  );
  if (upcoming.rows[0].n >= GROUP_MAX_UPCOMING) throw new NowError(409, "too_many", `You can have ${GROUP_MAX_UPCOMING} upcoming sessions at a time.`);
  const id = createPrefixedId("ngrp");
  await pool.query(
    `INSERT INTO now.group_sessions (id, helper_id, subject, chapter, title, description, starts_at, minutes, seats, price_coins, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
    [id, helper.id, subject, input.chapter.trim(), input.title.trim(), input.description?.trim() || null, input.startsAt, input.minutes, input.seats, input.priceCoins, now],
  );
  await logEvent(pool, { type: "group.scheduled", actor: solverUserId, payload: { groupId: id, subject, startsAt: input.startsAt.toISOString() } });
  return (await getGroup(id, null, now))!;
}

export async function getGroup(id: string, studentId: string | null, now: Date = new Date()): Promise<GroupView | null> {
  const pool = await db();
  const row = (await pool.query<GroupRow & { solver_name: string | null; taken: number }>(`${SELECT} WHERE g.id = $1`, [id])).rows[0];
  if (!row) return null;
  let seat: GroupView["mySeat"] = null;
  if (studentId) {
    const s = (await pool.query<{ id: string; status: string; stars: number | null }>(
      `SELECT id, status, stars FROM now.group_seats WHERE group_id = $1 AND student_id = $2 AND status <> 'cancelled'`,
      [id, studentId],
    )).rows[0];
    seat = s ?? null;
  }
  return view(row, seat, now);
}

/** The solver's own sessions, upcoming first, with seats taken. */
export async function listMyHostedGroups(solverUserId: string, now: Date = new Date()): Promise<GroupView[]> {
  await requireGroups();
  const helper = await requireSolver(solverUserId);
  const res = await (await db()).query<GroupRow & { solver_name: string | null; taken: number }>(
    `${SELECT} WHERE g.helper_id = $1 AND (g.status IN ('scheduled', 'live') OR g.starts_at >= $2)
      ORDER BY g.starts_at LIMIT 20`,
    [helper.id, new Date(now.getTime() - 7 * 24 * 60 * 60_000)],
  );
  return res.rows.map((r) => view(r, null, now));
}

// ---------------------------------------------------------------------------
// Students.

/** Upcoming sessions a student may book (never across a block), and the ones they booked. */
export async function listUpcomingGroups(studentId: string, now: Date = new Date()): Promise<GroupView[]> {
  await requireGroups();
  const pool = await db();
  const res = await pool.query<GroupRow & { solver_name: string | null; taken: number; seat_id: string | null; seat_status: string | null; seat_stars: number | null }>(
    `SELECT g.*, h.display_name AS solver_name,
            (SELECT count(*)::int FROM now.group_seats s WHERE s.group_id = g.id AND s.status <> 'cancelled') AS taken,
            my.id AS seat_id, my.status AS seat_status, my.stars AS seat_stars
       FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id
       LEFT JOIN now.group_seats my ON my.group_id = g.id AND my.student_id = $1 AND my.status <> 'cancelled'
      WHERE h.user_id <> $1
        AND NOT EXISTS (SELECT 1 FROM now.blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = h.user_id)
                                                     OR (b.blocker_id = h.user_id AND b.blocked_id = $1))
        AND ((g.status IN ('scheduled', 'live') AND g.starts_at + make_interval(mins => g.minutes) > $2)
             OR (my.id IS NOT NULL AND g.starts_at > $2 - interval '7 days'))
      ORDER BY g.starts_at LIMIT 50`,
    [studentId, now],
  );
  return res.rows.map((r) => view(r, r.seat_id ? { id: r.seat_id, status: r.seat_status!, stars: r.seat_stars } : null, now));
}

export async function bookSeat(studentId: string, groupId: string, now: Date = new Date()): Promise<GroupView> {
  await requireGroups();
  const access = await getNowAccess(studentId, now);
  if (!access.canRequest) throw new NowError(403, access.blockedReason ?? "not_invited", "Origin NOW is not open for this account yet.");
  await ensureWelcomeGrant(studentId);
  await withNowTransaction(async (client) => {
    const g = (await client.query<GroupRow & { host_user_id: string }>(
      `SELECT g.*, h.user_id AS host_user_id FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id WHERE g.id = $1 FOR UPDATE OF g`,
      [groupId],
    )).rows[0];
    if (!g || g.status !== "scheduled" || g.starts_at.getTime() <= now.getTime()) throw new NowError(404, "not_open", "This session is not open for booking.");
    if (g.host_user_id === studentId) throw new NowError(400, "own_session", "You cannot book your own session.");
    const blocked = await client.query(
      `SELECT 1 FROM now.blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
      [studentId, g.host_user_id],
    );
    if (blocked.rows.length) throw new NowError(403, "blocked", "You cannot book this session.");
    const seats = await client.query<{ student_id: string }>(`SELECT student_id FROM now.group_seats WHERE group_id = $1 AND status <> 'cancelled'`, [groupId]);
    if (seats.rows.some((s) => s.student_id === studentId)) throw new NowError(409, "already_booked", "You already have a seat.");
    if (seats.rows.length >= g.seats) throw new NowError(409, "full", "This session is full.");
    const seatId = createPrefixedId("ngst");
    await client.query(
      `INSERT INTO now.group_seats (id, group_id, student_id, price_coins, booked_at) VALUES ($1, $2, $3, $4, $5)`,
      [seatId, groupId, studentId, g.price_coins, now],
    );
    // Throws InsufficientCoinsError and rolls the seat back.
    await postTransfers([sessionHold(studentId, seatId, g.price_coins)], { client, now });
    await logEvent(client, { type: "group.booked", requestId: seatId, actor: studentId, payload: { groupId } });
  });
  return (await getGroup(groupId, studentId, now))!;
}

export async function cancelSeat(studentId: string, groupId: string, now: Date = new Date()): Promise<GroupView> {
  await withNowTransaction(async (client) => {
    const g = (await client.query<GroupRow>(`SELECT * FROM now.group_sessions WHERE id = $1 FOR UPDATE`, [groupId])).rows[0];
    if (!g) throw new NowError(404, "not_found", "Not found.");
    const seat = (await client.query<{ id: string; price_coins: number }>(
      `SELECT id, price_coins FROM now.group_seats WHERE group_id = $1 AND student_id = $2 AND status = 'booked' FOR UPDATE`,
      [groupId, studentId],
    )).rows[0];
    if (!seat) throw new NowError(404, "no_seat", "You do not have a seat in this session.");
    if (g.status !== "scheduled" || !canCancelSeat(g.starts_at, now)) {
      throw new NowError(409, "too_late", "Seats can be cancelled until an hour before the start.");
    }
    await client.query(`UPDATE now.group_seats SET status = 'cancelled', cancelled_at = $2 WHERE id = $1`, [seat.id, now]);
    await postTransfers(sessionRelease(studentId, seat.id, seat.price_coins), { client, now });
    await logEvent(client, { type: "group.seat_cancelled", requestId: seat.id, actor: studentId, payload: { groupId } });
  });
  return (await getGroup(groupId, studentId, now))!;
}

export async function rateGroup(studentId: string, groupId: string, stars: number): Promise<GroupView> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new NowError(400, "invalid_stars", "Pick 1 to 5 stars.");
  const res = await (await db()).query(
    `UPDATE now.group_seats s SET stars = $3
       FROM now.group_sessions g
      WHERE s.group_id = g.id AND g.id = $1 AND s.student_id = $2 AND g.status = 'ended' AND s.status IN ('paid', 'refunded') AND s.joined_at IS NOT NULL`,
    [groupId, studentId, stars],
  );
  if (!res.rowCount) throw new NowError(409, "cannot_rate", "You can rate a session you joined, once it has ended.");
  return (await getGroup(groupId, studentId))!;
}

// ---------------------------------------------------------------------------
// The room.

export type GroupTicket = {
  url: string;
  token: string;
  room: string;
  identity: string;
  role: GroupRole;
  recorded: boolean;
  endsAt: string;
  expiresAt: string;
};

/** A LiveKit ticket for the host or a booked student while the room is open. The host's first join starts it. */
export async function issueGroupTicket(userId: string, groupId: string, now: Date = new Date()): Promise<GroupTicket> {
  await requireGroups();
  const pool = await db();
  const g = (await pool.query<GroupRow & { host_user_id: string; host_name: string | null }>(
    `SELECT g.*, h.user_id AS host_user_id, h.display_name AS host_name FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id WHERE g.id = $1`,
    [groupId],
  )).rows[0];
  if (!g) throw new NowError(404, "not_found", "Not found.");
  const isHost = g.host_user_id === userId;
  let seatId: string | null = null;
  let studentName: string | null = null;
  if (!isHost) {
    const seat = (await pool.query<{ id: string; name: string | null }>(
      `SELECT s.id, u.name FROM now.group_seats s JOIN origin_users u ON u.id = s.student_id
        WHERE s.group_id = $1 AND s.student_id = $2 AND s.status = 'booked'`,
      [groupId, userId],
    )).rows[0];
    if (!seat) throw new NowError(404, "no_seat", "Book a seat to join this session.");
    seatId = seat.id;
    studentName = seat.name;
  }
  const window = joinWindow(g.starts_at, g.minutes);
  if (g.status === "ended" || g.status === "cancelled" || now > window.closes) throw new NowError(409, "session_ended", "This session has ended.");
  if (now < window.opens) throw new NowError(409, "not_yet", "The room opens 10 minutes before the start.");
  const config = getLiveKitConfig();
  if (!config) throw new NowError(503, "live_unavailable", "Live sessions are not available right now.");
  const room = groupRoomName(groupId);
  // Per-seat identity, never the user id.
  const identity = isHost ? `host-${groupId}` : `listener-${seatId}`;
  const token = await mintParticipantToken(config, {
    room,
    identity,
    name: isHost ? (g.host_name ?? "Solver") : firstNameOnly(studentName),
    role: isHost ? "host" : "listener",
  });
  if (isHost && !g.solver_joined_at) {
    const started = await pool.query(
      `UPDATE now.group_sessions SET solver_joined_at = $2, started_at = GREATEST($2, starts_at), status = 'live', updated_at = $2
        WHERE id = $1 AND solver_joined_at IS NULL RETURNING id`,
      [groupId, now],
    );
    if (started.rowCount) {
      await logEvent(pool, { type: "group.live", actor: userId, payload: { groupId } });
      await startGroupRecording(groupId).catch(() => undefined);
    }
  }
  if (!isHost) await pool.query(`UPDATE now.group_seats SET joined_at = COALESCE(joined_at, $2) WHERE id = $1`, [seatId, now]);
  return {
    url: config.wsUrl,
    token,
    room,
    identity,
    role: isHost ? "host" : "listener",
    recorded: getRecordingStorage() !== null,
    endsAt: new Date(Math.max(g.starts_at.getTime(), (g.started_at ?? now).getTime()) + g.minutes * 60_000).toISOString(),
    expiresAt: new Date(now.getTime() + PARTICIPANT_TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
}

async function startGroupRecording(groupId: string): Promise<void> {
  const config = getLiveKitConfig();
  const storage = getRecordingStorage();
  const pool = await db();
  if (!config || !storage) {
    await logEvent(pool, {
      type: "group.recording_unavailable",
      actor: "system",
      payload: { groupId, reason: getRecordingBucket().problem === "public" ? "bucket_is_public" : "not_configured" },
    });
    return;
  }
  const objectKey = `origin-now/recordings/group-${groupId}.ogg`;
  const egressId = await startAudioEgress(config, storage, { room: groupRoomName(groupId), objectKey });
  await pool.query(`UPDATE now.group_sessions SET recording_key = $2, recording_egress_id = $3 WHERE id = $1 AND recording_egress_id IS NULL`, [
    groupId,
    objectKey,
    egressId,
  ]);
}

/** The host gives one booked student the mic (taking it from whoever had it), or takes it back. */
export async function setGroupMic(hostUserId: string, groupId: string, seatId: string | null, now: Date = new Date()): Promise<{ micSeatId: string | null }> {
  const pool = await db();
  const g = (await pool.query<GroupRow & { host_user_id: string }>(
    `SELECT g.*, h.user_id AS host_user_id FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id WHERE g.id = $1`,
    [groupId],
  )).rows[0];
  if (!g || g.host_user_id !== hostUserId) throw new NowError(404, "not_found", "Not found.");
  if (g.status !== "live") throw new NowError(409, "not_live", "The session is not live.");
  if (seatId) {
    const seat = await pool.query(`SELECT 1 FROM now.group_seats WHERE id = $1 AND group_id = $2 AND status = 'booked'`, [seatId, groupId]);
    if (!seat.rows.length) throw new NowError(404, "no_seat", "That student is not in this session.");
  }
  const config = getLiveKitConfig();
  const room = groupRoomName(groupId);
  if (config && g.mic_seat_id && g.mic_seat_id !== seatId) await updateParticipantMic(config, room, `listener-${g.mic_seat_id}`, false);
  if (config && seatId) await updateParticipantMic(config, room, `listener-${seatId}`, true);
  await pool.query(`UPDATE now.group_sessions SET mic_seat_id = $2, updated_at = $3 WHERE id = $1`, [groupId, seatId, now]);
  await logEvent(pool, { type: seatId ? "group.mic_given" : "group.mic_taken", actor: hostUserId, payload: { groupId, seatId } });
  return { micSeatId: seatId };
}

/** Ends a session (the host, an admin, or the sweep) and settles every seat. */
export async function endGroup(
  actor: { userId: string } | { system: "timer" | "no_show" | "admin" },
  groupId: string,
  now: Date = new Date(),
  reason: string | null = null,
): Promise<GroupView> {
  let outcome: "paid" | "refunded" = "refunded";
  await withNowTransaction(async (client) => {
    const g = (await client.query<GroupRow & { host_user_id: string }>(
      `SELECT g.*, h.user_id AS host_user_id FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id WHERE g.id = $1 FOR UPDATE OF g`,
      [groupId],
    )).rows[0];
    if (!g) throw new NowError(404, "not_found", "Not found.");
    if ("userId" in actor && actor.userId !== g.host_user_id) throw new NowError(403, "not_host", "Only the solver can end the session.");
    if (g.status === "ended" || g.status === "cancelled") return;
    const cancelled = !("userId" in actor) && (actor.system === "admin" || actor.system === "no_show") && g.status === "scheduled";
    outcome = cancelled ? "refunded" : groupSettlement({ solverJoinedAt: g.solver_joined_at, startedAt: g.started_at, endedAt: now, minutes: g.minutes });
    await client.query(
      `UPDATE now.group_sessions SET status = $2, ended_at = $3, ended_by = $4, settled_at = $3, settle_outcome = $5, cancel_reason = $6,
              mic_seat_id = NULL, updated_at = $3
        WHERE id = $1`,
      [groupId, cancelled ? "cancelled" : "ended", now, "userId" in actor ? "host" : actor.system, outcome, reason],
    );
    const seats = (await client.query<{ id: string; student_id: string; price_coins: number }>(
      `SELECT id, student_id, price_coins FROM now.group_seats WHERE group_id = $1 AND status = 'booked' FOR UPDATE`,
      [groupId],
    )).rows;
    const { commissionBps } = await getNowSettings();
    const transfers: Transfer[] = [];
    for (const seat of seats) {
      transfers.push(
        ...(outcome === "paid"
          ? sessionCapture({ requestId: seat.id, heldCoins: seat.price_coins, solverKind: "human", solverUserId: g.host_user_id, commissionBps, endedAt: now })
          : sessionRelease(seat.student_id, seat.id, seat.price_coins)),
      );
    }
    await client.query(`UPDATE now.group_seats SET status = $2 WHERE group_id = $1 AND status = 'booked'`, [groupId, outcome]);
    if (transfers.length) await postTransfers(transfers, { client, now });
    await logEvent(client, { type: `group.${cancelled ? "cancelled" : "ended"}`, actor: "userId" in actor ? actor.userId : "system", payload: { groupId, outcome, seats: seats.length, reason } });
  });
  const config = getLiveKitConfig();
  if (config) await deleteRoom(config, groupRoomName(groupId)).catch(() => undefined);
  return (await getGroup(groupId, null, now))!;
}

/** The host cancels before it starts: every seat refunded. */
export async function cancelGroupByHost(hostUserId: string, groupId: string, reason: string, now: Date = new Date()): Promise<GroupView> {
  const g = await getGroup(groupId, null, now);
  const helper = await requireSolver(hostUserId);
  const owns = await (await db()).query(`SELECT 1 FROM now.group_sessions WHERE id = $1 AND helper_id = $2`, [groupId, helper.id]);
  if (!g || !owns.rows.length) throw new NowError(404, "not_found", "Not found.");
  if (g.status !== "scheduled") throw new NowError(409, "invalid_state", "Only a session that has not started can be cancelled.");
  if (reason.trim().length < 5) throw new NowError(400, "reason_required", "Tell the students why (5 characters or more).");
  return endGroup({ system: "admin" }, groupId, now, `Cancelled by the solver: ${reason.trim().slice(0, 200)}`);
}

// ---------------------------------------------------------------------------
// Sweep, retention, admin.

/** Ends sessions whose solver never came (refund) and sessions past their planned end (settle). */
export async function runGroupSweep(now: Date = new Date()): Promise<{ noShows: number; ended: number }> {
  const pool = await db();
  const noShow = await pool.query<{ id: string }>(
    `SELECT id FROM now.group_sessions WHERE status = 'scheduled' AND solver_joined_at IS NULL AND starts_at <= $1 LIMIT 50`,
    [new Date(now.getTime() - HOST_NO_SHOW_MS)],
  );
  let noShows = 0;
  for (const { id } of noShow.rows) {
    await endGroup({ system: "no_show" }, id, now, "The solver did not join.")
      .then(() => (noShows += 1))
      .catch((error) => console.error("[origin-now] group no-show failed", id, error instanceof Error ? error.message : error));
  }
  const overrun = await pool.query<{ id: string }>(
    `SELECT id FROM now.group_sessions
      WHERE status = 'live' AND GREATEST(starts_at, started_at) + make_interval(mins => minutes) <= $1 LIMIT 50`,
    [new Date(now.getTime() - OVERRUN_GRACE_MS)],
  );
  let ended = 0;
  for (const { id } of overrun.rows) {
    await endGroup({ system: "timer" }, id, now)
      .then(() => (ended += 1))
      .catch((error) => console.error("[origin-now] group end failed", id, error instanceof Error ? error.message : error));
  }
  return { noShows, ended };
}

/** Group recordings follow the same retention as calls (Settings → recording kept). */
export async function purgeGroupRecordings(now: Date = new Date()): Promise<number> {
  const bucket = getRecordingBucket().name;
  if (!bucket) return 0;
  const { recordingRetentionDays } = await getNowSettings();
  const pool = await db();
  const due = await pool.query<{ id: string; recording_key: string }>(
    `SELECT g.id, g.recording_key FROM now.group_sessions g
      WHERE g.recording_key IS NOT NULL AND g.recording_deleted_at IS NULL AND g.ended_at <= $1
        AND NOT EXISTS (SELECT 1 FROM now.reports r WHERE r.group_session_id = g.id AND r.status = 'open')
      LIMIT 200`,
    [new Date(now.getTime() - recordingRetentionDays * 24 * 60 * 60_000)],
  );
  let deleted = 0;
  for (const row of due.rows) {
    try {
      await deleteR2Object({ bucket, objectKey: row.recording_key });
      await pool.query(`UPDATE now.group_sessions SET recording_key = NULL, recording_deleted_at = $2 WHERE id = $1`, [row.id, now]);
      deleted += 1;
    } catch (error) {
      console.warn("[origin-now] group recording delete failed", row.id, error instanceof Error ? error.message : error);
    }
  }
  return deleted;
}

export async function listGroupsForAdmin(now: Date = new Date()): Promise<(GroupView & { solverUserId: string })[]> {
  const res = await (await db()).query<GroupRow & { solver_name: string | null; taken: number; solver_user_id: string }>(
    `SELECT g.*, h.display_name AS solver_name, h.user_id AS solver_user_id,
            (SELECT count(*)::int FROM now.group_seats s WHERE s.group_id = g.id AND s.status <> 'cancelled') AS taken
       FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id
      ORDER BY g.starts_at DESC LIMIT 200`,
  );
  return res.rows.map((r) => ({ ...view(r, null, now), solverUserId: r.solver_user_id }));
}

/** A student reports a group session they booked: a case in the reports queue (recording kept while it is open). */
export async function reportGroup(studentId: string, groupId: string, input: { reason: string; details?: string | null }, now: Date = new Date()) {
  const pool = await db();
  const row = (await pool.query<{ helper_id: string; user_id: string }>(
    `SELECT g.helper_id, h.user_id FROM now.group_sessions g JOIN now.helpers h ON h.id = g.helper_id
      JOIN now.group_seats s ON s.group_id = g.id AND s.student_id = $2 AND s.status <> 'cancelled'
      WHERE g.id = $1`,
    [groupId, studentId],
  )).rows[0];
  if (!row) throw new NowError(404, "not_found", "Not found.");
  await pool.query(
    `INSERT INTO now.reports (id, session_id, reporter_id, reported_user_id, reported_helper_id, reporter_role, reason, details, group_session_id, created_at)
     VALUES ($1, NULL, $2, $3, $4, 'student', $5, $6, $7, $8)`,
    [createPrefixedId("nrep"), studentId, row.user_id, row.helper_id, input.reason, `Group session ${groupId}${input.details?.trim() ? `: ${input.details.trim().slice(0, 900)}` : ""}`, groupId, now],
  );
  await logEvent(pool, { type: "group.reported", actor: studentId, payload: { groupId, reason: input.reason } });
  return { reported: true };
}
