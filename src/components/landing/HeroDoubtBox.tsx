'use client';

/**
 * The landing hero's working doubt box: the visitor types (or says) a JEE/NEET question and
 * Ori's answer appears in place. Uses the existing public endpoint /api/public/demo-solve and
 * its weekly limit (5 typed + 3 voice questions per visitor). Rules: src/features/landing-demo.
 *
 * States: ready → solving → answer | solved example (service could not answer) | limit reached.
 * The answer is revealed a few words at a time (instantly under reduced motion).
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight, Loader2, Mic, Square } from 'lucide-react';

import { FormattedMessage } from '@/components/origin-ai/FormattedMessage';
import { trackEvent } from '@/lib/analytics';
import {
  CLIENT_TIMEOUT_MS,
  SUBJECTS,
  pickQuestion,
  TYPING_PROMPTS,
  SOLVED_EXAMPLE,
  TEXT_LIMIT,
  allUsed,
  canAsk,
  checkQuestion,
  parseUsage,
  questionsLeft,
  readOutcome,
  recordAsk,
  revealChunks,
  typingFrame,
  weekKey,
  type AskSource,
  type ExamTrack,
  type Subject,
  type Usage,
} from '@/features/landing-demo/demo';

type Phase =
  | { kind: 'ready' }
  | { kind: 'solving'; question: string }
  | { kind: 'answer'; question: string; answer: string }
  | { kind: 'example' }
  | { kind: 'limit' };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const TRACK_KEY = 'origin-landing-track';

function readUsage(): Usage {
  try {
    return parseUsage(window.localStorage.getItem(weekKey()));
  } catch {
    return { text: 0, voice: 0 };
  }
}

function saveUsage(usage: Usage) {
  try {
    window.localStorage.setItem(weekKey(), JSON.stringify(usage));
  } catch {
    // Storage blocked: the server's own weekly limit still applies.
  }
}

type Props = {
  /** Sign-up flow (the landing page's "get started" routing). */
  onSignUp: () => void;
  /** A slot under the box for the second hero button ("Get the Android app"). */
  secondary?: React.ReactNode;
};

