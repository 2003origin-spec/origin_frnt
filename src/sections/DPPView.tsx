'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { apiCall } from '@/lib/api';
import { hasAnyPremium } from '@/lib/entitlements';
import { playAnswerSound, resetAnswerStreak } from '@/lib/sound-manager';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { DegradedBanner } from '@/components/DegradedBanner';
import type { User } from '@/types';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
  Lightbulb,
  Loader2,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react';

const DPP_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

const DPP_SUBJECT_ORI: Record<string, string> = {
  phy:     '/ori2d/ori-physics.png',
  physics: '/ori2d/ori-physics.png',
  chem:     '/ori2d/ori-chemistry.png',
  chemistry: '/ori2d/ori-chemistry.png',
  math:     '/ori2d/ori-maths.png',
  mathematics: '/ori2d/ori-maths.png',
  bio:      '/ori2d/ori-biology.png',
  biology:  '/ori2d/ori-biology.png',
};

interface DPPViewProps {
  onBack: () => void;
  user: User;
  initialDpps: GeneratedDpp[] | null;
}

interface GeneratedDppAttemptSummary {
  id: string;
  summary: string;
  recommendations: string[];
  resolvedTopics: string[];
  resolved_topics?: string[];
  stillWeakTopics: string[];
  still_weak_topics?: string[];
  progressScore: number;
  progress_score?: number;
  completed: boolean;
  analysisStatus?: 'pending' | 'complete' | 'failed';
  analysis_status?: 'pending' | 'complete' | 'failed';
  analysisError?: string | null;
  analysis_error?: string | null;
  createdAt: string;
}

interface GeneratedDpp {
  id: string;
  title: string;
  subject: string;
  summary?: string;
  weakTopics?: string[];
  weak_topics?: string[];
  generatedFrom?: string[];
  generated_from?: string[];
  provenanceNote?: string | null;
  provenance_note?: string | null;
  createdAt?: string;
  completed: boolean;
  duration?: number;
  targetQuestionCount?: number;
  questions: DppQuestion[];
  latestAttempt?: GeneratedDppAttemptSummary | null;
  /** 'teacher' = shared to your batch by your institute; 'auto' = generated from a test you took. */
  origin?: 'auto' | 'teacher';
  /** "Institute mode" — show every question at once instead of one at a time. */
  showAllQuestions?: boolean;
  show_all_questions?: boolean;
  teacherDisplayName?: string | null;
  teacher_display_name?: string | null;
  teacherLogoUrl?: string | null;
  teacher_logo_url?: string | null;
  /** Teacher DPPs only — the card counts down to this. */
  expiresAt?: string | null;
  expires_at?: string | null;
  /** The student's own graded record for this DPP, from the server. */
  progress?: DppProgress | null;
}

type DppProgress = {
  attempted: Array<{
    questionId: string;
    isCorrect: boolean;
    marksAwarded: number;
    maxMarks: number;
  }>;
  questionsAttempted: number;
  questionsTotal: number;
  correctCount: number;
  score: number;
  marksAttempted: number;
  accuracy: number | null;
}

function isTeacherDpp(dpp: GeneratedDpp): boolean {
  return dpp.origin === 'teacher';
}

function teacherNameOf(dpp: GeneratedDpp): string | null {
  return dpp.teacherDisplayName ?? dpp.teacher_display_name ?? null;
}

function teacherLogoOf(dpp: GeneratedDpp): string | null {
  return dpp.teacherLogoUrl ?? dpp.teacher_logo_url ?? null;
}

/** Whole days left before a teacher DPP disappears; null when it never expires. */
function daysLeftOf(dpp: GeneratedDpp): number | null {
  const raw = dpp.expiresAt ?? dpp.expires_at;
  if (!raw) return null;
  const expiry = new Date(raw).getTime();
  if (Number.isNaN(expiry)) return null;
  return Math.max(0, Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000)));
}

/**
 * Institute lockup for a teacher-shared DPP — logo + name, name-only when the
 * institute has no logo or the image fails to load (same fallback the CBT
 * co-branded exam header uses).
 */
function InstituteLockup({
  name,
  logoUrl,
  className = '',
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  const [logoBroken, setLogoBroken] = useState(false);
  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      {logoUrl && !logoBroken ? (
        <img
          src={logoUrl}
          alt={name}
          draggable={false}
          onError={() => setLogoBroken(true)}
          className="w-6 h-6 rounded-full object-cover select-none flex-shrink-0 ring-1 ring-primary/30"
        />
      ) : null}
      <span className="truncate font-semibold text-primary">{name}</span>
    </span>
  );
}

