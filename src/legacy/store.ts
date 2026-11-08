// Legacy store implementation kept behind the public server/store barrel.
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { after } from "next/server";

import type { AuthClientKind } from "@/server/auth-client-kind";
import type { SoundPreferences } from "@/lib/sound-preferences";
import type { StudyMode } from "@/lib/study-mode";

import {
  mockBooks,
  mockBookmarks,
  mockDoubtSessions,
  mockLeaderboard,
  mockLibraryUserSet,
  mockNotes,
} from "@/data/mockData";
import { ncertBooksData } from "@/data/ncertBooks";
import { isUserPostgresConfigured } from "@/server/user-postgres";
import {
  hydrateStoreFromPostgres,
  hydrateUserStoreFromPostgres,
  idOfCollectionRow,
  persistStoreToPostgres,
  persistUserCollections,
  userIdOfCollectionRow,
  type MutableCollectionKey,
  type ScopedReplaceableCollection,
  type ScopedRowDeletion,
  type UserCollectionLoad,
} from "@/server/store-postgres";
import { KeyedMutex, SharedExclusiveGate } from "@/server/store-locks";
import { withPointAwardClaimRollback } from "@/server/point-award-scope";
import { getUserPostgresPool } from "@/server/user-postgres";

export type UserRole = "student" | "teacher" | "admin" | "cbt_teacher";
export type QuestionType = "mcq" | "msq" | "numerical" | "matrix_match" | "subjective" | "range";
export type DifficultyLevel = "easy" | "medium" | "hard" | "insane";

/** Admin user-lifecycle state (Feature B). Enforcement (login gating + re-signup
 * block) always respects this regardless of the adminUserLifecycle flag. */
export type AccountStatus = "active" | "revoked" | "deleted";

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  /** Whether the user has set their own password (Google signups start false). */
  passwordSet: boolean;
  /** Unique student mobile number (collected at first-time onboarding). */
  mobile: string | null;
  role: UserRole;
  studentClass: string | null;
  fieldOfInterest: string | null;
  referralSource: string | null;
  avatar: string | null;
  streak: number;
  totalStudyTime: number;
  joinedAt: string;
  isPremium: boolean;
  premiumExpiry: string | null;
  isOnboarded: boolean;
  selectedCourse: string | null;
  isDropper: boolean;
  yearsOfExperience: string | null;
  subjects: string[];
  studentCapacity: string | null;
  location: string | null;
  voiceMinutesUsedToday: number;
  tokensUsedToday: number;
  usageResetAt: string;
  authTokenVersion: number;
  /** Admin lifecycle state — 'active' (default), 'revoked', or 'deleted' (Feature B). */
  accountStatus: AccountStatus;
  /** Public @handle for the student-social surface. Unique (case-insensitive). */
  username: string | null;
  /** When true the public profile shows only the minimal card (Phase: student social). */
  profilePrivate: boolean;
  /** OGCode answer sound preferences — filename under /sounds/correct/ and /sounds/wrong/ */
  ogcodeCorrectSound: string | null;
  ogcodeWrongSound: string | null;
  /** App-wide sound-effect preferences (see src/lib/sound-preferences.ts). */
  soundPreferences: SoundPreferences | null;
  /**
   * Study Mode (JEE / NEET / PCMB) — scopes every subject-tagged surface.
   * `null` = never chosen; resolves to DEFAULT_STUDY_MODE ('pcmb' = everything
   * visible). See src/lib/study-mode.ts and src/server/study-scope.ts.
   */
  studyMode: StudyMode | null;
  /** When the first-run mode picker was shown, so it never re-asks. */
  studyModePromptedAt: string | null;
}

export interface StoredStreakData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  weeklyData: boolean[];
  /** Streak freezes left this month (auto-consumed to bridge a missed day). */
  freezesRemaining?: number;
  /** IST month (YYYY-MM) the freeze allowance was last reset for. */
  freezeMonth?: string;
  /** IST day (YYYY-MM-DD) the login-streak celebration overlay was last shown.
   *  Server-authoritative "once per day" guard for the first-login flame. */
  lastCelebratedDate?: string | null;
}

export interface StoredDailyActivity {
  userId: string;
  date: string;
  questionsPracticed: number;
  webpageTime: number;
  practiceTime: number;
  pomodoroTime: number;
}

export interface StoredDailySubjectActivity {
  userId: string;
  date: string;
  subject: string;
  timeSpent: number;
}

export interface StoredPomodoroSession {
  id: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  mode: "focus" | "shortBreak" | "longBreak";
  breakReason: string | null;
  interruptionCount: number;
  isCompleted: boolean;
}

export interface StoredUserScore {
  userId: string;
  totalPoints: number;
  currentTier: string;
  lastUpdated: string;
  pendingBadges?: string[];
}

export interface StoredPointLog {
  id: string;
  userId: string;
  points: number;
  activityType: string;
  description: string;
  timestamp: string;
  referenceId: string | null;
}

export interface StoredMatrixData {
  column_a: string[];
  column_b: string[];
  correct_pairs: number[][];
}

export interface StoredAnswerSpec {
  gradingMode: "mcq" | "msq" | "matrix_match" | "numerical" | "numerical_with_units" | "symbolic_expression" | "equation" | "subjective_text";
  expectedValue?: string | null;
  acceptedForms?: string[] | null;
  targetVariable?: string | null;
  allowRhsOnly?: boolean;
  acceptedUnits?: string[] | null;
  tolerance?: number | null;
  symbolAssumptions?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
}

export interface StoredQuestion {
  id: string;
  text: string;
  options: string[] | null;
  /** Parallel to `options`: an optional image URL per option (or null). */
  optionImages?: (string | null)[] | null;
  correctOption: number | null;
  correctOptions: number[] | null;
  answerText: string | null;
  tolerance: number | null;
  matrixData: StoredMatrixData | null;
  explanation: string;
  hint: string | null;
  answerSpec?: StoredAnswerSpec | null;
  subject: string;
  chapter: string;
  concept: string;
  difficulty: DifficultyLevel;
  image: string | null;
  tags: string[] | string | null;
  questionType: QuestionType;
  acceptanceRate: number;
  totalCorrect: number;
  frequency: number;
  isChallengeOfTheDay: boolean;
  /** Institute hallmark (Admin Control Plane): set on teacher-contributed catalog rows. */
  contributorWorkspaceId?: string | null;
  attributionName?: string | null;
  attributionLogoUrl?: string | null;
  isContributed?: boolean;
  /** Exam / book the question appeared in, e.g. "JEE Main 2023". */
  occurrence?: string | null;
  /** Target class level (11 or 12). */
  classLevel?: number | null;
  /** Previous year exam identifier, e.g. "JEE Advanced 2019". */
  previousYearQuestion?: string | null;
}

export interface StoredTest {
  id: string;
  title: string;
  description: string;
  subject: string;
  chapter: string | null;
  difficulty: DifficultyLevel;
  duration: number;
  totalQuestions: number;
  isPremium: boolean;
  questionIds: string[];
  createdBy: string | null;
}

