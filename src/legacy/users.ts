// Legacy user implementation kept behind the public server/users barrel.
import bcrypt from "bcryptjs";
import { requireUserFromRequest, resolveTokenToUser, refreshAccessToken, createAuthSessionAsync, extractAccessToken, extractRefreshTokenCookie } from "@/server/auth";
import { isAuthServiceUnavailableError } from "@/server/auth-errors";
import { extractAccessFingerprint } from "@/server/auth-jwt";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import { dbLoginUser, dbRegisterUser, dbGetTasks, dbCreateTask, dbUpdateTask, dbDeleteTask, dbFindUserByEmail, dbCreateUser, dbUpdateUser, dbCreateAuthSession, dbGetUserCount, dbGetUserCountByRole, dbMobileInUse, dbClearUserSessions } from "@/server/db-users";
import { isIdentityBlocked } from "@/server/user-lifecycle-store";
import { getAllowDeletedIdentityResignup } from "@/server/platform-settings";
import { OAuth2Client } from "google-auth-library";
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
import { badRequest, created, json, noContent, notFound, ok, serviceUnavailable, unauthorized } from "@/server/http";
import { searchAll, type SearchScope } from "@/server/search/search-service";
import { listNotifications, markNotificationsRead } from "@/server/notifications";
import { withEntitledSubjects } from "@/server/entitlements";
import { maybeGrantEventModePremiumOnSignup } from "@/server/premium-access-admin-service";
import { countTestResultsForUser } from "@/server/analytics-store";
import { normalizeSoundPreferences } from "@/lib/sound-preferences";
import type { AccountStatus, AppStore, StoredTask, StoredUser } from "@/server/store";
import { createId, readStoreAsync, withStoreAsync, withStoreAsyncScoped, withStoredUserDefaults } from "@/server/store";
import { persistUserCollections } from "@/server/store-postgres";

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

/**
 * Feature B enforcement (UNCONDITIONAL — never behind the adminUserLifecycle
 * flag, so flipping the flag off can never un-block a bad actor): a revoked or
 * deleted account cannot log in and gets a clear notice. Returns the blocking
 * 403 response, or null when the account is active.
 */
