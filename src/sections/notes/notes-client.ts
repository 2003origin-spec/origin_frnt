'use client';

/**
 * Origin Notes (student) — data loading and URL helpers.
 * All calls go through `apiCall`, which adds the CSRF header and refreshes an
 * expired session once.
 */

import { useCallback, useEffect, useState } from 'react';

import { apiCall } from '@/lib/api';

export type NotesApiError = { message: string; status: number | null; code: string | null };

function toError(error: unknown): NotesApiError {
  const e = error as { message?: string; status?: number; code?: string };
  return { message: e?.message || 'Something went wrong.', status: e?.status ?? null, code: e?.code ?? null };
}

/**
 * GET `/api/notes/<path>`; `path` null skips the request. State is only set
 * from the request's callbacks, keyed by the request, so a stale reply can
 * never overwrite a newer one.
 */
export function useNotesQuery<T>(path: string | null) {
  const [nonce, setNonce] = useState(0);
  const key = path ? `${path}#${nonce}` : null;
  const [state, setState] = useState<{ key: string | null; data: T | null; error: NotesApiError | null }>({
    key: null,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!key || !path) return;
    let cancelled = false;
    apiCall(`/notes/${path}`)
      .then((result: T) => {
        if (!cancelled) setState({ key, data: result, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState((prev) => ({ key, data: prev.data, error: toError(err) }));
      });
    return () => {
      cancelled = true;
    };
  }, [key, path]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState((prev) => ({ ...prev, data })), []);
  const settled = state.key === key;
  return {
    data: state.data,
    error: settled ? state.error : null,
    loading: Boolean(key) && !settled,
    reload,
    setData,
  };
}

export async function notesSend<T = unknown>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  try {
    return (await apiCall(`/notes/${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
    })) as T;
  } catch (error) {
    throw toError(error);
  }
}

/** Signed link for pdf.js (JSON, not a redirect — see the API route). */
export async function notesFileUrl(itemId: string): Promise<string> {
  const result = (await apiCall(`/notes/library/items/${encodeURIComponent(itemId)}/file?format=json`)) as { url: string };
  return result.url;
}

/** Signed link to one of my own files, as JSON (pdf.js, players). */
export async function myFileUrl(fileId: string, download = false): Promise<string> {
  const result = (await apiCall(`/notes/me/files/${encodeURIComponent(fileId)}/file?format=json${download ? '&download=1' : ''}`)) as { url: string };
  return result.url;
}

/** Signed link to a file a friend shared with me, as JSON. */
export async function sharedFileUrl(shareId: string, fileId: string, download = false): Promise<string> {
  const result = (await apiCall(
    `/notes/shared/${encodeURIComponent(shareId)}/files/${encodeURIComponent(fileId)}/file?format=json${download ? '&download=1' : ''}`,
  )) as { url: string };
  return result.url;
}

export type NotesLocation = {
  folder?: string | null;
  note?: string | null;
  tab?: 'starred' | 'recent' | 'mine' | 'bin' | 'shared' | null;
  q?: string | null;
  all?: boolean;
  /** My Notes folder (with tab 'mine'). */
  myFolder?: string | null;
  /** One of my files (with tab 'mine'). */
  myFile?: string | null;
  /** Search My Notes by name (with tab 'mine'). */
  myQ?: string | null;
  /** A share someone gave me (with tab 'shared'). */
  share?: string | null;
  /** A folder inside that share. */
  sharedFolder?: string | null;
  /** A file inside that share. */
  sharedFile?: string | null;
};

export function notesHref(location: NotesLocation = {}): string {
  const params = new URLSearchParams();
  if (location.tab === 'mine' || location.tab === 'bin') {
    params.set('tab', location.tab);
    if (location.myFile) params.set('file', location.myFile);
    else if (location.myFolder) params.set('mf', location.myFolder);
    if (location.myQ) params.set('mq', location.myQ);
    return `/notes?${params.toString()}`;
  }
  if (location.tab === 'shared') {
    params.set('tab', 'shared');
    if (location.share) {
      params.set('share', location.share);
      if (location.sharedFile) params.set('sfile', location.sharedFile);
      else if (location.sharedFolder) params.set('sf', location.sharedFolder);
    }
    return `/notes?${params.toString()}`;
  }
  if (location.note) params.set('n', location.note);
  else if (location.folder) params.set('f', location.folder);
  if (location.tab) params.set('tab', location.tab);
  if (location.q) params.set('q', location.q);
  if (location.all) params.set('all', '1');
  const query = params.toString();
  return query ? `/notes?${query}` : '/notes';
}
