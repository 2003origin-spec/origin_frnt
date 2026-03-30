'use client';
import { useState } from 'react';
import { Trophy, Star, TrendingUp, Info, ChevronRight, X, Zap, Target, BookOpen, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PointsSummaryProps {
    data: {
        totalPoints: number;
        currentTier: string;
        nextTier: string;
        pointsToNext: number;
        progressPercent: number;
        recentLogs: Array<{
            points: number;
            type: string;
            description: string;
            timestamp: string;
        }>;
    } | null;
    onNextSteps?: () => void;
}

const TIER_COLORS: Record<string, string> = {
    'Novice': 'text-slate-400 border-slate-400 bg-slate-400/10',
    'Beginner': 'text-green-400 border-green-400 bg-green-400/10',
    'Apprentice': 'text-teal-400 border-teal-400 bg-teal-400/10',
    'Intermediate': 'text-blue-400 border-blue-400 bg-blue-400/10',
    'Advanced': 'text-indigo-400 border-indigo-400 bg-indigo-400/10',
    'Expert': 'text-purple-400 border-purple-400 bg-purple-400/10',
    'Master': 'text-pink-400 border-pink-400 bg-pink-400/10',
    'Grandmaster': 'text-amber-400 border-amber-400 bg-amber-400/10',
    'Legend': 'text-rose-500 border-rose-500 bg-rose-500/10',
};

const HOW_EARNED = [
    { icon: BookOpen, color: 'text-blue-400', label: 'Practice Questions', pts: '+10–100 pts', desc: 'Based on difficulty: Easy=10, Medium=25, Hard=50, Insane=100. First-solve bonus +5 pts.' },
    { icon: Target, color: 'text-green-400', label: 'Completing Tests', pts: '+4 pts/correct', desc: 'Score = 4 × correct - 1 × wrong. Positive score awards the net points.' },
    { icon: MessageCircle, color: 'text-purple-400', label: 'AI Explainer', pts: '+5 pts', desc: 'Every AI session grants +5 pts, capped at 25 pts per day.' },
    { icon: Zap, color: 'text-amber-400', label: 'Daily Streak', pts: 'Bonus', desc: 'Maintain your daily streak to earn tier-specific bonuses in future updates.' },
];

export default function PointsSummary({ data, onNextSteps }: PointsSummaryProps) {
    const [showInfo, setShowInfo] = useState(false);

    if (!data || data.totalPoints === undefined) return (
        <div className="w-full h-full bg-white/5 dark:bg-slate-900/50 rounded-3xl border border-white/10 p-6 flex flex-col justify-center items-center gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-slate-700/50" />
            <div className="w-24 h-4 bg-slate-700/50 rounded" />
        </div>
    );

    const tierStyle = TIER_COLORS[data.currentTier] || TIER_COLORS['Novice'];


    return (
        <div className="w-full h-full bg-white/5 dark:bg-slate-900/40 backdrop-blur-md rounded-[32px] border border-white/10 p-6 flex flex-col justify-between overflow-hidden relative group">
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 blur-[50px] pointer-events-none group-hover:bg-indigo-600/20 transition-colors duration-500" />

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-xs font-bold text-black/50 dark:text-slate-500 uppercase tracking-widest">Prestige Points</h3>
                            <button
                                onClick={() => setShowInfo(true)}
                                className="p-0.5 text-slate-500 hover:text-indigo-400 transition-colors"
                                title="How are points calculated?"
                            >
                                <Info className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <p className="text-2xl font-black text-black dark:text-white">{data.totalPoints.toLocaleString()}</p>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter ${tierStyle}`}>
                    {data.currentTier}
                </div>
            </div>

            {/* Progress */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-black/40 dark:text-slate-400">Next: {data.nextTier}</span>
                    <span className="text-black/60 dark:text-indigo-400">{data.pointsToNext} more to rank up</span>
                </div>
                <div className="w-full h-2 bg-slate-800/50 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${data.progressPercent}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-indigo-600 via-violet-500 to-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    />
                </div>
            </div>

            {/* Footer buttons */}
            <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer group/btn">
                    <div className="flex -space-x-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            </div>
                        ))}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 group-hover/btn:text-white transition-colors uppercase tracking-widest flex items-center gap-1">
                        Recent <TrendingUp className="w-3 h-3" />
                    </span>
                </div>

                <button
                    onClick={() => onNextSteps?.()}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                >
                    Next Steps <ChevronRight className="w-3 h-3" />
                </button>
            </div>

            {/* Info Panel */}
            <AnimatePresence>
                {showInfo && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm rounded-[32px] p-5 flex flex-col z-10"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-widest">How It's Calculated</h4>
                            <button onClick={() => setShowInfo(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>
                        <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                            {HOW_EARNED.map((item, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                                    <item.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${item.color}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <p className="text-[11px] font-bold text-white">{item.label}</p>
                                            <span className={`text-[10px] font-black ${item.color}`}>{item.pts}</span>
                                        </div>
                                        <p className="text-[10px] text-slate-400 leading-relaxed">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
