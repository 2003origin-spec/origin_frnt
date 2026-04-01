'use client';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ArrowLeft, Play, Clock, Loader2, CheckCircle2,
    XCircle, RotateCcw, Trophy, X, HelpCircle
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import type { PracticeQuestion, User } from '@/types';
import { toast } from 'sonner';

interface OGCodeWorkspaceProps {
    questionId: string | number;
    onBack: () => void;
    onRefreshUser?: () => void;
    setTimeMode?: (mode: 'webpage' | 'practice' | 'pomodoro', subject?: string) => void;
    user: User;
}

interface SubmitResult {
    isCorrect: boolean;
    already_solved?: boolean;
    correctOption?: number;
    correctOptions?: number[];
    correctPairs?: number[][];
    correctAnswerText?: string;
    explanation?: string;
    resultScore?: number;
    maxPoints?: number;
    pointsAwarded?: number;
    basePoints?: number;
    timeSpentSeconds?: number;
    targetTimeSeconds?: number;
    speedMultiplier?: number;
    speedBand?: 'blazing' | 'fast' | 'steady' | 'deliberate' | 'slow';
}

type SubmitPayload = {
    timeSpent: number;
    selectedOption?: number | null;
    selectedOptions?: number[];
    matrixPairs?: number[][];
    answerText?: string;
};

type PracticeQuestionApi = PracticeQuestion & {
    question_type?: PracticeQuestion['questionType'];
    matrix_data?: PracticeQuestion['matrixData'] | string;
};

type SubmitResultApi = SubmitResult & {
    correct_pairs?: number[][];
};

