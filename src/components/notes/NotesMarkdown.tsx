'use client';

/**
 * Renders an Origin Notes typed note (Markdown + LaTeX + note boxes).
 * Used by the student reader AND the admin editor preview, so what an admin
 * previews is exactly what students see. V1/NOTES_PLAN.md Appendix B.
 *
 * Safety: no rehype-raw, so raw HTML in a note is shown as text, never run;
 * react-markdown's default URL filter drops javascript: links; images must be
 * https.
 */

import { memo, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// \ce{…} chemical equations (extends the shared KaTeX instance).
import 'katex/contrib/mhchem';
import { Kalam } from 'next/font/google';
import { AlertTriangle, ChevronDown, ChevronUp, HelpCircle, Lightbulb, PenLine, Pin, Sigma, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { NOTE_KATEX_LIMITS, normaliseDisplayMath, remarkNoteBoxes, type NoteBox } from '@/lib/notes/markdown-boxes';
import { NOTE_DIGIT_CLASS, rehypeNoteDigits, splitDigits } from '@/lib/notes/note-digits';

import styles from './NotesMarkdown.module.css';

const hand = Kalam({ weight: ['400', '700'], subsets: ['latin'], display: 'swap', variable: '--font-notes-hand' });

export type NotesLook = 'notebook' | 'clean';

const BOXES: Record<NoteBox, { label: string; Icon: LucideIcon; className: string }> = {
  formula: { label: 'Formula', Icon: Sigma, className: styles.formula },
  remember: { label: 'Remember', Icon: Pin, className: styles.remember },
  trap: { label: 'Common mistake', Icon: AlertTriangle, className: styles.trap },
  tip: { label: 'Tip', Icon: Lightbulb, className: styles.tip },
  example: { label: 'Example', Icon: PenLine, className: styles.example },
  question: { label: 'Practice', Icon: HelpCircle, className: styles.question },
};

/** A display formula may shrink this far to fit its box; anything wider scrolls inside the box. */
const MIN_FORMULA_SCALE = 0.8;

/**
 * Shrinks display formulas that are a little wider than their box, so on a
 * phone students don't have to swipe sideways inside a formula. KaTeX sizes
 * everything in em, so scaling the font scales the whole formula. Hidden
 * formulas (a closed answer) measure 0 and are left for when they show.
 */
function fitFormulas(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>('.katex-display')) {
    el.style.fontSize = '';
    if (el.clientWidth === 0) continue;
    const overflow = el.scrollWidth / el.clientWidth;
    if (overflow <= 1.005) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.style.fontSize = `${size * Math.max(MIN_FORMULA_SCALE, 0.99 / overflow)}px`;
  }
}

function Answer({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open && ref.current) fitFormulas(ref.current);
  }, [open]);
  return (
    <div>
      <button type="button" className={styles.answerToggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronUp aria-hidden className="h-4 w-4" /> : <ChevronDown aria-hidden className="h-4 w-4" />}
        {open ? 'Hide answer' : 'Show answer'}
      </button>
      <div ref={ref} id={id} hidden={!open} className={styles.answer}>
        {children}
      </div>
    </div>
  );
}

/** Box titles get the same readable digits as the note text ("Practice · 1. Range"). */
function withDigits(text: string): ReactNode {
  return splitDigits(text).map((part, i) =>
    part.digits ? (
      <span key={i} className={NOTE_DIGIT_CLASS}>
        {part.text}
      </span>
    ) : (
      part.text
    ),
  );
}

function attr(props: Record<string, unknown>, name: string): string | undefined {
  const value = props[name];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

const baseComponents: Components = {
  div({ children, ...rest }) {
    const props = rest as Record<string, unknown>;
    const part = attr(props, 'data-note-part');
    if (part === 'answer') return <Answer>{children}</Answer>;
    if (part === 'question') return <div>{children}</div>;
    const box = attr(props, 'data-note-box');
    if (!box) return <div>{children}</div>;
    const meta = BOXES[box as NoteBox];
    const title = attr(props, 'data-title');
    const exam = attr(props, 'data-exam');
    const Icon = meta?.Icon ?? StickyNote;
    const label = meta?.label ?? 'Note';
    return (
      <div className={cn(styles.box, meta?.className ?? styles.unknown)} role="note" aria-label={title ? `${label}: ${title}` : label}>
        <div className={styles.boxHead}>
          <Icon aria-hidden />
          <span className={styles.boxText}>
            <span className={styles.boxLabel}>{label}</span>
            {title && <span className={styles.boxTitle}> · {withDigits(title)}</span>}
          </span>
          {exam && <span className={styles.examChip}>{exam}</span>}
        </div>
        {children}
      </div>
    );
  },
  a({ href, children }) {
    // Protocol-relative `//site` links leave the app too.
    const external = Boolean(href && /^(https?:)?\/\//iu.test(href));
    return (
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer nofollow' : undefined}>
        {children}
      </a>
    );
  },
  img({ src, alt }) {
    if (typeof src !== 'string' || !/^https:\/\//iu.test(src)) {
      return <span className="text-sm text-muted-foreground">[Image not shown: it needs an https link]</span>;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt ?? ''} loading="lazy" decoding="async" />;
  },
  table({ children }) {
    return (
      <div className={styles.tableWrap}>
        <table>{children}</table>
      </div>
    );
  },
};

const REMARK_PLUGINS = [remarkGfm, remarkMath, remarkDirective, remarkNoteBoxes];
const REHYPE_PLUGINS: Parameters<typeof ReactMarkdown>[0]['rehypePlugins'] = [
  [rehypeKatex, { strict: 'ignore', throwOnError: false, errorColor: '#dc2626', ...NOTE_KATEX_LIMITS }],
  rehypeNoteDigits,
];

/**
 * Students' own notes don't load images from other sites: once notes can be
 * shared (Phase 4), a remote image would tell its owner who read the note and
 * when. Library notes keep them (admins add diagrams from our image bucket).
 */
const noRemoteImageComponents: Components = {
  ...baseComponents,
  img({ alt }) {
    return <span className="text-sm text-muted-foreground">[Image{alt ? `: ${alt}` : ''} not shown in your own notes]</span>;
  },
};

function NotesMarkdownImpl({
  markdown,
  look = 'notebook',
  className,
  remoteImages = true,
}: {
  markdown: string;
  look?: NotesLook;
  className?: string;
  /** False for student-written notes (no images from other sites). */
  remoteImages?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  // Fit formulas now, whenever the note's width changes (rotation, side
  // panels) and once KaTeX's fonts have loaded (they change every width).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let width = -1;
    const fit = (force = false) => {
      if (!force && root.clientWidth === width) return;
      width = root.clientWidth;
      fitFormulas(root);
    };
    fit(true);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => fit());
    observer?.observe(root);
    let active = true;
    void document.fonts?.ready.then(() => {
      if (active) fit(true);
    });
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [markdown, look, remoteImages]);
  return (
    <article ref={ref} className={cn(styles.note, look === 'notebook' ? styles.notebook : styles.clean, hand.variable, className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={remoteImages ? baseComponents : noRemoteImageComponents}>
        {normaliseDisplayMath(markdown)}
      </ReactMarkdown>
    </article>
  );
}

/** Memoised: a note re-parses only when its text or look changes. */
export const NotesMarkdown = memo(NotesMarkdownImpl);
