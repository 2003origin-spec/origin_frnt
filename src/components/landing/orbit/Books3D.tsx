'use client';

/**
 * "Built on the books you already study": a pile of NCERT books to play with.
 *
 * Pick a book (click it, or use the list) and it comes out of the pile and its cover opens to a
 * worked example; the card beside it shows the same page as text and offers to ask Ori about it
 * (fills the hero's box).
 * "Put it back" lands it on top of the pile.
 *
 * With WebGL (any screen): the three.js pile (Books3DScene). On narrow screens the open view
 * frames the printed page alone so it stays readable; the card below has the same text.
 * Without WebGL: the same pile as CSS spines; the picked one slides out.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, X } from 'lucide-react';

import { BOOKS, putOnTop, type Book } from './books-data';
import { webglSupported } from './webgl-support';

const BooksScene = dynamic(() => import('./Books3DScene'), { ssr: false });

function askInHero(question: string) {
  document.getElementById('ask')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  window.dispatchEvent(new CustomEvent('origin:focus-doubt-box', { detail: { question } }));
}

function BookCard({ book, onClose, showWorked = true }: { book: Book; onClose: () => void; showWorked?: boolean }) {
  const others = book.chapters.filter((c) => c !== book.worked.chapter);
  return (
    <div className="landing-surface landing-bookcard relative rounded-3xl p-6" aria-live="polite">
      <button
        type="button"
        onClick={onClose}
        className="landing-ghost-btn absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full"
        aria-label="Put the book back"
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
      <h3 className="pr-12 font-heading text-2xl font-bold text-foreground">{book.title}</h3>

      {/* The page the cover opens to (drawn in 3D), as text for everyone. Without 3D the
          open book beside this card already shows it as text. */}
      {showWorked ? (
      <div className="landing-worked mt-4 rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--orbit-ori)' }}>
          Worked example · {book.worked.chapter}
        </p>
        <p className="mt-2 text-[15px] font-semibold text-foreground">{book.worked.question}</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-[15px] text-[var(--lg-muted-foreground)]">
          {book.worked.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-2 text-[15px] font-bold text-foreground">Answer: {book.worked.answer}</p>
      </div>
      ) : null}

      <p className="mt-4 text-sm text-[var(--lg-muted-foreground)]">
        Also in this book: {others.slice(0, 3).join(', ')}.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => askInHero(book.worked.question)}
          className="landing-primary-btn inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-[15px] font-bold"
        >
          Ask Ori about this <ArrowRight aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="landing-ghost-btn inline-flex min-h-12 items-center rounded-full px-5 text-[15px] font-semibold">
          Put it back
        </button>
      </div>
    </div>
  );
}

