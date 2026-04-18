'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Target, CheckCircle2, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiCall } from '@/lib/api';
import { useEffect } from 'react';

import type { User, Task } from '@/types';

interface ChallengeCardProps {
    user?: User;
    onStartChallenge?: (questionId: string) => void;
}

export function ChallengeCard({ user, onStartChallenge }: ChallengeCardProps) {
    const today = new Date();
    const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [challenge, setChallenge] = useState<any>(null);
    const [isLoadingChallenge, setIsLoadingChallenge] = useState(true);

    useEffect(() => {
        const fetchChallenge = async () => {
            setIsLoadingChallenge(true);
            try {
                const data = await apiCall('/assessments/ogcode/challenge/');
                setChallenge(data);
            } catch (error) {
                console.error("Failed to fetch challenge of the day:", error);
            } finally {
                setIsLoadingChallenge(false);
            }
        };
        fetchChallenge();
    }, [user?.id]);

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const startDay = currentMonth.getDay();

    const solvedSet = useMemo(() => {
        const set = new Set<string>();
        user?.contributionData?.forEach(item => {
            if (item.count > 0) {
                const dateStr = typeof item.date === 'string' ? item.date.split('T')[0] : '';
                if (dateStr) set.add(dateStr);
            }
        });
        return set;
    }, [user?.contributionData]);

    const isSolved = (day: number) => {
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        return solvedSet.has(`${year}-${month}-${dayStr}`);
    };

    const isToday = (day: number) => {
        return today.getDate() === day &&
            today.getMonth() === currentMonth.getMonth() &&
            today.getFullYear() === currentMonth.getFullYear();
    };

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    return (
        <Card className="premium-card bg-card/50 backdrop-blur-xl relative flex flex-col group min-h-[400px] border-border/50">
            {/* Header: Month Navigation */}
            <div className="flex items-center justify-between px-5 pt-5 pb-2">
                <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        Day {today.getDate()}
                        <span className="text-[10px] text-muted-foreground font-medium tracking-tight whitespace-nowrap uppercase">Daily Challenge</span>
                    </h3>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg p-0.5 border border-border/50">
                    <button onClick={prevMonth} className="p-1 hover:bg-background rounded-md text-muted-foreground transition-colors">
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground w-12 text-center">
                        {currentMonth.toLocaleDateString(undefined, { month: 'short' })}
                    </span>
                    <button onClick={nextMonth} className="p-1 hover:bg-background rounded-md text-muted-foreground transition-colors">
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <CardContent className="px-5 pb-5 flex-1 flex flex-col justify-between overflow-visible">

                {/* Calendar Grid */}
                <div className="mb-2">
                    <div className="grid grid-cols-7 gap-1 mb-1.5">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i} className="text-center text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: startDay }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-7" />
                        ))}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const solved = isSolved(day);
                            const current = isToday(day);

                            return (
                                <div key={day} className="h-7 flex items-center justify-center relative group/day cursor-default">
                                    <div className={`
                                        w-6 h-6 flex items-center justify-center rounded-full text-[10px] transition-all
                                        ${solved ? "ring-2 ring-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground font-medium hover:bg-muted"}
                                        ${current && !solved ? "text-primary font-black bg-primary/10 ring-1 ring-primary/50" : ""}
                                    `}>
                                        {solved ? <CheckCircle2 className="w-3.5 h-3.5" /> : day}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Section: Start Challenge */}
                <div className="mt-auto bg-gradient-to-r from-primary/10 to-transparent rounded-xl p-3 border border-primary/20 flex items-center justify-between">
                    <div className="flex flex-col">
                        <p className="text-[10px] font-black text-primary uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Trophy className="w-3 h-3" />
                            Challenge of the Day
                        </p>
                        <p className="text-[11px] font-bold text-foreground">
                            {isLoadingChallenge ? (
                                <span className="opacity-50">Loading...</span>
                            ) : challenge ? (
                                <>Solve <span className="text-primary font-bold">{challenge.concept || challenge.subject}</span></>
                            ) : (
                                <span className="text-muted-foreground/50">No challenge today</span>
                            )}
                        </p>
                    </div>
                    <Button 
                        size="sm" 
                        disabled={isLoadingChallenge || !challenge || challenge.isSolved}
                        onClick={() => challenge && onStartChallenge?.(challenge.id.toString())}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 text-[11px] font-bold px-4 h-8 transition-transform hover:scale-105 rounded-lg disabled:opacity-50"
                    >
                        {challenge?.isSolved ? 'Solved' : 'Start Now'}
                    </Button>
                </div>

            </CardContent>
        </Card>
    );
}

