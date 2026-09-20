'use client';
import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useLayout } from '@/context/LayoutContext';
import { useAiAccess } from '@/context/AiAccessContext';
import { useNotifications } from '@/context/NotificationContext';
import { cn } from '@/lib/utils';
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
    Home,
    LayoutGrid,
    ListTodo,
    BookOpen,
    Building2,
    FileText,
    Sparkles,
    Target,
    UsersRound,
    ChevronRight,
    ChevronLeft,
    Trophy,
    ArrowRight,
    Menu,
    X
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';
import type { User, ViewState } from '@/types';
import GlobalSearch from './GlobalSearch';
import { getEntitledSubjects } from '@/lib/entitlements';

interface NavbarProps {
    user: User;
    currentView: ViewState;
    onNavigate: (view: ViewState) => void;
    onPrefetch?: (view: ViewState) => void;
    onLogout: () => void;
    theme: "dark" | "light" | "system";
    setTheme: (theme: "dark" | "light" | "system") => void;
    connectEnabled?: boolean;
    premiumEnabled?: boolean;
    socialEnabled?: boolean;
    leftOffset?: number;
    expanded?: boolean;
    onToggleExpanded?: () => void;
    /** Opens the Ori assistant. Undefined when Ori is unavailable or hidden. */
    onOpenOri?: () => void;
    oriActive?: boolean;
}