export interface StoredUserAnswer {
  questionId: string;
  selectedOption: number | null;
  selectedOptions: number[] | null;
  matrixPairs: number[][] | null;
  answerText: string | null;
  timeSpent: number;
  isMarkedForReview: boolean;
  presentationId?: string | null;
}

export interface StoredTestResult {
  id: string;
  userId: string;
  testId: string;
  score: number;
  percentage: number;
  correctAnswers: number;
  wrongAnswers: number;
  unattempted: number;
  timeTaken: number;
  weakAreas: Array<{ topic: string; accuracy: number }>;
  strongAreas: Array<{ topic: string; accuracy: number }>;
  aiAnalysis: {
    summary: string;
    mistakes: Array<{
      questionId: string;
      concept: string;
      error: string;
      explanation: string;
      howToApproach: string;
    }>;
    reviewEntries?: Array<{
      questionId: string;
      concept: string;
      status: "correct" | "incorrect" | "unattempted";
      error: string;
      explanation: string;
      howToApproach: string;
    }>;
    recommendations: string[];
    dppGenerated: boolean;
    degraded?: boolean;
    degradedReason?: string | null;
    degraded_reason?: string | null;
  };
  subjectStats: Record<
    string,
    {
      score: number;
      total_marks: number;
      correct: number;
      incorrect: number;
      unattempted: number;
      total_qs: number;
      accuracy: number;
      time_spent_correct: number;
      time_spent_incorrect: number;
      time_spent_unattempted: number;
      total_time_spent: number;
    }
  >;
  isMalpractice: boolean;
  degraded?: boolean;
  degradedReason?: string | null;
  createdAt: string;
  answers: StoredUserAnswer[];
}

export interface StoredPracticeAttempt {
  id: string;
  userId: string;
  questionId: string;
  isCorrect: boolean;
  timeSpent: number;
  selectedOptions: number[] | null;
  matrixPairs: number[][] | null;
  answerSubmitted: string | null;
  createdAt: string;
  // OGCode Scoring V2 audit fields (V1/OGCODE_SCORING_ALGORITHM.md, Phase 1e).
  // The backing app.practice_attempts table is a generic JSONB-payload store,
  // so these persist without a migration. Rows are only written on terminal
  // outcomes; attemptNumber records how many tries the session took.
  attemptNumber?: number;
  hintUsed?: boolean;
  answerRevealed?: boolean;
}

export interface StoredDpp {
  id: string;
  userId: string;
  title: string;
  subject: string;
  questionIds: string[];
  generatedFrom: string[];
  completed: boolean;
  createdAt: string;
}

export interface StoredAssignment {
  id: string;
  userId: string;
  title: string;
  subject: string;
  questionIds: string[];
  completed: boolean;
  dueDate: string | null;
  createdAt: string;
}

export interface StoredSubjectRank {
  userId: string;
  subject: string;
  questionsSolved: number;
  rankScore: number;
  latitude: number | null;
  longitude: number | null;
  locationShared: boolean;
  updatedAt: string;
}

export interface StoredBookChapter {
  id: string;
  title: string;
  pages: number;
  pdfFile: string | null;
}

export interface StoredBook {
  id: string;
  title: string;
  bookClass: string;
  subject: string;
  coverImage: string;
  basePath: string | null;
  chapters: StoredBookChapter[];
}

