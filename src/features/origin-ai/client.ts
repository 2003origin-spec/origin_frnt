import { apiCall } from '@/lib/api';
import { getOriginAiBrowserSessionId } from '@/features/origin-ai/session';
import type {
  ChatMessage,
  OriginAiPageContext,
  OriginAiPageKind,
  OriginAiReminder,
  OriginAiReply,
  OriginAiSession,
  OriginAiSnapshot,
  OriginAiVoiceReply,
  OriginAiVoiceSpeakResponse,
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

type RawVoiceReply = Omit<OriginAiVoiceReply, 'session' | 'reminders' | 'userMessage' | 'aiMessage'> & {
  session: RawSession;
  reminders: RawReminder[];
  userMessage: RawMessage;
  aiMessage: RawMessage;
};

type RawVoiceSpeakResponse = OriginAiVoiceSpeakResponse;

type ServiceMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  tokens_used?: number;
  created_at: string | Date;
};

type ServiceSnapshot = {
  session: {
    id: string;
    title?: string | null;
    is_active?: boolean;
    created_at: string | Date;
    updated_at?: string | Date | null;
  };
  memory: {
    preferred_name?: string | null;
    weak_topics?: string[];
    strong_topics?: string[];
    last_test_summary?: string | null;
    streak?: number;
    pending_dpps?: number;
    pending_assignments?: number;
  };
  messages: ServiceMessage[];
  policy: {
    mode: 'normal' | 'hint_only' | 'answer_blocked';
    title: string;
    reason: string;
  };
};

type ServiceReply = {
  answer: string;
  source: string;
  tokens_used?: number;
  provider?: string;
  session_id: string;
  user_message_id: string;
  ai_message_id: string;
  policy: {
    mode: 'normal' | 'hint_only' | 'answer_blocked';
    title: string;
    reason: string;
  };
};

type ServiceVoiceBootstrap = {
  session_id: string;
  voice_config: {
    provider: 'gemini';
    transport: 'server_voice';
    sttModel?: string;
    speechToTextModel?: string;
    ttsModel?: string;
    textToSpeechModel?: string;
    voiceName: string;
  };
};

type ServiceVoiceReply = {
  transcript: string;
  normalized_transcript?: string;
  answer: string;
  source: string;
  tokens_used?: number;
  provider?: string;
  session_id: string;
  user_message_id: string;
  ai_message_id: string;
  policy: {
    mode: 'normal' | 'hint_only' | 'answer_blocked';
    title: string;
    reason: string;
  };
  voice_audio?: OriginAiVoiceSpeakResponse['voiceAudio'] | null;
};

type ServiceVoiceSpeakResponse = {
  voice_audio?: OriginAiVoiceSpeakResponse['voiceAudio'] | null;
  voice_audio_segments?: OriginAiVoiceSpeakResponse['voiceAudio'][] | null;
  fallback_text?: string | null;
  synthesis_error?: string | null;
};

