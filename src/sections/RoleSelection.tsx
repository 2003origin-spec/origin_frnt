'use client';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpen, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

interface RoleSelectionProps {
    onSelectRole: (role: 'student' | 'teacher') => void;
    onBack: () => void;
}

export default function RoleSelection({ onSelectRole, onBack }: RoleSelectionProps) {
    const [hoveredRole, setHoveredRole] = useState<'student' | 'teacher' | null>(null);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#060D1A] text-white">
            {/* Background Decoration */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40 mix-blend-screen"
                style={{
                    backgroundImage: `radial-gradient(circle at 80% 30%, rgba(29, 78, 216, 0.4) 0%, transparent 40%),
                                     radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.2) 0%, transparent 40%)`
                }}>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay"></div>
            </div>

            <div className="w-full max-w-4xl relative z-10">
                {/* Back Button */}
                <button
                    onClick={onBack}
                    className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#3CACA3] dark:hover:text-[#3CACA3] transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to home</span>
                </button>

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                        How will you use ORIGIN?
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400">
                        Select your role to get a personalized experience
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Student Card */}
                    <div
                        className={`group relative p-8 rounded-3xl border transition-all duration-500 cursor-pointer overflow-hidden ${hoveredRole === 'student'
                            ? 'bg-slate-900/80 border-teal-500/50 shadow-[0_0_30px_rgba(20,184,166,0.3)] scale-[1.02]'
                            : 'bg-slate-900/40 backdrop-blur-md border-white/10 hover:border-white/20 hover:bg-slate-900/60 shadow-xl'
                            }`}
                        onMouseEnter={() => setHoveredRole('student')}
                        onMouseLeave={() => setHoveredRole(null)}
                        onClick={() => onSelectRole('student')}
                    >
                        <div className={`absolute top-6 right-6 transition-opacity duration-300 ${hoveredRole === 'student' ? 'opacity-100' : 'opacity-0'
                            }`}>
                            <CheckCircle2 className="w-6 h-6 text-[#3CACA3]" />
                        </div>

                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${hoveredRole === 'student' ? 'bg-teal-50 dark:bg-teal-900/30 text-[#3CACA3] dark:text-teal-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}>
                            <GraduationCap className="w-8 h-8" />
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Student</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                            I want to prepare for JEE exams, take AI-powered tests, and track my progress.
                        </p>

                        <ul className="space-y-3 mb-8">
                            {[
                                'Personalized Study Plan',
                                'AI-Driven Mock Tests',
                                'Concept Mastery Tracking',
                                '24/7 Doubt Solving'
                            ].map((feature, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <div className={`w-1.5 h-1.5 rounded-full ${hoveredRole === 'student' ? 'bg-[#3CACA3]' : 'bg-slate-300 dark:bg-slate-700'
                                        }`} />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            className={`w-full py-6 text-base font-semibold transition-all duration-300 ${hoveredRole === 'student'
                                ? 'bg-gradient-to-r from-[#3CACA3] to-[#2A8F87] text-white shadow-lg'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            Continue as Student
                        </Button>
                    </div>

                    {/* Teacher Card */}
                    <div
                        className={`group relative p-8 rounded-3xl border transition-all duration-500 cursor-pointer overflow-hidden ${hoveredRole === 'teacher'
                            ? 'bg-slate-900/80 border-blue-500/50 shadow-[0_0_30px_rgba(59,130,246,0.3)] scale-[1.02]'
                            : 'bg-slate-900/40 backdrop-blur-md border-white/10 hover:border-white/20 hover:bg-slate-900/60 shadow-xl'
                            }`}
                        onMouseEnter={() => setHoveredRole('teacher')}
                        onMouseLeave={() => setHoveredRole(null)}
                        onClick={() => onSelectRole('teacher')}
                    >
                        <div className={`absolute top-6 right-6 transition-opacity duration-300 ${hoveredRole === 'teacher' ? 'opacity-100' : 'opacity-0'
                            }`}>
                            <CheckCircle2 className="w-6 h-6 text-[#1E3A5F] dark:text-blue-400" />
                        </div>

                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${hoveredRole === 'teacher' ? 'bg-blue-50 dark:bg-blue-900/30 text-[#1E3A5F] dark:text-blue-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}>
                            <BookOpen className="w-8 h-8" />
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Teacher / Institution</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                            I want to create tests, manage students, and analyze class performance.
                        </p>

                        <ul className="space-y-3 mb-8">
                            {[
                                'Create Custom Tests',
                                'Monitor Student Progress',
                                'Detailed Class Analytics',
                                'Assignment Management'
                            ].map((feature, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
                                    <div className={`w-1.5 h-1.5 rounded-full ${hoveredRole === 'teacher' ? 'bg-[#1E3A5F] dark:bg-blue-500' : 'bg-slate-300 dark:bg-slate-700'
                                        }`} />
                                    {feature}
                                </li>
                            ))}
                        </ul>

                        <Button
                            className={`w-full py-6 text-base font-semibold transition-all duration-300 ${hoveredRole === 'teacher'
                                ? 'bg-gradient-to-r from-[#1E3A5F] to-[#152C4A] text-white shadow-lg'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            Continue as Teacher
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
