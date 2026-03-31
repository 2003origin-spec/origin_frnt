import {
  buildPointsSummary,
  buildTimeAnalytics,
  DIFFICULTY_POINTS,
  getOrCreateDailyActivity,
  updateUserStreak,
  updateUserStudyTime,
  awardPoints,
} from "@/server/gamification";
import type {
  AppStore,
  DifficultyLevel,
  StoredQuestion,
  StoredSubjectRank,
  StoredTest,
  StoredTestResult,
  StoredUser,
  StoredUserAnswer,
} from "@/server/store";
import { createId } from "@/server/store";

export type QuestionAnswerPayload = {
  question_id?: string | number;
  questionId?: string | number;
  selected_option?: number | null;
  selectedOption?: number | null;
  selected_options?: number[];
  selectedOptions?: number[];
  matrix_pairs?: number[][];
  matrixPairs?: number[][];
  answer_text?: string;
  answerText?: string;
  time_spent?: number;
  timeSpent?: number;
  is_marked_for_review?: boolean;
  isMarkedForReview?: boolean;
};

export type TestSubmissionPayload = {
  answers?: QuestionAnswerPayload[];
  time_taken?: number;
  timeTaken?: number;
  isMalpractice?: boolean;
  is_malpractice?: boolean;
};

export type PracticeSubmissionPayload = {
  selected_option?: number | null;
  selectedOption?: number | null;
  selected_options?: number[];
  selectedOptions?: number[];
  matrix_pairs?: number[][];
  matrixPairs?: number[][];
  answer_text?: string;
  answerText?: string;
  time_spent?: number;
  timeSpent?: number;
};

export type CustomTestPayload = {
  subject?: string;
  difficulty?: string;
  chapter?: string;
  question_count?: number;
};

export type UpdateOgcodeLocationPayload = {
  subject?: string;
  latitude?: number | null;
  longitude?: number | null;
  share?: boolean;
};

type TopicAccuracy = { topic: string; accuracy: number };

type GradeResult = {
  isCorrect: boolean;
  info: Record<string, unknown>;
};

function normalizeSubject(subject: string): string {
  return subject.toLowerCase();
}

function normalizeDifficulty(difficulty: string): DifficultyLevel {
  if (difficulty === "easy" || difficulty === "medium" || difficulty === "hard" || difficulty === "insane") {
    return difficulty;
  }
  return "medium";
}

function sortedNumbers(values: number[] | undefined | null): number[] {
  return [...(values ?? [])].sort((left, right) => left - right);
}

function normalizeAnswer(payload: QuestionAnswerPayload | PracticeSubmissionPayload): StoredUserAnswer {
  return {
    questionId: String(
      (payload as QuestionAnswerPayload).questionId ??
        (payload as QuestionAnswerPayload).question_id ??
        "",
    ),
    selectedOption:
      payload.selectedOption ??
      payload.selected_option ??
      null,
    selectedOptions:
      payload.selectedOptions ??
      payload.selected_options ??
      null,
    matrixPairs:
      payload.matrixPairs ??
      payload.matrix_pairs ??
      null,
    answerText:
      payload.answerText ??
      payload.answer_text ??
      null,
    timeSpent:
      payload.timeSpent ??
      payload.time_spent ??
      0,
    isMarkedForReview:
      (payload as QuestionAnswerPayload).isMarkedForReview ??
      (payload as QuestionAnswerPayload).is_marked_for_review ??
      false,
  };
}

function hasResponse(answer: StoredUserAnswer): boolean {
  return (
    answer.selectedOption !== null ||
    Boolean(answer.selectedOptions?.length) ||
    Boolean(answer.matrixPairs?.length) ||
    Boolean(answer.answerText?.trim())
  );
}

