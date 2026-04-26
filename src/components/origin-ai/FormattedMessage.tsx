'use client';

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import type { ExtraProps } from 'react-markdown';
import type { HTMLAttributes, OlHTMLAttributes, LiHTMLAttributes, ClassAttributes } from 'react';

interface FormattedMessageProps {
  content: string;
  className?: string;
  isAssistant?: boolean;
  inline?: boolean;
}

/**
 * Normalizes common AI math delimiters to standard Markdown math delimiters ($ and $$).
 * Uses a character-level state machine to avoid the broken protect/restore regex approach.
 */
function normalizeDelimiters(content: string): string {
  if (!content) return '';

  // Step 1: Convert \[ ... \] to $$ ... $$ and \( ... \) to $ ... $
  let result = content
    .replace(/\\\[([\s\S]*?)\\\]/g, '\n$$\n$1\n$$\n')
    .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  // Step 2: Wrap bare LaTeX expressions with $ delimiters
  result = wrapBareLaTeX(result);

  return result;
}

/**
 * Wraps bare LaTeX expressions (starting with \command or Greek/math-symbol characters)
 * with $ delimiters, using a single-pass character-level state machine.
 * Already-delimited $...$ and $$...$$ blocks are copied verbatim without modification.
 */
function wrapBareLaTeX(text: string): string {
  const out: string[] = [];
  let i = 0;
  const len = text.length;

  const isGreek = (c: string): boolean => {
    const cp = c.codePointAt(0) ?? 0;
    return (cp >= 0x0370 && cp <= 0x03FF) || (cp >= 0x1F00 && cp <= 0x1FFF);
  };

  const isMathSymbol = (c: string): boolean =>
    '±∞≈≠≤≥×÷√∝∠∫∬∭∮∇∂∆∑∏'.includes(c);

  // Peek ahead from position pos (skipping spaces) and check if what follows
  // looks like math (LaTeX command, Greek, math symbol, or ^ _)
  const nextIsMath = (pos: number): boolean => {
    let k = pos;
    while (k < len && (text[k] === ' ' || text[k] === '\t')) k++;
    if (k >= len) return false;
    const c = text[k];
    return c === '\\' || isGreek(c) || isMathSymbol(c) || '^_'.includes(c);
  };

  while (i < len) {
    // ── Case 1: $$ ... $$ block ───────────────────────────────────────────
    if (text[i] === '$' && i + 1 < len && text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        out.push(text.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }

    // ── Case 2: $ ... $ block ─────────────────────────────────────────────
    if (text[i] === '$') {
      const end = text.indexOf('$', i + 1);
      if (end !== -1) {
        out.push(text.slice(i, end + 1));
        i = end + 1;
        continue;
      }
    }

    // ── Case 3: Bare LaTeX starting point ─────────────────────────────────
    const isLatexCmd = text[i] === '\\' && i + 1 < len && /[a-zA-Z]/.test(text[i + 1]);
    const isSpecial = isGreek(text[i]) || isMathSymbol(text[i]);

    if (isLatexCmd || isSpecial) {
      const mathStart = i;
      let braceDepth = 0;
      let j = i;

      while (j < len) {
        const c = text[j];

        // ── Inside braces: consume everything including nested parens ──
        if (c === '{') { braceDepth++; j++; continue; }
        if (c === '}') {
          if (braceDepth > 0) { braceDepth--; j++; continue; }
          break; // unmatched } – stop
        }
        if (braceDepth > 0) { j++; continue; }

        // ── Outside braces ─────────────────────────────────────────────
        // LaTeX command word
        if (c === '\\' && j + 1 < len && /[a-zA-Z]/.test(text[j + 1])) {
          const cmdStart = j + 1;
          j += 2;
          while (j < len && /[a-zA-Z]/.test(text[j])) j++;
          const cmdWord = text.slice(cmdStart, j);
          // \left, \right, \bigl, \bigr, \Big, \Bigg etc. are followed by
          // a single delimiter character that MUST stay inside the math block
          if (/^(left|right|[Bb]ig[lr]?[lr]?|[Bb]igg[lr]?|middle)$/.test(cmdWord)) {
            // Consume the delimiter: (, ), [, ], |, ., \{, \}
            if (j < len) {
              if (text[j] === '\\' && j + 1 < len && /[{}|]/.test(text[j + 1])) {
                j += 2; // e.g. \left\{ or \right\}
              } else {
                j++; // e.g. \left( or \right)
              }
            }
          }
          continue;
        }

        // Superscript / subscript
        if ('^_'.includes(c)) { j++; continue; }

        // Operators and digits
        if (/[0-9+\-*\/=<>!|&~%]/.test(c)) { j++; continue; }

        // Greek or math symbols
        if (isGreek(c) || isMathSymbol(c)) { j++; continue; }

        // Single letters (variable names)
        if (/[a-zA-Z]/.test(c)) { j++; continue; }

        // Space / tab: allow only when next non-space token is math-like
        if (c === ' ' || c === '\t') {
          if (nextIsMath(j + 1)) { j++; continue; }
          // Also allow if a digit follows and THEN math (e.g. "2\theta")
          let k = j + 1;
          while (k < len && /[0-9]/.test(text[k])) k++;
          if (k > j + 1 && nextIsMath(k)) { j++; continue; }
          break;
        }

        // Everything else (parens, commas, colons …) – stop
        break;
      }

      // Trim trailing whitespace / punctuation that shouldn't end math
      let mathEnd = j;
      while (mathEnd > mathStart && /[\s.,;:]/.test(text[mathEnd - 1])) mathEnd--;

      const mathContent = text.slice(mathStart, mathEnd);
      if (mathContent.length > 0) {
        out.push('$' + mathContent + '$');
        i = mathEnd;
      } else {
        out.push(text[i]);
        i++;
      }
      continue;
    }

    // ── Case 4: Regular character ─────────────────────────────────────────
    out.push(text[i]);
    i++;
  }

  return out.join('');
}

type PProps = ClassAttributes<HTMLParagraphElement> & HTMLAttributes<HTMLParagraphElement> & ExtraProps;
type UlProps = ClassAttributes<HTMLUListElement> & HTMLAttributes<HTMLUListElement> & ExtraProps;
type OlProps = ClassAttributes<HTMLOListElement> & OlHTMLAttributes<HTMLOListElement> & ExtraProps;
type LiProps = ClassAttributes<HTMLLIElement> & LiHTMLAttributes<HTMLLIElement> & ExtraProps;
type StrongProps = ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps;
type DivProps = ClassAttributes<HTMLDivElement> & HTMLAttributes<HTMLDivElement> & ExtraProps;

export function FormattedMessage({ content, className, isAssistant = true, inline = false }: FormattedMessageProps) {
  const normalizedContent = normalizeDelimiters(content);
  const Wrapper = inline ? 'span' : 'div';

  return (
    <Wrapper className={cn(
      !inline && 'prose prose-sm dark:prose-invert max-w-none',
      !inline && 'prose-p:leading-relaxed prose-p:my-1',
      !inline && 'prose-ul:my-2 prose-ol:my-2',
      !inline && 'prose-li:my-0.5',
      !inline && 'prose-strong:text-blue-600 dark:prose-strong:text-blue-400 prose-strong:font-bold',
      isAssistant ? 'text-foreground' : 'text-white prose-strong:text-white dark:prose-strong:text-white',
      className
    )}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          p: ({ children, node, ...rest }: PProps) =>
            inline ? <>{children}</> : <p className="mb-2 last:mb-0" {...rest}>{children}</p>,
          ul: ({ children, node, ...rest }: UlProps) =>
            <ul className="list-disc pl-5 mb-2 space-y-1" {...rest}>{children}</ul>,
          ol: ({ children, node, ...rest }: OlProps) =>
            <ol className="list-decimal pl-5 mb-2 space-y-1" {...rest}>{children}</ol>,
          li: ({ children, node, ...rest }: LiProps) =>
            <li className="leading-relaxed" {...rest}>{children}</li>,
          strong: ({ children, node, ...rest }: StrongProps) =>
            <strong className="font-bold" {...rest}>{children}</strong>,
          div: ({ className: cls, children, node, ...rest }: DivProps) => {
            if (cls?.includes('math-display')) {
              return (
                <div
                  className={cn(
                    'my-4 overflow-x-auto py-2 flex justify-center bg-blue-500/5 rounded-xl border border-blue-500/10',
                    inline && 'my-1 py-1'
                  )}
                  {...rest}
                >
                  {children}
                </div>
              );
            }
            return <div className={cls} {...rest}>{children}</div>;
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </Wrapper>
  );
}
