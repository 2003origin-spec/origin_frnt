'use client';
import { useMemo, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Calendar, Flame } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface DailyTrackerProps {
    user: User;
}

export default function DailyTracker({ user }: DailyTrackerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
        }
    }, []);

    const { dataMap, totalSolved } = useMemo(() => {
        const map = new Map<string, number>();
        let total = 0;
        
        user.contributionData?.forEach(item => {
            const dateStr = typeof item.date === 'string' ? item.date.split('T')[0] : '';
            if (dateStr) {
                map.set(dateStr, item.count);
                total += item.count;
            }
        });

        return { dataMap: map, totalSolved: total };
    }, [user.contributionData]);

    const monthGroups = useMemo(() => {
        const groups = [];
        const today = new Date();
        // Start 12 months ago
        let currentIterDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

        for (let i = 0; i < 12; i++) {
            const year = currentIterDate.getFullYear();
            const month = currentIterDate.getMonth();
            const monthName = currentIterDate.toLocaleDateString(undefined, { month: 'short' });
            const startDay = currentIterDate.getDay();
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
                    level = -1; // Future
                }

                days.push({ date, level, count });
            }

            groups.push({ year, month, monthName, startPadding: startDay, days });
            currentIterDate = new Date(year, month + 1, 1);
        }
        return groups;
    }, [dataMap]);

    const getLevelClass = (level: number) => {
        switch (level) {
            case 1: return 'bg-emerald-500/30 dark:bg-emerald-900/40 border border-emerald-500/20';
            case 2: return 'bg-emerald-500/50 dark:bg-emerald-700/60 border border-emerald-400/30';
            case 3: return 'bg-emerald-500/80 dark:bg-emerald-500/70 border border-emerald-300/40';
            case 4: return 'bg-emerald-400 dark:bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)] border border-emerald-200';
            case 0: return 'bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/20 dark:border-slate-700/50';
            default: return 'bg-transparent border-dashed border border-slate-200/20 opacity-20';
        }
    };

    return (
        <Card className="border border-white/20 dark:border-slate-800 bg-white/40 dark:bg-slate-950/40 backdrop-blur-2xl relative overflow-hidden group">
            {/* Animated Background Glow */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-700" />
            
            <CardHeader className="pb-6 relative z-10 flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                Activity Vault
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {totalSolved} solved this year
                                </span>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <div className="flex items-center gap-1 text-orange-500 dark:text-orange-400">
                                    <Flame className="w-3 h-3 fill-current" />
                                    <span className="text-xs font-bold">{user.streak || 0} day streak</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                   <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/50 dark:bg-slate-900/50 rounded-md border border-slate-200/50 dark:border-slate-800/50">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mr-1">Intensity</span>
                        {[0, 1, 2, 3, 4].map((lvl) => (
                            <div key={lvl} className={cn("w-2.5 h-2.5 rounded-[2px]", getLevelClass(lvl))} />
                        ))}
                   </div>
                </div>
            </CardHeader>

            <CardContent className="relative z-10">
                <div 
                    ref={scrollRef}
                    className="overflow-x-auto pb-4 cursor-grab active:cursor-grabbing no-scrollbar"
                >
                    <div className="flex gap-4 min-w-max">
                        <TooltipProvider delayDuration={0}>
                            {monthGroups.map((group) => (
                                <div key={`${group.year}-${group.month}`} className="space-y-3">
                                    <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter ml-1">
                                        {group.monthName}
                                    </h4>

                                    <div className="grid grid-rows-7 grid-flow-col gap-[3px]">
                                        {/* Start Padding */}
                                        {Array.from({ length: group.startPadding }).map((_, i) => (
                                            <div key={`p-${i}`} className="w-[13px] h-[13px]" />
                                        ))}

                                        {/* Day Cells */}
                                        {group.days.map((day, dIdx) => {
                                            const isToday = day.date.toDateString() === new Date().toDateString();
                                            return (
                                                <Tooltip key={dIdx}>
                                                    <TooltipTrigger asChild>
                                                        <div
                                                            className={cn(
                                                                "w-[13px] h-[13px] rounded-[3px] transition-all duration-300 relative",
                                                                getLevelClass(day.level),
                                                                isToday && "ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-slate-950 scale-110 z-10",
                                                                day.level !== -1 && "hover:scale-150 hover:z-20 hover:shadow-lg"
                                                            )}
                                                        >
                                                            {isToday && (
                                                                <span className="absolute inset-0 rounded-[3px] animate-ping bg-emerald-400/40 pointer-events-none" />
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent 
                                                        side="top" 
                                                        className="bg-slate-900 dark:bg-white border-none text-white dark:text-slate-900 px-3 py-2 shadow-2xl"
                                                    >
                                                        <div className="text-center">
                                                            <p className="text-xs font-black">
                                                                {day.count} {day.count === 1 ? 'Solution' : 'Solutions'}
                                                            </p>
                                                            <p className="text-[10px] opacity-70 font-medium">
                                                                {day.date.toLocaleDateString(undefined, { 
                                                                    month: 'short', 
                                                                    day: 'numeric',
                                                                    weekday: 'short'
                                                                })}
                                                            </p>
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </TooltipProvider>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}