function gradeAnswer(question: StoredQuestion, answer: StoredUserAnswer): GradeResult {
  if (question.questionType === "mcq") {
    const isCorrect = answer.selectedOption === question.correctOption;
    return {
      isCorrect,
      info: {
        correctOption: question.correctOption,
        correct_option: question.correctOption,
        explanation: question.explanation,
      },
    };
  }

  if (question.questionType === "msq") {
    const submitted = sortedNumbers(answer.selectedOptions);
    const expected = sortedNumbers(question.correctOptions);
    const isCorrect = JSON.stringify(submitted) === JSON.stringify(expected);
    return {
      isCorrect,
      info: {
        correctOptions: question.correctOptions,
        correct_options: question.correctOptions,
        explanation: question.explanation,
      },
    };
  }

  if (question.questionType === "numerical") {
    let isCorrect = false;
    try {
      const submitted = Number(answer.answerText);
      const expected = Number(question.answerText ?? 0);
      const tolerance = question.tolerance ?? 0;
      isCorrect = Number.isFinite(submitted) && Math.abs(submitted - expected) <= tolerance;
    } catch {
      isCorrect = false;
    }
    return {
      isCorrect,
      info: {
        correctAnswerText: question.answerText,
        correct_answer_text: question.answerText,
        tolerance: question.tolerance,
        explanation: question.explanation,
      },
    };
  }

  if (question.questionType === "matrix_match") {
    const expected = [...(question.matrixData?.correct_pairs ?? [])]
      .map((pair) => pair.join(":"))
      .sort();
    const submitted = [...(answer.matrixPairs ?? [])]
      .map((pair) => pair.join(":"))
      .sort();
    const isCorrect = JSON.stringify(submitted) === JSON.stringify(expected);
    return {
      isCorrect,
      info: {
        correctPairs: question.matrixData?.correct_pairs ?? [],
        correct_pairs: question.matrixData?.correct_pairs ?? [],
        explanation: question.explanation,
      },
    };
  }

  const expectedAnswer = String(question.answerText ?? "").trim().toLowerCase();
  const submittedAnswer = String(answer.answerText ?? "").trim().toLowerCase();
  const isCorrect = Boolean(submittedAnswer) && submittedAnswer === expectedAnswer;
  return {
    isCorrect,
    info: {
      correctAnswerText: question.answerText,
      correct_answer_text: question.answerText,
      explanation: question.explanation,
    },
  };
}

function questionById(store: AppStore, questionId: string): StoredQuestion {
  const question = store.questions.find((entry) => entry.id === questionId);
  if (!question) {
    throw new Error(`Question ${questionId} was not found.`);
  }
  return question;
}

function testById(store: AppStore, testId: string): StoredTest {
  const test = store.tests.find((entry) => entry.id === testId);
  if (!test) {
    throw new Error(`Test ${testId} was not found.`);
  }
  return test;
}

function computeAveragePercentage(results: StoredTestResult[]): number | null {
  if (!results.length) {
    return null;
  }
  const average = results.reduce((sum, result) => sum + result.percentage, 0) / results.length;
  return Math.round(average);
}

export function serializeQuestion(
  store: AppStore,
  userId: string,
  question: StoredQuestion,
  includeCorrectFields = true,
) {
  const isSolved = store.practiceAttempts.some(
    (attempt) => attempt.userId === userId && attempt.questionId === question.id && attempt.isCorrect,
  );

  const base = {
    id: question.id,
    text: question.text,
    options: question.options ?? undefined,
    correctOption: includeCorrectFields ? question.correctOption : undefined,
    correct_option: includeCorrectFields ? question.correctOption : undefined,
    correctOptions: includeCorrectFields ? question.correctOptions : undefined,
    correct_options: includeCorrectFields ? question.correctOptions : undefined,
    answerText: includeCorrectFields ? question.answerText : undefined,
    answer_text: includeCorrectFields ? question.answerText : undefined,
    matrixData: question.matrixData ?? undefined,
    matrix_data: question.matrixData ?? undefined,
    explanation: question.explanation,
    hint: question.hint ?? undefined,
    subject: question.subject,
    chapter: question.chapter,
    concept: question.concept,
    difficulty: question.difficulty,
    image: question.image ?? undefined,
    tags: question.tags ?? undefined,
    questionType: question.questionType,
    question_type: question.questionType,
    acceptanceRate: Number(question.acceptanceRate.toFixed(1)),
    acceptance_rate: Number(question.acceptanceRate.toFixed(1)),
    totalCorrect: question.totalCorrect,
    total_correct: question.totalCorrect,
    frequency: question.frequency,
    isSolved: isSolved,
    status: isSolved ? "solved" : "unattempted",
  };

  return base;
}

