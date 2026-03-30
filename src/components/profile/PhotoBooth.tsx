'use client';
import { useState, useRef } from 'react';
import {
    Camera,
    Image as ImageIcon,
    Sparkles,
    Share2,
    Check,
    Instagram,
    Twitter,
    Wand2,
    ArrowRight,
    RefreshCw,
    UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PhotoBooth() {
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedAvatar, setGeneratedAvatar] = useState<string | null>(null);
    const [nickname, setNickname] = useState('O3.User');
    const [step, setStep] = useState<'hero' | 'preview' | 'result'>('hero');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
                setStep('preview');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = () => {
        setIsGenerating(true);
        // Mocking AI generation delay
        setTimeout(() => {
            // Using the existing avatar artifact as the "generated" result
            setGeneratedAvatar('/Users/snaveen/.gemini/antigravity/brain/58b230f3-3d46-475f-991a-cb8328de5a60/ai_bot_avatar_1771770992047.png');
            setIsGenerating(false);
            setStep('result');
        }, 3000);
    };

    const reset = () => {
        setCapturedImage(null);
        setGeneratedAvatar(null);
        setStep('hero');
    };

    return (
        <div className="w-full relative overflow-hidden rounded-[2.5rem] bg-[#030014] border border-white/5 shadow-2xl min-h-[700px] flex flex-col p-8 sm:p-12 group/booth">
            {/* Deep Gradient Background & Grid */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay z-0 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 pointer-events-none"></div>

            {/* Soft Radial Lighting Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/20 rounded-full blur-[120px] z-0 pointer-events-none mix-blend-screen transition-all duration-1000 group-hover/booth:bg-indigo-500/20"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-violet-600/20 rounded-full blur-[100px] z-0 pointer-events-none mix-blend-screen transition-all duration-1000 group-hover/booth:bg-violet-500/20"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[80px] z-0 pointer-events-none"></div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
            />
            <input
                type="file"
                ref={cameraInputRef}
                className="hidden"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
            />

            <div className="relative z-10 flex-1 flex flex-col w-full h-full">
                <AnimatePresence mode="wait">
                    {step === 'hero' && (
                        <motion.div
                            key="hero"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
                            transition={{ duration: 0.5 }}
                            className="flex-1 flex flex-col lg:flex-row items-center justify-between gap-12 w-full h-full"
                        >
                            {/* Left Side: Copy & CTAs */}
                            <div className="flex-1 space-y-8 z-10 mt-8 lg:mt-0 text-center lg:text-left flex flex-col items-center lg:items-start">
                                {/* Glowing Badge */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                    <span className="text-[10px] sm:text-xs font-bold text-indigo-200 uppercase tracking-[0.3em]">AI Powered</span>
                                </motion.div>

                                {/* Heading */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="space-y-4"
                                >
                                    <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/40 leading-[1.1]">
                                        AI Photo <br className="hidden lg:block" />
                                        <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Booth</span>
                                    </h1>
                                    <p className="text-lg text-slate-400 font-medium max-w-md leading-relaxed mx-auto lg:mx-0">
                                        Transform your selfies into stunning, studio-quality avatars using our next-generation AI engine.
                                    </p>
                                </motion.div>

                                {/* CTAs */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.4 }}
                                    className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
                                >
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full sm:w-auto relative group px-8 py-4 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 font-bold text-white shadow-[0_0_40px_rgba(79,70,229,0.3)] hover:shadow-[0_0_60px_rgba(79,70,229,0.5)] transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                                        <span className="relative z-10 flex items-center justify-center gap-2">
                                            Create Your Avatar <Wand2 className="w-4 h-4" />
                                        </span>
                                    </button>
                                    <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-1">
                                        Explore Styles
                                    </button>
                                </motion.div>

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.6 }}
                                    className="flex items-center gap-4 text-slate-500 text-sm font-medium mt-4 lg:mt-0"
                                >
                                    <div className="flex -space-x-3">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-8 h-8 rounded-full border-2 border-[#030014] bg-indigo-900/50 flex items-center justify-center overflow-hidden">
                                                <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="user" className="w-full h-full object-cover opacity-80" />
                                            </div>
                                        ))}
                                    </div>
                                    <span>Join 10,000+ students</span>
                                </motion.div>
                            </div>

                            {/* Right Side: Floating Elements */}
                            <div className="flex-1 relative w-full aspect-square lg:aspect-auto lg:h-[500px] flex items-center justify-center mt-12 lg:mt-0" style={{ perspective: '1000px' }}>
                                {/* Floating Styles Cards (Hidden on small screens) */}
                                <motion.div
                                    animate={{ y: [-10, 10, -10], rotate: [12, 10, 12] }}
                                    transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                                    className="hidden sm:flex absolute top-[10%] right-[10%] w-32 h-44 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-2 shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:scale-110 hover:z-30 hover:rotate-0 transition-all duration-500 z-10 flex-col items-center justify-center overflow-hidden group cursor-pointer"
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/30 to-blue-500/30 opacity-50 z-0"></div>
                                    <img src="https://images.unsplash.com/photo-1535295972055-1c762f4483e5?w=200&h=300&fit=crop" alt="Cyberpunk" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay group-hover:opacity-100 transition-opacity z-0" />
                                    <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em] text-white mt-auto bg-black/60 px-2 py-1.5 rounded w-full text-center backdrop-blur-md border border-white/5 shadow-lg group-hover:-translate-y-1 transition-transform">Cyberpunk</span>
                                </motion.div>

                                <motion.div
                                    animate={{ y: [15, -5, 15], rotate: [-8, -6, -8] }}
                                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                                    className="hidden sm:flex absolute bottom-[10%] left-[10%] w-36 h-48 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-2 shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:scale-110 hover:z-30 hover:rotate-0 transition-all duration-500 z-10 flex-col items-center justify-center overflow-hidden group cursor-pointer"
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-pink-500/30 to-purple-500/30 opacity-50 z-0"></div>
                                    <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=300&fit=crop" alt="Professional" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay group-hover:opacity-100 transition-opacity z-0" />
                                    <span className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em] text-white mt-auto bg-black/60 px-2 py-1.5 rounded w-full text-center backdrop-blur-md border border-white/5 shadow-lg group-hover:-translate-y-1 transition-transform">Pro</span>
                                </motion.div>

                                <motion.div
                                    animate={{ y: [5, -10, 5], rotate: [5, 8, 5] }}
                                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                                    className="hidden md:flex absolute bottom-[20%] right-[0%] w-28 h-36 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-2 shadow-[0_20px_40px_rgba(0,0,0,0.5)] hover:scale-110 hover:z-30 hover:rotate-0 transition-all duration-500 z-0 flex-col items-center justify-center overflow-hidden group cursor-pointer"
                                    style={{ transformStyle: 'preserve-3d' }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-orange-500/30 opacity-50 z-0"></div>
                                    <img src="https://images.unsplash.com/photo-1578632767115-351597cf2477?w=200&h=300&fit=crop" alt="Anime" className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay group-hover:opacity-100 transition-opacity z-0" />
                                    <span className="relative z-10 text-[9px] font-black uppercase tracking-[0.2em] text-white mt-auto bg-black/60 px-2 py-1 rounded w-full text-center backdrop-blur-md border border-white/5 shadow-lg group-hover:-translate-y-1 transition-transform">Anime</span>
                                </motion.div>

                                {/* Capture Options */}
                                <div
                                    className="absolute top-1/2 left-1/2 flex flex-col items-center z-50"
                                    style={{ transform: 'translate(-50%, -50%) translateZ(100px)' }}
                                >
                                    <motion.div
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                                        className="relative z-50 cursor-pointer group mb-8"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {/* Animated Rings */}
                                        <div className="absolute inset-0 rounded-full border border-indigo-500/40 scale-[1.2] group-hover:scale-[1.6] group-hover:opacity-0 transition-all duration-1000 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
                                        <div className="absolute inset-0 rounded-full border border-violet-500/30 scale-[1.4] transition-all duration-700"></div>
                                        <div className="absolute inset-0 rounded-full bg-indigo-500/10 blur-xl group-hover:blur-3xl transition-all duration-500"></div>

                                        <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(99,102,241,0.2)] hover:shadow-[0_0_80px_rgba(99,102,241,0.4)] flex flex-col items-center justify-center relative overflow-hidden transition-all duration-500 hover:border-indigo-400/50">
                                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-50 pointer-events-none"></div>
                                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

                                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-500 border border-white/5 shadow-inner">
                                                <ImageIcon className="w-8 h-8 sm:w-10 sm:h-10 text-white group-hover:text-indigo-300 transition-colors duration-300" />
                                            </div>

                                            <span className="text-white font-black text-xs sm:text-sm tracking-[0.2em] uppercase relative z-10">Upload</span>
                                            <span className="text-slate-400 text-[9px] sm:text-[10px] font-bold tracking-widest uppercase mt-1 relative z-10 group-hover:text-indigo-200 transition-colors">from Gallery</span>
                                        </div>
                                    </motion.div>

                                    {/* Camera Button */}
                                    <motion.button
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.8 }}
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="relative z-50 group flex items-center gap-5 pl-4 pr-8 py-3 rounded-[1.25rem] bg-gradient-to-r from-[#3e2b45] to-[#341d2c] shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/5 transition-all duration-300 hover:scale-105 hover:bg-gradient-to-r hover:from-[#4a3452] hover:to-[#3e2234]"
                                    >
                                        <div className="w-[48px] h-[48px] rounded-full flex items-center justify-center border-2 border-[#6f619e] group-hover:bg-[#6f619e]/20 transition-colors shrink-0">
                                            <Camera className="w-5 h-5 text-[#8f83cc]" strokeWidth={2.5} />
                                        </div>
                                        <span className="text-[14px] font-black text-white uppercase tracking-[0.2em]">Take a Photo</span>
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 'preview' && capturedImage && (
                        <motion.div
                            key="preview"
                            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            className="w-full h-full flex flex-col items-center justify-center p-4 lg:p-12 z-10"
                        >
                            <div className="relative aspect-square w-full max-w-lg rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)]">
                                <img src={capturedImage} alt="Capture" className="w-full h-full object-cover" />

                                {isGenerating && (
                                    <div className="absolute inset-0 bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center text-center p-8 z-20">
                                        <div className="relative mb-8">
                                            <div className="w-24 h-24 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-[spin_1.5s_linear_infinite]" />
                                            <div className="absolute inset-0 m-auto w-16 h-16 bg-indigo-500/20 rounded-full blur-xl animate-pulse"></div>
                                            <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-indigo-400 animate-pulse" />
                                        </div>
                                        <h3 className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-black text-2xl uppercase tracking-[0.2em]">Processing</h3>
                                        <p className="text-slate-400 text-xs mt-3 uppercase font-bold tracking-widest">Training Neural Network...</p>
                                    </div>
                                )}

                                {/* Overlay gradient for premium feel */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none"></div>
                            </div>

                            {!isGenerating && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="flex gap-4 w-full max-w-lg mt-8"
                                >
                                    <button
                                        className="flex-1 h-14 rounded-full border border-white/10 hover:bg-white/5 text-slate-300 font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors backdrop-blur-md"
                                        onClick={reset}
                                    >
                                        <RefreshCw className="w-4 h-4" /> Retake
                                    </button>
                                    <button
                                        className="flex-[2] h-14 px-8 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-black uppercase tracking-widest shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_50px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2 transition-all group"
                                        onClick={handleGenerate}
                                    >
                                        Generate <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    </button>
                                </motion.div>
                            )}
                        </motion.div>
                    )}

                    {step === 'result' && generatedAvatar && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                            className="w-full h-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10 p-4 lg:p-8"
                        >
                            <div className="relative group perspective-1000 mx-auto w-full max-w-md">
                                <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] group-hover:bg-indigo-500/30 transition-all duration-700 pointer-events-none" />
                                <motion.div
                                    className="relative aspect-square rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(99,102,241,0.2)]"
                                    whileHover={{ rotateY: 5, rotateX: -5 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                    style={{ transformStyle: "preserve-3d" }}
                                >
                                    <img src={generatedAvatar} alt="AI Avatar" className="w-full h-full object-cover" />

                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

                                    <div className="absolute bottom-6 left-6 right-6 p-5 rounded-3xl bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-between" style={{ transform: "translateZ(20px)" }}>
                                        <div>
                                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Identity Verified</p>
                                            <p className="text-white font-black text-2xl tracking-tight">{nickname}</p>
                                        </div>
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shadow-inner">
                                            <Check className="w-6 h-6 text-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="space-y-10 max-w-md mx-auto lg:mx-0 w-full">
                                <div className="space-y-4 text-center lg:text-left">
                                    <div className="inline-flex items-center justify-center lg:justify-start gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-2">
                                        <Check className="w-3 h-3" /> Generation Complete
                                    </div>
                                    <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">Meet Your <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-pink-400">Digital Self</span></h3>

                                    <div className="space-y-3 pt-4 text-left">
                                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Set Nickname</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={nickname}
                                                onChange={(e) => setNickname(e.target.value)}
                                                className="w-full h-16 px-6 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-lg outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all placeholder:text-slate-600 shadow-inner"
                                                placeholder="Enter nickname..."
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <button className="w-full h-16 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 transition-all flex items-center justify-center gap-3 text-white font-black uppercase tracking-widest shadow-[0_0_30px_rgba(79,70,229,0.3)] hover:shadow-[0_0_50px_rgba(79,70,229,0.5)] group">
                                        <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" /> Share to Network
                                    </button>

                                    <div className="grid grid-cols-2 gap-4">
                                        <button className="h-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-slate-300 font-bold uppercase tracking-widest hover:text-pink-400">
                                            <Instagram className="w-5 h-5" /> Instagram
                                        </button>
                                        <button className="h-14 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-slate-300 font-bold uppercase tracking-widest hover:text-sky-400">
                                            <Twitter className="w-5 h-5" /> Twitter
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={reset}
                                    className="w-full text-center text-slate-500 hover:text-white font-bold uppercase tracking-widest text-sm transition-colors mt-4"
                                >
                                    Create Another Avatar
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer / Info */}
            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between z-10 gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-white font-bold text-sm tracking-tight">Invite your friends</p>
                        <p className="text-slate-500 text-xs font-medium">Unlock exclusive O3 styles</p>
                    </div>
                </div>
                <button className="group flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-all duration-300">
                    <span className="text-xs font-bold text-white uppercase tracking-widest">Invite Now</span>
                    <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform duration-300" />
                </button>
            </div>
        </div>
    );
}

