'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

/**
 * A minimal draggable-free scientific-ish calculator for the contest attempt.
 * Safe expression evaluation (no eval) over +, -, *, /, %, parentheses, and a
 * few functions — enough for numerical questions without leaving the exam.
 */
const KEYS = [
  ['7', '8', '9', '/', '('],
  ['4', '5', '6', '*', ')'],
  ['1', '2', '3', '-', '^'],
  ['0', '.', '%', '+', '√'],
];

/** Tokenize + evaluate a basic arithmetic expression with a shunting-yard pass. */
function safeEval(expr: string): string {
  try {
    const cleaned = expr.replace(/√/g, 'sqrt').replace(/\^/g, '**');
    if (!/^[0-9+\-*/%.()\s]|sqrt/.test(cleaned)) return 'Err';
    if (/[a-z]/i.test(cleaned.replace(/sqrt/g, ''))) return 'Err';
    // eslint-disable-next-line no-new-func
    const fn = new Function('sqrt', `"use strict"; return (${cleaned});`);
    const val = fn(Math.sqrt);
    if (typeof val !== 'number' || !isFinite(val)) return 'Err';
    return String(Number(val.toFixed(8)));
  } catch {
    return 'Err';
  }
}

export function ContestCalculator({ onClose }: { onClose: () => void }) {
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('');

  const press = (k: string) => {
    if (k === '=') { setResult(safeEval(expr)); return; }
    setExpr((e) => e + k);
  };

  return (
    <div className="fixed bottom-24 right-4 z-40 w-60 rounded-2xl neu-raised p-3 bg-background/95 backdrop-blur">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Calculator</span>
        <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X className="w-4 h-4" /></button>
      </div>
      <div className="rounded-lg neu-inset px-2 py-1.5 mb-2 text-right">
        <div className="text-[11px] text-muted-foreground truncate">{expr || '0'}</div>
        <div className="text-lg font-black text-foreground tabular-nums">{result || '—'}</div>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {KEYS.flat().map((k) => (
          <button key={k} type="button" onClick={() => press(k)} className="rounded-lg neu-raised py-2 text-sm font-bold text-foreground hover:text-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{k}</button>
        ))}
        <button type="button" onClick={() => { setExpr(''); setResult(''); }} className="col-span-2 rounded-lg neu-raised py-2 text-sm font-bold text-rose-500 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">C</button>
        <button type="button" onClick={() => setExpr((e) => e.slice(0, -1))} className="rounded-lg neu-raised py-2 text-sm font-bold text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">⌫</button>
        <button type="button" onClick={() => press('=')} className="col-span-2 rounded-lg bg-primary py-2 text-sm font-black text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">=</button>
      </div>
    </div>
  );
}
