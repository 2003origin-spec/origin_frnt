import { createAuthSession, requireUserFromRequest } from "@/server/auth";
import {
  awardPoints,
  buildContributionData,
  buildPointsSummary,
  buildTimeAnalytics,
  getOrCreateStreak,
  getOrCreateUserScore,
  recordTime,
  updateUserStreak,
} from "@/server/gamification";
import { badRequest, created, notFound, ok, unauthorized } from "@/server/http";
import type { AppStore } from "@/server/store";
import { createId, withStore } from "@/server/store";

type UserPayload = Record<string, unknown>;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
}

function serializeUser(store: AppStore, userId: string) {
  const user = store.users.find((entry) => entry.id === userId);
  if (!user) {
    return null;
  }

  const streak = getOrCreateStreak(store, user.id);
  const score = getOrCreateUserScore(store, user.id);
  const today = todayString();
  const daily = store.dailyActivities.find((entry) => entry.userId === user.id && entry.date === today);
  const streakData = {
    currentStreak: streak.currentStreak,
    current_streak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    longest_streak: streak.longestStreak,
    lastStudyDate: streak.lastStudyDate,
    last_study_date: streak.lastStudyDate,
    weeklyData: streak.weeklyData,
    weekly_data: streak.weeklyData,
  };

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    class: user.studentClass,
    studentClass: user.studentClass,
    student_class: user.studentClass,
    fieldOfInterest: user.fieldOfInterest,
    field_of_interest: user.fieldOfInterest,
    referralSource: user.referralSource,
    referral_source: user.referralSource,
    avatar: user.avatar,
    streak: user.streak,
    totalStudyTime: user.totalStudyTime,
    total_study_time: user.totalStudyTime,
    joinedAt: user.joinedAt,
    joined_at: user.joinedAt,
    isPremium: user.isPremium,
    is_premium: user.isPremium,
    premiumExpiry: user.premiumExpiry,
    premium_expiry: user.premiumExpiry,
    yearsOfExperience: user.yearsOfExperience,
    years_of_experience: user.yearsOfExperience,
    subjects: user.subjects,
    studentCapacity: user.studentCapacity,
    student_capacity: user.studentCapacity,
    isOnboarded: user.isOnboarded,
    is_onboarded: user.isOnboarded,
    selectedCourse: user.selectedCourse,
    selected_course: user.selectedCourse,
    isDropper: user.isDropper,
    is_dropper: user.isDropper,
    streakData: streakData,
    streak_data: streakData,
    dailyQuestionsPracticed: daily?.questionsPracticed ?? 0,
    daily_questions_practiced: daily?.questionsPracticed ?? 0,
    timeAnalytics: buildTimeAnalytics(store, user.id),
    time_analytics: buildTimeAnalytics(store, user.id),
    contributionData: buildContributionData(store, user.id),
    contribution_data: buildContributionData(store, user.id),
    points: score.totalPoints,
  };

  return payload;
}

function serializePomodoro(session: {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  mode: string;
  breakReason: string | null;
  interruptionCount: number;
  isCompleted: boolean;
}) {
  return {
    id: session.id,
    startTime: session.startTime,
    start_time: session.startTime,
    endTime: session.endTime,
    end_time: session.endTime,
    duration: session.duration,
    mode: session.mode,
    breakReason: session.breakReason,
    break_reason: session.breakReason,
    interruptionCount: session.interruptionCount,
    interruption_count: session.interruptionCount,
    isCompleted: session.isCompleted,
    is_completed: session.isCompleted,
  };
}

async function handleLogin(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const password = asString(payload.password);
  const requestedRole = asString(payload.role)?.trim().toLowerCase();
  const role =
    requestedRole === "student" || requestedRole === "teacher" || requestedRole === "admin"
      ? requestedRole
      : null;

  if (!email || !password) {
    return badRequest('Must include "email" and "password".');
  }

  return withStore((store) => {
    const matchingUsers = store.users.filter(
      (entry) => entry.email.toLowerCase() === email && entry.password === password,
    );
    const eligibleUsers = role ? matchingUsers.filter((entry) => entry.role === role) : matchingUsers;

    if (!eligibleUsers.length) {
      return badRequest("Invalid email or password.");
    }
    if (!role && eligibleUsers.length > 1) {
      return badRequest("Multiple accounts use this email. Please select Student or Teacher before logging in.");
    }

    const user = eligibleUsers[0];

    const session = createAuthSession(store, user.id);
    const userData = serializeUser(store, user.id);
    if (!userData) {
      return notFound("User not found.");
    }

    return ok({
      user: userData,
      refresh: session.refreshToken,
      access: session.accessToken,
    });
  });
}

