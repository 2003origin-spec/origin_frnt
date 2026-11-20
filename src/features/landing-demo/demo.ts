/**
 * Landing-page doubt box: the pure rules behind the hero's "Ask a doubt free" demo.
 *
 * The demo calls the existing public endpoint POST /api/public/demo-solve (5 text + 3 voice
 * questions a week per visitor; the server caps an IP at 8 a week). This module holds
 * everything that can be tested without a browser: the weekly quota, how a response is read,
 * and the example questions. UI lives in src/components/landing/HeroDoubtBox.tsx.
 */

export const TEXT_LIMIT = 5;
export const VOICE_LIMIT = 3;
/** Same bounds the server enforces (route.ts MAX_QUESTION_LEN and its "too short" check). */
export const MIN_QUESTION_LEN = 5;
export const MAX_QUESTION_LEN = 500;
/** The server waits up to 30 s for the AI service; the visitor should not. */
export const CLIENT_TIMEOUT_MS = 20_000;

export type ExamTrack = 'jee' | 'neet';
export type AskSource = 'typed' | 'example' | 'voice';
export type Usage = { text: number; voice: number };

/**
 * Week key for the quota in localStorage. The format matches the one the older landing demo
 * (TryOriginAI) used, so a visitor's count carries over instead of resetting.
 */
export function weekKey(date: Date = new Date()): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((date.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7,
  );
  return `origin-demo-${date.getFullYear()}-W${week}`;
}

export function parseUsage(raw: string | null): Usage {
  if (!raw) return { text: 0, voice: 0 };
  try {
    const v = JSON.parse(raw) as Partial<Usage>;
    const text = Number.isFinite(v.text) ? Math.max(0, Math.floor(v.text as number)) : 0;
    const voice = Number.isFinite(v.voice) ? Math.max(0, Math.floor(v.voice as number)) : 0;
    return { text, voice };
  } catch {
    return { text: 0, voice: 0 };
  }
}

export function questionsLeft(usage: Usage, source: AskSource): number {
  return source === 'voice'
    ? Math.max(0, VOICE_LIMIT - usage.voice)
    : Math.max(0, TEXT_LIMIT - usage.text);
}

export function canAsk(usage: Usage, source: AskSource): boolean {
  return questionsLeft(usage, source) > 0;
}

export function recordAsk(usage: Usage, source: AskSource): Usage {
  return source === 'voice'
    ? { ...usage, voice: usage.voice + 1 }
    : { ...usage, text: usage.text + 1 };
}

/** Both kinds used up: the box shows the sign-up state instead of the input. */
export function allUsed(usage: Usage): boolean {
  return usage.text >= TEXT_LIMIT && usage.voice >= VOICE_LIMIT;
}

export type QuestionCheck = { ok: true; question: string } | { ok: false; reason: 'short' | 'long' };

export function checkQuestion(raw: string): QuestionCheck {
  const question = raw.trim();
  if (question.length < MIN_QUESTION_LEN) return { ok: false, reason: 'short' };
  if (question.length > MAX_QUESTION_LEN) return { ok: false, reason: 'long' };
  return { ok: true, question };
}

/**
 * When the AI service is down, switched off, or returns nothing, the endpoint still answers
 * 200 with a generic canned text. That text is not an answer to the visitor's question, so
 * the box shows a real solved example instead. This line is in that canned text only.
 */
export const SERVER_FALLBACK_MARKER = 'Ori would solve this step-by-step';

export function isServerFallback(answer: string): boolean {
  return answer.includes(SERVER_FALLBACK_MARKER);
}

export type DemoOutcome =
  | { kind: 'answer'; answer: string }
  /** The service could not answer: show the solved example. */
  | { kind: 'fallback' }
  /** The weekly limit is reached (server 429). */
  | { kind: 'limit' }
  /** The server refused the question itself (too short, blocked words). */
  | { kind: 'rejected' };

export function readOutcome(status: number, body: unknown): DemoOutcome {
  if (status === 429) return { kind: 'limit' };
  if (status === 400) return { kind: 'rejected' };
  if (status < 200 || status >= 300) return { kind: 'fallback' };
  const answer =
    body && typeof body === 'object' && typeof (body as { answer?: unknown }).answer === 'string'
      ? ((body as { answer: string }).answer).trim()
      : '';
  if (!answer || isServerFallback(answer)) return { kind: 'fallback' };
  return { kind: 'answer', answer };
}

export type Subject = 'physics' | 'chemistry' | 'maths' | 'biology';

export const SUBJECTS: { id: Subject; label: string }[] = [
  { id: 'physics', label: 'Physics' },
  { id: 'chemistry', label: 'Chemistry' },
  { id: 'maths', label: 'Maths' },
  { id: 'biology', label: 'Biology' },
];

/**
 * Tapping a subject asks Ori one of these at random. Standard JEE/NEET-level doubts, each
 * short and within the server's length limits.
 */
