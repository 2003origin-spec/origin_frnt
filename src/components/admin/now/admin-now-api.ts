'use client';

/** Small client helpers for the Origin NOW admin console (all calls go to /api/admin/now/*). */

import { useCallback, useEffect, useState } from 'react';

import { mutateJson } from '@/lib/csrf';
import { formatISTDateTimeDMY } from '@/lib/format-time';

export const ADMIN_NOW_API = '/api/admin/now';

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body as { detail?: string }).detail ?? `Request failed (${res.status})`;
}

export async function adminGet<T>(path: string): Promise<T> {
  const res = await fetch(`${ADMIN_NOW_API}${path}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

export async function adminSend<T>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await mutateJson(`${ADMIN_NOW_API}${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as T;
}

/** GET with loading / error / reload; `path` null skips the fetch. */
export function useAdminData<T>(path: string | null, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await adminGet<T>(path));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void reload();
    if (!refreshMs) return;
    const id = window.setInterval(() => void reload(), refreshMs);
    return () => window.clearInterval(id);
  }, [reload, refreshMs]);

  return { data, error, loading, reload, setData };
}

/** "17/10/2026, 4:30 pm IST" — every admin date reads dd/mm/yyyy, every time IST. */
export function fmtDate(iso: string | null | undefined): string {
  return iso ? formatISTDateTimeDMY(iso) : '—';
}

export function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}