export interface StoredNote {
  id: string;
  userId: string;
  bookId: string;
  chapterId: string | null;
  pageNumber: number | null;
  content: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface StoredBookmark {
  id: string;
  userId: string;
  bookId: string;
  pageNumber: number;
  title: string;
  createdAt: string;
}

export interface StoredSavedBook {
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
}

export interface StoredChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  image: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface StoredDoubtSession {
  id: string;
  userId: string;
  title: string;
  subject: string;
  activeConcept: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
}

export interface StoredOriginAiReminder {
  id: string;
  userId: string;
  kind: "dpp" | "revision" | "assignment" | "habit";
  title: string;
  message: string;
  priority: "high" | "medium" | "low";
  sourceId: string | null;
  createdAt: string;
}

export interface StoredOriginAiProfileMemory {
  userId: string;
  preferredName: string | null;
  identitySummary: string | null;
  pinnedFacts: string[];
  lastWeakTopics: string[];
  lastTestResultId: string | null;
  lastVisitedPath: string | null;
  reminderDigest: string[];
  updatedAt: string;
}

export interface StoredOriginAiSession {
  id: string;
  userId: string;
  browserSessionId: string;
  title: string;
  summary: string | null;
  lastPathname: string | null;
  lastPageKind: string | null;
  createdAt: string;
  updatedAt: string;
  messages: StoredChatMessage[];
  // Named-thread support: threadId is null for the default "floating avatar" session,
  // a UUID for each named full-window Doubt Solver thread. subject scopes KB lookups.
  threadId: string | null;
  subject: string | null;
  activeConcept: string | null;
}

export interface StoredAuthSession {
  id: string;
  accessToken: string;
  accessFingerprint?: string;
  refreshToken: string;
  refreshTokenHash?: string;
  userId: string;
  createdAt: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  userAgentHash?: string | null;
  ipPrefixHash?: string | null;
  /** Which client minted this session; drives the refresh lifetime. */
  clientKind?: AuthClientKind;
}

export interface StoredOtp {
  email: string;
  otp: string;
  expiresAt: string;
  verified?: boolean;
}

export interface StoredTask {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  due: string;
  createdAt: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface LeaderboardSeedEntry {
  rank: number;
  userId: string;
  name: string;
  avatar?: string;
  score: number;
  studyTime: number;
  location?: string;
  isLive: boolean;
}

export interface AppStore {
  users: StoredUser[];
  streaks: StoredStreakData[];
  dailyActivities: StoredDailyActivity[];
  dailySubjectActivities: StoredDailySubjectActivity[];
  pomodoroSessions: StoredPomodoroSession[];
  userScores: StoredUserScore[];
  pointLogs: StoredPointLog[];
  questions: StoredQuestion[];
  tests: StoredTest[];
  testResults: StoredTestResult[];
  practiceAttempts: StoredPracticeAttempt[];
  dpps: StoredDpp[];
  assignments: StoredAssignment[];
  subjectRanks: StoredSubjectRank[];
  books: StoredBook[];
  notes: StoredNote[];
  bookmarks: StoredBookmark[];
  savedBooks: StoredSavedBook[];
  doubtSessions: StoredDoubtSession[];
  originAiProfiles: StoredOriginAiProfileMemory[];
  originAiSessions: StoredOriginAiSession[];
  originAiReminders: StoredOriginAiReminder[];
  authSessions: StoredAuthSession[];
  leaderboardSeed: LeaderboardSeedEntry[];
  tasks: StoredTask[];
}

type SeedUserConfig = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  studentClass?: string | null;
  fieldOfInterest?: string | null;
  referralSource?: string | null;
  avatar?: string | null;
  streak?: number;
  totalStudyTime?: number;
  joinedAt?: string;
  isPremium?: boolean;
  premiumExpiry?: string | null;
  isOnboarded?: boolean;
  selectedCourse?: string | null;
  isDropper?: boolean;
  yearsOfExperience?: string | null;
  subjects?: string[];
  studentCapacity?: string | null;
  location?: string | null;
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function nowIso(): string {
  return new Date().toISOString();
}

type StoredUserDefaultFields = Pick<
  StoredUser,
  | "location"
  | "voiceMinutesUsedToday"
  | "tokensUsedToday"
  | "usageResetAt"
  | "authTokenVersion"
  | "username"
  | "profilePrivate"
  | "ogcodeCorrectSound"
  | "ogcodeWrongSound"
  | "passwordSet"
  | "mobile"
  | "soundPreferences"
  | "accountStatus"
  | "studyMode"
  | "studyModePromptedAt"
>;

export type StoredUserWithOptionalDefaults = Omit<StoredUser, keyof StoredUserDefaultFields> &
  Partial<StoredUserDefaultFields>;

export function withStoredUserDefaults(user: StoredUserWithOptionalDefaults): StoredUser {
  return {
    ...user,
    location: user.location ?? null,
    voiceMinutesUsedToday: user.voiceMinutesUsedToday ?? 0,
    tokensUsedToday: user.tokensUsedToday ?? 0,
    usageResetAt: user.usageResetAt ?? nowIso(),
    authTokenVersion: user.authTokenVersion ?? 0,
    username: user.username ?? null,
    profilePrivate: user.profilePrivate ?? false,
    ogcodeCorrectSound: user.ogcodeCorrectSound ?? null,
    ogcodeWrongSound: user.ogcodeWrongSound ?? null,
    passwordSet: user.passwordSet ?? true,
    mobile: user.mobile ?? null,
    soundPreferences: user.soundPreferences ?? null,
    accountStatus: user.accountStatus ?? "active",
    studyMode: user.studyMode ?? null,
    studyModePromptedAt: user.studyModePromptedAt ?? null,
  };
}

function createSeedUser(config: SeedUserConfig): StoredUser {
  return withStoredUserDefaults({
    id: config.id,
    name: config.name,
    email: config.email,
    password: config.password,
    role: config.role,
    studentClass: config.studentClass ?? null,
    fieldOfInterest: config.fieldOfInterest ?? null,
    referralSource: config.referralSource ?? "codex",
    avatar: config.avatar ?? null,
    streak: config.streak ?? 0,
    totalStudyTime: config.totalStudyTime ?? 0,
    joinedAt: config.joinedAt ?? nowIso(),
    isPremium: config.isPremium ?? false,
    premiumExpiry: config.premiumExpiry ?? null,
    isOnboarded: config.isOnboarded ?? true,
    selectedCourse: config.selectedCourse ?? null,
    isDropper: config.isDropper ?? false,
    yearsOfExperience: config.yearsOfExperience ?? null,
    subjects: config.subjects ?? [],
    studentCapacity: config.studentCapacity ?? null,
    location: config.location ?? null,
  });
}

// Plaintext passwords for seed users — used only to (re-)hash on store init.
// Never stored or transmitted in plaintext.
const SEED_PASSWORDS: Record<string, string> = {
  user_student_demo: "password123",
  user_teacher_demo: "password123",
  user_student_ayush: "Ap@1234",
  user_teacher_ayush: "Ap@1234",
  user_student_tohin: "123456",
  user_teacher_tohin: "123456",
  user_admin_legacy: "admin@origin",
};

function hashSeedPassword(id: string): string {
  const plain = SEED_PASSWORDS[id];
  if (!plain) throw new Error(`No seed password defined for user id: ${id}`);
  return bcrypt.hashSync(plain, 10);
}

function buildSeedUsers(joinedAt: string): StoredUser[] {
  // Demo seed accounts (incl. admin@origin.com / user_admin_legacy) must NEVER be
  // materialised in production. Otherwise the hydrate(seed ∪ DB) + upsertUsers cycle
  // re-inserts them into origin_users after the main admin deletes them from the
  // console — the reported "deleted sub-admin comes back on reload" bug. The
  // incremental ensureSeedUsers() was already gated; this closes the base-seed hole.
  if (!isDemoSeedingEnabled()) return [];
  return [
    createSeedUser({
      id: "user_student_demo",
      name: "Demo Learner",
      email: "student@origin.test",
      password: hashSeedPassword("user_student_demo"),
      role: "student",
      studentClass: "11",
      fieldOfInterest: "Engineering",
      streak: 5,
      totalStudyTime: 420,
      joinedAt,
      isPremium: true,
      isOnboarded: true,
      selectedCourse: "JEE Main + Advanced",
      subjects: ["Physics", "Chemistry", "Mathematics"],
    }),
    createSeedUser({
      id: "user_teacher_demo",
      name: "Demo Teacher",
      email: "teacher@origin.test",
      password: hashSeedPassword("user_teacher_demo"),
      role: "teacher",
      streak: 3,
      totalStudyTime: 120,
      joinedAt,
      isPremium: true,
      isOnboarded: true,
      yearsOfExperience: "5+",
      subjects: ["Physics"],
      studentCapacity: "50",
    }),
    createSeedUser({
      id: "user_student_ayush",
      name: "Ayush Student",
      email: "ayushzz0306@gmail.com",
      password: hashSeedPassword("user_student_ayush"),
      role: "student",
      studentClass: "12",
      fieldOfInterest: "Engineering",
      joinedAt,
      selectedCourse: "JEE Main + Advanced",
      subjects: ["Physics", "Chemistry", "Mathematics"],
    }),
    createSeedUser({
      id: "user_teacher_ayush",
      name: "Ayush Teacher",
      email: "ayushzz0306@gmail.com",
      password: hashSeedPassword("user_teacher_ayush"),
      role: "teacher",
      joinedAt,
      yearsOfExperience: "3+",
      subjects: ["Physics", "Chemistry"],
      studentCapacity: "100",
    }),
    createSeedUser({
      id: "user_student_tohin",
      name: "Tohin Student",
      email: "tohin1400@gmail.com",
      password: hashSeedPassword("user_student_tohin"),
      role: "student",
      studentClass: "12",
      fieldOfInterest: "Engineering",
      joinedAt,
      selectedCourse: "JEE Main + Advanced",
      subjects: ["Physics", "Chemistry", "Mathematics"],
    }),
    createSeedUser({
      id: "user_teacher_tohin",
      name: "Tohin Teacher",
      email: "tohin1400@gmail.com",
      password: hashSeedPassword("user_teacher_tohin"),
      role: "teacher",
      joinedAt,
      yearsOfExperience: "4+",
      subjects: ["Mathematics"],
      studentCapacity: "75",
    }),
    createSeedUser({
      id: "user_admin_legacy",
      name: "Admin Console",
      email: "admin@origin.com",
      password: hashSeedPassword("user_admin_legacy"),
      role: "admin",
      joinedAt,
    }),
  ];
}

// Audit fix R-1.3 (A-06): the demo accounts (`user_student_demo`,
// `user_teacher_demo`, `user_admin_legacy`, etc.) ship with publicly
// known passwords. They are useful in development and CI for manual
// QA but must never be persisted to a production database. The
// companion migration `20260525_remove_demo_seeds.sql` deletes any
// rows that landed there before this guard existed.
function isDemoSeedingEnabled(): boolean {
  if (process.env.ORIGIN_ALLOW_DEMO_SEEDS === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function ensureSeedUsers(store: AppStore): boolean {
  if (!isDemoSeedingEnabled()) return false;

  let changed = false;
  const joinedAt = nowIso();
  // Previously this called buildSeedUsers(joinedAt) inside the loop, which
  // runs bcrypt.hashSync(cost=10) 6 times per call. With the outer loop also
  // at 6 iterations, that was 36 bcrypt rounds (~2.4s) on every readStore().
  const seedUsers = buildSeedUsers(joinedAt);

  for (const [id, plainPassword] of Object.entries(SEED_PASSWORDS)) {
    const seedUser = seedUsers.find((u) => u.id === id);
    if (!seedUser) continue;

    const existing = store.users.find(
      (entry) => entry.email.toLowerCase() === seedUser.email.toLowerCase() && entry.role === seedUser.role,
    );

    if (!existing) {
      store.users.push(seedUser);
      changed = true;
      continue;
    }

    // Re-hash if: stored password is plaintext (no bcrypt prefix) or doesn't match known plain password
    const storedIsHashed = existing.password.startsWith("$2");
    const passwordStillValid = storedIsHashed && bcrypt.compareSync(plainPassword, existing.password);
    if (!passwordStillValid) {
      existing.password = bcrypt.hashSync(plainPassword, 10);
      changed = true;
    }
  }

  return changed;
}

function buildSeedStore(): AppStore {
  const userId = "user_student_demo";
  const teacherId = "user_teacher_demo";
  const joinedAt = nowIso();

  const users = buildSeedUsers(joinedAt);

  const streaks: StoredStreakData[] = [
    {
      userId,
      currentStreak: 5,
      longestStreak: 12,
      lastStudyDate: new Date().toISOString().slice(0, 10),
      weeklyData: [true, true, true, true, true, false, false],
    },
    {
      userId: teacherId,
      currentStreak: 3,
      longestStreak: 7,
      lastStudyDate: new Date().toISOString().slice(0, 10),
      weeklyData: [false, true, false, true, true, false, true],
    },
  ];

  // OGCode is backed entirely by the Postgres catalog. Hardcoded mock questions
  // (formerly mockQuestions + dppQuestions) used to seed store.questions and,
  // because store.questions is never DB-hydrated, they leaked into the OGCode
  // list past every filter. Removed — along with the seed tests / test result /
  // practice attempts / DPP that only existed to demo them. Real tests come from
  // persisted custom tests + teacher-assigned tests; DPPs are generated.
  const questions: StoredQuestion[] = [];
  const tests: StoredTest[] = [];
  const testResults: StoredTestResult[] = [];
  const practiceAttempts: StoredPracticeAttempt[] = [];

  const booksMap = new Map<string, StoredBook>();
  mockBooks.forEach((book) => {
    booksMap.set(book.id, {
      id: book.id,
      title: book.title,
      bookClass: book.bookClass,
      subject: book.subject,
      coverImage: book.coverImage,
      basePath: book.basePath ?? null,
      chapters: (book.chapters ?? []).map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        pages: chapter.pages,
        pdfFile: chapter.pdfFile ?? null,
      })),
    });
  });
  ncertBooksData.forEach((book) => {
    if (!booksMap.has(book.id)) {
      booksMap.set(book.id, {
        id: book.id,
        title: book.title,
        bookClass: book.bookClass,
        subject: book.subject,
        coverImage: "",
        basePath: book.basePath ?? null,
        chapters: (book.chapters ?? []).map((chapter, index) => ({
          id: chapter.id,
          title: chapter.title,
          pages: index + 1,
          pdfFile: chapter.pdfFile ?? null,
        })),
      });
    }
  });