function accountStatusBlock(user: { accountStatus?: AccountStatus }): ReturnType<typeof json> | null {
  const status = user.accountStatus ?? "active";
  if (status === "revoked") {
    return json(
      {
        detail:
          "Your account has been revoked by the Origin team as some activity on your account did not comply with our policies. Contact support if you believe this is a mistake.",
        code: "account_revoked",
      },
      { status: 403 },
    );
  }
  if (status === "deleted") {
    return json(
      { detail: "Your account has been deleted by the Origin team.", code: "account_deleted" },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Feature B re-signup block (UNCONDITIONAL): true when the email OR mobile
 * belongs to an admin-deleted identity AND the admin has NOT enabled
 * deleted-identity re-signup. No-op without Postgres (dev store).
 */
async function isDeletedIdentityBlocked(
  email: string | null | undefined,
  mobile: string | null | undefined,
): Promise<boolean> {
  if (!(await isIdentityBlocked(email, mobile))) return false;
  return !(await getAllowDeletedIdentityResignup());
}

function deletedIdentityResponse() {
  return badRequest(
    "This account was deleted by the Origin team and cannot be recreated with the same email or phone number. Contact support if you believe this is a mistake.",
    { code: "identity_blocked" },
  );
}

export function serializeUser(store: AppStore, userId: string) {
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
    mobile: user.mobile,
    passwordSet: user.passwordSet,
    password_set: user.passwordSet,
    username: user.username,
    profilePrivate: user.profilePrivate,
    profile_private: user.profilePrivate,
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
    pendingBadges: score.pendingBadges ?? [],
    pending_badges: score.pendingBadges ?? [],
    location: user.location,
    voiceMinutesUsedToday: user.voiceMinutesUsedToday,
    voice_minutes_used_today: user.voiceMinutesUsedToday,
    tokensUsedToday: user.tokensUsedToday,
    tokens_used_today: user.tokensUsedToday,
    usageResetAt: user.usageResetAt,
    usage_reset_at: user.usageResetAt,
    ogcodeCorrectSound: user.ogcodeCorrectSound ?? null,
    ogcodeWrongSound: user.ogcodeWrongSound ?? null,
    soundPreferences: normalizeSoundPreferences(user.soundPreferences),
  };

  return payload;
}

async function serializeDbUser(user: StoredUser) {
  const store = await readStoreAsync();
  const existing = store.users.find((entry) => entry.id === user.id);
  if (existing) {
    Object.assign(existing, user);
  } else {
    store.users.push({ ...user, password: user.password });
  }
  const payload = serializeUser(store, user.id);
  if (!payload) return payload;
  return withEntitledSubjects(payload, user.id);
}

export type UserStatsSnapshot = {
  tests_taken: number;
  study_hours: number;
  global_rank: number | null;
  subject_progress: Array<{ subject: string; accuracy: number }>;
  overall_accuracy: number;
  achievements: {
    first_test: boolean;
    streak_7: boolean;
    streak_30: boolean;
    streak_100: boolean;
    doubt_master: boolean;
    top_100: boolean;
    perfect_score: boolean;
    subject_master: boolean;
    night_owl: boolean;
    early_bird: boolean;
  };
};

// ── Per-store memoisation for the expensive global aggregations ──────────────
// buildUserStatsSnapshot used to (a) `store.questions.find(...)` inside a
// per-attempt loop — O(attempts × questions) — and (b) rebuild the global
// solved-count ranking over EVERY user's practice attempts on every call, so
// computing snapshots for N users was O(N × allAttempts). Both inputs only
// change when the store is rewritten, and every write re-hydrates a *fresh*
// store object (readStoreAsync(true)), so a WeakMap keyed on the store identity
// is invalidated automatically on the next mutation. First call per store pays
// the cost once; the rest reuse it.

type GlobalRankCache = {
  rankByUser: Map<string, number>;
  solvedCountByUser: Map<string, number>;
};

const globalRankCache = new WeakMap<AppStore, GlobalRankCache>();
const questionByIdCache = new WeakMap<AppStore, Map<string, AppStore["questions"][number]>>();

function getQuestionById(store: AppStore): Map<string, AppStore["questions"][number]> {
  let map = questionByIdCache.get(store);
  if (!map) {
    map = new Map();
    // First-wins, matching the previous `.find` semantics for any duplicate ids.
    for (const question of store.questions) {
      if (!map.has(question.id)) map.set(question.id, question);
    }
    questionByIdCache.set(store, map);
  }
  return map;
}

function getGlobalSolvedRanking(store: AppStore): GlobalRankCache {
  const cached = globalRankCache.get(store);
  if (cached) return cached;

  // Distinct correctly-solved questions per user. Insertion order follows the
  // first correct attempt seen, preserving the original tie-break ordering.
  const solvedSets = new Map<string, Set<string>>();
  for (const attempt of store.practiceAttempts) {
    if (!attempt.isCorrect) continue;
    let set = solvedSets.get(attempt.userId);
    if (!set) {
      set = new Set();
      solvedSets.set(attempt.userId, set);
    }
    set.add(attempt.questionId);
  }

  const solvedCountByUser = new Map<string, number>();
  const ordered: { userId: string; count: number }[] = [];
  for (const [userId, set] of solvedSets) {
    solvedCountByUser.set(userId, set.size);
    ordered.push({ userId, count: set.size });
  }
  // Stable sort (Array.prototype.sort is stable) keeps insertion order on ties,
  // matching the previous Object.entries(...).sort(...).findIndex() ranking.
  ordered.sort((left, right) => right.count - left.count);

  const rankByUser = new Map<string, number>();
  ordered.forEach((entry, index) => rankByUser.set(entry.userId, index + 1));

  const result = { rankByUser, solvedCountByUser };
  globalRankCache.set(store, result);
  return result;
}

export async function buildUserStatsSnapshot(store: AppStore, user: StoredUser): Promise<UserStatsSnapshot> {
  // The primary test-submit path persists to analytics.test_results (a targeted
  // writer), NOT the KV store collection, so count tests from the real source
  // when Postgres is configured. Falls back to the store count otherwise.
  let testsTaken = store.testResults.filter((result) => result.userId === user.id).length;
  if (isUserPostgresConfigured()) {
    try {
      testsTaken = await countTestResultsForUser(user.id);
    } catch (err) {
      console.error("[users] countTestResultsForUser failed; using store count", err instanceof Error ? err.message : err);
    }
  }
  const studyHours = Math.round(user.totalStudyTime / 60);
  const streak = getOrCreateStreak(store, user.id);

  const subjectStats: Record<string, { correct: number; total: number }> = {};
  for (const subject of user.subjects) {
    subjectStats[subject.toLowerCase()] = { correct: 0, total: 0 };
  }

  // Single pass over the user's attempts: feeds both subject accuracy and
  // overall accuracy. Question lookup is O(1) via the memoised id→question map
  // (was an O(questions) `.find` per attempt).
  const questionById = getQuestionById(store);
  let totalAttempts = 0;
  let correctAttempts = 0;
  for (const attempt of store.practiceAttempts) {
    if (attempt.userId !== user.id) continue;

    totalAttempts += 1;
    if (attempt.isCorrect) correctAttempts += 1;

    const question = questionById.get(attempt.questionId);
    if (!question) continue;

    const subjectKey = question.subject.toLowerCase();
    if (!subjectStats[subjectKey]) {
      subjectStats[subjectKey] = { correct: 0, total: 0 };
    }
    subjectStats[subjectKey].total += 1;
    if (attempt.isCorrect) {
      subjectStats[subjectKey].correct += 1;
    }
  }

  const subjectProgress = Object.entries(subjectStats).map(([subject, data]) => ({
    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
  }));

  const overallAccuracy =
    totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;

  // Global rank by distinct solved questions — computed once per store object
  // and reused across users (was rebuilt over every user's attempts each call).
  const { rankByUser, solvedCountByUser } = getGlobalSolvedRanking(store);
  const mySolvedCount = solvedCountByUser.get(user.id) ?? 0;
  const globalRank = mySolvedCount > 0 ? (rankByUser.get(user.id) ?? null) : null;

  const doubtCount = store.doubtSessions.filter((session) => session.userId === user.id).length;
  const hasPerfectScore = store.testResults.some(
    (result) => result.userId === user.id && result.percentage >= 100,
  );
  const subjectMaster = Object.values(subjectStats).some((s) => s.total >= 50 && (s.correct / s.total) >= 0.9);
  const nightOwl = false;
  const earlyBird = false;

  return {
    tests_taken: testsTaken,
    study_hours: studyHours,
    global_rank: globalRank,
    subject_progress: subjectProgress,
    overall_accuracy: overallAccuracy,
    achievements: {
      first_test: testsTaken > 0,
      streak_7: streak.longestStreak >= 7 || streak.currentStreak >= 7,
      streak_30: streak.longestStreak >= 30 || streak.currentStreak >= 30,
      streak_100: streak.longestStreak >= 100 || streak.currentStreak >= 100,
      doubt_master: doubtCount >= 50,
      top_100: globalRank !== null && globalRank <= 100,
      perfect_score: hasPerfectScore,
      subject_master: subjectMaster,
      night_owl: nightOwl,
      early_bird: earlyBird,
    },
  };
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

export async function handleLogin(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const password = asString(payload.password);
  const requestedRole = asString(payload.role)?.trim().toLowerCase();
  // CBT teachers authenticate exclusively through the dedicated /cbt OTP flow
  // (cbt-auth-actions). The legacy password/OTP paths must never authenticate
  // or mint a cbt_teacher session.
  if (requestedRole === "cbt_teacher") {
    return badRequest("Unsupported account type for this login.");
  }
  const role =
    requestedRole === "student" || requestedRole === "teacher" || requestedRole === "admin"
      ? requestedRole
      : null;

  if (!email || !password) {
    return badRequest('Must include "email" and "password".');
  }

  // DB-backed login when Postgres is configured
  if (isUserPostgresConfigured()) {
    try {
      const rolesToTry = role ? [role] : ["student", "teacher"];
      let dbResult = null;
      for (const r of rolesToTry) {
        const res = await dbLoginUser(email, password, r);
        if (res) {
          if (dbResult) {
            return badRequest("Multiple accounts use this email. Please select Student or Teacher before logging in.");
          }
          dbResult = res;
        }
      }
      if (dbResult) {
        const blocked = accountStatusBlock(dbResult.user);
        if (blocked) {
          // A session was just minted by dbLoginUser — revoke it (the client
          // never receives the tokens, but keep no dangling sessions).
          await dbClearUserSessions(dbResult.user.id).catch(() => undefined);
          return blocked;
        }
        const userData = await serializeDbUser(dbResult.user);
        if (!userData) return notFound("User not found.");
        return ok({
          user: userData,
          refresh: dbResult.session.refreshToken,
          access: dbResult.session.accessToken,
          accessFingerprint: dbResult.session.accessFingerprint,
        });
      }
      // No matching DB user — fall through to seeded users.
    } catch (err) {
      console.error('[users] DB login failed', err instanceof Error ? err.message : err);
      return serviceUnavailable("Login is temporarily unavailable. Please retry in a moment.");
    }
    return badRequest("Invalid email or password.");
  }

  return withStoreAsync(async (store) => {
    const emailMatches = store.users.filter((entry) => entry.email.toLowerCase() === email);
    const matchingUsers = emailMatches.filter((entry) => bcrypt.compareSync(password, entry.password));
    const eligibleUsers = role
      ? matchingUsers.filter((entry) => entry.role === role || entry.role === 'admin')
      : matchingUsers;

    if (!eligibleUsers.length) {
      return badRequest("Invalid email or password.");
    }
    if (!role && eligibleUsers.length > 1) {
      return badRequest("Multiple accounts use this email. Please select Student or Teacher before logging in.");
    }

    const user = eligibleUsers[0];
    const blocked = accountStatusBlock(user);
    if (blocked) return blocked;
    const session = await createAuthSessionAsync(store, user.id);
    const userData = serializeUser(store, user.id);
    if (!userData) return notFound("User not found.");

    return ok({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
  });
}

const DEFAULT_MAIN_ADMIN_EMAILS = [
  "adminoffice@o3origin.com",
  "2003origin@gmail.com",
] as const;

function configuredMainAdminEmails(): ReadonlySet<string> {
  const configured =
    process.env.PLATFORM_MAIN_ADMIN_EMAIL || process.env.MAIN_ADMIN_EMAIL || "";
  const emails = configured
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails.length > 0 ? emails : DEFAULT_MAIN_ADMIN_EMAILS);
}

export async function handleLoginWithOtp(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const role = asString(payload.role)?.trim().toLowerCase();

  // CBT teachers authenticate exclusively through the dedicated /cbt OTP flow
  // (cbt-auth-actions). This legacy store-backed OTP path selects a user row by
  // role, so it must never resolve or mint a cbt_teacher session.
  if (role === "cbt_teacher") {
    return badRequest("Unsupported account type for this login.");
  }

  if (!email) {
    return badRequest('Must include "email".');
  }

  return withStoreAsync(async (store) => {
    // Check if OTP was verified for this email
    const isVerified = store.otps.some(o => o.email.toLowerCase() === email && o.verified === true);
    if (!isVerified) {
      return unauthorized("Email verification required.");
    }

    let user = store.users.find((entry) => entry.email.toLowerCase() === email && (role ? entry.role === role : true));
    if (!user) {
      // Auto-provision a platform main admin on first OTP login. Only an email
      // in the configured allowlist can self-provision as admin, and only after
      // the OTP is verified (proving control of the inbox). Admin login is
      // OTP-based, so the generated password is inert.
      if (role === "admin" && configuredMainAdminEmails().has(email)) {
        user = withStoredUserDefaults({
          id: createId("user"),
          name: "Origin Admin",
          email,
          password: bcrypt.hashSync(createId("rand"), 10),
          role: "admin",
          studentClass: null,
          fieldOfInterest: null,
          referralSource: null,
          avatar: null,
          streak: 0,
          totalStudyTime: 0,
          joinedAt: new Date().toISOString(),
          isPremium: false,
          premiumExpiry: null,
          isOnboarded: true,
          selectedCourse: null,
          isDropper: false,
          yearsOfExperience: null,
          subjects: [],
          studentCapacity: null,
        });
        store.users.push(user);
        // Flush the new admin row to origin_users *before* creating the session.
        // The legacy store otherwise only persists new users at the END of
        // withStoreAsync (persistStoreToPostgres), but createAuthSessionAsync below
        // writes the session straight to Postgres, and origin_auth_sessions.user_id is
        // NOT NULL REFERENCES origin_users(id). Without this the session INSERT hits an
        // FK violation against the not-yet-persisted admin row and the whole login throws
        // ("Authentication is temporarily unavailable"). Idempotent — the final
        // persistStoreToPostgres re-upserts the same row.
        await persistUserCollections(store, user.id, [], { persistUser: true });
      } else {
        return notFound("User not found.");
      }
    }

    const blocked = accountStatusBlock(user);
    if (blocked) return blocked;
    const session = await createAuthSessionAsync(store, user.id);
    const userData = serializeUser(store, user.id);
    if (!userData) return notFound("User not found.");

    // Clean up OTP after successful login
    store.otps = store.otps.filter(o => o.email.toLowerCase() !== email);

    return ok({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
  });
}

const REGISTRATION_LIMIT = 51000;
// 5 real signups on top of 4 seed/demo teacher accounts already in origin_users.
const TEACHER_REGISTRATION_LIMIT = 5100;

function limitForRole(role?: string | null): number {
  return role === "teacher" ? TEACHER_REGISTRATION_LIMIT : REGISTRATION_LIMIT;
}

export async function getRegistrationStatus(role?: string | null) {
  const limit = limitForRole(role);

  if (isUserPostgresConfigured()) {
    try {
      const count = role === "teacher"
        ? await dbGetUserCountByRole("teacher")
        : await dbGetUserCount();
      return { count, limit, seatsLeft: Math.max(0, limit - count) };
    } catch (err) {
      console.error('[users] Failed to get user count', err);
    }
  }

  return withStoreAsync(async (store) => {
    const count = role === "teacher"
      ? store.users.filter((u) => u.role === "teacher").length
      : store.users.length;
    return { count, limit, seatsLeft: Math.max(0, limit - count) };
  });
}

/** Normalize to a 10-digit Indian mobile (strips a leading +91/91); null if invalid. */
function normalizeMobile(raw: string): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

export async function handleRegister(payload: UserPayload) {
  const email = asString(payload.email)?.trim().toLowerCase();
  const password = asString(payload.password);
  const name = asString(payload.name)?.trim() ?? "";
  // Public registration may only ever create a student or teacher account.
  // NEVER trust payload.role: the DB-backed path (dbRegisterUser) writes this
  // value straight into origin_users.role, so an unwhitelisted value like
  // "admin" or "cbt_teacher" (once the role CHECK is widened for the CBT
  // module) would let public signup mint a privileged account and bypass the
  // CBT allowlist. Anything other than "teacher" collapses to "student".
  const requestedRole = asString(payload.role)?.toLowerCase();
  const role: "student" | "teacher" = requestedRole === "teacher" ? "teacher" : "student";

  if (!email || !password) {
    return badRequest('Must include "email" and "password".');
  }

  // Mobile: required for BOTH students and teachers (collected on the signup
  // form). Stored as 10 digits (no +91). The server is the source of truth —
  // the form already enforces this, but any direct/API path must not bypass it.
  const mobileRaw = asString(payload.mobile);
  const mobile: string | null = normalizeMobile(mobileRaw ?? "");
  if (!mobile) {
    return badRequest("Enter a valid 10-digit mobile number.");
  }

  // State/region — collected at signup and stored as `location`, powering the
  // regional leaderboard. Required for BOTH students and teachers.
  const location = asString(payload.location)?.trim() || null;
  if (!location) {
    return badRequest("Please select your state.");
  }

  // Enforce registration limit (role-aware: teachers capped separately)
  const status = await getRegistrationStatus(role);
  if (status.seatsLeft <= 0) {
    const scope = role === "teacher" ? "teacher" : "user";
    return badRequest(`Registration is currently closed. We've reached our maximum ${scope} capacity for this phase.`);
  }

  // Feature B: refuse re-signup with a deleted identity (email OR mobile) unless
  // an admin has enabled it. Unconditional — not behind adminUserLifecycle.
  if (await isDeletedIdentityBlocked(email, mobile)) {
    return deletedIdentityResponse();
  }

  // DB-backed registration when Postgres is configured
  if (isUserPostgresConfigured()) {
    try {
      if (mobile && (await dbMobileInUse(mobile))) {
        return badRequest("This mobile number is already registered.");
      }
      const { user: dbUser, session } = await dbRegisterUser({ name, email, password, role, mobile, location });
      // Event Mode: auto-grant Premium Pro to students who sign up during a launch
      // event. Best-effort; never blocks/aborts registration.
      await maybeGrantEventModePremiumOnSignup(dbUser.id, dbUser.role);
      const userData = await serializeDbUser(dbUser);
      if (!userData) return notFound("User not found.");
      return created({
        user: userData,
        refresh: session.refreshToken,
        access: session.accessToken,
        accessFingerprint: session.accessFingerprint,
      });
    } catch (err) {
      if (err instanceof Error && err.message.includes("already exists")) {
        return badRequest(err.message);
      }
      console.error('[users] DB register failed', err instanceof Error ? err.message : err);
      return serviceUnavailable("Registration is temporarily unavailable. Please retry in a moment.");
    }
  }

  return withStoreAsync(async (store) => {
    if (store.users.some((entry) => entry.email.toLowerCase() === email)) {
      return badRequest("A user with this email already exists.");
    }
    if (mobile && store.users.some((entry) => entry.mobile === mobile)) {
      return badRequest("This mobile number is already registered.");
    }

    const userId = createId("user");
    store.users.push(withStoredUserDefaults({
      id: userId,
      name,
      email,
      password: bcrypt.hashSync(password, 10),
      role,
      mobile,
      location,
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
    }));

    const session = await createAuthSessionAsync(store, userId);
    const userData = serializeUser(store, userId);
    if (!userData) {
      return notFound("User not found.");
    }

    return created({
      user: userData,
      refresh: session.refreshToken,
      access: session.accessToken,
      accessFingerprint: session.accessFingerprint,
    });
  });
}

/**
 * Resolve a Google credential (a JWT ID token or an OAuth access token) to a
 * verified identity, or null when the token is invalid.
 *
 * This is the ONLY trust anchor for the Google flows. handleGoogleSignup must
 * always re-run this on its own credential rather than trusting a client-sent
 * email — otherwise anyone could mint accounts for arbitrary addresses.
 *
 * Audit fix R-1.4 (A-07) — `useGoogleLogin` and `<GoogleLogin>` from
 * @react-oauth/google return *different* shapes:
 *   - `<GoogleLogin>` (id_token flow) → a JWT `header.payload.signature`,
 *     verified against Google's keys.
 *   - `useGoogleLogin({ flow: 'implicit' })` (default) → an OAuth access_token
 *     (e.g. "ya29.a0Af...") that is NOT a JWT — exchanged at the userinfo
 *     endpoint. Routing on segment count (a JWT has exactly 3) sends access
 *     tokens straight there: one network round-trip.
 */
async function resolveGoogleCredential(
  credential: string,
): Promise<{ email: string; name: string; avatar: string | null } | null> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";
  let email: string | undefined;
  let name: string = "Google User";
  let avatar: string | null = null;

  if (credential.split('.').length === 3) {
    try {
      const client = new OAuth2Client(clientId);
      // The Android shell's Credential Manager flow mints its ID token with
      // serverClientId = the web client id, so `aud` normally equals
      // `clientId` already; GOOGLE_ANDROID_CLIENT_ID is accepted as a
      // belt-and-braces audience for tokens minted against the Android
      // OAuth client directly (ANDROID_HYBRID_APP_PLAN.md §5.3).
      const androidClientId = process.env.GOOGLE_ANDROID_CLIENT_ID?.trim();
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: androidClientId ? [clientId, androidClientId] : clientId,
      });
      const googlePayload = ticket.getPayload();
      if (googlePayload) {
        email = googlePayload.email;
        name = googlePayload.name ?? "Google User";
        avatar = googlePayload.picture ?? null;
      }
    } catch (e) {
      console.warn("[GoogleAuth] ID Token verification failed, checking if it is an access token instead", e);
    }
  }

  // If ID token verification didn't work (or skipped), fetch user info with it
  // as an access token. Bounded by an 8s timeout so a slow/hung network fails
  // fast instead of blocking the login.
  if (!email) {
    try {
      const res = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${credential}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        throw new Error(`Google userinfo status: ${res.status}`);
      }
      const data = await res.json();
      email = data.email;
      name = data.name ?? "Google User";
      avatar = data.picture ?? null;
    } catch (e) {
      console.error("[GoogleAuth] Access Token verification failed:", e);
      return null;
    }
  }

  if (!email) return null;
  return { email, name, avatar };
}

export async function handleGoogleLogin(payload: UserPayload) {
  // Google auth authenticates existing accounts. A brand-new Google email is
  // not silently auto-created (it would lack the compulsory mobile + state) —
  // instead the response carries `needs_signup: true` plus the verified
  // email/name so the client can run the "complete your profile" step and
  // finish account creation via handleGoogleSignup.
  const credential = asString(payload.credential);
  if (!credential) return badRequest("Missing Google credential token.");

  const rawRole = asString(payload.role)?.toLowerCase();
  const role: "student" | "teacher" | "admin" =
    rawRole === "teacher" || rawRole === "admin" ? rawRole : "student";

  try {
    const resolved = await resolveGoogleCredential(credential);
    if (!resolved) {
      return unauthorized("Invalid Google Token (Not an ID Token nor a valid Access Token)");
    }
    const { email, name, avatar } = resolved;

    if (isUserPostgresConfigured()) {
      try {
        const dbUser = await dbFindUserByEmail(email, role);
        if (!dbUser) {
          // Same email may already exist under a different role (e.g. user
          // signed up as a student earlier and is now trying to Google in
          // on the teacher page). Surface a clear hint instead of silently
          // creating a second row and consuming a teacher seat.
          const otherRoles: Array<"student" | "teacher" | "admin"> = role === "teacher"
            ? ["student", "admin"]
            : role === "student" ? ["teacher", "admin"]
            : ["student", "teacher"];
          for (const otherRole of otherRoles) {
            const existingOther = await dbFindUserByEmail(email, otherRole);
            if (existingOther) {
              return badRequest(
                `This Google account is already registered as a ${otherRole}. Please use the ${otherRole} login page instead.`,
              );
            }
          }

          // No account yet: don't silently create one (it would lack the
          // compulsory details). Signal the client to run the Google-signup
          // details step; email/name are the Google-VERIFIED values.
          return badRequest(
            "No account found for this Google account. Add your details to finish creating one.",
            { needs_signup: true, email, name },
          );
        } else if (!dbUser.avatar && avatar) {
          await dbUpdateUser(dbUser.id, { avatar });
          dbUser.avatar = avatar;
        }

        const blocked = accountStatusBlock(dbUser);
        if (blocked) {
          await dbClearUserSessions(dbUser.id).catch(() => undefined);
          return blocked;
        }
        const session = await dbCreateAuthSession(dbUser.id);
        const userData = await serializeDbUser(dbUser);
        if (!userData) return notFound("User not found.");
        return ok({
          user: userData,
          refresh: session.refreshToken,
          access: session.accessToken,
          accessFingerprint: session.accessFingerprint,
        });
      } catch (err) {
        console.error('[users] DB google login failed', err instanceof Error ? err.message : err);
        return serviceUnavailable("Google login is temporarily unavailable. Please retry in a moment.");
      }
    }

    return withStoreAsync(async (store) => {
      const user = store.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase() && entry.role === role);
      if (!user) {
        // No account yet → signal the Google-signup details step (see DB path).
        return badRequest(
          "No account found for this Google account. Add your details to finish creating one.",
          { needs_signup: true, email, name },
        );
      } else if (!user.avatar && avatar) {
        user.avatar = avatar;
      }

      const blocked = accountStatusBlock(user);
      if (blocked) return blocked;
      const session = await createAuthSessionAsync(store, user.id);
      const userData = serializeUser(store, user.id);
      return ok({ user: userData, refresh: session.refreshToken, access: session.accessToken, accessFingerprint: session.accessFingerprint });
    });
  } catch (e: any) {
    console.error("Google Auth processing error:", e);
    return unauthorized("Failed to process Google login");
  }
}

/**
 * Complete a Google-initiated signup: the client re-sends the Google credential
 * together with the mandatory details (mobile + state) collected on the
 * "complete your profile" step, and the account is created.
 *
 * SECURITY: the email is ALWAYS taken from the re-verified Google credential,
 * never from the client payload — otherwise anyone could create accounts for
 * arbitrary addresses. Detail validation mirrors handleRegister exactly.
 * Idempotent: if the account already exists (double-submit / retry), the user
 * is simply logged in — Google has already proven ownership of the email.
 */
export async function handleGoogleSignup(payload: UserPayload) {
  const credential = asString(payload.credential);
  if (!credential) return badRequest("Missing Google credential token.");

  // Public Google signup may only ever create a student or teacher account —
  // same role collapse as handleRegister (never admin).
  const requestedRole = asString(payload.role)?.toLowerCase();
  const role: "student" | "teacher" = requestedRole === "teacher" ? "teacher" : "student";

  // Mandatory details — same rules as handleRegister.
  const mobile = normalizeMobile(asString(payload.mobile) ?? "");
  if (!mobile) {
    return badRequest("Enter a valid 10-digit mobile number.");
  }
  const location = asString(payload.location)?.trim() || null;
  if (!location) {
    return badRequest("Please select your state.");
  }

  try {
    const resolved = await resolveGoogleCredential(credential);
    if (!resolved) {
      return unauthorized("Invalid Google Token (Not an ID Token nor a valid Access Token)");
    }
    const { email, name, avatar } = resolved;

    // Enforce registration limit (role-aware: teachers capped separately).
    const status = await getRegistrationStatus(role);
    if (status.seatsLeft <= 0) {
      const scope = role === "teacher" ? "teacher" : "user";
      return badRequest(`Registration is currently closed. We've reached our maximum ${scope} capacity for this phase.`);
    }

    if (isUserPostgresConfigured()) {
      try {
        let dbUser = await dbFindUserByEmail(email, role);
        if (!dbUser) {
          if (await isDeletedIdentityBlocked(email, mobile)) {
            return deletedIdentityResponse();
          }
          const otherRoles: Array<"student" | "teacher" | "admin"> = role === "teacher"
            ? ["student", "admin"]
            : ["teacher", "admin"];
          for (const otherRole of otherRoles) {
            if (await dbFindUserByEmail(email, otherRole)) {
              return badRequest(
                `This Google account is already registered as a ${otherRole}. Please use the ${otherRole} login page instead.`,
              );
            }
          }
          if (await dbMobileInUse(mobile)) {
            return badRequest("This mobile number is already registered.");
          }

          const hashed = bcrypt.hashSync(createId("rand"), 10);
          dbUser = await dbCreateUser({
            name, email, password: hashed, role,
            // Google verified the email, so OTP is skipped; a password can be
            // set later from the profile. Mandatory details are stored now.
            passwordSet: false, mobile, location,
            studentClass: null, fieldOfInterest: null, referralSource: null,
            avatar, streak: 0, totalStudyTime: 0, joinedAt: new Date().toISOString(),
            isPremium: false, premiumExpiry: null, isOnboarded: false,
            selectedCourse: null, isDropper: false, yearsOfExperience: null,
            subjects: [], studentCapacity: null,
          });
          // Event Mode: auto-grant Premium Pro to students signing up during a
          // launch event. Best-effort; never blocks Google signup.
          await maybeGrantEventModePremiumOnSignup(dbUser.id, dbUser.role);
        }

        const blocked = accountStatusBlock(dbUser);
        if (blocked) {
          await dbClearUserSessions(dbUser.id).catch(() => undefined);
          return blocked;
        }
        const session = await dbCreateAuthSession(dbUser.id);
        const userData = await serializeDbUser(dbUser);
        if (!userData) return notFound("User not found.");
        return created({
          user: userData,
          refresh: session.refreshToken,
          access: session.accessToken,
          accessFingerprint: session.accessFingerprint,
        });
      } catch (err) {
        console.error('[users] DB google signup failed', err instanceof Error ? err.message : err);
        return serviceUnavailable("Google sign-up is temporarily unavailable. Please retry in a moment.");
      }
    }

    return withStoreAsync(async (store) => {
      let user = store.users.find((entry) => entry.email.toLowerCase() === email.toLowerCase() && entry.role === role);
      if (!user) {
        if (await isDeletedIdentityBlocked(email, mobile)) {
          return deletedIdentityResponse();
        }
        if (store.users.some((entry) => entry.mobile === mobile)) {
          return badRequest("This mobile number is already registered.");
        }
        const userId = createId("user");
        user = withStoredUserDefaults({
          id: userId, name, email, password: bcrypt.hashSync(createId("rand"), 10),
          role, mobile, location,
          studentClass: null, fieldOfInterest: null, referralSource: null,
          avatar, streak: 0, totalStudyTime: 0, joinedAt: new Date().toISOString(),
          isPremium: false, premiumExpiry: null, isOnboarded: false,
          selectedCourse: null, isDropper: false, yearsOfExperience: null,
          subjects: [], studentCapacity: null,
        });
        store.users.push(user);
      }

      const blocked = accountStatusBlock(user);
      if (blocked) return blocked;
      const session = await createAuthSessionAsync(store, user.id);
      const userData = serializeUser(store, user.id);
      if (!userData) return notFound("User not found.");
      return created({
        user: userData,
        refresh: session.refreshToken,
        access: session.accessToken,
        accessFingerprint: session.accessFingerprint,
      });
    });
  } catch (e: any) {
    console.error("Google signup processing error:", e);
    return unauthorized("Failed to process Google sign-up");
  }
}

export async function handleRefresh(request: Request | null, payload: UserPayload) {
  const refreshToken = asString(payload.refresh) ?? (request ? extractRefreshTokenCookie(request) : null);
  if (!refreshToken) {
    if (request) {
      try {
        const user = await resolveTokenToUser(request);
        if (user) {
          const access = extractAccessToken(request);
          const accessFingerprint = extractAccessFingerprint(request);
          return ok({
            refreshed: false,
            ...(access && accessFingerprint ? { access, accessFingerprint } : {}),
          });
        }
      } catch (error) {
        if (isAuthServiceUnavailableError(error)) {
          return serviceUnavailable("Session refresh is temporarily unavailable. Please retry in a moment.");
        }
        throw error;
      }
      return ok({ refreshed: false });
    }
    return badRequest("Refresh token is required.");
  }

  let tokens: Awaited<ReturnType<typeof refreshAccessToken>>;
  try {
    tokens = await refreshAccessToken(refreshToken);
  } catch (error) {
    if (isAuthServiceUnavailableError(error)) {
      return serviceUnavailable("Session refresh is temporarily unavailable. Please retry in a moment.");
    }
    throw error;
  }
  if (!tokens) return unauthorized("Token is invalid or expired.");
  return ok({
    access: tokens.accessToken,
    ...(tokens.refreshToken ? { refresh: tokens.refreshToken } : {}),
    accessFingerprint: tokens.accessFingerprint,
  });
}

async function handleMeGet(request: Request) {
  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) {
    return unauthorized();
  }
  const serialized = serializeUser(store, user.id);
  if (!serialized) {
    return notFound("User not found.");
  }
  return ok(await withEntitledSubjects(serialized, user.id));
}

