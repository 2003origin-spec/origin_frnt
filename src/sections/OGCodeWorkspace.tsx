'use client';
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import {
    ArrowLeft, Play, Clock, Loader2, CheckCircle2,
    XCircle, RotateCcw, Trophy, X, HelpCircle
} from 'lucide-react';
import { apiCall } from '@/lib/api';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
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
    explanation?: string;
    answerText?: string;
    attempted?: boolean;
    attemptCount?: number;
};

type SubmitResultApi = SubmitResult & {
    correct_pairs?: number[][];
};

const DIFFICULTY_CONFIG = {
    easy: { label: 'Easy', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    medium: { label: 'Medium', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    hard: { label: 'Hard', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
    insane: { label: 'Insane', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/10' },
};

const SPEED_BAND_LABELS = {
    blazing: 'Blazing',
    fast: 'Fast',
    steady: 'Steady',
    deliberate: 'Deliberate',
    slow: 'Slow',
} as const;

const LATEX_COMMAND_MAP: Record<string, string> = {
    alpha: 'α',
    beta: 'β',
    gamma: 'γ',
    delta: 'δ',
    epsilon: 'ε',
    theta: 'θ',
    lambda: 'λ',
    mu: 'μ',
    pi: 'π',
    rho: 'ρ',
    sigma: 'σ',
    phi: 'φ',
    omega: 'ω',
    times: '×',
    cdot: '·',
    circ: '°',
    pm: '±',
    mp: '∓',
    leq: '≤',
    geq: '≥',
    neq: '≠',
    infty: '∞',
    propto: '∝',
    to: '→',
    rightarrow: '→',
    leftarrow: '←',
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
    '+': '⁺',
    '-': '⁻',
    '=': '⁼',
    '(': '⁽',
    ')': '⁾',
    n: 'ⁿ',
    i: 'ⁱ',
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
    '0': '₀',
    '1': '₁',
    '2': '₂',
    '3': '₃',
    '4': '₄',
    '5': '₅',
    '6': '₆',
    '7': '₇',
    '8': '₈',
    '9': '₉',
    '+': '₊',
    '-': '₋',
    '=': '₌',
    '(': '₍',
    ')': '₎',
};

function mapDecoratedText(value: string, alphabet: Record<string, string>): string {
    return Array.from(value).map((char) => alphabet[char] ?? char).join('');
}

function extractBalancedSegment(value: string, startIndex: number, openChar: string, closeChar: string) {
    if (value[startIndex] !== openChar) {
        return null;
    }

    let depth = 0;
    let cursor = startIndex;
    for (; cursor < value.length; cursor += 1) {
        const current = value[cursor];
        if (current === openChar) {
            depth += 1;
        } else if (current === closeChar) {
            depth -= 1;
            if (depth === 0) {
                return {
                    content: value.slice(startIndex + 1, cursor),
                    endIndex: cursor,
                };
            }
        }
    }

    return null;
}

function replaceFractions(value: string): string {
    let output = '';
    let cursor = 0;

    while (cursor < value.length) {
        if (value.startsWith('\\frac', cursor)) {
            let nextCursor = cursor + 5;
            while (value[nextCursor] === ' ') {
                nextCursor += 1;
            }

            const numerator = extractBalancedSegment(value, nextCursor, '{', '}');
            if (!numerator) {
                output += value[cursor];
                cursor += 1;
                continue;
            }

            nextCursor = numerator.endIndex + 1;
            while (value[nextCursor] === ' ') {
                nextCursor += 1;
            }

            const denominator = extractBalancedSegment(value, nextCursor, '{', '}');
            if (!denominator) {
                output += value[cursor];
                cursor += 1;
                continue;
            }

            output += `(${formatMathExpression(numerator.content)})/(${formatMathExpression(denominator.content)})`;
            cursor = denominator.endIndex + 1;
            continue;
        }

        output += value[cursor];
        cursor += 1;
    }

    return output;
}

function replaceSquareRoots(value: string): string {
    let output = '';
    let cursor = 0;

    while (cursor < value.length) {
        if (value.startsWith('\\sqrt', cursor) || value[cursor] === '√') {
            cursor += value.startsWith('\\sqrt', cursor) ? 5 : 1;
            while (value[cursor] === ' ') {
                cursor += 1;
            }

            if (value[cursor] === '{' || value[cursor] === '(') {
                const openChar = value[cursor];
                const closeChar = openChar === '{' ? '}' : ')';
                const segment = extractBalancedSegment(value, cursor, openChar, closeChar);
                if (segment) {
                    output += `√(${formatMathExpression(segment.content)})`;
                    cursor = segment.endIndex + 1;
                    continue;
                }
            }

            const tokenMatch = value.slice(cursor).match(/^[a-zA-Z0-9.]+/);
            if (tokenMatch) {
                output += `√(${tokenMatch[0]})`;
                cursor += tokenMatch[0].length;
                continue;
            }

            output += '√';
            continue;
        }

        output += value[cursor];
        cursor += 1;
    }

    return output;
}

function formatMathExpression(input: string | null | undefined): string {
    let value = String(input ?? '').trim();
    if (!value) {
        return '';
    }

    value = value
        .replace(/\\left|\\right/g, '')
        .replace(/\\,/g, ' ')
        .replace(/\\\\/g, ' ')
        .replace(/\$\$/g, '')
        .replace(/\$/g, '')
        .replace(/[\u2212\u2013\u2014]/g, '-');

    value = replaceFractions(value);
    value = replaceSquareRoots(value);

    value = value.replace(/\\text\s*{([^{}]+)}/g, '$1');

    Object.entries(LATEX_COMMAND_MAP).forEach(([command, symbol]) => {
        value = value.replace(new RegExp(`\\\\${command}\\b`, 'g'), symbol);
    });

    value = value
        .replace(/\^\{([^{}]+)\}/g, (_match, exponent: string) => mapDecoratedText(exponent, SUPERSCRIPT_DIGITS))
        .replace(/_\{([^{}]+)\}/g, (_match, subscript: string) => mapDecoratedText(subscript, SUBSCRIPT_DIGITS))
        .replace(/\^([a-zA-Z0-9+\-()=]+)/g, (_match, exponent: string) => mapDecoratedText(exponent, SUPERSCRIPT_DIGITS))
        .replace(/_([a-zA-Z0-9+\-()=]+)/g, (_match, subscript: string) => mapDecoratedText(subscript, SUBSCRIPT_DIGITS))
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();

    return value;
}

function hasMathMarkup(value: string | null | undefined): boolean {
    const text = String(value ?? '');
    return /\\\(|\\\)|\\[a-zA-Z]+|√|[\^_$]/.test(text);
}

function isEquationHeavyLine(value: string): boolean {
    const text = value.replace(/\*\*/g, '').trim();
    if (!text) {
        return false;
    }

    const latexSignalCount = [
        /\\frac/g,
        /\\sqrt/g,
        /\\(?:tan|sin|cos|cot|sec|csc|log|ln)\b/g,
        /\\(?:alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|phi|omega)\b/g,
    ].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);

    const symbolSignalCount = [
        /=/g,
        /→/g,
        /∝/g,
        /√/g,
        /\//g,
    ].reduce((count, pattern) => count + (text.match(pattern)?.length ?? 0), 0);

    const startsLikeEquation = /^((\\)?(?:tan|sin|cos|cot|sec|csc|log|ln)\s*\(|[A-Za-zα-ωΑ-Ωβθλμπσφω][A-Za-z0-9_{}\\^()]*\s*=|[0-9(\\√])/i.test(text);
    const hasEquationCore = /=/.test(text) || /\\frac|\\sqrt|\\(?:tan|sin|cos|cot|sec|csc)\b/.test(text);

    return (hasEquationCore && (latexSignalCount + symbolSignalCount >= 2 || startsLikeEquation))
        || (startsLikeEquation && latexSignalCount >= 1);
}

function renderInlineSegments(value: string, keyPrefix: string): ReactNode[] {
    const content = value.replace(/\*\*/g, '').trim();
    if (!content) {
        return [];
    }

    const pattern = /\\\((.+?)\\\)|\$\$(.+?)\$\$|\$(.+?)\$/g;
    const nodes: ReactNode[] = [];
    let cursor = 0;
    let segmentIndex = 0;

    for (const match of content.matchAll(pattern)) {
        const matchIndex = match.index ?? 0;
        const textPart = content.slice(cursor, matchIndex);
        if (textPart) {
            nodes.push(
                <span key={`${keyPrefix}-text-${segmentIndex}`}>
                    {hasMathMarkup(textPart) ? formatMathExpression(textPart) : textPart}
                </span>,
            );
            segmentIndex += 1;
        }

        const mathContent = match[1] ?? match[2] ?? match[3] ?? '';
        nodes.push(
            <span
                key={`${keyPrefix}-math-${segmentIndex}`}
                className="inline-flex rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 font-mono text-[0.95em] text-blue-700 dark:text-blue-100"
            >
                {formatMathExpression(mathContent)}
            </span>,
        );
        segmentIndex += 1;
        cursor = matchIndex + match[0].length;
    }

    const trailingText = content.slice(cursor);
    if (trailingText) {
        nodes.push(
            <span key={`${keyPrefix}-tail-${segmentIndex}`}>
                {hasMathMarkup(trailingText) ? formatMathExpression(trailingText) : trailingText}
            </span>,
        );
    }

    return nodes;
}

function renderFormattedExplanation(content: string | null | undefined): ReactNode {
    const lines = String(content ?? '').split('\n');

    return (
        <div className="space-y-3">
            {lines.map((rawLine, index) => {
                const line = rawLine.trim();
                if (!line) {
                    return <div key={`space-${index}`} className="h-1" />;
                }

                const headingMatch = line.match(/^\*\*(.+)\*\*$/);
                if (headingMatch) {
                    return (
                        <div key={`heading-${index}`} className="pt-1">
                            <h4 className="text-sm font-black uppercase tracking-wide text-foreground">
                                {headingMatch[1]}
                            </h4>
                        </div>
                    );
                }

                const bulletMatch = line.match(/^- (.+)$/);
                if (bulletMatch) {
                    return (
                        <div key={`bullet-${index}`} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                            <span className="mt-[2px] text-muted-foreground/60">•</span>
                            <div className="flex-1">{renderInlineSegments(bulletMatch[1], `bullet-${index}`)}</div>
                        </div>
                    );
                }

                const blockMathMatch = line.match(/^\\\((.+)\\\)$/);
                if (blockMathMatch) {
                    return (
                        <div
                            key={`math-${index}`}
                            className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 font-mono text-sm text-blue-700 dark:text-blue-100"
                        >
                            {formatMathExpression(blockMathMatch[1])}
                        </div>
                    );
                }

                if (isEquationHeavyLine(line)) {
                    return (
                        <div
                            key={`equation-${index}`}
                            className="rounded-xl border border-blue-400/20 bg-gradient-to-r from-blue-500/12 via-blue-500/8 to-cyan-500/10 px-4 py-3 shadow-[0_0_0_1px_rgba(59,130,246,0.05)]"
                        >
                            <div className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-300/80 mb-2">
                                Key Equation
                            </div>
                            <div className="font-mono text-sm leading-relaxed text-blue-100">
                                {renderInlineSegments(line, `equation-${index}`)}
                            </div>
                        </div>
                    );
                }

                return (
                    <p key={`line-${index}`} className="text-sm leading-relaxed text-muted-foreground">
                        {renderInlineSegments(line, `line-${index}`)}
                    </p>
                );
            })}
        </div>
    );
}

function renderQuestionText(content: string | null | undefined, keyPrefix: string): ReactNode {
    const lines = String(content ?? '').split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) {
        return null;
    }

    return (
        <div className="space-y-2">
            {lines.map((line, index) => (
                <p key={`${keyPrefix}-${index}`} className="leading-relaxed">
                    {renderInlineSegments(line, `${keyPrefix}-${index}`)}
                </p>
            ))}
        </div>
    );
}

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
    const [showSolution, setShowSolution] = useState(false);
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

    const originAiPageContext = useMemo(() => {
        const attempted = Boolean(
            result ||
            question?.attempted ||
            question?.attemptCount ||
            question?.status === 'attempted' ||
            question?.status === 'solved' ||
            question?.isSolved,
        );
        const solved = Boolean(result?.isCorrect || question?.isSolved || question?.status === 'solved');

        return {
            pathname: typeof questionId === 'string' ? `/ogcode/${questionId}` : '/ogcode',
            pageKind: 'ogcode_question' as const,
            questionId: String(questionId),
            questionTitle: question?.text ?? null,
            questionHint: question?.hint ?? null,
            questionSolution: result?.correctAnswerText ?? question?.answerText ?? null,
            questionExplanation: result?.explanation ?? question?.explanation ?? null,
            questionSubject: question?.subject ?? null,
            questionChapter: question?.chapter ?? null,
            questionConcept: question?.concept ?? null,
            questionDifficulty: question?.difficulty ?? null,
            questionAttempted: attempted,
            questionSolved: solved,
        };
    }, [question, questionId, result]);

    usePublishOriginAiPageContext(originAiPageContext);

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
            setShowHint(false);
            setShowSolution(false);
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
        setShowSolution(false);
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
        <div className="min-h-screen bg-background flex items-center justify-center">
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
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-300">
            {/* Header */}
            <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background">
                <button onClick={onBack} className="p-1.5 hover:bg-accent rounded-lg transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 font-mono">
                        <Trophy className="w-3.5 h-3.5" />
                        {user?.points || 0} PTS
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                        <Clock className="w-3.5 h-3.5" /> {Math.floor(elapsed / 60)}m {elapsed % 60}s
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left: Question Content */}
                <div className="lg:w-1/2 p-4 sm:p-6 overflow-y-auto border-r border-border bg-background">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-2 py-1 bg-blue-500/10 rounded uppercase tracking-wider">
                                {question.subject}
                            </span>
                            <span className={`text-[10px] font-bold ${diff.color} px-2 py-1 ${diff.bg} rounded uppercase tracking-wider`}>
                                {diff.label}
                            </span>
                        </div>
                        <div className="text-lg font-serif">
                            {renderQuestionText(question.text, 'question-text')}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-4">
                            {safeTags.map((tag, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-muted/50 border border-border rounded text-muted-foreground">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Interaction and Results */}
                <div className="lg:w-1/2 p-4 sm:p-6 bg-muted/30 border-l border-border overflow-y-auto">
                    <div className="max-w-xl mx-auto space-y-6">

                        {/* 1. INPUT SECTION */}
                        <div className="space-y-4">
                            {qType === 'mcq' && (question.options || []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    disabled={!!result || isSubmitting}
                                    onClick={() => setSelectedOption(idx)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all font-serif
                                        ${selectedOption === idx ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}
                                        ${result?.isCorrect && result?.correctOption === idx ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOption === idx ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    <span className="font-mono text-xs mr-3 opacity-50">({String.fromCharCode(65 + idx)})</span>
                                    <span>{renderInlineSegments(String(opt), `mcq-option-${idx}`)}</span>
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
                                        ${selectedOptions.includes(idx) ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}
                                        ${result?.isCorrect && result?.correctOptions?.includes(idx) ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOptions.includes(idx) ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedOptions.includes(idx) ? 'bg-blue-500 border-blue-500' : 'border-input'}`}>
                                            {selectedOptions.includes(idx) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className="font-mono text-xs opacity-50">({String.fromCharCode(65 + idx)})</span>
                                        <span>{renderInlineSegments(String(opt), `msq-option-${idx}`)}</span>
                                    </div>
                                </button>
                            ))}

                            {qType === 'matrix_match' && mData && (
                                <div className="space-y-6">
                                    {/* Column B Reference (New) */}
                                    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Column B Reference</h4>
                                            <button 
                                                onClick={() => setMatrixPairs([])}
                                                className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1.5 px-2 py-1 bg-blue-500/5 hover:bg-blue-500/10 rounded-md border border-blue-500/20"
                                            >
                                                <X className="w-3 h-3" /> Clear Selections
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(colB).map((term: string, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 bg-muted/50 border border-border rounded-xl p-2.5">
                                                                    <span className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground truncate">{term}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {(colA).map((itemA: string, idxA: number) => (
                                            <div key={idxA} className="p-5 rounded-2xl bg-card border border-border space-y-4 hover:border-primary/30 transition-colors shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <span className="w-7 h-7 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center text-[12px] font-black shrink-0 border border-border shadow-inner">
                                                            {String.fromCharCode(65 + idxA)}
                                                        </span>
                                                        <span className="text-[15px] font-bold text-foreground tracking-tight leading-relaxed">{itemA}</span>
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
                                                                    ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-background border-border text-muted-foreground'}
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
                                        className="w-full bg-card border-2 border-border p-5 rounded-2xl text-2xl text-center font-mono focus:border-primary outline-none transition-all text-foreground shadow-inner"
                                        placeholder={qType === 'numerical' ? "Enter value..." : "Type answer..."}
                                    />
                                    {result && !result.isCorrect && result.correctAnswerText && (
                                        <p className="text-xs text-rose-500 dark:text-rose-400 text-center">Incorrect. The value you entered doesn&apos;t match the expected answer.</p>
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
                                        <p className="text-xs text-muted-foreground/60">Time spent: {Math.floor(elapsed / 60)}m {elapsed % 60}s</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Result Score</p>
                                        <p className="text-lg font-black text-foreground">
                                            {result.resultScore ?? 0}
                                            <span className="ml-1 text-xs font-medium text-muted-foreground/60">/ {result.maxPoints ?? result.basePoints ?? 0}</span>
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Points Earned</p>
                                        <p className={`text-lg font-black ${result.pointsAwarded ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                                            +{result.pointsAwarded ?? 0}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
                                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60">Speed Rating</p>
                                        <p className="text-lg font-black text-foreground">
                                            {result.speedBand ? SPEED_BAND_LABELS[result.speedBand] : 'Recorded'}
                                        </p>
                                        {typeof result.targetTimeSeconds === 'number' && (
                                            <p className="text-[11px] text-muted-foreground/60">
                                                Target {Math.floor(result.targetTimeSeconds / 60)}m {result.targetTimeSeconds % 60}s
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {result.isCorrect ? (
                                    result.explanation && (
                                        <div className="pt-4 border-t border-border">
                                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Trophy className="w-4 h-4" /> Solution
                                            </p>
                                            {renderFormattedExplanation(result.explanation)}
                                        </div>
                                    )
                                ) : (
                                    <div className="space-y-4 mt-2">
                                        {(question.hint || result.correctAnswerText || result.explanation) && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {question.hint && !showHint && (
                                                    <button 
                                                        onClick={() => setShowHint(true)}
                                                        className="w-full py-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all group"
                                                    >
                                                        <HelpCircle className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> Need a Hint?
                                                    </button>
                                                )}
                                                {(result.correctAnswerText || result.explanation) && !showSolution && (
                                                    <button
                                                        onClick={() => setShowSolution(true)}
                                                        className="w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-xl text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                                    >
                                                        <Trophy className="w-3.5 h-3.5" /> See Full Solution
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {showHint && question.hint && (
                                            <div className="pt-4 border-t border-border animate-in fade-in zoom-in-95 duration-300">
                                                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <HelpCircle className="w-3.5 h-3.5" /> Hint
                                                </p>
                                                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line font-serif italic">
                                                    {question.hint}
                                                </p>
                                            </div>
                                        )}

                                        {showSolution && (result.correctAnswerText || result.explanation) && (
                                            <div className="pt-4 border-t border-border animate-in fade-in zoom-in-95 duration-300 space-y-3">
                                                <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <Trophy className="w-3.5 h-3.5" /> Full Solution
                                                </p>
                                                {result.correctAnswerText && (
                                                    <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 px-4 py-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Stored Answer</p>
                                                        {hasMathMarkup(result.correctAnswerText) ? (
                                                            <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono text-base text-foreground">
                                                                {formatMathExpression(result.correctAnswerText)}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line font-medium">
                                                                {result.correctAnswerText}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {result.explanation && (
                                                    <div className="rounded-xl border border-border bg-card/50 px-4 py-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Reference Explanation</p>
                                                        {renderFormattedExplanation(result.explanation)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-3 mt-6">
                                    {!result.isCorrect && (
                                        <button
                                            onClick={handleTryAgain}
                                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20 border border-blue-400/20"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                            Try Again
                                        </button>
                                    )}
                                    <button
                                        onClick={onBack}
                                        className={`py-3 bg-muted hover:bg-muted/80 border border-border rounded-xl text-sm font-semibold transition-colors text-foreground ${result.isCorrect ? 'w-full' : 'flex-1'}`}
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
