'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
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
import { toast } from 'sonner';

interface OGCodeListProps {
    onSelectQuestion: (questionId: string) => void;
    user: User;
}

const SUBJECTS = [
    { name: 'All Topics', icon: <Brain className="w-4 h-4" /> },
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
    const [activeSubject, setActiveSubject] = useState('All Topics');
    const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    
    const [activeDifficulty, setActiveDifficulty] = useState('All');
    const [activeStatus, setActiveStatus] = useState('All');
    const [openDropdown, setOpenDropdown] = useState<'difficulty' | 'status' | null>(null);
    const [isStatsExpanded, setIsStatsExpanded] = useState(false);

    // Refs for click-outside detection
    const statsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (statsRef.current && !statsRef.current.contains(event.target as Node)) {
                setIsStatsExpanded(false);
            }
        }
        if (isStatsExpanded) {
            document.addEventListener("mousedown", handleClickOutside);
        } else {
            document.removeEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isStatsExpanded]);

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

    const filteredQuestions = questions.filter(q => {
        const matchesSearch = (q.text || q.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            normalizeTags(q.tags).some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesSubject = activeSubject === 'All Topics' || q.subject === activeSubject;
        
        const qDifficulty = q.difficulty?.toLowerCase();
        const matchesDifficulty = activeDifficulty === 'All' || qDifficulty === activeDifficulty.toLowerCase();
        
        const isSolved = q.status === 'solved' || q.isSolved;
        const matchesStatus = activeStatus === 'All' || (activeStatus === 'Solved' ? isSolved : !isSolved);
            
        return matchesSearch && matchesSubject && matchesDifficulty && matchesStatus;
    });

    const solvedCount = userStats?.solvedCount ?? questions.filter(q => q.status === 'solved' || q.isSolved).length;
    const myRank = userStats?.rank;
    const accuracy = userStats?.accuracy ?? 0;
    const syllabusCoverage = userStats?.syllabusCoverage ?? 0;
    const streak = userStats?.streak ?? user.streak ?? 0;

    return (
        <div className="min-h-screen bg-white dark:bg-black text-slate-900 dark:text-slate-100 font-sans selection:bg-blue-500/30 px-4 sm:px-6 lg:px-8 pb-16 transition-colors duration-500">
            {/* Professional Background */}
            <div className="fixed inset-0 z-0 pointer-events-none bg-slate-50/20 dark:bg-transparent" />

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
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                OG<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 dark:from-blue-400 dark:to-blue-200">CODE</span> WORKSPACE
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400 font-light max-w-xl text-base">
                                Master complex concepts through structured practice, build your streak, and climb the national leaderboard.
                            </p>
                        </motion.div>

                        {/* AIR Badge & Stats Dropdown */}
                        <div ref={statsRef} className="relative self-start z-[50]">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsStatsExpanded(!isStatsExpanded)}
                                className={cn(
                                    "flex items-center gap-3 px-5 py-3 rounded-xl border transition-all duration-300 shadow-lg",
                                    isStatsExpanded 
                                        ? "bg-primary border-primary text-primary-foreground" 
                                        : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                                )}
                            >
                                <div className={cn("p-1.5 rounded-lg", isStatsExpanded ? "bg-white/20" : "bg-amber-100 dark:bg-amber-500/20")}>
                                    <Trophy className={cn("w-4 h-4", isStatsExpanded ? "text-white" : "text-amber-500")} />
                                </div>
                                <div className="text-left">
                                    <div className="text-[9px] font-black uppercase tracking-tighter opacity-60">National Rank</div>
                                    <div className="text-lg font-black leading-none">AIR {myRank ? `#${myRank}` : '—'}</div>
                                </div>
                                <ChevronRight className={cn("w-4 h-4 ml-2 transition-transform duration-300", isStatsExpanded ? "rotate-90" : "")} />
                            </motion.button>

                            {/* Stats Dropdown Card */}
                            <AnimatePresence>
                                {isStatsExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.2, ease: "easeOut" }}
                                        className="absolute top-full right-0 mt-4 w-[320px] md:w-[380px] z-[100] space-y-4 pointer-events-auto"
                                    >
                                        {/* Mastery Index Card */}
                                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl">
                                            <h3 className="text-[11px] font-black text-blue-600 dark:text-blue-400 tracking-[0.3em] uppercase mb-4 flex items-center gap-3">
                                                <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
                                                    <TrendingUp className="w-4 h-4" />
                                                </div>
                                                Mastery Analytics
                                            </h3>
                                            <div className="space-y-3">
                                                {[
                                                    { label: 'Current Streak', val: `${streak}d`, icon: Flame, color: 'text-orange-500' },
                                                    { label: 'Solved Questions', val: solvedCount, icon: CheckCircle2, color: 'text-blue-500' },
                                                    { label: 'Accuracy Rate', val: `${accuracy}%`, icon: Target, color: 'text-emerald-500' },
                                                    { label: 'Prestige Points', val: user.points || 0, icon: Zap, color: 'text-indigo-500' },
                                                ].map((stat, idx) => (
                                                    <div key={idx} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-white/5", stat.color)}>
                                                                <stat.icon className="w-4 h-4" />
                                                            </div>
                                                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{stat.label}</span>
                                                        </div>
                                                        <span className="text-sm font-black text-slate-900 dark:text-white">{stat.val}</span>
                                                    </div>
                                                ))}
                                                <div className="pt-4 mt-2 border-t border-slate-200/50 dark:border-white/5 space-y-2">
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Syllabus Coverage</span>
                                                        <span className="text-base font-black text-blue-600 dark:text-blue-400">{syllabusCoverage}%</span>
                                                    </div>
                                                <div className="relative h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                                                    <motion.div initial={{ width: 0 }} animate={{ width: `${syllabusCoverage}%` }} className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                                                </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Arena Rankings Card */}
                                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-3xl border border-slate-200 dark:border-slate-800 p-6 rounded-3xl shadow-xl">
                                            <div className="flex items-center justify-between mb-6">
                                                <h3 className="text-[11px] font-black text-amber-600 dark:text-amber-400 tracking-[0.3em] uppercase flex items-center gap-3">
                                                    <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                                                        <Trophy className="w-4 h-4" />
                                                    </div>
                                                    Arena Rankings
                                                </h3>
                                                <div className="flex bg-slate-100 dark:bg-black/40 p-1 rounded-xl">
                                                    {['daily', 'weekly'].map((r) => (
                                                        <button
                                                            key={r}
                                                            type="button"
                                                            onClick={() => setTimeRange(r as any)}
                                                            className={cn(
                                                                "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer", 
                                                                timeRange === r 
                                                                    ? "bg-blue-600 text-white shadow-lg" 
                                                                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                                            )}
                                                        >
                                                            {r}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="space-y-4">
                                                {subjectRanks.map((rank, i) => (
                                                    <div key={i} className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-white/5", SUBJECT_COLORS[rank.subject]?.split(' ')[0])}>
                                                                {SUBJECT_ICONS[rank.subject]}
                                                            </div>
                                                            <div className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">{rank.subject}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-sm font-black text-amber-500">#{rank.rankPosition || rank.rank}</div>
                                                            <div className="text-[8px] font-black text-slate-400 uppercase">AIR</div>
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
                        <div className="flex flex-wrap gap-3">
                            {SUBJECTS.map((sub, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveSubject(sub.name)}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                        activeSubject === sub.name ? "bg-white text-slate-900 shadow-md" : "bg-slate-100/50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10"
                                    )}
                                >
                                    <span className={cn(activeSubject === sub.name ? "text-blue-500" : "text-slate-400")}>{sub.icon}</span>
                                    {sub.name}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 py-2">
                            <div className="flex-1 min-w-[300px] relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by title, tags or concepts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-100/50 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-lg text-[13px] font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all shadow-sm"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <button onClick={() => setOpenDropdown(openDropdown === 'difficulty' ? null : 'difficulty')} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-transparent transition-all", activeDifficulty !== 'All' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-slate-100/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10")}>
                                        {activeDifficulty === 'All' ? 'Difficulty' : activeDifficulty} 
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", openDropdown === 'difficulty' ? "-rotate-90" : "rotate-90")} />
                                    </button>
                                    {openDropdown === 'difficulty' && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full mt-2 left-0 w-40 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                            {['All', 'Easy', 'Medium', 'Hard', 'Insane'].map((diff) => (
                                                <button key={diff} onClick={() => { setActiveDifficulty(diff); setOpenDropdown(null); }} className={cn("w-full text-left px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50 dark:hover:bg-white/5", activeDifficulty === diff ? "text-blue-500 font-bold bg-blue-500/5" : "text-slate-600 dark:text-slate-400")}>{diff}</button>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                                <div className="relative">
                                    <button onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')} className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium border border-transparent transition-all", activeStatus !== 'All' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" : "bg-slate-100/50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10")}>
                                        {activeStatus === 'All' ? 'Status' : activeStatus} 
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", openDropdown === 'status' ? "-rotate-90" : "rotate-90")} />
                                    </button>
                                    {openDropdown === 'status' && (
                                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-full mt-2 left-0 w-40 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                                            {['All', 'Solved', 'Unsolved'].map((stat) => (
                                                <button key={stat} onClick={() => { setActiveStatus(stat); setOpenDropdown(null); }} className={cn("w-full text-left px-4 py-2.5 text-[13px] transition-colors hover:bg-slate-50 dark:hover:bg-white/5", activeStatus === stat ? "text-blue-500 font-bold bg-blue-500/5" : "text-slate-600 dark:text-slate-400")}>{stat}</button>
                                            ))}
                                        </motion.div>
                                    )}
                                </div>
                                <button onClick={() => { if (filteredQuestions.length > 0) onSelectQuestion(filteredQuestions[Math.floor(Math.random() * filteredQuestions.length)].id); }} className="flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-full text-[13px] font-black transition-all border border-blue-500/30"><Shuffle className="w-3.5 h-3.5" /> Pick One</button>
                            </div>
                        </div>

                        <div className="overflow-hidden bg-white dark:bg-[#1a1a1a] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 dark:bg-white/[0.02]">
                                    <tr className="border-b border-slate-200 dark:border-white/5 text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
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
                                                <tr key={q.id} onClick={() => onSelectQuestion(q.id)} className={cn("group cursor-pointer transition-colors border-b last:border-0 border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.03]")}>
                                                    <td className="px-6 py-4">{(q.status === 'solved' || q.isSolved) ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-1 bg-slate-300 dark:bg-slate-700/50 rounded-full" />}</td>
                                                    <td className="px-6 py-4 font-black text-[14px] text-slate-800 dark:text-slate-200 group-hover:text-blue-500 transition-colors">{idx + 1}. {q.title || q.text}</td>
                                                    <td className="px-6 py-4"><div className="space-y-0.5"><div className="text-[12px] font-black text-slate-700 dark:text-slate-300">{q.chapter || 'Foundations'}</div><div className="text-[10px] font-bold text-slate-500/80 uppercase tracking-wider">{q.concept || 'JEE Advanced'}</div></div></td>
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

            {openDropdown && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setOpenDropdown(null)} />}
            <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }` }} />
        </div>
    );
}
