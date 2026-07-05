'use client';

import React, { useState } from 'react';
import AdminLayout from '@/components/layout/AdminLayout';
import {
    Settings,
    ShieldAlert,
    ToggleLeft,
    ToggleRight,
    Database,
    Cpu,
    Activity,
    Lock,
    History,
    RefreshCw,
    AlertTriangle,
    Zap,
    Globe,
    Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FeatureToggle = ({ title, desc, active, onToggle }: any) => (
    <div className="flex items-start justify-between flex-wrap gap-2 p-6 neu-raised rounded-2xl group hover:opacity-90 transition-all">
        <div className="space-y-1 min-w-0">
            <h4 className="text-sm font-black text-foreground uppercase tracking-tight break-words">{title}</h4>
            <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed max-w-[240px] italic break-words">{desc}</p>
        </div>
        <button
            onClick={onToggle}
            className={`p-1 w-12 h-6 rounded-full transition-all duration-300 relative ${active ? 'bg-emerald-500' : 'bg-muted'}`}
        >
            <motion.div
                animate={{ x: active ? 24 : 0 }}
                className="w-4 h-4 bg-white rounded-full shadow-lg"
            />
        </button>
    </div>
);

export default function SystemSettings() {
    const [features, setFeatures] = useState({
        aiAvatar: true,
        betaGrader: false,
        pomodoroGroups: true,
        globalChat: false,
    });

    const [isMaintenance, setIsMaintenance] = useState(false);

    return (
        <AdminLayout>
            <div className="space-y-12 pb-24">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Feature Management */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="neu-raised rounded-[2.5rem] p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Zap className="w-24 h-24" />
                            </div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground mb-8 break-words">Feature <span className="text-muted-foreground font-normal italic">Gating</span></h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FeatureToggle
                                    title="AI Avatar Studio"
                                    desc="Generative pfps for student profiles. Cohort A only."
                                    active={features.aiAvatar}
                                    onToggle={() => setFeatures({...features, aiAvatar: !features.aiAvatar})}
                                />
                                <FeatureToggle
                                    title="Experimental Grader"
                                    desc="Low-latency C++ execution using WebAssembly."
                                    active={features.betaGrader}
                                    onToggle={() => setFeatures({...features, betaGrader: !features.betaGrader})}
                                />
                                <FeatureToggle
                                    title="Group Pomodoro"
                                    desc="Shared focus timers with community leaderboards."
                                    active={features.pomodoroGroups}
                                    onToggle={() => setFeatures({...features, pomodoroGroups: !features.pomodoroGroups})}
                                />
                                <FeatureToggle
                                    title="Real-time Doubt Hub"
                                    desc="WebSocket-accelerated peer-to-peer resolution."
                                    active={features.globalChat}
                                    onToggle={() => setFeatures({...features, globalChat: !features.globalChat})}
                                />
                            </div>
                        </div>

                        {/* Audit Log */}
                        <div className="bg-card border border-border/30 rounded-[2.5rem] p-10 flex flex-col">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-8">
                                <div className="min-w-0">
                                    <h3 className="text-xl font-black uppercase tracking-tight text-foreground mb-1 break-words">Audit <span className="text-muted-foreground italic font-normal">Vault</span></h3>
                                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em] break-words">Immutable record of high-privilege operations.</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative group">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Search logs..."
                                            className="bg-background border border-border/40 rounded-2xl pl-12 pr-6 py-3 text-[10px] uppercase font-black text-foreground focus:outline-none w-48"
                                        />
                                    </div>
                                    <button className="p-3 bg-card/40 border border-border/30 rounded-2xl text-muted-foreground hover:text-foreground transition-all"><RefreshCw className="w-5 h-5" /></button>
                                </div>
                            </div>
                            <div className="space-y-4">
                                {[
                                    { admin: 'Naveen S.', action: 'MOD_USER_ROLE', target: 'ID:4812 -> ADMIN', time: '08:42:15 UTC', ip: '192.168.1.1' },
                                    { admin: 'System Script', action: 'CLEAN_TEMP_CACHE', target: 'Sector 01', time: '07:22:01 UTC', ip: 'internal' },
                                    { admin: 'Deepika K.', action: 'FLUSH_FAILED_TX', target: 'Ledger Store', time: '04:12:55 UTC', ip: '102.14.88.2' },
                                    { admin: 'Naveen S.', action: 'TOGGLE_FEAT', target: 'aiAvatar: ENABLED', time: '02:00:12 UTC', ip: '192.168.1.1' },
                                ].map((log, i) => (
                                    <div key={i} className="flex items-center justify-between flex-wrap gap-2 p-4 bg-muted/10 rounded-xl border border-border/30 group hover:bg-muted/20 transition-all">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-2 h-2 shrink-0 rounded-full bg-blue-500 group-hover:animate-pulse" />
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-foreground uppercase break-all">{log.action}</p>
                                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-[9px] font-black text-muted-foreground truncate max-w-[120px]">{log.target}</span>
                                                    <span className="text-[8px] text-muted-foreground/50 italic">BY {log.admin}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] font-mono text-muted-foreground">{log.time}</p>
                                            <p className="text-[8px] font-mono text-muted-foreground/40">{log.ip}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Danger Zone Side-Panel */}
                    <div className="space-y-8">
                        <div className="bg-rose-500/5 border border-rose-500/20 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-20 pointer-events-none" />
                            <div className="w-16 h-16 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 relative z-10 group-hover:rotate-12 transition-transform duration-500">
                                <AlertTriangle className="w-8 h-8 text-rose-500" />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-[0.22em] text-rose-500 mb-4 relative z-10">Danger Zone</h3>

                            <div className="space-y-4 w-full relative z-10">
                                <button
                                    onClick={() => setIsMaintenance(!isMaintenance)}
                                    className={`w-full py-4 rounded-2xl flex items-center justify-between px-6 transition-all border ${isMaintenance ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-500/20' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 hover:bg-rose-500/20'}`}
                                >
                                    <div className="text-left">
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Maintenance Mode</p>
                                        <p className={`text-[8px] uppercase font-bold ${isMaintenance ? 'text-rose-100' : 'text-rose-700'}`}>{isMaintenance ? 'Active - Site Restricted' : 'Inactive - Site Online'}</p>
                                    </div>
                                    <Lock className={`w-4 h-4 transition-transform ${isMaintenance ? 'rotate-0' : 'rotate-180 opacity-50'}`} />
                                </button>

                                <button className="w-full py-4 bg-card border border-border/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border/60 transition-all flex items-center justify-center gap-3">
                                    <Database className="w-4 h-4" />
                                    Purge Transient Cache
                                </button>

                                <button className="w-full py-4 bg-card border border-border/30 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border/60 transition-all flex items-center justify-center gap-3">
                                    <History className="w-4 h-4" />
                                    Flush Session Vault
                                </button>
                            </div>
                        </div>

                        {/* System Health / API Stats Sidebar */}
                        <div className="neu-raised rounded-[2.5rem] p-10 space-y-8">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground break-words">Runtime Health</h3>
                            <div className="space-y-6">
                                {[
                                    { label: 'DB Connection Pool', value: '42 / 100', color: 'emerald' },
                                    { label: 'Edge Latency', value: '18ms', color: 'blue' },
                                    { label: 'WASM Runtime', value: 'STABLE', color: 'emerald' },
                                ].map((stat, i) => (
                                    <div key={i} className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 break-words">{stat.label}</p>
                                            <p className="text-sm font-black text-foreground break-words">{stat.value}</p>
                                        </div>
                                        <div className={`w-12 h-1 shrink-0 bg-${stat.color}-500/20 rounded-full overflow-hidden`}>
                                            <div className={`h-full bg-${stat.color}-500 w-[60%]`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}
