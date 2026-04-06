import { motion } from 'framer-motion';
import {
    BookOpen,
    Trophy,
    FileText,
    Target,
    TrendingUp,
    Settings,
    User,
    ArrowRight
} from 'lucide-react';
import type { ViewState } from '@/types';

interface ExploreProps {
    onNavigate: (view: ViewState) => void;
}

export default function Explore({ onNavigate }: ExploreProps) {
    const exploreCards = [
        {
            title: 'Study Corner',
            description: 'Access NCERT books, curated notes, and interactive study material.',
            icon: BookOpen,
            view: 'study-corner' as ViewState,
            color: 'from-blue-500 to-cyan-500',
            stats: '150+ Resources'
        },
        {
            title: 'Tests & Assessments',
            description: 'Practice JEE-level mock tests and detailed subject-wise assessments.',
            icon: FileText,
            view: 'test-list' as ViewState,
            color: 'from-blue-600 to-indigo-600',
            stats: '500+ Questions'
        },
        {
            title: 'Arena Leaderboard',
            description: 'See where you stand globally. Track your progress against the best.',
            icon: Trophy,
            view: 'leaderboard' as ViewState,
            color: 'from-amber-500 to-orange-500',
            stats: 'Top 1%'
        },
        {
            title: 'Daily Practice (DPP)',
            description: 'Personalized problem sets generated daily based on your performance.',
            icon: Target,
            view: 'dpp' as ViewState,
            color: 'from-emerald-500 to-teal-500',
            stats: 'Updated Daily'
        },
        {
            title: 'My Profile',
            description: 'Manage your personal details, plan, and academic preferences.',
            icon: User,
            view: 'profile' as ViewState,
            color: 'from-slate-600 to-slate-800',
            stats: 'Active'
        },
        {
            title: 'Settings',
            description: 'Configure your experience, theme, and notification preferences.',
            icon: Settings,
            view: 'profile' as ViewState, // Reuse profile for now or add settings
            color: 'from-gray-400 to-gray-600',
            stats: 'Configured'
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: 'spring' as const,
                stiffness: 100
            }
        }
    };

    return (
        <div className="min-h-screen pt-12 pb-24 px-4 sm:px-6 lg:px-8 bg-background text-foreground transition-colors duration-300">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto mb-16 relative">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/10 dark:bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-secondary/10 dark:bg-secondary/5 rounded-full blur-[100px] pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative z-10 text-center lg:text-left pt-10"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 dark:border-primary/20 mb-6">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Everything in one place</span>
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-black tracking-tighter mb-4">
                        Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/60">Origin</span>
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl lg:ml-0 mx-auto leading-relaxed">
                        Access all your learning modules, assessments, and community features from this high-performance hub.
                    </p>
                </motion.div>
            </div>

            {/* Grid Section */}
            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
                {exploreCards.map((card, index) => (
                    <motion.div
                        key={index}
                        variants={itemVariants}
                        whileHover={{ scale: 1.02, y: -5 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onNavigate(card.view)}
                        className="group relative cursor-pointer"
                    >
                        <div className="absolute inset-0 bg-card rounded-[2.5rem] border border-border shadow-xl shadow-foreground/5 dark:shadow-none transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-2xl group-hover:shadow-primary/10" />

                        <div className="relative p-10 flex flex-col h-full min-h-[320px]">
                            {/* Icon Box */}
                            <div className={`w-16 h-16 rounded-[1.5rem] bg-gradient-to-br ${card.color} p-4 text-white shadow-lg mb-8 transition-transform group-hover:scale-110 group-hover:rotate-6 duration-300`}>
                                <card.icon className="w-full h-full stroke-[2.5px]" />
                            </div>

                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-2xl font-black tracking-tight">{card.title}</h3>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <ArrowRight className="w-6 h-6 text-primary" />
                                    </div>
                                </div>
                                <p className="text-muted-foreground leading-relaxed font-medium">
                                    {card.description}
                                </p>
                            </div>

                            <div className="mt-8 pt-6 border-t border-border flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</span>
                                <span className="text-xs font-bold text-primary">{card.stats}</span>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