  const notes: StoredNote[] = mockNotes.map((note) => ({
    id: String(note.id),
    userId,
    bookId: note.bookId,
    chapterId: note.chapterId ?? null,
    pageNumber: note.pageNumber ?? null,
    content: note.content,
    color: note.color,
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
    tags: note.tags,
  }));

  const bookmarks: StoredBookmark[] = mockBookmarks.map((bookmark) => ({
    id: String(bookmark.id),
    userId,
    bookId: bookmark.bookId,
    pageNumber: bookmark.pageNumber,
    title: bookmark.title,
    createdAt: new Date(bookmark.createdAt).toISOString(),
  }));

  const savedBooks: StoredSavedBook[] = mockLibraryUserSet.map((bookId, index) => ({
    id: `saved_book_${index + 1}`,
    userId,
    bookId,
    createdAt: nowIso(),
  }));

  const doubtSessions: StoredDoubtSession[] = mockDoubtSessions.map((session) => ({
    id: String(session.id),
    userId,
    title: session.title,
    subject: session.subject ?? "Physics",
    activeConcept: session.activeConcept ?? "Circular Motion",
    createdAt: new Date(session.createdAt).toISOString(),
    updatedAt: new Date(session.updatedAt).toISOString(),
    messages: session.messages.map((message) => ({
      id: String(message.id),
      role: message.role,
      content: message.content,
      image: message.image ?? null,
      metadata: jsonClone(message.metadata ?? {}),
      timestamp: new Date(message.timestamp).toISOString(),
    })),
  }));

  const pointLogs: StoredPointLog[] = [
    {
      id: "point_log_seed_1",
      userId,
      points: 55,
      activityType: "practice",
      description: "Solved hard Physics question",
      timestamp: nowIso(),
      referenceId: "10",
    },
    {
      id: "point_log_seed_2",
      userId,
      points: 20,
      activityType: "pomodoro",
      description: "Completed focus session",
      timestamp: nowIso(),
      referenceId: "pomodoro_seed_1",
    },
  ];

  const userScores: StoredUserScore[] = [
    {
      userId,
      totalPoints: 1280,
      currentTier: "Expert",
      lastUpdated: nowIso(),
    },
    {
      userId: teacherId,
      totalPoints: 600,
      currentTier: "Advanced",
      lastUpdated: nowIso(),
    },
  ];

  const dailyActivities: StoredDailyActivity[] = [
    {
      userId,
      date: new Date().toISOString().slice(0, 10),
      questionsPracticed: 6,
      webpageTime: 2100,
      practiceTime: 1200,
      pomodoroTime: 1500,
    },
  ];

  const dailySubjectActivities: StoredDailySubjectActivity[] = [
    {
      userId,
      date: new Date().toISOString().slice(0, 10),
      subject: "Physics",
      timeSpent: 1800,
    },
  ];

  const pomodoroSessions: StoredPomodoroSession[] = [
    {
      id: "pomodoro_seed_1",
      userId,
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString(),
      duration: 25 * 60,
      mode: "focus",
      breakReason: null,
      interruptionCount: 0,
      isCompleted: true,
    },
  ];

