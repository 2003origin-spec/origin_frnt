'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Play, Clock, Loader2, CheckCircle2,
    XCircle, RotateCcw, Trophy, X, HelpCircle, ChevronLeft, ChevronRight, Building2,
    ZoomIn, ZoomOut, ImageOff, Hash, Layers, AlignLeft, GitMerge, BookOpen, Flag,
    Volume2, VolumeX, Heart, Swords, Search,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiCall } from '@/lib/api';
import { usePublishOriginAiPageContext } from '@/features/origin-ai/page-context-store';
import { readOgcodeNavQueue, saveOgcodeNavQueue, getOgcodeNeighbours, type OgcodeNavQueue } from '@/features/ogcode/nav-queue';
import {
    formatMathExpression as sharedFormatMathExpression,
    hasMathMarkup as sharedHasMathMarkup,
} from '@/lib/math-text';
import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import type { PracticeQuestion, User } from '@/types';
import { submitOgcodeAnswerAction, revealOgcodeQuestionAction, toggleOgcodeQuestionLikeAction, reportOgcodeQuestionAction, ogcodePresenceHeartbeatAction, listOgcodeChallengeMutualsAction, sendOgcodeChallengeAction } from '@/server/actions/ogcode-actions';
import { playAnswerSound as playAnswerSoundManager, resetAnswerStreak } from '@/lib/sound-manager';
import { toast } from 'sonner';

const SUBJECT_META: Record<string, { label: string; emoji: string; param: string }> = {
    phy:  { label: 'Physics',     emoji: '⚛️', param: 'subject=phy'  },
    chem: { label: 'Chemistry',   emoji: '🧪', param: 'subject=chem' },
    math: { label: 'Mathematics', emoji: '📐', param: 'subject=math' },
    bio:  { label: 'Biology',     emoji: '🌿', param: 'subject=bio'  },
};

const SUBJECT_ORI_MAP: Record<string, string> = {
    phy:         '/ori2d/ori-physics.png',
    physics:     '/ori2d/ori-physics.png',
    chem:        '/ori2d/ori-chemistry.png',
    chemistry:   '/ori2d/ori-chemistry.png',
    math:        '/ori2d/ori-maths.png',
    mathematics: '/ori2d/ori-maths.png',
    bio:         '/ori2d/ori-biology.png',
    biology:     '/ori2d/ori-biology.png',
};

interface OGCodeWorkspaceProps {
    questionId: string | number;
    onBack: () => void;
    onRefreshUser?: () => void;
    setTimeMode?: (mode: 'webpage' | 'practice' | 'pomodoro', subject?: string) => void;
    user: User;
    /**
     * Server-seeded question payload. When present, the workspace renders
     * immediately with no client fetch for the initial question.
     */
    initialQuestion?: PracticeQuestion | null;
}

interface SubmitResult {
    isCorrect: boolean;
    already_solved?: boolean;
    correctOption?: number;
    correctOptions?: number[];
    presentationId?: string;
    presentation_id?: string;
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
    // OGCode Scoring V2: terminal=false means a mid-loop wrong answer with
    // retries left — the server deliberately withholds answer/explanation.
    terminal?: boolean;
    attemptsUsed?: number;
    attemptsRemaining?: number;
    scoreReasons?: string[];
    // §9 global-stats comparison messaging (V2 terminal outcomes).
    statsMessage?: {
        acceptanceRate: number;
        completedByCount: number;
        neededRetryPercent: number | null;
        fasterThanPercent: number | null;
        isFirstEver: boolean;
    } | null;
    // §9 add-on: public per-option response distribution in DISPLAYED order —
    // "N% of people chose this option". Present on terminal MCQ/MSQ outcomes.
    optionDistribution?: { percent: number; count: number; total: number }[];
    option_distribution?: { percent: number; count: number; total: number }[];
}

