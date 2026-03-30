'use client';
import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
    Crown,
    LogOut,
    Settings,
    Bell,
    Search,
    Sun,
    Moon,
    User as UserIcon,
    Timer,
    UserPlus,
    Code,
    LayoutGrid,
    ListTodo,
    BookOpen,
    FileText,
    Target,
    ChevronRight,
    Trophy,
    ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User, ViewState } from '@/types';

interface NavbarProps {
    user: User;
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    onLogout: () => void;
    theme: "dark" | "light" | "system";
    setTheme: (theme: "dark" | "light" | "system") => void;
}

export default function Navbar({ user, currentView, onNavigate, onLogout, theme, setTheme }: NavbarProps) {
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showExploreMenu, setShowExploreMenu] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const exploreMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setShowProfileMenu(false);
            }
            if (exploreMenuRef.current && !exploreMenuRef.current.contains(event.target as Node)) {
                setShowExploreMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const navItems = [
        { label: 'OGCode', icon: Code, view: 'ogcode' as ViewState },
        { label: 'AI Explainer', icon: () => <img src="/ai-bot.png" className="w-4 h-4 object-cover rounded-sm" />, view: 'doubt-solver' as ViewState },
        { label: 'Tests', icon: FileText, view: 'test-list' as ViewState },
        { label: 'DPP', icon: Target, view: 'dpp' as ViewState },
        { label: 'Goals', icon: ListTodo, view: 'tasks-goals' as ViewState },
        { label: 'Explore', icon: LayoutGrid, view: 'explore' as ViewState },
    ];

    return (
        <div
            className={`fixed ${theme === 'dark'
                    ? 'bg-black border-slate-800'
                    : 'bg-white border-slate-200'
                } top-6 left-0 right-0 mx-auto z-50 shadow-xl border rounded-[2rem] pointer-events-auto max-w-7xl w-[95%]`}
        >
            <div className="w-full h-full flex items-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="flex items-center justify-between h-16 w-full">

                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <img
                                src={user.role === 'student' ? '/origin-new.jpg' : '/O3-Origin-Logo.png'}
                                alt="ORIGIN"
                                className="h-9 w-auto cursor-pointer"
                                onClick={() => onNavigate('dashboard')}
                            />
                            <div className="hidden md:block h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2" />
                            <nav className="hidden md:flex items-center gap-1">
                                {navItems.map((item) => {
                                    const isActive = currentView === item.view ||
                                        (item.view === 'ogcode' && currentView === 'ogcode-workspace');

                                    if (item.label === 'Explore') {
                                        return (
                                            <div
                                                key={item.label}
                                                className="relative"
                                                onMouseEnter={() => setShowExploreMenu(true)}
                                                onMouseLeave={() => setShowExploreMenu(false)}
                                            >
                                                <button
                                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${isActive || showExploreMenu
                                                        ? 'text-black dark:text-blue-400 bg-black/5 dark:bg-blue-900/30'
                                                        : 'text-black dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-slate-800/50'
                                                        }`}
                                                >
                                                    <item.icon className="w-4 h-4" />
                                                    {item.label}
                                                </button>

                                                <AnimatePresence>
                                                    {showExploreMenu && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                            transition={{ duration: 0.2, ease: "easeOut" }}
                                                            className="absolute left-0 mt-2 w-80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 p-2 z-50 origin-top-left"
                                                        >
                                                            <div className="px-3 py-2 mb-2">
                                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-black/50 dark:text-slate-500">Learning Hub</h3>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-1">
                                                                {[
                                                                    { label: 'Study Corner', icon: BookOpen, view: 'study-corner', desc: 'NCERT & Materials', color: 'text-blue-500' },
                                                                    { label: 'Pomodoro', icon: Timer, view: 'pomodoro', desc: 'Focus timer', color: 'text-rose-500' },
                                                                    { label: 'Leaderboard', icon: Trophy, view: 'leaderboard', desc: 'Global rankings', color: 'text-amber-500' }
                                                                ].map((subItem) => (
                                                                    <button
                                                                        key={subItem.label}
                                                                        onClick={() => {
                                                                            onNavigate(subItem.view as ViewState);
                                                                            setShowExploreMenu(false);
                                                                        }}
                                                                        className="w-full flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
                                                                    >
                                                                        <div className={`w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-transform group-hover:scale-110 ${subItem.color}`}>
                                                                            <subItem.icon className="w-5 h-5" />
                                                                        </div>
                                                                        <div className="text-left flex-1">
                                                                            <p className="text-sm font-bold text-black dark:text-white leading-none mb-1">{subItem.label}</p>
                                                                            <p className="text-[10px] text-black/60 dark:text-slate-400">{subItem.desc}</p>
                                                                        </div>
                                                                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:translate-x-1 transition-transform" />
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                                                <button
                                                                    onClick={() => onNavigate('explore')}
                                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors group"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold text-black dark:text-blue-400">View All Features</span>
                                                                    </div>
                                                                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                                </button>
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    }

                                    return (
                                        <button
                                            key={item.label}
                                            onClick={() => onNavigate(item.view)}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${isActive
                                                ? 'text-black dark:text-blue-400 bg-black/5 dark:bg-blue-900/30'
                                                : 'text-black dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-slate-800/50'
                                                }`}
                                        >
                                            <item.icon className="w-4 h-4" />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Center Welcome Message (Desktop) - REMOVED from main row */}

                        {/* Right Actions */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors bg-white/50 dark:bg-slate-800/50 rounded-full hover:bg-white dark:hover:bg-slate-800"
                            >
                                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>

                            <button className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors bg-white/50 dark:bg-slate-800/50 rounded-full hover:bg-white dark:hover:bg-slate-800">
                                <Search className="w-4 h-4" />
                            </button>

                            <button className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors relative bg-white/50 dark:bg-slate-800/50 rounded-full hover:bg-white dark:hover:bg-slate-800">
                                <Bell className="w-4 h-4" />
                                <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
                            </button>

                            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                            <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all shadow-lg shadow-blue-500/20 active:scale-95 group">
                                <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
                                <span className="text-xs font-black uppercase tracking-widest">Invite</span>
                            </button>

                            {/* Profile Dropdown */}
                            <div className="relative ml-1" ref={profileMenuRef}>
                                <button
                                    onMouseEnter={() => setShowProfileMenu(true)}
                                    onClick={() => onNavigate('profile')}
                                    className="flex items-center gap-2 pl-1 pr-1 py-1 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                                >
                                    <Avatar className="w-8 h-8 border-2 border-white dark:border-slate-800 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                                        <AvatarFallback className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white text-xs font-bold">
                                            {user.name.charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>

                                {showProfileMenu && (
                                    <div
                                        onMouseLeave={() => setShowProfileMenu(false)}
                                        className="absolute right-0 mt-2 w-60 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-800 py-2 animate-in fade-in zoom-in-95 duration-200 z-50"
                                    >
                                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 mb-2">
                                            <p className="text-sm font-bold text-black dark:text-white">{user.name}</p>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className="text-xs text-black/60 dark:text-slate-400 truncate max-w-[120px]">{user.email}</p>
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-black/5 text-black dark:bg-blue-900/30 dark:text-blue-400 border-black/10 dark:border-blue-800 font-bold">
                                                    {user.isPremium ? 'PRO' : 'FREE'}
                                                </Badge>
                                            </div>
                                        </div>

                                        {!user.isPremium && (
                                            <div className="px-3 mb-2">
                                                <button
                                                    onClick={() => {
                                                        onNavigate('premium');
                                                        setShowProfileMenu(false);
                                                    }}
                                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-[1.02] transition-all"
                                                >
                                                    <Crown className="w-3.5 h-3.5" />
                                                    Upgrade to Pro
                                                </button>
                                            </div>
                                        )}

                                        <div className="px-2">
                                            <button
                                                onClick={() => {
                                                    onNavigate('profile');
                                                    setShowProfileMenu(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors group"
                                            >
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                My Profile
                                            </button>
                                            <button
                                                onClick={() => {
                                                    onNavigate('profile');
                                                    setShowProfileMenu(false);
                                                }}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg hover:text-slate-900 dark:hover:text-white transition-colors"
                                            >
                                                <Settings className="w-4 h-4" />
                                                Settings
                                            </button>
                                            <button
                                                onClick={onLogout}
                                                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                            >
                                                <LogOut className="w-4 h-4" />
                                                Logout
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Secondary Greeter Strip REMOVED for minimalism */}
                </div>
            </div>
        </div>
    );
}
