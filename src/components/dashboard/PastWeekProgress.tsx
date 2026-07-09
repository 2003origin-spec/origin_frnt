'use client';
import { Card, CardContent } from '@/components/ui/card';
import type { User } from '@/types';

interface PastWeekProgressProps {
    user: User;
}

const COLORS = {
    webpage:  { fill: '#4F46E5', label: 'Webpage' },
    practice: { fill: '#059669', label: 'Practice' },
    pomodoro: { fill: '#D97706', label: 'Pomodoro' },
};

const BAR_MAX_H = 88;

function fmt(secs: number) {
    if (secs <= 0) return '';
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`;
}

export default function PastWeekProgress({ user }: PastWeekProgressProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeData: any[] = user?.timeAnalytics || [];

    const maxTotal = Math.max(
        ...timeData.map(d => (d.webpageTime || 0) + (d.practiceTime || 0) + (d.pomodoroTime || 0)),
        1
    );

    return (
        <Card className="neu-raised border-0">
            <CardContent className="px-5 py-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-black text-foreground leading-none">App Time</h3>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">7-day histogram</p>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                        {Object.values(COLORS).map(c => (
                            <div key={c.label} className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: c.fill }} />
                                {c.label}
                            </div>
                        ))}
                    </div>
                </div>

                {timeData.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No data yet.</p>
                ) : (
                    <div className="flex items-end gap-1.5" style={{ height: `${BAR_MAX_H + 44}px` }}>
                        {timeData.map((item, i) => {
                            const isToday = i === timeData.length - 1;
                            const web  = item.webpageTime  || 0;
                            const prac = item.practiceTime || 0;
                            const pom  = item.pomodoroTime || 0;
                            const total = web + prac + pom;
                            const barH = total > 0 ? Math.max((total / maxTotal) * BAR_MAX_H, 4) : 0;
                            const webH  = total > 0 ? (web  / total) * barH : 0;
                            const pracH = total > 0 ? (prac / total) * barH : 0;
                            const pomH  = total > 0 ? (pom  / total) * barH : 0;

                            return (
                                <div key={item.date ?? i} className="flex flex-col items-center flex-1 min-w-0 group">
                                    {/* Hover time label */}
                                    <span className="text-[9px] font-black text-foreground opacity-0 group-hover:opacity-100 transition-opacity leading-none mb-1 whitespace-nowrap">
                                        {fmt(total) || '—'}
                                    </span>

                                    {/* Bar column — fixed height container, bar grows from bottom */}
                                    <div className="w-full flex flex-col justify-end rounded-sm overflow-hidden" style={{ height: `${BAR_MAX_H}px` }}>
                                        {barH > 0 ? (
                                            <div className="w-full flex flex-col transition-all duration-500" style={{ height: `${barH}px` }}>
                                                <div style={{ height: `${webH}px`,  background: COLORS.webpage.fill  }} />
                                                <div style={{ height: `${pracH}px`, background: COLORS.practice.fill }} />
                                                <div style={{ height: `${pomH}px`,  background: COLORS.pomodoro.fill }} />
                                            </div>
                                        ) : (
                                            <div className="w-full h-0.5 border-t border-dashed border-border/40" />
                                        )}
                                    </div>

                                    {/* Day label */}
                                    <span className={`text-[10px] font-black mt-1.5 uppercase tracking-wider transition-colors ${isToday ? 'text-primary' : 'text-muted-foreground/50 group-hover:text-foreground'}`}>
                                        {(item.dayName as string | undefined)?.slice(0, 3) ?? ''}
                                    </span>
                                    {isToday && <div className="w-1 h-1 rounded-full bg-primary mt-0.5" />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