  const subjectRanks: StoredSubjectRank[] = [
    {
      userId,
      subject: "Physics",
      questionsSolved: 3,
      rankScore: 85,
      latitude: null,
      longitude: null,
      locationShared: false,
      updatedAt: nowIso(),
    },
    {
      userId,
      subject: "Chemistry",
      questionsSolved: 1,
      rankScore: 25,
      latitude: null,
      longitude: null,
      locationShared: false,
      updatedAt: nowIso(),
    },
  ];

  const dpps: StoredDpp[] = [];

  const leaderboardSeed = mockLeaderboard.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    name: entry.name,
    avatar: entry.avatar,
    score: entry.score,
    studyTime: entry.studyTime,
    location: entry.location,
    isLive: entry.isLive,
  }));

  return {
    users,
    streaks,
    dailyActivities,
    dailySubjectActivities,
    pomodoroSessions,
    userScores,
    pointLogs,
    questions,
    tests,
    testResults,
    practiceAttempts,
    dpps,
    assignments: [],
    subjectRanks,
    books: [...booksMap.values()],
    notes,
    bookmarks,
    savedBooks,
    doubtSessions,
    originAiProfiles: [],
    originAiSessions: [],
    originAiReminders: [],
    authSessions: [],
    leaderboardSeed,
    tasks: [],
  };
}

function ensureOriginAiCollections(store: AppStore): boolean {
  let changed = false;
  if (!Array.isArray((store as Partial<AppStore>).originAiProfiles)) {
    store.originAiProfiles = [];
    changed = true;
  }
  if (!Array.isArray((store as Partial<AppStore>).originAiSessions)) {
    store.originAiSessions = [];
    changed = true;
  } else {
    store.originAiSessions = store.originAiSessions.map((session, index) => {
      const base = session as Partial<StoredOriginAiSession> & StoredOriginAiSession;
      let next = session;

      if (typeof base.browserSessionId !== 'string' || !base.browserSessionId.trim()) {
        changed = true;
        next = { ...next, browserSessionId: `legacy-origin-ai-session-${next.userId}-${index}` };
      }
      if (!('threadId' in base)) {
        changed = true;
        next = { ...next, threadId: null };
      }
      if (!('subject' in base)) {
        changed = true;
        next = { ...next, subject: null };
      }
      if (!('activeConcept' in base)) {
        changed = true;
        next = { ...next, activeConcept: null };
      }

      return next;
    });
  }
  if (!Array.isArray((store as Partial<AppStore>).originAiReminders)) {
    store.originAiReminders = [];
    changed = true;
  }
  return changed;
}

function ensureAllCollections(store: AppStore): boolean {
  let changed = false;
  const collections: (keyof AppStore)[] = [
    "users",
    "streaks",
    "dailyActivities",
    "dailySubjectActivities",
    "pomodoroSessions",
    "userScores",
    "pointLogs",
    "questions",
    "tests",
    "testResults",
    "practiceAttempts",
    "dpps",
    "assignments",
    "subjectRanks",
    "books",
    "notes",
    "bookmarks",
    "savedBooks",
    "doubtSessions",
    "originAiProfiles",
    "originAiSessions",
    "originAiReminders",
    "authSessions",
    "leaderboardSeed",
    "tasks",
  ];

  for (const key of collections) {
    if (!Array.isArray((store as any)[key])) {
      (store as any)[key] = [];
      changed = true;
    }
  }

  for (const user of store.users) {
    const maybeUser = user as unknown as Record<string, unknown>;
    if (maybeUser.location === undefined) {
      user.location = null;
      changed = true;
    }
    if (typeof maybeUser.voiceMinutesUsedToday !== "number") {
      user.voiceMinutesUsedToday = 0;
      changed = true;
    }
    if (typeof maybeUser.tokensUsedToday !== "number") {
      user.tokensUsedToday = 0;
      changed = true;
    }
    if (typeof maybeUser.usageResetAt !== "string") {
      user.usageResetAt = nowIso();
      changed = true;
    }
  }

  // Also call specific ones for migrations/extra checks
  changed = ensureOriginAiCollections(store) || changed;

  return changed;
}

let cachedStore: AppStore | null = null;
let cachedSeedStore: AppStore | null = null;
let lastHydratedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache for 5 minutes (300000ms) to ensure lightning-fast interactions
// Past the TTL, a snapshot younger than this is still served at once while one
// background hydration replaces it (stale-while-revalidate), so only a cold
// instance, or one idle for longer than this, waits for the whole-store load.
const MAX_STALE_MS = 2 * CACHE_TTL_MS;
let activeHydrationPromise: Promise<AppStore> | null = null;

/**
 * One hydration in flight. A user-scoped write that commits while it runs
 * queues its cache merge here, and the hydration replays the merges onto its
 * result: its reads may have started before that commit, and caching it as-is
 * would put the write's old rows back. A whole-store write, an invalidation or
 * a later-started hydration that already cached marks it superseded instead,
 * and it then is not cached at all.
 */
type HydrationWatch = { seq: number; superseded: boolean; merges: Array<(store: AppStore) => AppStore> };
const hydrationsInFlight = new Set<HydrationWatch>();
let hydrationSeq = 0;

function supersedeHydrationsInFlight(): void {
  for (const watch of hydrationsInFlight) watch.superseded = true;
}

function getSeedStore(): AppStore {
  if (!cachedSeedStore) {
    cachedSeedStore = buildSeedStore();
    ensureSeedUsers(cachedSeedStore);
    ensureAllCollections(cachedSeedStore);
  }
  return jsonClone(cachedSeedStore);
}

export function readStore(): AppStore {
  if (!cachedStore) {
    cachedStore = getSeedStore();
  }
  return cachedStore;
}

/**
 * Drops the in-memory store cache so the next readStoreAsync() re-hydrates from
 * Postgres. Call this after a write that bypasses the store (direct SQL on
 * origin_users, e.g. sub-admin create/delete in admins-service) so the change is
 * reflected immediately instead of after the 5-minute TTL — and so a stale
 * cached store can't re-persist a just-deleted row via upsertUsers.
 */
export function invalidateStoreCache(): void {
  cachedStore = null;
  lastHydratedAt = 0;
  supersedeHydrationsInFlight();
}

function startHydration(): Promise<AppStore> {
  const watch: HydrationWatch = { seq: ++hydrationSeq, superseded: false, merges: [] };
  hydrationsInFlight.add(watch);
  const promise = (async () => {
    try {
      const seed = getSeedStore();
      let store = await hydrateStoreFromPostgres(seed);
      if (watch.superseded) return store;
      try {
        for (const merge of watch.merges) store = merge(store);
      } catch (error) {
        console.error("[store] replaying user writes onto the hydrated store failed; not caching it", error);
        return store;
      }
      cachedStore = store;
      lastHydratedAt = Date.now();
      for (const other of hydrationsInFlight) {
        if (other.seq < watch.seq) other.superseded = true;
      }
      return store;
    } finally {
      hydrationsInFlight.delete(watch);
    }
  })();
  activeHydrationPromise = promise;
  // Cleared asynchronously, so always after the assignment above. Only this
  // hydration's own slot: a forced hydration may have replaced it meanwhile.
  promise.then(
    () => {
      if (activeHydrationPromise === promise) activeHydrationPromise = null;
    },
    () => {
      if (activeHydrationPromise === promise) activeHydrationPromise = null;
    },
  );
  return promise;
}