export function PastActivitiesCard({ user }: { user: User }) {
    const analytics = user.timeAnalytics || [];
    const today = analytics[analytics.length - 1] || { practiceTime: 0, webpageTime: 0, pomodoroTime: 0 };

    const toHM = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const types = [
        {
            label: 'Webpage',
            icon: '🌐',
            secs: today.webpageTime || 0,
            color: 'bg-primary',
            textColor: 'text-primary',
        },
        {
            label: 'Practice',
            icon: '📝',
            secs: today.practiceTime || 0,
            color: 'bg-emerald-500',
            textColor: 'text-emerald-500',
        },
        {
            label: 'Pomodoro',
            icon: '🍅',
            secs: today.pomodoroTime || 0,
            color: 'bg-rose-500',
            textColor: 'text-rose-500',
        },
    ];

    const totalSecs = types.reduce((a, t) => a + t.secs, 0);

    return (
        <Card className="premium-card relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

            <CardContent className="relative z-10 p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4F46E5]">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-[#334155]">Time Spent</h3>
                            <p className="text-[10px] text-[#64748B] font-medium">Today — {toHM(totalSecs)} total</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-black text-[#334155]">{toHM(totalSecs)}</p>
                        <p className="text-[9px] text-[#64748B] uppercase tracking-widest font-bold">This session</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {types.map((t) => {
                        const pct = totalSecs > 0 ? (t.secs / totalSecs) * 100 : 0;
                        return (
                            <div key={t.label} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1.5">
                                        <span>{t.icon}</span> {t.label}
                                    </span>
                                    <span className={`text-[11px] font-black ${t.textColor}`}>{toHM(t.secs)}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${pct}%` }}
                                        transition={{ duration: 0.8, ease: 'easeOut' }}
                                        className={`h-full ${t.color} rounded-full`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

export function PlacesToConcentrateCard({ user }: { user?: User }) {
    return (
        <Card className="premium-card min-h-48 h-auto relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

            <CardContent className="relative z-10 p-6 flex flex-col h-full">
                <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <Target className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-foreground">Focus Areas</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Based on your recent tests</p>
                    </div>
                </div>


                <div className="flex-1 flex items-center justify-around px-4">
                    {/* Dynamic Progress Circles */}
                    {(user?.subjects?.length ? user.subjects : ['Physics', 'Chemistry', 'Mathematics']).slice(0, 3).map((subject, idx) => {
                        const colors = ['text-red-400', 'text-amber-400', 'text-emerald-400', 'text-blue-400'];
                        const progress = [45, 62, 88, 70][idx % 4];
                        return (
                            <div key={subject} className="flex flex-col items-center gap-2 group/item">
                                <div className="relative w-14 h-14 flex items-center justify-center">
                                    <svg className="w-full h-full -rotate-90">
                                        <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                                        <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray="150" strokeDashoffset={150 - (150 * (progress / 100))} className={`${colors[idx % 4]} transition-all duration-1000`} strokeLinecap="round" />
                                    </svg>
                                    <span className="absolute text-xs font-bold text-black dark:text-slate-200">{progress}%</span>
                                </div>
                                <span className="text-[10px] font-semibold text-black/60 dark:text-slate-400 tracking-wide uppercase truncate max-w-[60px]">{subject}</span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

// initialTodos removed and moved to App.tsx

interface TodoListCardProps {
    tasks: Task[];
    onAddTask: (text: string, due: string) => void;
    onToggleTask: (id: number) => void;
    onRemoveTask: (id: number) => void;
    onViewAll: () => void;
}

export function TodoListCard({ tasks, onAddTask, onToggleTask, onRemoveTask, onViewAll }: TodoListCardProps) {
    const [newTaskText, setNewTaskText] = useState('');

    const getDefaultDueDate = () => {
        const d = new Date(Date.now() + 86400000);
        return d.toISOString().slice(0, 16);
    };
    const [newTaskDue, setNewTaskDue] = useState(getDefaultDueDate());

    const handleAdd = () => {
        if (!newTaskText.trim()) return;
        const dueContent = newTaskDue ? new Date(newTaskDue).toISOString() : new Date(Date.now() + 86400000).toISOString();
        onAddTask(newTaskText.trim(), dueContent);
        setNewTaskText('');
        setNewTaskDue(getDefaultDueDate());
    };

    const isOverdue = (dateString: string) => {
        if (!dateString) return false;
        const dueDate = new Date(dateString);
        if (isNaN(dueDate.getTime())) return false;
        return dueDate.getTime() < Date.now();
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'No date';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid date';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Card className="border-0 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 bg-card backdrop-blur-xl h-full relative overflow-hidden flex flex-col ring-1 ring-border">
            {/* Soft decorative background */}
            <div className="absolute top-0 right-0 w-[40%] h-[40%] bg-gradient-to-bl from-indigo-50/50 to-transparent dark:from-indigo-900/20 pointer-events-none" />

            <CardContent className="relative z-10 p-6 md:p-8 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black text-foreground flex items-center gap-3">
                        <div className="w-1.5 h-6 bg-primary rounded-full shadow-sm shadow-primary/20" />
                        Tasks & Goals
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={onViewAll}
                      className="h-8 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all rounded-lg"
                    >
                        View All
                    </Button>
                </div>

                {/* Add Task Input - Centered and max-width for better wide-screen UX */}
                <div className="mb-10 space-y-4 max-w-4xl mx-auto w-full">
                    <div className="flex gap-4">
                        <input
                            type="text"
                            placeholder="Add a new task or mission goal..."
                            value={newTaskText}
                            onChange={(e) => setNewTaskText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl px-6 py-3 text-base text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium shadow-sm"
                        />
                        <Button
                            onClick={handleAdd}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl px-6 h-12 shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" />
                            <span className="hidden sm:inline">Add Task</span>
                        </Button>
                    </div>
                    <div className="flex items-center justify-center gap-4">
                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">Target Deadline:</span>
                        <input
                            type="datetime-local"
                            value={newTaskDue}
                            onChange={(e) => setNewTaskDue(e.target.value)}
                            className="bg-slate-50/80 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-2 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50"
                        />
                    </div>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
                    {tasks.map((todo) => {
                        const overdue = !todo.completed && isOverdue(todo.due);
                        return (
                            <div key={todo.id} className={`group flex items-start gap-3 p-2.5 rounded-xl transition-all animate-in fade-in slide-in-from-top-1 duration-300 ${overdue ? 'bg-rose-500/5 border border-rose-500/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                <button
                                    onClick={() => onToggleTask(todo.id)}
                                    className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition-all ${todo.completed
                                        ? 'bg-indigo-500 border-indigo-500 text-white'
                                        : overdue
                                            ? 'border-rose-400 dark:border-rose-500/50 text-transparent hover:text-rose-500'
                                            : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 dark:hover:border-indigo-500 text-transparent hover:text-indigo-500'
                                        }`}>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium transition-colors truncate ${todo.completed
                                        ? 'text-black/30 dark:text-slate-600 line-through decoration-black/30'
                                        : overdue
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-black dark:text-slate-200'
                                        }`}>
                                        {todo.text}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 border-0 font-bold uppercase tracking-wider ${todo.completed
                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                            : overdue
                                                ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400'
                                                : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                            }`}>
                                            {overdue ? 'MISSED • ' : ''}{formatDate(todo.due)}
                                        </Badge>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemoveTask(todo.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-500 transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