export default function HeroDoubtBox({ onSignUp, secondary }: Props) {
  const reduceMotion = useReducedMotion();
  const ids = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const transcriptRef = useRef('');
  const revealTimer = useRef<number | null>(null);

  const [track, setTrack] = useState<ExamTrack>('jee');
  const [input, setInput] = useState('');
  const [usage, setUsage] = useState<Usage>({ text: 0, voice: 0 });
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' });
  const [shown, setShown] = useState('');
  const [hint, setHint] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  // A question types itself into the empty box to show what to ask. Stops while the visitor
  // is in the box, once they type, under reduced motion, and while the box is off screen.
  const [focused, setFocused] = useState(false);
  const lastPicked = useRef<string | null>(null);
  const [typed, setTyped] = useState('');
  const [boxVisible, setBoxVisible] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = readUsage();
    setUsage(u);
    if (allUsed(u)) setPhase({ kind: 'limit' });
    setVoiceOk(recognitionCtor() !== null);
    try {
      const t = window.localStorage.getItem(TRACK_KEY);
      if (t === 'jee' || t === 'neet') setTrack(t);
    } catch {
      // keep the default
    }
  }, []);

  useEffect(
    () => () => {
      if (revealTimer.current !== null) window.clearInterval(revealTimer.current);
      recognitionRef.current?.stop();
    },
    [],
  );

  // Other boxes on the page ("Ask a doubt free" in the nav and the closing screen) focus this
  // one through a custom event, so the action reads the same everywhere and lands here.
  useEffect(() => {
    const focusBox = (e: Event) => {
      const question = (e as CustomEvent<{ question?: string }>).detail?.question;
      setPhase((p) => (p.kind === 'answer' || p.kind === 'example' ? { kind: 'ready' } : p));
      if (question) setInput(question);
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    };
    window.addEventListener('origin:focus-doubt-box', focusBox);
    return () => window.removeEventListener('origin:focus-doubt-box', focusBox);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setBoxVisible(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const typingOn = !reduceMotion && !focused && boxVisible && input === '' && phase.kind === 'ready';
  useEffect(() => {
    if (!typingOn) {
      setTyped('');
      return;
    }
    const start = performance.now();
    const prompts = TYPING_PROMPTS[track];
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      setTyped(typingFrame(prompts, performance.now() - start));
    }, 40);
    return () => window.clearInterval(id);
  }, [typingOn, track]);

  const chooseTrack = (t: ExamTrack) => {
    setTrack(t);
    try {
      window.localStorage.setItem(TRACK_KEY, t);
    } catch {
      // fine
    }
  };

  const reveal = useCallback(
    (answer: string) => {
      if (revealTimer.current !== null) window.clearInterval(revealTimer.current);
      if (reduceMotion) {
        setShown(answer);
        return;
      }
      const chunks = revealChunks(answer, 5);
      let i = 0;
      setShown(chunks[0] ?? answer);
      revealTimer.current = window.setInterval(() => {
        i += 1;
        if (i >= chunks.length) {
          if (revealTimer.current !== null) window.clearInterval(revealTimer.current);
          revealTimer.current = null;
          return;
        }
        setShown(chunks[i]);
      }, 45);
    },
    [reduceMotion],
  );

  const ask = useCallback(
    async (raw: string, source: AskSource) => {
      if (phase.kind === 'solving') return;
      const check = checkQuestion(raw);
      if (!check.ok) {
        setHint(check.reason === 'short' ? 'Type a little more of the question.' : 'Keep the question under 500 characters.');
        return;
      }
      const current = readUsage();
      if (!canAsk(current, source)) {
        if (source === 'voice' && canAsk(current, 'typed')) {
          setHint('Voice questions are used up for this week. You can still type one.');
          return;
        }
        setUsage(current);
        setPhase({ kind: 'limit' });
        trackEvent('landing_demo_result', { action: 'limit' });
        return;
      }
      setHint('');
      const next = recordAsk(current, source);
      saveUsage(next);
      setUsage(next);
      setPhase({ kind: 'solving', question: check.question });
      trackEvent('landing_demo_ask', { source });

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);
      let outcome: ReturnType<typeof readOutcome>;
      try {
        const res = await fetch('/api/public/demo-solve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: check.question, hp: '' }),
          signal: controller.signal,
        });
        let body: unknown = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }
        outcome = readOutcome(res.status, body);
      } catch {
        outcome = { kind: 'fallback' };
      } finally {
        window.clearTimeout(timer);
      }

      if (outcome.kind === 'rejected') {
        // The server refused it before counting it, so give the question back.
        saveUsage(current);
        setUsage(current);
        setPhase({ kind: 'ready' });
        setInput(check.question);
        setHint('Ori could not take that question. Try asking it another way.');
        return;
      }
      trackEvent('landing_demo_result', { action: outcome.kind === 'answer' ? 'answer' : outcome.kind });
      if (outcome.kind === 'limit') {
        setPhase({ kind: 'limit' });
        return;
      }
      if (outcome.kind === 'fallback') {
        setPhase({ kind: 'example' });
        reveal(SOLVED_EXAMPLE.answer);
        return;
      }
      setInput('');
      setPhase({ kind: 'answer', question: check.question, answer: outcome.answer });
      reveal(outcome.answer);
    },
    [phase.kind, reveal],
  );

  const startVoice = () => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (!canAsk(readUsage(), 'voice')) {
      setHint('Voice questions are used up for this week. You can still type one.');
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false;
    transcriptRef.current = '';
    rec.onresult = (ev) => {
      let t = '';
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0]?.transcript ?? '';
      transcriptRef.current = t;
      setInput(t);
    };
    rec.onend = () => {
      setListening(false);
      const t = transcriptRef.current.trim();
      if (t) void ask(t, 'voice');
    };
    rec.onerror = () => {
      setListening(false);
      setHint('Ori could not hear that. Check the microphone, or type the question.');
    };
    recognitionRef.current = rec;
    setHint('');
    setListening(true);
    rec.start();
  };

  const stopVoice = () => recognitionRef.current?.stop();

  const reset = () => {
    if (revealTimer.current !== null) window.clearInterval(revealTimer.current);
    setShown('');
    setPhase(allUsed(readUsage()) ? { kind: 'limit' } : { kind: 'ready' });
    window.setTimeout(() => inputRef.current?.focus(), 30);
  };

  const left = questionsLeft(usage, 'typed');
  const solving = phase.kind === 'solving';
  const fact =
    usage.text === 0 && usage.voice === 0
      ? '5 free questions a week, no account needed'
      : `${left} of ${TEXT_LIMIT} free questions left this week`;

  return (
    <div id="ask" ref={boxRef} className="w-full scroll-mt-28">
      <div className="landing-surface relative overflow-hidden rounded-3xl p-4 text-left sm:p-5">
        {/* Exam switch + the one hard fact */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Exam" className="landing-segment inline-flex rounded-full p-1">
            {(['jee', 'neet'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={track === t}
                onClick={() => chooseTrack(t)}
                className="landing-segment__item min-h-11 rounded-full px-5 text-sm font-bold"
              >
                {t === 'jee' ? 'JEE' : 'NEET'}
              </button>
            ))}
          </div>
          <p className="text-sm text-[var(--lg-muted-foreground)]">{fact}</p>
        </div>

        {phase.kind === 'limit' ? (
          <div className="flex flex-col items-start gap-3 py-2" aria-live="polite">
            <p className="font-heading text-xl font-bold text-foreground">You have used this week&apos;s free questions.</p>
            <p className="text-[15px] leading-relaxed text-[var(--lg-muted-foreground)]">
              Create a free account to ask Ori as many questions as you like, by typing or by voice.
            </p>
            <button
              type="button"
              onClick={() => {
                trackEvent('auth_cta_click', { action: 'sign_up', source: 'landing_demo', placement: 'landing' });
                onSignUp();
              }}
              className="landing-primary-btn mt-1 inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-bold"
            >
              Create a free account <ArrowRight aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ) : phase.kind === 'answer' || phase.kind === 'example' ? (
          <div aria-live="polite">
            <p className="mb-3 text-sm font-semibold text-[var(--lg-muted-foreground)]">
              {phase.kind === 'example'
                ? 'Ori is busy right now. Here is a question Ori solved earlier:'
                : 'You asked:'}
            </p>
            <p className="mb-3 rounded-2xl bg-[var(--lgx-fill-inset)] px-4 py-3 text-[15px] font-semibold text-foreground">
              {phase.kind === 'example' ? SOLVED_EXAMPLE.question : phase.question}
            </p>
            <div className="flex gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ori2d/ori-happy.png" alt="" className="mt-0.5 h-9 w-9 shrink-0 object-contain" />
              <div className="landing-answer max-h-[340px] min-w-0 flex-1 overflow-y-auto pr-1">
                <FormattedMessage content={shown} className="text-[15px] leading-relaxed text-foreground" />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={reset}
                className="landing-primary-btn inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-bold"
              >
                Ask another doubt <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input, 'typed');
            }}
          >
            <label htmlFor={`${ids}-q`} className="sr-only">
              Your {track === 'jee' ? 'JEE' : 'NEET'} doubt
            </label>
            <textarea
              id={`${ids}-q`}
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (hint) setHint('');
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input, 'typed');
                }
              }}
              rows={2}
              maxLength={500}
              disabled={solving}
              placeholder={
                typingOn && typed
                  ? `${typed}|`
                  : track === 'jee'
                    ? 'Type a Physics, Chemistry or Maths doubt…'
                    : 'Type a Biology, Chemistry or Physics doubt…'
              }
              className="landing-input block w-full resize-none rounded-2xl px-4 py-3 text-base leading-relaxed"
            />

            {solving ? (
              <div className="mt-3 flex items-center gap-3 text-[15px] text-[var(--lg-muted-foreground)]" aria-live="polite">
                <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Ori is solving it step by step…
              </div>
            ) : null}

            {hint ? (
              <p className="mt-2 text-sm text-[var(--orbit-nova)]" role="status">
                {hint}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={solving}
                className="landing-primary-btn inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-[15px] font-bold disabled:opacity-60"
              >
                Ask a doubt free <ArrowRight aria-hidden className="h-4 w-4" />
              </button>
              {voiceOk ? (
                <button
                  type="button"
                  onClick={listening ? stopVoice : startVoice}
                  disabled={solving}
                  aria-pressed={listening}
                  className="landing-ghost-btn inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-[15px] font-semibold disabled:opacity-60"
                >
                  {listening ? <Square aria-hidden className="h-4 w-4" /> : <Mic aria-hidden className="h-4 w-4" />}
                  {listening ? 'Stop' : 'Ask by voice'}
                </button>
              ) : null}
            </div>

            {/* Subjects: a tap asks Ori a random question from that subject at once */}
            <div className="mt-4 border-t border-[var(--lgx-border)] pt-3">
              <p className="mb-2 text-sm text-[var(--lg-muted-foreground)]">Or tap a subject for a random question:</p>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={solving}
                    onClick={() => {
                      const q = pickQuestion(id as Subject, lastPicked.current);
                      lastPicked.current = q;
                      setInput(q);
                      void ask(q, 'example');
                    }}
                    className={`landing-subject landing-subject--${id} inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold disabled:opacity-60`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}
      </div>
      {secondary ? <div className="mt-4 flex flex-wrap items-center gap-3">{secondary}</div> : null}
    </div>
  );
}
