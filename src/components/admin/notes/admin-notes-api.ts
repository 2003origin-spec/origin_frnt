'use client';

/**
 * Admin Notes console — calls to /api/admin/notes/*. Uses `mutateJson` for every
 * method: it adds the CSRF header and refreshes an expired session once, which
 * matters for an editor tab left open for a long time.
 */

import { useCallback, useEffect, useState } from 'react';

import { mutateJson } from '@/lib/csrf';

export class AdminNotesError extends Error {
  status: number;
  code: string | null;
  data: Record<string, unknown>;

  constructor(status: number, message: string, code: string | null, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export async function adminNotes<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown; form?: FormData } = {},
): Promise<T> {
  const response = await mutateJson(`/api/admin/notes/${path}`, {
    method: options.method ?? 'GET',
    body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    cache: 'no-store',
  });
  const text = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }
  if (!response.ok) {
    throw new AdminNotesError(
      response.status,
      typeof data.detail === 'string' ? data.detail : `Request failed (${response.status}).`,
      typeof data.code === 'string' ? data.code : null,
      data,
    );
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export function useAdminNotes<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = path ? `${path}#${nonce}` : null;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: string | null }>({ key: null, data: null, error: null });

  useEffect(() => {
    if (!key || !path) return;
    let cancelled = false;
    adminNotes<T>(path)
      .then((result) => {
        if (!cancelled) setState({ key, data: result, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState((prev) => ({ key, data: prev.data, error: errorMessage(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, path]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState((prev) => ({ ...prev, data })), []);
  const settled = state.key === key;
  return { data: state.data, error: settled ? state.error : null, loading: Boolean(key) && !settled, reload, setData };
}

/** Shared with My Notes (src/components/notes/upload-helpers.ts). */
export { putWithProgress } from '@/components/notes/upload-helpers';

export function adminNotesHref(params: { tab?: string; folder?: string | null; item?: string | null }): string {
  const search = new URLSearchParams();
  if (params.tab && params.tab !== 'library') search.set('tab', params.tab);
  if (params.folder) search.set('folder', params.folder);
  if (params.item) search.set('item', params.item);
  const query = search.toString();
  return query ? `/admin/notes?${query}` : '/admin/notes';
}