async function handleMePatch(request: Request, payload: UserPayload) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
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
      ["location", payload.location],
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
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }
    return ok(buildPointsSummary(store, user.id));
  });
}

async function handleStatsGet(request: Request) {
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
    if (!user) {
      return unauthorized();
    }

    return ok(await buildUserStatsSnapshot(store, user));
  });
}

async function handleSearchGet(request: Request) {
  // Read-only: use readStoreAsync (no persist) rather than withStoreAsync.
  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) {
    return unauthorized();
  }
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim();
  const scopeParam = (url.searchParams.get("scope") ?? "all") as SearchScope;
  const scope: SearchScope = ["all", "tests", "questions", "people", "ai", "books"].includes(scopeParam)
    ? scopeParam
    : "all";
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(20, Math.floor(limitParam)) : undefined;
  const response = await searchAll({ store, user, query, scope, limit });
  return ok(response);
}

async function handleNotificationsList(request: Request) {
  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) {
    return unauthorized();
  }
  const limitParam = Number(new URL(request.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined;
  return ok(await listNotifications(user.id, { limit }));
}

async function handleNotificationsMarkRead(request: Request, payload: UserPayload) {
  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) {
    return unauthorized();
  }
  const id = asString(payload.id ?? payload.notificationId) ?? undefined;
  await markNotificationsRead(user.id, id);
  return ok({ ok: true });
}

