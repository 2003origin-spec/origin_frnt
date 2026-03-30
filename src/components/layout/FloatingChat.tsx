'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FloatingChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(''); // Just clear it for the mock
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="mb-4 w-80 sm:w-96 bg-white dark:bg-[#060D1A] rounded-2xl shadow-2xl border border-slate-200 dark:border-indigo-500/20 overflow-hidden flex flex-col"
                    >
                        {/* Header */}
                        <div className="bg-indigo-600 dark:bg-indigo-900/40 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center p-1 border border-white/20">
                                    <img 
                                        src="/Dipraj-ChatBot.png" 
                                        alt="Deepraj ChatBot" 
                                        className="w-full h-full object-contain drop-shadow-md"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                    {/* Fallback icon if image fails */}
                                    <Sparkles className="w-5 h-5 text-white absolute -z-10" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Origin AI</h3>
                                    <p className="text-indigo-200 text-xs flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        Online
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => setIsOpen(false)}
                                className="text-indigo-200 hover:text-white hover:bg-white/10 rounded-full w-8 h-8"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Chat Area (Mock) */}
                        <div className="h-64 sm:h-80 p-4 overflow-y-auto bg-slate-50 dark:bg-[#030712]/50 flex flex-col justify-end">
                            <div className="flex gap-3 mb-4 max-w-[85%]">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0 flex items-center justify-center p-1 overflow-hidden">
                                     <img src="/Dipraj-ChatBot.png" alt="Bot" className="w-full h-full object-contain" />
                                </div>
                                <div className="bg-white dark:bg-[#0f1423] p-3 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 dark:border-white/5">
                                    <p className="text-sm text-slate-700 dark:text-slate-300">
                                        Hi! I'm Origin AI. What can I help you learn today? 🚀
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 max-w-[85%]">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex-shrink-0 flex items-center justify-center p-1 overflow-hidden">
                                    <img src="/Dipraj-ChatBot.png" alt="Bot" className="w-full h-full object-contain" />
                                </div>
                                <div className="bg-indigo-50 border border-indigo-100 dark:bg-indigo-500/10 dark:border-indigo-500/20 p-3 rounded-2xl rounded-tl-sm shadow-sm">
                                    <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                                        Coming soon...
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Input Area */}
                        <div className="p-3 bg-white dark:bg-[#060D1A] border-t border-slate-200 dark:border-white/10">
                            <form onSubmit={handleSubmit} className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Type your message..." 
                                    className="flex-1 bg-slate-100 dark:bg-white/5 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
                                    disabled
                                />
                                <Button 
                                    type="submit" 
                                    size="icon" 
                                    className="rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 w-9 h-9"
                                    disabled
                                >
                                    <Send className="w-4 h-4 ml-0.5" />
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(!isOpen)}
                className="relative z-50 transition-all outline-none"
            >
                {isOpen ? (
                    <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shadow-lg shadow-black/20 text-white">
                        <X className="w-7 h-7" />
                    </div>
                ) : (
                    <div className="relative group">
                        {/* Subtle glow on hover */}
                        <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 blur-2xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-500"></div>
                        
                        <img 
                            src="/Dipraj-ChatBot.png" 
                            alt="Chat" 
                            className="w-24 h-24 sm:w-28 sm:h-28 object-contain relative z-10 drop-shadow-2xl transition-all duration-300 group-hover:brightness-110"
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                            }}
                        />
                        
                        {/* Active Notification Dot - slightly offset to fit the character shape */}
                        <div className="absolute top-4 right-4 w-4 h-4 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900 shadow-md z-20"></div>
                    </div>
                )}
            </motion.button>
        </div>
    );
}
