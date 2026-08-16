'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search,
  Clock,
  HelpCircle,
  BarChart3,
  ChevronLeft,
  Play,
  RotateCcw,
  Lock,
  CheckCircle2,
  Flame,
  BookOpen,
  Atom,
  Calculator,
  Plus,
  Loader2,
  Sparkles,
  ArrowRight,
  ChevronDown,
  Check,
  Info
} from 'lucide-react';
import type { Test, TestPreview, User } from '@/types';
import { cn } from '@/lib/utils';
import { apiCall } from '@/lib/api';
import { createCustomTestAction, createFullLengthTestAction } from '@/server/actions/test-actions';
import ExamPresetCards, { type ExamPresetCard } from '@/components/test/ExamPresetCards';
import type { ExamPresetId } from '@/lib/exam-blueprints';
import { useAuth } from '@/context/AuthContext';
import { studyModeSubjects } from '@/lib/study-mode';
import { ALL_SUBJECTS, normalizeSubject } from '@/lib/entitlements';
import {
  resolveEqualCounts,
  computeDurationMinutes,
  computeMaxScore,
  totalQuestions,
  biologyIsDoubled,
  examMode,
  examUnlocked,
  hmsToMinutes,
  clampHms,
  formatHms,
  BUILDER_EXAMS,
  EXAM_SUBJECTS,
  EXAM_LABELS,
  DEFAULT_SECONDS_PER_QUESTION,
  MIN_QUESTIONS_PER_SUBJECT,
  MAX_QUESTIONS_PER_SUBJECT,
  MIN_SECONDS_PER_QUESTION,
  MAX_SECONDS_PER_QUESTION,
  type SubjectCounts,
  type BuilderExam,
  type Hms,
} from '@/lib/subject-test-plan';

const CLASS_OPTIONS = [11, 12] as const;
/** All four subjects; the builder shows every one and locks the non-owned. */
const SUBJECT_OPTIONS = [
  { value: 'physics', label: 'Physics' },
  { value: 'chemistry', label: 'Chemistry' },
  { value: 'mathematics', label: 'Mathematics' },
  { value: 'biology', label: 'Biology' },
] as const;
const SUBJECT_LABELS: Record<string, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  mathematics: 'Mathematics',
  biology: 'Biology',
};
/** Quick-pick presets for the base question count (free input still allowed). */
const QUICK_COUNTS = [10, 20, 30, 40, 50] as const;
/** Quick-pick presets for the per-question timer, in seconds. */
const QUICK_SECONDS = [60, 120, 180, 300] as const;
/** Hide the native number-input spinner arrows (they overlap the suffix label). */
const NO_SPINNER = '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0';
const clampCount = (n: number) => Math.max(MIN_QUESTIONS_PER_SUBJECT, Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.trunc(Number(n) || 0)));

/**
 * Multi-select toggle chips for the small fixed sets (class / exam / subject).
 * An empty selection means "any / all" — the emptyLabel hints that.
 */