/** Keeps a background hydration alive past the response where the platform allows. */
function refreshInBackground(): void {
  const promise = startHydration();
  // Swallowed here: the next request after a failure simply tries again.
  const settled = promise.then(
    () => undefined,
    (error) => console.error("[store] background store refresh failed", error instanceof Error ? error.message : error),
  );
  try {
    after(settled);
  } catch {
    // Outside a request scope (scripts, tests): the promise just runs on.
  }
}

export async function readStoreAsync(forceFresh = false): Promise<AppStore> {
  const age = Date.now() - lastHydratedAt;
  if (cachedStore && !forceFresh && age < CACHE_TTL_MS) {
    return cachedStore;
  }

  if (cachedStore && !forceFresh && age < MAX_STALE_MS) {
    if (!activeHydrationPromise) refreshInBackground();
    return cachedStore;
  }

  if (activeHydrationPromise && !forceFresh) {
    return activeHydrationPromise;
  }

  return startHydration();
}

// Whole-store paths hold this exclusively (it replaced a plain process-wide
// mutex); user-scoped writes hold it shared. See src/server/store-locks.ts.
const storeGate = new SharedExclusiveGate();
const userStoreMutex = new KeyedMutex();

function isHostedProduction(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    Boolean(process.env.RENDER_SERVICE_ID) ||
    process.env.RAILWAY_ENVIRONMENT === "production" ||
    Boolean(process.env.FLY_APP_NAME) ||
    process.env.ORIGIN_DEPLOYMENT_ENV === "production"
  );
}

/** Thrown by withStoreAsync where a whole-store rewrite would hit a shared database. */
export class WholeStoreRewriteForbiddenError extends Error {
  constructor() {
    super(
      "withStoreAsync (whole-store rewrite) is forbidden in hosted production: it DELETEs and " +
        "re-inserts every app.* table from one instance's snapshot, wiping concurrent writes. " +
        "Use withStoreAsyncScoped with the collections the handler mutates, or readStoreAsync.",
    );
    this.name = "WholeStoreRewriteForbiddenError";
  }
}

/**
 * LEGACY whole-store rewrite: hydrates everything, runs `mutate`, then
 * `persistStoreToPostgres` DELETEs and re-inserts EVERY `app.*` collection (and
 * `origin_auth_sessions`) from this instance's snapshot. The mutex is per
 * process, so on a multi-instance deployment any call can erase rows another
 * instance wrote after this snapshot was taken (bug-hunt 10 / N3).
 *
 * There are no callers left in src/ (tests/unit/store-no-whole-rewrite.test.ts
 * enforces that). It still works where it is harmless — no user Postgres (the
 * dev/seed store, where the persist is a no-op) and local development — but it
 * throws in hosted production with Postgres configured, so a new caller cannot
 * quietly reintroduce the bug. Use withStoreAsyncScoped / readStoreAsync.
 */
export async function withStoreAsync<T>(mutate: (store: AppStore) => Promise<T> | T): Promise<T> {
  if (isUserPostgresConfigured()) {
    console.error("[store] withStoreAsync whole-store rewrite invoked", {
      metric: "store.whole_rewrite",
      hostedProduction: isHostedProduction(),
      stack: new Error().stack?.split("\n").slice(2, 6).join(" | "),
    });
    if (isHostedProduction()) {
      throw new WholeStoreRewriteForbiddenError();
    }
  }
  return storeGate.runExclusive(() =>
    // A point-award claim won inside mutate is released if mutate or the
    // persist throws, so the award can be earned again (point-award-scope.ts).
    withPointAwardClaimRollback(async () => {
      const store = await readStoreAsync(true);
      const result = await mutate(store);
      await persistStoreToPostgres(store);
      cachedStore = store;
      lastHydratedAt = Date.now();
      supersedeHydrationsInFlight();
      return result;
    }, getUserPostgresPool),
  );
}

export type ScopedStorePersist = {
  /** The user whose rows should be persisted. */
  userId: string;
  /** Collections mutated for that user during `mutate`. */
  collections: MutableCollectionKey[];
  /** Persist the user's row in `origin_users` too (e.g. streak/study-time updates). */
  persistUser?: boolean;
  /**
   * Rows of THIS user removed from the store during `mutate` (notes, bookmarks,
   * saved books, doubt sessions). The scoped upsert never deletes, so these are
   * removed with targeted `DELETE … WHERE user_id = $1 AND id = $2` statements
   * in the same transaction.
   */
  deletions?: ScopedRowDeletion[];
  /**
   * Collections THIS user's rows of which were rebuilt wholesale during `mutate`
   * (e.g. Ori reminders): `DELETE … WHERE user_id = $1`, then upsert.
   */
  replaceUserRows?: ScopedReplaceableCollection[];
  /** Upsert this user's `app.tasks` rows (tasks are not a MutableCollectionKey). */
  persistTasks?: boolean;
};

/**
 * Builder for a scoped persist whose details are only known INSIDE `mutate`
 * (the acting user comes from the request, removed row ids from the handler).
 * Pass `plan.toPersist` as withStoreAsyncScoped's `persist`: it is evaluated
 * after `mutate`, and yields null (no write at all) when the handler bailed out
 * before naming a user or touched nothing.
 */
export class ScopedWritePlan {
  private userId: string | null = null;
  private readonly collections = new Set<MutableCollectionKey>();
  private readonly deletions: ScopedRowDeletion[] = [];
  private readonly replaced = new Set<ScopedReplaceableCollection>();
  private persistUser = false;
  private persistTasks = false;

  /** Binds the plan to the acting user. A plan can only ever write one user. */
  forUser(userId: string): this {
    if (this.userId && this.userId !== userId) {
      throw new Error("ScopedWritePlan is bound to a different user.");
    }
    this.userId = userId;
    return this;
  }

  /** Upsert the acting user's rows of these collections. */
  touch(...collections: MutableCollectionKey[]): this {
    for (const collection of collections) this.collections.add(collection);
    return this;
  }

  /** Delete ONE of the acting user's rows (`WHERE user_id = $1 AND id = $2`). */
  remove(collection: ScopedRowDeletion["collection"], id: string): this {
    this.deletions.push({ collection, id });
    return this;
  }

  /** Also upsert the acting user's `origin_users` row. */
  touchUser(): this {
    this.persistUser = true;
    return this;
  }

  /**
   * The acting user's rows of this collection were rebuilt wholesale: clear
   * them (`WHERE user_id = $1`) and upsert the current set.
   */
  replaceAll(collection: ScopedReplaceableCollection): this {
    this.replaced.add(collection);
    return this;
  }

  /** Upsert the acting user's `app.tasks` rows. */
  touchTasks(): this {
    this.persistTasks = true;
    return this;
  }

