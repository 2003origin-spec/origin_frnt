import { motion } from 'framer-motion';
import {
    BookOpen,
    Trophy,
    FileText,
    Target,
    Timer,
    User,
    Settings,
    ArrowRight,
    Code,
    Crown,
    ListTodo,
    Sparkles,
    UserPlus,
    Building2,
    LineChart,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { ViewState } from '@/types';

interface ExploreProps {
    onNavigate: (view: ViewState) => void;
    /** Feature gates — mirror the nav bar so Explore lists the same tabs. */
    aiExplainer?: boolean;
    socialEnabled?: boolean;
    connectEnabled?: boolean;
}

type ExploreCard = {
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
    view: ViewState;
    accent: string;
    accentBg: string;
    stat: string;
};

// Always-available destinations (also present in the nav bar).
const CARDS: ExploreCard[] = [
    {
        title: 'OGCode',
        description: 'Practice the OGCode question bank, build streaks, and climb the national leaderboard.',
        icon: Code,
        view: 'ogcode' as ViewState,
        accent: 'text-primary',
        accentBg: 'bg-primary/10 dark:bg-primary/15',
        stat: 'Practice Arena',
    },
    {
        title: 'Graphs',
        description: 'Plot equations, tweak parameters with live sliders, and explore functions like a graphing calculator.',
        icon: LineChart,
        view: 'graphs' as ViewState,
        accent: 'text-cyan-500',
        accentBg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
        stat: 'Function Plotter',
    },
    {
        title: 'Study Corner',
        description: 'NCERT books, curated notes, and interactive study material in one place.',
        icon: BookOpen,
        view: 'study-corner' as ViewState,
        accent: 'text-rose-500',
        accentBg: 'bg-rose-500/10 dark:bg-rose-500/15',
        stat: '150+ Resources',
    },
    {
        title: 'Tests & Assessments',
        description: 'JEE-level mock tests and subject-wise assessments with detailed analytics.',
        icon: FileText,
        view: 'test-list' as ViewState,
        accent: 'text-indigo-500',
        accentBg: 'bg-indigo-500/10 dark:bg-indigo-500/15',
        stat: '500+ Questions',
    },
    {
        title: 'Rooms',
        description: 'Join live study rooms and compete with peers in real-time test battles.',
        icon: Crown,
        view: 'study-rooms' as ViewState,
        accent: 'text-violet-500',
        accentBg: 'bg-violet-500/10 dark:bg-violet-500/15',
        stat: 'Live',
    },
    {
        title: 'Daily Practice (DPP)',
        description: 'Personalised problem sets generated daily based on your performance.',
        icon: Target,
        view: 'dpp' as ViewState,
        accent: 'text-emerald-500',
        accentBg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
        stat: 'Updated Daily',
    },
    {
        title: 'Goals',
        description: 'Set study goals, manage your tasks, and track your progress day by day.',
        icon: ListTodo,
        view: 'tasks-goals' as ViewState,
        accent: 'text-teal-500',
        accentBg: 'bg-teal-500/10 dark:bg-teal-500/15',
        stat: 'Stay on track',
    },
    {
        title: 'Arena Leaderboard',
        description: 'See where you stand globally and track your progress against the best.',
        icon: Trophy,
        view: 'leaderboard' as ViewState,
        accent: 'text-amber-500',
        accentBg: 'bg-amber-500/10 dark:bg-amber-500/15',
        stat: 'Top 1%',
    },
    {
        title: 'Focus Timer',
        description: 'Master your time with Pomodoro sessions and track deep work hours.',
        icon: Timer,
        view: 'pomodoro' as ViewState,
        accent: 'text-orange-500',
        accentBg: 'bg-orange-500/10 dark:bg-orange-500/15',
        stat: 'Productivity',
    },
    {
        title: 'My Profile',
        description: 'Manage your personal details, plan, and academic preferences.',
        icon: User,
        view: 'profile' as ViewState,
        accent: 'text-sky-500',
        accentBg: 'bg-sky-500/10 dark:bg-sky-500/15',
        stat: 'Active',
    },
    {
        title: 'Settings',
        description: 'Configure your experience, theme, and notification preferences.',
        icon: Settings,
        view: 'profile' as ViewState,
        accent: 'text-slate-500',
        accentBg: 'bg-slate-500/10 dark:bg-slate-500/15',
        stat: 'Configured',
    },
];

// Feature-gated destinations — shown only when their flag is on, matching the nav bar.
const AI_EXPLAINER_CARD: ExploreCard = {
    title: 'AI Explainer',
    description: 'Snap a doubt and get step-by-step AI explanations from the Origin mentor.',
    icon: Sparkles,
    view: 'doubt-solver' as ViewState,
    accent: 'text-fuchsia-500',
    accentBg: 'bg-fuchsia-500/10 dark:bg-fuchsia-500/15',
    stat: 'AI Powered',
};
const SOCIAL_CARD: ExploreCard = {
    title: 'Social',
    description: 'Follow classmates, compare progress, and challenge friends.',
    icon: UserPlus,
    view: 'social' as ViewState,
    accent: 'text-pink-500',
    accentBg: 'bg-pink-500/10 dark:bg-pink-500/15',
    stat: 'Connect',
};
const CONNECT_CARD: ExploreCard = {
    title: 'Connect',
    description: 'Join your institute, enroll in batches, and access teacher tests.',
    icon: Building2,
    view: 'connect' as ViewState,
    accent: 'text-cyan-500',
    accentBg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
    stat: 'Institute',
};

export default function Explore({ onNavigate, aiExplainer = false, socialEnabled = false, connectEnabled = false }: ExploreProps) {
    const cards: ExploreCard[] = [
        ...CARDS,
        ...(aiExplainer ? [AI_EXPLAINER_CARD] : []),
        ...(socialEnabled ? [SOCIAL_CARD] : []),
        ...(connectEnabled ? [CONNECT_CARD] : []),
    ];
    return (
        <div className="min-h-screen neu-surface font-sans">
            <main className="max-w-[1400px] mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* Page header */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-1 pt-2"
                >
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">
                        Explore <span className="text-primary">Origin</span>
                    </h1>
                    <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                        Your central command for mastery — practice modules, assessments, and growth tools.
                    </p>
                </motion.div>

                {/* Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {cards.map((card, i) => (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.32, delay: 0.05 * i }}
                            onClick={() => onNavigate(card.view)}
                            className="neu-raised neu-pressable cursor-pointer group flex flex-col gap-4 p-5 min-h-[200px]"
                        >
                            {/* Icon */}
                            <div className={`w-11 h-11 rounded-2xl ${card.accentBg} flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110`}>
                                <card.icon className={`w-5 h-5 ${card.accent}`} />
                            </div>

                            {/* Text */}
                            <div className="flex-1 space-y-1.5">
                                <h3 className="font-black text-base text-foreground leading-tight group-hover:text-primary transition-colors duration-200">
                                    {card.title}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {card.description}
                                </p>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-2 border-t border-border/20">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${card.accent}`}>
                                    {card.stat}
                                </span>
                                <ArrowRight className={`w-4 h-4 ${card.accent} opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300`} />
                            </div>
                        </motion.div>
                    ))}
                </div>

            </main>
        </div>
    );
}
