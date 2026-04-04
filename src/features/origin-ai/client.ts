import { apiCall } from '@/lib/api';
import { getOriginAiBrowserSessionId } from '@/features/origin-ai/session';
import type {
  ChatMessage,
  OriginAiPageKind,
  OriginAiReminder,
  OriginAiReply,
  OriginAiSession,
  OriginAiSnapshot,
  OriginAiVoiceBootstrap,
  OriginAiVisibleQuestion,
} from '@/types';

type RawMessage = ChatMessage & {
  timestamp: string | Date;
};

type RawReminder = Omit<OriginAiReminder, 'createdAt'> & {
  createdAt: string | Date;
};

type RawSession = Omit<OriginAiSession, 'createdAt' | 'updatedAt' | 'messages'> & {
  createdAt: string | Date;
  updatedAt: string | Date;
  messages?: RawMessage[];
};

type RawSnapshot = Omit<OriginAiSnapshot, 'session' | 'reminders'> & {
  session: RawSession;
  reminders: RawReminder[];
};

type RawReply = Omit<OriginAiReply, 'session' | 'reminders' | 'userMessage' | 'aiMessage'> & {
  session: RawSession;
  reminders: RawReminder[];
  userMessage: RawMessage;
  aiMessage: RawMessage;
};

type RawVoiceBootstrap = Omit<OriginAiVoiceBootstrap, 'session' | 'reminders'> & {
  session: RawSession;
  reminders: RawReminder[];
};

export interface OriginAiClientPageContext {
  pathname?: string;
  pageKind?: OriginAiPageKind;
  testId?: string | null;
  questionId?: string | null;
  searchQuery?: string | null;
  activeSubject?: string | null;
  activeDifficulty?: string | null;
  activeStatus?: string | null;
  selectedChapters?: string[];
  totalVisibleQuestions?: number | null;
  visibleQuestions?: OriginAiVisibleQuestion[];
}

const normalizeMessage = (message: RawMessage): ChatMessage => ({
  ...message,
  timestamp: new Date(message.timestamp),
});

const normalizeReminder = (reminder: RawReminder): OriginAiReminder => ({
  ...reminder,
  createdAt: new Date(reminder.createdAt),
});

const normalizeSession = (session: RawSession): OriginAiSession => ({
  ...session,
  createdAt: new Date(session.createdAt),
  updatedAt: new Date(session.updatedAt),
  messages: (session.messages || []).map(normalizeMessage),
});

const normalizeSnapshot = (snapshot: RawSnapshot): OriginAiSnapshot => ({
  ...snapshot,
  session: normalizeSession(snapshot.session),
  reminders: snapshot.reminders.map(normalizeReminder),
});

const normalizeReply = (reply: RawReply): OriginAiReply => ({
  ...reply,
  session: normalizeSession(reply.session),
  reminders: reply.reminders.map(normalizeReminder),
  userMessage: normalizeMessage(reply.userMessage),
  aiMessage: normalizeMessage(reply.aiMessage),
});

const normalizeVoiceBootstrap = (bootstrap: RawVoiceBootstrap): OriginAiVoiceBootstrap => ({
  ...bootstrap,
  session: normalizeSession(bootstrap.session),
  reminders: bootstrap.reminders.map(normalizeReminder),
});