  readonly toPersist = (): ScopedStorePersist | null => {
    if (!this.userId) return null;
    if (
      this.collections.size === 0 &&
      this.deletions.length === 0 &&
      this.replaced.size === 0 &&
      !this.persistUser &&
      !this.persistTasks
    ) {
      return null;
    }
    return {
      userId: this.userId,
      collections: [...this.collections],
      persistUser: this.persistUser || undefined,
      deletions: this.deletions.length > 0 ? [...this.deletions] : undefined,
      replaceUserRows: this.replaced.size > 0 ? [...this.replaced] : undefined,
      persistTasks: this.persistTasks || undefined,
    };
  };
}

// Collections mutated by a graded-assessment submit's post-grading side-effects
// (updateUserStreak / awardPoints / daily activity / study time). Shared by
// `submitTest` and `submitGeneratedDpp` — both persist their primary record via a
// targeted writer (persistTestAnalysisResult / persistDppAttemptResult), so only
// these gamification collections need a scoped store write. Kept here so the
// scoped persist stays in lockstep with the store model.
export const TEST_SUBMIT_PERSIST_COLLECTIONS: MutableCollectionKey[] = [
  "streaks",
  "dailyActivities",
  "userScores",
  "pointLogs",
];

// `submitPracticeQuestion` has no targeted writer: the practice attempt and the
// subject-rank update live only in the store, so those collections must be
// persisted in addition to the shared gamification set. persistUserCollections
// upserts (never deletes), so adding the new attempt for this user is safe.
export const PRACTICE_SUBMIT_PERSIST_COLLECTIONS: MutableCollectionKey[] = [
  "practiceAttempts",
  "subjectRanks",
  "streaks",
  "dailyActivities",
  "userScores",
  "pointLogs",
];

/**
 * What a practice submit of `questionId` reads, for withUserStoreScoped: the
 * student's attempts at THIS question (attemptedBefore / solvedBefore), their
 * point logs referencing it (awardPoints' once-per-question check), and their
 * whole subject-rank, streak, daily-activity and score rows. Exactly the
 * PRACTICE_SUBMIT_PERSIST_COLLECTIONS, so the persist never writes a
 * collection it did not load.
 */
export function practiceSubmitLoads(questionId: string): UserStoreLoads {
  return {
    practiceAttempts: { where: { field: "questionId", equals: questionId } },
    pointLogs: { where: { field: "referenceId", equals: questionId } },
    subjectRanks: true,
    streaks: true,
    dailyActivities: true,
    userScores: true,
  };
}

// Like `withStoreAsync`, but instead of rewriting the entire store back to
// Postgres it persists only the rows touched for a single user (or nothing, when
// `persist` is null). Use this for per-user hot paths whose durable records are
// already written by targeted writers, so write cost no longer grows with total
// database size.
//
// `persist` may also be a function: it is called AFTER `mutate` resolves, so a
// caller that only learns the acting user / removed row ids inside `mutate`
// (request-authenticated handlers) can describe the write precisely, or return
// null when nothing changed (unauthorized, not found, read-only).
export async function withStoreAsyncScoped<T>(
  mutate: (store: AppStore) => Promise<T> | T,
  persist: ScopedStorePersist | null | ((result: T) => ScopedStorePersist | null),
): Promise<T> {
  return storeGate.runExclusive(() =>
    withPointAwardClaimRollback(async () => {
      const store = await readStoreAsync(true);
      const result = await mutate(store);
      const plan = typeof persist === "function" ? persist(result) : persist;
      if (plan) {
        await persistUserCollections(store, plan.userId, plan.collections, {
          persistUser: plan.persistUser,
          deletions: plan.deletions,
          replaceUserRows: plan.replaceUserRows,
          persistTasks: plan.persistTasks,
        });
      }
      cachedStore = store;
      lastHydratedAt = Date.now();
      supersedeHydrationsInFlight();
      return result;
    }, getUserPostgresPool),
  );
}

/** One user's collections to load for a user-scoped store call. */
export type UserStoreLoads = Partial<Record<MutableCollectionKey, UserCollectionLoad | true>>;

function isCollectionList(value: readonly MutableCollectionKey[] | UserStoreLoads): value is readonly MutableCollectionKey[] {
  return Array.isArray(value);
}

function loadsOf(collections: readonly MutableCollectionKey[]): UserStoreLoads {
  return Object.fromEntries(collections.map((key) => [key, true])) as UserStoreLoads;
}

/**
 * Throws when a plan would write something the user-scoped load did not read:
 * another user, a collection that was not loaded (its rows are empty in the
 * scoped store, so a lazily-created default could overwrite the real row) or
 * tasks. A streak write also needs the daily activities, because
 * updateWeeklyData rebuilds the streak's week from them. Exported for tests.
 */
export function assertPlanFitsUserStore(
  plan: ScopedStorePersist,
  userId: string,
  loaded: readonly MutableCollectionKey[],
): void {
  if (plan.userId !== userId) {
    throw new Error("A user-scoped store can only persist its own user.");
  }
  const written = [...plan.collections, ...(plan.replaceUserRows ?? [])];
  const missing = written.filter((key) => !loaded.includes(key));
  if (missing.length > 0) {
    throw new Error(`A user-scoped store cannot persist collections it did not load: ${missing.join(", ")}.`);
  }
  if (plan.persistTasks) {
    throw new Error("A user-scoped store does not load tasks.");
  }
  if (written.includes("streaks") && !loaded.includes("dailyActivities")) {
    throw new Error("A user-scoped streak write must also load dailyActivities.");
  }
}

/**
 * After a committed user-scoped write, swaps the user's fresh rows into the
 * whole-store cache (a NEW store object, so per-store memos such as the global
 * ranking are rebuilt). The old whole-store write did `cachedStore = store`,
 * which kept cached readers on this instance in step with the write; this keeps
 * that, without ever caching the one-user store itself. Other users' rows and
 * the cache age are untouched. Exported for tests.
 */
export function mergeUserSliceIntoStore(
  target: AppStore,
  scoped: AppStore,
  userId: string,
  plan: ScopedStorePersist,
): AppStore {
  const next: AppStore = { ...target };
  const removed = new Map<string, Set<string>>();
  for (const deletion of plan.deletions ?? []) {
    if (!removed.has(deletion.collection)) removed.set(deletion.collection, new Set());
    removed.get(deletion.collection)!.add(deletion.id);
  }

  const keys = new Set<MutableCollectionKey>([...plan.collections, ...(plan.replaceUserRows ?? [])]);
  for (const key of keys) {
    type Row = AppStore[MutableCollectionKey][number];
    const fresh = scoped[key] as Row[];
    const freshById = new Map(fresh.map((row) => [idOfCollectionRow(key, row), row]));
    const current = target[key] as Row[];
    const seen = new Set<string>();
    const merged: Row[] = [];
    const replacedWholesale = (plan.replaceUserRows ?? []).includes(key as ScopedReplaceableCollection);
    for (const row of current) {
      if (userIdOfCollectionRow(key, row) !== userId) {
        merged.push(row);
        continue;
      }
      const id = idOfCollectionRow(key, row);
      const replacement = freshById.get(id);
      if (replacement) {
        merged.push(replacement);
        seen.add(id);
      } else if (!replacedWholesale) {
        // Not loaded (a trimmed load) or written elsewhere: keep it. Only a
        // replaced collection drops the user's old rows.
        merged.push(row);
      }
    }
    // New rows go where the handler put them: rows before the first row the
    // cache already had were unshifted (newest first), the rest were pushed.
    const firstKnown = fresh.findIndex((row) => seen.has(idOfCollectionRow(key, row)));
    const front: Row[] = [];
    const back: Row[] = [];
    fresh.forEach((row, index) => {
      if (seen.has(idOfCollectionRow(key, row))) return;
      if (firstKnown === -1 || index < firstKnown) front.push(row);
      else back.push(row);
    });
    (next[key] as Row[]) = [...front, ...merged, ...back];
  }

  for (const [collection, ids] of removed) {
    if (collection === "tasks") {
      next.tasks = next.tasks.filter((task) => !(task.userId === userId && ids.has(task.id)));
      continue;
    }
    const key = collection as MutableCollectionKey;
    type Row = AppStore[MutableCollectionKey][number];
    (next[key] as Row[]) = (next[key] as Row[]).filter(
      (row) => !(userIdOfCollectionRow(key, row) === userId && ids.has(idOfCollectionRow(key, row))),
    );
  }

  const freshUser = scoped.users.find((entry) => entry.id === userId);
  if (freshUser) {
    const index = target.users.findIndex((entry) => entry.id === userId);
    next.users = index === -1 ? [...target.users, freshUser] : target.users.map((entry, i) => (i === index ? freshUser : entry));
  }
  return next;
}