export function serializeTest(store: AppStore, userId: string, test: StoredTest) {
  const results = store.testResults
    .filter((result) => result.userId === userId && result.testId === test.id)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const questions = test.questionIds.map((questionId) =>
    serializeQuestion(store, userId, questionById(store, questionId), true),
  );
  const averageScore = computeAveragePercentage(results);
  const allScores = results.map((result) => result.percentage);

  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter ?? undefined,
    difficulty: test.difficulty,
    duration: test.duration,
    totalQuestions: test.totalQuestions,
    total_questions: test.totalQuestions,
    isPremium: test.isPremium,
    is_premium: test.isPremium,
    questions,
    attempted: results.length > 0,
    score: averageScore,
    attemptCount: results.length,
    attempt_count: results.length,
    allScores,
    all_scores: allScores,
  };
}

export function serializeResult(result: StoredTestResult) {
  return {
    id: result.id,
    testId: result.testId,
    test_id: result.testId,
    score: result.score,
    percentage: result.percentage,
    correctAnswers: result.correctAnswers,
    correct_answers: result.correctAnswers,
    wrongAnswers: result.wrongAnswers,
    wrong_answers: result.wrongAnswers,
    unattempted: result.unattempted,
    timeTaken: result.timeTaken,
    time_taken: result.timeTaken,
    answers: result.answers,
    weakAreas: result.weakAreas,
    weak_areas: result.weakAreas,
    strongAreas: result.strongAreas,
    strong_areas: result.strongAreas,
    aiAnalysis: result.aiAnalysis,
    ai_analysis: result.aiAnalysis,
    subjectStats: result.subjectStats,
    subject_stats: result.subjectStats,
    isMalpractice: result.isMalpractice,
    is_malpractice: result.isMalpractice,
    createdAt: result.createdAt,
    created_at: result.createdAt,
  };
}

export function listTests(store: AppStore, user: StoredUser) {
  return store.tests.map((test) => serializeTest(store, user.id, test));
}

export function getTestDetail(store: AppStore, user: StoredUser, testId: string) {
  return serializeTest(store, user.id, testById(store, testId));
}

export function createCustomTest(
  store: AppStore,
  user: StoredUser,
  payload: CustomTestPayload,
) {
  const subject = (payload.subject ?? "all").toLowerCase();
  const difficulty = normalizeDifficulty(payload.difficulty ?? "medium");
  const chapter = (payload.chapter ?? "").trim().toLowerCase();
  const questionCount = Math.max(1, Number(payload.question_count ?? 10));

  const candidates = store.questions.filter((question) => {
    const matchesSubject = subject === "all" || question.subject === normalizeSubject(subject);
    const matchesDifficulty = !difficulty || question.difficulty === difficulty;
    const matchesChapter = !chapter || question.chapter.toLowerCase().includes(chapter);
    return matchesSubject && matchesDifficulty && matchesChapter;
  });

  if (!candidates.length) {
    throw new Error("No questions matched that custom test configuration.");
  }

  const selected = candidates.slice(0, Math.min(questionCount, candidates.length));
  const newTest: StoredTest = {
    id: createId("test"),
    title: `${subject === "all" ? "Mixed" : subject[0].toUpperCase() + subject.slice(1)} Custom Test`,
    description: chapter ? `Custom practice set focused on ${chapter}.` : "Custom practice set generated from the question bank.",
    subject: subject === "all" ? "mixed" : normalizeSubject(subject),
    chapter: chapter || null,
    difficulty,
    duration: Math.max(10, selected.length * 3),
    totalQuestions: selected.length,
    isPremium: false,
    questionIds: selected.map((question) => question.id),
    createdBy: user.id,
  };

  store.tests.unshift(newTest);
  return serializeTest(store, user.id, newTest);
}

