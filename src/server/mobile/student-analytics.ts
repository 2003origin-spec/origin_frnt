import { getOgcodeCatalogQuestionMap } from "@/server/ogcode-catalog";
import { getOgcodePostgresPool, isOgcodePostgresConfigured } from "@/server/postgres";
import { istDateKeyFromMs } from "@/lib/ist-day";
import { readStoreAsync } from "@/server/store";

/**
 * A student's progress for the native app (V1/NATIVE_APP_API_PLAN.md):
 * recent test scores, the topics those tests flagged, and practice by
 * chapter. The web has no single page for this; the pieces come from the
 * persisted test analytics (analytics.test_results / test_topic_analytics)
 * and OGCode practice attempts. Read-only.
 */

export type TestPoint = {
  resultId: string;
  testId: string;
  title: string;
  subject: string | null;
  percentage: number;
  score: number;
  totalMarks: number;
  correct: number;
  wrong: number;
  unattempted: number;
  createdAt: string;
};

export type TopicSignal = {
  topic: string;
  subject: string | null;
  chapter: string | null;
  /** 0–1, attempts-weighted across the student's recent tests (stored as 0–100). */
  accuracy: number;
  attempts: number;
  /** Latest knowledge-tracing estimate (0–1), when the analysis gave one. */
  mastery: number | null;
  lastSeen: string;
};

export type PracticeChapter = { chapter: string; attempted: number; solved: number; accuracy: number };
export type PracticeSubject = { subject: string; attempted: number; solved: number; accuracy: number; chapters: PracticeChapter[] };

export type StudentAnalytics = {
  tests: TestPoint[];
  topics: { weak: TopicSignal[]; strong: TopicSignal[] };
  practice: PracticeSubject[];
};

type TopicRow = {
  topic: string;
  subject: string | null;
  chapter: string | null;
  accuracy: number | string | null;
  attempts: number | string | null;
  bkt_mastery: number | string | null;
  created_at: Date | string;
};

const WEAK_BELOW = 0.5;
const STRONG_FROM = 0.75;
const TOPIC_RESULTS = 10;

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const iso = (v: Date | string): string => (v instanceof Date ? v.toISOString() : String(v));

/**
 * Merge a topic's signals across tests (newest first in `rows`): accuracy is
 * weighted by attempts, mastery and chapter come from the latest test that
 * had them. Topics land in weak (< 50%) or strong (≥ 75%); the middle is left out.
 */
export function aggregateTopics(rows: TopicRow[], limit = 8): StudentAnalytics["topics"] {
  const byTopic = new Map<string, TopicSignal & { correctWeight: number }>();
  for (const row of rows) {
    const attempts = Math.max(0, Math.round(num(row.attempts)));
    if (!row.topic || attempts === 0) continue;
    const key = `${row.subject ?? ""}::${row.topic.trim().toLowerCase()}`;
    // test_topic_analytics stores accuracy as a percentage (0–100).
    const acc = Math.min(1, Math.max(0, num(row.accuracy) / 100));
    const seen = byTopic.get(key);
    if (!seen) {
      byTopic.set(key, {
        topic: row.topic.trim(),
        subject: row.subject,
        chapter: row.chapter,
        accuracy: acc,
        attempts,
        mastery: row.bkt_mastery == null ? null : Math.min(1, Math.max(0, num(row.bkt_mastery))),
        lastSeen: iso(row.created_at),
        correctWeight: acc * attempts,
      });
      continue;
    }
    seen.attempts += attempts;
    seen.correctWeight += acc * attempts;
    seen.accuracy = seen.correctWeight / seen.attempts;
    seen.chapter ??= row.chapter;
    if (seen.mastery == null && row.bkt_mastery != null) seen.mastery = Math.min(1, Math.max(0, num(row.bkt_mastery)));
  }
  const all: TopicSignal[] = [...byTopic.values()].map((t) => ({
    topic: t.topic,
    subject: t.subject,
    chapter: t.chapter,
    accuracy: Math.round(t.accuracy * 100) / 100,
    attempts: t.attempts,
    mastery: t.mastery,
    lastSeen: t.lastSeen,
  }));
  return {
    weak: all.filter((t) => t.accuracy < WEAK_BELOW).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, limit),
    strong: all.filter((t) => t.accuracy >= STRONG_FROM).sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts).slice(0, limit),
  };
}

/** Practice attempts → per subject, per chapter: distinct questions tried / solved, and accuracy per attempt. */
export function aggregatePractice(
  attempts: { questionId: string; isCorrect: boolean }[],
  questions: Map<string, { subject?: string | null; chapter?: string | null }>,
): PracticeSubject[] {
  type Acc = { attempted: Set<string>; solved: Set<string>; tries: number; right: number };
  const fresh = (): Acc => ({ attempted: new Set(), solved: new Set(), tries: 0, right: 0 });
  const subjects = new Map<string, { all: Acc; chapters: Map<string, Acc> }>();
  for (const a of attempts) {
    const q = questions.get(a.questionId);
    const subject = (q?.subject ?? "").trim().toLowerCase();
    if (!subject) continue;
    const chapter = (q?.chapter ?? "").trim() || "Other";
    const s = subjects.get(subject) ?? { all: fresh(), chapters: new Map() };
    subjects.set(subject, s);
    const c = s.chapters.get(chapter) ?? fresh();
    s.chapters.set(chapter, c);
    for (const acc of [s.all, c]) {
      acc.attempted.add(a.questionId);
      acc.tries += 1;
      if (a.isCorrect) {
        acc.solved.add(a.questionId);
        acc.right += 1;
      }
    }
  }
  const out = (acc: Acc) => ({ attempted: acc.attempted.size, solved: acc.solved.size, accuracy: acc.tries ? Math.round((acc.right / acc.tries) * 100) / 100 : 0 });
  return [...subjects.entries()]
    .map(([subject, s]) => ({
      subject,
      ...out(s.all),
      chapters: [...s.chapters.entries()].map(([chapter, c]) => ({ chapter, ...out(c) })).sort((a, b) => b.attempted - a.attempted || a.chapter.localeCompare(b.chapter)),
    }))
    .sort((a, b) => b.attempted - a.attempted);
}