export const SUBJECT_QUESTIONS: Record<Subject, string[]> = {
  physics: [
    'A solid sphere rolls without slipping down an incline of 30°. What is its acceleration?',
    'A ball is thrown straight up at 20 m/s. How high does it go? Take g = 10 m/s².',
    'Why is the escape velocity of a body independent of its mass?',
    'Why does a charged capacitor block steady direct current?',
    'How does the time period of a simple pendulum change on the Moon?',
  ],
  chemistry: [
    'Why does ethanol boil at a higher temperature than dimethyl ether?',
    'Why is SN1 faster for tertiary alkyl halides than primary ones?',
    'Why does NaCl conduct electricity only when molten or dissolved?',
    'What is the hybridisation of carbon in ethyne, and why?',
    'Why is the second ionisation energy of sodium so much higher than the first?',
  ],
  maths: [
    'Find the integral of x·eˣ with respect to x.',
    'Find the range of f(x) = x / (1 + x²).',
    'How many ways can the letters of BANANA be arranged?',
    'Find the derivative of sin(x²) with respect to x.',
    'What is the sum of the first 20 terms of 3, 7, 11, …?',
  ],
  biology: [
    'Why is the mitochondrion called the powerhouse of the cell?',
    'What is the difference between mitosis and meiosis?',
    'How does the loop of Henle help the kidney concentrate urine?',
    'Why do plants need both photosystem I and photosystem II?',
    'What ratio does a dihybrid cross give in the F2 generation, and why?',
  ],
};

/** A random question for the subject, never the same one twice in a row. */
export function pickQuestion(subject: Subject, last: string | null = null, random: () => number = Math.random): string {
  const pool = SUBJECT_QUESTIONS[subject];
  const choices = pool.length > 1 && last ? pool.filter((q) => q !== last) : pool;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

/**
 * Questions typed out, one after another, in the empty doubt box: real doubts students ask,
 * short enough to read in a glance. Only a moving placeholder; nothing is sent.
 */
export const TYPING_PROMPTS: Record<ExamTrack, string[]> = {
  jee: [
    'Why is the escape velocity independent of mass?',
    'How do I find the range of f(x) = x / (1 + x²)?',
    'Why is SN1 faster for tertiary carbocations?',
    'When do I use conservation of angular momentum?',
    'What is the trick for integration by parts?',
  ],
  neet: [
    'What is the difference between mitosis and meiosis?',
    'Why do plants need both photosystem I and II?',
    'How does the loop of Henle concentrate urine?',
    'Why does NaCl conduct electricity only when molten?',
    'What does a Punnett square for a dihybrid cross look like?',
  ],
};

/** Timing for the typed placeholder (ms). */
export const TYPING = { type: 42, erase: 18, hold: 1600, gap: 350 } as const;

/**
 * The placeholder text at a moment of the typing loop: types a prompt, holds it,
 * erases it, pauses, then the next prompt. Pure, so it can be tested without timers.
 */
export function typingFrame(prompts: string[], elapsedMs: number): string {
  if (!prompts.length) return '';
  const cycle = (p: string) => p.length * TYPING.type + TYPING.hold + p.length * TYPING.erase + TYPING.gap;
  const total = prompts.reduce((n, p) => n + cycle(p), 0);
  let t = ((elapsedMs % total) + total) % total;
  for (const p of prompts) {
    const c = cycle(p);
    if (t >= c) {
      t -= c;
      continue;
    }
    const typeEnd = p.length * TYPING.type;
    if (t < typeEnd) return p.slice(0, Math.floor(t / TYPING.type) + 1);
    if (t < typeEnd + TYPING.hold) return p;
    const eraseT = t - typeEnd - TYPING.hold;
    if (eraseT < p.length * TYPING.erase) return p.slice(0, p.length - Math.floor(eraseT / TYPING.erase) - 1);
    return '';
  }
  return '';
}

/**
 * Shown when the service cannot answer: a real, worked JEE question, so the visitor still sees
 * what Ori's answers look like. Markdown with plain-text maths (as the app shows it).
 */
export const SOLVED_EXAMPLE = {
  question: 'A solid sphere rolls without slipping down an incline of 30°. What is its acceleration?',
  answer: [
    "**Idea:** rolling splits gravity's pull between moving forward and spinning.",
    '',
    '1. For rolling without slipping, a = g sinθ / (1 + I/mR²).',
    '2. A solid sphere has I = (2/5)mR², so I/mR² = 2/5.',
    '3. With sin 30° = 1/2: a = (g/2) / (7/5) = 5g/14.',
    '',
    '**Answer:** a = 5g/14, about 3.5 m/s².',
  ].join('\n'),
} as const;

/**
 * Splits an answer into the chunks the box reveals one after another, so a long answer
 * appears progressively instead of all at once. Whole words only; a LaTeX span ($…$) is
 * never cut, so a half-revealed formula never renders broken.
 */
export function revealChunks(answer: string, wordsPerChunk = 6): string[] {
  const tokens = answer.match(/\s*\$[^$]*\$\s*|\s*\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += wordsPerChunk) {
    chunks.push(tokens.slice(0, i + wordsPerChunk).join(''));
  }
  if (chunks.length === 0 || chunks[chunks.length - 1] !== answer) chunks.push(answer);
  return chunks;
}
