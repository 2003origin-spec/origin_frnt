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
 * Normalizes common AI math delimiters to standard Markdown math delimiters ($ and $$)
 * so that remark-math can parse them correctly.
 */
function normalizeDelimiters(content: string): string {
  if (!content) return '';

  return content
    // Replace \[ ... \] with $$ ... $$ (block)
    .replace(/\\\[([\\s\\S]*?)\\\]/g, '$$$$$1$$$$')
    // Replace \( ... \) with $ ... $ (inline)
    .replace(/\\\(([\\s\\S]*?)\\\)/g, '$$$1$$')
    .replace(/(\$|\\\(|\\\[)[\s\S]*?(\$|\\\)|\\\])/g, (match) => {
      return match.replace(/\\_/g, '_');
    });
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