function buildQuery(pageContext?: OriginAiClientPageContext): string {
  if (!pageContext) {
    return '';
  }

  const params = new URLSearchParams();
  if (pageContext.pathname) params.set('pathname', pageContext.pathname);
  if (pageContext.pageKind) params.set('pageKind', pageContext.pageKind);
  if (pageContext.testId) params.set('testId', pageContext.testId);
  if (pageContext.questionId) params.set('questionId', pageContext.questionId);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function buildOriginAiPageContext(pathname: string): OriginAiClientPageContext {
  const result: OriginAiClientPageContext = { pathname };

  if (/^\/tests\/[^/]+\/result$/.test(pathname)) {
    result.pageKind = 'test_result';
    result.testId = pathname.split('/')[2];
    return result;
  }

  if (/^\/tests\/[^/]+$/.test(pathname)) {
    result.pageKind = 'test_active';
    result.testId = pathname.split('/')[2];
    return result;
  }

  if (pathname === '/tests') {
    result.pageKind = 'tests_index';
    return result;
  }

  if (/^\/ogcode\/[^/]+$/.test(pathname)) {
    result.pageKind = 'ogcode_question';
    result.questionId = pathname.split('/')[2];
    return result;
  }

  if (pathname === '/ogcode') {
    result.pageKind = 'ogcode_index';
    return result;
  }

  if (pathname === '/dashboard') {
    result.pageKind = 'dashboard';
  } else if (pathname === '/dpp') {
    result.pageKind = 'dpp';
  } else if (pathname === '/study-corner') {
    result.pageKind = 'study_corner';
  } else if (pathname === '/pomodoro') {
    result.pageKind = 'pomodoro';
  } else if (pathname === '/profile') {
    result.pageKind = 'profile';
  } else if (pathname === '/tasks') {
    result.pageKind = 'tasks';
  } else if (pathname === '/doubt-solver') {
    result.pageKind = 'doubt_solver';
  } else {
    result.pageKind = 'unknown';
  }

  return result;
}

export async function getOriginAiSession(pageContext?: OriginAiClientPageContext): Promise<OriginAiSnapshot> {
  const data = await apiCall(`/origin-ai/session${buildQuery(pageContext)}`, {
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
  });
  return normalizeSnapshot(data as RawSnapshot);
}

export async function sendOriginAiMessage(
  message: string,
  pageContext?: OriginAiClientPageContext,
): Promise<OriginAiReply> {
  const data = await apiCall('/origin-ai/session/message', {
    method: 'POST',
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
    body: JSON.stringify({
      message,
      pageContext,
    }),
  });

  return normalizeReply(data as RawReply);
}

export async function getOriginAiVoiceBootstrap(
  pageContext?: OriginAiClientPageContext,
): Promise<OriginAiVoiceBootstrap> {
  const data = await apiCall('/origin-ai/voice/bootstrap', {
    method: 'POST',
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
    body: JSON.stringify({
      pageContext,
    }),
  });

  return normalizeVoiceBootstrap(data as RawVoiceBootstrap);
}

export async function persistOriginAiVoiceTurn(
  userTranscript: string,
  assistantTranscript: string,
  pageContext?: OriginAiClientPageContext,
  liveMetadata?: {
    liveSessionId?: string | null;
    responseId?: string | null;
    model?: string | null;
    transport?: 'gemini_live';
    interrupted?: boolean;
    completionReason?: 'turn_complete' | 'interrupted' | 'manual_stop' | 'unknown';
    assistantAudioChunkCount?: number;
    assistantTranscriptChunkCount?: number;
    hadOutputTranscript?: boolean;
  },
): Promise<OriginAiReply> {
  const data = await apiCall('/origin-ai/voice/turn', {
    method: 'POST',
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
    body: JSON.stringify({
      userTranscript,
      assistantTranscript,
      pageContext,
      liveSessionId: liveMetadata?.liveSessionId ?? null,
      responseId: liveMetadata?.responseId ?? null,
      model: liveMetadata?.model ?? null,
      transport: liveMetadata?.transport ?? 'gemini_live',
      interrupted: liveMetadata?.interrupted ?? false,
      completionReason: liveMetadata?.completionReason ?? 'unknown',
      assistantAudioChunkCount: liveMetadata?.assistantAudioChunkCount ?? 0,
      assistantTranscriptChunkCount: liveMetadata?.assistantTranscriptChunkCount ?? 0,
      hadOutputTranscript: liveMetadata?.hadOutputTranscript ?? false,
    }),
  });

  return normalizeReply(data as RawReply);
}