export default function Navbar({ user, currentView, onNavigate, onPrefetch, onLogout, theme, setTheme, connectEnabled, premiumEnabled, socialEnabled, leftOffset = 0, expanded = false, onToggleExpanded, onOpenOri, oriActive }: NavbarProps) {
    const { unreadCount } = useNotifications();
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showExploreMenu, setShowExploreMenu] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);
    const exploreMenuRef = useRef<HTMLDivElement>(null);
    // AI Feature Toggle epic — hide the AI Explainer nav entry when the Explainer
    // is disabled for this student (or for non-students). doc 06 §3.
    const { aiExplainer } = useAiAccess();

    // P2-13: the PRO badge (and the upgrade CTA) must follow the DERIVED
    // entitlement union, not the denormalised `is_premium` mirror. Reading the
    // mirror let the UI show "PRO" while every subject was still locked —
    // confirmed reproducible (see MOBILE_UI_REDESIGN_PLAN.md P2-13).
    const hasActiveSubjects = getEntitledSubjects(user).length > 0;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const { availableWidth } = useLayout();
    const isConstrained = availableWidth < 1024;

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

    const isTeacher = user.role?.toLowerCase() === 'teacher';

    const navItems = isTeacher ? [] : [
        { label: 'Home', icon: Home, view: 'dashboard' as ViewState },
        { label: 'OGCode', icon: Code, view: 'ogcode' as ViewState },
        ...(aiExplainer ? [{ label: 'AI Explainer', icon: () => <Image src="/iconsax/Ai-Icon.png" alt="AI Explainer" width={20} height={20} className="object-contain" />, view: 'doubt-solver' as ViewState }] : []),
        { label: 'Tests', icon: FileText, view: 'test-list' as ViewState },
        { label: 'Rooms', icon: Crown, view: 'study-rooms' as ViewState },
        { label: 'DPP', icon: Target, view: 'dpp' as ViewState },
        { label: 'Goals', icon: ListTodo, view: 'tasks-goals' as ViewState },
        { label: 'Explore', icon: LayoutGrid, view: 'explore' as ViewState },
        ...(socialEnabled ? [{ label: 'Social', icon: UserPlus, view: 'social' as ViewState }] : []),
        ...(connectEnabled ? [{ label: 'Connect', icon: Building2, view: 'connect' as ViewState }] : []),
    ];

    const isActive = (item: { view: ViewState; label: string }) => {
        const currentViewValue = String(currentView);
        return currentViewValue === item.view ||
            (item.view === 'study-rooms' && currentViewValue.startsWith('study-rooms')) ||
            (item.view === 'ogcode' && currentView === 'ogcode-workspace');
    };

    const sidebarBg = 'bg-[hsl(var(--neu-bg))] border-r border-primary/10 shadow-[4px_0_14px_hsl(var(--neu-shadow)/35%),-2px_0_6px_hsl(var(--neu-light)/25%)]';

    return (
        <>
            {/* ── DESKTOP SIDEBAR expand/collapse handle (md+) ─────────────── */}
            <button
                type="button"
                onClick={onToggleExpanded}
                aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
                title={expanded ? 'Collapse navigation' : 'Expand navigation'}
                style={leftOffset > 0 ? { left: leftOffset + (expanded ? 150 : 72) - 12 } : undefined}
                className={cn(
                    'fixed top-1/2 -translate-y-1/2 z-[55] hidden md:flex items-center justify-center h-10 w-6 rounded-r-lg',
                    'bg-[hsl(var(--neu-bg))] border border-l-0 border-primary/20 shadow-lg text-muted-foreground hover:text-primary transition-all duration-300',
                    leftOffset > 0 ? '' : (expanded ? 'left-[138px]' : 'left-[60px]'),
                )}
            >
                {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* ── DESKTOP SIDEBAR (md+) ────────────────────────────────────── */}
            <nav
                id="tutorial-nav"
                style={leftOffset > 0 ? { left: leftOffset } : undefined}
                className={cn(
                    // safe-top: under viewport-fit=cover the sidebar starts at top:0, so its
                    // first item (logo) rendered under the status bar — visible in landscape
                    // and on tablets/foldables where this desktop rail is used on a device
                    // with a cutout. (MOBILE_UI_REDESIGN_PLAN Phase 0, found via rotation QA)
                    'fixed left-0 top-0 h-dvh z-50 hidden md:flex flex-col transition-[width] duration-300 safe-top',
                    expanded ? 'w-[150px]' : 'w-[72px]',
                    sidebarBg
                )}
            >
                {/* Logo */}
                <div className="flex items-center justify-center h-[48px] flex-shrink-0">
                    <button
                        onClick={() => onNavigate('dashboard')}
                        onMouseEnter={() => onPrefetch?.('dashboard')}
                        className="p-1 rounded-xl hover:bg-primary/5 transition-colors"
                    >
                        <img
                            src={user.role?.toLowerCase() === 'student' ? '/origin-new.jpg' : '/O3-Origin-Logo.png'}
                            alt="ORIGIN"
                            className="h-9 w-9 object-cover rounded-lg"
                        />
                    </button>
                </div>

                {/* Divider */}
                <div className="w-10 mx-auto h-px bg-primary/10 flex-shrink-0" />

                {/* Search — near top */}
                <div className="relative w-full group/search px-1 pt-1 flex-shrink-0">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsSearchOpen(true)}
                        title="Search (⌘K)"
                        className={cn(
                            'flex w-full rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all',
                            expanded ? 'flex-row items-center gap-3 py-2 px-3' : 'flex-col items-center gap-0.5 py-2 px-1',
                        )}
                    >
                        <Search className="w-5 h-5 shrink-0" />
                        <span className={cn('font-bold', expanded ? 'text-sm flex-1 text-left' : 'text-[9px] leading-none')}>Search</span>
                    </motion.button>
                    {!expanded && (
                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                        <div className={cn(
                            'flex items-center h-9 rounded-r-xl bg-[hsl(var(--neu-bg))] backdrop-blur-xl',
                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                            'w-0 group-hover/search:w-24 transition-all duration-200 ease-out'
                        )}>
                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">Search</span>
                        </div>
                    </div>
                    )}
                </div>

                {/* Notifications — near top */}
                <div className="relative w-full group/alerts px-1 pb-1 flex-shrink-0">
                    <div className={cn(
                        'flex w-full rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all',
                        expanded ? 'flex-row items-center gap-3 py-2 px-3' : 'flex-col items-center gap-0.5 py-2 px-1',
                    )}>
                        <div className="shrink-0"><NotificationBell /></div>
                        <span className={cn('font-bold', expanded ? 'text-sm flex-1 text-left' : 'text-[9px] leading-none')}>Alerts</span>
                    </div>
                    {!expanded && (
                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                        <div className={cn(
                            'flex items-center h-9 rounded-r-xl bg-[hsl(var(--neu-bg))] backdrop-blur-xl',
                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                            'w-0 group-hover/alerts:w-24 transition-all duration-200 ease-out'
                        )}>
                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">Alerts</span>
                        </div>
                    </div>
                    )}
                </div>

                {/* Divider */}
                <div className="w-10 mx-auto h-px bg-primary/10 flex-shrink-0" />

                {/* Theme toggle — near top for quick access */}
                <div className="relative w-full px-1 pt-2 flex-shrink-0 group/theme-top">
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                        className={cn(
                            'flex w-full rounded-xl transition-all',
                            expanded ? 'flex-row items-center gap-3 py-2.5 px-3' : 'flex-col items-center gap-0.5 py-2.5 px-1',
                            theme === 'light'
                                ? 'text-primary bg-primary/10'
                                : 'text-slate-400 hover:text-amber-500 hover:bg-primary/5'
                        )}
                    >
                        {theme === 'dark' ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
                        <span className={cn('font-bold', expanded ? 'text-sm flex-1 text-left' : 'text-[9px] leading-none')}>
                            {expanded ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : 'Theme'}
                        </span>
                    </motion.button>
                    {!expanded && (
                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                        <div className={cn(
                            'flex items-center h-9 rounded-r-xl bg-[hsl(var(--neu-bg))] backdrop-blur-xl',
                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                            'w-0 group-hover/theme-top:w-28 transition-all duration-200 ease-out'
                        )}>
                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">
                                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                            </span>
                        </div>
                    </div>
                    )}
                </div>

                <div className="w-10 mx-auto h-px bg-primary/10 flex-shrink-0 mt-2" />

                {/* Nav Items */}
                <div className="flex-1 flex flex-col items-center gap-1 py-3 overflow-y-auto no-scrollbar px-1">
                    {navItems.map((item) => {
                        const active = isActive(item);
                        const Icon = item.icon as React.ComponentType<{ className?: string }>;

                        return (
                            <div
                                key={item.label}
                                id={`tutorial-nav-${item.view}`}
                                className="relative w-full group/navitem"
                                onMouseEnter={() => {
                                    if (item.label === 'Explore') setShowExploreMenu(true);
                                }}
                                onMouseLeave={() => {
                                    if (item.label === 'Explore') setShowExploreMenu(false);
                                }}
                                ref={item.label === 'Explore' ? exploreMenuRef : undefined}
                            >
                                <button
                                    id={`tutorial-nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                                    onClick={() => onNavigate(item.view)}
                                    onMouseEnter={() => onPrefetch?.(item.view)}
                                    onFocus={() => onPrefetch?.(item.view)}
                                    title={item.label}
                                    className={cn(
                                        'relative flex w-full rounded-xl transition-all duration-200 group',
                                        expanded ? 'flex-row items-center gap-3 py-2.5 px-3' : 'flex-col items-center gap-0.5 py-2.5 px-1',
                                        active
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-slate-400 dark:text-slate-500 hover:bg-primary/5 hover:text-primary'
                                    )}
                                >
                                    {/* Active pill */}
                                    {active && (
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                                    )}
                                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                                        {typeof item.icon === 'function' && item.icon.toString().includes('img')
                                            ? <Icon />
                                            : <Icon className="w-5 h-5" />
                                        }
                                    </div>
                                    <span className={cn(
                                        'font-bold truncate',
                                        expanded ? 'text-sm flex-1 text-left' : 'text-[9px] leading-none w-full text-center',
                                    )}>{item.label}</span>
                                </button>

                                {/* Hover expand tooltip — only in collapsed rail; hidden once Explore sub-menu is open */}
                                {!expanded && !(item.label === 'Explore' && showExploreMenu) && (
                                    <div className="absolute left-[72px] top-1/2 -translate-y-1/2 pointer-events-none z-[60] flex items-center">
                                        <div className={cn(
                                            'flex items-center h-9 rounded-r-xl bg-[hsl(var(--neu-bg))] backdrop-blur-xl',
                                            'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                                            'w-0 group-hover/navitem:w-28 transition-all duration-200 ease-out'
                                        )}>
                                            <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">{item.label}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Explore sub-menu */}
                                {item.label === 'Explore' && (
                                    <AnimatePresence>
                                        {showExploreMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                                transition={{ duration: 0.2, ease: 'easeOut' }}
                                                className={cn('absolute top-0 w-80 bg-[hsl(var(--neu-bg))] backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-primary/20 dark:border-zinc-800 p-2 z-50 origin-left', expanded ? 'left-[154px]' : 'left-[76px]')}
                                            >
                                                <div className="px-3 py-2 mb-2">
                                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Learning Hub</h3>
                                                </div>
                                                <motion.div
                                                    className="grid grid-cols-1 gap-1"
                                                    initial="hidden"
                                                    animate="show"
                                                    variants={{
                                                        hidden: { opacity: 0 },
                                                        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                                                    }}
                                                >
                                                    {[
                                                        { label: 'Study Corner', icon: BookOpen, view: 'study-corner', desc: 'NCERT & Materials', color: 'text-primary' },
                                                        { label: 'Pomodoro', icon: Timer, view: 'pomodoro', desc: 'Focus timer', color: 'text-primary' },
                                                        { label: 'Leaderboard', icon: Trophy, view: 'leaderboard', desc: 'Global rankings', color: 'text-amber-500' }
                                                    ].map((subItem) => (
                                                        <motion.button
                                                            key={subItem.label}
                                                            variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } }}
                                                            onClick={() => {
                                                                onNavigate(subItem.view as ViewState);
                                                                setShowExploreMenu(false);
                                                            }}
                                                            onMouseEnter={() => onPrefetch?.(subItem.view as ViewState)}
                                                            onFocus={() => onPrefetch?.(subItem.view as ViewState)}
                                                            className="w-full flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-all group"
                                                        >
                                                            <div className={`w-10 h-10 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center transition-transform group-hover:scale-110 ${subItem.color}`}>
                                                                <subItem.icon className="w-5 h-5" />
                                                            </div>
                                                            <div className="text-left flex-1">
                                                                <p className="text-sm font-bold text-black dark:text-white leading-none mb-1">{subItem.label}</p>
                                                                <p className="text-[10px] text-slate-500 dark:text-zinc-500">{subItem.desc}</p>
                                                            </div>
                                                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-zinc-700 group-hover:translate-x-1 transition-transform" />
                                                        </motion.button>
                                                    ))}
                                                </motion.div>
                                                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                                    <button
                                                        onClick={() => onNavigate('explore')}
                                                        onMouseEnter={() => onPrefetch?.('explore')}
                                                        onFocus={() => onPrefetch?.('explore')}
                                                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-primary/5 dark:hover:bg-primary/10 rounded-xl transition-colors group"
                                                    >
                                                        <span className="text-xs font-bold text-primary">View All Features</span>
                                                        <ArrowRight className="w-3.5 h-3.5 text-rose-400 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Divider */}
                <div className="w-10 mx-auto h-px bg-primary/10 flex-shrink-0" />

                {/* Bottom actions — profile */}
                <div className="flex flex-col items-center gap-1 py-3 px-1 flex-shrink-0">
                    {/* Avatar / Profile */}
                    <div className="relative w-full group/profile" ref={profileMenuRef}>
                        <button
                            onMouseEnter={() => {
                                setShowProfileMenu(true);
                                onPrefetch?.('profile');
                            }}
                            onClick={() => onNavigate('profile')}
                            onFocus={() => onPrefetch?.('profile')}
                            title="Profile"
                            className={cn(
                                'flex w-full rounded-xl text-slate-400 hover:text-primary hover:bg-primary/5 transition-all',
                                expanded ? 'flex-row items-center gap-3 py-2 px-3' : 'flex-col items-center gap-0.5 py-2.5 px-1',
                            )}
                        >
                            <Avatar className="w-6 h-6 border border-primary/20 shadow-sm shrink-0">
                                <AvatarFallback className="bg-primary text-white text-[10px] font-bold">
                                    {user.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <span className={cn('font-bold truncate', expanded ? 'text-sm flex-1 text-left' : 'text-[9px] leading-none')}>
                                {expanded ? (user.name.split(' ')[0] || 'Profile') : 'Profile'}
                            </span>
                        </button>
                        {/* Hover expand tooltip — suppressed while the profile menu is
                            open (the same hover opens it), so the label no longer
                            overlaps the menu / logout row. */}
                        {!expanded && !showProfileMenu && (
                        <div className="absolute left-[72px] bottom-0 pointer-events-none z-[60] flex items-center">
                            <div className={cn(
                                'flex items-center h-9 rounded-r-xl bg-[hsl(var(--neu-bg))] backdrop-blur-xl',
                                'border border-l-0 border-primary/20 shadow-lg overflow-hidden',
                                'w-0 group-hover/profile:w-28 transition-all duration-200 ease-out'
                            )}>
                                <span className="whitespace-nowrap text-xs font-bold text-foreground px-3">Profile</span>
                            </div>
                        </div>
                        )}

                        {showProfileMenu && (
                            <motion.div
                                initial={{ opacity: 0, x: 10, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 10, scale: 0.95 }}
                                onMouseLeave={() => setShowProfileMenu(false)}
                                className={cn('absolute bottom-0 w-64 bg-[hsl(var(--neu-bg))] backdrop-blur-2xl rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-primary/20 dark:border-zinc-800 py-2 z-50 origin-bottom-left', expanded ? 'left-[154px]' : 'left-[76px]')}
                            >
                                <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 mb-2">
                                    <p className="text-sm font-black text-black dark:text-white">{user.name}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-slate-500 dark:text-zinc-500 truncate max-w-[120px]">{user.email}</p>
                                        {premiumEnabled && (
                                            <Badge className="text-[10px] h-5 px-1.5 bg-rose-600 text-white dark:bg-rose-500/20 dark:text-rose-400 border-none font-bold">
                                                {hasActiveSubjects ? 'PRO' : 'FREE'}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {premiumEnabled && !hasActiveSubjects && (
                                    <div className="px-3 mb-2">
                                        <button
                                            onClick={() => {
                                                onNavigate('premium');
                                                setShowProfileMenu(false);
                                            }}
                                            onMouseEnter={() => onPrefetch?.('premium')}
                                            onFocus={() => onPrefetch?.('premium')}
                                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:scale-[1.02] transition-all"
                                        >
                                            <Crown className="w-3.5 h-3.5" />
                                            Upgrade to Pro
                                        </button>
                                    </div>
                                )}

                                <motion.div
                                    className="px-2"
                                    initial="hidden"
                                    animate="show"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
                                    }}
                                >
                                    {[
                                        { label: 'My Profile', icon: UserIcon, action: () => onNavigate('profile'), color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/30' },
                                        { label: 'Settings', icon: Settings, action: () => onNavigate('profile'), color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-zinc-800/50' },
                                        { label: 'Logout', icon: LogOut, action: onLogout, color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/20' }
                                    ].map((menuItem) => (
                                        <motion.button
                                            key={menuItem.label}
                                            variants={{ hidden: { opacity: 0, x: 10 }, show: { opacity: 1, x: 0 } }}
                                            onClick={() => {
                                                menuItem.action();
                                                setShowProfileMenu(false);
                                            }}
                                            onMouseEnter={() => {
                                                if (menuItem.label === 'My Profile' || menuItem.label === 'Settings') {
                                                    onPrefetch?.('profile');
                                                }
                                            }}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-black dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg transition-colors group"
                                        >
                                            <div className={`w-8 h-8 rounded-lg ${menuItem.bg} flex items-center justify-center ${menuItem.color} group-hover:scale-110 transition-transform`}>
                                                <menuItem.icon className="w-4 h-4" />
                                            </div>
                                            {menuItem.label}
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </nav>

            {/* ── MOBILE TOP BAR — REMOVED 2026-09-20 ──────────────────────────
                It held: logo, theme toggle, search, notifications, avatar. All five
                now live in the More sheet, which frees 56px of vertical space on a
                844px screen — 6.6% more content on every single page.

                The one thing that could NOT simply move is notifications: a bell
                with an unread badge is a signal students must SEE, and burying it
                in a sheet means they stop noticing it. So the unread count is
                surfaced as a dot on the More tab instead — the signal survives,
                the chrome does not.

                ClientShell drops `pt-topbar` on mobile to reclaim the space;
                leaving it would have swapped a visible bar for 56px of nothing. */}

            {/* ── MOBILE BOTTOM TAB BAR (student only) ────────────────────── */}
            {!isTeacher && (
                <nav className={cn(
                    'fixed bottom-0 left-0 right-0 z-50 md:hidden',
                    'bg-background border-t border-border',
                    // Elevation is tonal, not a shadow (V1/DESIGN_LANGUAGE.md §2).
                    // The dual-shadow that was here read as a smudge on true black.
                    'safe-area-pb pb-safe'
                )}>
                    {(() => {
                      // Five items, per the user's own IA sketch (2026-09-20):
                      //   Home · Test · Ori (raised centre) · OGC · More
                      // Answers the open question from MOBILE_UX_RESEARCH_FINDINGS X-5.
                      //
                      // Two changes it makes: /tests is PROMOTED into the bar — GA4 puts
                      // it 12th by users precisely because it was buried behind "More" —
                      // and Practice becomes "OGC", named after the OGCode workspace
                      // every comparable Indian exam-prep app uses for its primary verb.
                      // Social and Daily/DPP move into More alongside AI Explainer, Goals,
                      // Focus time, Leaderboard, Contest, Study, Graphs, Profile, Connect.
                      const mobileTabs = ([
                            { label: 'Home',  icon: LayoutGrid, view: 'dashboard' as ViewState },
                            { label: 'Test',  icon: FileText,   view: 'test-list' as ViewState },
                            // Ori takes the centre. SINGLE TAP, not a long-press:
                            // a hold is invisible to a new student, is not exposed
                            // by TalkBack, and would put two unrelated actions on
                            // one control. If Ori is worth the most prominent slot
                            // in the app it is worth one tap.
                            { label: 'Ori',   icon: Sparkles,   view: null, center: true, ori: true },
                            // "OGC" not "Drill": the destination is the OGCode
                            // workspace and students already call it that.
                            { label: 'OGC',   icon: Code,       view: 'ogcode' as ViewState },
                            { label: 'More',  icon: Menu,       view: null },
                        ] as { label: string; icon: typeof LayoutGrid; view: ViewState | null; iconSrc?: string; center?: boolean; ori?: boolean }[])
                          // Rooms moved into More: 45 users vs OGCode's 71, and it is a
                          // deliberate-visit feature rather than a daily one.
                          .filter((item) => !item.ori || Boolean(onOpenOri));
                      return (
                    <div className="grid h-14" style={{ gridTemplateColumns: `repeat(${mobileTabs.length}, minmax(0, 1fr))` }}>
                        {mobileTabs
                          .map((item) => {
                            const active = item.ori
                                ? Boolean(oriActive)
                                : item.view ? isActive({ label: item.label, view: item.view }) : false;
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    onClick={() => {
                                        if (item.ori) { onOpenOri?.(); return; }
                                        if (item.view) { onNavigate(item.view); return; }
                                        setShowMobileMenu(true);
                                    }}
                                    aria-label={item.ori ? 'Ask Ori' : undefined}
                                    aria-current={active ? 'page' : undefined}
                                    className={cn(
                                        'relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors',
                                        item.center && '-mt-6',
                                        active && !item.center ? 'text-primary' : 'text-muted-foreground hover:text-primary',
                                        item.center && active && 'text-primary font-medium'
                                    )}
                                >
                                    {active && !item.center && (
                                        <span className="absolute top-0 w-8 h-0.5 bg-primary rounded-full" />
                                    )}
                                    {item.view === null && !item.center && unreadCount > 0 && (
                                        <span
                                            className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold tabular-nums text-destructive-foreground"
                                            aria-label={`${unreadCount} unread notifications`}
                                        >
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                    {item.iconSrc ? (
                                        <img
                                            src={item.iconSrc}
                                            alt=""
                                            draggable={false}
                                            className={cn('w-5 h-5 object-contain transition-opacity', active ? 'opacity-100' : 'opacity-70')}
                                        />
                                    ) : item.center ? (
                                        // Ori himself, not a glyph. 144px source cropped to the
                                        // head — the full character's face reads ~20px at this
                                        // size and the outstretched arms are lost. 6.5KB webp,
                                        // down from the 232KB full-body png.
                                        // The circle stays tonal rather than accent-filled: Ori is
                                        // blue, and blue-on-cyan has almost no separation.
                                        <span
                                            className={cn(
                                                'flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-surface-2 transition-colors',
                                                active ? 'ring-2 ring-primary' : 'ring-1 ring-border',
                                            )}
                                        >
                                            <img
                                                src="/ori2d/ori-nav.webp"
                                                alt=""
                                                aria-hidden
                                                width={56}
                                                height={56}
                                                className="h-full w-full object-contain"
                                                draggable={false}
                                            />
                                        </span>
                                    ) : (
                                        <Icon className="w-5 h-5" />
                                    )}
                                    <span className="text-[10px] font-medium leading-none">{item.label}</span>
                                </button>
                            );
                        })}
                    </div>
                      );
                    })()}
                </nav>
            )}
        </>
    );
}