type SubmitPayload = {
    timeSpent: number;
    selectedOption?: number | null;
    selectedOptions?: number[];
    presentationId?: string | null;
    presentation_id?: string | null;
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
    occurrence?: string | null;
    classLevel?: number | null;
    previousYearQuestion?: string | null;
    // OGCode Scoring V2 progress (server-authoritative; survives refresh).
    scoringV2?: boolean;
    attemptsUsed?: number;
    attemptsRemaining?: number;
    attemptCap?: number;
    hintRevealed?: boolean;
    answerRevealed?: boolean;
    terminalReached?: boolean;
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

const QTYPE_META: Record<string, { label: string; hint: string; Icon: React.ComponentType<{ className?: string }> }> = {
    mcq:          { label: 'Single Correct',   hint: 'Choose exactly one option.',               Icon: AlignLeft },
    msq:          { label: 'Multi Correct',    hint: 'One or more options may be correct.',      Icon: Layers },
    numerical:    { label: 'Integer / Decimal', hint: 'Enter the exact numeric value.',           Icon: Hash },
    matrix_match: { label: 'Match the Column', hint: 'Match each item in List I to List II.',    Icon: GitMerge },
    subjective:   { label: 'Descriptive',      hint: 'Write your answer in the box.',            Icon: AlignLeft },
    range:        { label: 'Range',            hint: 'Enter a from and to value — any correct answer inside the range counts.', Icon: Hash },
};

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

/**
 * "N% of submissions chose this" pill, straddling an option's top-right border.
 * Shown only after the answer is revealed. `highlight` tints it emerald for
 * the correct option; otherwise neutral so it doesn't fight the red/green states.
 */
function OptionChoiceBadge({ percent, count, highlight }: { percent: number; count: number; highlight: boolean }) {
    return (
        <span
            title={`${count} ${count === 1 ? 'submission' : 'submissions'} chose this`}
            className={`absolute -top-2.5 right-3 z-10 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums shadow-sm ring-1
                ${highlight
                    ? 'bg-emerald-500 text-white ring-emerald-600/40'
                    : 'bg-slate-800 text-white ring-black/10 dark:bg-slate-100 dark:text-slate-900 dark:ring-white/20'}`}
        >
            {percent}%
        </span>
    );
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
    return sharedFormatMathExpression(input);
}

function hasMathMarkup(value: string | null | undefined): boolean {
    return sharedHasMathMarkup(value);
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

function renderInlineSegments(value: string, keyPrefix: string): ReactNode {
    return <FormattedMessage content={value || ''} inline />;
}

function renderFormattedExplanation(content: string | null | undefined): ReactNode {
    return <FormattedMessage content={content || ''} />;
}

function renderQuestionText(content: string | null | undefined, keyPrefix: string): ReactNode {
    return <FormattedMessage content={content || ''} />;
}

export default function OGCodeWorkspace({ questionId, onBack, onRefreshUser, setTimeMode, user, initialQuestion }: OGCodeWorkspaceProps) {
    const [question, setQuestion] = useState<PracticeQuestionApi | null>(initialQuestion ?? null);
    const [isLoading, setIsLoading] = useState(!initialQuestion);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<SubmitResult | null>(null);

    // Answer states
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [selectedOptions, setSelectedOptions] = useState<number[]>([]);
    const [matrixPairs, setMatrixPairs] = useState<number[][]>([]);
    const [showHint, setShowHint] = useState(false);
    const [showSolution, setShowSolution] = useState(false);
    const [answerInput, setAnswerInput] = useState('');
    const [rangeFrom, setRangeFrom] = useState('');
    const [rangeTo, setRangeTo] = useState('');
    const [imgZoomed, setImgZoomed] = useState(false);
    const [imgError, setImgError] = useState(false);

    const [elapsed, setElapsed] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const hasFetched = useRef(Boolean(initialQuestion));

    // ── OGCode Scoring V2 client state ─────────────────────────────────────────
    // All attempt counts are SERVER-authoritative (from the question detail on
    // load, then from each submit response) — a refresh restores burned attempts
    // instead of resetting a local counter.
    const [v2AttemptsUsed, setV2AttemptsUsed] = useState(0);
    const [v2AttemptsRemaining, setV2AttemptsRemaining] = useState<number | null>(null);
    const [v2HintTaken, setV2HintTaken] = useState(false);
    const [v2AnswerTaken, setV2AnswerTaken] = useState<{ correctAnswerText: string | null; explanation: string | null } | null>(null);
    const [v2ArmedReveal, setV2ArmedReveal] = useState<'hint' | 'answer' | null>(null);
    const [v2Revealing, setV2Revealing] = useState(false);
    const [v2WrongFlash, setV2WrongFlash] = useState(false);
    const isV2 = Boolean(question?.scoringV2);

    // §10 Liked Questions — public count + this viewer's flag, optimistic toggle.
    const [likeCount, setLikeCount] = useState(0);
    const [likedByMe, setLikedByMe] = useState(false);
    const [likePending, setLikePending] = useState(false);

    useEffect(() => {
        if (!question?.scoringV2) {
            setV2AttemptsUsed(0);
            setV2AttemptsRemaining(null);
        } else {
            setV2AttemptsUsed(question.attemptsUsed ?? 0);
            setV2AttemptsRemaining(question.terminalReached ? null : question.attemptsRemaining ?? null);
        }
        setV2HintTaken(Boolean(question?.hintRevealed));
        setV2AnswerTaken(null);
        setV2ArmedReveal(null);
        setV2WrongFlash(false);
        setLikeCount(question?.likeCount ?? 0);
        setLikedByMe(Boolean(question?.likedByMe));
    }, [question]);

    // §12 Live Practicing — heartbeat while the question is open; show the count.
    const [liveCount, setLiveCount] = useState(0);
    useEffect(() => {
        if (!question?.id) return;
        let active = true;
        const beat = async () => {
            try {
                const res = await ogcodePresenceHeartbeatAction(String(question.id));
                if (active) setLiveCount(res.count);
            } catch {
                // Presence is ambient; ignore failures.
            }
        };
        void beat();
        const interval = setInterval(beat, 15_000);
        return () => { active = false; clearInterval(interval); };
    }, [question?.id]);

    // §13 Friend Challenge — mutual-follow share-sheet.
    const [challengeOpen, setChallengeOpen] = useState(false);
    const [challengeQuery, setChallengeQuery] = useState('');
    const [challengeMutuals, setChallengeMutuals] = useState<{ id: string; username: string; name: string; avatar: string | null }[]>([]);
    const [challengeLoading, setChallengeLoading] = useState(false);
    const [challengeSentTo, setChallengeSentTo] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!challengeOpen) return;
        let active = true;
        setChallengeLoading(true);
        const t = setTimeout(async () => {
            try {
                const list = await listOgcodeChallengeMutualsAction(challengeQuery.trim());
                if (active) setChallengeMutuals(list);
            } catch {
                if (active) setChallengeMutuals([]);
            } finally {
                if (active) setChallengeLoading(false);
            }
        }, challengeQuery.trim() ? 250 : 0);
        return () => { active = false; clearTimeout(t); };
    }, [challengeOpen, challengeQuery]);

    const doSendChallenge = useCallback(async (toUserId: string, toName: string) => {
        if (!question) return;
        try {
            const res = await sendOgcodeChallengeAction(question.id, toUserId);
            if (res.ok) {
                setChallengeSentTo((prev) => new Set(prev).add(toUserId));
                toast.success(`Challenge sent to ${toName}`);
            } else if (res.error === 'already_pending') {
                setChallengeSentTo((prev) => new Set(prev).add(toUserId));
                toast.info(`${toName} already has a pending challenge for this question`);
            } else {
                toast.error('Could not send the challenge.');
            }
        } catch {
            toast.error('Could not send the challenge.');
        }
    }, [question]);

    // §11 Report Question — store-only modal.
    const [reportOpen, setReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState('incorrect_answer');
    const [reportDesc, setReportDesc] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    const doSubmitReport = useCallback(async () => {
        if (!question || reportSubmitting) return;
        setReportSubmitting(true);
        try {
            const res = await reportOgcodeQuestionAction(question.id, reportReason, reportDesc.trim() || null);
            if (res.ok) {
                toast.success('Thanks — your report was recorded.');
                setReportOpen(false);
                setReportDesc('');
            } else {
                toast.error('Could not submit the report.');
            }
        } catch {
            toast.error('Could not submit the report.');
        } finally {
            setReportSubmitting(false);
        }
    }, [question, reportReason, reportDesc, reportSubmitting]);

    const doToggleLike = useCallback(async () => {
        if (!question || likePending) return;
        // Optimistic flip; reconcile with the server's authoritative count.
        const nextLiked = !likedByMe;
        setLikedByMe(nextLiked);
        setLikeCount((c) => c + (nextLiked ? 1 : -1));
        setLikePending(true);
        try {
            const res = await toggleOgcodeQuestionLikeAction(question.id);
            setLikedByMe(res.likedByMe);
            setLikeCount(res.count);
        } catch {
            // Revert on failure.
            setLikedByMe(!nextLiked);
            setLikeCount((c) => c + (nextLiked ? -1 : 1));
            toast.error('Could not update like.');
        } finally {
            setLikePending(false);
        }
    }, [question, likedByMe, likePending]);

    // The single reveal implementation lives server-side; this is the manual
    // trigger. Idempotent — re-calling for an already-revealed question fetches
    // the content again without re-applying any decay.
    const doReveal = useCallback(async (kind: 'hint' | 'answer') => {
        if (!question || v2Revealing) return;
        setV2Revealing(true);
        try {
            const res = await revealOgcodeQuestionAction(question.id, kind);
            if (!res.enabled) return;
            if (kind === 'hint') {
                setV2HintTaken(true);
            } else {
                setV2AnswerTaken({
                    correctAnswerText: res.correctAnswerText ?? null,
                    explanation: res.explanation ?? null,
                });
            }
        } catch {
            toast.error('Could not reveal. Try again.');
        } finally {
            setV2Revealing(false);
            setV2ArmedReveal(null);
        }
    }, [question, v2Revealing]);

    // Points animation — Ori flies from the result card to the PTS counter in the header
    const [oriAnim, setOriAnim] = useState<{
        fromX: number; fromY: number;
        toX: number; toY: number;
        points: number;
        oriImg: string;
    } | null>(null);
    const [ptsPulse, setPtsPulse] = useState(false);
    const [localPoints, setLocalPoints] = useState<number | null>(null);
    const pointsEarnedRef = useRef<HTMLDivElement>(null);
    const ptsCounterRef = useRef<HTMLDivElement>(null);

    // Sound prefs — mirrored into refs so the submit handler always reads the
    // latest value without needing `user` in its dependency array (avoids the
    // stale-closure that silenced sounds after the first question). Mirrors the
    // exact value including null, so selecting "None" is respected.
    const correctSoundRef = useRef<string | null>(user?.ogcodeCorrectSound ?? null);
    const wrongSoundRef   = useRef<string | null>(user?.ogcodeWrongSound   ?? null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    useEffect(() => {
        correctSoundRef.current = user?.ogcodeCorrectSound ?? null;
        wrongSoundRef.current   = user?.ogcodeWrongSound   ?? null;
    }, [user?.ogcodeCorrectSound, user?.ogcodeWrongSound]);
    // Stop any playing answer sound when leaving the question / unmounting.
    useEffect(() => () => { audioRef.current?.pause(); }, []);
    // Fresh consecutive-answer streak each time the workspace mounts.
    useEffect(() => { resetAnswerStreak(); }, []);

    // ── Answer sounds ──────────────────────────────────────────────────────────
    // The student's chosen sound (set in Profile) plays on submit — on by default.
    // Mobile browsers block audio not started in a user gesture, so we unlock a
    // reusable <audio> element on the first tap. A persisted mute toggle silences it.
    // Sounds are a global feature now (configured in Profile → Sound Effects),
    // so the workspace mute control is always available.
    const hasSoundPref = true;
    const [muted, setMuted] = useState(false);
    const mutedRef = useRef(false);
    const audioUnlockedRef = useRef(false);

    // Unlock the reusable audio element inside a user gesture so later
    // programmatic playback is permitted (mobile autoplay policy).
    const unlockAudio = useCallback(() => {
        if (audioUnlockedRef.current) return;
        const file = correctSoundRef.current || wrongSoundRef.current;
        if (!file) return;
        const el = audioRef.current ?? new Audio();
        audioRef.current = el;
        const dir = correctSoundRef.current ? 'correct' : 'wrong';
        try {
            el.src = `/sounds/${dir}/${file}`;
            el.muted = true;
            el.play()
                .then(() => { el.pause(); el.currentTime = 0; el.muted = false; audioUnlockedRef.current = true; })
                .catch(() => { el.muted = false; });
        } catch { /* ignore */ }
    }, []);

    // Restore mute preference (default: sounds ON).
    useEffect(() => {
        try {
            if (localStorage.getItem('ogcode_sound_muted') === '1') { setMuted(true); mutedRef.current = true; }
        } catch { /* ignore */ }
    }, []);

    // Unlock audio on the first tap anywhere (mobile needs a fresh gesture each load).
    useEffect(() => {
        if (!hasSoundPref) return;
        const onGesture = () => unlockAudio();
        window.addEventListener('pointerdown', onGesture, { once: true });
        return () => window.removeEventListener('pointerdown', onGesture);
    }, [hasSoundPref, unlockAudio]);

    const toggleMute = useCallback(() => {
        setMuted(prev => {
            const next = !prev;
            mutedRef.current = next;
            try { localStorage.setItem('ogcode_sound_muted', next ? '1' : '0'); } catch { /* ignore */ }
            if (next) {
                audioRef.current?.pause();
                toast('Answer sounds muted');
            } else {
                unlockAudio(); // runs inside the tap gesture
                toast.success('Answer sounds on');
            }
            return next;
        });
    }, [unlockAudio]);

    // Previous / Next navigation that follows the filter applied on the list.
    const router = useRouter();
    const [navQueue, setNavQueue] = useState<OgcodeNavQueue | null>(null);
    useEffect(() => {
        const existing = readOgcodeNavQueue();
        if (existing) {
            setNavQueue(existing);
            return;
        }
        // No queue from the list page — fetch all question IDs so navigation works on direct URL load.
        apiCall('/assessments/ogcode/questions/').then((data: unknown) => {
            const items = Array.isArray(data) ? data : [];
            const ids = items.map((q: { id: unknown }) => String(q.id)).filter(Boolean);
            if (ids.length === 0) return;
            const queue: OgcodeNavQueue = { ids, label: 'All Questions' };
            saveOgcodeNavQueue(queue);
            setNavQueue(queue);
        }).catch(() => { /* silently skip if fetch fails */ });
    }, []);
    const { prevId, nextId, index, total } = getOgcodeNeighbours(navQueue, String(questionId));
    const goToQuestion = useCallback((id: string | null) => {
        if (id) router.push(`/ogcode/${id}`);
    }, [router]);

    const [isLoadingMore, setIsLoadingMore] = useState(false);

    const switchToSubject = useCallback(async (subjectKey: string) => {
        const meta = SUBJECT_META[subjectKey];
        if (!meta) return;
        try {
            const data = await apiCall(`/assessments/ogcode/questions/?${meta.param}`) as unknown;
            const items = Array.isArray(data) ? data : [];
            const ids = items.map((q: { id: unknown }) => String(q.id)).filter(Boolean);
            if (ids.length === 0) { toast.error(`No ${meta.label} questions found`); return; }
            const queue: OgcodeNavQueue = { ids, label: meta.label, filterParams: meta.param };
            saveOgcodeNavQueue(queue);
            setNavQueue(queue);
            router.push(`/ogcode/${ids[0]}`);
        } catch {
            toast.error(`Failed to load ${meta.label} questions`);
        }
    }, [router]);

    const loadMoreQuestions = useCallback(async () => {
        setIsLoadingMore(true);
        try {
            // Re-fetch with the same filter the user had on the list page (if any)
            const qs = navQueue?.filterParams ? `?${navQueue.filterParams}` : '';
            const data = await apiCall(`/assessments/ogcode/questions/${qs}`) as unknown;
            const items = Array.isArray(data) ? data : [];
            const incoming = items.map((q: { id: unknown }) => String(q.id)).filter(Boolean);
            const existingSet = new Set(navQueue?.ids ?? []);
            const fresh = incoming.filter(id => !existingSet.has(id));
            if (fresh.length > 0) {
                const merged = [...(navQueue?.ids ?? []), ...fresh];
                const queue: OgcodeNavQueue = { ids: merged, label: navQueue?.label ?? 'All Questions', filterParams: navQueue?.filterParams };
                saveOgcodeNavQueue(queue);
                setNavQueue(queue);
                router.push(`/ogcode/${fresh[0]}`);
            } else {
                // Determine current subject from filter params
                const currentSubjectKey = navQueue?.filterParams
                    ? new URLSearchParams(navQueue.filterParams).get('subject') ?? ''
                    : '';
                const currentLabel = SUBJECT_META[currentSubjectKey]?.label ?? (navQueue?.label ?? 'this topic');
                // Pick 2 random other subjects
                const suggestions = Object.keys(SUBJECT_META)
                    .filter(k => k !== currentSubjectKey)
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 2);

                toast.custom((toastId) => (
                    <div className="w-full max-w-sm rounded-2xl border border-border/40 bg-background p-4 shadow-xl">
                        <p className="text-sm font-semibold text-foreground">
                            🚧 More {currentLabel} questions coming soon!
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            We&apos;re working hard on adding more. How about practising:
                        </p>
                        <div className="mt-3 flex gap-2">
                            {suggestions.map(key => {
                                const m = SUBJECT_META[key];
                                return (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => { toast.dismiss(toastId); switchToSubject(key); }}
                                        className="flex items-center gap-1.5 rounded-xl neu-raised px-3 py-1.5 text-xs font-bold text-foreground transition-all hover:-translate-y-0.5"
                                    >
                                        <span>{m.emoji}</span> {m.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ), { duration: 12000 });
            }
        } catch {
            toast.error('Failed to load more questions');
        } finally {
            setIsLoadingMore(false);
        }
    }, [navQueue, router, switchToSubject]);

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

    // Navigating Prev/Next changes `questionId` without necessarily remounting
    // this component. Reset per-question state and reload the new question.
    const prevQuestionIdRef = useRef(String(questionId));
    useEffect(() => {
        const idStr = String(questionId);
        if (prevQuestionIdRef.current === idStr) return;
        prevQuestionIdRef.current = idStr;
        setResult(null);
        setSelectedOption(null);
        setSelectedOptions([]);
        setMatrixPairs([]);
        setShowHint(false);
        setShowSolution(false);
        setAnswerInput('');
        setRangeFrom('');
        setRangeTo('');
        setImgZoomed(false);
        setImgError(false);
        setElapsed(0);
        if (initialQuestion && String(initialQuestion.id) === idStr) {
            setQuestion(initialQuestion);
            hasFetched.current = true;
        } else {
            setQuestion(null);
            hasFetched.current = false;
        }
    }, [questionId, initialQuestion]);

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

        const payload: SubmitPayload = {
            timeSpent: elapsed,
            presentationId: question.presentationId ?? question.presentation_id ?? null,
        };
        const qType = question.questionType ?? 'mcq';

        if (qType === 'mcq') payload.selectedOption = selectedOption;
        else if (qType === 'msq') payload.selectedOptions = selectedOptions;
        else if (qType === 'matrix_match') payload.matrixPairs = matrixPairs;
        else if (qType === 'range') payload.answerText = `${rangeFrom}|${rangeTo}`;
        else payload.answerText = answerInput;

        // Submit is a user gesture — unlock audio now so post-await playback is
        // allowed on mobile (the gesture context is otherwise lost after await).
        unlockAudio();

        setIsSubmitting(true);
        try {
            setShowHint(false);
            setShowSolution(false);
            const res: SubmitResult = await submitOgcodeAnswerAction(question.id, payload);

            // Route through the shared sound manager (respects the user's
            // per-category choices + master volume, and upgrades to the streak
            // sound on every 3rd consecutive correct/wrong). The workspace's own
            // mute button is an additional local override.
            const playAnswerSound = (correct: boolean) => {
                if (mutedRef.current) return;
                playAnswerSoundManager(correct);
            };

            // Scoring V2 mid-loop wrong answer: retries remain, so stay in the
            // question (no result view, timer keeps running — tt is cumulative)
            // and render off the server's authoritative attempt counts.
            if (res.terminal === false) {
                setV2AttemptsUsed(res.attemptsUsed ?? v2AttemptsUsed + 1);
                setV2AttemptsRemaining(res.attemptsRemaining ?? null);
                setV2WrongFlash(true);
                const remaining = res.attemptsRemaining ?? 0;
                toast.error(`Not quite — ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} left`);
                playAnswerSound(false);
                return;
            }

            if (timerRef.current) clearInterval(timerRef.current);
            setV2WrongFlash(false);
            setResult(res); // This triggers the result UI
            toast.success(res.isCorrect ? "Brilliant! Correct Answer" : "Not quite right. Try again?");
            playAnswerSound(res.isCorrect);

            // Refresh user data if solved
            if (res.isCorrect && !res.already_solved) {
                onRefreshUser?.();
            }
        } catch {
            toast.error('Submission failed.');
        } finally {
            setIsSubmitting(false);
        }
    }, [question, result, isSubmitting, elapsed, selectedOption, selectedOptions, matrixPairs, answerInput, rangeFrom, rangeTo, unlockAudio, v2AttemptsUsed]);

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

    // Reset local points when moving to a new question
    useEffect(() => { setLocalPoints(null); }, [question?.id]);

    // Trigger the Ori fly-to-pts animation on a fresh correct solve
    useEffect(() => {
        if (!result?.isCorrect) return;
        const t = setTimeout(() => {
            const card = pointsEarnedRef.current;
            const ptsEl = ptsCounterRef.current;
            if (!card || !ptsEl) return;
            const cardRect = card.getBoundingClientRect();
            const ptsRect = ptsEl.getBoundingClientRect();
            const subjectKey = String(question?.subject ?? 'phy').toLowerCase();
            setOriAnim({
                fromX: cardRect.left + cardRect.width / 2,
                fromY: cardRect.top,
                toX: ptsRect.left + ptsRect.width / 2,
                toY: ptsRect.top + ptsRect.height / 2,
                points: result.pointsAwarded ?? 0,
                oriImg: SUBJECT_ORI_MAP[subjectKey] ?? '/ori2d/ori-cheerful.png',
            });
        }, 500);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result]);

    if (isLoading) return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
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

    // Correct-answer text shown in the result view: the ACTUAL option(s) for
    // choice questions (e.g. "(B) v²/r"), not the raw stored value — falling back
    // to the stored answer for numerical / range / subjective. correctOption(s)
    // are already mapped to the displayed (shuffled) order server-side.
    const correctAnswerDisplay = (() => {
        if (!result) return null;
        const opts = question.options ?? [];
        if (qType === 'mcq' && typeof result.correctOption === 'number' && opts[result.correctOption] != null) {
            return `(${String.fromCharCode(65 + result.correctOption)}) ${opts[result.correctOption]}`;
        }
        if (qType === 'msq' && result.correctOptions?.length && opts.length) {
            return result.correctOptions
                .filter((i) => opts[i] != null)
                .map((i) => `(${String.fromCharCode(65 + i)}) ${opts[i]}`)
                .join('   ·   ');
        }
        return result.correctAnswerText ?? null;
    })();

    // §9 add-on: public "N% of people chose this" per option, in displayed order.
    // Only present on terminal MCQ/MSQ outcomes.
    const optionDistribution = result?.optionDistribution ?? result?.option_distribution ?? null;

    return (
        <div className="min-h-screen neu-surface text-foreground flex flex-col font-sans transition-colors duration-300">
            {/* Header */}
            <div className="relative h-14 sm:h-12 border-b border-border/40 flex items-center gap-2 px-3 sm:px-4 bg-[hsl(var(--neu-bg)/0.85)] backdrop-blur-xl sticky top-0 z-50">
                <button onClick={onBack} className="shrink-0 p-2 neu-raised rounded-lg transition-all hover:-translate-y-0.5" aria-label="Back to questions">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Stats — centred, allowed to shrink/scroll so nothing is clipped behind the controls */}
                <div id="tutorial-ogcode-stats" className="flex-1 min-w-0 flex items-center justify-center gap-2 overflow-x-auto">
                    <motion.div
                        ref={ptsCounterRef}
                        className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-amber-500 font-mono bg-amber-500/5 px-2 py-1 rounded-md border border-amber-500/10"
                        animate={ptsPulse ? {
                            scale: [1, 1.4, 0.92, 1.18, 1],
                            borderColor: ['rgba(245,158,11,0.1)', 'rgba(245,158,11,0.6)', 'rgba(245,158,11,0.1)'],
                            backgroundColor: ['rgba(245,158,11,0.05)', 'rgba(245,158,11,0.2)', 'rgba(245,158,11,0.05)'],
                        } : {}}
                        transition={{ duration: 0.5 }}
                    >
                        <Trophy className="w-3.5 h-3.5" />
                        {localPoints !== null ? localPoints : (user?.points || 0)} <span className="hidden sm:inline">PTS</span>
                    </motion.div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground font-mono neu-inset px-2.5 py-1 rounded-md tabular-nums">
                        <Clock className="w-3.5 h-3.5" /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                    </div>
                    {/* §12 Live Practicing — green dot + live count on this question */}
                    {liveCount > 0 && (
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20" title={`${liveCount} practicing now`}>
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            {liveCount} <span className="hidden sm:inline">Live</span>
                        </div>
                    )}
                </div>

                {/* Right-side controls */}
                <div className="shrink-0 flex items-center gap-2">
                    {/* Answer-sound mute toggle — only when the student has picked sounds */}
                    {hasSoundPref && (
                        <button
                            onClick={toggleMute}
                            className={`p-2 neu-raised rounded-lg transition-all hover:-translate-y-0.5 group ${muted ? 'text-muted-foreground' : 'text-primary'}`}
                            aria-label={muted ? 'Unmute answer sounds' : 'Mute answer sounds'}
                            title={muted ? 'Answer sounds muted — tap to unmute' : 'Answer sounds on — tap to mute'}
                        >
                            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        </button>
                    )}

                    {/* §13 Challenge a friend */}
                    <button
                        onClick={() => setChallengeOpen(true)}
                        className="p-2 neu-raised rounded-lg transition-all hover:-translate-y-0.5 group"
                        aria-label="Challenge a friend"
                        title="Challenge a friend to this question"
                    >
                        <Swords className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                    {/* Report button — opens the in-app report form (§11) */}
                    <button
                        onClick={() => setReportOpen(true)}
                        className="p-2 neu-raised rounded-lg transition-all hover:-translate-y-0.5 group"
                        aria-label="Report this question"
                        title="Report a problem with this question"
                    >
                        <Flag className="w-4 h-4 text-muted-foreground group-hover:text-rose-500 transition-colors" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto neu-surface">
                <div className="max-w-3xl mx-auto px-4 sm:px-8 py-4 sm:py-5 space-y-5">
                    {/* Question navigation — top of content, always visible */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => goToQuestion(prevId)}
                            disabled={!prevId}
                            aria-label="Previous question"
                            title={navQueue?.label ? `Previous · ${navQueue.label}` : 'Previous question'}
                            className="shrink-0 neu-raised flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-foreground transition-all hover:-translate-y-0.5 disabled:opacity-30 disabled:cursor-not-allowed disabled:translate-y-0"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Prev
                        </button>
                        <span className="truncate max-w-[8rem] shrink text-[10px] font-mono text-muted-foreground tabular-nums">
                            {total > 0 && index >= 0 ? `${index + 1} / ${total}` : `# ${questionId}`}
                        </span>
                        {nextId ? (
                            <button
                                onClick={() => goToQuestion(nextId)}
                                aria-label="Next question"
                                title={navQueue?.label ? `Next · ${navQueue.label}` : 'Next question'}
                                className="shrink-0 neu-raised flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-foreground transition-all hover:-translate-y-0.5"
                            >
                                Next
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <button
                                onClick={loadMoreQuestions}
                                disabled={isLoadingMore}
                                aria-label="Load more questions"
                                className="shrink-0 neu-raised flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-primary transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
                            >
                                {isLoadingMore ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                {isLoadingMore ? 'Loading…' : 'Load More'}
                            </button>
                        )}
                    </div>

                    {/* Question Content */}
                    <div id="tutorial-ogcode-content" className="space-y-4">
                        {/* Meta row: subject · difficulty · question type · PYQ */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                                {question.isContributed && question.attributionName && (
                                    <span
                                        className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 bg-emerald-500/10 rounded uppercase tracking-wider max-w-[160px]"
                                        title={`Contributed by ${question.attributionName}`}
                                    >
                                        {question.attributionLogoUrl
                                            ? <Image src={question.attributionLogoUrl} alt="" width={14} height={14} className="rounded-sm object-cover flex-shrink-0" unoptimized />
                                            : <Building2 className="w-3 h-3 flex-shrink-0" />}
                                        <span className="truncate">{question.attributionName}</span>
                                    </span>
                                )}
                                <span className="text-[10px] font-bold text-primary px-2 py-1 bg-primary/10 rounded uppercase tracking-wider">
                                    {question.subject}
                                </span>
                                {question.classLevel && (
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 px-2 py-1 bg-indigo-500/10 rounded uppercase tracking-wider">
                                        Class {question.classLevel}
                                    </span>
                                )}
                                <span className={`text-[10px] font-bold ${diff.color} px-2 py-1 ${diff.bg} rounded uppercase tracking-wider`}>
                                    {diff.label}
                                </span>
                                {/* Question type badge */}
                                {(() => {
                                    const meta = QTYPE_META[qType] ?? QTYPE_META.mcq;
                                    return (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 px-2 py-1 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded uppercase tracking-wider">
                                            <meta.Icon className="w-3 h-3" />
                                            {meta.label}
                                        </span>
                                    );
                                })()}
                                {/* PYQ badge */}
                                {question.previousYearQuestion && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-violet-600 dark:text-violet-400 px-2 py-1 bg-violet-500/10 border border-violet-500/20 rounded uppercase tracking-wider">
                                        <BookOpen className="w-3 h-3 flex-shrink-0" />
                                        PYQ
                                    </span>
                                )}
                                {/* Exam / occurrence badge (e.g. "NEET 2015") — coloured by its exam, shown once */}
                                {question.occurrence && question.occurrence !== 'NA' && (() => {
                                    const up = question.occurrence.toUpperCase();
                                    const style = up.includes('NEET')
                                        ? 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border-teal-500/25'
                                        : up.includes('AIPMT')
                                            ? 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/25'
                                            : up.includes('JEE')
                                                ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/25'
                                                : 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25';
                                    return (
                                        <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 border rounded uppercase tracking-wider max-w-[200px] ${style}`} title={question.occurrence}>
                                            <span className="truncate">{question.occurrence}</span>
                                        </span>
                                    );
                                })()}
                                {/* Attempted / Solved status badge */}
                                {(() => {
                                    const solved = Boolean(result?.isCorrect || question.isSolved || question.status === 'solved');
                                    const attempted = Boolean(question.attempted || question.status === 'attempted' || (question.attemptCount ?? 0) > 0);
                                    if (solved) {
                                        return (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded uppercase tracking-wider">
                                                <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                                                Solved
                                            </span>
                                        );
                                    }
                                    if (attempted) {
                                        return (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-600 dark:text-cyan-400 px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded uppercase tracking-wider">
                                                <RotateCcw className="w-3 h-3 flex-shrink-0" />
                                                Attempted
                                            </span>
                                        );
                                    }
                                    return null;
                                })()}
                                {/* §10 Liked Questions — public count + toggle */}
                                <button
                                    type="button"
                                    onClick={doToggleLike}
                                    disabled={likePending}
                                    aria-pressed={likedByMe}
                                    title={likedByMe ? 'Unlike' : 'Like this question'}
                                    className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 border rounded uppercase tracking-wider transition-colors ${likedByMe ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25' : 'text-slate-500 dark:text-slate-400 bg-white/[0.03] border-white/10 hover:border-rose-500/30'}`}
                                >
                                    <Heart className={`w-3 h-3 flex-shrink-0 ${likedByMe ? 'fill-current' : ''}`} />
                                    {likeCount}
                                </button>
                            </div>
                            {/* Subject Ori avatar */}
                            {question.subject && SUBJECT_ORI_MAP[question.subject] && (
                                <Image
                                    src={SUBJECT_ORI_MAP[question.subject]}
                                    alt={question.subject}
                                    width={32}
                                    height={32}
                                    draggable={false}
                                    className="object-contain select-none shrink-0"
                                />
                            )}
                        </div>

                        {/* Question text */}
                        <div className="text-xl sm:text-2xl font-sans leading-relaxed text-slate-900 dark:text-slate-100 select-text cursor-text">
                            {renderQuestionText(question.text, 'question-text')}
                        </div>

                        {/* Question image — shown when available */}
                        {question.image && !imgError && (
                            <div className="relative">
                                <div className="relative neu-inset rounded-xl overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={question.image}
                                        alt="Question diagram"
                                        className="w-full h-auto max-h-[360px] object-contain cursor-zoom-in"
                                        onError={() => setImgError(true)}
                                        onClick={() => setImgZoomed(true)}
                                    />
                                    <button
                                        onClick={() => setImgZoomed(true)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/40 hover:bg-black/60 rounded-lg text-white transition-colors"
                                        aria-label="Zoom image"
                                    >
                                        <ZoomIn className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {safeTags.map((tag, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded text-slate-600 dark:text-slate-400">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Image lightbox */}
                    {imgZoomed && question.image && (
                        <div
                            className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
                            onClick={() => setImgZoomed(false)}
                        >
                            <button
                                onClick={() => setImgZoomed(false)}
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={question.image}
                                alt="Question diagram (zoomed)"
                                className="max-w-full max-h-[90vh] object-contain rounded-xl"
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    )}

                    {/* §13 Friend Challenge share-sheet (mutual followers only) */}
                    {challengeOpen && (
                        <div
                            className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4"
                            onClick={() => setChallengeOpen(false)}
                        >
                            <div
                                className="w-full max-w-md rounded-2xl neu-raised p-5 space-y-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <Swords className="w-4 h-4 text-primary" /> Challenge a friend
                                    </h3>
                                    <button onClick={() => setChallengeOpen(false)} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-200">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-[11px] text-muted-foreground">Only mutual followers (you follow each other) can be challenged.</p>
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={challengeQuery}
                                        onChange={(e) => setChallengeQuery(e.target.value)}
                                        placeholder="Search your mutual followers…"
                                        className="w-full neu-field pl-9 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary/40"
                                    />
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                    {challengeLoading ? (
                                        <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
                                    ) : challengeMutuals.length === 0 ? (
                                        <p className="py-6 text-center text-xs text-muted-foreground">
                                            {challengeQuery.trim() ? 'No mutual followers match.' : 'No mutual followers yet — follow classmates who follow you back to challenge them.'}
                                        </p>
                                    ) : (
                                        challengeMutuals.map((m) => {
                                            const sent = challengeSentTo.has(m.id);
                                            return (
                                                <div key={m.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04]">
                                                    {m.avatar
                                                        ? <Image src={m.avatar} alt="" width={28} height={28} className="rounded-full object-cover" unoptimized />
                                                        : <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">{m.name.charAt(0).toUpperCase()}</div>}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{m.name}</p>
                                                        <p className="text-[10px] text-muted-foreground truncate">@{m.username}</p>
                                                    </div>
                                                    <button
                                                        onClick={() => doSendChallenge(m.id, m.name)}
                                                        disabled={sent}
                                                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors ${sent ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/15 text-primary hover:bg-primary/25'}`}
                                                    >
                                                        {sent ? 'Sent' : 'Challenge'}
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* §11 Report Question modal */}
                    {reportOpen && (
                        <div
                            className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4"
                            onClick={() => !reportSubmitting && setReportOpen(false)}
                        >
                            <div
                                className="w-full max-w-md rounded-2xl neu-raised p-5 space-y-4"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <Flag className="w-4 h-4 text-rose-500" /> Report a problem
                                    </h3>
                                    <button onClick={() => setReportOpen(false)} disabled={reportSubmitting} aria-label="Close" className="p-1 text-slate-400 hover:text-slate-200">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">What&apos;s wrong?</label>
                                    <select
                                        value={reportReason}
                                        onChange={(e) => setReportReason(e.target.value)}
                                        className="w-full neu-field p-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary/40"
                                    >
                                        <option value="incorrect_answer">Incorrect answer</option>
                                        <option value="unclear_question">Unclear / ambiguous question</option>
                                        <option value="typo_or_formatting">Typo or formatting issue</option>
                                        <option value="wrong_options">Wrong / missing options</option>
                                        <option value="image_missing">Image missing or broken</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Details (optional)</label>
                                    <textarea
                                        value={reportDesc}
                                        onChange={(e) => setReportDesc(e.target.value)}
                                        rows={3}
                                        maxLength={2000}
                                        placeholder="Add anything that helps us fix it…"
                                        className="w-full neu-field p-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                                    />
                                </div>
                                <button
                                    onClick={doSubmitReport}
                                    disabled={reportSubmitting}
                                    className="w-full py-3 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-colors"
                                >
                                    {reportSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                                    Submit Report
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Subtle Divider */}
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                    {/* Interaction and Results */}
                    <div id="tutorial-ogcode-input" className="space-y-4 pb-8">

                        {/* 1. INPUT SECTION */}
                        <div className="space-y-4">
                            {/* Question type guidance */}
                            {!result && (() => {
                                const meta = QTYPE_META[qType] ?? QTYPE_META.mcq;
                                return (
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                        <meta.Icon className="w-3 h-3" />
                                        {meta.hint}
                                    </p>
                                );
                            })()}

                            {qType === 'mcq' && (question.options || []).map((opt, idx) => (
                                <button
                                    key={idx}
                                    disabled={!!result || isSubmitting}
                                    onClick={() => setSelectedOption(idx)}
                                    className={`relative w-full text-left p-4 rounded-xl border-2 transition-all font-sans bg-[hsl(var(--neu-bg))]
                                        ${selectedOption === idx
                                            ? 'border-primary bg-primary/10 shadow-[inset_3px_3px_7px_hsl(var(--neu-shadow)),inset_-3px_-3px_7px_hsl(var(--neu-light))]'
                                            : 'border-transparent shadow-[3px_3px_8px_hsl(var(--neu-shadow)),-3px_-3px_8px_hsl(var(--neu-light))] hover:-translate-y-0.5'}
                                        ${result && result.correctOption === idx ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOption === idx ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    {result && optionDistribution?.[idx] && (
                                        <OptionChoiceBadge
                                            percent={optionDistribution[idx].percent}
                                            count={optionDistribution[idx].count}
                                            highlight={result.correctOption === idx}
                                        />
                                    )}
                                    <span className="font-mono text-xs mr-3 opacity-50">({String.fromCharCode(65 + idx)})</span>
                                    <span className="select-text">{renderInlineSegments(String(opt), `mcq-option-${idx}`)}</span>
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
                                    className={`relative w-full text-left p-4 rounded-xl border-2 transition-all font-sans bg-[hsl(var(--neu-bg))]
                                        ${selectedOptions.includes(idx)
                                            ? 'border-primary bg-primary/10 shadow-[inset_3px_3px_7px_hsl(var(--neu-shadow)),inset_-3px_-3px_7px_hsl(var(--neu-light))]'
                                            : 'border-transparent shadow-[3px_3px_8px_hsl(var(--neu-shadow)),-3px_-3px_8px_hsl(var(--neu-light))] hover:-translate-y-0.5'}
                                        ${result && result.correctOptions?.includes(idx) ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400' : ''}
                                        ${result && !result.isCorrect && selectedOptions.includes(idx) ? 'border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400' : ''}
                                    `}
                                >
                                    {result && optionDistribution?.[idx] && (
                                        <OptionChoiceBadge
                                            percent={optionDistribution[idx].percent}
                                            count={optionDistribution[idx].count}
                                            highlight={Boolean(result.correctOptions?.includes(idx))}
                                        />
                                    )}
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedOptions.includes(idx) ? 'bg-primary border-primary' : 'border-white/20'}`}>
                                            {selectedOptions.includes(idx) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </div>
                                        <span className="font-mono text-xs opacity-50">({String.fromCharCode(65 + idx)})</span>
                                        <span className="select-text">{renderInlineSegments(String(opt), `msq-option-${idx}`)}</span>
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
                                                className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5 px-2 py-1 bg-primary/5 hover:bg-primary/10 rounded-md border border-primary/20"
                                            >
                                                <X className="w-3 h-3" /> Clear Selections
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(colB).map((term: string, idx: number) => (
                                                <div key={idx} className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2.5">
                                                    <span className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="text-xs text-slate-300 overflow-hidden min-w-0 w-full">
                                                        {renderInlineSegments(String(term), `matrix-term-${idx}`)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {(colA).map((itemA: string, idxA: number) => (
                                            <div key={idxA} className="p-5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-4 hover:border-white/10 transition-colors shadow-sm">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4 min-w-0">
                                                        <span className="w-7 h-7 rounded-lg bg-white/10 text-slate-400 flex items-center justify-center text-[12px] font-black shrink-0 border border-white/5 shadow-inner">
                                                            {String.fromCharCode(65 + idxA)}
                                                        </span>
                                                        <span className="text-[15px] font-bold text-slate-200 tracking-tight leading-relaxed min-w-0 overflow-hidden">
                                                            {renderInlineSegments(String(itemA), `matrix-item-${idxA}`)}
                                                        </span>
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
                                                                className={`w-12 h-12 rounded-xl border text-[13px] font-black transition-all flex items-center justify-center shadow-sm backdrop-blur-sm
                                                                    ${isSelected ? 'bg-primary border-primary text-white shadow-lg' : 'bg-white/40 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500'}
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
                                    {qType === 'numerical' ? (
                                        <>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    disabled={!!result || isSubmitting}
                                                    value={answerInput}
                                                    onChange={(e) => setAnswerInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        // Allow: digits, dot, minus, backspace, arrows, delete
                                                        const allowed = /[0-9.\-]|Backspace|Delete|Arrow|Tab|Enter/;
                                                        if (!allowed.test(e.key)) e.preventDefault();
                                                    }}
                                                    className="w-full bg-[hsl(var(--neu-bg))] shadow-[inset_3px_3px_7px_hsl(var(--neu-shadow)),inset_-3px_-3px_7px_hsl(var(--neu-light))] p-4 sm:p-6 rounded-2xl text-2xl sm:text-3xl text-center font-mono focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                                                    placeholder="0"
                                                    autoComplete="off"
                                                    spellCheck={false}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground uppercase tracking-widest pointer-events-none">
                                                    numeric
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground text-center">
                                                Enter integer or decimal (e.g. <span className="font-mono font-bold">4</span> or <span className="font-mono font-bold">3.14</span>).
                                                Negative values allowed.
                                            </p>
                                        </>
                                    ) : (
                                        <textarea
                                            disabled={!!result || isSubmitting}
                                            value={answerInput}
                                            onChange={(e) => setAnswerInput(e.target.value)}
                                            rows={3}
                                            className="w-full bg-[hsl(var(--neu-bg))] shadow-[inset_3px_3px_7px_hsl(var(--neu-shadow)),inset_-3px_-3px_7px_hsl(var(--neu-light))] p-4 rounded-2xl text-base font-sans focus:ring-2 focus:ring-primary/40 outline-none transition-all resize-none"
                                            placeholder="Type your answer here..."
                                        />
                                    )}
                                    {result && !result.isCorrect && result.correctAnswerText && (
                                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                            <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1">Correct Answer</p>
                                            <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{result.correctAnswerText}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {qType === 'range' && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            disabled={!!result || isSubmitting}
                                            value={rangeFrom}
                                            onChange={(e) => setRangeFrom(e.target.value)}
                                            onKeyDown={(e) => {
                                                const allowed = /[0-9.\-]|Backspace|Delete|Arrow|Tab|Enter/;
                                                if (!allowed.test(e.key)) e.preventDefault();
                                            }}
                                            className="w-full bg-[hsl(var(--neu-bg))] shadow-[inset_3px_3px_7px_hsl(var(--neu-shadow)),inset_-3px_-3px_7px_hsl(var(--neu-light))] p-4 sm:p-6 rounded-2xl text-xl sm:text-2xl text-center font-mono focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                                            placeholder="From"
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                        <span className="text-sm font-black text-muted-foreground uppercase tracking-widest shrink-0">to</span>
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            disabled={!!result || isSubmitting}
                                            value={rangeTo}
                                            onChange={(e) => setRangeTo(e.target.value)}
                                            onKeyDown={(e) => {
                                                const allowed = /[0-9.\-]|Backspace|Delete|Arrow|Tab|Enter/;
                                                if (!allowed.test(e.key)) e.preventDefault();
                                            }}
                                            className="w-full bg-[hsl(var(--neu-bg))] shadow-[inset_3px_3px_7px_hsl(var(--neu-shadow)),inset_-3px_-3px_7px_hsl(var(--neu-light))] p-4 sm:p-6 rounded-2xl text-xl sm:text-2xl text-center font-mono focus:ring-2 focus:ring-primary/40 outline-none transition-all"
                                            placeholder="To"
                                            autoComplete="off"
                                            spellCheck={false}
                                        />
                                    </div>
                                    <p className="text-[11px] text-muted-foreground text-center">
                                        Enter a from/to range (integer or decimal). Correct if the actual answer falls inside it.
                                    </p>
                                    {result && !result.isCorrect && result.correctAnswerText && (
                                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                            <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-1">Correct Answer</p>
                                            <p className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">{result.correctAnswerText}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* OGCode Scoring V2: attempts left + wrong-retry banner + pre-submission reveals */}
                        {isV2 && !result && (
                            <div className="space-y-3">
                                {v2WrongFlash && (v2AttemptsRemaining ?? 0) > 0 && (
                                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                        <p className="text-sm font-bold text-rose-400">
                                            Wrong — try again. {v2AttemptsRemaining} {v2AttemptsRemaining === 1 ? 'attempt' : 'attempts'} left.
                                        </p>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    {v2AttemptsRemaining !== null && (
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mr-auto">
                                            Attempt {Math.min(v2AttemptsUsed + 1, (question.attemptCap ?? 1))} of {question.attemptCap ?? 1}
                                        </span>
                                    )}
                                    {question.hint && !v2HintTaken && (
                                        v2ArmedReveal === 'hint' ? (
                                            <button
                                                onClick={() => doReveal('hint')}
                                                disabled={v2Revealing}
                                                className="py-2 px-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                            >
                                                {v2Revealing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HelpCircle className="w-3.5 h-3.5" />}
                                                Halves this question&apos;s score — confirm?
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setV2ArmedReveal('hint')}
                                                className="py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                            >
                                                <HelpCircle className="w-3.5 h-3.5" /> Hint
                                            </button>
                                        )
                                    )}
                                    {!v2AnswerTaken && (
                                        v2ArmedReveal === 'answer' ? (
                                            <button
                                                onClick={() => doReveal('answer')}
                                                disabled={v2Revealing}
                                                className="py-2 px-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                            >
                                                {v2Revealing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trophy className="w-3.5 h-3.5" />}
                                                {question.answerRevealed ? 'Show answer again' : 'Sets this question’s score to 0 — confirm?'}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setV2ArmedReveal('answer')}
                                                className="py-2 px-3 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-xl text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                            >
                                                <Trophy className="w-3.5 h-3.5" /> {question.answerRevealed ? 'Answer (revealed)' : 'Show Answer'}
                                            </button>
                                        )
                                    )}
                                </div>
                                {v2HintTaken && question.hint && (
                                    <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 animate-in fade-in zoom-in-95 duration-300">
                                        <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <HelpCircle className="w-3.5 h-3.5" /> Hint <span className="normal-case font-semibold text-amber-500/70">(score halved)</span>
                                        </p>
                                        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans italic">
                                            {renderQuestionText(question.hint, 'v2-hint-text')}
                                        </div>
                                    </div>
                                )}
                                {v2AnswerTaken && (
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in zoom-in-95 duration-300 space-y-3">
                                        <p className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                                            <Trophy className="w-3.5 h-3.5" /> Answer <span className="normal-case font-semibold text-primary/70">(score set to 0)</span>
                                        </p>
                                        {v2AnswerTaken.correctAnswerText && (
                                            <div className="text-sm font-mono font-bold text-slate-900 dark:text-slate-100">
                                                <FormattedMessage content={v2AnswerTaken.correctAnswerText} />
                                            </div>
                                        )}
                                        {v2AnswerTaken.explanation && renderFormattedExplanation(v2AnswerTaken.explanation)}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. SUBMIT BUTTON (Hidden after result) */}
                        {!result && (
                            <button
                                id="tutorial-ogcode-submit"
                                onClick={doSubmit}
                                disabled={isSubmitting || (
                                    qType === 'mcq' ? selectedOption === null :
                                        qType === 'msq' ? selectedOptions.length === 0 :
                                            qType === 'matrix_match' ? matrixPairs.length === 0 :
                                                qType === 'range' ? (!rangeFrom || !rangeTo) :
                                                    !answerInput
                                )}
                                className="w-full py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:hover:translate-y-0 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                            >
                                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                                Submit Answer
                            </button>
                        )}

                        {/* 3. RESULT SECTION (Appears immediately below after submit) */}
                        {result && (
                            <div className={`neu-raised p-5 rounded-2xl border-2 animate-in fade-in slide-in-from-top-4 duration-300
                                ${result.isCorrect ? 'border-emerald-500/30' : 'border-rose-500/30'}
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

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                                    <div className="neu-inset rounded-xl px-3 py-2 min-h-[3.5rem]">
                                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">Result Score</p>
                                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                                            {result.resultScore ?? 0}
                                            <span className="ml-1 text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-500">/ {result.maxPoints ?? result.basePoints ?? 0}</span>
                                        </p>
                                    </div>
                                    <div ref={pointsEarnedRef} className="neu-inset rounded-xl px-3 py-2 min-h-[3.5rem]">
                                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">Points Earned</p>
                                        <p className={`text-base sm:text-lg font-black ${(result.pointsAwarded ?? 0) < 0 ? 'text-rose-400' : result.pointsAwarded ? 'text-amber-400' : 'text-slate-400'}`}>
                                            {(result.pointsAwarded ?? 0) >= 0 ? '+' : ''}{result.pointsAwarded ?? 0}
                                        </p>
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 neu-inset rounded-xl px-3 py-2 min-h-[3.5rem]">
                                        <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">Speed Rating</p>
                                        <p className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 uppercase tracking-tighter">
                                            {result.speedBand ? SPEED_BAND_LABELS[result.speedBand] : 'Recorded'}
                                        </p>
                                        {typeof result.targetTimeSeconds === 'number' && (
                                            <p className="text-[9px] sm:text-[11px] text-slate-500">
                                                Target {Math.floor(result.targetTimeSeconds / 60)}m {result.targetTimeSeconds % 60}s
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Scoring V2 breakdown — the engine's own reasons, human-readable */}
                                {result.scoreReasons && result.scoreReasons.length > 0 && (
                                    <div className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 neu-inset rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold">
                                        <span className="mr-1 text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">How</span>
                                        {result.scoreReasons.map((reason) => (
                                            <span key={reason} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-slate-600 dark:text-slate-300">
                                                {reason.replace(/_/g, ' ')}
                                            </span>
                                        ))}
                                        <span className="text-slate-400">=</span>
                                        <span className={(result.resultScore ?? 0) < 0 ? 'text-rose-400' : 'text-emerald-500'}>{result.resultScore ?? 0} pts</span>
                                {typeof result.attemptsUsed === 'number' && result.attemptsUsed > 1 && (
                                            <span className="ml-auto font-semibold normal-case text-slate-500">{result.attemptsUsed} attempts</span>
                                        )}
                                    </div>
                                )}

                                {/* §9 global-stats comparison messages */}
                                {result.statsMessage && (() => {
                                    const s = result.statsMessage;
                                    const lines: { key: string; icon: string; text: string }[] = [];
                                    if (s.isFirstEver) {
                                        lines.push({ key: 'first', icon: '🌱', text: "You're the first to attempt this!" });
                                    } else {
                                        if (result.isCorrect && typeof s.fasterThanPercent === 'number') {
                                            lines.push({ key: 'speed', icon: '⚡', text: `You solved this faster than ${s.fasterThanPercent}% of everyone` });
                                        }
                                        if (result.isCorrect && (result.attemptsUsed ?? 1) === 1 && typeof s.neededRetryPercent === 'number' && s.neededRetryPercent > 0) {
                                            lines.push({ key: 'firsttry', icon: '🎯', text: `Correct on your first attempt — ${s.neededRetryPercent}% of students needed a retry` });
                                        }
                                        lines.push({ key: 'accept', icon: '📊', text: `Global acceptance rate: ${s.acceptanceRate}%` });
                                    }
                                    return (
                                        <div className="mb-4 space-y-1.5">
                                            {lines.map((l) => (
                                                <div key={l.key} className="flex items-center gap-2 neu-inset rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    <span className="shrink-0">{l.icon}</span>
                                                    <span>{l.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Scoring breakdown — mirrors the "Base × Speed + 5" modal */}
                                {result.isCorrect && typeof result.basePoints === 'number' && typeof result.speedMultiplier === 'number' && (
                                    <div className="mb-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 neu-inset rounded-xl px-3 py-2 text-[11px] sm:text-xs font-bold">
                                        <span className="mr-1 text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500">How</span>
                                        <span className="text-slate-900 dark:text-slate-100">{result.basePoints}</span>
                                        <span className="font-medium text-slate-400">base</span>
                                        <span className="text-slate-400">×</span>
                                        <span className="text-primary">{result.speedMultiplier.toFixed(2)}×</span>
                                        <span className="font-medium text-slate-400">speed</span>
                                        <span className="text-slate-400">+ 5</span>
                                        <span className="text-slate-400">=</span>
                                        <span className="text-emerald-500">{result.resultScore ?? 0} pts</span>
                                        {result.already_solved && (
                                            <span className="ml-auto font-semibold normal-case text-amber-400/90">Already solved — counts once, no new points</span>
                                        )}
                                    </div>
                                )}

                                {result.isCorrect ? (
                                    result.explanation && (
                                        <div className="pt-4 border-t border-white/5">
                                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-2">
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
                                                        className="w-full py-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                                    >
                                                        <Trophy className="w-3.5 h-3.5" /> See Full Solution
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {showHint && question.hint && (
                                            <div className="pt-4 border-t border-white/5 animate-in fade-in zoom-in-95 duration-300">
                                                <p className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <HelpCircle className="w-3.5 h-3.5" /> Hint
                                                </p>
                                                <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line font-sans italic">
                                                    {renderQuestionText(question.hint, 'hint-text')}
                                                </div>
                                            </div>
                                        )}

                                        {showSolution && (result.correctAnswerText || result.explanation) && (
                                            <div className="pt-4 border-t border-white/5 animate-in fade-in zoom-in-95 duration-300 space-y-3">
                                                <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                                                    <Trophy className="w-3.5 h-3.5" /> Full Solution
                                                </p>
                                                {correctAnswerDisplay && (
                                                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 backdrop-blur-sm">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1">Correct Answer</p>
                                                        <div className="text-sm leading-relaxed font-semibold text-slate-900 dark:text-slate-100">
                                                            <FormattedMessage content={correctAnswerDisplay} />
                                                        </div>
                                                    </div>
                                                )}
                                                {result.explanation && (
                                                    <div className="neu-inset rounded-xl px-4 py-3">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Reference Explanation</p>
                                                        {renderFormattedExplanation(result.explanation)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3 mt-6">
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

            {/* Ori points-collection animation — fixed overlay, pointer-events none */}
            <AnimatePresence>
                {oriAnim && (
                    <motion.div
                        key="ori-pts-anim"
                        style={{
                            position: 'fixed',
                            left: oriAnim.fromX - 44,
                            top: oriAnim.fromY - 44,
                            zIndex: 9999,
                            pointerEvents: 'none',
                            width: 88,
                            height: 88,
                        }}
                        initial={{ scale: 0, opacity: 0, x: 0, y: 0, rotate: 0 }}
                        animate={{
                            x: [0, 10, -8, 6, oriAnim.toX - oriAnim.fromX],
                            y: [0, -20, -30, -20, oriAnim.toY - oriAnim.fromY + 44],
                            scale: [0, 1.25, 1.1, 1.15, 0.25],
                            opacity: [0, 1, 1, 1, 0],
                            rotate: [0, -15, 12, -8, 0],
                        }}
                        transition={{
                            duration: 1.5,
                            times: [0, 0.18, 0.35, 0.52, 1],
                            ease: 'easeInOut',
                        }}
                        onAnimationComplete={() => {
                            setOriAnim(prev => {
                                if (!prev) return null;
                                setPtsPulse(true);
                                setLocalPoints((user?.points ?? 0) + prev.points);
                                setTimeout(() => setPtsPulse(false), 700);
                                return null;
                            });
                        }}
                    >
                        <Image
                            src={oriAnim.oriImg}
                            alt="Ori collecting points"
                            width={88}
                            height={88}
                            className="drop-shadow-2xl"
                            unoptimized
                        />
                        <motion.div
                            className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-[11px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-lg"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ repeat: Infinity, duration: 0.7, ease: 'easeInOut' }}
                        >
                            +{oriAnim.points} PTS
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