async function handleRegister(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const password = asString(payload.password);
  const name = asString(payload.name)?.trim() ?? "";
  const role = (asString(payload.role)?.toLowerCase() as "student" | "teacher" | "admin" | undefined) ?? "student";

  if (!email || !password) {
    return badRequest('Must include "email" and "password".');
  }

  return withStore((store) => {
    if (store.users.some((entry) => entry.email.toLowerCase() === email)) {
      return badRequest("A user with this email already exists.");
    }

    const userId = createId("user");
    store.users.push({
      id: userId,
      name,
      email,
      password,
      role: role === "teacher" || role === "admin" ? role : "student",
      studentClass: null,
      fieldOfInterest: null,
      referralSource: null,
      avatar: null,
      streak: 0,
      totalStudyTime: 0,
      joinedAt: new Date().toISOString(),
      isPremium: false,
      premiumExpiry: null,
      isOnboarded: false,
      selectedCourse: null,
      isDropper: false,
      yearsOfExperience: null,
      subjects: [],
      studentCapacity: null,
    });

    const session = createAuthSession(store, userId);
    const userData = serializeUser(store, userId);
    if (!userData) {
      return notFound("User not found.");
    }

    return created({
      user: userData,
      refresh: session.refreshToken,
      access: session.accessToken,
    });
  });
}

async function handleRefresh(payload: UserPayload) {
  const refreshToken = asString(payload.refresh);
  if (!refreshToken) {
    return badRequest("Refresh token is required.");
  }

  return withStore((store) => {
    const session = store.authSessions.find((entry) => entry.refreshToken === refreshToken);
    if (!session) {
      return unauthorized("Token is invalid or expired.");
    }

    session.accessToken = createId("access");
    session.createdAt = new Date().toISOString();
    return ok({ access: session.accessToken, refresh: session.refreshToken });
  });
}

async function handleMeGet(request: Request) {
  return withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const serialized = serializeUser(store, user.id);
    if (!serialized) {
      return notFound("User not found.");
    }
    return ok(serialized);
  });
}

async function handleMePatch(request: Request, payload: UserPayload) {
  return withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    const updates: Array<[keyof typeof user, unknown]> = [
      ["name", payload.name],
      ["fieldOfInterest", payload.fieldOfInterest ?? payload.field_of_interest],
      ["referralSource", payload.referralSource ?? payload.referral_source],
      ["avatar", payload.avatar],
      ["selectedCourse", payload.selectedCourse ?? payload.selected_course],
      ["yearsOfExperience", payload.yearsOfExperience ?? payload.years_of_experience],
      ["studentCapacity", payload.studentCapacity ?? payload.student_capacity],
    ];

    const studentClass = asString(payload.studentClass ?? payload.student_class ?? payload.class);
    if (studentClass !== null) {
      user.studentClass = studentClass;
    }

    const isOnboarded = asBoolean(payload.isOnboarded ?? payload.is_onboarded);
    if (isOnboarded !== null) {
      user.isOnboarded = isOnboarded;
    }

    const isDropper = asBoolean(payload.isDropper ?? payload.is_dropper);
    if (isDropper !== null) {
      user.isDropper = isDropper;
    }

    const subjects = asStringArray(payload.subjects);
    if (subjects) {
      user.subjects = subjects;
    }

    for (const [field, value] of updates) {
      if (typeof value === "string") {
        (user[field] as unknown) = value;
      }
    }

    const serialized = serializeUser(store, user.id);
    if (!serialized) {
      return notFound("User not found.");
    }
    return ok(serialized);
  });
}

async function handlePointsGet(request: Request) {
  return withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    return ok(buildPointsSummary(store, user.id));
  });
}

async function handleTimePost(request: Request, payload: UserPayload) {
  try {
    return withStore((store) => {
      const user = requireUserFromRequest(store, request);
      if (!user) {
        return unauthorized();
      }

      const timeType = asString(payload.time_type ?? payload.timeType);
      const timeSpent = asNumber(payload.time_spent ?? payload.timeSpent);
      const subject = asString(payload.subject);
      
      console.log(`[TimeTrack] Processing for user ${user.id}: type=${timeType}, spent=${timeSpent}, sub=${subject}`);

      if (!timeType || (timeType !== "webpage" && timeType !== "practice" && timeType !== "pomodoro")) {
        return badRequest("Invalid payload", { time_type: "Expected webpage | practice | pomodoro" });
      }
      if (timeSpent === null || timeSpent <= 0) {
        return badRequest("Invalid payload", { time_spent: "Expected positive integer seconds" });
      }

      const result = recordTime(store, user.id, timeType, Math.floor(timeSpent), subject);
      
      return ok({
        status: "success",
        recorded_seconds: result.recordedSeconds,
        recordedSeconds: result.recordedSeconds,
      });
    });
  } catch (error) {
    console.error("[TimeTrack] Critical Error:", error);
    return badRequest("internal_server_error", { details: String(error) });
  }
}

async function handlePomodoroList(request: Request) {
  return withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    const sessions = store.pomodoroSessions
      .filter((entry) => entry.userId === user.id)
      .sort((left, right) => right.startTime.localeCompare(left.startTime))
      .slice(0, 20)
      .map((entry) => serializePomodoro(entry));

    return ok(sessions);
  });
}

