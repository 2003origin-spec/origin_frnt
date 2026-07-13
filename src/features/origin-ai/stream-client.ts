import { attemptTokenRefresh, resolveApiBaseUrl } from '@/lib/api';
import { notifyAiDisabled } from '@/features/origin-ai/ai-access-client';
import { getOriginAiBrowserSessionId } from '@/features/origin-ai/session';

const API_URL = resolveApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL,
  typeof window !== 'undefined' ? window.location.origin : undefined,
);

const CSRF_COOKIE_NAME = 'origin_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

export type OriginAiStreamPageContext = Record<string, unknown>;

export type OriginAiStreamAudioEvent = {
  type: 'audio';
  sequence: number;
  text?: string;
  data: string;
  mimeType?: string;
  voiceName?: string | null;
};

export type OriginAiStreamFinalEvent = {
  type: 'final';
  answer: string;
  source: string;
  tokens_used?: number;
  provider?: string;
  model?: string;
  session_id: string;
  user_message_id: string;
  ai_message_id: string;
  policy?: {
    mode: 'normal' | 'hint_only' | 'answer_blocked';
    title: string;
    reason?: string;
  };
};

export type OriginAiStreamHandlers = {
  onTextDelta?: (delta: string) => void;
  onAudio?: (audio: OriginAiStreamAudioEvent) => void | Promise<void>;
  onTranscript?: (text: string, normalizedText?: string) => void;
  onFinal?: (event: OriginAiStreamFinalEvent) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
};

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const match = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

async function openStreamRequest(endpoint: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const build = (): RequestInit => {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    });
    const csrf = readCookie(CSRF_COOKIE_NAME);
    if (csrf) headers.set(CSRF_HEADER_NAME, csrf);
    return {
      method: 'POST',
      cache: 'no-store',
      credentials: 'include',
      headers,
      body: JSON.stringify(body),
      signal,
    };
  };

  if (!readCookie(CSRF_COOKIE_NAME)) {
    await attemptTokenRefresh();
  }

  let response = await fetch(`${API_URL}${endpoint}`, build());
  if ((response.status === 401 || response.status === 403) && (await attemptTokenRefresh()) === 'ok') {
    response = await fetch(`${API_URL}${endpoint}`, build());
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if ((errorData as { code?: string } | null)?.code === 'AI_DISABLED') {
      notifyAiDisabled();
    }
    const message =
      typeof (errorData as { detail?: unknown }).detail === 'string'
        ? String((errorData as { detail: string }).detail)
        : typeof (errorData as { error?: unknown }).error === 'string'
          ? String((errorData as { error: string }).error)
          : typeof (errorData as { message?: unknown }).message === 'string'
            ? String((errorData as { message: string }).message)
            : `Ori stream failed (${response.status})`;
    const error = new Error(message) as Error & { status?: number; code?: string };
    error.status = response.status;
    if (typeof (errorData as { code?: unknown }).code === 'string') {
      error.code = (errorData as { code: string }).code;
    }
    throw error;
  }

  return response;
}

async function consumeSseStream(response: Response, handlers: OriginAiStreamHandlers): Promise<OriginAiStreamFinalEvent> {
  if (!response.body) {
    throw new Error('Ori stream returned an empty body.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalEvent: OriginAiStreamFinalEvent | null = null;

  const handlePayload = async (raw: string) => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }

    const type = typeof payload.type === 'string' ? payload.type : '';
    if (type === 'text' && typeof payload.delta === 'string' && payload.delta) {
      handlers.onTextDelta?.(payload.delta);
      return;
    }
    if (type === 'audio' && typeof payload.data === 'string' && payload.data) {
      await handlers.onAudio?.({
        type: 'audio',
        sequence: Number(payload.sequence ?? 0),
        text: typeof payload.text === 'string' ? payload.text : undefined,
        data: payload.data,
        mimeType: typeof payload.mimeType === 'string' ? payload.mimeType : 'audio/wav',
        voiceName: typeof payload.voiceName === 'string' ? payload.voiceName : null,
      });
      return;
    }
    if (type === 'transcript') {
      handlers.onTranscript?.(
        typeof payload.text === 'string' ? payload.text : '',
        typeof payload.normalized_text === 'string' ? payload.normalized_text : undefined,
      );
      return;
    }
    if (type === 'error' || type === 'audio_error') {
      const message =
        typeof payload.message === 'string'
          ? payload.message
          : 'Ori could not complete this streamed response.';
      handlers.onError?.(message);
      if (type === 'error') {
        throw new Error(message);
      }
      return;
    }
    if (type === 'final') {
      finalEvent = payload as unknown as OriginAiStreamFinalEvent;
      handlers.onFinal?.(finalEvent);
      return;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      for (const line of rawEvent.split('\n')) {
        if (!line.startsWith('data:')) continue;
        await handlePayload(line.slice(5).trim());
      }
      separatorIndex = buffer.indexOf('\n\n');
    }
  }

  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      if (!line.startsWith('data:')) continue;
      await handlePayload(line.slice(5).trim());
    }
  }

  if (!finalEvent) {
    throw new Error('Ori stream ended before a final response arrived.');
  }
  return finalEvent;
}

export async function streamOriginAiMessage(
  message: string,
  pageContext?: OriginAiStreamPageContext,
  highlightedText?: string | null,
  threadId?: string | null,
  handlers: OriginAiStreamHandlers = {},
): Promise<OriginAiStreamFinalEvent> {
  const response = await openStreamRequest(
    '/origin-ai/session/stream',
    {
      message,
      pageContext,
      highlightedText: highlightedText || null,
      threadId: threadId ?? null,
    },
    handlers.signal,
  );
  return consumeSseStream(response, handlers);
}

export async function streamOriginAiVoiceRespond(
  audioData: string,
  mimeType: string,
  pageContext?: OriginAiStreamPageContext,
  voiceName?: string | null,
  highlightedText?: string | null,
  handlers: OriginAiStreamHandlers = {},
): Promise<OriginAiStreamFinalEvent> {
  const response = await openStreamRequest(
    '/origin-ai/voice/stream',
    {
      audioData,
      mimeType,
      voiceName,
      pageContext,
      highlightedText: highlightedText || null,
    },
    handlers.signal,
  );
  return consumeSseStream(response, handlers);
}
