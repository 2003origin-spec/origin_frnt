import type {
  AppStore,
  StoredDailyActivity,
  StoredPointLog,
  StoredStreakData,
  StoredUser,
  StoredUserScore,
} from "@/server/store";
import { createId } from "@/server/store";

export const RANK_TIERS: Array<[number, string]> = [
  [0,      "Novice"],
  [100,    "Beginner"],
  [300,    "Apprentice"],
  [600,    "Intermediate"],
  [1000,   "Advanced"],
  [1500,   "Elite"],
  [2200,   "Expert"],
  [3200,   "Veteran"],
  [4500,   "Master"],
  [6000,   "Grandmaster"],
  [8000,   "Legend"],
  [12000,  "Mythic"],
  [18000,  "Immortal"],
  [25000,  "Eternal"],
  [40000,  "Prime"],
  [60000,  "Celestial"],
  [90000,  "Ascendant"],
  [130000, "Divine"],
  [200000, "Omniscient"],
  [300000, "Origin"],
];

export const DIFFICULTY_POINTS: Record<string, number> = {
  easy: 10,
  medium: 25,
  hard: 50,
  insane: 100,
};

export type TimedPracticeScore = {
  basePoints: number;
  maxPoints: number;
  pointsAwarded: number;
  resultScore: number;
  targetTimeSeconds: number;
  timeSpentSeconds: number;
  speedMultiplier: number;
  speedBand: "blazing" | "fast" | "steady" | "deliberate" | "slow";
};