export function submitTest(store: AppStore, user: StoredUser, testId: string, payload: TestSubmissionPayload) {
  const test = testById(store, testId);
  const submittedAnswers = payload.answers ?? [];
  const answersMap = new Map<string, StoredUserAnswer>();
  submittedAnswers.forEach((rawAnswer) => {
    const normalized = normalizeAnswer(rawAnswer);
    if (normalized.questionId) {
      answersMap.set(normalized.questionId, normalized);
    }
  });

  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unattempted = 0;
  let score = 0;
  const topicStats: Record<string, { correct: number; total: number }> = {};
  const subjectStats: Record<
    string,
    {
      correct: number;
      incorrect: number;
      unattempted: number;
      total: number;
      timeCorrect: number;
      timeIncorrect: number;
      timeUnattempted: number;
    }
  > = {};
  const userAnswers: StoredUserAnswer[] = [];

  for (const questionId of test.questionIds) {
    const question = questionById(store, questionId);
    const answer = answersMap.get(questionId) ?? {
      questionId,
      selectedOption: null,
      selectedOptions: null,
      matrixPairs: null,
      answerText: null,
      timeSpent: 0,
      isMarkedForReview: false,
    };

    if (!topicStats[question.concept]) {
      topicStats[question.concept] = { correct: 0, total: 0 };
    }
    topicStats[question.concept].total += 1;

    if (!subjectStats[question.subject]) {
      subjectStats[question.subject] = {
        correct: 0,
        incorrect: 0,
        unattempted: 0,
        total: 0,
        timeCorrect: 0,
        timeIncorrect: 0,
        timeUnattempted: 0,
      };
    }
    subjectStats[question.subject].total += 1;

    const { isCorrect } = gradeAnswer(question, answer);
    const answered = hasResponse(answer);

    if (isCorrect) {
      correctAnswers += 1;
      score += 4;
      topicStats[question.concept].correct += 1;
      subjectStats[question.subject].correct += 1;
      subjectStats[question.subject].timeCorrect += answer.timeSpent;
      question.totalCorrect += 1;
    } else if (!answered) {
      unattempted += 1;
      subjectStats[question.subject].unattempted += 1;
      subjectStats[question.subject].timeUnattempted += answer.timeSpent;
    } else {
      wrongAnswers += 1;
      score -= 1;
      subjectStats[question.subject].incorrect += 1;
      subjectStats[question.subject].timeIncorrect += answer.timeSpent;
    }

    question.frequency += 1;
    question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;
    userAnswers.push(answer);
  }

  const totalMarks = test.totalQuestions * 4;
  const percentage = totalMarks > 0 ? Math.max(0, Math.round((score / totalMarks) * 100)) : 0;

  const strongAreas: TopicAccuracy[] = [];
  const weakAreas: TopicAccuracy[] = [];
  Object.entries(topicStats).forEach(([topic, stats]) => {
    const accuracy = Math.round((stats.correct / stats.total) * 100);
    const row = { topic, accuracy };
    if (accuracy > 50) {
      strongAreas.push(row);
    } else {
      weakAreas.push(row);
    }
  });
  strongAreas.sort((left, right) => right.accuracy - left.accuracy);
  weakAreas.sort((left, right) => right.accuracy - left.accuracy);

  const finalSubjectStats: StoredTestResult["subjectStats"] = {};
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    const subScore = stats.correct * 4 - stats.incorrect;
    finalSubjectStats[subject] = {
      score: subScore,
      total_marks: stats.total * 4,
      correct: stats.correct,
      incorrect: stats.incorrect,
      unattempted: stats.unattempted,
      total_qs: stats.total,
      accuracy:
        stats.correct + stats.incorrect > 0
          ? Math.round((stats.correct / (stats.correct + stats.incorrect)) * 100)
          : 0,
      time_spent_correct: stats.timeCorrect,
      time_spent_incorrect: stats.timeIncorrect,
      time_spent_unattempted: stats.timeUnattempted,
      total_time_spent: stats.timeCorrect + stats.timeIncorrect + stats.timeUnattempted,
    };
  });

  const mistakes = userAnswers.flatMap((answer) => {
    const question = questionById(store, answer.questionId);
    const grade = gradeAnswer(question, answer);
    if (grade.isCorrect || !hasResponse(answer)) {
      return [];
    }
    return [
      {
        questionId: question.id,
        concept: question.concept,
        error: "Conceptual / Calculation",
        explanation: question.explanation,
        howToApproach: `Review ${question.concept} and repeat ${question.difficulty} level problems.`,
      },
    ];
  });

  const aiSummary =
    correctAnswers > test.totalQuestions / 2
      ? "Good attempt!"
      : "Needs improvement.";

  const result: StoredTestResult = {
    id: createId("result"),
    userId: user.id,
    testId: test.id,
    score,
    percentage,
    correctAnswers,
    wrongAnswers,
    unattempted,
    timeTaken: payload.timeTaken ?? payload.time_taken ?? 0,
    weakAreas,
    strongAreas,
    aiAnalysis: {
      summary:
        weakAreas.length > 0
          ? `${aiSummary} Focus on ${weakAreas.slice(0, 2).map((row) => row.topic).join(", ")}.`
          : aiSummary,
      mistakes,
      recommendations: [
        `Review the ${mistakes.length} answered questions you missed.`,
        "Focus on accuracy before speed.",
        "Repeat one mixed practice set after reviewing the explanations.",
      ],
      dppGenerated: false,
    },
    subjectStats: finalSubjectStats,
    isMalpractice: Boolean(payload.isMalpractice ?? payload.is_malpractice),
    createdAt: new Date().toISOString(),
    answers: userAnswers,
  };

  store.testResults.unshift(result);

  updateUserStreak(store, user.id);
  updateUserStudyTime(user, result.timeTaken);
  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  dailyActivity.questionsPracticed += correctAnswers + wrongAnswers;
  if (score > 0) {
    awardPoints(store, user.id, score, "practice", `Completed test: ${test.title}`, result.id);
  }

  return serializeResult(result);
}

