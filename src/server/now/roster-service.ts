/**
 * Weekly roster (pilot readiness item 3, decision B82): solvers mark the
 * evenings and subjects they will cover; the admin sees cover per subject per
 * evening and, for past evenings, who actually came online.
 */

import { getUserPostgresPool } from "@/server/user-postgres";

import { NowError } from "./now-http";
import { ensureNowSchema } from "./now-schema";
import { getNowSettings } from "./now-settings";
import { ROSTER_DAYS_AHEAD, ROSTER_DAYS_BACK, addDays, coverLevel, istDay, rosterDays, rosterEditBlock, type CoverLevel } from "./roster-rules";
import { NOW_SUBJECTS } from "./solver-rules";

async function db() {
  await ensureNowSchema();
  const p = getUserPostgresPool();
  if (!p) throw new Error("USER_DATABASE_URL is not configured");
  return p;
}

async function loadSolver(userId: string) {
  const pool = await db();
  const res = await pool.query<{ id: string; verification_status: string; subjects: string[] | null }>(
    `SELECT h.id, h.verification_status,
            (SELECT array_agg(DISTINCT e.subject ORDER BY e.subject) FROM now.helper_expertise e WHERE e.helper_id = h.id) AS subjects
       FROM now.helpers h WHERE h.user_id = $1 AND h.kind = 'human'`,
    [userId],
  );
  const row = res.rows[0];
  if (!row) throw new NowError(403, "not_a_solver", "Only approved solvers can do this.");
  return { helperId: row.id, verified: row.verification_status === "verified", subjects: row.subjects ?? [] };
}

export type MyRoster = {
  subjects: string[];
  openHours: { from: string; to: string };
  canEdit: boolean;
  days: { day: string; weekday: number; open: boolean; editable: boolean; subjects: string[] }[];
};

/** The solver's next 14 evenings with the subjects they marked for each. */
export async function getMyRoster(userId: string, now: Date = new Date()): Promise<MyRoster> {
  const solver = await loadSolver(userId);
  const { openHours } = await getNowSettings();
  const days = rosterDays(now, openHours);
  const res = await (await db()).query<{ day: string; subject: string }>(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, subject FROM now.roster WHERE helper_id = $1 AND day BETWEEN $2 AND $3`,
    [solver.helperId, days[0].day, days[days.length - 1].day],
  );
  return {
    subjects: solver.subjects,
    openHours: { from: openHours.from, to: openHours.to },
    canEdit: solver.verified,
    days: days.map((d) => ({
      ...d,
      editable: d.editable && solver.verified,
      subjects: res.rows.filter((r) => r.day === d.day && solver.subjects.includes(r.subject)).map((r) => r.subject),
    })),
  };
}

/** Marks or clears one evening for one subject. */
export async function setRosterSlot(
  userId: string,
  input: { day: string; subject: string; on: boolean },
  now: Date = new Date(),
): Promise<MyRoster> {
  const solver = await loadSolver(userId);
  if (!solver.verified) throw new NowError(403, "restricted", "Your solver account is on hold.");
  if (!solver.subjects.includes(input.subject)) throw new NowError(400, "not_your_subject", "You are not approved for that subject.");
  const { openHours } = await getNowSettings();
  const block = rosterEditBlock(input.day, now, openHours);
  if (block) throw new NowError(409, "roster_locked", block);
  const pool = await db();
  if (input.on) {
    await pool.query(`INSERT INTO now.roster (helper_id, day, subject) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [
      solver.helperId,
      input.day,
      input.subject,
    ]);
  } else {
    await pool.query(`DELETE FROM now.roster WHERE helper_id = $1 AND day = $2 AND subject = $3`, [solver.helperId, input.day, input.subject]);
  }
  return getMyRoster(userId, now);
}

export type AdminRosterDay = {
  day: string;
  weekday: number;
  open: boolean;
  past: boolean;
  subjects: Record<
    string,
    {
      cover: CoverLevel;
      solvers: { helperId: string; name: string; restricted: boolean; onlineMinutes: number | null }[];
    }
  >;
};

/**
 * The last 7 and the next 14 evenings: who is rostered per subject, the cover
 * level (counting verified solvers only), and for today and past evenings the
 * minutes each rostered solver was online inside human hours.
 */
export async function getRosterForAdmin(now: Date = new Date()): Promise<{ openHours: { from: string; to: string }; days: AdminRosterDay[] }> {
  const { openHours } = await getNowSettings();
  const today = istDay(now.getTime());
  const first = addDays(today, -ROSTER_DAYS_BACK);
  const last = addDays(today, ROSTER_DAYS_AHEAD - 1);
  const pool = await db();
  const [slots, online] = await Promise.all([
    pool.query<{ day: string; subject: string; helper_id: string; display_name: string; verification_status: string }>(
      `SELECT to_char(r.day, 'YYYY-MM-DD') AS day, r.subject, r.helper_id, h.display_name, h.verification_status
         FROM now.roster r JOIN now.helpers h ON h.id = r.helper_id
        WHERE r.day BETWEEN $1 AND $2 ORDER BY h.display_name`,
      [first, last],
    ),
    // Minutes online inside the shift window, per helper per IST day. A window
    // crossing midnight counts its after-midnight minutes on the next day.
    pool.query<{ day: string; helper_id: string; minutes: number }>(
      `SELECT to_char((p.minute AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, p.helper_id, count(*)::int AS minutes
         FROM now.presence_minutes p
        WHERE p.minute >= $1::date::timestamp AT TIME ZONE 'Asia/Kolkata'
          AND p.minute < ($2::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
          AND CASE WHEN $3::time < $4::time
                   THEN (p.minute AT TIME ZONE 'Asia/Kolkata')::time >= $3::time AND (p.minute AT TIME ZONE 'Asia/Kolkata')::time < $4::time
                   ELSE (p.minute AT TIME ZONE 'Asia/Kolkata')::time >= $3::time OR (p.minute AT TIME ZONE 'Asia/Kolkata')::time < $4::time END
        GROUP BY 1, 2`,
      [first, today, openHours.from, openHours.to],
    ),
  ]);
  const minutesOf = new Map(online.rows.map((r) => [`${r.day}|${r.helper_id}`, r.minutes]));
  const span = ROSTER_DAYS_BACK + ROSTER_DAYS_AHEAD;
  const startDate = new Date(Date.parse(`${first}T00:00:00+05:30`));
  const days = rosterDays(startDate, openHours, span).map<AdminRosterDay>((d) => {
    const past = d.day <= today;
    const subjects: AdminRosterDay["subjects"] = {};
    for (const subject of NOW_SUBJECTS) {
      const solvers = slots.rows
        .filter((s) => s.day === d.day && s.subject === subject)
        .map((s) => ({
          helperId: s.helper_id,
          name: s.display_name,
          restricted: s.verification_status !== "verified",
          onlineMinutes: past ? (minutesOf.get(`${d.day}|${s.helper_id}`) ?? 0) : null,
        }));
      subjects[subject] = { cover: coverLevel(solvers.filter((s) => !s.restricted).length), solvers };
    }
    return { day: d.day, weekday: d.weekday, open: d.open, past, subjects };
  });
  return { openHours: { from: openHours.from, to: openHours.to }, days };
}
