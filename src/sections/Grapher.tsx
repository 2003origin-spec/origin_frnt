'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  ArrowLeft, Plus, Trash2, Eye, EyeOff, ZoomIn, ZoomOut, Maximize2, LineChart, Table2, X,
} from 'lucide-react';

import { compileExpression, type CompiledExpression } from '@/lib/grapher/expression';
import { useAppBack } from '@/hooks/useAppBack';
import { cn } from '@/lib/utils';

const PALETTE = ['#2bb1ff', '#f43f5e', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#ec4899', '#84cc16'];

let idCounter = 0;
const nextId = (): string => {
  idCounter += 1;
  return `eq_${idCounter}`;
};

type Equation = { id: string; expr: string; color: string; visible: boolean };
type View = { centerX: number; centerY: number; pxPerUnit: number };

const DEFAULT_VIEW: View = { centerX: 0, centerY: 0, pxPerUnit: 48 };

/** Pick a "nice" 1/2/5×10ⁿ spacing so gridlines sit ~80px apart. */
function niceStep(pxPerUnit: number): number {
  const rawUnits = 80 / pxPerUnit;
  const pow = 10 ** Math.floor(Math.log10(rawUnits));
  const n = rawUnits / pow;
  const factor = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return factor * pow;
}

function formatTick(value: number, step: number): string {
  if (value === 0) return '0';
  const decimals = Math.max(0, -Math.floor(Math.log10(step)));
  return Number(value.toFixed(Math.min(decimals, 6))).toString();
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-4 && value !== 0)) return value.toExponential(3);
  return Number(value.toFixed(4)).toString();
}

