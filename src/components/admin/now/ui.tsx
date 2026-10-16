'use client';

/** Tiny shared pieces for the Origin NOW admin panels. */

import type { ReactNode } from 'react';

export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-2 py-1 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="py-4 text-center text-sm text-muted-foreground">Nothing here.</p>}
    </div>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`border-b px-2 py-1 align-top ${className}`}>{children}</td>;
}

export function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p className="text-sm text-red-600" role="alert">
      {error}
    </p>
  ) : null;
}

export const inputClass = 'rounded-md border bg-background px-2 py-1 text-sm';
export const buttonClass =
  'rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-foreground disabled:opacity-50';
export const ghostButtonClass = 'rounded-md border px-3 py-1 text-sm disabled:opacity-50';
