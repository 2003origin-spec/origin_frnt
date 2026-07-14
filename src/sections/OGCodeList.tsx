'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import {
    CheckCircle2, Search,
    Trophy, Zap, Flame, Brain, Circle,
    TrendingUp, Atom, Beaker, Calculator, Leaf,
    ChevronRight, Target, Shuffle, ArrowRight, X, Info, Building2, Check, ChevronDown, Heart, Swords, Layers
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import { ogcodePresenceCountsAction, ogcodeScreenHeartbeatAction, listOgcodeChallengeInboxAction, toggleOgcodeQuestionLikeAction, type HydratedChallenge } from '@/server/actions/ogcode-actions';
import type { PracticeQuestion, PracticeQuestionPage, SubjectRank, User } from '@/types';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { saveOgcodeNavQueue } from '@/features/ogcode/nav-queue';
import { toast } from 'sonner';

// Characters that imply Markdown / LaTeX. If a string has none of them it is
// plain text and we can skip the (heavy) ReactMarkdown + KaTeX pipeline entirely
// — a large perf win when rendering a whole grid of question cards, and it also
// avoids Markdown mis-parsing a leading "10." as an <ol> (invalid inside <p>).
const MARKDOWN_HINT = /[$\\*_`~<>[\]#|]/;

function renderInlineSegments(value: string, _keyPrefix?: string) {
    const text = value || '';
    if (!MARKDOWN_HINT.test(text)) return text;
    return <FormattedMessage content={text} inline />;
}


interface OGCodeListProps {
    onSelectQuestion: (questionId: string) => void;
    user: User;
    initialQuestionPage: PracticeQuestionPage | null;
    initialSubjectRanks: SubjectRank[] | null;
    initialUserStats: UserStats | null;
    initialChapters: string[] | null;
    /** OGCode Scoring V2 flag — drives the score-info modal's content. */
    scoringV2Enabled?: boolean;
}

const SUBJECTS = [
    { name: 'Subject', icon: <Brain className="w-4 h-4" /> },
    { name: 'Physics', icon: <Atom className="w-4 h-4" /> },
    { name: 'Chemistry', icon: <Beaker className="w-4 h-4" /> },
    { name: 'Mathematics', icon: <Calculator className="w-4 h-4" /> },
    { name: 'Biology', icon: <Leaf className="w-4 h-4" /> },
];

const DIFFICULTY_CONFIG: Record<string, { label: string; textColor: string; darkText: string; bg: string; darkBg: string; border: string; darkBorder: string; icon: React.ReactNode }> = {
    easy: { label: 'Easy', textColor: 'text-emerald-600', darkText: 'dark:text-emerald-400', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-500/5', border: 'border-emerald-100', darkBorder: 'dark:border-emerald-500/20', icon: <Circle className="w-2.5 h-2.5" /> },
    medium: { label: 'Medium', textColor: 'text-amber-600', darkText: 'dark:text-amber-400', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-500/5', border: 'border-amber-100', darkBorder: 'dark:border-amber-500/20', icon: <Zap className="w-2.5 h-2.5" /> },
    hard: { label: 'Hard', textColor: 'text-rose-600', darkText: 'dark:text-rose-400', bg: 'bg-rose-50', darkBg: 'dark:bg-rose-500/5', border: 'border-rose-100', darkBorder: 'dark:border-rose-500/20', icon: <Flame className="w-2.5 h-2.5" /> },
    insane: { label: 'Insane', textColor: 'text-indigo-600', darkText: 'dark:text-indigo-400', bg: 'bg-indigo-50', darkBg: 'dark:bg-indigo-500/5', border: 'border-indigo-100', darkBorder: 'dark:border-indigo-500/20', icon: <Brain className="w-2.5 h-2.5" /> },
};

const SUBJECT_ICONS: Record<string, React.ReactNode> = {
    Physics: <Atom className="w-3.5 h-3.5" />,
    Chemistry: <Beaker className="w-3.5 h-3.5" />,
    Mathematics: <Calculator className="w-3.5 h-3.5" />,
    Biology: <Leaf className="w-3.5 h-3.5" />,
};

// Subject-specific Ori mascot images, keyed by NORMALISED (lowercase) subject
// name so lookups are casing/variant tolerant (e.g. "physics", "PHYSICS", "Maths").
const SUBJECT_ORI: Record<string, string> = {
    physics: '/ori2d/ori-physics.png',
    chemistry: '/ori2d/ori-chemistry.png',
    mathematics: '/ori2d/ori-maths.png',
    maths: '/ori2d/ori-maths.png',
    math: '/ori2d/ori-maths.png',
    biology: '/ori2d/ori-biology.png',
    bio: '/ori2d/ori-biology.png',
};

// Exam chips are canonical families ("JEE", "NEET", "AIPMT") from the facets
// endpoint; the server matches occurrence by containment (ILIKE %value%), so a
// family value alone catches every stored variant — "JEE (2020)", "JEE Main",
// "JEE / NEET", ... No client-side expansion needed.

const SUBJECT_COLORS: Record<string, string> = {
    Physics: 'text-primary',
    Chemistry: 'text-sky-500',
    Mathematics: 'text-indigo-500',
    Biology: 'text-emerald-500',
};

const ORIGIN_AI_VISIBLE_QUESTION_LIMIT = 40;
const QUESTION_PAGE_SIZE = 60;

function normalizeTags(tags: string | string[] | null | undefined): string[] {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
        try {
            const parsed = JSON.parse(tags);
            if (Array.isArray(parsed)) return parsed;
        } catch { /* ignored */ }
        return tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
}

function normalizeSubject(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export interface UserStats {
    rank: number | null;
    accuracy: number;
    solvedCount: number;
    syllabusCoverage: number;
    streak: number;
    totalAttempts: number;
}

function normalizeQuestionPage(data: unknown): PracticeQuestionPage {
    if (!data || typeof data !== 'object') {
        return { items: [], total: 0, limit: QUESTION_PAGE_SIZE, offset: 0, hasMore: false };
    }

    const payload = data as Partial<PracticeQuestionPage>;
    return {
        items: Array.isArray(payload.items) ? payload.items : [],
        total: Number(payload.total ?? 0),
        limit: Number(payload.limit ?? QUESTION_PAGE_SIZE) || QUESTION_PAGE_SIZE,
        offset: Number(payload.offset ?? 0) || 0,
        hasMore: Boolean(payload.hasMore),
    };
}

function dedupeQuestions(questions: PracticeQuestion[]): PracticeQuestion[] {
    const seen = new Set<string>();
    return questions.filter((question) => {
        if (seen.has(question.id)) return false;
        seen.add(question.id);
        return true;
    });
}

function deriveChapterOptions(subject: string, questions: PracticeQuestion[]): string[] {
    if (subject === 'Subject') {
        return [];
    }

    return Array.from(
        new Set(
            questions
                .filter((question) => normalizeSubject(question.subject) === normalizeSubject(subject))
                .map((question) => question.chapter || 'Foundations'),
        ),
    ).sort();
}

function mapStatusFilter(status: string): 'solved' | 'unsolved' | null {
    if (status === 'Solved') {
        return 'solved';
    }
    if (status === 'Unsolved') {
        return 'unsolved';
    }
    return null;
}

function parseSubjectFilter(value: string | null): string {
    switch ((value ?? '').trim().toLowerCase()) {
        case 'physics':
            return 'Physics';
        case 'chemistry':
            return 'Chemistry';
        case 'mathematics':
            return 'Mathematics';
        case 'biology':
            return 'Biology';
        default:
            return 'Subject';
    }
}

function parseDifficultyFilter(value: string | null): string {
    switch ((value ?? '').trim().toLowerCase()) {
        case 'easy':
            return 'Easy';
        case 'medium':
            return 'Medium';
        case 'hard':
            return 'Hard';
        case 'insane':
            return 'Insane';
        default:
            return 'All';
    }
}

function parseStatusFilter(value: string | null): string {
    switch ((value ?? '').trim().toLowerCase()) {
        case 'solved':
            return 'Solved';
        case 'unsolved':
            return 'Unsolved';
        default:
            return 'All';
    }
}

function sameStringArray(left: string[], right: string[]) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildOgcodeUrl(filters: {
    subject: string;
    difficulty: string;
    status: string;
    chapters: string[];
    search: string;
    classes: string[];
    occurrences: string[];
    subjects: string[];
    h_chapters: string[];
    concepts: string[];
    type: string;
    pyqOnly: boolean;
    likedOnly: boolean;
}) {
    const params = new URLSearchParams();

    if (filters.subject !== 'Subject') params.set('subject', filters.subject);
    if (filters.difficulty !== 'All') params.set('difficulty', filters.difficulty.toLowerCase());
    if (filters.status !== 'All') {
        const mappedStatus = mapStatusFilter(filters.status);
        if (mappedStatus) {
            params.set('status', mappedStatus);
        }
    }
    for (const chapter of filters.chapters) {
        params.append('chapters', chapter);
    }

    const normalizedSearch = filters.search.trim();
    if (normalizedSearch) params.set('search', normalizedSearch);

    // Hierarchy filters
    for (const c of filters.classes) params.append('classes', c);
    for (const o of filters.occurrences) params.append('occurrences', o);
    for (const s of filters.subjects) params.append('subjects', s);
    for (const ch of filters.h_chapters) params.append('h_chapters', ch);
    for (const concept of filters.concepts) params.append('concepts', concept);
    if (filters.type !== 'All') params.set('type', filters.type);
    if (filters.pyqOnly) params.set('pyq_only', 'true');
    if (filters.likedOnly) params.set('liked_only', 'true');

    const query = params.toString();
    return query ? `/ogcode?${query}` : '/ogcode';
}

export default function OGCodeList({
    onSelectQuestion,
    user,
    initialQuestionPage,
    initialSubjectRanks,
    initialUserStats,
    initialChapters,
    scoringV2Enabled = false,
}: OGCodeListProps) {
    const searchParams = useSearchParams();

    // Initialize state from URL params
    const initialSubject = parseSubjectFilter(searchParams.get('subject'));
    const initialDifficulty = parseDifficultyFilter(searchParams.get('difficulty'));
    const initialStatus = parseStatusFilter(searchParams.get('status'));
    const initialSearch = searchParams.get('search') || '';
    const initialSelectedChapters = searchParams.getAll('chapters').filter(Boolean);

    const urlClasses = searchParams.getAll('classes').filter(Boolean);
    const urlOccurrences = searchParams.getAll('occurrences').filter(Boolean);
    const urlSubjects = searchParams.getAll('subjects').filter(Boolean);
    const urlHierChapters = searchParams.getAll('h_chapters').filter(Boolean);
    const urlConcepts = searchParams.getAll('concepts').filter(Boolean);
    const urlType = searchParams.get('type') || 'All';
    const urlPyqOnly = searchParams.get('pyq_only') === 'true';
    const urlLikedOnly = searchParams.get('liked_only') === 'true';

    // The server prefetch (app/ogcode/page.tsx) only honors subject/difficulty/
    // status/chapters/search. If the URL carries any filter beyond that set
    // (hierarchy cascade, question type, PYQ-only), the prefetched page was
    // built WITHOUT those filters — using it would show unfiltered questions
    // under correctly-restored filter chips (e.g. returning from a question)
    // until the user re-applies. Treat the prefetch as absent in that case so
    // the normal client fetch, which honors every filter, runs on mount.
    const prefetchHonorsUrlFilters =
        urlClasses.length === 0 &&
        urlOccurrences.length === 0 &&
        urlSubjects.length === 0 &&
        urlHierChapters.length === 0 &&
        urlConcepts.length === 0 &&
        urlType === 'All' &&
        !urlPyqOnly &&
        !urlLikedOnly;
    const prefetchedQuestionPage = initialQuestionPage && prefetchHonorsUrlFilters
        ? normalizeQuestionPage(initialQuestionPage)
        : null;

    const urlClassesKey = urlClasses.join(',');
    const urlOccurrencesKey = urlOccurrences.join(',');
    const urlSubjectsKey = urlSubjects.join(',');
    const urlHierChaptersKey = urlHierChapters.join(',');
    const urlConceptsKey = urlConcepts.join(',');
    const urlSelectedChaptersKey = searchParams.getAll('chapters').filter(Boolean).join(',');


    const [questions, setQuestions] = useState<PracticeQuestion[]>(prefetchedQuestionPage?.items ?? []);
    const [totalQuestions, setTotalQuestions] = useState(prefetchedQuestionPage?.total ?? 0);
    const [hasMoreQuestions, setHasMoreQuestions] = useState(prefetchedQuestionPage?.hasMore ?? false);
    const [nextOffset, setNextOffset] = useState((prefetchedQuestionPage?.offset ?? 0) + (prefetchedQuestionPage?.items.length ?? 0));
    const [subjectRanks, setSubjectRanks] = useState<SubjectRank[]>(initialSubjectRanks ?? []);
    const [questionsLoading, setQuestionsLoading] = useState(!prefetchedQuestionPage);
    const [statsLoading, setStatsLoading] = useState(!(initialSubjectRanks && initialUserStats));
    const [chaptersLoading, setChaptersLoading] = useState(false);
    const [userStats, setUserStats] = useState<UserStats | null>(initialUserStats);
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [activeSubject, setActiveSubject] = useState(initialSubject);
    const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    
    const [activeDifficulty, setActiveDifficulty] = useState(initialDifficulty);
    const [activeStatus, setActiveStatus] = useState(initialStatus);
    // Institute hallmark (Admin Control Plane): client-side filter to show only
    // questions contributed by coaching centers.
    const [showContributedOnly, setShowContributedOnly] = useState(false);
    const [selectedChapters, setSelectedChapters] = useState<string[]>(initialSelectedChapters);
    const [availableChapters, setAvailableChapters] = useState<string[]>(
        initialChapters ?? deriveChapterOptions(initialSubject, prefetchedQuestionPage?.items ?? []),
    );
    const [openDropdown, setOpenDropdown] = useState<'difficulty' | 'status' | 'subject' | 'type' | 'class' | 'occurrence' | 'hier-subject' | 'hier-chapter' | 'hier-concept' | null>(null);
    const [chapterSearchQuery, setChapterSearchQuery] = useState('');
    const [conceptSearchQuery, setConceptSearchQuery] = useState('');
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);
    const [showScoreInfo, setShowScoreInfo] = useState(false);

    // Hierarchical cascade filter state
    const [hierClasses, setHierClasses] = useState<string[]>(urlClasses);
    const [hierOccurrences, setHierOccurrences] = useState<string[]>(urlOccurrences);
    const [hierSubjects, setHierSubjects] = useState<string[]>(urlSubjects);
    const [hierChapters, setHierChapters] = useState<string[]>(urlHierChapters);
    const [hierConcepts, setHierConcepts] = useState<string[]>(urlConcepts);
    // Available options fetched from /facets
    const [facetClasses, setFacetClasses] = useState<string[]>([]);
    const [facetsReady, setFacetsReady] = useState(false);
    const [facetOccurrences, setFacetOccurrences] = useState<string[]>([]);
    const [facetSubjects, setFacetSubjects] = useState<string[]>([]);
    const [facetChapters, setFacetChapters] = useState<string[]>([]);
    const [facetConcepts, setFacetConcepts] = useState<string[]>([]);
    // Question type filter
    const [activeQuestionType, setActiveQuestionType] = useState(urlType);
    const [pyqOnly, setPyqOnly] = useState(urlPyqOnly);
    const [likedOnly, setLikedOnly] = useState(urlLikedOnly);

    // Cascade model (per product feedback): no forced order — every filter is
    // usable independently — but child OPTIONS strictly narrow to the parent
    // selections. Select Biology + Physics and the Chapter dropdown lists ONLY
    // Biology + Physics chapters (not a merged/union view). Options come straight
    // from the narrowed facet result; the cascade effects below prune any child
    // SELECTION that falls outside the narrowed set so an orphaned pick can't
    // silently AND the result set to zero.
    const subjectOptions = facetSubjects;
    const chapterOptions = useMemo(() => [...facetChapters].sort(), [facetChapters]);
    const conceptOptions = useMemo(() => [...facetConcepts].sort(), [facetConcepts]);

    const handleQuestionClick = useCallback((questionId: string) => {
        if (typeof window !== 'undefined') {
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) {
                return;
            }
        }
        onSelectQuestion(questionId);
    }, [onSelectQuestion]);

    const skipInitialQuestionFetch = useRef(Boolean(prefetchedQuestionPage));
    const skipInitialStatsFetch = useRef(Boolean(initialSubjectRanks && initialUserStats));
    const skipInitialChapterFetch = useRef(initialChapters !== null && initialSubject !== 'Subject');
    // Next 16 patches history.pushState to update useSearchParams inside a
    // startTransition. Our filter setters are urgent, so there's a window
    // where state is new but useSearchParams still reflects the old URL.
    // The URL→state sync effect below sees that mismatch and reverts the
    // user's click, then the transition lands and flips it back — an
    // oscillation. This ref marks self-initiated URL pushes so the effect
    // skips them, while still syncing on genuine external changes
    // (browser back/forward, <Link> navigations).
    const selfInitiatedUrlChange = useRef(false);
    const lastSyncedSearch = useRef(initialSearch);
    
    const urlSubject = parseSubjectFilter(searchParams.get('subject'));
    const urlDifficulty = parseDifficultyFilter(searchParams.get('difficulty'));
    const urlStatus = parseStatusFilter(searchParams.get('status'));
    const urlSearch = searchParams.get('search') || '';
    const urlSelectedChapters = searchParams.getAll('chapters').filter(Boolean);

    const syncUrlParams = useCallback((
        updates: Partial<{
            subject: string;
            difficulty: string;
            status: string;
            chapters: string[];
            search: string;
            classes: string[];
            occurrences: string[];
            subjects: string[];
            h_chapters: string[];
            concepts: string[];
            type: string;
            pyqOnly: boolean;
            likedOnly: boolean;
        }>,
        mode: 'push' | 'replace' = 'push',
    ) => {
        if (typeof window === 'undefined') {
            return;
        }

        const url = buildOgcodeUrl({
            subject: updates.subject !== undefined ? updates.subject : activeSubject,
            difficulty: updates.difficulty !== undefined ? updates.difficulty : activeDifficulty,
            status: updates.status !== undefined ? updates.status : activeStatus,
            chapters: updates.chapters !== undefined ? updates.chapters : selectedChapters,
            search: updates.search !== undefined ? updates.search : searchQuery,
            classes: updates.classes !== undefined ? updates.classes : hierClasses,
            occurrences: updates.occurrences !== undefined ? updates.occurrences : hierOccurrences,
            subjects: updates.subjects !== undefined ? updates.subjects : hierSubjects,
            h_chapters: updates.h_chapters !== undefined ? updates.h_chapters : hierChapters,
            concepts: updates.concepts !== undefined ? updates.concepts : hierConcepts,
            type: updates.type !== undefined ? updates.type : activeQuestionType,
            pyqOnly: updates.pyqOnly !== undefined ? updates.pyqOnly : pyqOnly,
            likedOnly: updates.likedOnly !== undefined ? updates.likedOnly : likedOnly,
        });
        
        if (updates.search !== undefined) {
            lastSyncedSearch.current = updates.search;
        }
        const currentUrl = `${window.location.pathname}${window.location.search}`;
        if (currentUrl === url) {
            return;
        }

        selfInitiatedUrlChange.current = true;
        window.history[mode === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
    }, [
        activeDifficulty, activeStatus, activeSubject, searchQuery, selectedChapters,
        hierClasses, hierOccurrences, hierSubjects, hierChapters, hierConcepts, activeQuestionType, pyqOnly, likedOnly
    ]);

    useEffect(() => {
        if (selfInitiatedUrlChange.current) {
            selfInitiatedUrlChange.current = false;
            return;
        }
        if (activeSubject !== urlSubject) {
            setActiveSubject(urlSubject);
            setAvailableChapters([]);
        }
        if (activeDifficulty !== urlDifficulty) {
            setActiveDifficulty(urlDifficulty);
        }
        if (activeStatus !== urlStatus) {
            setActiveStatus(urlStatus);
        }
        if (searchQuery !== urlSearch && lastSyncedSearch.current !== urlSearch) {
            setSearchQuery(urlSearch);
            lastSyncedSearch.current = urlSearch;
        }
        
        const urlSelectedChapters = urlSelectedChaptersKey ? urlSelectedChaptersKey.split(',') : [];
        if (!sameStringArray(selectedChapters, urlSelectedChapters)) {
            setSelectedChapters(urlSelectedChapters);
        }

        const urlClassesArr = urlClassesKey ? urlClassesKey.split(',') : [];
        const urlOccurrencesArr = urlOccurrencesKey ? urlOccurrencesKey.split(',') : [];
        const urlSubjectsArr = urlSubjectsKey ? urlSubjectsKey.split(',') : [];
        const urlHierChaptersArr = urlHierChaptersKey ? urlHierChaptersKey.split(',') : [];
        const urlConceptsArr = urlConceptsKey ? urlConceptsKey.split(',') : [];

        if (!sameStringArray(hierClasses, urlClassesArr)) {
            setHierClasses(urlClassesArr);
        }
        if (!sameStringArray(hierOccurrences, urlOccurrencesArr)) {
            setHierOccurrences(urlOccurrencesArr);
        }
        if (!sameStringArray(hierSubjects, urlSubjectsArr)) {
            setHierSubjects(urlSubjectsArr);
        }
        if (!sameStringArray(hierChapters, urlHierChaptersArr)) {
            setHierChapters(urlHierChaptersArr);
        }
        if (!sameStringArray(hierConcepts, urlConceptsArr)) {
            setHierConcepts(urlConceptsArr);
        }
        if (activeQuestionType !== urlType) {
            setActiveQuestionType(urlType);
        }
    }, [
        urlDifficulty,
        urlSearch,
        urlSelectedChaptersKey,
        urlStatus,
        urlSubject,
        urlClassesKey,
        urlOccurrencesKey,
        urlSubjectsKey,
        urlHierChaptersKey,
        urlConceptsKey,
        urlType,
    ]);

    // Handle filter changes.
    // NOTE: the singular `subject` filter (activeSubject) has no live UI control
    // anymore — the Subject filter is the multi-select cascade (hierSubjects).
    // activeSubject only survives for backward-compatible ?subject= deep links;
    // buildQuestionQueryString below lets the cascade win when both are present.

    const handleDifficultyChange = (difficulty: string) => {
        setActiveDifficulty(difficulty);
        syncUrlParams({ difficulty }, 'push');
    };

    const handleStatusChange = (status: string) => {
        setActiveStatus(status);
        syncUrlParams({ status }, 'push');
    };

    const handleToggleChapter = (chapter: string) => {
        const next = selectedChapters.includes(chapter) 
            ? selectedChapters.filter(c => c !== chapter) 
            : [...selectedChapters, chapter];
        setSelectedChapters(next);
        syncUrlParams({ chapters: next }, 'push');
    };

    const handleClearChapters = () => {
        setSelectedChapters([]);
        syncUrlParams({ chapters: [] }, 'push');
    };

    useEffect(() => {
        syncUrlParams({
            classes: hierClasses,
            occurrences: hierOccurrences,
            subjects: hierSubjects,
            h_chapters: hierChapters,
            concepts: hierConcepts,
            type: activeQuestionType,
            pyqOnly,
            likedOnly,
        }, 'replace');
    }, [hierClasses, hierOccurrences, hierSubjects, hierChapters, hierConcepts, activeQuestionType, pyqOnly, likedOnly, syncUrlParams]);

    const handleHierarchySubmit = () => {
        syncUrlParams({
            classes: hierClasses,
            occurrences: hierOccurrences,
            subjects: hierSubjects,
            h_chapters: hierChapters,
            concepts: hierConcepts,
            type: activeQuestionType,
            pyqOnly,
            likedOnly,
        }, 'push');
        void fetchQuestionPage({ offset: 0, append: false });
    };

    const fetchFacets = useCallback(async (
        level: string,
        params: { classes?: string[]; occurrences?: string[]; subjects?: string[]; chapters?: string[] }
    ) => {
        const qs = new URLSearchParams();
        qs.set('level', level);
        for (const c of (params.classes ?? [])) qs.append('classes', c);
        for (const o of (params.occurrences ?? [])) qs.append('occurrences', o);

        for (const s of (params.subjects ?? [])) qs.append('subjects', s);
        for (const ch of (params.chapters ?? [])) qs.append('chapters', ch);
        try {
            const data = await apiCall(`/assessments/ogcode/facets?${qs.toString()}`);
            return Array.isArray(data) ? data as string[] : [];
        } catch {
            return [];
        }
    }, []);

    // On mount: fetch available class and occurrence values
    useEffect(() => {
        void fetchFacets('class', {}).then(vals => {
            setFacetClasses(vals);
            setFacetsReady(true);
        });
        void fetchFacets('occurrence', {}).then(setFacetOccurrences);
    }, [fetchFacets]);

    // Cascade effects: each fetches the narrowed OPTION list for its level and
    // prunes its own SELECTION to that list (dropping orphans so a stale pick
    // can't AND the results to zero). A per-level request-sequence guard makes
    // only the latest fetch apply — this is what stops the old race where a
    // slow, stale fetch resolved late and wiped a valid, freshly-made selection.
    const subjectReq = useRef(0);
    const chapterReq = useRef(0);
    const conceptReq = useRef(0);

    // Subjects — options narrowed by class/exam when selected, else all.
    useEffect(() => {
        const req = ++subjectReq.current;
        void fetchFacets('subject', { classes: hierClasses, occurrences: hierOccurrences }).then(vals => {
            if (req !== subjectReq.current) return;
            setFacetSubjects(vals);
            setHierSubjects(prev => {
                const next = prev.filter(s => vals.includes(s));
                return next.length === prev.length ? prev : next;
            });
        });
    }, [hierClasses, hierOccurrences, fetchFacets]);

    // Chapters — options narrowed by class/exam/subject when selected, else all.
    useEffect(() => {
        const req = ++chapterReq.current;
        void fetchFacets('chapter', { classes: hierClasses, occurrences: hierOccurrences, subjects: hierSubjects }).then(vals => {
            if (req !== chapterReq.current) return;
            setFacetChapters(vals);
            setHierChapters(prev => {
                const next = prev.filter(c => vals.includes(c));
                return next.length === prev.length ? prev : next;
            });
        });
    }, [hierSubjects, hierClasses, hierOccurrences, fetchFacets]);

    // Concepts — options narrowed by any selected level above, else all.
    useEffect(() => {
        const req = ++conceptReq.current;
        void fetchFacets('concept', { classes: hierClasses, occurrences: hierOccurrences, subjects: hierSubjects, chapters: hierChapters }).then(vals => {
            if (req !== conceptReq.current) return;
            setFacetConcepts(vals);
            setHierConcepts(prev => {
                const next = prev.filter(c => vals.includes(c));
                return next.length === prev.length ? prev : next;
            });
        });
    }, [hierChapters, hierSubjects, hierClasses, hierOccurrences, fetchFacets]);

    // Refs for click-outside detection
    const statsRef = useRef<HTMLDivElement>(null);

    // Combined click-outside detection for stats and dropdowns
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement;
            // Stats dropdown
            if (statsRef.current && !statsRef.current.contains(target)) {
                setIsStatsExpanded(false);
            }
            // Close any open filter dropdown when tapping anywhere that isn't inside
            // an open dropdown menu. Trigger buttons are not marked, so their own
            // click still toggles correctly (mousedown here fires first, the button's
            // click then applies the toggle against the pre-close state).
            if (!target.closest('[data-filter-dropdown]')) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const buildQuestionQueryString = useCallback((offset: number) => {
        const params = new URLSearchParams();
        params.set('limit', String(QUESTION_PAGE_SIZE));
        params.set('offset', String(offset));

        // The cascade Subject multi-select (hierSubjects, sent as `subjects`) is
        // the real control. Only fall back to the legacy singular `subject` when
        // no cascade subject is chosen — otherwise the two AND together and can
        // collapse the result set to zero (Bug 2).
        if (activeSubject !== 'Subject' && hierSubjects.length === 0) params.set('subject', activeSubject);
        if (activeDifficulty !== 'All') params.set('difficulty', activeDifficulty.toLowerCase());
        if (activeStatus !== 'All') {
            const mappedStatus = mapStatusFilter(activeStatus);
            if (mappedStatus) params.set('status', mappedStatus);
        }
        for (const chapter of selectedChapters) {
            params.append('chapters', chapter);
        }

        // Hierarchy filters
        for (const c of hierClasses) params.append('classes', c);
        for (const o of hierOccurrences) params.append('occurrences', o);

        for (const s of hierSubjects) params.append('subjects', s);
        for (const ch of hierChapters) params.append('chapters', ch);
        for (const concept of hierConcepts) params.append('concepts', concept);

        // Question type
        const typeMap: Record<string, string> = { 'MCQ': 'mcq', 'MSQ': 'msq', 'Integer': 'numerical', 'Range': 'range', 'Matrix Match': 'matrix_match' };
        const mappedType = typeMap[activeQuestionType];
        if (mappedType) params.set('type', mappedType);

        if (pyqOnly) params.set('pyq_only', 'true');
        if (likedOnly) params.set('liked_only', 'true');
        if (showContributedOnly) params.set('contributed_only', 'true');

        const normalizedSearch = searchQuery.trim();
        if (normalizedSearch) params.set('search', normalizedSearch);

        return params.toString();
    }, [activeDifficulty, activeStatus, activeSubject, searchQuery, selectedChapters, hierClasses, hierOccurrences, hierSubjects, hierChapters, hierConcepts, activeQuestionType, pyqOnly, likedOnly, showContributedOnly]);

    const fetchQuestionPage = useCallback(async ({ offset = 0, append = false }: { offset?: number; append?: boolean } = {}) => {
        setQuestionsLoading(true);
        try {
            const data = await apiCall(`/assessments/ogcode/questions/?${buildQuestionQueryString(offset)}`);
            const page = normalizeQuestionPage(data);

            setQuestions((current) => append ? dedupeQuestions([...current, ...page.items]) : page.items);
            setTotalQuestions(page.total);
            setHasMoreQuestions(page.hasMore);
            setNextOffset(page.offset + page.items.length);
        } catch (error) {
            console.error('Failed to fetch OGCode data:', error);
            toast.error('Failed to load questions');
        } finally {
            setQuestionsLoading(false);
        }
    }, [buildQuestionQueryString]);

    useEffect(() => {
        // Filters auto-apply. A short debounce batches rapid changes (e.g.
        // ticking several chapters) into one fetch, but stays snappy — the old
        // 700ms made a filter change feel like nothing happened for ~1s. Search
        // gets a hair more so it doesn't fire on every keystroke.
        const timeout = window.setTimeout(() => {
            if (skipInitialQuestionFetch.current) {
                skipInitialQuestionFetch.current = false;
                return;
            }
            // Clear current questions if it's a fresh search to show spinner
            if (searchQuery.trim()) {
                setQuestions([]);
            }
            void fetchQuestionPage();
        }, searchQuery.trim() ? 300 : 250);

        return () => window.clearTimeout(timeout);
    }, [fetchQuestionPage, searchQuery]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            syncUrlParams({ search: searchQuery }, 'replace');
        }, searchQuery.trim() ? 300 : 0);

        return () => window.clearTimeout(timeout);
    }, [searchQuery, syncUrlParams]);

    const fetchStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const [rankData, statsData] = await Promise.all([
                apiCall(`/assessments/ogcode/leaderboard/subjects/?time_range=${timeRange}`),
                apiCall('/assessments/ogcode/user-stats/'),
            ]);
            setSubjectRanks(Array.isArray(rankData) ? rankData : []);
            setUserStats(statsData as UserStats);
        } catch (error) {
            console.error('Failed to fetch OGCode stats:', error);
        } finally {
            setStatsLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        if (skipInitialStatsFetch.current) {
            skipInitialStatsFetch.current = false;
            return;
        }
        void fetchStats();
    }, [fetchStats]);

    const fetchChapters = useCallback(async () => {
        if (activeSubject === 'Subject') {
            setAvailableChapters([]);
            return;
        }

        setChaptersLoading(true);
        try {
            const data = await apiCall(`/assessments/ogcode/chapters/?subject=${encodeURIComponent(activeSubject)}`);
            setAvailableChapters(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch OGCode chapters:', error);
            setAvailableChapters([]);
        } finally {
            setChaptersLoading(false);
        }
    }, [activeSubject]);

    useEffect(() => {
        if (skipInitialChapterFetch.current) {
            skipInitialChapterFetch.current = false;
            return;
        }
        void fetchChapters();
    }, [fetchChapters]);

    const handleLoadMore = () => {
        if (!hasMoreQuestions || questionsLoading) {
            return;
        }
        void fetchQuestionPage({ offset: nextOffset, append: true });
    };

    // The server is the single source of truth for filtering — every filter
    // (subject, class, exam, chapter, concept, type, difficulty, status, pyq,
    // liked, contributed, search) is sent in buildQuestionQueryString and the
    // returned page + total + Load More all reflect it. We deliberately do NOT
    // re-filter client-side: doing so silently dropped rows the server had
    // already counted, desyncing the "N questions" total, the card grid, and
    // Load More (a client-only filter would even make Load More appear to load
    // nothing). Kept as a passthrough memo so the downstream page-context memo +
    // nav-queue effect keep a stable array identity between unrelated re-renders.
    const filteredQuestions = useMemo(() => questions, [questions]);

    // §13 OG Friend Challenge Box — challenges sent to me.
    const [challengeInbox, setChallengeInbox] = useState<HydratedChallenge[]>([]);
    const [challengePending, setChallengePending] = useState(0);
    const [challengeBoxOpen, setChallengeBoxOpen] = useState(false);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await listOgcodeChallengeInboxAction();
                if (active) { setChallengeInbox(res.challenges); setChallengePending(res.pending); }
            } catch {
                // Best-effort; the box just stays empty.
            }
        })();
        return () => { active = false; };
    }, []);

    // §12 Live Practicing — batch-poll presence counts for the visible cards
    // (~12s). Degrades silently to no badges when Redis/Upstash is absent.
    const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
    const visibleIdsKey = filteredQuestions.map((q) => q.id).join(',');
    useEffect(() => {
        const ids = visibleIdsKey ? visibleIdsKey.split(',') : [];
        if (!ids.length) {
            setLiveCounts({});
            return;
        }
        let active = true;
        const poll = async () => {
            try {
                const counts = await ogcodePresenceCountsAction(ids.slice(0, 100));
                if (active) setLiveCounts(counts);
            } catch {
                // Ambient; ignore.
            }
        };
        void poll();
        const interval = setInterval(poll, 12_000);
        return () => { active = false; clearInterval(interval); };
    }, [visibleIdsKey]);

    // §12 Presence heartbeat for the OGCode main page: marks this viewer present
    // (even when just browsing, not solving) and reads the total live candidates
    // across all OGCode screens.
    const [liveTotal, setLiveTotal] = useState(0);
    useEffect(() => {
        let active = true;
        const beat = async () => {
            try {
                const { liveTotal: total } = await ogcodeScreenHeartbeatAction();
                if (active) setLiveTotal(total);
            } catch {
                // Ambient; ignore.
            }
        };
        void beat();
        const interval = setInterval(beat, 20_000);
        return () => { active = false; clearInterval(interval); };
    }, []);

    // §10 Like/unlike from a card — optimistic live count update on the card,
    // reconciled with the server's authoritative count, reverted on failure.
    const [likePendingIds, setLikePendingIds] = useState<Set<string>>(new Set());
    const toggleCardLike = useCallback(async (questionId: string) => {
        if (likePendingIds.has(questionId)) return;
        setLikePendingIds(prev => new Set(prev).add(questionId));

        let nextLiked = false;
        setQuestions(prev => prev.map(q => {
            if (q.id !== questionId) return q;
            nextLiked = !q.likedByMe;
            return { ...q, likedByMe: nextLiked, likeCount: Math.max(0, (q.likeCount ?? 0) + (nextLiked ? 1 : -1)) };
        }));

        try {
            const res = await toggleOgcodeQuestionLikeAction(questionId);
            setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, likedByMe: res.likedByMe, likeCount: res.count } : q));
        } catch {
            // Revert the optimistic flip.
            setQuestions(prev => prev.map(q => {
                if (q.id !== questionId) return q;
                return { ...q, likedByMe: !nextLiked, likeCount: Math.max(0, (q.likeCount ?? 0) + (nextLiked ? -1 : 1)) };
            }));
            toast.error('Could not update like.');
        } finally {
            setLikePendingIds(prev => { const n = new Set(prev); n.delete(questionId); return n; });
        }
    }, [likePendingIds]);

    const originAiPageContext = useMemo(() => ({
        pathname: '/ogcode',
        pageKind: 'ogcode_index' as const,
        searchQuery: searchQuery.trim() || null,
        activeSubject: activeSubject === 'Subject' ? null : activeSubject,
        activeDifficulty: activeDifficulty === 'All' ? null : activeDifficulty,
        activeStatus: activeStatus === 'All' ? null : activeStatus,
        selectedChapters,
        totalVisibleQuestions: filteredQuestions.length,
        visibleQuestions: filteredQuestions.slice(0, ORIGIN_AI_VISIBLE_QUESTION_LIMIT).map((question, index) => ({
            id: question.id,
            number: index + 1,
            title: question.title || question.text,
            chapter: question.chapter || 'Foundations',
            concept: question.concept || null,
            difficulty: question.difficulty || null,
            subject: question.subject || null,
            tags: normalizeTags(question.tags),
            isSolved: question.status === 'solved' || question.isSolved,
        })),
    }), [activeDifficulty, activeStatus, activeSubject, filteredQuestions, searchQuery, selectedChapters]);

    usePublishOriginAiPageContext(originAiPageContext);

    // Persist the current filtered ordering so the question workspace can offer
    // Previous / Next that respect whatever filter is applied here.
    const getFilterParamsString = useCallback(() => {
        const params = new URLSearchParams();
        if (activeSubject !== 'Subject') params.set('subject', activeSubject);
        if (activeDifficulty !== 'All') params.set('difficulty', activeDifficulty.toLowerCase());
        if (activeStatus !== 'All') {
            const mappedStatus = mapStatusFilter(activeStatus);
            if (mappedStatus) params.set('status', mappedStatus);
        }
        for (const chapter of selectedChapters) {
            params.append('chapters', chapter);
        }
        const normalizedSearch = searchQuery.trim();
        if (normalizedSearch) params.set('search', normalizedSearch);

        // Hierarchy filters
        for (const c of hierClasses) params.append('classes', c);
        for (const o of hierOccurrences) params.append('occurrences', o);
        for (const s of hierSubjects) params.append('subjects', s);
        for (const ch of hierChapters) params.append('h_chapters', ch);
        for (const concept of hierConcepts) params.append('concepts', concept);
        if (activeQuestionType !== 'All') params.set('type', activeQuestionType);

        return params.toString();
    }, [activeSubject, activeDifficulty, activeStatus, selectedChapters, searchQuery, hierClasses, hierOccurrences, hierSubjects, hierChapters, hierConcepts, activeQuestionType]);

    const filteredIdsKey = useMemo(
        () => filteredQuestions.map(q => q.id).join(','),
        [filteredQuestions],
    );
    useEffect(() => {
        const label = [
            activeSubject !== 'Subject' ? activeSubject : null,
            activeDifficulty !== 'All' ? activeDifficulty : null,
            activeStatus !== 'All' ? activeStatus : null,
            selectedChapters.length ? `${selectedChapters.length} chapter${selectedChapters.length > 1 ? 's' : ''}` : null,
            searchQuery.trim() ? `“${searchQuery.trim()}”` : null,
            hierClasses.length ? `Classes: ${hierClasses.join(',')}` : null,
            hierOccurrences.length ? `Exams: ${hierOccurrences.join(',')}` : null,
            hierSubjects.length ? `Subjects: ${hierSubjects.join(',')}` : null,
            hierChapters.length ? `Chapters: ${hierChapters.length}` : null,
            hierConcepts.length ? `Concepts: ${hierConcepts.length}` : null,
            activeQuestionType !== 'All' ? `Type: ${activeQuestionType}` : null,
        ].filter(Boolean).join(' · ') || 'All questions';
        saveOgcodeNavQueue({ ids: filteredQuestions.map(q => String(q.id)), label, filterParams: getFilterParamsString() || null });
        // filteredIdsKey captures order+membership; other deps feed the label.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        filteredIdsKey,
        activeSubject,
        activeDifficulty,
        activeStatus,
        selectedChapters,
        searchQuery,
        hierClasses,
        hierOccurrences,
        hierSubjects,
        hierChapters,
        hierConcepts,
        activeQuestionType,
        getFilterParamsString,
    ]);

    const solvedCount = userStats?.solvedCount ?? questions.filter(q => q.status === 'solved' || q.isSolved).length;
    const myRank = userStats?.rank;
    const accuracy = userStats?.accuracy ?? 0;
    const syllabusCoverage = userStats?.syllabusCoverage ?? 0;
    const streak = userStats?.streak ?? user.streak ?? 0;
    const showQuestionsSpinner = questionsLoading && questions.length === 0;
    const questionSummaryLabel = totalQuestions > 0
        ? `Showing ${Math.min(filteredQuestions.length, totalQuestions)} of ${totalQuestions} questions`
        : 'No questions available yet.';

    return (
        <div className="min-h-screen neu-surface text-foreground font-sans selection:bg-primary/30 pb-20 md:pb-16">
            <div className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 pt-6 space-y-5">

                {/* ── Header ── */}
                <div className="sticky top-0 z-[200] -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-4 neu-surface border-b border-border/20 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-5">
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45 }}
                        className="space-y-1.5"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            <Image src="/ori2d/ori-laptop.png" alt="Ori" width={56} height={56} className="object-contain drop-shadow-md flex-shrink-0" priority />
                            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground leading-tight break-words">
                                OG<span className="text-primary">CODE</span> Workspace
                            </h1>
                            <button
                                type="button"
                                onClick={() => setShowScoreInfo(true)}
                                aria-label="How is the OGCODE score calculated?"
                                title="How is the OGCODE score calculated?"
                                className="neu-raised flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors mt-0.5"
                            >
                                <Info className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground max-w-xl">
                            Master complex concepts through structured practice, build your streak, and climb the national leaderboard.
                        </p>
                        {liveTotal > 0 && (
                            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400" title={`${liveTotal} candidate${liveTotal === 1 ? '' : 's'} on OGCode right now`}>
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                </span>
                                {liveTotal.toLocaleString()} live now
                            </div>
                        )}
                    </motion.div>

                    {/* Right side: OG Points + AIR stats */}
                    <div className="flex items-center gap-2 sm:gap-3 self-start w-full md:w-auto justify-end">

                    {/* OG Points chip */}
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl neu-raised border border-amber-500/15 bg-amber-500/5 shrink-0">
                        <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-sm font-black text-amber-500 font-mono">{user.points || 0}</span>
                        <span className="text-[9px] font-black text-amber-500/60 uppercase tracking-widest">PTS</span>
                    </div>

                    {/* AIR Badge & Stats Dropdown */}
                    <div ref={statsRef} className="relative z-[220]">
                        <button
                            onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                            className={cn(
                                'neu-raised flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-5 sm:py-3 rounded-2xl transition-all duration-300 text-foreground',
                                isStatsExpanded && 'bg-primary !text-white',
                            )}
                        >
                            <div className={cn('w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0', isStatsExpanded ? 'bg-white/20' : 'bg-amber-500/10')}>
                                <Trophy className={cn('w-4 h-4 sm:w-4.5 sm:h-4.5', isStatsExpanded ? 'text-white' : 'text-amber-500')} />
                            </div>
                            <div className="text-left">
                                <div className="text-[9px] font-black uppercase tracking-wider opacity-60">National Rank</div>
                                <div className="text-base sm:text-lg font-black leading-none">AIR {myRank ? `#${myRank}` : '—'}</div>
                            </div>
                            <ChevronRight className={cn('w-4 h-4 sm:ml-1 shrink-0 transition-transform duration-300', isStatsExpanded && 'rotate-90')} />
                        </button>

                        <AnimatePresence>
                            {isStatsExpanded && (
                                <motion.div
                                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full right-0 mt-3 w-[min(calc(100vw-1.5rem),380px)] max-w-[calc(100vw-1.5rem)] z-[230] space-y-3 pointer-events-auto"
                                >
                                    {/* Mastery Card */}
                                    <div className="neu-raised p-5">
                                        <h3 className="text-[10px] font-black text-primary tracking-[0.3em] uppercase mb-4 flex items-center gap-2.5">
                                            <div className="w-7 h-7 bg-primary/10 rounded-xl flex items-center justify-center">
                                                <TrendingUp className="w-3.5 h-3.5" />
                                            </div>
                                            Mastery Analytics
                                        </h3>
                                        <div className="space-y-3">
                                            {[
                                                { label: 'Current Streak', val: `${streak}d`, icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10', ori: '/ori2d/ori-exited.png' },
                                                { label: 'Solved Questions', val: solvedCount, icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10', ori: '/ori2d/ori-thubmsup.png' },
                                                { label: 'Accuracy Rate', val: `${accuracy}%`, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-500/10', ori: '/ori2d/ori-proud.png' },
                                                { label: 'Prestige Points', val: user.points || 0, icon: Zap, color: 'text-indigo-500', bg: 'bg-indigo-500/10', ori: '/ori2d/ori-cheerful.png' },
                                            ].map((stat) => (
                                                <div key={stat.label} className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={cn('relative w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center', stat.bg, stat.color)}>
                                                            {stat.ori ? (
                                                                <Image src={stat.ori} alt="" aria-hidden fill sizes="32px" className="object-contain p-0.5" />
                                                            ) : (
                                                                <stat.icon className="w-3.5 h-3.5" />
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                                                    </div>
                                                    <span className="text-sm font-black text-foreground">{stat.val}</span>
                                                </div>
                                            ))}
                                            <div className="pt-3 mt-1 border-t border-border/40 space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Syllabus Coverage</span>
                                                    <span className="text-base font-black text-primary">{syllabusCoverage}%</span>
                                                </div>
                                                <div className="h-2 rounded-full overflow-hidden neu-inset">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${syllabusCoverage}%` }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="h-full bg-primary rounded-full" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Arena Rankings Card */}
                                    <div className="neu-raised p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-[10px] font-black text-amber-500 tracking-[0.3em] uppercase flex items-center gap-2.5">
                                                <div className="w-7 h-7 bg-amber-500/10 rounded-xl flex items-center justify-center">
                                                    <Trophy className="w-3.5 h-3.5" />
                                                </div>
                                                Arena Rankings
                                            </h3>
                                            <div className="neu-inset rounded-xl p-1 flex">
                                                {(['daily', 'weekly'] as const).map((r) => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => setTimeRange(r)}
                                                        className={cn(
                                                            'px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all',
                                                            timeRange === r ? 'neu-raised text-primary' : 'text-muted-foreground',
                                                        )}
                                                    >
                                                        {r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            {statsLoading && subjectRanks.length === 0 ? (
                                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Loading rankings...</div>
                                            ) : subjectRanks.length > 0 ? (
                                                subjectRanks.map((rank, i) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="relative w-8 h-8 rounded-xl bg-primary/10 overflow-hidden shrink-0">
                                                                {SUBJECT_ORI[normalizeSubject(rank.subject)] ? (
                                                                    <Image
                                                                        src={SUBJECT_ORI[normalizeSubject(rank.subject)]}
                                                                        alt={rank.subject}
                                                                        fill
                                                                        sizes="32px"
                                                                        className="object-contain p-0.5 drop-shadow-sm"
                                                                    />
                                                                ) : (
                                                                    <span className={cn('absolute inset-0 flex items-center justify-center', SUBJECT_COLORS[rank.subject])}>{SUBJECT_ICONS[rank.subject]}</span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">{rank.subject}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-black text-amber-500">#{rank.rankPosition || rank.rank}</div>
                                                            <div className="text-[8px] font-black text-muted-foreground uppercase">AIR</div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Rankings will appear after your first attempts.</div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => { setIsStatsExpanded(false); onSelectQuestion('leaderboard'); }}
                                                className="w-full pt-3 mt-1 border-t border-border/40 text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-opacity hover:opacity-70"
                                            >
                                                Global Leaderboard <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    </div>{/* end right-side flex */}
                </div>

                {/* ── Filters ── */}
                <div className="space-y-3">
                    {/* Hierarchical Cascade Filters */}
                    <div id="filter-area" className="neu-inset rounded-2xl p-4 sm:p-5 relative z-[80] space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Smart Filter</label>
                            {(hierClasses.length > 0 || hierOccurrences.length > 0 || hierSubjects.length > 0 || hierChapters.length > 0 || hierConcepts.length > 0) && (
                                <button
                                    type="button"
                                    onClick={() => { setHierClasses([]); setHierOccurrences([]); setHierSubjects([]); setHierChapters([]); setHierConcepts([]); }}
                                    className="text-[9px] font-black uppercase text-primary transition-opacity hover:opacity-70"
                                >
                                    Reset All
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                            {/* Class Dropdown */}
                            <div className="space-y-2 relative">
                                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <span>Class</span>
                                </div>
                                <button
                                    type="button"
                                    data-filter-dropdown
                                    onClick={() => setOpenDropdown(openDropdown === 'class' ? null : 'class')}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all truncate text-left',
                                        hierClasses.length > 0 ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span className="truncate">
                                        {hierClasses.length === 0 ? 'Select Class' : `Classes: ${hierClasses.join(', ')}`}
                                    </span>
                                    <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform duration-200', openDropdown === 'class' && 'rotate-180')} />
                                </button>
                                {openDropdown === 'class' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        className="absolute left-0 right-0 mt-2 min-w-[200px] max-h-96 overflow-y-auto neu-raised rounded-xl z-50 p-2 space-y-1 bg-background/95 backdrop-blur-md"
                                        data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                    >
                                        {!facetsReady ? (
                                            <div className="text-[10px] text-muted-foreground italic p-2 text-center">Loading…</div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const classes = facetClasses.length > 0 ? facetClasses : ['11', '12'];
                                                        const allSelected = hierClasses.length === classes.length;
                                                        setHierClasses(allSelected ? [] : [...classes]);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-black text-primary hover:bg-primary/5 transition-colors text-left border-b border-border/20 mb-1"
                                                >
                                                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', hierClasses.length === (facetClasses.length > 0 ? facetClasses.length : 2) ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                        {hierClasses.length === (facetClasses.length > 0 ? facetClasses.length : 2) && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    Select All
                                                </button>
                                                {(facetClasses.length > 0 ? facetClasses : ['11', '12']).map(cls => {
                                                    const active = hierClasses.includes(cls);
                                                    return (
                                                        <button
                                                            key={cls}
                                                            type="button"
                                                            onClick={() => setHierClasses(prev => active ? prev.filter(c => c !== cls) : [...prev, cls])}
                                                            className={cn(
                                                                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors text-left hover:bg-primary/5',
                                                                active ? 'text-primary font-bold bg-primary/5' : 'text-muted-foreground'
                                                            )}
                                                        >
                                                            <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', active ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                {active && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            Class {cls}
                                                        </button>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            {/* Exam/Occurrence Dropdown */}
                            <div className="space-y-2 relative">
                                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <span>Exam</span>
                                </div>
                                <button
                                    type="button"
                                    data-filter-dropdown
                                    onClick={() => setOpenDropdown(openDropdown === 'occurrence' ? null : 'occurrence')}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all truncate text-left',
                                        hierOccurrences.length > 0 ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span className="truncate">
                                        {hierOccurrences.length === 0 ? 'Select Exam' : `Exams: ${hierOccurrences.join(', ')}`}
                                    </span>
                                    <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform duration-200', openDropdown === 'occurrence' && 'rotate-180')} />
                                </button>
                                {openDropdown === 'occurrence' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        className="absolute left-0 right-0 mt-2 min-w-[200px] max-h-96 overflow-y-auto neu-raised rounded-xl z-50 p-2 space-y-1 bg-background/95 backdrop-blur-md"
                                        data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const exams = ['JEE', 'NEET', 'AIPMT'];
                                                const allSelected = hierOccurrences.length === exams.length;
                                                setHierOccurrences(allSelected ? [] : [...exams]);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-black text-primary hover:bg-primary/5 transition-colors text-left border-b border-border/20 mb-1"
                                        >
                                            <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', hierOccurrences.length === 3 ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                {hierOccurrences.length === 3 && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            Select All
                                        </button>
                                        {['JEE', 'NEET', 'AIPMT'].map(occ => {
                                            const active = hierOccurrences.includes(occ);
                                            return (
                                                <button
                                                    key={occ}
                                                    type="button"
                                                    onClick={() => setHierOccurrences(prev => active ? prev.filter(o => o !== occ) : [...prev, occ])}
                                                    className={cn(
                                                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors text-left hover:bg-primary/5',
                                                        active ? 'text-primary font-bold bg-primary/5' : 'text-muted-foreground'
                                                    )}
                                                >
                                                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', active ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                        {active && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <span className="truncate">{occ}</span>
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </div>

                            {/* Subject Dropdown */}
                            <div className="space-y-2 relative">
                                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <span>Subject</span>
                                </div>
                                <button
                                    type="button"
                                    data-filter-dropdown
                                    onClick={() => setOpenDropdown(openDropdown === 'hier-subject' ? null : 'hier-subject')}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all truncate text-left',
                                        hierSubjects.length > 0 ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span className="truncate">
                                        {hierSubjects.length === 0 ? 'Select Subject' : `Subjects: ${hierSubjects.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}`}
                                    </span>
                                    <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform duration-200', openDropdown === 'hier-subject' && 'rotate-180')} />
                                </button>
                                {openDropdown === 'hier-subject' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        className="absolute left-0 right-0 mt-2 min-w-[200px] max-h-96 overflow-y-auto neu-raised rounded-xl z-50 p-2 space-y-1 bg-background/95 backdrop-blur-md"
                                        data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                    >
                                        {subjectOptions.length === 0 ? (
                                            <div className="text-[10px] text-muted-foreground italic p-2 text-center">
                                                No subjects found
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const allSelected = hierSubjects.length === subjectOptions.length;
                                                        setHierSubjects(allSelected ? [] : [...subjectOptions]);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-black text-primary hover:bg-primary/5 transition-colors text-left border-b border-border/20 mb-1"
                                                >
                                                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', hierSubjects.length === subjectOptions.length ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                        {hierSubjects.length === subjectOptions.length && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    Select All
                                                </button>
                                                {subjectOptions.map(sub => {
                                                    const capName = sub.charAt(0).toUpperCase() + sub.slice(1);
                                                    const icon = SUBJECT_ICONS[capName] ?? null;
                                                    const active = hierSubjects.includes(sub);
                                                    return (
                                                        <button
                                                            key={sub}
                                                            type="button"
                                                            onClick={() => setHierSubjects(prev => active ? prev.filter(s => s !== sub) : [...prev, sub])}
                                                            className={cn(
                                                                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold transition-colors text-left hover:bg-primary/5',
                                                                active ? 'text-primary font-bold bg-primary/5' : 'text-muted-foreground'
                                                            )}
                                                        >
                                                            <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', active ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                {active && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            {icon && <span className="w-3 h-3 shrink-0">{icon}</span>}
                                                            <span>{capName}</span>
                                                        </button>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </div>

                            {/* Chapter Dropdown */}
                            <div className="space-y-2 relative">
                                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <span>Chapter</span>
                                </div>
                                <button
                                    type="button"
                                    data-filter-dropdown
                                    onClick={() => {
                                        setOpenDropdown(openDropdown === 'hier-chapter' ? null : 'hier-chapter');
                                        setChapterSearchQuery('');
                                    }}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all truncate text-left',
                                        hierChapters.length > 0 ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span className="truncate">
                                        {hierChapters.length === 0 ? 'Select Chapter' : `Chapters: ${hierChapters.length} selected`}
                                    </span>
                                    <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform duration-200', openDropdown === 'hier-chapter' && 'rotate-180')} />
                                </button>
                                {openDropdown === 'hier-chapter' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        className="absolute left-0 right-0 mt-2 min-w-[240px] max-h-[450px] flex flex-col neu-raised rounded-xl z-50 bg-background/95 backdrop-blur-md overflow-hidden"
                                        data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                    >
                                        <div className="p-2 border-b border-border/40 shrink-0">
                                            <input
                                                type="text"
                                                placeholder="Search chapters..."
                                                value={chapterSearchQuery}
                                                onChange={e => setChapterSearchQuery(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-primary/50"
                                            />
                                        </div>
                                        <div className="overflow-y-auto p-2 flex-1 space-y-1 max-h-[380px]">
                                            {(() => {
                                                const filtered = chapterOptions.filter(ch => ch.toLowerCase().includes(chapterSearchQuery.toLowerCase()));
                                                if (filtered.length === 0) {
                                                    return <div className="text-[10px] text-muted-foreground italic p-2 text-center">No chapters found</div>;
                                                }
                                                const allSelected = filtered.every(ch => hierChapters.includes(ch));
                                                return (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setHierChapters(prev => {
                                                                    if (allSelected) {
                                                                        return prev.filter(c => !filtered.includes(c));
                                                                    } else {
                                                                        const nextCh = [...prev];
                                                                        for (const ch of filtered) {
                                                                            if (!nextCh.includes(ch)) nextCh.push(ch);
                                                                        }
                                                                        return nextCh;
                                                                    }
                                                                });
                                                            }}
                                                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-black text-primary hover:bg-primary/5 transition-colors text-left border-b border-border/20 mb-1 shrink-0"
                                                        >
                                                            <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', allSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                {allSelected && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            Select All
                                                        </button>
                                                        {filtered.map(ch => {
                                                            const active = hierChapters.includes(ch);
                                                            return (
                                                                <button
                                                                    key={ch}
                                                                    type="button"
                                                                    onClick={() => setHierChapters(prev => active ? prev.filter(c => c !== ch) : [...prev, ch])}
                                                                    className={cn(
                                                                        'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-colors text-left hover:bg-primary/5',
                                                                        active ? 'text-primary font-bold bg-primary/5' : 'text-slate-700 dark:text-slate-300'
                                                                    )}
                                                                >
                                                                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', active ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                        {active && <Check className="w-3 h-3 text-white" />}
                                                                    </div>
                                                                    <span className="line-clamp-2 leading-tight">{ch}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </motion.div>
                                )}
                            </div>

                            {/* Concept Dropdown */}
                            <div className="space-y-2 relative">
                                <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <span>Concept</span>
                                </div>
                                <button
                                    type="button"
                                    data-filter-dropdown
                                    onClick={() => {
                                        setOpenDropdown(openDropdown === 'hier-concept' ? null : 'hier-concept');
                                        setConceptSearchQuery('');
                                    }}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all truncate text-left',
                                        hierConcepts.length > 0 ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    <span className="truncate">
                                        {hierConcepts.length === 0 ? 'Select Concept' : `Concepts: ${hierConcepts.length} selected`}
                                    </span>
                                    <ChevronDown className={cn('w-3.5 h-3.5 shrink-0 transition-transform duration-200', openDropdown === 'hier-concept' && 'rotate-180')} />
                                </button>
                                {openDropdown === 'hier-concept' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        className="absolute left-0 right-0 mt-2 min-w-[240px] max-h-[450px] flex flex-col neu-raised rounded-xl z-50 bg-background/95 backdrop-blur-md overflow-hidden"
                                        data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                    >
                                        <div className="p-2 border-b border-border/40 shrink-0">
                                            <input
                                                type="text"
                                                placeholder="Search concepts..."
                                                value={conceptSearchQuery}
                                                onChange={e => setConceptSearchQuery(e.target.value)}
                                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:border-primary/50"
                                            />
                                        </div>
                                        <div className="overflow-y-auto p-2 flex-1 space-y-1 max-h-[380px]">
                                            {(() => {
                                                const filtered = conceptOptions.filter(concept => concept.toLowerCase().includes(conceptSearchQuery.toLowerCase()));
                                                if (filtered.length === 0) {
                                                    return <div className="text-[10px] text-muted-foreground italic p-2 text-center">No concepts found</div>;
                                                }
                                                const allSelected = filtered.every(co => hierConcepts.includes(co));
                                                return (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setHierConcepts(prev => {
                                                                    if (allSelected) {
                                                                        return prev.filter(c => !filtered.includes(c));
                                                                    } else {
                                                                        const nextCo = [...prev];
                                                                        for (const co of filtered) {
                                                                            if (!nextCo.includes(co)) nextCo.push(co);
                                                                        }
                                                                        return nextCo;
                                                                    }
                                                                });
                                                            }}
                                                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-black text-primary hover:bg-primary/5 transition-colors text-left border-b border-border/20 mb-1 shrink-0"
                                                        >
                                                            <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', allSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                {allSelected && <Check className="w-3 h-3 text-white" />}
                                                            </div>
                                                            Select All
                                                        </button>
                                                        {filtered.map(concept => {
                                                            const active = hierConcepts.includes(concept);
                                                            return (
                                                                <button
                                                                    key={concept}
                                                                    type="button"
                                                                    onClick={() => setHierConcepts(prev => active ? prev.filter(c => c !== concept) : [...prev, concept])}
                                                                    className={cn(
                                                                        'w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-colors text-left hover:bg-primary/5',
                                                                        active ? 'text-primary font-bold bg-primary/5' : 'text-slate-700 dark:text-slate-300'
                                                                    )}
                                                                >
                                                                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all', active ? 'bg-primary border-primary' : 'border-muted-foreground/30')}>
                                                                        {active && <Check className="w-3 h-3 text-white" />}
                                                                    </div>
                                                                    <span className="line-clamp-2 leading-tight">{concept}</span>
                                                                </button>
                                                            );
                                                        })}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* PYQs Only + Liked toggles + Apply Filters */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/20">
                            <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={pyqOnly}
                                    onClick={() => setPyqOnly(v => !v)}
                                    className={cn(
                                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                                        pyqOnly
                                            ? 'bg-violet-500 border-violet-500'
                                            : 'border-muted-foreground/40 bg-transparent hover:border-violet-400'
                                    )}
                                >
                                    {pyqOnly && <Check className="w-2.5 h-2.5 text-white" />}
                                </button>
                                <span className={cn(
                                    'text-[11px] font-black uppercase tracking-widest transition-colors',
                                    pyqOnly ? 'text-violet-500' : 'text-muted-foreground group-hover:text-primary'
                                )}>
                                    PYQs Only
                                </span>
                            </label>
                            {/* §10 Liked filter axis */}
                            <label className="flex items-center gap-2 cursor-pointer select-none group">
                                <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={likedOnly}
                                    onClick={() => setLikedOnly(v => !v)}
                                    className={cn(
                                        'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0',
                                        likedOnly
                                            ? 'bg-rose-500 border-rose-500'
                                            : 'border-muted-foreground/40 bg-transparent hover:border-rose-400'
                                    )}
                                >
                                    {likedOnly && <Check className="w-2.5 h-2.5 text-white" />}
                                </button>
                                <span className={cn(
                                    'text-[11px] font-black uppercase tracking-widest transition-colors',
                                    likedOnly ? 'text-rose-500' : 'text-muted-foreground group-hover:text-primary'
                                )}>
                                    Liked
                                </span>
                            </label>
                            </div>
                            {(hierClasses.length > 0 || hierSubjects.length > 0 || hierChapters.length > 0 || hierConcepts.length > 0) && (
                                <motion.div initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }}>
                                    <button
                                        type="button"
                                        onClick={handleHierarchySubmit}
                                        className="neu-btn px-6 py-2.5 text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-2 group"
                                    >
                                        Apply Filters
                                        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Search + secondary filters */}
                    <div id="secondary-filter-area" className="flex flex-wrap items-center gap-3 relative z-[40]">
                        {/* Search */}
                        <div className="min-w-0 w-full sm:flex-1 sm:min-w-[200px] neu-raised rounded-2xl flex items-center gap-3 px-4 h-11">
                            <Search className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search by title, tags or concepts…"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="flex-1 h-full bg-transparent text-[13px] font-medium text-foreground placeholder:text-muted-foreground/50 outline-none"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="p-1 rounded-full hover:bg-primary/10 transition-colors">
                                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                            )}
                        </div>

                        {/* Difficulty */}
                        <div className="relative">
                            <button
                                id="tutorial-ogcode-difficulty-filter"
                                data-filter-dropdown
                                onClick={() => setOpenDropdown(openDropdown === 'difficulty' ? null : 'difficulty')}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all',
                                    activeDifficulty !== 'All' ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {activeDifficulty === 'All' ? 'Difficulty' : activeDifficulty}
                                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', openDropdown === 'difficulty' ? '-rotate-90' : 'rotate-90')} />
                            </button>
                            {openDropdown === 'difficulty' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="absolute top-full mt-2 left-0 w-40 neu-raised rounded-xl z-50 overflow-hidden"
                                    data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                >
                                    {['All', 'Easy', 'Medium', 'Hard', 'Insane'].map(diff => (
                                        <button key={diff} onClick={() => { handleDifficultyChange(diff); setOpenDropdown(null); }}
                                            className={cn('w-full text-left px-4 py-2.5 text-[12px] transition-colors hover:bg-primary/5', activeDifficulty === diff ? 'text-primary font-bold' : 'text-muted-foreground')}
                                        >{diff}</button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Question Type */}
                        <div className="relative">
                            <button
                                data-filter-dropdown
                                onClick={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all',
                                    activeQuestionType !== 'All' ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {activeQuestionType === 'All' ? 'Type' : activeQuestionType}
                                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', openDropdown === 'type' ? '-rotate-90' : 'rotate-90')} />
                            </button>
                            {openDropdown === 'type' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="absolute top-full mt-2 left-0 w-44 neu-raised rounded-xl z-50 overflow-hidden"
                                    data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                >
                                    {['All', 'MCQ', 'MSQ', 'Integer', 'Range', 'Matrix Match'].map(qt => (
                                        <button key={qt} onClick={() => { setActiveQuestionType(qt); setOpenDropdown(null); }}
                                            className={cn('w-full text-left px-4 py-2.5 text-[12px] transition-colors hover:bg-primary/5', activeQuestionType === qt ? 'text-primary font-bold' : 'text-muted-foreground')}
                                        >{qt}</button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Status */}
                        <div className="relative">
                            <button
                                data-filter-dropdown
                                onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all',
                                    activeStatus !== 'All' ? 'neu-inset text-primary' : 'neu-raised text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {activeStatus === 'All' ? 'Status' : activeStatus}
                                <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', openDropdown === 'status' ? '-rotate-90' : 'rotate-90')} />
                            </button>
                            {openDropdown === 'status' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                    className="absolute top-full mt-2 left-0 w-40 neu-raised rounded-xl z-50 overflow-hidden"
                                    data-filter-dropdown
                                    onClick={e => e.stopPropagation()}
                                >
                                    {['All', 'Solved', 'Unsolved'].map(stat => (
                                        <button key={stat} onClick={() => { handleStatusChange(stat); setOpenDropdown(null); }}
                                            className={cn('w-full text-left px-4 py-2.5 text-[12px] transition-colors hover:bg-primary/5', activeStatus === stat ? 'text-primary font-bold' : 'text-muted-foreground')}
                                        >{stat}</button>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Institute-contributed filter (Admin Control Plane hallmark) */}
                        <button
                            onClick={() => setShowContributedOnly(v => !v)}
                            className={cn('neu-btn flex items-center gap-2 px-4 py-2 text-[12px] font-black', showContributedOnly ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}
                            title="Show only questions contributed by institutes"
                        >
                            <Building2 className="w-3.5 h-3.5" /> Institute
                        </button>

                        {/* Random pick */}
                        <button
                            onClick={() => { if (filteredQuestions.length > 0) onSelectQuestion(filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)].id); }}
                            className="neu-btn flex items-center gap-2 px-4 py-2 text-[12px] font-black text-primary"
                        >
                            <Shuffle className="w-3.5 h-3.5" /> Pick One
                        </button>
                    </div>
                </div>

                {/* ── §13 OG Friend Challenge Box ── */}
                {challengeInbox.length > 0 && (
                    <div className="mb-4 neu-raised rounded-2xl p-4">
                        <button
                            onClick={() => setChallengeBoxOpen(v => !v)}
                            className="w-full flex items-center justify-between gap-2"
                        >
                            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-foreground">
                                <Swords className="w-4 h-4 text-primary" /> OG Friend Challenges
                                {challengePending > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px]">{challengePending} new</span>
                                )}
                            </span>
                            <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', challengeBoxOpen && 'rotate-180')} />
                        </button>
                        {challengeBoxOpen && (
                            <div className="mt-3 space-y-2">
                                {challengeInbox.map((c) => (
                                    <div
                                        key={c.id}
                                        onClick={() => handleQuestionClick(c.questionId)}
                                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer"
                                    >
                                        <div className={cn('w-2 h-2 rounded-full shrink-0', c.status === 'pending' ? 'bg-primary' : 'bg-emerald-500')} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[12px] font-bold text-foreground truncate">
                                                <span className="text-primary">{c.fromName}</span> challenged you
                                            </p>
                                            <p className="text-[10px] text-muted-foreground truncate">{c.questionText}</p>
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-wider shrink-0 text-muted-foreground">
                                            {c.status === 'pending' ? 'Attempt' : `Scored ${c.resultScore ?? 0}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Question Tile Grid ── */}
                <div className="pb-4">
                    {showQuestionsSpinner ? (
                        <div className="py-20 text-center">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    ) : filteredQuestions.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                            {filteredQuestions.map((q, idx) => {
                                const conf = DIFFICULTY_CONFIG[q.difficulty?.toLowerCase()] || DIFFICULTY_CONFIG.easy;
                                const solved = q.status === 'solved' || q.isSolved;
                                return (
                                    <div
                                        key={q.id}
                                        onClick={() => handleQuestionClick(q.id)}
                                        className="neu-raised neu-pressable cursor-pointer group flex flex-col gap-3 p-4 sm:p-5 min-h-[148px]"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-[10px] font-black text-muted-foreground">#{idx + 1}</span>
                                                <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border', conf.bg, conf.darkBg, conf.textColor, conf.darkText, conf.border, conf.darkBorder)}>
                                                    {conf.icon}{conf.label}
                                                </span>
                                                {q.isContributed && q.attributionName && (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 min-w-0 max-w-[120px]"
                                                        title={`Contributed by ${q.attributionName}`}
                                                    >
                                                        {q.attributionLogoUrl
                                                            ? <Image src={q.attributionLogoUrl} alt="" width={12} height={12} className="rounded-sm object-cover flex-shrink-0" unoptimized />
                                                            : <Building2 className="w-3 h-3 flex-shrink-0" />}
                                                        <span className="truncate">{q.attributionName}</span>
                                                    </span>
                                                )}
                                                {/* Exam provenance badge — full raw value ("JEE (2020)"), coloured by family */}
                                                {q.occurrence && q.occurrence !== 'NA' && (() => {
                                                    const up = q.occurrence.toUpperCase();
                                                    const style = up.includes('NEET')
                                                        ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25'
                                                        : up.includes('AIPMT')
                                                            ? 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/25'
                                                            : up.includes('JEE')
                                                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25'
                                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25';
                                                    return (
                                                        <span
                                                            className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider min-w-0 max-w-[130px]', style)}
                                                            title={q.occurrence}
                                                        >
                                                            <span className="truncate">{q.occurrence}</span>
                                                        </span>
                                                    );
                                                })()}
                                                {/* §10 Like/unlike — interactive, right beside the difficulty/exam badges */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); void toggleCardLike(q.id); }}
                                                    disabled={likePendingIds.has(q.id)}
                                                    aria-pressed={Boolean(q.likedByMe)}
                                                    title={q.likedByMe ? 'Unlike' : 'Like this question'}
                                                    className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border transition-colors flex-shrink-0', q.likedByMe ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25' : 'text-muted-foreground bg-white/[0.03] border-white/10 hover:border-rose-500/30')}
                                                >
                                                    <Heart className={cn('w-3 h-3', q.likedByMe ? 'fill-current' : '')} />
                                                    {q.likeCount ?? 0}
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {/* §12 Live Practicing count */}
                                                {(liveCounts[q.id] ?? 0) > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400" title={`${liveCounts[q.id]} practicing now`}>
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                                                        </span>
                                                        {liveCounts[q.id]} Live
                                                    </span>
                                                )}
                                                {solved && (
                                                    <div className="flex items-center gap-1">
                                                        <Image src="/ori2d/ori-thubmsup.png" alt="Ori" width={24} height={24} className="object-contain drop-shadow" />
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 text-[13px] font-bold text-foreground leading-snug line-clamp-3 group-hover:text-primary transition-colors duration-150">
                                            {renderInlineSegments(String(q.title || q.text), `tile-${q.id}`)}
                                        </div>

                                        <div className="flex items-end justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-foreground/80 truncate">{q.chapter || 'Foundations'}</p>
                                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider truncate">{q.concept || 'JEE Advanced'}</p>
                                            </div>
                                            <button className="flex-shrink-0 inline-flex items-center gap-1 neu-btn px-3 py-1.5 text-[10px] font-black text-primary uppercase tracking-wider whitespace-nowrap">
                                                Attempt <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-muted-foreground text-sm">
                            <Image src="/ori2d/ori-curious.png" alt="Ori" width={112} height={112} className="object-contain mx-auto mb-3 drop-shadow-md" />
                            No questions found matching your criteria.
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-4 pt-6">
                        {hasMoreQuestions && (
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                disabled={questionsLoading}
                                className="neu-btn inline-flex items-center justify-center gap-2 px-6 py-2.5 text-[11px] font-black uppercase tracking-wider text-primary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {questionsLoading ? 'Loading…' : `Load ${QUESTION_PAGE_SIZE} More`}
                            </button>
                        )}
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-center">
                            {questionsLoading && questions.length > 0 ? 'Updating question list…' : questionSummaryLabel}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── How the OGCODE score works ── */}
            <AnimatePresence>
                {showScoreInfo && (
                    <motion.div
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowScoreInfo(false)} />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.94, y: 18 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 18 }}
                            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                            className={cn(
                                'relative z-10 w-full max-h-[88vh] overflow-y-auto custom-scrollbar neu-surface rounded-2xl border border-border/40 p-6',
                                scoringV2Enabled ? 'max-w-3xl' : 'max-w-md',
                            )}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-4 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 p-1">
                                        <Image src="/ori2d/ori-curious.png" alt="" width={40} height={40} draggable={false} className="object-contain select-none" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight text-foreground leading-tight">How the OG Score works</h2>
                                        <p className="text-xs text-muted-foreground">
                                            {scoringV2Enabled
                                                ? 'Base score per difficulty, scaled by speed and attempts — by question type.'
                                                : 'Two things decide your score: how hard, and how fast.'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowScoreInfo(false)}
                                    aria-label="Close"
                                    className="neu-raised flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* ── OGCode Scoring V2 explainer (flag on) ── */}
                            {scoringV2Enabled && (
                                <div className="space-y-6">
                                    {/* Score flow diagram — mirrors OGCODE_SCORING_ALGORITHM.md §6 */}
                                    <div className="neu-inset rounded-xl p-4">
                                        <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground">Score flow</p>

                                        {/* Start → Attempted? */}
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className="w-full rounded-lg neu-surface border border-border/40 px-3 py-2 text-[11px] font-bold text-foreground text-center">
                                                Start · attempted before?
                                            </div>
                                            <div className="flex items-stretch gap-2 w-full">
                                                <div className="flex-1 rounded-lg border border-rose-500/25 bg-rose-500/5 px-2 py-1.5 text-[10px] font-bold text-rose-500 text-center">
                                                    Yes → score 0 (review only)
                                                </div>
                                                <div className="flex-1 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 text-center">
                                                    No → start timer (tt) ↓
                                                </div>
                                            </div>
                                            <ChevronDown className="w-4 h-4 text-primary" />
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Branch by question type</p>
                                        </div>

                                        {/* Per-type branches */}
                                        <div className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-2">
                                            {[
                                                { t: 'MCQ', sub: '3 tries', body: 'Correct → CS_core ÷ tries. 3 misses → answer shown, 0.', cls: 'border-blue-500/25 bg-blue-500/5' },
                                                { t: 'Numerical / Range', sub: '4 tries', body: 'Correct → CS_core ÷ tries. Cap reached → 0.', cls: 'border-blue-500/25 bg-blue-500/5' },
                                                { t: 'MSQ / Matrix', sub: '1 submit', body: 'JEE marking: full / partial / 0 / negative for a wrong pick.', cls: 'border-amber-500/25 bg-amber-500/5' },
                                                { t: 'Subjective', sub: '1 submit', body: 'Correct → bs. Wrong → 0. No time term.', cls: 'border-purple-500/25 bg-purple-500/5' },
                                            ].map((b) => (
                                                <div key={b.t} className={cn('rounded-lg border px-2 py-2', b.cls)}>
                                                    <div className="text-[10px] font-black text-foreground leading-tight">{b.t}</div>
                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{b.sub}</div>
                                                    <div className="text-[9px] text-muted-foreground leading-snug">{b.body}</div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Reveal decay → formula */}
                                        <div className="mt-2 flex flex-col items-center gap-1.5">
                                            <ChevronDown className="w-4 h-4 text-primary" />
                                            <div className="w-full rounded-lg border border-border/40 bg-white/[0.03] px-2 py-1.5 text-[10px] font-bold text-foreground text-center">
                                                Reveal (first time only): Hint → bs ÷ 2 · Answer → 0
                                            </div>
                                            <ChevronDown className="w-4 h-4 text-primary" />
                                            <div className="w-full rounded-lg neu-surface border border-primary/30 bg-primary/5 px-2 py-2 text-center">
                                                <span className="text-[11px] sm:text-[13px] font-black text-primary tabular-nums">CS_core = min(1, bt ÷ tt) × bs ÷ attempts</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Base score + base time per difficulty */}
                                    <div>
                                        <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                            <Target className="h-3.5 w-3.5 text-amber-500" /> Base score (bs) &amp; base time (bt) by difficulty
                                        </p>
                                        <div className="grid grid-cols-4 gap-2">
                                            {[
                                                { label: 'Easy', bs: 5, bt: '30s', cls: 'text-emerald-500' },
                                                { label: 'Medium', bs: 15, bt: '60s', cls: 'text-amber-500' },
                                                { label: 'Hard', bs: 30, bt: '100s', cls: 'text-rose-500' },
                                                { label: 'Insane', bs: 50, bt: '120s', cls: 'text-indigo-500' },
                                            ].map((d) => (
                                                <div key={d.label} className="neu-inset rounded-xl px-2 py-2.5 text-center">
                                                    <div className={cn('text-lg font-black leading-none tabular-nums', d.cls)}>{d.bs}</div>
                                                    <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{d.label}</div>
                                                    <div className="text-[9px] text-muted-foreground/80">{d.bt}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-[10px] text-muted-foreground/80 text-center">
                                            Faster than the base time earns up to full <span className="font-bold">bs</span> (capped at 1×); slower shrinks it.
                                        </p>
                                    </div>

                                    {/* Per-type rules */}
                                    <div>
                                        <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                            <Zap className="h-3.5 w-3.5 text-emerald-500" /> How each question type scores
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {[
                                                { t: 'MCQ', d: 'Up to 3 in-place tries; score = time-scaled bs ÷ attempts. 3 misses → answer shown, 0 marks.' },
                                                { t: 'Numerical / Range', d: 'Up to 4 tries; same time-scaled bs ÷ attempts. Cap reached → 0.' },
                                                { t: 'MSQ', d: 'Single submit, JEE Advanced marking: full / partial / 0, and negative for any wrong pick.' },
                                                { t: 'Matrix Match', d: 'Single submit; per-row credit against bs, negative for a wrong row.' },
                                                { t: 'Subjective', d: 'Single submit; full bs if correct, else 0 — no time term.' },
                                                { t: 'Hint / Answer', d: 'Revealing a hint halves bs; revealing the answer sets it to 0 — once, on first reveal.' },
                                            ].map((r) => (
                                                <div key={r.t} className="neu-inset rounded-xl px-3 py-2.5">
                                                    <div className="text-[11px] font-black text-foreground">{r.t}</div>
                                                    <div className="mt-0.5 text-[10px] text-muted-foreground leading-snug">{r.d}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* MSQ — full JEE Advanced marking table */}
                                    <div>
                                        <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                            <Layers className="h-3.5 w-3.5 text-amber-500" /> MSQ — JEE Advanced marking
                                        </p>
                                        <div className="neu-inset rounded-xl px-4 py-3 space-y-1.5">
                                            {[
                                                { m: '+4', d: 'All correct options chosen (and no wrong option)', cls: 'text-emerald-500' },
                                                { m: '+3', d: 'All four options are correct, but only three chosen', cls: 'text-emerald-500' },
                                                { m: '+2', d: 'Three or more correct, but only two correct chosen', cls: 'text-emerald-500' },
                                                { m: '+1', d: 'Two or more correct, but only one correct chosen', cls: 'text-emerald-500' },
                                                { m: '0', d: 'No option chosen (unattempted)', cls: 'text-muted-foreground' },
                                                { m: '−2', d: 'Any wrong option selected (with or without correct ones)', cls: 'text-rose-500' },
                                            ].map((row) => (
                                                <div key={row.m} className="flex items-center gap-3 text-[11px]">
                                                    <span className={cn('w-7 shrink-0 text-right font-black tabular-nums', row.cls)}>{row.m}</span>
                                                    <span className="text-muted-foreground leading-snug">{row.d}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-[10px] text-muted-foreground/80">
                                            OGCode scales these JEE marks by each question’s base score (bs), so the +4 / +3 / +2 / +1 / 0 / −2 structure is identical, just weighted by difficulty. Matrix Match uses the same full / partial / negative approach per row.
                                        </p>
                                    </div>

                                    <div className="space-y-2 rounded-xl neu-inset px-4 py-3">
                                        {[
                                            { good: true, text: 'A question is scored only the first time you finish it — re-attempts don’t re-score.' },
                                            { good: true, text: 'Answer faster to keep more of the base score; extra attempts divide it down.' },
                                            { good: false, text: 'MSQ / Matrix Match can go negative for wrong picks (your lifetime total never drops below 0).' },
                                        ].map((r, i) => (
                                            <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/90">
                                                {r.good
                                                    ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                                                    : <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-500" />}
                                                <span>{r.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── Legacy scoring explainer (flag off / current prod) ── */}
                            {!scoringV2Enabled && (<>
                            {/* The exact formula, up front */}
                            <div className="neu-inset rounded-xl px-4 py-3.5 text-center mb-6">
                                <p className="text-[15px] font-black text-foreground tabular-nums leading-tight flex items-center justify-center gap-1.5 flex-wrap">
                                    <span className="text-amber-500">Base</span>
                                    <span className="text-muted-foreground">×</span>
                                    <span className="text-emerald-500">Speed</span>
                                    <span className="text-muted-foreground">+ 5</span>
                                </p>
                                <p className="mt-1 text-[11px] text-muted-foreground">The base value, scaled by how fast you solve it, plus a 5-point floor.</p>
                            </div>

                            {/* Step 1 — Base value by difficulty */}
                            <div className="mb-6">
                                <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                    <Target className="h-3.5 w-3.5 text-amber-500" /> 1 · The base value
                                </p>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { label: 'Easy', pts: 10, cls: 'text-emerald-500' },
                                        { label: 'Medium', pts: 25, cls: 'text-amber-500' },
                                        { label: 'Hard', pts: 50, cls: 'text-rose-500' },
                                        { label: 'Insane', pts: 100, cls: 'text-indigo-500' },
                                    ].map((d) => (
                                        <div key={d.label} className="neu-inset rounded-xl px-2 py-2.5 text-center">
                                            <div className={cn('text-lg font-black leading-none tabular-nums', d.cls)}>{d.pts}</div>
                                            <div className="mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{d.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Step 2 — Speed multiplier */}
                            <div className="mb-6">
                                <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                    <Zap className="h-3.5 w-3.5 text-emerald-500" /> 2 · The speed multiplier
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { band: 'Fast', cond: '≤ ½ target time', mult: '1.35×', cls: 'text-emerald-500' },
                                        { band: 'On time', cond: 'at target time', mult: '1.0×', cls: 'text-amber-500' },
                                        { band: 'Slow', cond: '> 1.75× target', mult: '0.55×', cls: 'text-rose-500' },
                                    ].map((s) => (
                                        <div key={s.band} className="neu-inset rounded-xl px-2 py-2.5 text-center">
                                            <div className={cn('text-base font-black leading-none tabular-nums', s.cls)}>{s.mult}</div>
                                            <div className="mt-1 text-[10px] font-bold text-foreground">{s.band}</div>
                                            <div className="text-[9px] text-muted-foreground leading-tight mt-0.5">{s.cond}</div>
                                        </div>
                                    ))}
                                </div>
                                <p className="mt-2 text-[10px] text-muted-foreground/80 text-center">
                                    Scales smoothly in between. Target time — Easy 45s · Medium 90s · Hard 180s · Insane 300s.
                                </p>
                            </div>

                            {/* Worked example — the "aha" */}
                            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                                <p className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-primary">
                                    See it: one <span className="text-rose-500">Hard</span> question (base 50)
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { band: 'Fast', mult: '×1.35', pts: 73, cls: 'text-emerald-500' },
                                        { band: 'On time', mult: '×1.0', pts: 55, cls: 'text-amber-500' },
                                        { band: 'Slow', mult: '×0.55', pts: 33, cls: 'text-rose-500' },
                                    ].map((e) => (
                                        <div key={e.band} className="rounded-lg neu-surface border border-border/40 px-2 py-2.5 text-center">
                                            <div className="text-[10px] font-bold text-muted-foreground">{e.band}</div>
                                            <div className={cn('text-[10px] font-black tabular-nums mt-0.5', e.cls)}>{e.mult}</div>
                                            <div className="mt-1 text-xl font-black text-foreground tabular-nums leading-none">{e.pts}</div>
                                            <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">points</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* The rules that actually matter */}
                            <div className="space-y-2 rounded-xl neu-inset px-4 py-3">
                                {[
                                    { good: true, text: 'A correct answer earns the points above — never less than 5.' },
                                    { good: false, text: 'A wrong answer scores 0. Retry as many times as you like.' },
                                    { good: true, text: 'It counts toward your rank only the first time you solve it.' },
                                ].map((r, i) => (
                                    <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/90">
                                        {r.good
                                            ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                                            : <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-500" />}
                                        <span>{r.text}</span>
                                    </div>
                                ))}
                            </div>
                            </>)}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