async function handleTimePost(request: Request, payload: UserPayload) {
  try {
    return withStoreAsync(async (store) => {
      const user = await requireUserFromRequest(store, request);
      if (!user) {
        return unauthorized();
      }

      const timeType = asString(payload.time_type ?? payload.timeType);
      const timeSpent = asNumber(payload.time_spent ?? payload.timeSpent);
      const subject = asString(payload.subject);

      if (process.env.NODE_ENV !== "production") {
        console.warn("[TimeTrack] Processing time entry", {
          userId: user.id,
          timeType,
          timeSpent,
          subject,
        });
      }

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
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
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
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
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
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
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
  return withStoreAsync(async (store) => {
    const user = await requireUserFromRequest(store, request);
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

export function serializeTask(task: StoredTask) {
  return {
    id: task.id,
    text: task.text,
    completed: task.completed,
    due: task.due,
    createdAt: task.createdAt,
    category: task.category ?? null,
    priority: task.priority ?? null,
  };
}

async function handleTaskList(request: Request) {
  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const tasks = await dbGetTasks(user.id);
      return ok(tasks.map(serializeTask));
    } catch (err) {
      console.error('[users] DB task list failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const tasks = store.tasks
      .filter((t) => t.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return ok(tasks.map(serializeTask));
  });
}

async function handleTaskCreate(request: Request, payload: UserPayload) {
  const text = asString(payload.text)?.trim();
  const due = asString(payload.due);
  if (!text || !due) return badRequest("text and due are required.");

  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const task = await dbCreateTask(user.id, text, due, asString(payload.category) ?? undefined, asString(payload.priority) ?? undefined);
      return created(serializeTask(task));
    } catch (err) {
      console.error('[users] DB task create failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const task: StoredTask = {
      id: createId("task"),
      userId: user.id,
      text,
      completed: false,
      due,
      createdAt: new Date().toISOString(),
      category: asString(payload.category) ?? undefined,
      priority: (asString(payload.priority) as StoredTask['priority']) ?? undefined,
    };
    store.tasks.push(task);
    return created(serializeTask(task));
  });
}

async function handleTaskUpdate(request: Request, payload: UserPayload, taskId: string) {
  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const patch: { completed?: boolean; text?: string; due?: string } = {};
      if (typeof payload.completed === 'boolean') patch.completed = payload.completed;
      if (asString(payload.text)?.trim()) patch.text = asString(payload.text)!.trim();
      if (asString(payload.due)) patch.due = asString(payload.due)!;
      const updated = await dbUpdateTask(taskId, user.id, patch);
      if (!updated) return notFound("Task not found.");
      return ok(serializeTask(updated));
    } catch (err) {
      console.error('[users] DB task update failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const task = store.tasks.find((t) => t.id === taskId && t.userId === user.id);
    if (!task) return notFound("Task not found.");
    if (typeof payload.completed === 'boolean') task.completed = payload.completed;
    if (asString(payload.text)?.trim()) task.text = asString(payload.text)!.trim();
    if (asString(payload.due)) task.due = asString(payload.due)!;
    if (asString(payload.category) !== null) task.category = asString(payload.category) ?? undefined;
    if (asString(payload.priority)) task.priority = asString(payload.priority) as StoredTask['priority'];
    return ok(serializeTask(task));
  });
}

async function handleTaskDelete(request: Request, taskId: string) {
  const user = await resolveTokenToUser(request);
  if (!user) return unauthorized();

  if (isUserPostgresConfigured()) {
    try {
      const deleted = await dbDeleteTask(taskId, user.id);
      if (!deleted) return notFound("Task not found.");
      return noContent();
    } catch (err) {
      console.error('[users] DB task delete failed, falling back to in-memory seed', err instanceof Error ? err.message : err);
    }
  }

  return withStoreAsync(async (store) => {
    const idx = store.tasks.findIndex((t) => t.id === taskId && t.userId === user.id);
    if (idx === -1) return notFound("Task not found.");
    store.tasks.splice(idx, 1);
    return noContent();
  });
}

export async function handleUsersRequest(method: string, slug: string[], request: Request, payload: UserPayload) {
  if (slug.length === 1 && slug[0] === "login" && method === "POST") {
    return handleLogin(payload);
  }
  if (slug.length === 1 && slug[0] === "register" && method === "POST") {
    return handleRegister(payload);
  }
  if (slug.length === 1 && slug[0] === "google-login" && method === "POST") {
    return handleGoogleLogin(payload);
  }
  if (slug.length === 2 && slug[0] === "token" && slug[1] === "refresh" && method === "POST") {
    return handleRefresh(request, payload);
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
  if (slug.length === 1 && slug[0] === "stats" && method === "GET") {
    return handleStatsGet(request);
  }
  if (slug.length === 1 && slug[0] === "search" && method === "GET") {
    return handleSearchGet(request);
  }
  if (slug.length === 1 && slug[0] === "notifications" && method === "GET") {
    return handleNotificationsList(request);
  }
  if (slug.length === 1 && slug[0] === "notifications" && method === "POST") {
    return handleNotificationsMarkRead(request, payload);
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
  if (slug.length === 1 && slug[0] === "tasks" && method === "GET") {
    return handleTaskList(request);
  }
  if (slug.length === 1 && slug[0] === "tasks" && method === "POST") {
    return handleTaskCreate(request, payload);
  }
  if (slug.length === 2 && slug[0] === "tasks" && (method === "PATCH" || method === "PUT")) {
    return handleTaskUpdate(request, payload, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "tasks" && method === "DELETE") {
    return handleTaskDelete(request, slug[1]);
  }
  if (slug.length === 2 && slug[0] === "badges" && slug[1] === "seen" && method === "POST") {
    return handleBadgesSeen(request);
  }

  return notFound("Endpoint not found.");
}

async function handleBadgesSeen(request: Request) {
  const store = await readStoreAsync();
  const user = await requireUserFromRequest(store, request);
  if (!user) return unauthorized();

  return withStoreAsyncScoped(
    async (store) => {
      const score = store.userScores.find((s) => s.userId === user.id);
      if (score) score.pendingBadges = [];
      return ok({ ok: true });
    },
    { userId: user.id, collections: ['userScores'], persistUser: false }
  );
}