export default function Grapher() {
  const goBack = useAppBack('/explore');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const isDark = mounted && resolvedTheme === 'dark';

  const [equations, setEquations] = useState<Equation[]>([
    { id: nextId(), expr: 'a*sin(b*x)', color: PALETTE[0], visible: true },
    { id: nextId(), expr: 'x^2 - 3', color: PALETTE[1], visible: true },
  ]);
  const [params, setParams] = useState<Record<string, number>>({ a: 2, b: 1 });
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [hover, setHover] = useState<{ sx: number; sy: number } | null>(null);
  const [tableXs, setTableXs] = useState<string[]>(['0', '1', '2']);
  const [showTable, setShowTable] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const dragRef = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);

  // Compile each equation (memoised on its source text).
  const compiled = useMemo<Record<string, CompiledExpression>>(() => {
    const map: Record<string, CompiledExpression> = {};
    for (const eq of equations) map[eq.id] = compileExpression(eq.expr);
    return map;
  }, [equations]);

  // Union of free variables across all equations → parameter sliders.
  const paramNames = useMemo(() => {
    const set = new Set<string>();
    for (const eq of equations) for (const v of compiled[eq.id]?.variables ?? []) set.add(v);
    return Array.from(set).sort();
  }, [equations, compiled]);

  // Seed any newly-introduced parameter with a default of 1.
  useEffect(() => {
    setParams((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const name of paramNames) if (!(name in next)) { next[name] = 1; changed = true; }
      return changed ? next : prev;
    });
  }, [paramNames]);

  // Track container size (DPR-crisp canvas).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: Math.max(1, Math.floor(rect.width)), height: Math.max(1, Math.floor(rect.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scope = useCallback((x: number): Record<string, number> => ({ ...params, x }), [params]);

  // ── Render ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || size.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(size.width * dpr);
    canvas.height = Math.floor(size.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { width, height } = size;
    const { centerX, centerY, pxPerUnit } = view;

    const toSx = (x: number) => width / 2 + (x - centerX) * pxPerUnit;
    const toSy = (y: number) => height / 2 - (y - centerY) * pxPerUnit;
    const toMx = (sx: number) => centerX + (sx - width / 2) / pxPerUnit;

    const bg = isDark ? '#0a0d14' : '#ffffff';
    const minorGrid = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
    const majorGrid = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';
    const axis = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.55)';
    const label = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.6)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    const step = niceStep(pxPerUnit);
    const xMin = toMx(0);
    const xMax = toMx(width);
    const yMax = centerY + (height / 2) / pxPerUnit;
    const yMin = centerY - (height / 2) / pxPerUnit;

    // Minor grid
    const minor = step / 5;
    ctx.lineWidth = 1;
    ctx.strokeStyle = minorGrid;
    ctx.beginPath();
    for (let x = Math.ceil(xMin / minor) * minor; x <= xMax; x += minor) {
      const sx = Math.round(toSx(x)) + 0.5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, height);
    }
    for (let y = Math.ceil(yMin / minor) * minor; y <= yMax; y += minor) {
      const sy = Math.round(toSy(y)) + 0.5;
      ctx.moveTo(0, sy); ctx.lineTo(width, sy);
    }
    ctx.stroke();

    // Major grid + tick labels
    ctx.strokeStyle = majorGrid;
    ctx.fillStyle = label;
    ctx.font = '11px ui-monospace, monospace';
    ctx.beginPath();
    const axisY = toSy(0);
    const axisX = toSx(0);
    for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
      const sx = Math.round(toSx(x)) + 0.5;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, height);
      if (Math.abs(x) > 1e-9) {
        const ty = Math.min(Math.max(axisY + 14, 12), height - 4);
        ctx.fillText(formatTick(x, step), sx + 3, ty);
      }
    }
    for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
      const sy = Math.round(toSy(y)) + 0.5;
      ctx.moveTo(0, sy); ctx.lineTo(width, sy);
      if (Math.abs(y) > 1e-9) {
        const tx = Math.min(Math.max(axisX + 4, 4), width - 28);
        ctx.fillText(formatTick(y, step), tx, sy - 3);
      }
    }
    ctx.stroke();

    // Axes
    ctx.strokeStyle = axis;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(axisY) + 0.5); ctx.lineTo(width, Math.round(axisY) + 0.5);
    ctx.moveTo(Math.round(axisX) + 0.5, 0); ctx.lineTo(Math.round(axisX) + 0.5, height);
    ctx.stroke();

    // Curves
    for (const eq of equations) {
      const c = compiled[eq.id];
      if (!eq.visible || !c?.ok) continue;
      ctx.strokeStyle = eq.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let penDown = false;
      let prevSy = 0;
      for (let px = 0; px <= width; px += 1) {
        const x = toMx(px);
        const y = c.evaluate(scope(x));
        if (!Number.isFinite(y)) { penDown = false; continue; }
        const sy = toSy(y);
        // Break the path across steep discontinuities (e.g. tan).
        if (penDown && Math.abs(sy - prevSy) > height * 1.5) { penDown = false; }
        if (!penDown) { ctx.moveTo(px, sy); penDown = true; } else { ctx.lineTo(px, sy); }
        prevSy = sy;
      }
      ctx.stroke();
    }

    // Hover guide + readout
    if (hover) {
      const hx = toMx(hover.sx);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(Math.round(hover.sx) + 0.5, 0);
      ctx.lineTo(Math.round(hover.sx) + 0.5, height);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const eq of equations) {
        const c = compiled[eq.id];
        if (!eq.visible || !c?.ok) continue;
        const y = c.evaluate(scope(hx));
        if (!Number.isFinite(y)) continue;
        const sy = toSy(y);
        ctx.fillStyle = eq.color;
        ctx.beginPath();
        ctx.arc(hover.sx, sy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [equations, compiled, params, view, size, isDark, hover, scope]);

  // ── Interaction ─────────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, centerX: view.centerX, centerY: view.centerY };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) setHover({ sx: e.clientX - rect.left, sy: e.clientY - rect.top });
    const drag = dragRef.current;
    if (!drag) return;
    const dx = (e.clientX - drag.x) / view.pxPerUnit;
    const dy = (e.clientY - drag.y) / view.pxPerUnit;
    setView((v) => ({ ...v, centerX: drag.centerX - dx, centerY: drag.centerY + dy }));
  };
  const endDrag = (): void => { dragRef.current = null; };

  // Wheel zoom via a native non-passive listener: React's `onWheel` is passive,
  // so preventDefault() there is ignored and the page scrolls while zooming.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setView((v) => {
        const newScale = Math.min(100000, Math.max(0.001, v.pxPerUnit * factor));
        // Keep the point under the cursor fixed while zooming.
        const mx = v.centerX + (sx - size.width / 2) / v.pxPerUnit;
        const my = v.centerY - (sy - size.height / 2) / v.pxPerUnit;
        const centerX = mx - (sx - size.width / 2) / newScale;
        const centerY = my + (sy - size.height / 2) / newScale;
        return { centerX, centerY, pxPerUnit: newScale };
      });
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [size.width, size.height]);

  const zoomBy = (factor: number): void =>
    setView((v) => ({ ...v, pxPerUnit: Math.min(100000, Math.max(0.001, v.pxPerUnit * factor)) }));

  // ── Equation editing ──────────────────────────────────────────────────────
  const updateExpr = (id: string, expr: string): void =>
    setEquations((list) => list.map((eq) => (eq.id === id ? { ...eq, expr } : eq)));
  const toggleVisible = (id: string): void =>
    setEquations((list) => list.map((eq) => (eq.id === id ? { ...eq, visible: !eq.visible } : eq)));
  const removeEq = (id: string): void => setEquations((list) => list.filter((eq) => eq.id !== id));
  const addEq = (): void =>
    setEquations((list) => [...list, { id: nextId(), expr: '', color: PALETTE[list.length % PALETTE.length], visible: true }]);

  const controlCard = isDark ? 'bg-[#0d111a]/80 border-[#1a2333]' : 'neu-raised border-transparent';

  return (
    <main className={cn('min-h-dvh w-full text-foreground', isDark ? 'bg-[#050810]' : 'bg-background')}>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 p-3 sm:p-4 lg:h-dvh lg:flex-row">
        {/* Controls */}
        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[340px] lg:overflow-y-auto">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              className="flex items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Explore
            </button>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
              <LineChart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-black leading-none tracking-tight">Graphs</h1>
              <p className="text-[11px] text-muted-foreground">Plot y = f(x) · pan, zoom, tweak</p>
            </div>
          </div>

          {/* Equations */}
          <section className={cn('rounded-2xl border p-3', controlCard)}>
            <h2 className="mb-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Equations</h2>
            <div className="flex flex-col gap-2">
              {equations.map((eq) => {
                const c = compiled[eq.id];
                const hasError = eq.expr.trim() !== '' && !c?.ok;
                return (
                  <div key={eq.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleVisible(eq.id)}
                        className="h-4 w-4 shrink-0 rounded-full"
                        style={{ backgroundColor: eq.visible ? eq.color : 'transparent', border: `2px solid ${eq.color}` }}
                        aria-label={eq.visible ? 'Hide' : 'Show'}
                      />
                      <span className="shrink-0 font-mono text-sm text-muted-foreground">y =</span>
                      <input
                        value={eq.expr}
                        onChange={(e) => updateExpr(eq.id, e.target.value)}
                        placeholder="e.g. a*sin(x)"
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        className={cn(
                          'min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1.5 font-mono text-sm outline-none',
                          isDark ? 'border border-[#1a2333] focus:border-primary/50' : 'neu-inset',
                          hasError && 'text-rose-500',
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => toggleVisible(eq.id)}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={eq.visible ? 'Hide curve' : 'Show curve'}
                      >
                        {eq.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEq(eq.id)}
                        className="shrink-0 text-muted-foreground transition-colors hover:text-rose-500"
                        aria-label="Delete equation"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {hasError && <p className="pl-6 text-[11px] font-medium text-rose-500">{c?.error}</p>}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={addEq}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Add equation
            </button>
          </section>

          {/* Parameter sliders */}
          {paramNames.length > 0 && (
            <section className={cn('rounded-2xl border p-3', controlCard)}>
              <h2 className="mb-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Parameters</h2>
              <div className="flex flex-col gap-3">
                {paramNames.map((name) => (
                  <div key={name}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="font-mono text-sm font-black text-foreground">{name}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">{(params[name] ?? 1).toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={-10}
                      max={10}
                      step={0.1}
                      value={params[name] ?? 1}
                      onChange={(e) => setParams((p) => ({ ...p, [name]: Number(e.target.value) }))}
                      className="w-full accent-primary"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Value table */}
          <section className={cn('rounded-2xl border p-3', controlCard)}>
            <button
              type="button"
              onClick={() => setShowTable((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                <Table2 className="h-3.5 w-3.5" /> Value table
              </span>
            </button>
            {showTable && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      <th className="pb-2 pr-3 font-mono">x</th>
                      {equations.filter((eq) => eq.visible && compiled[eq.id]?.ok).map((eq) => (
                        <th key={eq.id} className="pb-2 pr-3 font-mono" style={{ color: eq.color }}>f</th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {tableXs.map((xs, i) => {
                      const xv = Number(xs);
                      const valid = xs.trim() !== '' && Number.isFinite(xv);
                      return (
                        <tr key={i}>
                          <td className="py-1 pr-3">
                            <input
                              value={xs}
                              onChange={(e) => setTableXs((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))}
                              className={cn('w-16 rounded bg-transparent px-1.5 py-1 text-sm outline-none', isDark ? 'border border-[#1a2333]' : 'neu-inset')}
                            />
                          </td>
                          {equations.filter((eq) => eq.visible && compiled[eq.id]?.ok).map((eq) => (
                            <td key={eq.id} className="py-1 pr-3 text-muted-foreground">
                              {valid ? formatValue(compiled[eq.id].evaluate({ ...params, x: xv })) : '—'}
                            </td>
                          ))}
                          <td>
                            <button
                              type="button"
                              onClick={() => setTableXs((arr) => arr.filter((_, j) => j !== i))}
                              className="text-muted-foreground hover:text-rose-500"
                              aria-label="Remove row"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={() => setTableXs((arr) => [...arr, ''])}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
                >
                  <Plus className="h-3.5 w-3.5" /> Add x
                </button>
              </div>
            )}
          </section>
        </aside>

        {/* Canvas */}
        <div className="relative min-h-[60vh] flex-1 overflow-hidden rounded-2xl border lg:min-h-0" style={{ borderColor: isDark ? '#1a2333' : 'hsl(var(--border))' }}>
          <div ref={wrapRef} className="absolute inset-0">
            <canvas
              ref={canvasRef}
              style={{ width: size.width, height: size.height, touchAction: 'none', cursor: dragRef.current ? 'grabbing' : 'crosshair' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={() => { endDrag(); setHover(null); }}
            />
          </div>

          {/* Hover coordinate badge */}
          {hover && size.width > 0 && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/70 px-2.5 py-1 font-mono text-xs text-white backdrop-blur">
              x = {formatValue(view.centerX + (hover.sx - size.width / 2) / view.pxPerUnit)},{' '}
              y = {formatValue(view.centerY - (hover.sy - size.height / 2) / view.pxPerUnit)}
            </div>
          )}

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-2">
            <button type="button" onClick={() => zoomBy(1.3)} aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5">
              <ZoomOut className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setView(DEFAULT_VIEW)} aria-label="Reset view" className={cn('flex h-9 w-9 items-center justify-center rounded-xl shadow-lg transition-transform hover:-translate-y-0.5', isDark ? 'bg-[#111520] text-slate-200 border border-[#1a2333]' : 'neu-raised text-foreground')}>
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