/** The book list as buttons: keyboard and screen-reader access to the pile, and a hint. */
function PickList({ books, onPick }: { books: Book[]; onPick: (i: number) => void }) {
  return (
    <div className="landing-surface rounded-3xl p-6">
      <p className="font-heading text-xl font-bold text-foreground">Pick a book from the pile</p>
      <p className="mt-1 text-sm text-[var(--lg-muted-foreground)]">See what is inside, then ask Ori a doubt from it.</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {books.map((b, i) => (
          <li key={b.cover}>
            <button
              type="button"
              onClick={() => onPick(i)}
              className="landing-ghost-btn inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
              {b.title.replace('NCERT ', '')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The open book without WebGL: a paper spread in the pile's place. Left page: the book's name
 * and chapters; right page: the worked example. The cover (the real cover image) swings open
 * on the spine as it appears. Phones show the right-hand page only.
 */
function CssOpenBook({ book }: { book: Book }) {
  return (
    <div className="landing-openbook" aria-live="polite">
      <div className="landing-openbook__spread">
        <div className="landing-openbook__page landing-openbook__page--left" aria-hidden="true">
          <p className="landing-openbook__kicker" style={{ color: book.color }}>
            NCERT
          </p>
          <p className="landing-openbook__title">{book.title.replace('NCERT ', '')}</p>
          <p className="landing-openbook__label">In this book</p>
          <ul className="landing-openbook__chapters">
            {book.chapters.map((c) => (
              <li key={c} className={c === book.worked.chapter ? 'is-on' : ''} style={c === book.worked.chapter ? { color: book.color } : undefined}>
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="landing-openbook__page landing-openbook__page--right">
          <p className="landing-openbook__kicker" style={{ color: book.color }}>
            {book.worked.chapter}
          </p>
          <p className="landing-openbook__title">Worked example</p>
          <p className="landing-openbook__q">{book.worked.question}</p>
          <ol className="landing-openbook__steps">
            {book.worked.steps.map((st) => (
              <li key={st}>{st}</li>
            ))}
          </ol>
          <p className="landing-openbook__answer">Answer: {book.worked.answer}</p>
        </div>
        {/* Two paper leaves riffle over after the cover (drawn under it, so the cover goes first) */}
        <div className="landing-openbook__leaf landing-openbook__leaf--2" aria-hidden="true" />
        <div className="landing-openbook__leaf landing-openbook__leaf--1" aria-hidden="true" />
        {/* The paperback cover: starts closed over the right page and turns on the spine */}
        <div className="landing-openbook__cover" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={book.cover} alt="" className="landing-openbook__cover-front" />
          <span className="landing-openbook__cover-back" />
        </div>
      </div>
    </div>
  );
}

/** CSS pile for phones, tablets and no WebGL: spines stacked; the picked one slides out. */
function CssPile({ books, order, selected, onPick }: { books: Book[]; order: number[]; selected: number | null; onPick: (i: number) => void }) {
  // Drawn top-first, so the last book put back sits at the top.
  const shown = [...order].reverse();
  return (
    <div className="landing-pile" aria-hidden="true">
      {shown.map((i, n) => (
        <button
          key={books[i].cover}
          type="button"
          tabIndex={-1}
          onClick={() => onPick(i)}
          className={`landing-pile__book ${selected === i ? 'is-out' : ''}`}
          style={{ background: books[i].color, '--tilt': `${(n % 2 ? 1 : -1) * (0.6 + (n % 3) * 0.4)}deg` } as React.CSSProperties}
        >
          <span className="landing-pile__ncert">NCERT</span>
          <span className="landing-pile__title">{books[i].spine}</span>
        </button>
      ))}
    </div>
  );
}

export default function Books3D() {
  const [webgl, setWebgl] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  // The phone pile's order (the 3D pile keeps its own, by the same rules).
  const [order, setOrder] = useState<number[]>(() => BOOKS.map((_, i) => i));
  const onFail = useCallback(() => setWebgl(false), []);
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D wherever WebGL works (phones and tablets too); CSS books only without it. Checked once.
  useEffect(() => setWebgl(webglSupported()), []);

  const select = useCallback(
    (i: number | null) => {
      // The phone pile keeps a picked book in its place while it is out; putting it back
      // (or picking another) lands it on top, the same rule as the 3D pile.
      if (selected !== null && selected !== i) setOrder((o) => putOnTop(o, selected));
      setSelected(i);
      // Without 3D the card is where the book "opens": bring it into view. (With 3D the open
      // book is in the stage itself, and the card sits just below it.)
      if (i !== null && !webgl) {
        window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      }
    },
    [selected, webgl],
  );

  // Esc puts the book back.
  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, select]);

  const book = selected !== null ? BOOKS[selected] : null;

  return (
    <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div>
        {webgl ? (
          <BooksScene books={BOOKS} selected={selected} onSelect={select} onFail={onFail} />
        ) : (
          book ? (
            <CssOpenBook key={book.cover} book={book} />
          ) : (
            <CssPile books={BOOKS} order={order} selected={selected} onPick={(i) => select(selected === i ? null : i)} />
          )
        )}
      </div>
      <div ref={cardRef} className="scroll-mt-28">{book ? <BookCard book={book} onClose={() => select(null)} showWorked={webgl} /> : <PickList books={BOOKS} onPick={select} />}</div>
    </div>
  );
}