const DIFFICULTY_CONFIG = {
    easy: { label: 'Easy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    hard: { label: 'Hard', color: 'text-rose-400', bg: 'bg-rose-500/10' },
    insane: { label: 'Insane', color: 'text-purple-400', bg: 'bg-purple-500/10' },
};

const SPEED_BAND_LABELS = {
    blazing: 'Blazing',
    fast: 'Fast',
    steady: 'Steady',
    deliberate: 'Deliberate',
    slow: 'Slow',
} as const;

export default function OGCodeWorkspace({ questionId, onBack, onRefreshUser, setTimeMode, user }: OGCodeWorkspaceProps) {
    const [question, setQuestion] = useState<PracticeQuestion | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);

    // Answer states
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
    const [matrixPairs, setMatrixPairs] = useState<number[][]>([]);
    const [showHint, setShowHint] = useState(false);
    const [answerInput, setAnswerInput] = useState('');

    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasFetched = useRef(false);

    // 1. SAFE TAGS: Prevents the ".map is not a function" crash
    const safeTags = useMemo(() => {
        if (!question?.tags) return [];
        if (Array.isArray(question.tags)) return question.tags;
        if (typeof question.tags === 'string') return question.tags.split(',').filter(Boolean);
        return [];
    }, [question?.tags]);

    // 2. FETCH: Prevents infinite API loop
    const fetchQuestion = useCallback(async () => {
        if (hasFetched.current) return;
        setIsLoading(true);
        try {
            const data = await apiCall(`/assessments/practice/${questionId}/`);
            setQuestion(data);
            hasFetched.current = true;
        } catch (err) { 
            console.error("Fetch error:", err);
            toast.error('Failed to load question details.'); 
            onBack();
        }
        finally { setIsLoading(false); }
    }, [questionId, onBack]);

    useEffect(() => {
        fetchQuestion();
    }, [fetchQuestion]);

    useEffect(() => {
        if (isLoading || result) return;

        timerRef.current = setInterval(() => {
            setElapsed(e => e + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isLoading, !!result]);

    // 3. SUBMIT: Updated to show result immediately below
    const doSubmit = useCallback(async () => {
        if (!question || result || isSubmitting) return;

        const payload: SubmitPayload = { timeSpent: elapsed };
        const qType = question.questionType ?? 'mcq';

        if (qType === 'mcq') payload.selectedOption = selectedOption;
        else if (qType === 'msq') payload.selectedOptions = selectedOptions;
        else if (qType === 'matrix_match') payload.matrixPairs = matrixPairs;
        else payload.answerText = answerInput;

        setIsSubmitting(true);
        try {
            const res = await apiCall(`/assessments/practice/${question.id}/submit/`, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (timerRef.current) clearInterval(timerRef.current);
            setResult(res); // This triggers the result UI
            toast.success(res.isCorrect ? "Brilliant! Correct Answer" : "Not quite right. Try again?");
            
            // Refresh user data if solved
            if (res.isCorrect && !res.already_solved) {
                onRefreshUser?.();
            }
        } catch {
            toast.error('Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    }, [question, result, isSubmitting, elapsed, selectedOption, selectedOptions, matrixPairs, answerInput]);

    const handleTryAgain = () => {
        setResult(null);
        setShowHint(false);
        // Resume timer
        timerRef.current = setInterval(() => {
            setElapsed(e => e + 1);
        }, 1000);
    };

    useEffect(() => {
        if (question?.subject && setTimeMode) {
            setTimeMode('practice', question.subject);
            return () => setTimeMode('webpage');
        }
    }, [question?.subject, setTimeMode]);

    if (isLoading) return (
        <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
    );
    if (!question) return null;

    // 1. SAFE NORMALIZATION: Handle both camelCase and snake_case from backend
    const apiQuestion = question as PracticeQuestionApi;
    const rawType = apiQuestion.question_type || apiQuestion.questionType;
    const qType: string = rawType?.toLowerCase() || 'mcq';
    
    // Safely get matrix data, handling both naming conventions and possible stringified JSON
    const mDataRaw = apiQuestion.matrixData || apiQuestion.matrix_data;
    let mData: PracticeQuestion['matrixData'] | null = null;
    if (mDataRaw) {
        try {
            mData = typeof mDataRaw === 'string' ? JSON.parse(mDataRaw) as PracticeQuestion['matrixData'] : mDataRaw;
        } catch (e) {
            console.error('Failed to parse matrix data:', e);
        }
    }
    
    const colA = mData?.column_a || [];
    const colB = mData?.column_b || [];
    
    // Normalize difficulty
    const diffKey = (question.difficulty || 'medium').toLowerCase();
    const diff = DIFFICULTY_CONFIG[diffKey as keyof typeof DIFFICULTY_CONFIG] || DIFFICULTY_CONFIG.medium;

    return (
        <div className="min-h-screen bg-[#0d1117] text-slate-100 flex flex-col font-sans">
            {/* Header */}
            <div className="h-12 border-b border-white/[0.07] flex items-center justify-between px-4 bg-[#0d1117]">
                <button onClick={onBack} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 font-mono">
                        <Trophy className="w-3.5 h-3.5" />
                        {user?.points || 0} PTS
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400 font-mono">
                        <Clock className="w-3.5 h-3.5" /> {Math.floor(elapsed / 60)}m {elapsed % 60}s
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left: Question Content */}
                <div className="lg:w-1/2 p-6 overflow-y-auto border-r border-white/5">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-400 px-2 py-1 bg-blue-500/10 rounded uppercase tracking-wider">
                                {question.subject}
                            </span>
                            <span className={`text-[10px] font-bold ${diff.color} px-2 py-1 ${diff.bg} rounded uppercase tracking-wider`}>
                                {diff.label}
                            </span>
                        </div>
                        <p className="text-lg leading-relaxed font-serif">{question.text}</p>
                        <div className="flex flex-wrap gap-2 pt-4">
                            {safeTags.map((tag, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 rounded text-slate-500">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Interaction and Results */}
                <div className="lg:w-1/2 p-6 bg-slate-50 dark:bg-black border-l border-slate-200 dark:border-white/5 overflow-y-auto">
                    <div className="max-w-xl mx-auto space-y-6">

                        {/* 1. INPUT SECTION */}
                        <div className="space-y-4">
                            {qType === 'mcq' && (question.options || []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    disabled={!!result || isSubmitting}
                                    onClick={() => setSelectedOption(idx)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all font-serif
                                        ${selectedOption === idx ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/5' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02]'}
                                        ${result?.isCorrect && result?.correctOption === idx ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOption === idx ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    <span className="font-mono text-xs mr-3 opacity-50">({String.fromCharCode(65 + idx)})</span>
                                    {opt}
                                </button>
                            ))}

                            {qType === 'msq' && (question.options || []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    disabled={!!result || isSubmitting}
                                    onClick={() => {
                                        setSelectedOptions(prev =>
                                            prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                        );
                                    }}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all font-serif
                                        ${selectedOptions.includes(idx) ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/5' : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02]'}
                                        ${result?.isCorrect && result?.correctOptions?.includes(idx) ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOptions.includes(idx) ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedOptions.includes(idx) ? 'bg-blue-500 border-blue-500' : 'border-white/20'}`}>
                                            {selectedOptions.includes(idx) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className="font-mono text-xs opacity-50">({String.fromCharCode(65 + idx)})</span>
                                        {opt}
                                    </div>
                                </button>
                            ))}

                            {qType === 'matrix_match' && mData && (
                                <div className="space-y-6">
                                    {/* Column B Reference (New) */}
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Column B Reference</h4>
                                            <button 
                                                onClick={() => setMatrixPairs([])}
                                                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 px-2 py-1 bg-blue-500/5 hover:bg-blue-500/10 rounded-md border border-blue-500/20"
                                            >
                                                <X className="w-3 h-3" /> Clear Selections
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(colB).map((term: string, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2.5">
                                                    <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-xs text-slate-300 truncate">{term}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {(colA).map((itemA: string, idxA: number) => (
                                            <div key={idxA} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4 hover:border-white/10 transition-colors shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-7 h-7 rounded-lg bg-white/10 text-slate-400 flex items-center justify-center text-[12px] font-black shrink-0 border border-white/5 shadow-inner">
                                                            {String.fromCharCode(65 + idxA)}
                                                        </span>
                                                        <span className="text-[15px] font-bold text-slate-200 tracking-tight leading-relaxed">{itemA}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-3 pt-2">
                                                    {(colB).map((_itemB: string, idxB: number) => {
                                                        const isSelected = matrixPairs.some(p => p[0] === idxA && p[1] === idxB);
                                                        const resultWithSnakeCase = result as SubmitResultApi | null;
                                                        const resPairs = result?.correctPairs || resultWithSnakeCase?.correct_pairs;
                                                        const isCorrect = result?.isCorrect && resPairs?.some(p => p[0] === idxA && p[1] === idxB);

                                                        return (
                                                            <button
                                                                key={idxB}
                                                                disabled={!!result || isSubmitting}
                                                                onClick={() => {
                                                                    setMatrixPairs(prev => {
                                                                        const exists = prev.some(p => p[0] === idxA && p[1] === idxB);
                                                                        if (exists) return prev.filter(p => !(p[0] === idxA && p[1] === idxB));
                                                                        return [...prev, [idxA, idxB]];
                                                                    });
                                                                }}
                                                                className={`w-12 h-12 rounded-xl border text-[13px] font-black transition-all flex items-center justify-center shadow-sm
                                                                    ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'}
                                                                    ${result?.isCorrect && isCorrect ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                                                                    ${result && !result.isCorrect && isSelected ? 'bg-rose-500 border-rose-500 text-white animate-pulse' : ''}
                                                                    hover:scale-105 active:scale-95 group/btn
                                                                `}
                                                            >
                                                                <span className="group-hover/btn:scale-110 transition-transform">{idxB + 1}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(qType === 'numerical' || qType === 'subjective') && (
                                <div className="space-y-3">
                                    <input
                                        type={qType === 'numerical' ? "number" : "text"}
                                        disabled={!!result || isSubmitting}
                                        value={answerInput}
                                        onChange={(e) => setAnswerInput(e.target.value)}
                                        className="w-full bg-white/5 border-2 border-white/10 p-5 rounded-2xl text-2xl text-center font-mono focus:border-blue-500 outline-none transition-all"
                                        placeholder={qType === 'numerical' ? "Enter value..." : "Type answer..."}
                                    />
                                    {result && !result.isCorrect && result.correctAnswerText && (
                                        <p className="text-xs text-rose-400 text-center">Incorrect. The value you entered doesn&apos;t match the expected answer.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2. SUBMIT BUTTON (Hidden after result) */}
                        {!result && (
                            <button
                                onClick={doSubmit}
                                disabled={isSubmitting || (
                                    qType === 'mcq' ? selectedOption === null :
                                        qType === 'msq' ? selectedOptions.length === 0 :
                                            qType === 'matrix_match' ? matrixPairs.length === 0 :
                                                !answerInput
                                )}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                Submit Answer
                            </button>
                        )}

                        {/* 3. RESULT SECTION (Appears immediately below after submit) */}
                        {result && (
                            <div className={`p-5 rounded-2xl border-2 animate-in fade-in slide-in-from-top-4 duration-300
                                ${result.isCorrect ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}
                            `}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2 rounded-full ${result.isCorrect ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                        {result.isCorrect ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <XCircle className="w-6 h-6 text-rose-500" />}
                                    </div>
                                    <div>
                                        <h3 className={`font-bold ${result.isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {result.isCorrect ? 'Correct Answer' : 'Incorrect Answer'}
                                        </h3>
                                        <p className="text-xs text-slate-500">Time spent: {Math.floor(elapsed / 60)}m {elapsed % 60}s</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Result Score</p>
                                        <p className="text-lg font-black text-slate-100">
                                            {result.resultScore ?? 0}
                                            <span className="ml-1 text-xs font-medium text-slate-500">/ {result.maxPoints ?? result.basePoints ?? 0}</span>
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Points Earned</p>
                                        <p className={`text-lg font-black ${result.pointsAwarded ? 'text-amber-400' : 'text-slate-400'}`}>
                                            +{result.pointsAwarded ?? 0}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-widest text-slate-500">Speed Rating</p>
                                        <p className="text-lg font-black text-slate-100">
                                            {result.speedBand ? SPEED_BAND_LABELS[result.speedBand] : 'Recorded'}
                                        </p>
                                        {typeof result.targetTimeSeconds === 'number' && (
                                            <p className="text-[11px] text-slate-500">
                                                Target {Math.floor(result.targetTimeSeconds / 60)}m {result.targetTimeSeconds % 60}s
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {result.isCorrect ? (
                                    result.explanation && (
                                        <div className="pt-4 border-t border-white/5">
                                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Trophy className="w-4 h-4" /> Solution
                                            </p>
                                            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                                                {result.explanation}
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    question.hint && (
                                        !showHint ? (
                                            <button 
                                                onClick={() => setShowHint(true)}
                                                className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-2 group"
                                            >
                                                <HelpCircle className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> Need a Hint?
                                            </button>
                                        ) : (
                                            <div className="pt-4 border-t border-white/5 animate-in fade-in zoom-in-95 duration-300">
                                                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <HelpCircle className="w-3.5 h-3.5" /> Hint
                                                </p>
                                                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-serif italic">
                                                    {question.hint}
                                                </p>
                                            </div>
                                        )
                                    )
                                )}

                                <div className="flex gap-3 mt-6">
                                    {!result.isCorrect && (
                                        <button
                                            onClick={handleTryAgain}
                                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 border border-blue-400/20"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Try Again
                                        </button>
                                    )}
                                    <button
                                        onClick={onBack}
                                        className={`py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-colors ${result.isCorrect ? 'w-full' : 'flex-1'}`}
                                    >
                                        Return to Dashboard
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