const PRACTICE_TARGET_SECONDS: Record<string, number> = {
  easy: 45,
  medium: 90,
  hard: 180,
  insane: 300,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getPracticeSpeedMultiplier(timeRatio: number): number {
  if (timeRatio <= 0.5) {
    return 1.35;
  }
  if (timeRatio <= 1) {
    return 1.35 - ((timeRatio - 0.5) / 0.5) * 0.35;
  }
  if (timeRatio <= 1.75) {
    return 1 - ((timeRatio - 1) / 0.75) * 0.3;
  }
  return 0.55;
}

function getPracticeSpeedBand(timeRatio: number): TimedPracticeScore["speedBand"] {
  if (timeRatio <= 0.5) {
    return "blazing";
  }
  if (timeRatio <= 0.85) {
    return "fast";
  }
  if (timeRatio <= 1.2) {
    return "steady";
  }
  if (timeRatio <= 1.75) {
    return "deliberate";
  }
  return "slow";
}

export function calculateTimedPracticeScore(
  difficulty: string,
  timeSpentSeconds: number,
  options: { isCorrect: boolean; alreadySolved?: boolean } = { isCorrect: false },
): TimedPracticeScore {
  const basePoints = DIFFICULTY_POINTS[difficulty] ?? DIFFICULTY_POINTS.medium;
  const targetTimeSeconds = PRACTICE_TARGET_SECONDS[difficulty] ?? PRACTICE_TARGET_SECONDS.medium;
  const safeTimeSpentSeconds = Math.max(1, Math.round(timeSpentSeconds || targetTimeSeconds));
  const timeRatio = safeTimeSpentSeconds / targetTimeSeconds;
  const speedMultiplier = Number(clamp(getPracticeSpeedMultiplier(timeRatio), 0.55, 1.35).toFixed(3));
  const speedBand = getPracticeSpeedBand(timeRatio);
  const maxPoints = Math.round(basePoints * 1.35) + 5;

  const resultScore = options.isCorrect
    ? Math.max(5, Math.round(basePoints * speedMultiplier) + 5)
    : 0;
  const pointsAwarded = options.isCorrect && !options.alreadySolved ? resultScore : 0;

  return {
    basePoints,
    maxPoints,
    pointsAwarded,
    resultScore,
    targetTimeSeconds,
    timeSpentSeconds: safeTimeSpentSeconds,
    speedMultiplier,
    speedBand,
  };
}

/** Streak freezes granted per calendar month — auto-consumed to bridge a missed
 *  day so the streak survives (Duolingo-style loss aversion). */
export const FREEZES_PER_MONTH = 2;

// India-only product: all day-bucketing rolls over at 00:00 IST (UTC+5:30),
// not 00:00 UTC. Shift "now" by +5:30 and read the UTC calendar date.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}
function todayString(): string {
  return istNow().toISOString().slice(0, 10);
}
/** Whole IST days from date-string a → b (both YYYY-MM-DD). */
function daysBetweenStrings(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function lastSevenDays(today: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => {
    const target = new Date(today);
    target.setUTCDate(today.getUTCDate() - (6 - index));
    return target.toISOString().slice(0, 10);
  });
}

export function getTierForPoints(points: number): string {
  let tier = RANK_TIERS[0][1];
  for (const [minimumPoints, label] of RANK_TIERS) {
    if (points >= minimumPoints) {
      tier = label;
    } else {
      break;
    }
  }
  return tier;
}

export function getOrCreateUserScore(store: AppStore, userId: string): StoredUserScore {
  let score = store.userScores.find((entry) => entry.userId === userId);
  if (!score) {
    score = {
      userId,
      totalPoints: 0,
      currentTier: getTierForPoints(0),
      lastUpdated: new Date().toISOString(),
    };
    store.userScores.push(score);
  }
  return score;
}

export function getOrCreateStreak(store: AppStore, userId: string): StoredStreakData {
  let streak = store.streaks.find((entry) => entry.userId === userId);
  if (!streak) {
    streak = {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: null,
      weeklyData: [false, false, false, false, false, false, false],
      freezesRemaining: FREEZES_PER_MONTH,
      freezeMonth: todayString().slice(0, 7),
    };
    store.streaks.push(streak);
  }
  return streak;
}

export function getOrCreateDailyActivity(store: AppStore, userId: string, date = todayString()): StoredDailyActivity {
  let activity = store.dailyActivities.find((entry) => entry.userId === userId && entry.date === date);
  if (!activity) {
    activity = {
      userId,
      date,
      questionsPracticed: 0,
      webpageTime: 0,
      practiceTime: 0,
      pomodoroTime: 0,
    };
    store.dailyActivities.push(activity);
  }
  return activity;
}

export function updateWeeklyData(store: AppStore, userId: string): void {
  const streak = getOrCreateStreak(store, userId);
  const today = istNow();
  const dateWindow = lastSevenDays(today);
  const activeDates = new Set(
    store.dailyActivities
      .filter((entry) => entry.userId === userId && dateWindow.includes(entry.date))
      .map((entry) => entry.date),
  );
  streak.weeklyData = dateWindow.map((date) => activeDates.has(date));
}

/** How the streak changed when an "active today" was recorded. */
export type StreakEventKind = "increased" | "reset" | "first" | "same";

/** Result of a login touch — drives the first-login-of-the-day celebration. */
export interface StreakTouchResult {
  /** What happened to the number this touch. */
  event: StreakEventKind;
  /** Streak value before this touch. */
  previous: number;
  /** Streak value after this touch. */
  current: number;
  /** Longest streak on record (post-touch). */
  longest: number;
  /** Whether the celebration overlay should fire (once per IST day). */
  celebrate: boolean;
}

/**
 * Core streak transition for an "active today" event. Advances the streak,
 * consuming freezes to bridge gaps, and reports the transition kind. Shared by
 * the study path (`updateUserStreak`) and the login path (`touchLoginStreak`).
 * Mutates the streak record + the denormalised `user.streak` mirror. Returns
 * `null` only when the user row is missing.
 */
function advanceStreak(store: AppStore, userId: string): { event: StreakEventKind; previous: number } | null {
  const streak = getOrCreateStreak(store, userId);
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }

  const previous = streak.currentStreak;
  const today = todayString();

  // Replenish the freeze allowance at the start of each (IST) month. Also
  // back-fills the fields for streak records created before freezes existed.
  const month = today.slice(0, 7);
  if (streak.freezeMonth !== month) {
    streak.freezeMonth = month;
    streak.freezesRemaining = FREEZES_PER_MONTH;
  }
  if (streak.freezesRemaining == null) {
    streak.freezesRemaining = FREEZES_PER_MONTH;
  }

  // Same IST day → already counted; nothing to do.
  if (streak.lastStudyDate === today) {
    updateWeeklyData(store, userId);
    return { event: "same", previous };
  }

  let event: StreakEventKind;
  if (!streak.lastStudyDate) {
    streak.currentStreak = 1;
    event = "first";
  } else {
    const gap = daysBetweenStrings(streak.lastStudyDate, today);
    if (gap === 1) {
      // Consecutive day.
      streak.currentStreak += 1;
      event = "increased";
    } else if (gap > 1) {
      // Missed days. A freeze can cover each missed day (loss aversion — the
      // streak survives) if the student has budget; otherwise it resets.
      const missed = gap - 1;
      if ((streak.freezesRemaining ?? 0) >= missed) {
        streak.freezesRemaining = (streak.freezesRemaining ?? 0) - missed;
        streak.currentStreak += 1;
        event = "increased";
      } else {
        streak.currentStreak = 1;
        event = "reset";
      }
    } else {
      // gap <= 0 (clock skew / same day already handled) — treat as no change.
      streak.currentStreak = Math.max(1, streak.currentStreak);
      event = "same";
    }
  }

  streak.lastStudyDate = today;
  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
  }

  updateWeeklyData(store, userId);
  user.streak = streak.currentStreak;
  return { event, previous };
}

