import { Card, CardContent } from '@/components/ui/card';
import type { User } from '@/types';

interface PastWeekProgressProps {
    user: User;
}

const COLORS = {
    webpage: '#3b82f6', // blue-500
    practice: '#10b981', // emerald-500
    pomodoro: '#f59e0b', // amber-500
    empty: '#1e293b'     // slate-800
};

export default function PastWeekProgress({ user }: PastWeekProgressProps) {
    const timeData = user?.timeAnalytics || [];

    // Helper to calculate SVG arc stroke-dasharray properties
    const calculateSegments = (web: number, prac: number, pom: number) => {
        const total = web + prac + pom;
        if (total === 0) return null;

        // Circumference of r=20 circle is 2 * PI * 20 = 125.6
        const c = 125.6;
        const webPct = web / total;
        const pracPct = prac / total;

        return {
            webOffset: 0,
            webDash: c * webPct,
            pracOffset: -(c * webPct),
            pracDash: c * pracPct,
            pomOffset: -(c * (webPct + pracPct)),
            pomDash: c * (pom / total)
        };
    };

    const formatTime = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        if (mins < 60) return `${mins}m`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    };

    return (
        <Card className="border-0 shadow-lg shadow-blue-500/5 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl relative overflow-hidden h-full flex flex-col justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-50/20 via-white/10 to-blue-50/20 dark:from-blue-900/20 dark:via-slate-800/10 dark:to-blue-900/20 pointer-events-none" />

            <CardContent className="relative z-10 py-5 flex flex-col lg:flex-row items-center justify-between px-6 gap-6">

                {/* Left Header & Legend */}
                <div className="flex flex-col items-center lg:items-start min-w-max">
                    <span className="text-sm font-black text-black dark:text-slate-200 tracking-wider mb-2">APP TIME ANALYTICS</span>
                    <div className="flex gap-3 text-xs font-semibold text-black/80 dark:text-slate-300">
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /> Webpage</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Practice</div>
                        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500" /> Pomodoro</div>
                    </div>
                </div>

                {/* 7-Day Mini Charts */}
                <div className="flex flex-1 justify-between items-center gap-2 overflow-x-auto pb-2 scrollbar-hide w-full">
                    {timeData.map((item: any, index: number) => {
                        const isToday = index === timeData.length - 1;
                        const totalSecs = item.webpageTime + item.practiceTime + item.pomodoroTime;
                        const segments = calculateSegments(item.webpageTime, item.practiceTime, item.pomodoroTime);

                        return (
                            <div key={item.date} className="flex flex-col items-center gap-2 group relative">
                                {isToday && (
                                    <div className="absolute -top-6 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/50">
                                        TODAY
                                    </div>
                                )}

                                <div className="relative w-14 h-14 flex items-center justify-center">
                                    <svg className="w-full h-full transform -rotate-90">
                                        {/* Background Empty Track */}
                                        <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100 dark:text-slate-800/50" />

                                        {segments ? (
                                            <>
                                                {/* Webpage Segment */}
                                                {segments.webDash > 0 && (
                                                    <circle cx="28" cy="28" r="24" fill="transparent" strokeWidth="4" stroke={COLORS.webpage}
                                                        strokeDasharray={`150.8`} strokeDashoffset={150.8 - segments.webDash * 1.2} />
                                                )}
                                                {/* Practice Segment */}
                                                {segments.pracDash > 0 && (
                                                    <circle cx="28" cy="28" r="24" fill="transparent" strokeWidth="4" stroke={COLORS.practice}
                                                        strokeDasharray={`150.8`} strokeDashoffset={150.8 - segments.pracDash * 1.2} transform={`rotate(${(segments.webDash / 125.6) * 360} 28 28)`} />
                                                )}
                                                {/* Pomodoro Segment */}
                                                {segments.pomDash > 0 && (
                                                    <circle cx="28" cy="28" r="24" fill="transparent" strokeWidth="4" stroke={COLORS.pomodoro}
                                                        strokeDasharray={`150.8`} strokeDashoffset={150.8 - segments.pomDash * 1.2} transform={`rotate(${((segments.webDash + segments.pracDash) / 125.6) * 360} 28 28)`} />
                                                )}
                                            </>
                                        ) : null}
                                    </svg>

                                    {/* Center Text (Total Time) */}
                                    <span className="absolute text-[10px] font-bold text-black dark:text-slate-300 text-center leading-tight">
                                        {totalSecs > 0 ? formatTime(totalSecs) : '0m'}
                                    </span>
                                </div>
                                <span className={`text-xs font-bold transition-colors ${isToday ? 'text-black dark:text-indigo-400' : 'text-black/40 dark:text-slate-500 group-hover:text-black dark:group-hover:text-slate-300'}`}>
                                    {item.dayName.toUpperCase()}
                                </span>
                            </div>
                        );
                    })}
                    {/* Fallback if user is null or offline */}
                    {timeData.length === 0 && (
                        <div className="w-full text-center text-sm text-slate-500 py-4">Data not available yet.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