export function listTestResults(store: AppStore, user: StoredUser, testId: string) {
  return store.testResults
    .filter((result) => result.userId === user.id && result.testId === testId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(serializeResult);
}

export function getSingleResult(store: AppStore, user: StoredUser, resultId: string) {
  const result = store.testResults.find((entry) => entry.id === resultId && entry.userId === user.id);
  if (!result) {
    throw new Error(`Result ${resultId} was not found.`);
  }
  return serializeResult(result);
}

export function listPracticeQuestions(
  store: AppStore,
  user: StoredUser,
  filters: { subject?: string | null; difficulty?: string | null; type?: string | null },
) {
  return store.questions
    .filter((question) => {
      const matchesSubject = !filters.subject || question.subject === normalizeSubject(filters.subject);
      const matchesDifficulty = !filters.difficulty || question.difficulty === normalizeDifficulty(filters.difficulty);
      const matchesType = !filters.type || question.questionType === filters.type;
      return matchesSubject && matchesDifficulty && matchesType;
    })
    .map((question) => serializeQuestion(store, user.id, question, true));
}

export function getPracticeQuestionDetail(store: AppStore, user: StoredUser, questionId: string) {
  return serializeQuestion(store, user.id, questionById(store, questionId), true);
}

function getOrCreateSubjectRank(store: AppStore, userId: string, subject: string): StoredSubjectRank {
  let entry = store.subjectRanks.find((row) => row.userId === userId && row.subject === subject);
  if (!entry) {
    entry = {
      userId,
      subject,
      questionsSolved: 0,
      rankScore: 0,
      latitude: null,
      longitude: null,
      locationShared: false,
      updatedAt: new Date().toISOString(),
    };
    store.subjectRanks.push(entry);
  }
  return entry;
}

export function submitPracticeQuestion(
  store: AppStore,
  user: StoredUser,
  questionId: string,
  payload: PracticeSubmissionPayload,
) {
  const question = questionById(store, questionId);
  const answer = normalizeAnswer(payload);
  answer.questionId = question.id;
  const { isCorrect, info } = gradeAnswer(question, answer);

  const attemptedBefore = store.practiceAttempts.some(
    (attempt) => attempt.userId === user.id && attempt.questionId === question.id,
  );
  const solvedBefore = store.practiceAttempts.some(
    (attempt) => attempt.userId === user.id && attempt.questionId === question.id && attempt.isCorrect,
  );

  store.practiceAttempts.unshift({
    id: createId("practice"),
    userId: user.id,
    questionId: question.id,
    isCorrect,
    timeSpent: answer.timeSpent,
    selectedOptions: answer.selectedOptions,
    matrixPairs: answer.matrixPairs,
    answerSubmitted:
      answer.answerText ??
      (answer.selectedOption !== null ? String(answer.selectedOption) : null),
    createdAt: new Date().toISOString(),
  });

  question.frequency += 1;
  if (isCorrect) {
    question.totalCorrect += 1;
  }
  question.acceptanceRate = question.frequency > 0 ? (question.totalCorrect / question.frequency) * 100 : 0;

  const dailyActivity = getOrCreateDailyActivity(store, user.id);
  if (!attemptedBefore) {
    dailyActivity.questionsPracticed += 1;
    updateUserStreak(store, user.id);
  }

  if (isCorrect && !solvedBefore) {
    const basePoints = DIFFICULTY_POINTS[question.difficulty] ?? 10;
    awardPoints(
      store,
      user.id,
      basePoints + 5,
      "practice",
      `Solved ${question.difficulty} ${question.subject} question: ${question.id}`,
      question.id,
    );

    const subjectRank = getOrCreateSubjectRank(store, user.id, question.subject);
    subjectRank.questionsSolved += 1;
    subjectRank.rankScore += basePoints;
    subjectRank.updatedAt = new Date().toISOString();
  }

  return {
    isCorrect,
    is_correct: isCorrect,
    already_solved: solvedBefore,
    ...info,
  };
}

export function getOgcodeUserStats(store: AppStore, user: StoredUser) {
  const attempts = store.practiceAttempts.filter((attempt) => attempt.userId === user.id);
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((attempt) => attempt.isCorrect).length;
  const solvedCount = new Set(
    attempts.filter((attempt) => attempt.isCorrect).map((attempt) => attempt.questionId),
  ).size;
  const attemptedCount = new Set(attempts.map((attempt) => attempt.questionId)).size;
  const totalQuestions = store.questions.length;
  const accuracy = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
  const syllabusCoverage = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 100) : 0;

  const leaderboard = buildLeaderboardEntries(store, user, null);
  const myRank = leaderboard.find((entry) => entry.isMe)?.rank ?? null;

  return {
    rank: myRank,
    accuracy,
    solvedCount,
    solved_count: solvedCount,
    totalAttempts,
    total_attempts: totalAttempts,
    syllabusCoverage,
    syllabus_coverage: syllabusCoverage,
    streak: user.streak,
  };
}