function ChipMultiSelect<T extends string | number>({
  options,
  selected,
  onToggle,
  emptyLabel,
}: {
  options: readonly { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  emptyLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`h-11 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
              active
                ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                : 'bg-background border-border/40 text-foreground hover:border-primary/40'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
      {selected.length === 0 && (
        <span className="self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{emptyLabel}</span>
      )}
    </div>
  );
}

interface TestListProps {
  onStartTest: (test: TestPreview) => void;
  onViewAnalysis: (test: TestPreview) => void;
  onBack: () => void;
  user?: User | null;
  /** Pre-loaded by the Server Component — skips the initial client-side fetch */
  initialTests?: TestPreview[];
  /**
   * Full-length exam presets, already resolved against the student's
   * entitlements on the server. Empty/absent hides the surface entirely (which
   * is also what the feature flag being off produces).
   */
  examPresets?: ExamPresetCard[];
  /**
   * Subjects the student is entitled to (server-resolved). The Custom Test
   * Builder shows all four subjects and locks the ones NOT in this set behind a
   * "Subscribe to unlock" prompt. Absent → treat everything as unlocked (the
   * premium gate being off yields ALL_SUBJECTS server-side anyway).
   */
  ownedSubjects?: string[];
}

function toTestPreview(test: Test | TestPreview): TestPreview {
  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    chapter: test.chapter,
    difficulty: test.difficulty,
    duration: test.duration,
    totalQuestions: test.totalQuestions,
    isPremium: test.isPremium,
    isCustom: test.isCustom,
    attempted: test.attempted,
    score: test.score,
    attemptCount: test.attemptCount,
    allScores: test.allScores,
  };
}

export default function TestList({ onStartTest, onViewAnalysis, onBack, user, initialTests, examPresets, ownedSubjects }: TestListProps) {
  const { studyMode } = useAuth();
  const router = useRouter();
  const [tests, setTests] = useState<TestPreview[]>(initialTests ?? []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [loading, setLoading] = useState(!initialTests);

  // Subjects the student may build from. Locked (non-owned) subjects render a
  // "Subscribe to unlock" prompt instead of a count input.
  const ownedSet = useMemo(
    () => new Set((ownedSubjects ?? ALL_SUBJECTS).map((s) => normalizeSubject(s)).filter(Boolean) as string[]),
    [ownedSubjects],
  );

  const [customTestConfig, setCustomTestConfig] = useState({
    // Multi-select: empty array = "any" (class/exam) or "all/mixed" (subjects).
    classLevels: [] as number[],
    exams: [] as string[],
    subjects: [] as string[],
    chapters: [] as string[],
    // Exam preset chip (JEE/NEET) — drives the subject set + ratio + questions filter.
    exam: null as BuilderExam | null,
    // Subject-wise question load.
    sameForAll: true,
    baseCount: 10,
    perSubjectCounts: {} as Record<string, number>,
    // Time: either a per-question timer OR a fixed total exam time (hh:mm:ss).
    timeMode: 'perQuestion' as 'perQuestion' | 'total',
    secondsPerQuestion: DEFAULT_SECONDS_PER_QUESTION,
    totalTime: { h: 0, m: 30, s: 0 } as Hms,
  });
  // OGCode-style multi-select chapter picker.
  const [chapterDropdownOpen, setChapterDropdownOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState('');
  const [creatingTest, setCreatingTest] = useState(false);
  const [customTestError, setCustomTestError] = useState('');
  // "How it works" explainer dialog for the Custom Test Builder.
  const [infoOpen, setInfoOpen] = useState(false);

  // Only selected subjects the student actually owns count toward the test — a
  // locked subject can't be selected, but guard here too (source of truth).
  const activeSubjects = useMemo(
    () => customTestConfig.subjects.filter((s) => ownedSet.has(normalizeSubject(s) ?? '')),
    [customTestConfig.subjects, ownedSet],
  );

  // The mode driving the double-Biology ratio: the selected exam chip when one
  // is active, else the student's study mode (so behaviour is unchanged when no
  // exam is picked).
  const effectiveMode = customTestConfig.exam ? examMode(customTestConfig.exam) : studyMode;

  // Resolve the configured load into a concrete { subject → count } map. "Same
  // for all" expands one base number (Biology doubled on NEET); otherwise each
  // subject carries its own entered count (falling back to the base).
  const resolvedCounts: SubjectCounts = useMemo(() => {
    if (!activeSubjects.length) return {};
    if (customTestConfig.sameForAll) {
      return resolveEqualCounts(activeSubjects, customTestConfig.baseCount, effectiveMode);
    }
    const out: SubjectCounts = {};
    for (const raw of activeSubjects) {
      const subject = normalizeSubject(raw);
      if (!subject) continue;
      const n = customTestConfig.perSubjectCounts[subject] ?? customTestConfig.baseCount;
      const clamped = Math.max(MIN_QUESTIONS_PER_SUBJECT, Math.min(MAX_QUESTIONS_PER_SUBJECT, Math.trunc(Number(n) || 0)));
      out[subject] = clamped;
    }
    return out;
  }, [activeSubjects, customTestConfig.sameForAll, customTestConfig.baseCount, customTestConfig.perSubjectCounts, effectiveMode]);

  const totalQ = totalQuestions(resolvedCounts);
  // Total duration: fixed total-exam-time (its own minutes) or per-question × Q.
  const durationMin = customTestConfig.timeMode === 'total'
    ? hmsToMinutes(customTestConfig.totalTime)
    : computeDurationMinutes(resolvedCounts, customTestConfig.secondsPerQuestion);
  const maxScore = computeMaxScore(resolvedCounts);
  const doubleBio = biologyIsDoubled(effectiveMode);

  // Chapters are the only dynamically-faceted filter here (class/exam are a
  // small fixed set; subject is the existing fixed 4+mixed enum) — narrowed by
  // whatever class/exam/subject is currently picked, same /assessments/ogcode/facets
  // endpoint and cascade pattern OGCodeList.tsx already uses. A request-sequence
  // guard drops a stale response if the filters change again before it resolves.
  const [facetChapters, setFacetChapters] = useState<string[]>([]);
  const [facetChaptersLoading, setFacetChaptersLoading] = useState(false);
  const chapterFacetReq = useRef(0);

  useEffect(() => {
    const req = ++chapterFacetReq.current;
    setFacetChaptersLoading(true);
    const qs = new URLSearchParams();
    qs.set('level', 'chapter');
    customTestConfig.classLevels.forEach((c) => qs.append('classes', String(c)));
    if (customTestConfig.exam) qs.append('occurrences', customTestConfig.exam);
    customTestConfig.subjects.forEach((s) => qs.append('subjects', s));

    apiCall(`/assessments/ogcode/facets?${qs.toString()}`)
      .then((data) => {
        if (req !== chapterFacetReq.current) return;
        const values = Array.isArray(data) ? (data as string[]) : [];
        setFacetChapters(values);
        setCustomTestConfig((prev) => {
          const pruned = prev.chapters.filter((c) => values.includes(c));
          return pruned.length === prev.chapters.length ? prev : { ...prev, chapters: pruned };
        });
      })
      .catch(() => {
        if (req === chapterFacetReq.current) setFacetChapters([]);
      })
      .finally(() => {
        if (req === chapterFacetReq.current) setFacetChaptersLoading(false);
      });
  }, [
    customTestConfig.classLevels.join(','),
    customTestConfig.exam,
    customTestConfig.subjects.join(','),
  ]);

  const handleCreateCustomTest = async () => {
    if (!activeSubjects.length) {
      setCustomTestError('Pick at least one subject you have access to.');
      return;
    }
    if (totalQ <= 0) {
      setCustomTestError('Set at least one question per subject.');
      return;
    }
    setCreatingTest(true);
    setCustomTestError('');
    try {
      const response = (await createCustomTestAction({
        // Only owned subjects are sent; the server re-checks entitlement.
        subjects: activeSubjects,
        // No user-facing difficulty filter anymore — "all" maps to no
        // difficulty constraint server-side (the request default would
        // otherwise silently narrow to "medium" if this were omitted).
        difficulty: 'all',
        chapters: customTestConfig.chapters.length ? customTestConfig.chapters : undefined,
        class_levels: customTestConfig.classLevels.length ? customTestConfig.classLevels : undefined,
        // Exam family from the selected exam chip (drives the question filter).
        exams: customTestConfig.exam ? [customTestConfig.exam] : undefined,
        // Subject-wise load supersedes the single total server-side.
        subject_question_counts: resolvedCounts as Record<string, number>,
        // Time: a fixed total exam time (duration override) OR a per-question timer.
        ...(customTestConfig.timeMode === 'total'
          ? { duration_minutes: hmsToMinutes(customTestConfig.totalTime) }
          : { seconds_per_question: customTestConfig.secondsPerQuestion }),
      })) as Test;
      // Add the new test to the top of the list and mark as custom
      const newTest: TestPreview = { ...toTestPreview(response), isCustom: true, origin: 'custom', isPyq: false, examType: null };
      setTests((prev) => [newTest, ...prev]);
      // Auto-start the test after creating it
      onStartTest(newTest);
    } catch (error: any) {
      setCustomTestError(error.message || 'Failed to create custom test. Try making it broader.');
    } finally {
      setCreatingTest(false);
    }
  };

  // Tapping an exam chip presets the subjects + ratio for that exam (still fully
  // editable afterward). Tapping the active one clears the preset. Only the
  // exam's owned subjects are pre-selected; NEET drives the double-Biology ratio.
  const selectExam = (exam: BuilderExam) => {
    setCustomTestConfig((prev) => {
      if (prev.exam === exam) {
        return { ...prev, exam: null };
      }
      const presetSubjects = EXAM_SUBJECTS[exam].filter((s) => ownedSet.has(s));
      return {
        ...prev,
        exam,
        subjects: presetSubjects,
        chapters: [],
        sameForAll: true,
        perSubjectCounts: {},
      };
    });
  };

  /**
   * Generates a full-length mock and starts it immediately, the same way the
   * free-form builder behaves. Errors propagate to ExamPresetCards, which shows
   * the server's message (e.g. the entitlement refusal from D2) rather than a
   * generic failure.
   */
  const handleGenerateFullLength = async (preset: ExamPresetId) => {
    const response = (await createFullLengthTestAction(preset)) as Test;
    const newTest: TestPreview = {
      ...toTestPreview(response),
      isCustom: true,
      origin: 'custom',
      isPyq: false,
      examType: null,
    };
    setTests((prev) => [newTest, ...prev]);
    onStartTest(newTest);
  };

  useEffect(() => {
    if (initialTests) return; // SSR already provided the data — skip client fetch
    const fetchTests = async () => {
      try {
        const data = await apiCall('/assessments/tests/');
        setTests(Array.isArray(data) ? (data as TestPreview[]) : []);
      } catch (error) {
        console.error('Failed to fetch tests:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTests();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredTests = useMemo(() => tests.filter((test) => {
    const matchesSearch = test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === 'all' || test.subject === selectedSubject;
    const matchesDifficulty = selectedDifficulty === 'all' || test.difficulty === selectedDifficulty;
    return matchesSearch && matchesSubject && matchesDifficulty;
  }), [tests, searchQuery, selectedSubject, selectedDifficulty]);

  const standardTests = useMemo(
    () => filteredTests.filter(t => !t.isCustom && !(t as any).is_custom && !t.id.startsWith('custom_')),
    [filteredTests],
  );
  const customTests = useMemo(
    () => filteredTests.filter(t => t.isCustom || (t as any).is_custom || t.id.startsWith('custom_')),
    [filteredTests],
  );

  const getSubjectIcon = (subject: string) => {
    switch (subject) {
      case 'physics':
        return <Atom className="w-5 h-5" />;
      case 'chemistry':
        return <Flame className="w-5 h-5" />;
      case 'mathematics':
        return <Calculator className="w-5 h-5" />;
      case 'biology':
        return <BookOpen className="w-5 h-5" />;
      default:
        return <BookOpen className="w-5 h-5" />;
    }
  };
  
  const getSubjectColor = (subject: string) => {
    switch (subject) {
      case 'physics':
        return 'bg-primary/10 text-primary';
      case 'chemistry':
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400';
      case 'mathematics':
        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400';
      case 'biology':
        return 'bg-primary/20 text-primary';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-400';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-500/20';
      case 'medium':
        return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-500/20';
      case 'hard':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div id="tutorial-test-hub" className="min-h-screen neu-surface text-foreground transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-foreground">Test Series</h1>
                <p className="text-sm text-muted-foreground">Choose a test to begin</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-sm font-bold truncate max-w-[60px] sm:max-w-none">{user?.streak || 0}d streak</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-10">

        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading tests...</div>
        ) : (
          <>
            {/* Filters moved to tab */}


            {/* Tabs */}
            <Tabs defaultValue="build" className="mb-12">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 border-b border-border/40 pb-6">
                <TabsList className="bg-transparent p-0 flex flex-wrap gap-1 sm:gap-2 h-auto justify-start">
                  {(['all', 'recommended', 'attempted', 'gallery', 'build', 'pyq', 'search'] as const).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="h-auto flex-none px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-primary/20 text-muted-foreground hover:text-foreground"
                    >
                      {tab === 'all' ? 'Institute' : 
                       tab === 'recommended' ? 'Daily' : 
                       tab === 'pyq' ? 'PYQ Tests' :
                       tab === 'attempted' ? 'Performance' : 
                       tab === 'gallery' ? 'My Tests' : 
                       tab === 'build' ? 'Build' : 'Search'}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="px-3 py-1 rounded-full border-primary/20 bg-primary/5 text-primary font-bold text-[10px] uppercase tracking-widest">
                    {tests.length} Total Tests
                  </Badge>
                </div>
              </div>

              {/* All Tests (Standard Only) */}
              <TabsContent value="all" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {standardTests.map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                  {standardTests.length === 0 && (
                    <div className="col-span-full py-20 text-center">
                      <img src="/ori2d/ori-confused.png" alt="Ori" className="w-28 h-28 object-contain mx-auto mb-4 drop-shadow-md" />
                      <p className="text-base font-black text-foreground">No institute tests yet</p>
                      <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-muted-foreground">
                        Ask your institute to add you, or enter the join code they shared to see their tests here.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Daily Recommendations */}
              <TabsContent value="recommended" className="mt-0 outline-none">
                <div className="mb-8 p-6 rounded-[32px] bg-primary text-white relative overflow-hidden shadow-xl shadow-primary/20">
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tighter mb-1">Personalized Intelligence</h2>
                      <p className="text-xs font-bold opacity-80 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Tests curated for your primary subjects
                      </p>
                    </div>
                    {user?.subjects && user.subjects.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {user.subjects.map(sub => (
                          <Badge key={sub} className="bg-white/20 hover:bg-white/30 text-white border-0 font-bold uppercase text-[10px]">
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {standardTests
                    .filter(t => !t.attempted)
                    .filter(t => {
                      if (user?.subjects && user.subjects.length > 0) {
                        return user.subjects.some(sub =>
                          t.subject.toLowerCase() === sub.toLowerCase() || t.subject === 'mixed'
                        );
                      }
                      return true;
                    })
                    .map((test) => (
                      <TestCard
                        key={test.id}
                        test={test}
                        onStart={() => onStartTest(test)}
                        onViewAnalysis={() => onViewAnalysis(test)}
                        user={user}
                        getSubjectIcon={getSubjectIcon}
                        getSubjectColor={getSubjectColor}
                        getDifficultyColor={getDifficultyColor}
                      />
                    ))}
                </div>
              </TabsContent>

              <TabsContent value="pyq" className="mt-0 outline-none">
                <Tabs defaultValue="jee-main" className="w-full">
                  <div className="flex justify-center mb-8">
                    <TabsList className="bg-muted/50 p-1 rounded-2xl">
                      <TabsTrigger value="jee-main" className="rounded-xl px-6 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">JEE Main</TabsTrigger>
                      <TabsTrigger value="jee-advanced" className="rounded-xl px-6 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">JEE Advanced</TabsTrigger>
                      <TabsTrigger value="neet" className="rounded-xl px-6 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">NEET</TabsTrigger>
                    </TabsList>
                  </div>

                  {(['jee-main', 'jee-advanced', 'neet'] as const).map(exam => {
                    // Filter on the server-derived classification (Phase 4) rather
                    // than re-matching title strings in the client.
                    const examTests = standardTests.filter(t => t.isPyq && t.examType === exam);
                    
                    return (
                      <TabsContent key={exam} value={exam} className="mt-0 outline-none">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {examTests.map((test) => (
                            <TestCard
                              key={test.id}
                              test={test}
                              onStart={() => onStartTest(test)}
                              onViewAnalysis={() => onViewAnalysis(test)}
                              user={user}
                              getSubjectIcon={getSubjectIcon}
                              getSubjectColor={getSubjectColor}
                              getDifficultyColor={getDifficultyColor}
                            />
                          ))}
                          {examTests.length === 0 && (
                            <div className="col-span-full py-20 text-center border-2 border-dashed border-border/40 rounded-[40px] bg-muted/30">
                              <img src="/ori2d/ori-curious.png" alt="Ori" className="w-28 h-28 object-contain mx-auto mb-3 drop-shadow-md" />
                              <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4 opacity-50" />
                              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No PYQ tests available for this category</p>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    )
                  })}
                </Tabs>
              </TabsContent>

              <TabsContent value="attempted" className="mt-0 outline-none">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredTests.filter(t => t.attempted).map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                  {filteredTests.filter(t => t.attempted).length === 0 && (
                    <div className="col-span-full py-24 text-center border-2 border-dashed border-border/40 rounded-[40px] bg-muted/30">
                      <img src="/ori2d/ori-determined.png" alt="Ori" className="w-28 h-28 object-contain mx-auto mb-3 drop-shadow-md" />
                      <div className="w-16 h-16 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <BarChart3 className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No Attempt History</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Custom Gallery (Gallery) */}
              <TabsContent value="gallery" className="mt-0 outline-none">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {customTests.map((test) => (
                    <TestCard
                      key={test.id}
                      test={test}
                      onStart={() => onStartTest(test)}
                      onViewAnalysis={() => onViewAnalysis(test)}
                      user={user}
                      getSubjectIcon={getSubjectIcon}
                      getSubjectColor={getSubjectColor}
                      getDifficultyColor={getDifficultyColor}
                    />
                  ))}
                  {customTests.length === 0 && !creatingTest && (
                    <Card 
                      onClick={() => {}} // Tab switch logic handled by defaultValue or programmatic change would be better
                      className="col-span-full border-2 border-dashed border-border/40 bg-muted/30 rounded-[40px] flex flex-col items-center justify-center p-8 sm:p-20 text-center"
                    >
                      <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                        <Plus className="w-10 h-10" />
                      </div>
                      <h3 className="text-2xl font-black text-foreground mb-2 uppercase tracking-tighter">Generator Empty</h3>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-8">No custom tests found in your gallery.</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              {/* Build Lab (The Creator UI) */}
              <TabsContent value="build" className="mt-0 outline-none">
                <div className="max-w-4xl mx-auto">
                    {examPresets && examPresets.length > 0 && (
                      <ExamPresetCards presets={examPresets} onGenerate={handleGenerateFullLength} />
                    )}
                    <Card className="neu-raised border-0 shadow-none rounded-[40px] overflow-hidden">
                        <div className="p-6 sm:p-10 border-b border-border/40 bg-primary text-white relative">
                            <div className="relative z-10 flex items-start justify-between gap-3">
                                <div>
                                    <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter mb-2">Custom Test Builder</h2>
                                    <p className="text-[10px] sm:text-xs font-bold opacity-80 uppercase tracking-widest">Build your own practice set</p>
                                </div>
                                {/* How-it-works explainer. */}
                                <button
                                    type="button"
                                    onClick={() => setInfoOpen(true)}
                                    aria-label="How the Custom Test Builder works"
                                    title="How it works"
                                    className="shrink-0 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center transition-colors"
                                >
                                    <Info className="w-5 h-5" />
                                </button>
                            </div>
                            <Plus className="absolute top-6 right-20 sm:top-10 sm:right-24 w-12 h-12 sm:w-20 sm:h-20 opacity-10 pointer-events-none" />
                        </div>
                        <div className="p-6 sm:p-10 space-y-6 sm:space-y-10">
                            {/* Exam quick-preset: sets the subjects + ratio for JEE/NEET.
                                Locked unless the student owns all that exam's subjects. */}
                            <div className="space-y-4">
                                <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Exam</Label>
                                <div className="flex flex-wrap gap-2">
                                    {BUILDER_EXAMS.map((ex) => {
                                        const unlocked = examUnlocked(ex, ownedSet);
                                        const active = customTestConfig.exam === ex;
                                        if (!unlocked) {
                                            const missing = EXAM_SUBJECTS[ex].filter((s) => !ownedSet.has(s));
                                            return (
                                                <button
                                                    key={ex}
                                                    type="button"
                                                    onClick={() => router.push(`/premium?subject=${missing[0] ?? ''}`)}
                                                    title={`Unlock ${missing.map((m) => SUBJECT_LABELS[m] ?? m).join(', ')} to use ${EXAM_LABELS[ex]}`}
                                                    className="h-11 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all border bg-muted/40 border-amber-500/30 text-muted-foreground hover:border-amber-500/60 inline-flex items-center gap-1.5"
                                                >
                                                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                                                    {EXAM_LABELS[ex]}
                                                </button>
                                            );
                                        }
                                        return (
                                            <button
                                                key={ex}
                                                type="button"
                                                onClick={() => selectExam(ex)}
                                                className={`h-11 px-5 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                                                    active
                                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                                        : 'bg-background border-border/40 text-foreground hover:border-primary/40'
                                                }`}
                                            >
                                                {EXAM_LABELS[ex]}
                                            </button>
                                        );
                                    })}
                                    <span className="self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                        {customTestConfig.exam ? 'Presets subjects & ratio · editable below' : 'Optional — or configure manually'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Class</Label>
                                    <ChipMultiSelect
                                        options={CLASS_OPTIONS.map((c) => ({ value: c, label: `Class ${c}` }))}
                                        selected={customTestConfig.classLevels}
                                        emptyLabel="All classes (mixed)"
                                        onToggle={(c) => setCustomTestConfig((prev) => ({
                                            ...prev,
                                            classLevels: prev.classLevels.includes(c) ? prev.classLevels.filter((x) => x !== c) : [...prev.classLevels, c],
                                        }))}
                                    />
                                </div>
                                {/* Exam picker removed — Study Mode now carries that
                                    intent, so asking again here was redundant and could
                                    contradict it. `exams` stays in the payload type and
                                    is simply sent empty (= all exams). */}
                                <div className="space-y-4">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Domain Calibration</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {SUBJECT_OPTIONS.map((opt) => {
                                            const canonical = normalizeSubject(opt.value) ?? opt.value;
                                            const owned = ownedSet.has(canonical);
                                            const active = customTestConfig.subjects.includes(opt.value);
                                            if (!owned) {
                                                // Locked: route to per-subject checkout instead of toggling.
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => router.push(`/premium?subject=${canonical}`)}
                                                        title={`Subscribe to unlock ${opt.label}`}
                                                        className="h-11 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all border bg-muted/40 border-amber-500/30 text-muted-foreground hover:border-amber-500/60 inline-flex items-center gap-1.5"
                                                    >
                                                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                                                        {opt.label}
                                                    </button>
                                                );
                                            }
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setCustomTestConfig((prev) => ({
                                                        ...prev,
                                                        subjects: prev.subjects.includes(opt.value)
                                                            ? prev.subjects.filter((x) => x !== opt.value)
                                                            : [...prev.subjects, opt.value],
                                                        // Hand-editing subjects clears the exam preset (it no longer
                                                        // matches that exam's fixed subject set).
                                                        exam: null,
                                                        // Changing subjects invalidates the chapter selection.
                                                        chapters: [],
                                                    }))}
                                                    className={`h-11 px-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all border ${
                                                        active
                                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                                            : 'bg-background border-border/40 text-foreground hover:border-primary/40'
                                                    }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                        {customTestConfig.subjects.length === 0 && (
                                            <span className="self-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pick one or more subjects</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4 relative">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Chapter (Optional)</Label>
                                    <button
                                        type="button"
                                        disabled={customTestConfig.subjects.length === 0 || facetChaptersLoading}
                                        onClick={() => { setChapterDropdownOpen((o) => !o); setChapterSearch(''); }}
                                        className="w-full h-14 px-5 flex items-center justify-between gap-2 rounded-2xl bg-background border border-border/40 text-foreground font-black text-sm outline-none focus:border-rose-500 transition-all disabled:opacity-50 text-left"
                                    >
                                        <span className="truncate">
                                            {customTestConfig.subjects.length === 0
                                                ? 'Pick a subject first'
                                                : facetChaptersLoading
                                                ? 'Loading chapters…'
                                                : customTestConfig.chapters.length === 0
                                                ? 'Any Chapter'
                                                : `${customTestConfig.chapters.length} chapter${customTestConfig.chapters.length === 1 ? '' : 's'} selected`}
                                        </span>
                                        <ChevronDown className={cn('w-4 h-4 shrink-0 transition-transform', chapterDropdownOpen && 'rotate-180')} />
                                    </button>
                                    {chapterDropdownOpen && customTestConfig.subjects.length > 0 && (
                                      <>
                                        {/* click-away backdrop */}
                                        <div className="fixed inset-0 z-40" onClick={() => setChapterDropdownOpen(false)} />
                                        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[420px] flex flex-col rounded-2xl border border-border/40 bg-background shadow-xl overflow-hidden">
                                            <div className="p-2 border-b border-border/40 shrink-0">
                                                <input
                                                    type="text"
                                                    placeholder="Search chapters…"
                                                    value={chapterSearch}
                                                    onChange={(e) => setChapterSearch(e.target.value)}
                                                    className="w-full bg-muted/40 border border-border/40 rounded-lg px-3 py-2 text-xs outline-none focus:border-primary/50"
                                                />
                                            </div>
                                            <div className="overflow-y-auto p-2 flex-1 space-y-1">
                                                {(() => {
                                                    const filtered = facetChapters.filter((ch) => ch.toLowerCase().includes(chapterSearch.toLowerCase()));
                                                    if (filtered.length === 0) {
                                                        return <div className="p-3 text-center text-[11px] italic text-muted-foreground">No chapters found</div>;
                                                    }
                                                    const allSelected = filtered.every((ch) => customTestConfig.chapters.includes(ch));
                                                    return (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => setCustomTestConfig((prev) => ({
                                                                    ...prev,
                                                                    chapters: allSelected
                                                                        ? prev.chapters.filter((c) => !filtered.includes(c))
                                                                        : [...new Set([...prev.chapters, ...filtered])],
                                                                }))}
                                                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-black text-primary hover:bg-primary/5 border-b border-border/20 mb-1 text-left"
                                                            >
                                                                <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', allSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                    {allSelected && <Check className="w-3 h-3 text-white" />}
                                                                </span>
                                                                Select All
                                                            </button>
                                                            {filtered.map((ch) => {
                                                                const active = customTestConfig.chapters.includes(ch);
                                                                return (
                                                                    <button
                                                                        key={ch}
                                                                        type="button"
                                                                        onClick={() => setCustomTestConfig((prev) => ({
                                                                            ...prev,
                                                                            chapters: active ? prev.chapters.filter((c) => c !== ch) : [...prev.chapters, ch],
                                                                        }))}
                                                                        className={cn('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold text-left hover:bg-primary/5', active ? 'text-primary bg-primary/5' : 'text-foreground/80')}
                                                                    >
                                                                        <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', active ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                            {active && <Check className="w-3 h-3 text-white" />}
                                                                        </span>
                                                                        <span className="line-clamp-2 leading-tight">{ch}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                      </>
                                    )}
                                    {customTestConfig.chapters.length > 0 && (
                                        <p className="text-[10px] font-bold text-muted-foreground normal-case">
                                            Short on questions in {customTestConfig.chapters.length === 1 ? 'this chapter' : 'these chapters'}? We&apos;ll fill the rest from other chapters in the selected subject(s) automatically.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div className="flex items-center justify-between gap-3">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Question Load</Label>
                                    {/* Same-for-all toggle. */}
                                    <button
                                        type="button"
                                        onClick={() => setCustomTestConfig((prev) => ({ ...prev, sameForAll: !prev.sameForAll }))}
                                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-foreground/80"
                                    >
                                        <span className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0', customTestConfig.sameForAll ? 'bg-primary border-primary' : 'border-muted-foreground/40')}>
                                            {customTestConfig.sameForAll && <Check className="w-3 h-3 text-white" />}
                                        </span>
                                        Same questions in all subjects
                                    </button>
                                </div>

                                {activeSubjects.length === 0 ? (
                                    <p className="text-[11px] font-bold text-muted-foreground normal-case">Select at least one unlocked subject to set the question load.</p>
                                ) : customTestConfig.sameForAll ? (
                                    <div className="space-y-3">
                                        {/* Quick-pick presets. */}
                                        <div className="grid grid-cols-5 gap-2 sm:gap-3">
                                            {QUICK_COUNTS.map((count) => (
                                                <button
                                                    key={count}
                                                    type="button"
                                                    onClick={() => setCustomTestConfig((prev) => ({ ...prev, baseCount: count }))}
                                                    className={`h-12 rounded-xl font-black text-sm transition-all border ${
                                                        customTestConfig.baseCount === count
                                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                                            : 'bg-background border-border/40 text-foreground hover:border-primary/40'
                                                    }`}
                                                >
                                                    {count}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Custom value with external −/+ steppers (native spinner hidden so it
                                            no longer overlaps the "/ subject" label). */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setCustomTestConfig((prev) => ({ ...prev, baseCount: clampCount(prev.baseCount - 1) }))}
                                                className="h-12 w-12 shrink-0 rounded-xl border border-border/40 bg-background text-lg font-black text-foreground hover:border-primary/40"
                                                aria-label="Decrease"
                                            >−</button>
                                            <div className="relative flex-1 min-w-[8rem]">
                                                <Input
                                                    type="number"
                                                    min={MIN_QUESTIONS_PER_SUBJECT}
                                                    max={MAX_QUESTIONS_PER_SUBJECT}
                                                    value={customTestConfig.baseCount}
                                                    onChange={(e) => setCustomTestConfig((prev) => ({ ...prev, baseCount: clampCount(Number(e.target.value)) }))}
                                                    className={cn('h-12 rounded-xl bg-white dark:bg-white/5 border border-border/40 pl-4 pr-24 text-sm font-black', NO_SPINNER)}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground uppercase tracking-widest pointer-events-none">/ subject</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setCustomTestConfig((prev) => ({ ...prev, baseCount: clampCount(prev.baseCount + 1) }))}
                                                className="h-12 w-12 shrink-0 rounded-xl border border-border/40 bg-background text-lg font-black text-foreground hover:border-primary/40"
                                                aria-label="Increase"
                                            >+</button>
                                        </div>
                                        {doubleBio && activeSubjects.some((s) => normalizeSubject(s) === 'biology') && (
                                            <span className="block text-[10px] font-bold text-amber-600 dark:text-amber-400 normal-case">Biology gets 2× on NEET</span>
                                        )}
                                        {/* Preview of the resolved per-subject counts. */}
                                        <div className="flex flex-wrap gap-2">
                                            {activeSubjects.map((s) => {
                                                const canonical = normalizeSubject(s) ?? s;
                                                return (
                                                    <span key={s} className="px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] font-black text-foreground/80">
                                                        {SUBJECT_LABELS[canonical] ?? canonical} · {resolvedCounts[canonical as keyof SubjectCounts] ?? 0}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {activeSubjects.map((s) => {
                                            const canonical = normalizeSubject(s) ?? s;
                                            const val = customTestConfig.perSubjectCounts[canonical] ?? customTestConfig.baseCount;
                                            const setVal = (n: number) => setCustomTestConfig((prev) => ({
                                                ...prev,
                                                perSubjectCounts: { ...prev.perSubjectCounts, [canonical]: clampCount(n) },
                                            }));
                                            return (
                                                <div key={s} className="flex items-center justify-between gap-3">
                                                    <span className="text-xs font-black text-foreground/80">{SUBJECT_LABELS[canonical] ?? canonical}</span>
                                                    <div className="flex items-center gap-2">
                                                        <button type="button" onClick={() => setVal(val - 1)} className="h-11 w-11 shrink-0 rounded-xl border border-border/40 bg-background text-lg font-black hover:border-primary/40" aria-label={`Decrease ${canonical}`}>−</button>
                                                        <Input
                                                            type="number"
                                                            min={MIN_QUESTIONS_PER_SUBJECT}
                                                            max={MAX_QUESTIONS_PER_SUBJECT}
                                                            value={val}
                                                            onChange={(e) => setVal(Number(e.target.value))}
                                                            className={cn('h-11 w-20 rounded-xl bg-white dark:bg-white/5 border border-border/40 px-3 text-sm font-black text-center', NO_SPINNER)}
                                                        />
                                                        <button type="button" onClick={() => setVal(val + 1)} className="h-11 w-11 shrink-0 rounded-xl border border-border/40 bg-background text-lg font-black hover:border-primary/40" aria-label={`Increase ${canonical}`}>+</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Time: per-question timer OR a fixed total exam time. */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center gap-3">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Timing</Label>
                                    {/* Mode toggle. */}
                                    <div className="inline-flex rounded-xl border border-border/40 p-0.5 bg-background">
                                        {(['perQuestion', 'total'] as const).map((mode) => (
                                            <button
                                                key={mode}
                                                type="button"
                                                onClick={() => setCustomTestConfig((prev) => ({ ...prev, timeMode: mode }))}
                                                className={`h-9 px-3 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all ${
                                                    customTestConfig.timeMode === mode ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {mode === 'perQuestion' ? 'Per question' : 'Total time'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {customTestConfig.timeMode === 'perQuestion' ? (
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap gap-2">
                                            {QUICK_SECONDS.map((sec) => (
                                                <button
                                                    key={sec}
                                                    type="button"
                                                    onClick={() => setCustomTestConfig((prev) => ({ ...prev, secondsPerQuestion: sec }))}
                                                    className={`h-11 px-4 rounded-xl font-black text-xs transition-all border ${
                                                        customTestConfig.secondsPerQuestion === sec
                                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                                            : 'bg-background border-border/40 text-foreground hover:border-primary/40'
                                                    }`}
                                                >
                                                    {sec % 60 === 0 ? `${sec / 60} min` : `${sec}s`}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setCustomTestConfig((prev) => ({ ...prev, secondsPerQuestion: Math.max(MIN_SECONDS_PER_QUESTION, prev.secondsPerQuestion - 10) }))}
                                                className="h-12 w-12 shrink-0 rounded-xl border border-border/40 bg-background text-lg font-black hover:border-primary/40"
                                                aria-label="Decrease time"
                                            >−</button>
                                            <div className="relative flex-1 min-w-[8rem]">
                                                <Input
                                                    type="number"
                                                    min={MIN_SECONDS_PER_QUESTION}
                                                    max={MAX_SECONDS_PER_QUESTION}
                                                    step={10}
                                                    value={customTestConfig.secondsPerQuestion}
                                                    onChange={(e) => setCustomTestConfig((prev) => ({
                                                        ...prev,
                                                        secondsPerQuestion: Math.max(MIN_SECONDS_PER_QUESTION, Math.min(MAX_SECONDS_PER_QUESTION, Math.trunc(Number(e.target.value) || DEFAULT_SECONDS_PER_QUESTION))),
                                                    }))}
                                                    className={cn('h-12 rounded-xl bg-white dark:bg-white/5 border border-border/40 pl-4 pr-14 text-sm font-black', NO_SPINNER)}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground uppercase tracking-widest pointer-events-none">sec</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setCustomTestConfig((prev) => ({ ...prev, secondsPerQuestion: Math.min(MAX_SECONDS_PER_QUESTION, prev.secondsPerQuestion + 10) }))}
                                                className="h-12 w-12 shrink-0 rounded-xl border border-border/40 bg-background text-lg font-black hover:border-primary/40"
                                                aria-label="Increase time"
                                            >+</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {/* hh:mm:ss segmented input, cursor-editable. */}
                                        <div className="flex items-center gap-2">
                                            {(['h', 'm', 's'] as const).map((seg, i) => (
                                                <div key={seg} className="flex items-center gap-2">
                                                    {i > 0 && <span className="text-lg font-black text-muted-foreground">:</span>}
                                                    <div className="relative w-20">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={seg === 'h' ? 6 : 59}
                                                            value={customTestConfig.totalTime[seg]}
                                                            onChange={(e) => setCustomTestConfig((prev) => ({
                                                                ...prev,
                                                                totalTime: clampHms({ ...prev.totalTime, [seg]: Math.trunc(Number(e.target.value) || 0) }),
                                                            }))}
                                                            className={cn('h-12 rounded-xl bg-white dark:bg-white/5 border border-border/40 px-3 text-center text-base font-black', NO_SPINNER)}
                                                        />
                                                        <span className="block text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">{seg === 'h' ? 'hrs' : seg === 'm' ? 'min' : 'sec'}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-bold text-muted-foreground normal-case">Whole test runs for {formatHms(clampHms(customTestConfig.totalTime))} ({durationMin} min).</p>
                                    </div>
                                )}
                            </div>

                            {/* Live summary: total questions · duration · max score. */}
                            {activeSubjects.length > 0 && totalQ > 0 && (
                                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-1.5">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Total</span>
                                        <span className="text-sm font-black text-foreground">
                                            {totalQ} question{totalQ === 1 ? '' : 's'} · {durationMin} min · {maxScore} marks
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground normal-case text-right">+4 correct · −1 MCQ / −2 MSQ / 0 numerical (mostly MCQ)</p>
                                </div>
                            )}

                            {customTestError && (
                                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold text-center">
                                    {customTestError}
                                </div>
                            )}

                            <Button
                                onClick={handleCreateCustomTest}
                                disabled={creatingTest || activeSubjects.length === 0 || totalQ <= 0}
                                className="w-full h-16 rounded-3xl bg-primary text-white font-black text-lg uppercase tracking-tighter transition-all shadow-xl shadow-primary/20 disabled:opacity-50"
                            >
                                {creatingTest ? (
                                    <div className="flex items-center gap-3">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Generating Intelligence...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <Play className="w-5 h-5" />
                                        Start Test
                                    </div>
                                )}
                            </Button>
                        </div>
                    </Card>

                    {/* How-it-works explainer dialog. */}
                    <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
                        <DialogContent className="max-w-lg rounded-3xl">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                                    <Sparkles className="w-5 h-5 text-primary" />
                                    How your custom test is built
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    An explanation of how the Custom Test Builder generates each practice set.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 text-sm text-foreground/80 max-h-[60vh] overflow-y-auto pr-1">
                                <p className="font-bold text-foreground">Every time you tap <span className="text-primary">Start Test</span>, a fresh paper is assembled just for you from the live question bank — no two builds are identical.</p>
                                <ol className="space-y-3 list-none">
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">1</span>
                                        <span><span className="font-bold text-foreground">Pick an exam (optional).</span> Tapping <span className="font-bold">JEE</span> or <span className="font-bold">NEET</span> presets the right subjects and ratio — JEE is 1:1:1, NEET gives Biology double (2:1:1). You can still tweak everything afterwards.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">2</span>
                                        <span><span className="font-bold text-foreground">Set the counts.</span> Choose how many questions per subject. With <span className="font-bold">Same for all</span> on, one number applies to every subject (NEET still doubles Biology).</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">3</span>
                                        <span><span className="font-bold text-foreground">Choose the timing.</span> Either a <span className="font-bold">per-question</span> timer, or a fixed <span className="font-bold">total exam time</span> (hh:mm:ss). The total questions, total time and total score update live.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">4</span>
                                        <span><span className="font-bold text-foreground">Smart selection.</span> Questions match your filters, are biased toward your recent <span className="font-bold">weak topics</span>, and skip ones you&apos;ve already attempted. A thin chapter auto-tops-up from the same subject.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-black text-xs flex items-center justify-center">5</span>
                                        <span><span className="font-bold text-foreground">Grouped &amp; scored.</span> Questions are grouped subject-by-subject (like a real CBT section). Scoring follows the JEE/NEET scheme — <span className="font-bold">+4</span> correct, −1 (MCQ) / −2 (MSQ) / 0 (numerical) — so the max score is 4 × total questions.</span>
                                    </li>
                                </ol>
                                <p className="text-xs text-muted-foreground normal-case">Exams and subjects you haven&apos;t subscribed to appear locked — unlock them anytime from the chips above.</p>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
              </TabsContent>

              {/* Search Laboratory (Filters) */}
              <TabsContent value="search" className="mt-0 outline-none">
                <Card className="neu-raised border-0 shadow-none rounded-[2rem] sm:rounded-[40px] p-6 sm:p-10">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Query Input</Label>
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          placeholder="Search tests by title or description..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-14 h-14 rounded-2xl border-border/40 bg-background focus:border-rose-500/50 font-bold"
                        />
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Subject Filtering</Label>
                        <select
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          className="w-full h-14 px-5 rounded-2xl border border-border/40 bg-background font-bold outline-none focus:border-rose-500 transition-all"
                        >
                          <option value="all">All Subjects</option>
                          {/* Only the Study Mode's subjects — the server clamps too. */}
                          {studyModeSubjects(studyMode).map((subject) => (
                            <option key={subject} value={subject}>
                              {subject[0].toUpperCase() + subject.slice(1)}
                            </option>
                          ))}
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Complexity Selection</Label>
                        <select
                          value={selectedDifficulty}
                          onChange={(e) => setSelectedDifficulty(e.target.value)}
                          className="w-full h-14 px-5 rounded-2xl border border-border/40 bg-background font-bold outline-none focus:border-rose-500 transition-all"
                        >
                          <option value="all">All Levels</option>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-between items-center">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        Match Found: <span className="text-rose-600 dark:text-rose-400">{filteredTests.length} tests</span>
                      </p>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedSubject('all');
                          setSelectedDifficulty('all');
                        }}
                        className="rounded-xl text-xs font-black uppercase text-rose-500 hover:bg-rose-500/10"
                      >
                        Reset All Parameters
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Visual feedback of active filters */}
                {(searchQuery || selectedSubject !== 'all' || selectedDifficulty !== 'all') && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {searchQuery && <Badge variant="secondary">Search: {searchQuery}</Badge>}
                    {selectedSubject !== 'all' && <Badge variant="secondary">Subject: {selectedSubject}</Badge>}
                    {selectedDifficulty !== 'all' && <Badge variant="secondary">Level: {selectedDifficulty}</Badge>}
                  </div>
                )}

                {filteredTests.length > 0 ? (
                  <div className="mt-12">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mb-8 flex items-center gap-4">
                      Query Results
                      <div className="flex-1 h-px bg-border/40" />
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTests.map((test) => (
                        <TestCard
                          key={test.id}
                          test={test}
                          onStart={() => onStartTest(test)}
                          onViewAnalysis={() => onViewAnalysis(test)}
                          user={user}
                          getSubjectIcon={getSubjectIcon}
                          getSubjectColor={getSubjectColor}
                          getDifficultyColor={getDifficultyColor}
                        />
                      ))}
                    </div>
                  </div>
                ) : (searchQuery || selectedSubject !== 'all' || selectedDifficulty !== 'all') ? (
                  <div className="mt-12 py-20 text-center border-2 border-dashed border-border/40 rounded-[40px] bg-muted/30">
                    <img src="/ori2d/ori-confused.png" alt="Ori" className="w-24 h-24 object-contain mx-auto mb-3 drop-shadow-md" />
                    <p className="text-sm font-black text-muted-foreground uppercase tracking-widest">No tests match your filters</p>
                  </div>
                ) : null}
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
}

interface TestCardProps {
  test: TestPreview;
  onStart: () => void;
  onViewAnalysis: () => void;
  user?: User | null;
  getSubjectIcon: (subject: string) => React.ReactNode;
  getSubjectColor: (subject: string) => string;
  getDifficultyColor: (difficulty: string) => string;
}

function TestCard({ test, onStart, onViewAnalysis, user, getDifficultyColor }: TestCardProps) {
  const isLocked = false;

  return (
    <Card className={`group relative flex flex-col border-0 neu-raised neu-pressable transition-all duration-300 overflow-hidden ${isLocked ? 'grayscale opacity-80' : ''}`}>
      <CardContent className="flex flex-1 flex-col p-5">
        {/* Title + description */}
        <h3 className="text-base sm:text-lg font-black text-foreground leading-tight tracking-tight transition-colors group-hover:text-primary line-clamp-2">
          {test.title}
        </h3>
        <p className="mt-1.5 text-xs font-medium text-muted-foreground line-clamp-2 leading-relaxed">
          {test.description}
        </p>

        {/* Inline meta stats — difficulty + status sit alongside to save vertical space */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <HelpCircle className="w-3.5 h-3.5 text-primary" />
            {test.totalQuestions}
            <span className="font-medium text-muted-foreground">Qs</span>
          </span>
          <span className="h-3 w-px bg-border" />
          <span className="flex items-center gap-1.5 font-bold text-foreground">
            <Clock className="w-3.5 h-3.5 text-primary" />
            {test.duration}
            <span className="font-medium text-muted-foreground">min</span>
          </span>
          {test.score !== undefined && test.score !== null && (
            <>
              <span className="h-3 w-px bg-border" />
              <span className="flex items-center gap-1.5 font-bold text-primary">
                <BarChart3 className="w-3.5 h-3.5" />
                {test.score}%
              </span>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Badge variant="outline" className={`${getDifficultyColor(test.difficulty)} border px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-[0.15em]`}>
              {test.difficulty}
            </Badge>
            {test.attempted ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Done
              </Badge>
            ) : isLocked ? (
              <Badge className="bg-amber-500 text-white border-0 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-widest">
                <Lock className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Action */}
        <div className="mt-5 flex flex-col gap-2">
          {isLocked ? (
            <Button
              disabled
              className="w-full h-11 rounded-xl bg-muted text-muted-foreground font-bold uppercase text-[10px] tracking-widest cursor-not-allowed"
            >
              <Lock className="w-3.5 h-3.5 mr-2" />
              Subscribe to Unlock
            </Button>
          ) : test.attempted ? (
            <div className="flex gap-2 min-w-0">
              <Button
                onClick={onViewAnalysis}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-black uppercase text-[11px] tracking-widest transition-all shadow-lg shadow-primary/20 hover:bg-primary/90 group/btn"
              >
                <BarChart3 className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                View Result
              </Button>
              <Button
                onClick={onStart}
                variant="outline"
                title="Retake test"
                className="h-11 w-11 shrink-0 rounded-xl border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors p-0"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={onStart}
              className="w-full h-11 sm:h-12 rounded-xl bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground font-black uppercase text-[11px] sm:text-xs tracking-widest transition-all shadow-lg shadow-primary/25 group/btn"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 fill-current" />
              Start Test
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-2 opacity-0 -translate-x-2 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 transition-all" />
            </Button>
          )}
        </div>
      </CardContent>
      {/* Decorative glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-16 translate-x-16 group-hover:bg-primary/10 transition-colors pointer-events-none" />
    </Card>
  );
}