async function handlePomodoroCreate(request: Request, payload: UserPayload) {
  return withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    const modeRaw = asString(payload.mode) ?? "focus";
    const mode = modeRaw === "shortBreak" || modeRaw === "longBreak" ? modeRaw : "focus";
    const duration = Math.max(0, Math.floor(asNumber(payload.duration) ?? 0));
    const isCompleted = asBoolean(payload.is_completed ?? payload.isCompleted) ?? false;
    const breakReason = asString(payload.break_reason ?? payload.breakReason);
    const interruptionCount = Math.max(0, Math.floor(asNumber(payload.interruption_count ?? payload.interruptionCount) ?? 0));

    const session = {
      id: createId("pomodoro"),
      userId: user.id,
      startTime: new Date().toISOString(),
      endTime: isCompleted ? new Date().toISOString() : null,
      duration,
      mode,
      breakReason,
      interruptionCount,
      isCompleted,
    } as const;

    store.pomodoroSessions.push({ ...session });

    if (isCompleted && duration >= 20 * 60) {
      awardPoints(
        store,
        user.id,
        20,
        "pomodoro",
        `Completed ${mode} session (${Math.floor(duration / 60)} mins)`,
        session.id,
      );
      updateUserStreak(store, user.id);
    }

    return created(serializePomodoro(session));
  });
}

async function handlePomodoroDetail(request: Request, sessionId: string) {
  return withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const session = store.pomodoroSessions.find((entry) => entry.userId === user.id && entry.id === sessionId);
    if (!session) {
      return notFound("Pomodoro session not found.");
    }
    return ok(serializePomodoro(session));
  });
}

async function handlePomodoroUpdate(request: Request, payload: UserPayload, sessionId: string) {
  return withStore((store) => {
    const user = requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    const session = store.pomodoroSessions.find((entry) => entry.userId === user.id && entry.id === sessionId);
    if (!session) {
      return notFound("Pomodoro session not found.");
    }

    const wasCompleted = session.isCompleted;
    const modeRaw = asString(payload.mode);
    if (modeRaw === "focus" || modeRaw === "shortBreak" || modeRaw === "longBreak") {
      session.mode = modeRaw;
    }

    const duration = asNumber(payload.duration);
    if (duration !== null) {
      session.duration = Math.max(0, Math.floor(duration));
    }

    const endTime = asString(payload.end_time ?? payload.endTime);
    if (endTime !== null) {
      session.endTime = endTime;
    }

    const breakReason = asString(payload.break_reason ?? payload.breakReason);
    if (breakReason !== null) {
      session.breakReason = breakReason;
    }

    const interruptionCount = asNumber(payload.interruption_count ?? payload.interruptionCount);
    if (interruptionCount !== null) {
      session.interruptionCount = Math.max(0, Math.floor(interruptionCount));
    }

    const completed = asBoolean(payload.is_completed ?? payload.isCompleted);
    if (completed !== null) {
      session.isCompleted = completed;
      if (completed && !session.endTime) {
        session.endTime = new Date().toISOString();
      }
    }

    if (!wasCompleted && session.isCompleted && session.duration >= 20 * 60) {
      awardPoints(
        store,
        user.id,
        20,
        "pomodoro",
        `Completed ${session.mode} session (${Math.floor(session.duration / 60)} mins)`,
        session.id,
      );
      updateUserStreak(store, user.id);
    }

    return ok(serializePomodoro(session));
  });
}

export async function handleUsersRequest(method: string, slug: string[], request: Request, payload: UserPayload) {
  if (slug.length === 1 && slug[0] === "login" && method === "POST") {
    return handleLogin(payload);
  }
  if (slug.length === 1 && slug[0] === "register" && method === "POST") {
    return handleRegister(payload);
  }
  if (slug.length === 2 && slug[0] === "token" && slug[1] === "refresh" && method === "POST") {
    return handleRefresh(payload);
  }
  if (slug.length === 1 && slug[0] === "me" && method === "GET") {
    return handleMeGet(request);
  }
  if (slug.length === 1 && slug[0] === "me" && (method === "PATCH" || method === "PUT")) {
    return handleMePatch(request, payload);
  }
  if (slug.length === 1 && slug[0] === "points" && method === "GET") {
    return handlePointsGet(request);
  }
  if (slug.length === 1 && slug[0] === "time" && method === "POST") {
    return handleTimePost(request, payload);
  }
  if (slug.length === 1 && slug[0] === "pomodoro" && method === "GET") {
    return handlePomodoroList(request);
  }
  if (slug.length === 1 && slug[0] === "pomodoro" && method === "POST") {
    return handlePomodoroCreate(request, payload);
  }
  if (slug.length === 2 && slug[0] === "pomodoro" && method === "GET") {
    return handlePomodoroDetail(request, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "pomodoro" && (method === "PATCH" || method === "PUT")) {
    return handlePomodoroUpdate(request, payload, slug[1]);
  }

  return notFound("Endpoint not found.");
}
