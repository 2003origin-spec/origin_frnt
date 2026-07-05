'use client';

/**
 * Neumorphism (Soft UI) component set — uiverse-style, recreated in Origin's token system.
 *
 * All pieces consume the `--neu-*` CSS vars (see globals.css), so they auto-match light/dark
 * and the surface color. Built accessible: real inputs, keyboard focus rings, reduced-motion
 * handled in CSS. Use on a neumorphic surface (a `.neu-surface` / `.neu-raised` ancestor).
 */
import * as React from 'react';

import { cn } from '@/lib/utils';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--neu-bg))]';

/* ── Button ─────────────────────────────────────────────────────────────── */
export interface NeuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Cyan accent label instead of neutral. */
  accent?: boolean;
}
export const NeuButton = React.forwardRef<HTMLButtonElement, NeuButtonProps>(
  ({ className, accent, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'neu-btn inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold',
        accent ? 'text-primary' : 'text-foreground/80',
        focusRing,
        'disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
NeuButton.displayName = 'NeuButton';

/* ── Icon button ────────────────────────────────────────────────────────── */
export interface NeuIconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Cyan accent icon instead of neutral. */
  accent?: boolean;
  /** Round (circle) instead of the default rounded square. */
  round?: boolean;
}
export const NeuIconButton = React.forwardRef<HTMLButtonElement, NeuIconButtonProps>(
  ({ className, accent, round, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'neu-icon-btn inline-flex h-11 w-11 items-center justify-center',
        round && 'rounded-full',
        accent ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        focusRing,
        'disabled:opacity-50 disabled:pointer-events-none',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
NeuIconButton.displayName = 'NeuIconButton';

/* ── Chip / tag ─────────────────────────────────────────────────────────── */
export interface NeuChipProps {
  children: React.ReactNode;
  /** Leading icon, rendered in the accent colour. */
  icon?: React.ReactNode;
  /** When provided, shows a dismiss (×) button that calls this. */
  onDismiss?: () => void;
  className?: string;
}
export function NeuChip({ children, icon, onDismiss, className }: NeuChipProps) {
  return (
    <div className={cn('neu-chip inline-flex items-center gap-2 px-3 py-2', className)}>
      {icon ? <span className="flex shrink-0 items-center text-primary">{icon}</span> : null}
      <span className="text-sm font-medium text-foreground">{children}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Remove"
          className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground', focusRing)}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
NeuChip.displayName = 'NeuChip';

/* ── Toggle switch ──────────────────────────────────────────────────────── */
export interface NeuToggleProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}
export function NeuToggle({ checked, onCheckedChange, label, disabled, className }: NeuToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn('neu-track relative inline-flex h-8 w-14 items-center px-1 transition-colors', focusRing, disabled && 'opacity-50', className)}
    >
      <span
        className={cn(
          'neu-knob h-6 w-6 transform transition-transform duration-200 ease-out motion-reduce:transition-none',
          checked ? 'translate-x-6' : 'translate-x-0',
        )}
        style={checked ? { backgroundColor: 'hsl(var(--primary))' } : undefined}
      />
    </button>
  );
}

/* ── Input / Search ─────────────────────────────────────────────────────── */
export type NeuInputProps = React.InputHTMLAttributes<HTMLInputElement>;
export const NeuInput = React.forwardRef<HTMLInputElement, NeuInputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('neu-field w-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground', focusRing, className)}
      {...props}
    />
  ),
);
NeuInput.displayName = 'NeuInput';

export interface NeuSearchProps extends NeuInputProps {
  icon?: React.ReactNode;
}
export const NeuSearch = React.forwardRef<HTMLInputElement, NeuSearchProps>(
  ({ className, icon, ...props }, ref) => (
    <div className="neu-field flex items-center gap-2 px-4">
      <span className="text-muted-foreground">{icon}</span>
      <input
        ref={ref}
        type="search"
        className={cn('w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none', className)}
        {...props}
      />
    </div>
  ),
);
NeuSearch.displayName = 'NeuSearch';

/* ── Checkbox ───────────────────────────────────────────────────────────── */
export interface NeuCheckboxProps {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}
export function NeuCheckbox({ checked, onCheckedChange, label, disabled, className }: NeuCheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] transition-all',
        checked ? 'neu-field' : 'neu-knob',
        focusRing,
        disabled && 'opacity-50',
        className,
      )}
    >
      {checked ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : null}
    </button>
  );
}

/* ── Progress (inset track + accent fill) ───────────────────────────────── */
export interface NeuProgressProps {
  value: number; // 0–100
  className?: string;
}
export function NeuProgress({ value, className }: NeuProgressProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('neu-track h-3 w-full overflow-hidden', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%`, backgroundColor: 'hsl(var(--primary))' }}
      />
    </div>
  );
}
