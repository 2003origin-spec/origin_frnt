'use client';
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface DailyTrackerProps {
    user: User;
}

export default function DailyTracker({ user }: DailyTrackerProps) {
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const [direction, setDirection] = useState(0); // -1: prev, 1: next

    const dataMap = useMemo(() => {
        const map = new Map<string, number>();
        user.contributionData?.forEach(item => {
            const dateStr = typeof item.date === 'string' ? item.date.split('T')[0] : '';
            if (dateStr) {
                map.set(dateStr, item.count);
            }
        });
        return map;
    }, [user.contributionData]);

    const totalSolved = useMemo(() => {
        let total = 0;
        user.contributionData?.forEach(item => {
            total += item.count;
        });
        return total;
    }, [user.contributionData]);

    const monthData = useMemo(() => {
        const today = new Date();
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const monthName = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const startDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            let level = 0;
            let count = 0;
            if (date <= today) {
                count = dataMap.get(dateStr) || 0;
                if (count > 0) level = 1;
                if (count >= 3) level = 2;
                if (count >= 8) level = 3;
                if (count >= 15) level = 4;
            } else {
                level = -1; // Future days
            }
            days.push({ date, level, count });
        }

        // Always render exactly 6 rows (42 cells) to maintain static height and avoid layout shifts
        const totalCells = 42;
        const paddingEnd = totalCells - (startDay + daysInMonth);

        return { year, month, monthName, startPadding: startDay, days, paddingEnd };
    }, [selectedDate, dataMap]);

    const isCurrentMonthOrLater = useMemo(() => {
        const today = new Date();
        return selectedDate.getFullYear() >= today.getFullYear() && selectedDate.getMonth() >= today.getMonth();
    }, [selectedDate]);

    const handlePrevMonth = () => {
        setDirection(-1);
        setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setDirection(1);
        setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const getLevelClass = (level: number) => {
        switch (level) {
            case 1: return 'bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/20';
            case 2: return 'bg-emerald-500/35 dark:bg-emerald-500/20 border border-emerald-500/30';
            case 3: return 'bg-emerald-500/60 dark:bg-emerald-500/40 border border-emerald-500/50';
            case 4: return 'bg-emerald-500 dark:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)] border border-emerald-600';
            case 0: return 'bg-slate-200/50 dark:bg-slate-800/40 border border-slate-300/40 dark:border-white/5';
            default: return 'bg-transparent border border-dashed border-slate-300/10 opacity-15';
        }
    };

    const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const slideVariants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 30 : -30,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir: number) => ({
            x: dir > 0 ? -30 : 30,
            opacity: 0,
        })
    };

    return (
        <Card className="neu-raised border-0 overflow-hidden relative">
            <CardHeader className="px-5 pt-4 pb-3 space-y-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-black text-foreground leading-none">Activity Vault</CardTitle>
                            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Track your study streak</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap">
                        {/* Month navigation controls */}
                        <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 px-1.5 py-1 rounded-xl">
                            <button
                                onClick={handlePrevMonth}
                                className="p-1 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-lg transition-all"
                                title="Previous Month"
                            >
                                <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                            <span className="text-[11px] font-black text-foreground min-w-[7rem] text-center tracking-tight select-none font-mono">
                                {monthData.monthName}
                            </span>
                            <button
                                onClick={handleNextMonth}
                                disabled={isCurrentMonthOrLater}
                                className="p-1 hover:bg-slate-200/60 dark:hover:bg-white/10 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Next Month"
                            >
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            {(user.streak || 0) > 0 && (
                                <div className="flex items-center gap-1 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-xl shadow-sm">
                                    <span className="text-xs leading-none">🔥</span>
                                    <span className="text-xs font-black text-orange-500">{user.streak}</span>
                                </div>
                            )}
                            <span className="text-[10px] font-bold text-muted-foreground bg-slate-100 dark:bg-white/5 border border-slate-200/30 dark:border-white/5 px-2.5 py-1.5 rounded-xl">{totalSolved} solved</span>
                        </div>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-5 pb-4">
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-[3.5px] mb-1.5">
                    {DAY_LABELS.map((l, i) => (
                        <div key={i} className="text-[9px] font-bold text-muted-foreground/45 text-center uppercase tracking-wider">{l}</div>
                    ))}
                </div>

                <div className="relative overflow-hidden min-h-[160px]">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                        <motion.div
                            key={`${monthData.year}-${monthData.month}`}
                            custom={direction}
                            variants={slideVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                            className="grid grid-cols-7 gap-[3.5px] w-full"
                        >
                            {/* Start padding */}
                            {Array.from({ length: monthData.startPadding }).map((_, i) => (
                                <div key={`p-start-${i}`} className="aspect-square" />
                            ))}

                            {/* Day cells */}
                            <TooltipProvider delayDuration={0}>
                                {monthData.days.map((day, idx) => {
                                    const isToday = day.date.toDateString() === new Date().toDateString();
                                    return (
                                        <Tooltip key={idx}>
                                            <TooltipTrigger asChild>
                                                <div
                                                    className={cn(
                                                        'aspect-square rounded-[5px] transition-all duration-200 relative cursor-pointer',
                                                        getLevelClass(day.level),
                                                        isToday && 'ring-2 ring-primary ring-offset-1 scale-105 z-10',
                                                        day.level !== -1 && 'hover:scale-120 hover:z-20 hover:shadow-lg'
                                                    )}
                                                >
                                                    {isToday && (
                                                        <span className="absolute inset-0 rounded-[5px] animate-ping bg-primary/30 pointer-events-none" />
                                                    )}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="bg-slate-950 text-white border border-white/10 px-3 py-2 shadow-2xl rounded-xl">
                                                <p className="text-xs font-black">{day.count} {day.count === 1 ? 'solution' : 'solutions'}</p>
                                                <p className="text-[10px] opacity-70 font-semibold mt-0.5">
                                                    {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                })}
                            </TooltipProvider>

                            {/* End padding to pad up to exactly 6 rows (42 cells) */}
                            {Array.from({ length: monthData.paddingEnd }).map((_, i) => (
                                <div key={`p-end-${i}`} className="aspect-square rounded-[5px] bg-transparent border border-dashed border-slate-300/10 dark:border-white/5 opacity-15" />
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-1.5 mt-4">
                    <span className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider">Less</span>
                    {[0, 1, 2, 3, 4].map(lvl => (
                        <div key={lvl} className={cn('w-3 h-3 rounded-[3px]', getLevelClass(lvl))} />
                    ))}
                    <span className="text-[9px] text-muted-foreground/50 font-semibold uppercase tracking-wider">More</span>
                </div>
            </CardContent>
        </Card>
    );
}
