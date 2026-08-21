/**
 * Contest reminder scheduling — pure logic (plan Phase 2b). Decides which
 * time-based reminder kinds are "due" for a contest at instant `now`, so the
 * cron can send exactly the right nudges. Idempotency (send-once) is enforced
 * separately by the contest.reminders_sent ledger.
 */

export type ReminderKind = "confirmation" | "t_24h" | "t_1h" | "t_10m" | "results";

/** Time-based reminders keyed to start_at, with the window in which each is due. */
interface TimedReminder {
  kind: Exclude<ReminderKind, "confirmation" | "results">;
  /** ms before start_at the reminder targets. */
  leadMs: number;
}

// A reminder is "due" from its lead time until start_at (so a cron that missed
// the exact minute still catches it). Ordered soonest-lead last.
const TIMED: TimedReminder[] = [
  { kind: "t_24h", leadMs: 24 * 60 * 60 * 1000 },
  { kind: "t_1h", leadMs: 60 * 60 * 1000 },
  { kind: "t_10m", leadMs: 10 * 60 * 1000 },
];

/**
 * Which START-relative reminder kinds are currently due (now is within
 * [start − lead, start)). Returns the set to attempt; the ledger dedupes actual
 * sends. Empty once the contest has started.
 */
export function dueStartReminders(startAt: Date | null, now: Date): ReminderKind[] {
  if (!startAt) return [];
  const start = startAt.getTime();
  const t = now.getTime();
  if (t >= start) return []; // started — no more "starts soon" reminders
  const due: ReminderKind[] = [];
  for (const r of TIMED) {
    if (t >= start - r.leadMs) due.push(r.kind);
  }
  return due;
}

/** Copy for each reminder kind. `{name}` is the contest name. */
export function reminderCopy(kind: ReminderKind, contestName: string): { title: string; body: string } {
  switch (kind) {
    case "confirmation":
      return { title: "You're registered 🎯", body: `You're in for ${contestName}. We'll remind you before it starts.` };
    case "t_24h":
      return { title: "Contest tomorrow", body: `${contestName} starts in about 24 hours. Get some practice in!` };
    case "t_1h":
      return { title: "Contest in 1 hour", body: `${contestName} starts in an hour. Be ready!` };
    case "t_10m":
      return { title: "Starting in 10 minutes ⏰", body: `${contestName} is about to begin. Jump in!` };
    case "results":
      return { title: "Results are out 🏆", body: `Your ${contestName} results and ORBIT change are ready.` };
  }
}
