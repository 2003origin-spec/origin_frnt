import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SUBJECTS,
  SUBJECT_QUESTIONS,
  pickQuestion,
  SOLVED_EXAMPLE,
  TEXT_LIMIT,
  VOICE_LIMIT,
  allUsed,
  canAsk,
  checkQuestion,
  isServerFallback,
  parseUsage,
  questionsLeft,
  readOutcome,
  recordAsk,
  revealChunks,
  weekKey,
} from '../../src/features/landing-demo/demo';

test('weekKey keeps the older demo format, so a visitor\'s count carries over', () => {
  assert.match(weekKey(new Date(2026, 10, 16)), /^origin-demo-2026-W\d{1,2}$/);
  assert.equal(weekKey(new Date(2026, 10, 16)), weekKey(new Date(2026, 10, 16, 23, 59)));
});

test('parseUsage survives missing, broken and hostile stored values', () => {
  assert.deepEqual(parseUsage(null), { text: 0, voice: 0 });
  assert.deepEqual(parseUsage('not json'), { text: 0, voice: 0 });
  assert.deepEqual(parseUsage('{"text":-3,"voice":"9"}'), { text: 0, voice: 0 });
  assert.deepEqual(parseUsage('{"text":2.7,"voice":1}'), { text: 2, voice: 1 });
});

test('quota: 5 typed and 3 voice questions a week, counted separately', () => {
  let usage = { text: 0, voice: 0 };
  for (let i = 0; i < TEXT_LIMIT; i++) {
    assert.ok(canAsk(usage, 'typed'));
    usage = recordAsk(usage, 'typed');
  }
  assert.equal(canAsk(usage, 'typed'), false);
  assert.equal(canAsk(usage, 'example'), false, 'tapping an example spends a typed question');
  assert.equal(questionsLeft(usage, 'voice'), VOICE_LIMIT);
  assert.equal(allUsed(usage), false);
  for (let i = 0; i < VOICE_LIMIT; i++) usage = recordAsk(usage, 'voice');
  assert.equal(allUsed(usage), true);
  assert.equal(questionsLeft(usage, 'voice'), 0);
});

test('checkQuestion mirrors the server bounds', () => {
  assert.deepEqual(checkQuestion('  hi '), { ok: false, reason: 'short' });
  assert.deepEqual(checkQuestion('x'.repeat(501)), { ok: false, reason: 'long' });
  assert.deepEqual(checkQuestion('  What is a mole?  '), { ok: true, question: 'What is a mole?' });
});

test('readOutcome: a real answer, the limit, a refused question and every failure path', () => {
  assert.deepEqual(readOutcome(200, { answer: ' Use v² = u² + 2as. ' }), { kind: 'answer', answer: 'Use v² = u² + 2as.' });
  assert.deepEqual(readOutcome(429, { error: 'Weekly preview limit reached.' }), { kind: 'limit' });
  assert.deepEqual(readOutcome(400, { error: 'Question too short' }), { kind: 'rejected' });
  assert.deepEqual(readOutcome(500, null), { kind: 'fallback' });
  assert.deepEqual(readOutcome(503, { answer: 'x' }), { kind: 'fallback' });
  assert.deepEqual(readOutcome(200, { answer: '' }), { kind: 'fallback' });
  assert.deepEqual(readOutcome(200, { answer: 42 }), { kind: 'fallback' });
  assert.deepEqual(readOutcome(200, 'not an object'), { kind: 'fallback' });
});

test('the server\'s canned text counts as a fallback, a real answer does not', () => {
  const canned = '**Answer:** Ori would solve this step-by-step with full explanations, diagrams, and follow-up insights.';
  assert.equal(isServerFallback(canned), true);
  assert.deepEqual(readOutcome(200, { answer: canned }), { kind: 'fallback' });
  assert.equal(isServerFallback(SOLVED_EXAMPLE.answer), false);
});

test('subjects: all four, five questions each, all within the server bounds', () => {
  assert.deepEqual(SUBJECTS.map((x) => x.id), ['physics', 'chemistry', 'maths', 'biology']);
  for (const { id } of SUBJECTS) {
    assert.equal(SUBJECT_QUESTIONS[id].length, 5, id);
    for (const q of SUBJECT_QUESTIONS[id]) assert.equal(checkQuestion(q).ok, true, q);
  }
});

