'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Bell, 
    Search, 
    ShieldCheck, 
    Activity, 
    Globe,
    ExternalLink
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isCollapsed, setCollapsed] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [credentials, setCredentials] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    // Initial session check
    React.useEffect(() => {
        const sessionAuth = sessionStorage.getItem('origin-admin-auth');
        if (sessionAuth === 'true') {
            setIsAuthorized(true);
        }
    }, []);

    const handleAdminLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        setError('');

        // Artificial delay for "Security Clearance" feel
        await new Promise(resolve => setTimeout(resolve, 1200));

        if (credentials.email === 'admin@origin.com' && credentials.password === 'admin@origin') {
            sessionStorage.setItem('origin-admin-auth', 'true');
            setIsAuthorized(true);
        } else {
            setError('ACCESS DENIED: INVALID CLEARANCE LEVEL');
        }
        setIsVerifying(false);
    };

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 selection:bg-emerald-500/30">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md"
                >
                    <div className="bg-white/5 border border-white/5 rounded-[2.5rem] p-10 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
                        {/* Background Decoration */}
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full" />
                        
                        <div className="relative z-10 space-y-8">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                                    <ShieldCheck className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h1 className="text-2xl font-black text-white uppercase tracking-widest">Admin Console</h1>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em]">Sector 01 Clearance Required</p>
                            </div>

                            <form onSubmit={handleAdminLogin} className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Terminal ID</label>
                                    <input 
                                        type="email" 
                                        value={credentials.email}
                                        onChange={(e) => setCredentials({...credentials, email: e.target.value})}
                                        placeholder="admin@origin.com"
                                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Security Key</label>
                                    <input 
                                        type="password" 
                                        value={credentials.password}
                                        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
                                        placeholder="••••••••"
                                        className="w-full bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                        required
                                    />
                                </div>

                                <AnimatePresence mode="wait">
                                    {error && (
                                        <motion.p 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="text-[10px] font-black text-rose-500 uppercase tracking-widest text-center"
                                        >
                                            {error}
                                        </motion.p>
                                    )}
                                </AnimatePresence>

                                <button 
                                    type="submit"
                                    disabled={isVerifying}
                                    className={`w-full py-4 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 active:scale-95 shadow-xl ${isVerifying ? 'bg-slate-800 text-slate-500' : 'bg-white text-zinc-950 hover:bg-emerald-500 hover:shadow-emerald-500/10'}`}
                                >
                                    {isVerifying ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                                            Verifying Clearance...
                                        </>
                                    ) : (
                                        'Initialize Console'
                                    )}
                                </button>
                            </form>

                            <button 
                                onClick={() => router.push('/dashboard')}
                                className="w-full text-[9px] font-black uppercase tracking-widest text-slate-600 hover:text-white transition-colors"
                            >
                                Return to Student Hub
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    const pageTitle = pathname.split('/').pop()?.replace(/-/g, ' ') || 'Mission Control';

    return (
        <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30 selection:text-emerald-200 antialiased overflow-x-hidden scroll-smooth">
            {/* Sidebar */}
            <AdminSidebar 
                isCollapsed={isCollapsed} 
                setCollapsed={setCollapsed} 
                onLogout={logout} 
            />

            {/* Main Content Area */}
            <motion.main
                animate={{ 
                    paddingLeft: isCollapsed ? 80 : 280,
                    opacity: 1
                }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col min-h-screen"
            >
                {/* Top Navigation Bar */}
                <header className="sticky top-0 z-50 h-[80px] bg-zinc-950/80 backdrop-blur-xl border-b border-white/5 px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-1">Sector 01</h2>
                            <h1 className="text-xl font-black uppercase tracking-tight text-white group cursor-default flex items-center gap-2">
                                {pageTitle}
                                <span className="opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink className="w-4 h-4 text-slate-500" /></span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* System Health / Real-time stats marquee placeholder */}
                        <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-white/5 rounded-full border border-white/5 text-[10px] font-bold tracking-widest uppercase text-slate-400">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                API: 42ms
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <div className="flex items-center gap-2">
                                <Activity className="w-3 h-3 text-cyan-400" />
                                LOAD: 14%
                            </div>
                            <div className="w-1 h-1 rounded-full bg-white/10" />
                            <div className="flex items-center gap-2">
                                <Globe className="w-3 h-3 text-amber-500" />
                                ACTIVE: 1,402
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all border border-white/5">
                                <Search className="w-5 h-5" />
                            </button>
                            <button className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all border border-white/5 relative">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full ring-4 ring-zinc-950 animate-pulse" />
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-8 lg:p-12 relative overflow-visible">
                    {/* Background Gradients - Hardware Accelerated */}
                    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/10 blur-[140px] rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none transform-gpu will-change-transform" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full translate-y-1/4 -translate-x-1/4 pointer-events-none transform-gpu will-change-transform opacity-60" />
                    
                    <div className="relative z-10">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={pathname}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </motion.main>
        </div>
    );
}