export function updateUserStreak(store: AppStore, userId: string): number {
  const result = advanceStreak(store, userId);
  if (!result) {
    return 0;
  }
  return getOrCreateStreak(store, userId).currentStreak;
}

/**
 * Record a login as "active today" and decide whether to fire the first-login
 * celebration. Idempotent per IST day: the overlay fires at most once a day,
 * gated by `lastCelebratedDate` (server-authoritative, survives reloads and is
 * consistent across devices). Safe to call on every dashboard load.
 *
 * `celebrate` is true whenever the overlay hasn't yet shown today and the user
 * has a live streak — even if the streak was already advanced earlier today by
 * studying (that case reports `event: "same"` so the UI shows a gentle welcome
 * rather than a "+1").
 */
export function touchLoginStreak(store: AppStore, userId: string): StreakTouchResult | null {
  const result = advanceStreak(store, userId);
  if (!result) {
    return null;
  }
  const streak = getOrCreateStreak(store, userId);
  const today = todayString();
  const current = streak.currentStreak;
  const celebrate = streak.lastCelebratedDate !== today && current > 0;
  if (celebrate) {
    streak.lastCelebratedDate = today;
  }
  return {
    event: result.event,
    previous: result.previous,
    current,
    longest: streak.longestStreak,
    celebrate,
  };
}

export function awardPoints(
  store: AppStore,
  userId: string,
  points: number,
  activityType: string,
  description: string,
  referenceId: string | null = null,
): StoredPointLog | null {
  if (points <= 0) {
    return null;
  }

  const score = getOrCreateUserScore(store, userId);
  const prevPoints = score.totalPoints;
  score.totalPoints += points;
  score.currentTier = getTierForPoints(score.totalPoints);
  score.lastUpdated = new Date().toISOString();

  // Detect newly crossed badge thresholds
  const newlyUnlocked = RANK_TIERS
    .filter(([threshold]) => threshold > 0 && prevPoints < threshold && score.totalPoints >= threshold)
    .map(([, name]) => name);
  if (newlyUnlocked.length > 0) {
    if (!score.pendingBadges) score.pendingBadges = [];
    score.pendingBadges.push(...newlyUnlocked);
  }

  const log: StoredPointLog = {
    id: createId("point_log"),
    userId,
    points,
    activityType,
    description,
    timestamp: new Date().toISOString(),
    referenceId,
  };
  store.pointLogs.unshift(log);
  return log;
}

/**
 * OGCode Scoring V2 point application — unlike awardPoints, deltas can be
 * NEGATIVE (JEE Advanced wrong-pick penalty on MSQ/Matrix Match). The running
 * total floors at 0 so a new student never shows a negative lifetime score;
 * the point log records the requested delta (capped to what was actually
 * deducted) for auditability.
 */
