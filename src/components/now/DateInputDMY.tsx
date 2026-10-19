'use client';

/**
 * A date field that always reads and accepts dd/mm/yyyy, whatever the
 * browser's language (a native date input shows mm/dd/yyyy on US-English
 * browsers). The value in and out is a calendar-day key "YYYY-MM-DD", or ''
 * while the typed date is incomplete or not a real date.
 */

import { useState } from 'react';

import { Input } from '@/components/ui/input';
import { dayKeyToDMY, dmyToDayKey } from '@/lib/format-time';

/** Keeps digits only and puts the slashes in: "17102026" → "17/10/2026". */
function withSlashes(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateInputDMY({
  id,
  value,
  onChange,
  className = '',
  required,
  disabled,
  ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (dayKey: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(() => (value ? dayKeyToDMY(value) : ''));
  // Follow a value set from outside (a reset, or data loaded later).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value !== (dmyToDayKey(text) ?? '')) setText(value ? dayKeyToDMY(value) : '');
  }
  const invalid = text.length === 10 && dmyToDayKey(text) === null;
  return (
    <span className="flex flex-col gap-0.5">
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        required={required}
        disabled={disabled}
        className={className}
        value={text}
        onChange={(e) => {
          const next = withSlashes(e.target.value);
          setText(next);
          const key = dmyToDayKey(next) ?? '';
          setLastValue(key);
          onChange(key);
        }}
      />
      {invalid && <span className="text-xs text-red-600">Not a real date. Use dd/mm/yyyy.</span>}
    </span>
  );
}