export function getOgcodeSubjectRanks(store: AppStore, user: StoredUser) {
  const rows = store.subjectRanks
    .filter((entry) => entry.userId === user.id)
    .sort((left, right) => right.rankScore - left.rankScore)
    .map((entry, index) => ({
      subject: entry.subject,
      questionsSolved: entry.questionsSolved,
      questions_solved: entry.questionsSolved,
      rankScore: entry.rankScore,
      rank_score: entry.rankScore,
      rankPosition: index + 1,
      rank_position: index + 1,
    }));

  return rows;
}

function buildLeaderboardEntries(store: AppStore, user: StoredUser, subject: string | null) {
  const currentUserAttempts = store.practiceAttempts.filter((attempt) => {
    if (attempt.userId !== user.id || !attempt.isCorrect) {
      return false;
    }
    if (!subject) {
      return true;
    }
    return questionById(store, attempt.questionId).subject === subject;
  });
  const uniqueSolved = new Set(currentUserAttempts.map((attempt) => attempt.questionId)).size;
  const dailyAnalytics = buildTimeAnalytics(store, user.id);
  const totalMinutes = dailyAnalytics.reduce(
    (sum, row) => sum + row.practiceTime + row.webpageTime + row.pomodoroTime,
    0,
  ) / 60;
  const myRankScore = totalMinutes > 0 ? Number((uniqueSolved / totalMinutes).toFixed(3)) : uniqueSolved * 10;

  const seedEntries = store.leaderboardSeed.map((entry) => ({
    rank: entry.rank,
    userId: entry.userId,
    name: entry.name,
    avatar: entry.avatar,
    rankScore: Number((entry.score / Math.max(entry.studyTime, 1)).toFixed(3)),
    rank_score: Number((entry.score / Math.max(entry.studyTime, 1)).toFixed(3)),
    score: entry.score,
    studyTime: entry.studyTime,
    location: entry.location,
    isMe: false,
    is_me: false,
  }));

  const current = {
    rank: 0,
    userId: user.id,
    name: user.name,
    avatar: user.avatar ?? undefined,
    rankScore: myRankScore,
    rank_score: myRankScore,
    score: buildPointsSummary(store, user.id).totalPoints,
    studyTime: Math.round(totalMinutes),
    location: undefined,
    isMe: true,
    is_me: true,
  };

  const entries = [...seedEntries.filter((entry) => entry.userId !== user.id), current]
    .sort((left, right) => right.rankScore - left.rankScore)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  return entries;
}