export interface OriginAiClientPageContext {
  pathname?: string;
  pageKind?: OriginAiPageKind;
  testId?: string | null;
  questionId?: string | null;
  questionHint?: string | null;
  questionSolution?: string | null;
  questionExplanation?: string | null;
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

const normalizeServiceMessage = (message: ServiceMessage): ChatMessage => ({
  id: message.id,
  role: message.role,
  content: message.content,
  timestamp: new Date(message.created_at),
  metadata: {
    source: message.source ?? 'ai',
    tokensUsed: message.tokens_used ?? 0,
  },
});

function buildFallbackPageContext(pageContext?: OriginAiClientPageContext): OriginAiPageContext {
  return {
    pathname: pageContext?.pathname ?? '/dashboard',
    pageKind: pageContext?.pageKind ?? 'unknown',
    testId: pageContext?.testId ?? null,
    questionId: pageContext?.questionId ?? null,
    title: null,
    subject: pageContext?.activeSubject ?? null,
    chapter: null,
    concept: null,
    hint: null,
    searchQuery: pageContext?.searchQuery ?? null,
    activeSubject: pageContext?.activeSubject ?? null,
    activeDifficulty: pageContext?.activeDifficulty ?? null,
    activeStatus: pageContext?.activeStatus ?? null,
    selectedChapters: pageContext?.selectedChapters ?? [],
    totalVisibleQuestions: pageContext?.totalVisibleQuestions ?? null,
    visibleQuestions: pageContext?.visibleQuestions ?? [],
  };
}

function buildIdentitySummary(memory: ServiceSnapshot['memory']): string {
  const parts: string[] = [];
  if (memory.preferred_name?.trim()) {
    parts.push(memory.preferred_name.trim());
  }
  if ((memory.weak_topics ?? []).length > 0) {
    parts.push(`weak topics: ${(memory.weak_topics ?? []).slice(0, 3).join(', ')}`);
  }
  if (typeof memory.streak === 'number' && memory.streak > 0) {
    parts.push(`streak: ${memory.streak}`);
  }
  return parts.join(' | ') || 'Origin AI is building your learning memory.';
}

function normalizeServiceSnapshot(
  snapshot: ServiceSnapshot,
  pageContext?: OriginAiClientPageContext,
): OriginAiSnapshot {
  const messages = (snapshot.messages ?? []).map(normalizeServiceMessage);
  const updatedAt =
    snapshot.session.updated_at ??
    messages[messages.length - 1]?.timestamp?.toISOString() ??
    snapshot.session.created_at;

  return {
    session: {
      id: snapshot.session.id,
      title: snapshot.session.title ?? 'Conversation',
      summary: null,
      lastPathname: pageContext?.pathname ?? null,
      lastPageKind: pageContext?.pageKind ?? null,
      createdAt: new Date(snapshot.session.created_at),
      updatedAt: new Date(updatedAt),
      messages,
    },
    memory: {
      preferredName: snapshot.memory.preferred_name?.trim() || 'Learner',
      identitySummary: buildIdentitySummary(snapshot.memory),
      pinnedFacts: [],
      lastWeakTopics: snapshot.memory.weak_topics ?? [],
      pendingDppCount: snapshot.memory.pending_dpps ?? 0,
      pendingAssignmentCount: snapshot.memory.pending_assignments ?? 0,
      currentStreak: snapshot.memory.streak ?? 0,
      lastTestSummary: snapshot.memory.last_test_summary ?? null,
    },
    reminders: [],
    pageContext: buildFallbackPageContext(pageContext),
    pagePolicy: {
      mode: snapshot.policy.mode,
      title: snapshot.policy.title,
      reason: snapshot.policy.reason,
    },
    provider: 'origin_ai_service',
  };
}

function isServiceSnapshot(value: unknown): value is ServiceSnapshot {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'memory' in value &&
      'messages' in value &&
      'policy' in value &&
      'session' in value,
  );
}

function isServiceReply(value: unknown): value is ServiceReply {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'answer' in value &&
      'session_id' in value &&
      'user_message_id' in value &&
      'ai_message_id' in value &&
      'policy' in value,
  );
}

function isServiceVoiceBootstrap(value: unknown): value is ServiceVoiceBootstrap {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'session_id' in value &&
      'voice_config' in value,
  );
}

function isServiceVoiceReply(value: unknown): value is ServiceVoiceReply {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'transcript' in value &&
      'answer' in value &&
      'session_id' in value &&
      'policy' in value,
  );
}

function toReplyFromSnapshot(
  snapshot: OriginAiSnapshot,
  userMessageId?: string,
  aiMessageId?: string,
): OriginAiReply {
  const reversed = [...snapshot.session.messages].reverse();
  const userMessage =
    snapshot.session.messages.find((message) => message.id === userMessageId) ??
    reversed.find((message) => message.role === 'user');
  const aiMessage =
    snapshot.session.messages.find((message) => message.id === aiMessageId) ??
    reversed.find((message) => message.role === 'assistant');

  if (!userMessage || !aiMessage) {
    throw new Error('Origin AI conversation sync did not return the latest messages.');
  }

  return {
    ...snapshot,
    userMessage,
    aiMessage,
  };
}

async function fetchSessionSnapshot(pageContext?: OriginAiClientPageContext): Promise<OriginAiSnapshot> {
  const data = await apiCall(`/origin-ai/session${buildQuery(pageContext)}`, {
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
  });

  if (isServiceSnapshot(data)) {
    return normalizeServiceSnapshot(data, pageContext);
  }

  return normalizeSnapshot(data as RawSnapshot);
}

const normalizeSnapshot = (snapshot: RawSnapshot): OriginAiSnapshot => ({
  ...snapshot,
  session: normalizeSession(snapshot.session),
  reminders: (snapshot.reminders ?? []).map(normalizeReminder),
});

const normalizeReply = (reply: RawReply): OriginAiReply => ({
  ...reply,
  session: normalizeSession(reply.session),
  reminders: (reply.reminders ?? []).map(normalizeReminder),
  userMessage: normalizeMessage(reply.userMessage),
  aiMessage: normalizeMessage(reply.aiMessage),
});