export async function getStudentAnalytics(userId: string): Promise<StudentAnalytics> {
  const empty: StudentAnalytics = { tests: [], topics: { weak: [], strong: [] }, practice: [] };
  const store = await readStoreAsync();
  const attempts = store.practiceAttempts.filter((a) => a.userId === userId);
  const ids = [...new Set(attempts.map((a) => a.questionId))];
  const catalog = ids.length ? await getOgcodeCatalogQuestionMap(ids).catch(() => new Map()) : new Map();
  for (const q of store.questions) if (ids.includes(q.id) && !catalog.has(q.id)) catalog.set(q.id, q);
  const practice = aggregatePractice(attempts, catalog);

  const pool = isOgcodePostgresConfigured() ? getOgcodePostgresPool() : null;
  if (!pool) return { ...empty, practice };

  const results = await pool.query<Record<string, unknown>>(
    `SELECT id, test_id, title, subject, score, total_marks, percentage, correct_answers, wrong_answers, unattempted, created_at
       FROM analytics.test_results
      WHERE user_id = $1 AND COALESCE(is_malpractice, FALSE) = FALSE
      ORDER BY created_at DESC
      LIMIT 20`,
    [userId],
  );
  const tests: TestPoint[] = results.rows.map((r) => ({
    resultId: String(r.id),
    testId: String(r.test_id),
    title: String(r.title ?? "Test"),
    subject: (r.subject as string | null) ?? null,
    percentage: Math.round(num(r.percentage)),
    score: num(r.score),
    totalMarks: num(r.total_marks),
    correct: num(r.correct_answers),
    wrong: num(r.wrong_answers),
    unattempted: num(r.unattempted),
    createdAt: iso(r.created_at as Date | string),
  }));

  const recentIds = tests.slice(0, TOPIC_RESULTS).map((t) => t.resultId);
  const topicRows = recentIds.length
    ? (
        await pool.query<TopicRow>(
          `SELECT t.topic, t.subject, t.chapter, t.accuracy, t.attempts, t.bkt_mastery, r.created_at
             FROM analytics.test_topic_analytics t
             JOIN analytics.test_results r ON r.id = t.test_result_id
            WHERE t.test_result_id = ANY($1::text[])
            ORDER BY r.created_at DESC, t.id ASC`,
          [recentIds],
        )
      ).rows
    : [];

  return { tests, topics: aggregateTopics(topicRows), practice };
}

/* ── Home activity: today and the last two weeks ─────────────────────────── */

export type DayActivity = {
  /** IST calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Distinct questions finished that day (practice attempts are written once a question is done). */
  attempted: number;
  /** Distinct questions answered correctly that day. */
  solved: number;
};

export type HomeActivity = {
  today: DayActivity & { challengeDone: boolean };
  /** The last 7 IST days, oldest first; the last entry is today. */
  week: DayActivity[];
  /** Solved in the 7 days before `week`, for "vs last week". */
  previousWeekSolved: number;
};

const DAY_MS = 86_400_000;

/**
 * Today's practice and the last two weeks, by IST day, for the app's Home (daily
 * missions and the week chart). `challengeId` is today's question of the day:
 * it counts as done once the student has finished it today.
 */
export function summarizeActivity(
  attempts: { questionId: string; isCorrect: boolean; createdAt: string }[],
  challengeId: string | null,
  now: number = Date.now(),
): HomeActivity {
  const days = Array.from({ length: 14 }, (_, i) => istDateKeyFromMs(now - (13 - i) * DAY_MS));
  const index = new Map(days.map((d, i) => [d, i]));
  const attempted = days.map(() => new Set<string>());
  const solved = days.map(() => new Set<string>());
  let challengeDone = false;
  const today = days[13];
  for (const a of attempts) {
    const ms = Date.parse(a.createdAt);
    if (!Number.isFinite(ms)) continue;
    const day = istDateKeyFromMs(ms);
    const i = index.get(day);
    if (i === undefined) continue;
    attempted[i].add(a.questionId);
    if (a.isCorrect) solved[i].add(a.questionId);
    if (day === today && challengeId && a.questionId === challengeId) challengeDone = true;
  }
  const at = (i: number): DayActivity => ({ date: days[i], attempted: attempted[i].size, solved: solved[i].size });
  return {
    today: { ...at(13), challengeDone },
    week: days.slice(7).map((_, k) => at(7 + k)),
    previousWeekSolved: solved.slice(0, 7).reduce((n, s) => n + s.size, 0),
  };
}