export function getOgcodeLeaderboard(store: AppStore, user: StoredUser, subject: string | null) {
  const entries = buildLeaderboardEntries(store, user, subject);
  return {
    leaderboard: entries.slice(0, 20),
    myRank: entries.find((entry) => entry.isMe)?.rank ?? null,
    my_rank: entries.find((entry) => entry.isMe)?.rank ?? null,
  };
}

export function updateOgcodeLocation(
  store: AppStore,
  user: StoredUser,
  payload: UpdateOgcodeLocationPayload,
) {
  const subject = payload.subject ? normalizeSubject(payload.subject) : "";
  if (!subject) {
    throw new Error("subject is required");
  }
  const entry = getOrCreateSubjectRank(store, user.id, subject);
  if (payload.share && payload.latitude != null && payload.longitude != null) {
    entry.latitude = Number(payload.latitude);
    entry.longitude = Number(payload.longitude);
    entry.locationShared = true;
  } else {
    entry.locationShared = false;
  }
  entry.updatedAt = new Date().toISOString();
  return { status: "updated" };
}

export function getFocusAreas(store: AppStore, user: StoredUser) {
  const attemptedQuestionIds = new Set<string>();
  store.practiceAttempts
    .filter((attempt) => attempt.userId === user.id)
    .forEach((attempt) => attemptedQuestionIds.add(attempt.questionId));
  store.testResults
    .filter((result) => result.userId === user.id)
    .flatMap((result) => result.answers)
    .forEach((answer) => attemptedQuestionIds.add(answer.questionId));

  const subjects = ["physics", "chemistry", "mathematics", "biology"];

  return subjects
    .map((subject) => {
      const totalQuestions = store.questions.filter((question) => question.subject === subject).length;
      const attemptedInSubject = store.questions.filter(
        (question) => question.subject === subject && attemptedQuestionIds.has(question.id),
      ).length;
      const questionsLeft = Math.max(0, totalQuestions - attemptedInSubject);
      const dppsPending = store.dpps.filter(
        (dpp) => dpp.userId === user.id && dpp.subject === subject && !dpp.completed,
      ).length;
      const assignmentsPending = store.assignments.filter(
        (assignment) => assignment.userId === user.id && assignment.subject === subject && !assignment.completed,
      ).length;

      return {
        subject: subject[0].toUpperCase() + subject.slice(1),
        score: questionsLeft + dppsPending * 5 + assignmentsPending * 10,
        questionsLeft,
        questions_left: questionsLeft,
        dppsPending,
        dpps_pending: dppsPending,
        assignmentsPending,
        assignments_pending: assignmentsPending,
        completionRate: totalQuestions > 0 ? Math.round((attemptedInSubject / totalQuestions) * 100) : 100,
        completion_rate: totalQuestions > 0 ? Math.round((attemptedInSubject / totalQuestions) * 100) : 100,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function getChallengeOfTheDay(store: AppStore, user: StoredUser) {
  const challenge = store.questions.find((question) => question.isChallengeOfTheDay) ?? store.questions[0];
  if (!challenge) {
    throw new Error("No challenge of the day set.");
  }
  const data = serializeQuestion(store, user.id, challenge, true);
  return {
    ...data,
    isSolved: store.practiceAttempts.some(
      (attempt) => attempt.userId === user.id && attempt.questionId === challenge.id && attempt.isCorrect,
    ),
  };
}