/**
 * Per-user hot-path version of withStoreAsyncScoped. Instead of hydrating
 * EVERY user's rows of every app.* table under the process-wide lock, it loads
 * only `userId`'s row and their rows of `collections` (parallel indexed reads),
 * runs `mutate`, and persists the plan with only the rows that changed.
 *
 * `mutate` sees a store with ONE user: use it only for handlers that read the
 * acting user's own rows (no ranks, leaderboards or other users). The plan may
 * only name `userId` and loaded collections (assertPlanFitsUserStore).
 * `collections` is a list (all of the user's rows of each) or per-collection
 * loads; trim one only as UserCollectionLoad allows.
 *
 * Locking: same-user calls on this instance run one at a time, and none of
 * them overlaps a whole-store write here; other users run in parallel.
 * Without user Postgres (dev seed store) this is exactly withStoreAsyncScoped.
 */
export async function withUserStoreScoped<T>(
  userId: string,
  collections: readonly MutableCollectionKey[] | UserStoreLoads,
  mutate: (store: AppStore) => Promise<T> | T,
  persist: ScopedStorePersist | null | ((result: T) => ScopedStorePersist | null),
): Promise<T> {
  if (!isUserPostgresConfigured()) {
    return withStoreAsyncScoped(mutate, persist);
  }
  const loads = isCollectionList(collections) ? loadsOf(collections) : collections;
  const loaded = Object.keys(loads) as MutableCollectionKey[];
  return userStoreMutex.runExclusive(userId, () =>
    storeGate.runShared(() =>
      withPointAwardClaimRollback(async () => {
        const { store, baseline } = await hydrateUserStoreFromPostgres(getSeedStore(), userId, loads);
        const result = await mutate(store);
        const plan = typeof persist === "function" ? persist(result) : persist;
        if (plan) {
          assertPlanFitsUserStore(plan, userId, loaded);
          await persistUserCollections(store, plan.userId, plan.collections, {
            persistUser: plan.persistUser,
            deletions: plan.deletions,
            replaceUserRows: plan.replaceUserRows,
            baseline,
          });
          const merge = (target: AppStore) => mergeUserSliceIntoStore(target, store, userId, plan);
          for (const watch of hydrationsInFlight) watch.merges.push(merge);
          if (cachedStore) {
            // The write is committed: a failure here must not fail the request
            // (that would release point-award claims for points already saved).
            try {
              cachedStore = merge(cachedStore);
            } catch (error) {
              console.error("[store] user slice cache merge failed; dropping the cache", error);
              invalidateStoreCache();
            }
          }
        }
        return result;
      }, getUserPostgresPool),
    ),
  );
}

/**
 * Read-only per-user load: `userId`'s row and their rows of `loads` (each may
 * be trimmed with `limit` / `createdSince`), fresh from Postgres, no lock and
 * no write. Same one-user caveat as withUserStoreScoped. Without user Postgres
 * it is withStoreAsyncScoped(read, null), as the read handlers used before.
 */
export async function readUserStoreScoped<T>(
  userId: string,
  loads: UserStoreLoads,
  read: (store: AppStore) => Promise<T> | T,
): Promise<T> {
  if (!isUserPostgresConfigured()) {
    return withStoreAsyncScoped(read, null);
  }
  const { store } = await hydrateUserStoreFromPostgres(getSeedStore(), userId, loads);
  return read(store);
}

/**
 * Folds a fresh `origin_users` row into a cached snapshot in place (the
 * snapshot's copy is updated, or the row is added for an account the snapshot
 * predates), so code that looks the user up in `store.users` finds them. The
 * store object stays the same, so its per-store memos survive. Returns the
 * snapshot's copy.
 */
export function foldUserIntoStore(store: AppStore, fresh: StoredUser): StoredUser {
  const existing = store.users.find((entry) => entry.id === fresh.id);
  if (existing) {
    Object.assign(existing, fresh);
    return existing;
  }
  store.users.push(fresh);
  return fresh;
}

/** The caller's own practice attempts: their solved / attempted status. */
export const OWN_PRACTICE_PROGRESS_LOADS: UserStoreLoads = { practiceAttempts: true };
/** The caller's own attempts and streak: their OGCode stats card. */
export const OWN_OGCODE_STATS_LOADS: UserStoreLoads = { practiceAttempts: true, streaks: true };

/**
 * The cached snapshot (readStoreAsync) with `userId`'s own row and their rows
 * of `loads` read fresh from Postgres: for read handlers that show the caller
 * their own progress from the snapshot (solved / unsolved status, user stats).
 * The snapshot can lag a write this user made through another instance by up
 * to the TTL; this indexed read closes that for the caller. The overlay is a
 * per-request copy and is never cached. If the fresh read fails, the plain
 * snapshot is returned. Without user Postgres it is the snapshot itself.
 */
export async function readStoreWithFreshUserRows(userId: string, loads: UserStoreLoads): Promise<AppStore> {
  if (!isUserPostgresConfigured()) {
    return readStoreAsync();
  }
  const [snapshot, fresh] = await Promise.all([
    readStoreAsync(),
    hydrateUserStoreFromPostgres(getSeedStore(), userId, loads).catch((error: unknown) => {
      console.error("[store] fresh user rows for a snapshot read failed", error instanceof Error ? error.message : error);
      return null;
    }),
  ]);
  if (!fresh) return snapshot;
  return mergeUserSliceIntoStore(snapshot, fresh.store, userId, {
    userId,
    collections: Object.keys(loads) as MutableCollectionKey[],
  });
}

export function resetStore(): AppStore {
  const fresh = buildSeedStore();
  cachedStore = fresh;
  return fresh;
}

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function cloneStore<T>(value: T): T {
  return jsonClone(value);
}