test('pickQuestion is random within the subject and never repeats the last one', () => {
  assert.equal(pickQuestion('biology', null, () => 0), SUBJECT_QUESTIONS.biology[0]);
  assert.equal(pickQuestion('biology', null, () => 0.999), SUBJECT_QUESTIONS.biology[4]);
  const last = SUBJECT_QUESTIONS.maths[0];
  for (let i = 0; i < 50; i++) {
    const q = pickQuestion('maths', last);
    assert.notEqual(q, last);
    assert.ok(SUBJECT_QUESTIONS.maths.includes(q));
  }
});

test('revealChunks grows to the full answer and never cuts a formula', () => {
  const answer = 'Use $a = \\dfrac{g\\sin\\theta}{1 + I/mR^2}$ for a rolling body, then put in the numbers.';
  const chunks = revealChunks(answer, 2);
  assert.equal(chunks[chunks.length - 1], answer);
  for (let i = 1; i < chunks.length; i++) assert.ok(chunks[i].startsWith(chunks[i - 1].trimEnd()) || chunks[i].startsWith(chunks[i - 1]));
  for (const c of chunks) assert.equal((c.match(/\$/g) ?? []).length % 2, 0, `unbalanced $ in: ${c}`);
  assert.deepEqual(revealChunks(''), ['']);
});

test('typingFrame types a prompt, holds it, erases it, then moves to the next', async () => {
  const { typingFrame, TYPING, TYPING_PROMPTS } = await import('../../src/features/landing-demo/demo');
  const prompts = ['Why?', 'How so?'];
  assert.equal(typingFrame(prompts, 0), 'W');
  assert.equal(typingFrame(prompts, TYPING.type * 2 + 1), 'Why');
  const typed = 4 * TYPING.type;
  assert.equal(typingFrame(prompts, typed + 10), 'Why?', 'holds the full prompt');
  assert.equal(typingFrame(prompts, typed + TYPING.hold + 1), 'Why', 'then erases');
  const first = typed + TYPING.hold + 4 * TYPING.erase + TYPING.gap;
  assert.equal(typingFrame(prompts, first + 1), 'H', 'next prompt starts');
  const total = first + 7 * TYPING.type + TYPING.hold + 7 * TYPING.erase + TYPING.gap;
  assert.equal(typingFrame(prompts, total + 1), 'W', 'loops back to the first');
  assert.equal(typingFrame([], 500), '');
  for (const track of ['jee', 'neet'] as const) {
    assert.ok(TYPING_PROMPTS[track].length >= 3);
    for (const p of TYPING_PROMPTS[track]) assert.ok(p.length <= 70, `fits on one line: ${p}`);
  }
});

test('book pile: taking a book out and putting it back lands it on top', async () => {
  const { BOOKS, putOnTop, takeFromPile } = await import('../../src/components/landing/orbit/books-data');
  const pile = [0, 1, 2, 3, 4, 5];
  assert.deepEqual(takeFromPile(pile, 2), [0, 1, 3, 4, 5]);
  assert.deepEqual(putOnTop(takeFromPile(pile, 2), 2), [0, 1, 3, 4, 5, 2]);
  assert.deepEqual(putOnTop(pile, 5), pile, 'the top book stays on top');
  assert.equal(BOOKS.length, 6);
  for (const b of BOOKS) {
    assert.equal(b.chapters.length, 5, b.title);
    assert.match(b.color, /^#[0-9a-f]{6}$/i);
    assert.ok(b.cover.endsWith('.webp'));
  }
});

test('every book opens to a worked example from one of its own chapters', async () => {
  const { BOOKS } = await import('../../src/components/landing/orbit/books-data');
  const { checkQuestion } = await import('../../src/features/landing-demo/demo');
  for (const b of BOOKS) {
    assert.ok(b.chapters.includes(b.worked.chapter), `${b.title}: ${b.worked.chapter}`);
    assert.equal(checkQuestion(b.worked.question).ok, true, 'askable in the hero box');
    assert.ok(b.worked.steps.length >= 1 && b.worked.steps.length <= 3);
    assert.ok(b.worked.answer.length > 0);
  }
});