const normalizeVoiceBootstrap = (bootstrap: RawVoiceBootstrap): OriginAiVoiceBootstrap => ({
  ...bootstrap,
  session: normalizeSession(bootstrap.session),
  reminders: (bootstrap.reminders ?? []).map(normalizeReminder),
});

const normalizeVoiceReply = (reply: RawVoiceReply): OriginAiVoiceReply => ({
  ...reply,
  session: normalizeSession(reply.session),
  reminders: (reply.reminders ?? []).map(normalizeReminder),
  userMessage: normalizeMessage(reply.userMessage),
  aiMessage: normalizeMessage(reply.aiMessage),
});

const normalizeVoiceSpeakResponse = (response: RawVoiceSpeakResponse): OriginAiVoiceSpeakResponse => ({
  voiceAudio:
    response.voiceAudio ??
    (response as ServiceVoiceSpeakResponse).voice_audio ??
    null,
  voiceAudioSegments:
    response.voiceAudioSegments ??
    (response as ServiceVoiceSpeakResponse).voice_audio_segments ??
    (response.voiceAudio ? [response.voiceAudio] : []),
  fallbackText:
    response.fallbackText ??
    (response as ServiceVoiceSpeakResponse).fallback_text ??
    null,
  synthesisError:
    response.synthesisError ??
    (response as ServiceVoiceSpeakResponse).synthesis_error ??
    null,
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
  return fetchSessionSnapshot(pageContext);
}

export async function sendOriginAiMessage(
  message: string,
  pageContext?: OriginAiClientPageContext,
  highlightedText?: string | null,
): Promise<OriginAiReply> {
  const data = await apiCall('/origin-ai/session/message', {
    method: 'POST',
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
    body: JSON.stringify({
      message,
      pageContext,
      highlightedText: highlightedText || null,
    }),
  });

  if (isServiceReply(data)) {
    const snapshot = await fetchSessionSnapshot(pageContext);
    return toReplyFromSnapshot(snapshot, data.user_message_id, data.ai_message_id);
  }

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

  if (isServiceVoiceBootstrap(data)) {
    const snapshot = await fetchSessionSnapshot(pageContext);
    return {
      ...snapshot,
      browserSessionId: getOriginAiBrowserSessionId(),
      liveSystemInstruction: null,
      contextSeed: '',
      conversationSeed: snapshot.session.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      voice: {
        provider: data.voice_config.provider,
        transport: data.voice_config.transport,
        speechToTextModel: data.voice_config.speechToTextModel ?? data.voice_config.sttModel ?? 'gemini-2.5-flash',
        textToSpeechModel: data.voice_config.textToSpeechModel ?? data.voice_config.ttsModel ?? 'gemini-2.5-flash-preview-tts',
        voiceName: data.voice_config.voiceName,
      },
    };
  }

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
    assistantTextPartChunkCount?: number;
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
      assistantTextPartChunkCount: liveMetadata?.assistantTextPartChunkCount ?? 0,
      hadOutputTranscript: liveMetadata?.hadOutputTranscript ?? false,
    }),
  });

  return normalizeReply(data as RawReply);
}

export async function respondOriginAiVoiceAudio(
  audioData: string,
  mimeType: string,
  pageContext?: OriginAiClientPageContext,
  voiceName?: string | null,
): Promise<OriginAiVoiceReply> {
  const data = await apiCall('/origin-ai/voice/respond', {
    method: 'POST',
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
    body: JSON.stringify({
      audioData,
      mimeType,
      voiceName,
      pageContext,
    }),
  });

  if (isServiceVoiceReply(data)) {
    const snapshot = await fetchSessionSnapshot(pageContext);
    const reply = toReplyFromSnapshot(snapshot, data.user_message_id, data.ai_message_id);
    return {
      ...reply,
      userTranscript: data.normalized_transcript ?? data.transcript,
      assistantTranscript: data.answer,
      voiceAudio: data.voice_audio ?? null,
    };
  }

  return normalizeVoiceReply(data as RawVoiceReply);
}

export async function synthesizeOriginAiVoiceText(
  text: string,
  voiceName?: string | null,
): Promise<OriginAiVoiceSpeakResponse> {
  const data = await apiCall('/origin-ai/voice/speak', {
    method: 'POST',
    headers: {
      'X-Origin-AI-Session-Id': getOriginAiBrowserSessionId(),
    },
    body: JSON.stringify({
      text,
      voiceName,
    }),
  });

  return normalizeVoiceSpeakResponse(data as RawVoiceSpeakResponse);
}