export function applyOgcodeScoreDelta(
  store: AppStore,
  userId: string,
  points: number,
  description: string,
  referenceId: string | null = null,
): StoredPointLog | null {
  if (points > 0) {
    return awardPoints(store, userId, points, "practice", description, referenceId);
  }
  if (points === 0) {
    return null;
  }

  const score = getOrCreateUserScore(store, userId);
  const applied = Math.max(points, -score.totalPoints);
  if (applied === 0) {
    return null;
  }
  score.totalPoints += applied;
  score.currentTier = getTierForPoints(score.totalPoints);
  score.lastUpdated = new Date().toISOString();

  const log: StoredPointLog = {
    id: createId("point_log"),
    userId,
    points: applied,
    activityType: "practice",
    description,
    timestamp: new Date().toISOString(),
    referenceId,
  };
  store.pointLogs.unshift(log);
  return log;
}

export function recordTime(
  store: AppStore,
  userId: string,
  timeType: "webpage" | "practice" | "pomodoro",
  timeSpent: number,
  subject?: string | null,
): { createdToday: boolean; recordedSeconds: number } {
  const date = todayString();
  const existed = store.dailyActivities.some((entry) => entry.userId === userId && entry.date === date);
  const activity = getOrCreateDailyActivity(store, userId, date);

  if (!existed) {
    awardPoints(store, userId, 5, "consistency", "Daily consistency reward", date);
    updateUserStreak(store, userId);
  }

  if (timeType === "webpage") {
    activity.webpageTime += timeSpent;
  } else if (timeType === "practice") {
    activity.practiceTime += timeSpent;
  } else {
    activity.pomodoroTime += timeSpent;
  }

  if (subject) {
    const normalizedSubject = subject.trim();
    const existing = store.dailySubjectActivities.find(
      (entry) => entry.userId === userId && entry.date === date && entry.subject === normalizedSubject,
    );
    if (existing) {
      existing.timeSpent += timeSpent;
    } else {
      store.dailySubjectActivities.push({
        userId,
        date,
        subject: normalizedSubject,
        timeSpent,
      });
    }
  }

  return {
    createdToday: !existed,
    recordedSeconds: timeSpent,
  };
}

export function buildPointsSummary(store: AppStore, userId: string) {
  const score = getOrCreateUserScore(store, userId);
  const currentTierIndex = Math.max(
    0,
    RANK_TIERS.findIndex(([, label]) => label === score.currentTier),
  );
  const nextTier = RANK_TIERS[currentTierIndex + 1];
  const recentLogs = store.pointLogs
    .filter((entry) => entry.userId === userId)
    .slice(0, 10)
    .map((entry) => ({
      points: entry.points,
      type: entry.activityType,
      description: entry.description,
      timestamp: entry.timestamp,
    }));

  return {
    totalPoints: score.totalPoints,
    total_points: score.totalPoints,
    currentTier: score.currentTier,
    current_tier: score.currentTier,
    nextTier: nextTier?.[1] ?? "Origin",
    next_tier: nextTier?.[1] ?? "Origin",
    pointsToNext: nextTier ? Math.max(0, nextTier[0] - score.totalPoints) : 0,
    points_to_next: nextTier ? Math.max(0, nextTier[0] - score.totalPoints) : 0,
    progressPercent: nextTier ? Math.min(100, (score.totalPoints / nextTier[0]) * 100) : 100,
    progress_percent: nextTier ? Math.min(100, (score.totalPoints / nextTier[0]) * 100) : 100,
    recentLogs: recentLogs,
    recent_logs: recentLogs,
  };
}

export function buildTimeAnalytics(store: AppStore, userId: string) {
  const today = new Date();
  const dates = lastSevenDays(today);
  return dates.map((date) => {
    const activity = store.dailyActivities.find((entry) => entry.userId === userId && entry.date === date);
    const dayName = new Date(date).toLocaleDateString("en-US", { weekday: "short" });
    return {
      date,
      dayName,
      webpageTime: activity?.webpageTime ?? 0,
      practiceTime: activity?.practiceTime ?? 0,
      pomodoroTime: activity?.pomodoroTime ?? 0,
    };
  });
}

export function buildContributionData(store: AppStore, userId: string) {
  return store.dailyActivities
    .filter((entry) => entry.userId === userId)
    .sort((left, right) => left.date.localeCompare(right.date))
    .map((entry) => ({
      date: entry.date,
      count: entry.questionsPracticed,
    }));
}

export function updateUserStudyTime(user: StoredUser, seconds: number): void {
  user.totalStudyTime += Math.floor(seconds / 60);
}