type DppQuestion = {
  id: string;
  text: string;
  image?: string | null;
  options?: string[];
  optionImages?: (string | null)[] | null;
  explanation?: string;
  concept: string;
  difficulty: string;
  subject: string;
  chapter?: string;
  presentationId?: string;
  presentation_id?: string;
  correctOption?: number | null;
  correct_option?: number | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

interface DppSubmissionResponse extends GeneratedDppAttemptSummary {
  degraded?: boolean;
  degradedReason?: string;
  degraded_reason?: string;
  answers: Array<{
    questionId: string;
    selectedOption: number | null;
    selectedOptions?: number[] | null;
    matrixPairs?: number[][] | null;
    answerText?: string | null;
    timeSpent: number;
    isMarkedForReview: boolean;
  }>;
}

type DppCheckResult = {
  isCorrect: boolean;
  is_correct?: boolean;
  correctOption?: number | null;
  correct_option?: number | null;
  explanation?: string;
};

export default function DPPView({ onBack, initialDpps, user }: DPPViewProps) {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(initialDpps === null);
  const [dpps, setDpps] = useState<GeneratedDpp[]>(initialDpps ?? []);
  // Deep-link support: /dpp?dpp=<id> opens that DPP directly (e.g. the "Start"
  // link on a room-generated DPP). Falls back to the list when absent.
  const [selectedDppId, setSelectedDppId] = useState<string | null>(() => searchParams.get('dpp'));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [revealedAnswers, setRevealedAnswers] = useState<boolean[]>([]);
  const [checkResults, setCheckResults] = useState<(DppCheckResult | null)[]>([]);
  const [timeSpentByQuestion, setTimeSpentByQuestion] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<DppSubmissionResponse | null>(null);
  const [error, setError] = useState('');
  const questionStartedAtRef = useRef<number>(Date.now());

  const currentDpp = useMemo(
    () => dpps.find((entry) => entry.id === selectedDppId) ?? null,
    [dpps, selectedDppId],
  );
  const currentQuestions = currentDpp?.questions ?? [];
  const currentQuestion = currentQuestions[currentQuestionIndex] ?? null;
  // "Institute mode": show every question at once instead of one-at-a-time.
  const allAtOnce = Boolean(currentDpp?.showAllQuestions ?? currentDpp?.show_all_questions);
  const progress = currentQuestions.length > 0 ? ((currentQuestionIndex + 1) / currentQuestions.length) * 100 : 0;
  const isCompleted = Boolean(submissionResult);
  const submissionAnalysisStatus = submissionResult?.analysisStatus ?? submissionResult?.analysis_status ?? 'complete';

  // Fresh consecutive-answer streak per DPP session.
  useEffect(() => { resetAnswerStreak(); }, []);

  useEffect(() => {
    if (initialDpps !== null) {
      return;
    }

    const loadDpps = async () => {
      try {
        setLoading(true);
        setError('');
        const plans = await apiCall('/assessments/dpps/');
        setDpps(Array.isArray(plans) ? plans : []);
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Failed to load generated DPPs.'));
      } finally {
        setLoading(false);
      }
    };
    loadDpps();
  }, [initialDpps]);

  useEffect(() => {
    if (!selectedDppId) {
      return;
    }

    const selectedDpp = dpps.find((entry) => entry.id === selectedDppId);
    if (selectedDpp?.questions?.length) {
      return;
    }

    const loadDetail = async () => {
      try {
        setLoading(true);
        const detail = await apiCall(`/assessments/dpps/${selectedDppId}/`);
        setDpps((previous) =>
          previous.some((entry) => entry.id === selectedDppId)
            ? previous.map((entry) => (entry.id === selectedDppId ? detail : entry))
            : [detail, ...previous],
        );
      } catch (loadError) {
        setError(getErrorMessage(loadError, 'Failed to load DPP details.'));
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [dpps, selectedDppId]);

  useEffect(() => {
    const questionCount = currentDpp?.questions?.length ?? 0;
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowSolution(false);
    setAnswers(new Array(questionCount).fill(null));
    setRevealedAnswers(new Array(questionCount).fill(false));
    setCheckResults(new Array(questionCount).fill(null));
    setTimeSpentByQuestion(new Array(questionCount).fill(0));
    setSubmissionResult(null);
    questionStartedAtRef.current = Date.now();
  }, [selectedDppId, currentDpp?.questions?.length]);

  useEffect(() => {
    if (!selectedDppId || submissionAnalysisStatus !== 'pending') {
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 20;

    const poll = async () => {
      if (attempts >= MAX_ATTEMPTS) {
        window.clearInterval(interval);
        return;
      }
      attempts++;
      try {
        const detail = await apiCall(`/assessments/dpps/${selectedDppId}/`);
        if (cancelled) return;
        setDpps((previous) => previous.map((entry) => (entry.id === selectedDppId ? detail : entry)));
        if (detail?.latestAttempt) {
          setSubmissionResult((previous) => ({
            ...detail.latestAttempt,
            answers: previous?.answers ?? [],
          }));
          // Stop polling once analysis is no longer pending
          if (detail.latestAttempt?.analysisStatus !== 'pending' &&
              detail.latestAttempt?.analysis_status !== 'pending') {
            window.clearInterval(interval);
          }
        }
      } catch {
        // Keep the scored pending attempt visible until a later poll succeeds.
      }
    };

    const interval = window.setInterval(poll, 3000);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedDppId, submissionAnalysisStatus]);

  const getCorrectOption = (index: number) => {
    const result = checkResults[index];
    return result?.correctOption ?? result?.correct_option ?? null;
  };

  const getElapsedSeconds = () => Math.max(0, Math.round((Date.now() - questionStartedAtRef.current) / 1000));

  const recordCurrentQuestionTime = () => {
    const elapsedSeconds = getElapsedSeconds();
    if (elapsedSeconds <= 0) {
      questionStartedAtRef.current = Date.now();
      return;
    }

    setTimeSpentByQuestion((previous) => {
      const next = [...previous];
      next[currentQuestionIndex] = (next[currentQuestionIndex] ?? 0) + elapsedSeconds;
      return next;
    });
    questionStartedAtRef.current = Date.now();
  };

  /**
   * The student's graded record for the open DPP: what the server has, plus
   * anything they have checked in this session (which the server also has by
   * now — every Check Answer is written immediately — but merging locally keeps
   * the header live without a refetch per question).
   *
   * Keyed by question id rather than index so it survives the palette order.
   */
  const answeredByQuestionId = useMemo(() => {
    const map = new Map<string, { isCorrect: boolean; marksAwarded: number; maxMarks: number }>();
    for (const entry of currentDpp?.progress?.attempted ?? []) {
      map.set(entry.questionId, {
        isCorrect: entry.isCorrect,
        marksAwarded: entry.marksAwarded,
        maxMarks: entry.maxMarks,
      });
    }
    currentQuestions.forEach((question, index) => {
      const result = checkResults[index];
      if (!result || map.has(question.id)) return;
      map.set(question.id, {
        isCorrect: Boolean(result.isCorrect ?? result.is_correct),
        marksAwarded: 0,
        maxMarks: 0,
      });
    });
    return map;
  }, [currentDpp?.progress, currentQuestions, checkResults]);

  const liveProgress = useMemo(() => {
    const base = currentDpp?.progress;
    const sessionOnly = currentQuestions.filter(
      (question, index) =>
        checkResults[index] && !(base?.attempted ?? []).some((a) => a.questionId === question.id),
    ).length;
    const answered = (base?.questionsAttempted ?? 0) + sessionOnly;
    return {
      answered,
      total: currentQuestions.length,
      score: base?.score ?? 0,
      marksAttempted: base?.marksAttempted ?? 0,
      accuracy: base?.accuracy ?? null,
    };
  }, [currentDpp?.progress, currentQuestions, checkResults]);

  /** Already graded — the first answer is the one that counts, so it is locked. */
  const isQuestionLocked = (index: number): boolean => {
    const question = currentQuestions[index];
    if (!question) return false;
    return Boolean(revealedAnswers[index]) || answeredByQuestionId.has(question.id);
  };

  const goToQuestion = (nextIndex: number) => {
    recordCurrentQuestionTime();
    setCurrentQuestionIndex(nextIndex);
    setSelectedOption(answers[nextIndex] ?? null);
    setShowSolution(revealedAnswers[nextIndex] ?? false);
    questionStartedAtRef.current = Date.now();
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (showSolution || !currentQuestion) return;
    // Re-answering cannot change the score — only the first grading counts —
    // so the option is inert rather than quietly doing nothing.
    if (isQuestionLocked(currentQuestionIndex)) return;
    setSelectedOption(optionIndex);
  };

  const handleCheck = async () => {
    if (selectedOption === null || !currentQuestion || !currentDpp) return;
    if (isQuestionLocked(currentQuestionIndex)) return;
    const elapsedSeconds = getElapsedSeconds();
    recordCurrentQuestionTime();
    setChecking(true);
    setError('');
    try {
      const response = await apiCall(`/assessments/dpps/${currentDpp?.id}/check/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          presentation_id: currentQuestion.presentationId ?? currentQuestion.presentation_id ?? null,
          selected_option: selectedOption,
          time_spent: (timeSpentByQuestion[currentQuestionIndex] ?? 0) + elapsedSeconds,
        }),
      });
      setShowSolution(true);
      playAnswerSound(Boolean(response?.isCorrect ?? response?.is_correct));
      setAnswers((previous) => {
        const next = [...previous];
        next[currentQuestionIndex] = selectedOption;
        return next;
      });
      setRevealedAnswers((previous) => {
        const next = [...previous];
        next[currentQuestionIndex] = true;
        return next;
      });
      setCheckResults((previous) => {
        const next = [...previous];
        next[currentQuestionIndex] = response;
        return next;
      });
    } catch (checkError) {
      setError(getErrorMessage(checkError, 'Failed to check answer.'));
    } finally {
      setChecking(false);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex <= 0) return;
    goToQuestion(currentQuestionIndex - 1);
  };

  // ── "Institute mode" (all questions at once) — index-aware variants ────────
  // The one-at-a-time path above stays untouched; these drive the stacked view.
  const selectOptionAt = (qIndex: number, optIndex: number) => {
    if (revealedAnswers[qIndex] || isQuestionLocked(qIndex)) return;
    setAnswers((prev) => {
      const next = [...prev];
      while (next.length < currentQuestions.length) next.push(null);
      next[qIndex] = optIndex;
      return next;
    });
  };

  const checkAt = async (qIndex: number) => {
    const question = currentQuestions[qIndex];
    const selection = answers[qIndex];
    if (selection === null || selection === undefined || !question || !currentDpp) return;
    if (isQuestionLocked(qIndex) || revealedAnswers[qIndex]) return;
    setChecking(true);
    setError('');
    try {
      const response = await apiCall(`/assessments/dpps/${currentDpp.id}/check/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id,
          presentation_id: question.presentationId ?? question.presentation_id ?? null,
          selected_option: selection,
          time_spent: timeSpentByQuestion[qIndex] ?? 0,
        }),
      });
      playAnswerSound(Boolean(response?.isCorrect ?? response?.is_correct));
      setRevealedAnswers((prev) => { const n = [...prev]; n[qIndex] = true; return n; });
      setCheckResults((prev) => { const n = [...prev]; n[qIndex] = response; return n; });
    } catch (checkError) {
      setError(getErrorMessage(checkError, 'Failed to check answer.'));
    } finally {
      setChecking(false);
    }
  };

  const submitCurrentDpp = async () => {
    if (!currentDpp) return;
    recordCurrentQuestionTime();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        answers: currentQuestions.map((question, index) => ({
          question_id: question.id,
          presentation_id: question.presentationId ?? question.presentation_id ?? null,
          selected_option: answers[index],
          time_spent: timeSpentByQuestion[index] ?? 0,
          is_marked_for_review: false,
        })),
        time_taken: timeSpentByQuestion.reduce((sum, seconds) => sum + seconds, 0),
      };
      const response = await apiCall(`/assessments/dpps/${currentDpp.id}/submit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSubmissionResult(response);
      setDpps((previous) =>
        previous.map((entry) =>
          entry.id === currentDpp.id
            ? {
                ...entry,
                completed: response.completed,
                latestAttempt: response,
              }
            : entry,
        ),
      );
    } catch (submitError) {
      setError(getErrorMessage(submitError, 'Failed to submit DPP.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < currentQuestions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
      return;
    }
    await submitCurrentDpp();
  };

  const retryCurrentDpp = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setShowSolution(false);
    setAnswers(new Array(currentQuestions.length).fill(null));
    setRevealedAnswers(new Array(currentQuestions.length).fill(false));
    setCheckResults(new Array(currentQuestions.length).fill(null));
    setTimeSpentByQuestion(new Array(currentQuestions.length).fill(0));
    setSubmissionResult(null);
    questionStartedAtRef.current = Date.now();
  };

  const correctCount = checkResults.filter((result) => Boolean(result?.isCorrect ?? result?.is_correct)).length;

  return (
    <div id="tutorial-dpp-hub" className="min-h-screen overflow-x-hidden neu-surface text-foreground transition-colors duration-300">
      <header className="z-40 bg-[hsl(var(--neu-bg)/0.9)] border-b border-border/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4 truncate min-w-0">
              <button
                onClick={() => (selectedDppId ? setSelectedDppId(null) : onBack())}
                className="p-2 rounded-xl hover:bg-primary/5 transition-colors"
                aria-label={selectedDppId ? 'Back to DPP list' : 'Back to dashboard'}
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              {currentDpp && DPP_SUBJECT_ORI[currentDpp.subject] ? (
                <img
                  src={DPP_SUBJECT_ORI[currentDpp.subject]}
                  alt="Ori"
                  className="w-10 h-10 sm:w-20 sm:h-20 object-contain drop-shadow-md flex-shrink-0"
                />
              ) : null}
              <div className="truncate">
                <h1 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white truncate">Daily Practice Problems</h1>
                <p className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                  {selectedDppId
                    ? 'Solve a DPP, then jump back to pick another'
                    : 'Pick any generated DPP — one per recent test'}
                </p>
              </div>
            </div>
            <Badge className="bg-primary/10 text-primary dark:bg-primary/20 hidden xs:flex">
              <Sparkles className="w-3 h-3 mr-1" />
              Service Generated
            </Badge>
          </div>
        </div>
        <Progress value={progress} className="h-1 rounded-none" />
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {loading ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 flex items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading DPPs...
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 text-center text-red-500">{error}</CardContent>
          </Card>
        ) : dpps.length === 0 ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 text-center space-y-3">
              <img src="/ori2d/ori-cheerful.png" alt="Ori" className="w-28 h-28 object-contain mx-auto mb-3 drop-shadow-md" />
              {hasAnyPremium(user) ? (
                <>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">No DPPs generated yet</h2>
                  <p className="text-slate-500 dark:text-slate-400">
                    Submit a custom or regular test first so the analytics pipeline can generate targeted DPPs.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Daily Practice is a premium feature</h2>
                  <p className="text-slate-500 dark:text-slate-400">
                    Unlock a subject to get analytics-backed DPPs generated from your weak topics after every test.
                  </p>
                  <button
                    onClick={onBack}
                    className="mt-2 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90"
                  >
                    Explore premium
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        ) : !selectedDppId ? (
          <DppSelectionGrid dpps={dpps} onSelect={setSelectedDppId} />
        ) : !currentDpp ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 flex items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading DPP...
            </CardContent>
          </Card>
        ) : isCompleted ? (
          <Card className="neu-raised border-0 shadow-none">
            <CardContent className="p-8 text-center">
              {submissionAnalysisStatus === 'pending' ? (
                <div className="mb-6 text-left">
                  <DegradedBanner
                    title="Analytics processing"
                    reason="Your DPP score is ready. Detailed progress analysis will update shortly."
                  />
                </div>
              ) : submissionResult?.degraded ? (
                <div className="mb-6 text-left">
                  <DegradedBanner reason={submissionResult.degradedReason ?? submissionResult.degraded_reason ?? null} />
                </div>
              ) : null}
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-primary to-[#1E3A5F] flex items-center justify-center mb-6">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">DPP Completed</h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-6">
                {submissionResult?.summary ?? 'Your DPP attempt has been analyzed.'}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-md mx-auto mb-8">
                <div className="p-3 sm:p-4 rounded-xl bg-primary/5 dark:bg-primary/10">
                  <div className="text-xl sm:text-3xl font-bold text-primary">{correctCount}</div>
                  <div className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide sm:tracking-widest">Correct</div>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-900/20">
                  <div className="text-xl sm:text-3xl font-bold text-red-600">{currentQuestions.length - correctCount}</div>
                  <div className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide sm:tracking-widest">Wrong</div>
                </div>
                <div className="p-3 sm:p-4 rounded-xl bg-primary/10 dark:bg-primary/20">
                  <div className="text-xl sm:text-3xl font-bold text-primary">
                    {Math.round(submissionResult?.progress_score ?? submissionResult?.progressScore ?? 0)}%
                  </div>
                  <div className="text-[10px] sm:text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wide sm:tracking-widest">Score</div>
                </div>
              </div>

              <div className="space-y-4 max-w-2xl mx-auto text-left">
                <div className="rounded-2xl neu-inset p-4">
                  <h3 className="font-semibold text-foreground mb-2">Recommendations</h3>
                  <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    {(submissionResult?.recommendations ?? []).map((item, index) => (
                      <li key={`${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-4 mt-8">
                <Button variant="outline" onClick={retryCurrentDpp} className="rounded-full">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry DPP
                </Button>
                {dpps.length > 1 ? (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDppId(null)}
                    className="rounded-full"
                  >
                    <ChevronLeft className="w-4 h-4 mr-2" />
                    Pick another DPP
                  </Button>
                ) : null}
                <Button onClick={onBack} className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white">
                  Back to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : allAtOnce ? (
          <div className="max-w-3xl mx-auto space-y-4">
            {isTeacherDpp(currentDpp) && teacherNameOf(currentDpp) ? (
              <div className="flex items-center justify-between gap-2 rounded-2xl neu-raised p-4">
                <InstituteLockup name={teacherNameOf(currentDpp) as string} logoUrl={teacherLogoOf(currentDpp)} className="text-sm" />
                <Badge variant="outline">{currentQuestions.length} questions</Badge>
              </div>
            ) : null}
            {currentQuestions.map((q, qi) => {
              const revealed = revealedAnswers[qi] || isQuestionLocked(qi);
              const locked = isQuestionLocked(qi);
              const sel = answers[qi] ?? null;
              const correct = getCorrectOption(qi);
              return (
                <Card key={q.id} className="neu-raised border-0 shadow-none">
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-center flex-wrap gap-2 mb-4">
                      <Badge className="bg-primary/10 text-primary">Q{qi + 1}</Badge>
                      <Badge variant="secondary" className="capitalize">{q.difficulty}</Badge>
                      <Badge variant="outline" className="capitalize">{q.subject}</Badge>
                    </div>
                    <div className="min-w-0 text-base sm:text-lg font-medium text-slate-900 dark:text-white mb-4 leading-relaxed break-words overflow-x-hidden">
                      <FormattedMessage content={q.text} />
                      {q.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={q.image} alt="Question diagram" className="mt-3 block max-h-72 w-auto max-w-full rounded-xl border border-border/60 object-contain" />
                      )}
                    </div>
                    <div className="space-y-2.5 mb-4">
                      {(q.options ?? []).map((option, index) => (
                        <button
                          key={`${q.id}-${index}`}
                          onClick={() => selectOptionAt(qi, index)}
                          disabled={revealed}
                          className={`w-full p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${
                            revealed
                              ? index === correct
                                ? 'border-primary bg-primary/5'
                                : sel === index
                                  ? 'border-red-500 bg-red-500/10'
                                  : 'border-border/40 opacity-50'
                              : sel === index
                                ? 'border-primary bg-primary/5'
                                : 'border-border/40 hover:border-primary/50 hover:bg-primary/5'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-medium ${
                              revealed
                                ? index === correct ? 'bg-primary text-white' : sel === index ? 'bg-red-500 text-white' : 'neu-inset text-muted-foreground'
                                : sel === index ? 'bg-primary text-white' : 'neu-inset text-muted-foreground'
                            }`}>
                              {revealed && index === correct ? <CheckCircle2 className="w-5 h-5" /> : revealed && sel === index ? <XCircle className="w-5 h-5" /> : String.fromCharCode(65 + index)}
                            </div>
                            <span className="text-sm sm:text-base min-w-0 break-words text-slate-700 dark:text-slate-300">
                              {String(option).trim() && <FormattedMessage content={String(option)} inline />}
                              {q.optionImages?.[index] && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={q.optionImages[index] as string} alt={`Option ${index + 1}`} className="mt-2 block max-h-40 w-auto max-w-full rounded-lg border border-border/60 object-contain" />
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                    {revealed ? (
                      <div className="p-4 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                        <h4 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2 text-sm">
                          <Lightbulb className="w-4 h-4 text-primary" /> Explanation
                        </h4>
                        <div className="min-w-0 break-words overflow-x-hidden text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                          <FormattedMessage content={checkResults[qi]?.explanation ?? q.explanation ?? ''} />
                        </div>
                      </div>
                    ) : locked ? (
                      <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" /> Already answered
                      </span>
                    ) : (
                      <Button onClick={() => checkAt(qi)} disabled={sel === null || checking} className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white">
                        {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                        Check Answer
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            <div className="flex justify-end pt-2 pb-10">
              <Button onClick={submitCurrentDpp} disabled={submitting} className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Finish DPP
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 min-w-0">
              <Card className="neu-raised border-0 shadow-none">
                <CardContent className="p-4 sm:p-8">
                  <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-6">
                    <Badge className="bg-primary/10 text-primary">
                      Q{currentQuestionIndex + 1} of {currentQuestions.length}
                    </Badge>
                    <Badge variant="secondary" className="capitalize">
                      {currentQuestion?.difficulty}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {currentQuestion?.subject}
                    </Badge>
                  </div>

                  {currentQuestion ? (
                    <>
                      <div className="min-w-0 text-lg sm:text-xl font-medium text-slate-900 dark:text-white mb-6 leading-relaxed break-words overflow-x-hidden">
                        <FormattedMessage content={currentQuestion.text} />
                        {currentQuestion.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={currentQuestion.image} alt="Question diagram" className="mt-3 block max-h-72 w-auto max-w-full rounded-xl border border-border/60 object-contain" />
                        )}
                      </div>

                      <div className="space-y-3 mb-6">
                        {(currentQuestion.options ?? []).map((option, index) => (
                          <button
                            key={`${currentQuestion.id}-${index}`}
                            onClick={() => handleOptionSelect(index)}
                            disabled={showSolution || isQuestionLocked(currentQuestionIndex)}
                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                              showSolution
                                ? index === getCorrectOption(currentQuestionIndex)
                                  ? 'border-primary bg-primary/5'
                                  : selectedOption === index
                                    ? 'border-red-500 bg-red-500/10'
                                    : 'border-border/40 opacity-50'
                                : selectedOption === index
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/40 hover:border-primary/50 hover:bg-primary/5'
                            }`}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div
                                className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-medium ${
                                  showSolution
                                    ? index === getCorrectOption(currentQuestionIndex)
                                      ? 'bg-primary text-white'
                                      : selectedOption === index
                                        ? 'bg-red-500 text-white'
                                        : 'neu-inset text-muted-foreground'
                                    : selectedOption === index
                                      ? 'bg-primary text-white'
                                      : 'neu-inset text-muted-foreground'
                                }`}
                              >
                                {showSolution && index === getCorrectOption(currentQuestionIndex) ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : showSolution && selectedOption === index ? (
                                  <XCircle className="w-5 h-5" />
                                ) : (
                                  String.fromCharCode(65 + index)
                                )}
                              </div>
                              <span
                                className={`text-base sm:text-lg min-w-0 break-words ${
                                  showSolution && index === getCorrectOption(currentQuestionIndex)
                                    ? 'text-primary'
                                    : showSolution && selectedOption === index
                                      ? 'text-red-700 dark:text-red-400'
                                      : 'text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {String(option).trim() && <FormattedMessage content={String(option)} inline />}
                                {currentQuestion.optionImages?.[index] && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={currentQuestion.optionImages[index] as string} alt={`Option ${index + 1}`} className="mt-2 block max-h-40 w-auto max-w-full rounded-lg border border-border/60 object-contain" />
                                )}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      {showSolution && (
                        <div className="mb-6 p-6 rounded-xl bg-primary/5 dark:bg-primary/10 border border-primary/20">
                          <h4 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-primary" />
                            Explanation
                          </h4>
                          <div className="min-w-0 break-words overflow-x-hidden text-slate-700 dark:text-slate-300 leading-relaxed">
                            <FormattedMessage content={checkResults[currentQuestionIndex]?.explanation ?? currentQuestion.explanation ?? ''} />
                          </div>
                          <div className="mt-4 pt-4 border-t border-primary/20">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              <strong className="text-slate-900 dark:text-white">Concept:</strong> {currentQuestion.concept}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <Button variant="outline" onClick={handlePrevious} disabled={currentQuestionIndex === 0} className="rounded-full">
                          <ChevronLeft className="w-4 h-4 mr-2" />
                          Previous
                        </Button>

                        {!showSolution && isQuestionLocked(currentQuestionIndex) ? (
                          // Answered in an earlier session. Say so plainly —
                          // silently ignoring taps is what makes students think
                          // re-answering might bump their score.
                          <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                            {answeredByQuestionId.get(currentQuestion.id)?.isCorrect
                              ? 'Already answered — you got this right'
                              : 'Already answered — this one was wrong'}
                          </span>
                        ) : !showSolution ? (
                          <Button
                            onClick={handleCheck}
                            disabled={selectedOption === null || checking}
                            className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white"
                          >
                            {checking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            {checking ? 'Checking...' : 'Check Answer'}
                          </Button>
                        ) : (
                          <Button
                            onClick={handleNext}
                            disabled={submitting}
                            className="rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white"
                          >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {currentQuestionIndex === currentQuestions.length - 1 ? 'Finish' : 'Next'}
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="neu-raised border-0 shadow-none">
                <CardContent className="p-4">
                  {isTeacherDpp(currentDpp) && teacherNameOf(currentDpp) ? (
                    <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-primary/15 min-w-0">
                      <InstituteLockup
                        name={teacherNameOf(currentDpp) as string}
                        logoUrl={teacherLogoOf(currentDpp)}
                        className="text-sm"
                      />
                      <GraduationCap className="w-4 h-4 text-primary flex-shrink-0" />
                    </div>
                  ) : null}
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 line-clamp-2">{currentDpp.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {currentDpp.summary ?? 'Targeted practice generated from your latest weak-topic analytics.'}
                  </p>
                  {/* Running score. A DPP is never submitted, so this is the
                      only place the student sees what their practice is worth —
                      and seeing it is what stops them re-answering questions
                      expecting the number to move. */}
                  <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Your score
                      </span>
                      <span className="font-mono text-lg font-bold tabular-nums text-primary">
                        {liveProgress.score}
                        {liveProgress.marksAttempted > 0 ? (
                          <span className="text-xs font-semibold text-muted-foreground">
                            {' '}/ {liveProgress.marksAttempted}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[0.7rem] text-muted-foreground">
                      <span>
                        {liveProgress.answered} of {liveProgress.total} answered
                      </span>
                      {liveProgress.accuracy !== null ? <span>{liveProgress.accuracy}% accuracy</span> : null}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${
                            liveProgress.total > 0
                              ? Math.round((liveProgress.answered / liveProgress.total) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[0.65rem] leading-snug text-muted-foreground">
                      Only your first answer to each question is scored — re-opening one will not
                      change your score.
                    </p>
                  </div>

                  {(currentDpp.provenanceNote ?? currentDpp.provenance_note) ? (
                    <p className="text-xs text-primary/80 font-medium mb-4 flex items-center gap-1.5 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                      {currentDpp.provenanceNote ?? currentDpp.provenance_note}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-5 gap-2">
                    {currentQuestions.map((question, index) => {
                      // Colour from the graded record, so a question answered in
                      // an earlier session still reads as done after a reload.
                      const graded = answeredByQuestionId.get(question.id);
                      const sessionResult = checkResults[index];
                      const isCorrect =
                        graded?.isCorrect ??
                        Boolean(sessionResult?.isCorrect ?? sessionResult?.is_correct);
                      const done = Boolean(graded) || answers[index] !== null;
                      return (
                        <button
                          key={question.id}
                          onClick={() => goToQuestion(index)}
                          title={done ? `Question ${index + 1} — already answered` : `Question ${index + 1}`}
                          className={`w-10 h-10 rounded-lg font-medium text-sm transition-all ${
                            index === currentQuestionIndex ? 'ring-2 ring-primary ring-offset-2' : ''
                          } ${
                            done
                              ? isCorrect
                                ? 'bg-primary text-white'
                                : 'bg-red-500 text-white'
                              : 'neu-inset text-muted-foreground'
                          }`}
                        >
                          {index + 1}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-soft bg-gradient-to-br from-primary to-[#1E3A5F] text-white dark:ring-1 dark:ring-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <MessageCircle className="w-5 h-5" />
                    <h3 className="font-semibold">AI Mentor</h3>
                  </div>
                  <p className="text-white/80 text-sm">
                    Ori will pick up these weak topics automatically once you submit this DPP.
                  </p>
                </CardContent>
              </Card>

              <Card className="neu-raised border-0 shadow-none">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Focus Areas
                  </h3>
                  <div className="space-y-2">
                    {(currentDpp.weakTopics ?? currentDpp.weak_topics ?? []).map((topic) => (
                      <Badge
                        key={topic}
                        variant="secondary"
                        className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 mr-2 max-w-full truncate"
                      >
                        {topic}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                    These questions were generated to repair the weakest concepts from your recent test analytics.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DppSelectionGrid({
  dpps,
  onSelect,
}: {
  dpps: GeneratedDpp[];
  onSelect: (dppId: string) => void;
}) {
  const formatDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return DPP_DATE_FORMATTER.format(parsed);
  };

  // Student view filter: "General" = every DPP; "Institute" = only the ones
  // shared by their institute (teacher-origin).
  const [mode, setMode] = useState<'general' | 'institute'>('general');
  const teacherDppCount = dpps.filter(isTeacherDpp).length;
  const visibleDpps = mode === 'institute' ? dpps.filter(isTeacherDpp) : dpps;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {visibleDpps.length} DPP{visibleDpps.length === 1 ? '' : 's'} {mode === 'institute' ? 'from your institute' : 'ready for you'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'institute'
              ? 'Practice sets your institute shared with your batch. Pick one to start solving.'
              : teacherDppCount > 0
                ? `${teacherDppCount} shared by your institute, the rest from tests you submitted. Pick one to start solving.`
                : 'Each card comes from a test you submitted. Pick one to start solving.'}
          </p>
        </div>
        {/* General = all DPPs · Institute = only institute-shared ones. Hidden
            when the student has no institute DPPs (nothing to filter to). */}
        {teacherDppCount > 0 ? (
          <div className="inline-flex shrink-0 rounded-full neu-inset p-1 text-xs font-bold">
            {(['general', 'institute'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`rounded-full px-4 py-1.5 capitalize transition-colors ${
                  mode === m ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleDpps.map((dpp) => {
          const questionCount = dpp.questions?.length ?? dpp.targetQuestionCount ?? 0;
          const weakTopics = dpp.weakTopics ?? dpp.weak_topics ?? [];
          const generatedDate = formatDate(dpp.createdAt);
          const progressScore = dpp.latestAttempt?.progress_score ?? dpp.latestAttempt?.progressScore ?? null;
          const fromTeacher = isTeacherDpp(dpp);
          const teacherName = teacherNameOf(dpp);
          const daysLeft = daysLeftOf(dpp);

          return (
            <Card
              key={dpp.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(dpp.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(dpp.id);
                }
              }}
              className={`h-full min-w-0 max-w-full overflow-hidden cursor-pointer neu-raised neu-pressable shadow-none ${
                fromTeacher
                  ? 'border-2 border-primary/40 ring-2 ring-primary/10 bg-primary/[0.03] dark:bg-primary/[0.06]'
                  : 'border-0'
              }`}
            >
              {fromTeacher && teacherName ? (
                <div className="flex items-center justify-between gap-2 px-4 sm:px-6 pt-4 pb-3 border-b border-primary/15 min-w-0">
                  <InstituteLockup name={teacherName} logoUrl={teacherLogoOf(dpp)} className="text-sm" />
                  <Badge className="shrink-0 bg-primary text-white dark:text-white">
                    <GraduationCap className="w-3 h-3 mr-1" />
                    From your institute
                  </Badge>
                </div>
              ) : null}
              <CardContent className="p-4 sm:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {DPP_SUBJECT_ORI[dpp.subject] && (
                          <img
                            src={DPP_SUBJECT_ORI[dpp.subject]}
                            alt={dpp.subject}
                            draggable={false}
                            className="w-8 h-8 object-contain select-none flex-shrink-0"
                          />
                        )}
                        <Badge variant="secondary" className="capitalize">
                          {dpp.subject}
                        </Badge>
                        {dpp.completed ? (
                          <Badge className="bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge className="bg-primary/10 text-primary">
                            <Sparkles className="w-3 h-3 mr-1" />
                            New
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white leading-snug break-words">
                        {dpp.title}
                      </h3>
                      {dpp.summary ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                          {dpp.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 w-full min-w-0">
                    {weakTopics.slice(0, 3).map((topic) => (
                      <Badge
                        key={topic}
                        variant="secondary"
                        title={topic}
                        className="block sm:inline-block max-w-full min-w-0 truncate bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      >
                        {topic}
                      </Badge>
                    ))}
                    {weakTopics.length > 3 ? (
                      <span className="text-xs text-slate-400 self-center">+{weakTopics.length - 3} more</span>
                    ) : null}
                  </div>

                  <div className="flex items-center justify-between flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-4">
                      <span className="inline-flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {questionCount} Qs
                      </span>
                      {dpp.duration ? (
                        <span>{dpp.duration} min</span>
                      ) : null}
                      {fromTeacher ? (
                        daysLeft !== null ? (
                          <span className={daysLeft <= 3 ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>
                            {daysLeft === 0
                              ? 'Ends today'
                              : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}
                          </span>
                        ) : null
                      ) : generatedDate ? (
                        <span>Generated {generatedDate}</span>
                      ) : null}
                    </div>
                    {progressScore !== null ? (
                      <span className="text-primary font-semibold">{Math.round(progressScore)}%</span>
                    ) : null}
                  </div>

                  <div className="pt-2">
                    <Button asChild className="w-full rounded-full bg-gradient-to-r from-primary to-[#1E3A5F] text-white">
                      <span>
                      {dpp.completed ? 'Review DPP' : 'Start Solving'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                      </span>
                    </Button>
                  </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
