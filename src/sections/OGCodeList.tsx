'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
    CheckCircle2, Code2, Search,
    Trophy, Zap, Flame, Brain, Circle,
    TrendingUp, Atom, Beaker, Calculator, Leaf,
    ChevronRight, Target, Shuffle, ArrowRight
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { PracticeQuestion, SubjectRank, User } from '@/types';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { toast } from 'sonner';

interface OGCodeListProps {
    onSelectQuestion: (questionId: string) => void;
    user: User;
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

const SUBJECT_COLORS: Record<string, string> = {
    Physics: 'text-blue-500',
    Chemistry: 'text-sky-500',
    Mathematics: 'text-indigo-500',
    Biology: 'text-emerald-500',
};

const ORIGIN_AI_VISIBLE_QUESTION_LIMIT = 40;

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

function normalizeDifficulty(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function normalizeStatus(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

interface UserStats {
    rank: number | null;
    accuracy: number;
    solvedCount: number;
    syllabusCoverage: number;
    streak: number;
    totalAttempts: number;
}

export default function OGCodeList({ onSelectQuestion, user }: OGCodeListProps) {
    const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
    const [subjectRanks, setSubjectRanks] = useState<SubjectRank[]>([]);
    const [loading, setLoading] = useState(true);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSubject, setActiveSubject] = useState('Subject');
    const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    
    const [activeDifficulty, setActiveDifficulty] = useState('All');
    const [activeStatus, setActiveStatus] = useState('All');
    const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
    const [openDropdown, setOpenDropdown] = useState<'difficulty' | 'status' | 'subject' | null>(null);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);
    // Refs for click-outside detection
    const statsRef = useRef<HTMLDivElement>(null);

    // Combined click-outside detection for stats and dropdowns
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Stats dropdown
            if (statsRef.current && !statsRef.current.contains(event.target as Node)) {
                setIsStatsExpanded(false);
            }
            // General filter dropdowns
            const filterContainer = document.getElementById('filter-area');
            if (filterContainer && !filterContainer.contains(event.target as Node)) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [qData, rData, statsData] = await Promise.all([
                apiCall('/assessments/ogcode/questions/'),
                apiCall(`/assessments/ogcode/leaderboard/subjects/?time_range=${timeRange}`),
                apiCall('/assessments/ogcode/user-stats/'),
            ]);
            setQuestions(Array.isArray(qData) ? qData : []);
            setSubjectRanks(Array.isArray(rData) ? rData : []);
            setUserStats(statsData);
        } catch (error) {
            console.error('Failed to fetch OGCode data:', error);
            toast.error('Failed to load questions');
        } finally {
            setLoading(false);
        }
    }, [timeRange]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Extract unique chapters based on active subject
    const availableChapters = useMemo(() => {
        const subjectQuestions = questions.filter(q => 
            activeSubject === 'Subject' || normalizeSubject(q.subject) === normalizeSubject(activeSubject)
        );
        const chapters = new Set(subjectQuestions.map(q => q.chapter || 'Foundations'));
        return Array.from(chapters).sort();
    }, [questions, activeSubject]);

    // Reset selected chapters when subject changes
    useEffect(() => {
        setSelectedChapters([]);
    }, [activeSubject]);

    const toggleChapter = (chapter: string) => {
        setSelectedChapters(prev => 
            prev.includes(chapter) 
                ? prev.filter(c => c !== chapter) 
                : [...prev, chapter]
        );
    };

    const filteredQuestions = useMemo(() => {
        return questions.filter(q => {
            const matchesSearch = (q.text || q.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                normalizeTags(q.tags).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
            
            const matchesSubject =
                activeSubject === 'Subject' ||
                normalizeSubject(q.subject) === normalizeSubject(activeSubject);
            
            const matchesChapter = 
                selectedChapters.length === 0 || 
                selectedChapters.includes(q.chapter || 'Foundations');
            
            const qDifficulty = normalizeDifficulty(q.difficulty);
            const matchesDifficulty = activeDifficulty === 'All' || qDifficulty === normalizeDifficulty(activeDifficulty);
            
            const isSolved = normalizeStatus(q.status) === 'solved' || q.isSolved === true;
            const matchesStatus = 
                activeStatus === 'All' || 
                (activeStatus === 'Solved' && isSolved) || 
                (activeStatus === 'Unsolved' && !isSolved);
                
            return matchesSearch && matchesSubject && matchesChapter && matchesDifficulty && matchesStatus;
        });
    }, [questions, searchQuery, activeSubject, activeDifficulty, activeStatus, selectedChapters]);

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

    const solvedCount = userStats?.solvedCount ?? questions.filter(q => q.status === 'solved' || q.isSolved).length;
    const myRank = userStats?.rank;
    const accuracy = userStats?.accuracy ?? 0;
    const syllabusCoverage = userStats?.syllabusCoverage ?? 0;
    const streak = userStats?.streak ?? user.streak ?? 0;

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-blue-500/30 px-4 sm:px-6 lg:px-8 pb-16 transition-colors duration-500">
            {/* Professional Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-background/20 dark:bg-transparent" />

            <div className="max-w-7xl mx-auto relative z-10 pt-6">
                <div className="space-y-6">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8">
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className="space-y-3"
                        >
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100/50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20 backdrop-blur-md mb-2">
                                <Code2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-600 dark:text-blue-400 uppercase">Practice Arena</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground leading-tight">
                                Welcome to <span className="text-blue-500">OGCode</span>
                            </h1>
                            <p className="text-muted-foreground font-light max-w-xl text-base">
                                Master complex concepts through structured practice, build your streak, and climb the national leaderboard.
                            </p>
                        </motion.div>

                        <div ref={statsRef} className="relative self-start z-[50]">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                                className={cn(
                                    "flex items-center gap-3 px-5 py-3 rounded-xl border transition-all duration-300 shadow-lg",
                                    isStatsExpanded 
                                        ? "bg-primary border-primary text-primary-foreground" 
                                        : "bg-card/80 backdrop-blur-xl border-border text-foreground"
                                )}
                            >
                                <div className={cn("p-1.5 rounded-lg", isStatsExpanded ? "bg-accent" : "bg-amber-500/10")}>
                                    <Trophy className={cn("w-4 h-4", isStatsExpanded ? "text-white" : "text-amber-500")} />
                                </div>
                                <div className="text-left">
                                    <div className="text-[9px] font-black uppercase tracking-tighter opacity-60">National Rank</div>
                                    <div className="text-lg font-black leading-none">AIR {myRank ? `#${myRank}` : '—'}</div>
                                </div>
                                <ChevronRight className={cn("w-4 h-4 ml-2 transition-transform duration-300", isStatsExpanded ? "rotate-90" : "")} />
                            </motion.button>

                            <AnimatePresence>
                                {isStatsExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="absolute top-full right-0 mt-4 w-[320px] md:w-[380px] z-[100] space-y-4 pointer-events-auto"
                                    >
                                        <div className="bg-card border border-border p-6 rounded-3xl shadow-2xl">
                                            <h3 className="text-[11px] font-black text-blue-600 dark:text-blue-400 tracking-[0.3em] uppercase mb-4 flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/10 rounded-xl">
                                                    <TrendingUp className="w-4 h-4" />
                                                </div>
                                                Mastery Analytics
                                            </h3>
                                            <div className="space-y-3">
                                                {[
                                                    { label: 'Current Streak', val: `${streak}d`, icon: <Flame className="w-4 h-4" />, color: 'text-orange-500' },
                                                    { label: 'Solved Questions', val: solvedCount, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-blue-500' },
                                                    { label: 'Accuracy Rate', val: `${accuracy}%`, icon: <Target className="w-4 h-4" />, color: 'text-emerald-500' },
                                                    { label: 'Prestige Points', val: user.points || 0, icon: <Zap className="w-4 h-4" />, color: 'text-indigo-500' },
                                                ].map((stat, idx) => (
                                                    <div key={idx} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("p-2 rounded-lg bg-muted/50", stat.color)}>
                                                                {stat.icon}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                                                                <span className="text-sm font-black text-foreground">{stat.val}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="pt-4 mt-2 border-t border-border space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Syllabus Coverage</span>
                                                        <span className="text-[11px] font-black text-blue-500">{syllabusCoverage}%</span>
                                                    </div>
                                                    <div className="relative h-2.5 bg-muted rounded-full overflow-hidden p-0.5">
                                                        <motion.div initial={{ width: 0 }} animate={{ width: `${syllabusCoverage}%` }} className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-card border border-border p-6 rounded-3xl shadow-2xl">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-[11px] font-black text-amber-600 dark:text-amber-400 tracking-[0.3em] uppercase flex items-center gap-3">
                                                    <div className="p-2 bg-amber-500/10 rounded-xl">
                                                        <Trophy className="w-4 h-4" />
                                                    </div>
                                                    Arena Rankings
                                                </h3>
                                                <div className="flex bg-muted/50 p-1 rounded-xl">
                                                    {(['daily', 'weekly'] as const).map((r) => (
                                                        <button
                                                            key={r}
                                                            type="button"
                                                            onClick={() => setTimeRange(r)}
                                                            className={cn(
                                                                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer", 
                                                                timeRange === r 
                                                                    ? "bg-background text-foreground shadow-sm" 
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {subjectRanks.map((rank, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2.5 rounded-xl transition-all hover:bg-accent/50 group/rank">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("p-2 rounded-lg bg-muted/50", SUBJECT_COLORS[rank.subject]?.split(' ')[0])}>
                                                                {SUBJECT_ICONS[rank.subject] || <Code2 className="w-3.5 h-3.5" />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <div className="text-[11px] font-bold text-foreground uppercase tracking-wider">{rank.subject}</div>
                                                                <div className="text-[9px] font-bold text-blue-600/80 dark:text-blue-400/80">{rank.rankScore || 0} Points</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <div className="text-[8px] font-black text-muted-foreground/60 uppercase">AIR</div>
                                                            <div className="text-sm font-black text-blue-500">#{rank.rankPosition || rank.rank}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        setIsStatsExpanded(false);
                                                        onSelectQuestion('leaderboard');
                                                    }}
                                                    className="w-full pt-4 mt-2 border-t border-slate-200/50 dark:border-white/5 text-[10px] font-black text-blue-600 hover:text-blue-500 uppercase tracking-[0.2em] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                                                >
                                                    Global Leaderboard <ArrowRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Filter & Table Area */}
                    <div className="space-y-6">
                        {/* Enhanced Subject & Chapter Filter */}
                        <div id="filter-area" className="space-y-4 bg-card border border-border rounded-2xl p-5 backdrop-blur-md relative z-[10] shadow-sm">
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Major Subject</label>
                                    <div className="relative">
                                        <button 
                                            onClick={() => setOpenDropdown(openDropdown === 'subject' ? null : 'subject')}
                                            className={cn(
                                                "min-w-[200px] flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border bg-card transition-all shadow-sm",
                                                activeSubject !== 'Subject' ? "border-blue-500/50 ring-1 ring-blue-500/20" : "border-border"
                                            )}
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className="text-blue-500">{SUBJECTS.find(s => s.name === activeSubject)?.icon}</span>
                                                <span className="text-[13px] font-bold text-foreground">{activeSubject}</span>
                                            </div>
                                            <ChevronRight className={cn("w-4 h-4 transition-transform", openDropdown === 'subject' ? "-rotate-90" : "rotate-90")} />
                                        </button>
                                        
                                        <AnimatePresence>
                                            {openDropdown === 'subject' && (
                                                    <motion.div 
                                                        initial={{ opacity: 0, y: 10, scale: 0.98 }} 
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                                        className="absolute top-full mt-2 left-0 w-[240px] bg-card border border-border rounded-2xl shadow-2xl z-[100] overflow-hidden p-2"
                                                    >
                                                    <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-2 mb-1">Select Major</div>
                                                    {SUBJECTS.map((sub, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => {
                                                                setActiveSubject(sub.name);
                                                                setOpenDropdown(null);
                                                            }}
                                                            className={cn(
                                                                "w-full flex items-center gap-3 px-4 py-3 text-left text-[13px] transition-all rounded-xl group/item",
                                                                activeSubject === sub.name 
                                                                    ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10" 
                                                                    : "text-muted-foreground hover:text-foreground hover:bg-accent hover:translate-x-1"
                                                            )}
                                                        >
                                                            <span className={cn(
                                                                "transition-transform group-hover/item:scale-110",
                                                                activeSubject === sub.name ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/60"
                                                            )}>
                                                                {sub.icon}
                                                            </span>
                                                            <span className="flex-1">{sub.name}</span>
                                                            {activeSubject === sub.name && (
                                                                <div className="relative flex h-2 w-2">
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                                </div>
                                                            )}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                <AnimatePresence>
                                    {activeSubject !== 'Subject' && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, height: 'auto', scale: 1 }}
                                            exit={{ opacity: 0, height: 0, scale: 0.98 }}
                                            className="flex-1 min-w-[400px] bg-muted/30 dark:bg-muted/10 border border-border/50 rounded-2xl p-4 ml-2 shadow-sm space-y-3"
                                        >
                                            <div className="flex items-center justify-between ml-1">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Target Chapters</label>
                                                    <span className="px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase tracking-tighter">Multi-select</span>
                                                </div>
                                                <button 
                                                    onClick={() => setSelectedChapters([])}
                                                    className="text-[9px] font-black uppercase text-blue-500 hover:text-blue-600 transition-colors"
                                                    disabled={selectedChapters.length === 0}
                                                >
                                                    Clear All
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-2 custom-scrollbar p-1">
                                                {availableChapters.length > 0 ? (
                                                    availableChapters.map((chapter) => (
                                                        <button
                                                            key={chapter}
                                                            onClick={() => toggleChapter(chapter)}
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all",
                                                                selectedChapters.includes(chapter)
                                                                    ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30 -translate-y-0.5"
                                                                    : "bg-card border-border text-muted-foreground hover:border-blue-500/50 hover:bg-accent"
                                                            )}
                                                        >
                                                            <div className={cn(
                                                                "w-3 h-3 rounded-sm border flex items-center justify-center transition-colors",
                                                                selectedChapters.includes(chapter) ? "bg-white border-white" : "border-input"
                                                            )}>
                                                                {selectedChapters.includes(chapter) && <div className="w-1.5 h-1.5 bg-blue-600 rounded-[1px]" />}
                                                            </div>
                                                            {chapter}
                                                        </button>
                                                    ))
                                                ) : (
                                                    <div className="text-[11px] font-medium text-muted-foreground/60 italic py-2">No chapters found for this subject.</div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {selectedChapters.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-end pb-1"
                                    >
                                        <button 
                                            onClick={() => {
                                                const tableEl = document.querySelector('table');
                                                tableEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                toast.success(`Filters applied for ${selectedChapters.length} chapters`);
                                            }}
                                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 group"
                                        >
                                            Proceed to Arena
                                            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 py-2">
                            <div className="flex-1 min-w-[300px] relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                                <input
                                    type="text"
                                    placeholder="Search by title, tags or concepts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-[13px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all shadow-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <button onClick={() => setOpenDropdown(openDropdown === 'difficulty' ? null : 'difficulty')} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-transparent transition-all shadow-sm", activeDifficulty !== 'All' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-muted/50 text-muted-foreground hover:bg-accent")}>
                                        {activeDifficulty === 'All' ? 'Difficulty' : activeDifficulty} 
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", openDropdown === 'difficulty' ? "-rotate-90" : "rotate-90")} />
                                    </button>
                                    <AnimatePresence>
                                        {openDropdown === 'difficulty' && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10, scale: 0.98 }} 
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                                className="absolute top-full mt-2 left-0 w-48 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden p-2" 
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-2 mb-1">Set Difficulty</div>
                                                {['All', 'Easy', 'Medium', 'Hard', 'Insane'].map((diff) => (
                                                    <button 
                                                        key={diff} 
                                                        onClick={() => { setActiveDifficulty(diff); setOpenDropdown(null); }} 
                                                        className={cn(
                                                            "w-full text-left px-4 py-2.5 text-[13px] transition-all rounded-xl group/item flex items-center justify-between", 
                                                            activeDifficulty === diff 
                                                                ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10" 
                                                                : "text-muted-foreground hover:text-foreground hover:bg-accent hover:translate-x-1"
                                                        )}
                                                    >
                                                        {diff}
                                                        {activeDifficulty === diff && (
                                                            <div className="relative flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="relative">
                                    <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-transparent transition-all shadow-sm", activeStatus !== 'All' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-muted/50 text-muted-foreground hover:bg-accent")}>
                                        {activeStatus === 'All' ? 'Status' : activeStatus} 
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", openDropdown === 'status' ? "-rotate-90" : "rotate-90")} />
                                    </button>
                                    <AnimatePresence>
                                        {openDropdown === 'status' && (
                                            <motion.div 
                                                initial={{ opacity: 0, y: 10, scale: 0.98 }} 
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                                                className="absolute top-full mt-2 left-0 w-48 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden p-2" 
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 px-4 py-2 mb-1">Set Status</div>
                                                {['All', 'Solved', 'Unsolved'].map((stat) => (
                                                    <button 
                                                        key={stat} 
                                                        onClick={() => { setActiveStatus(stat); setOpenDropdown(null); }} 
                                                        className={cn(
                                                            "w-full text-left px-4 py-2.5 text-[13px] transition-all rounded-xl group/item flex items-center justify-between", 
                                                            activeStatus === stat 
                                                                ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10" 
                                                                : "text-muted-foreground hover:text-foreground hover:bg-accent hover:translate-x-1"
                                                        )}
                                                    >
                                                        {stat}
                                                        {activeStatus === stat && (
                                                            <div className="relative flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                            </div>
                                                        )}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <button onClick={() => { if (filteredQuestions.length > 0) onSelectQuestion(filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)].id); }} className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-full text-[13px] font-black transition-all border border-blue-500/30"><Shuffle className="w-3.5 h-3.5" /> Pick One</button>
                            </div>
                        </div>

                        <div className="overflow-hidden bg-card rounded-2xl border border-border shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-muted/30">
                                    <tr className="border-b border-border text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Title</th>
                                        <th className="px-6 py-4">Chapter & Concept</th>
                                        <th className="px-6 py-4">Difficulty</th>
                                        <th className="px-6 py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {loading ? (
                                        <tr><td colSpan={5} className="py-20 text-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
                                    ) : (
                                        filteredQuestions.map((q, idx) => {
                                            const conf = DIFFICULTY_CONFIG[q.difficulty?.toLowerCase()] || DIFFICULTY_CONFIG.easy;
                                            return (
                                                <tr key={q.id} onClick={() => onSelectQuestion(q.id)} className={cn("group cursor-pointer transition-colors border-b last:border-0 border-border hover:bg-accent/50")}>
                                                    <td className="px-6 py-4">{(normalizeStatus(q.status) === 'solved' || q.isSolved) ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-1 bg-muted rounded-full" />}</td>
                                                    <td className="px-6 py-4 font-black text-[14px] text-foreground group-hover:text-blue-500 transition-colors">{idx + 1}. {q.title || q.text}</td>
                                                    <td className="px-6 py-4"><div className="space-y-0.5"><div className="text-[12px] font-black text-foreground/80">{q.chapter || 'Foundations'}</div><div className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">{q.concept || 'JEE Advanced'}</div></div></td>
                                                    <td className={cn("px-6 py-4 font-black text-[13px]", conf.darkText)}>{conf.label}</td>
                                                    <td className="px-6 py-4 text-right"><button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-600 hover:text-white text-blue-500 text-[11px] font-black uppercase tracking-wider transition-all group/btn shadow-sm">Attempt Now <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" /></button></td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Overlay removed in favor of id-based click-outside */}
            <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }` }} />
        </div>
    );
}
