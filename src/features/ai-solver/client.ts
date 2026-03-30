import { apiCall } from '@/lib/api';
import type { DoubtSession, ChatMessage } from '@/types';

type RawMessage = ChatMessage & {
  timestamp: string | Date;
};

type RawSession = DoubtSession & {
  createdAt: string | Date;
  updatedAt: string | Date;
  messages?: RawMessage[];
};

export interface SolverReply {
  userMessage: ChatMessage;
  aiMessage: ChatMessage;
  session: DoubtSession;
}

const normalizeMessage = (message: RawMessage): ChatMessage => ({
  ...message,
  timestamp: new Date(message.timestamp),
});

const normalizeSession = (session: RawSession): DoubtSession => ({
  ...session,
  createdAt: new Date(session.createdAt),
  updatedAt: new Date(session.updatedAt),
  messages: (session.messages || []).map(normalizeMessage),
});

export const listDoubtSessions = async (): Promise<DoubtSession[]> => {
  const data = await apiCall('/interaction/doubts/');
  return (data as RawSession[]).map(normalizeSession);
};

export const createDoubtSession = async (payload: { title: string; subject: string }): Promise<DoubtSession> => {
  const data = await apiCall('/interaction/doubts/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return normalizeSession(data as RawSession);
};

export const updateDoubtSessionTitle = async (sessionId: string, title: string): Promise<DoubtSession> => {
  const data = await apiCall(`/interaction/doubts/${sessionId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
  return normalizeSession(data as RawSession);
};

export const sendSolverMessage = async (
  sessionId: string,
  payload: { content?: string; image?: string }
): Promise<SolverReply> => {
  const data = await apiCall(`/interaction/doubts/${sessionId}/add_message/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    userMessage: normalizeMessage(data.userMessage as RawMessage),
    aiMessage: normalizeMessage(data.aiMessage as RawMessage),
    session: normalizeSession(data.session as RawSession),
  };
};
