'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronLeft, Send, ImagePlus,
  X, Sparkles, Plus, Atom,
  FlaskConical, Calculator, PanelLeft, PanelLeftClose
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DoubtSession, User, ChatMessage as ChatMessageType } from '@/types';
import {
  createDoubtSession,
  listDoubtSessions,
  sendSolverMessage,
  updateDoubtSessionTitle,
} from '@/features/ai-solver/client';
import { toast } from 'sonner';

const SESSION_CACHE_KEY = 'doubt_sessions_cache';

// Simple Markdown + LaTeX formatter for the UI
const FormattedText = ({ text }: { text: string }) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <span className="relative">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="text-foreground dark:text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return part;
      })}
    </span>
  );
};

interface DoubtSolverProps {
  onBack: () => void;
  user: User;
}

export default function DoubtSolver({ onBack, user }: DoubtSolverProps) {
  const [sessions, setSessions] = useState<DoubtSession[]>([]);
  const [activeSession, setActiveSession] = useState<DoubtSession | null>(null);
  const [viewMode, setViewMode] = useState<'selection' | 'chat'>('selection');

  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editingSidebarId, setEditingSidebarId] = useState<string | null>(null);
  const [sidebarEditValue, setSidebarEditValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionCacheKey = `${SESSION_CACHE_KEY}_${user.id}`;

  const persistSessionCache = useCallback((nextSessions: DoubtSession[]) => {
    const cacheData = nextSessions.map((session) => {
      const { messages, ...rest } = session;
      void messages;
      return rest;
    });
    try {
      localStorage.setItem(sessionCacheKey, JSON.stringify(cacheData));
    } catch {
      console.warn("Storage quota exceeded, cache not updated");
    }
  }, [sessionCacheKey]);

  const mergeReplyIntoSession = (
    baseSession: DoubtSession | null,
    reply: { session: DoubtSession; userMessage: ChatMessageType; aiMessage: ChatMessageType }
  ): DoubtSession => {
    const existingMessages = baseSession?.messages || [];
    const incomingMessages = reply.session.messages?.length
      ? reply.session.messages
      : [...existingMessages, reply.userMessage, reply.aiMessage];

    const dedupedMessages = incomingMessages.filter((message, index, all) => (
      all.findIndex(candidate => candidate.id === message.id) === index
    ));

    return {
      ...reply.session,
      messages: dedupedMessages,
    };
  };

  useEffect(() => {
    if (activeSession) {
      setEditedTitle(activeSession.title);
      setViewMode('chat');
    }
  }, [activeSession]);

  const handleUpdateTitle = async (sessionId?: string, newTitle?: string) => {
    const targetSessionId = sessionId || activeSession?.id;
    const targetTitle = newTitle || editedTitle;

    if (!targetSessionId || !targetTitle.trim()) {
      setIsEditingTitle(false);
      return;
    }

    try {
      const updated = await updateDoubtSessionTitle(targetSessionId, targetTitle.trim());
      if (activeSession?.id === updated.id) {
        setActiveSession(updated);
      }

      setSessions(prev => {
        const newSessions = prev.map(s => s.id === updated.id ? updated : s);
        persistSessionCache(newSessions);
        return newSessions;
      });
    } catch (error) {
      console.error("Failed to update title", error);
    }
    setIsEditingTitle(false);
  };

  useEffect(() => {
    // Load from cache first
    const cached = localStorage.getItem(sessionCacheKey);
    if (cached) {
      try {
        setSessions(JSON.parse(cached));
      } catch (e) {
        console.error("Failed to parse cache", e);
      }
    }

    const fetchSessions = async () => {
      try {
        const data = await listDoubtSessions();
        setSessions(data);
        persistSessionCache(data);
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      }
    };
    fetchSessions();
  }, [persistSessionCache, sessionCacheKey]);

  // Recording Timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.messages, isTyping]);

  const handleSendMessage = async () => {
    if (!message.trim() || !activeSession) return;

    const currentMessage = message;
    setMessage('');
    setIsTyping(true);

    try {
      const response = await sendSolverMessage(activeSession.id, { content: currentMessage });
      const mergedSession = mergeReplyIntoSession(activeSession, response);

      setActiveSession(mergedSession);
      setSessions(prev => {
        const nextSessions = prev.map(session => (
          session.id === mergedSession.id ? { ...mergedSession, messages: session.messages } : session
        ));
        persistSessionCache(nextSessions);
        return nextSessions;
      });
    } catch (error) {
      console.error("Failed to send message", error);
    } finally {
      setIsTyping(false);
    }
  };

  const createNewSession = async (title: string, subject?: string) => {
    try {
      const newSession = await createDoubtSession({ title, subject: subject || 'General' });
      setSessions(prev => {
        const existing = prev.some(session => session.id === newSession.id);
        const newSessions = existing
          ? prev.map(session => (session.id === newSession.id ? newSession : session))
          : [newSession, ...prev];
        persistSessionCache(newSessions);
        return newSessions;
      });
      setActiveSession(newSession);
      setViewMode('chat');
    } catch (error) {
      console.error("Failed to create session", error);
    }
  };

  const lastMentorSession = sessions[0];

  return (
    <div className="h-screen w-full bg-background text-foreground flex flex-col font-sans relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `radial-gradient(circle at 80% 30%, rgba(29, 78, 216, 0.15) 0%, transparent 40%),
                           radial-gradient(circle at 20% 70%, rgba(56, 189, 248, 0.1) 0%, transparent 40%)`
        }}>
      </div>

      {/* Fixed Header */}
      <header className="relative z-30 flex items-center justify-between px-6 py-4 border-b border-border/40 bg-card/60 backdrop-blur-xl flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (viewMode !== 'selection') {
                setViewMode('selection');
                setActiveSession(null);
              } else {
                onBack();
              }
            }}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </button>

          {viewMode === 'chat' && activeSession && !isSidebarOpen && (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg text-slate-400 hover:bg-white/5 transition-colors"
              title="Show Sidebar"
            >
              <PanelLeft className="w-5 h-5" />
            </button>
          )}

          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shadow-lg overflow-hidden">
              <img src="/ai-bot.png" alt="AI" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="flex flex-col">
            {viewMode === 'chat' && activeSession && isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTitle();
                    if (e.key === 'Escape') setIsEditingTitle(false);
                  }}
                  onBlur={() => handleUpdateTitle()}
                  className="bg-muted border border-blue-500/30 rounded px-2 py-0.5 text-sm text-foreground focus:outline-none focus:border-blue-500 w-40"
                />
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 ${activeSession ? 'cursor-pointer group' : ''}`}
                onClick={() => activeSession && setIsEditingTitle(true)}
              >
                <h1 className="text-xl font-bold text-foreground tracking-wide leading-none">
                  {viewMode === 'chat' && activeSession ? activeSession.title : 'AI Explainer'}
                </h1>
                {activeSession && (
                  <Sparkles className="w-3 h-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            )}
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">24/7 Academic Mentor</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-500/20 bg-green-500/5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400 uppercase">System Online</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 flex-1 flex overflow-hidden">
        {viewMode === 'selection' ? (
          <SelectionView
            onCreate={(title, sub) => createNewSession(title, sub)}
            onUpload={() => setShowImageUpload(true)}
            sessions={sessions}
            onSelectSession={setActiveSession}
            lastSession={lastMentorSession}
            onUpdateTitle={handleUpdateTitle}
          />
        ) : (
          <div className="flex-1 flex overflow-hidden relative">
            {/* Sidebar (Desktop Only) */}
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.aside
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 288, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="hidden lg:flex flex-col border-r border-border/40 bg-card/30 overflow-hidden"
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-6 px-2">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] flex-1">Recent Sessions</h3>
                      <button
                        onClick={() => setIsSidebarOpen(false)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-all outline-none"
                        title="Hide Sidebar"
                      >
                        <PanelLeftClose className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => createNewSession("New Physics Session", "Physics")}
                        className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-all"
                        title="New Chat"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2 overflow-y-auto pr-2 custom-scrollbar flex-1">
                      {sessions.map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            if (editingSidebarId !== s.id) setActiveSession(s);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setEditingSidebarId(s.id);
                            setSidebarEditValue(s.title);
                          }}
                          className={`w-full p-4 rounded-2xl transition-all text-left group cursor-pointer ${activeSession?.id === s.id ? 'bg-blue-500/10 border-blue-500/30 shadow-lg shadow-blue-500/5' : 'bg-background/40 border border-border/50 hover:border-blue-500/30'}`}
                          role="button"
                          tabIndex={0}
                        >
                          {editingSidebarId === s.id ? (
                            <input
                              autoFocus
                              value={sidebarEditValue}
                              onChange={(e) => setSidebarEditValue(e.target.value)}
                              onBlur={async () => {
                                if (sidebarEditValue.trim() && sidebarEditValue !== s.title) {
                                  await handleUpdateTitle(s.id, sidebarEditValue);
                                }
                                setEditingSidebarId(null);
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  if (sidebarEditValue.trim() && sidebarEditValue !== s.title) {
                                    await handleUpdateTitle(s.id, sidebarEditValue);
                                  }
                                  setEditingSidebarId(null);
                                }
                                if (e.key === 'Escape') setEditingSidebarId(null);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-white/10 border border-blue-500/50 rounded px-2 py-0.5 text-xs text-white w-full focus:outline-none"
                            />
                          ) : (
                            <>
                              <p className={`text-sm font-semibold truncate ${activeSession?.id === s.id ? 'text-blue-500' : 'text-muted-foreground group-hover:text-foreground'}`}>{s.title}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(s.updatedAt || s.createdAt).toLocaleDateString()}</p>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>

            {/* Chat Viewport */}
            {activeSession && (
              <section className="flex-1 flex flex-col h-full overflow-hidden bg-transparent">
                {/* Scrollable Message Area */}
                <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
                  <div className="max-w-4xl mx-auto space-y-8">
                    {activeSession.messages.map((msg, i) => (
                      <ChatMessage key={i} message={msg} />
                    ))}
                    {isTyping && <TypingIndicator />}
                    <div ref={messagesEndRef} className="h-4" />
                  </div>
                </div>

                {/* Fixed Bottom Input Bar */}
                <div className="p-6 bg-gradient-to-t from-background via-background to-transparent flex-shrink-0">
                  <div className="max-w-4xl mx-auto">
                    <div className={`bg-card/80 backdrop-blur-2xl border ${isRecording ? 'border-red-500/40 shadow-red-500/10' : 'border-border/60 shadow-2xl'} rounded-[28px] p-2 flex items-end gap-2 transition-all`}>
                      {!isRecording ? (
                        <>
                          <button onClick={() => toast.info("Coming soon, we are working on it")} className="p-3 text-slate-400 hover:text-white transition-colors">
                            <span className="w-5 h-5 flex items-center justify-center">📷</span>
                          </button>
                          <button onClick={() => toast.info("Coming soon, we are working on it")} className="p-3 text-slate-400 hover:text-blue-400 transition-colors">
                            <span className="w-5 h-5 flex items-center justify-center">🎤</span>
                          </button>
                          <textarea
                            rows={1}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            placeholder="Type your question here..."
                            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 placeholder:text-slate-500 py-3 text-[15px] resize-none max-h-40"
                          />
                        </>
                      ) : (
                        <div className="flex-1 flex items-center gap-4 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-red-500 font-bold text-sm">Recording {formatTime(recordingTime)}</span>
                          </div>
                          <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden relative">
                            <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
                          </div>
                          <button
                            onClick={() => setIsRecording(false)}
                            className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          if (isRecording) {
                            setIsRecording(false);
                            setMessage("Sent an audio question.");
                          } else {
                            handleSendMessage();
                          }
                        }}
                        disabled={!isRecording && !message.trim()}
                        className={`p-3 rounded-2xl transition-all ${isRecording
                          ? 'bg-red-500 text-white shadow-lg shadow-red-600/30'
                          : (message.trim() ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white/5 text-slate-600 cursor-not-allowed')}`}
                      >
                        {isRecording ? <div className="w-5 h-5 flex items-center justify-center font-bold">●</div> : <Send className="w-5 h-5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <img src="/O3-Origin-Logo.png" alt="O3 Origin" className="h-4 w-auto" />
                      <p className="text-[10px] text-slate-600 font-medium uppercase tracking-widest">
                        AI Mentor • Powered by O3 Origin
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {showImageUpload && (
        <ImageUploadModal
          onClose={() => setShowImageUpload(false)}
          onUpload={(file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const imageDataUrl = e.target?.result as string;

              const userMsg: ChatMessageType = {
                id: Date.now().toString(),
                role: 'user',
                content: "I've uploaded an image of a problem I'm stuck on. Can you help me solve it?",
                timestamp: new Date(),
                image: imageDataUrl
              };

              const handleImageUpload = async () => {
                let sessionId = activeSession?.id;
                if (!sessionId) {
                  try {
                    const newSession = await createDoubtSession({ title: "Physics - Image Analysis", subject: "Physics" });
                    sessionId = newSession.id;
                    setSessions(prev => {
                      const newSessions = [newSession, ...prev];
                      persistSessionCache(newSessions);
                      return newSessions;
                    });
                    setActiveSession({
                      ...newSession,
                      messages: [userMsg]
                    });
                  } catch (error) { console.error(error); return; }
                } else {
                  setActiveSession(prev => prev ? { ...prev, messages: [...prev.messages, userMsg], updatedAt: new Date() } : null);
                }

                setShowImageUpload(false);
                setIsTyping(true);

                try {
                  const response = await sendSolverMessage(sessionId, { content: userMsg.content, image: imageDataUrl });
                  const mergedSession = mergeReplyIntoSession(activeSession, response);

                  setActiveSession(mergedSession);
                  setSessions(prev => {
                    const exists = prev.some(session => session.id === mergedSession.id);
                    const nextSessions = !exists
                      ? [{ ...mergedSession, messages: [] }, ...prev]
                      : prev.map(session => (
                      session.id === mergedSession.id ? { ...mergedSession, messages: session.messages } : session
                    ));
                    persistSessionCache(nextSessions);
                    return nextSessions;
                  });
                } catch (error) {
                  console.error("Failed to upload image", error);
                } finally {
                  setIsTyping(false);
                }
              };

              handleImageUpload();
            };
            reader.readAsDataURL(file);
          }}
        />
      )}
    </div >
  );
}

function SelectionView({ onCreate, onUpload, sessions, onSelectSession, lastSession, onUpdateTitle }: {
  onCreate: (t: string, sub: string) => void,
  onUpload: () => void,
  sessions: DoubtSession[],
  onSelectSession: (s: DoubtSession) => void,
  lastSession?: DoubtSession,
  onUpdateTitle: (id: string, title: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const quickTopics = [
    { name: 'Physics', icon: Atom, color: 'text-blue-400', desc: 'Active & Interactive' },
    { name: 'Chemistry', icon: FlaskConical, color: 'text-emerald-400', desc: 'Mentor Ready' },
    { name: 'Mathematics', icon: Calculator, color: 'text-violet-400', desc: 'Mentor Ready' },
  ];

  const handleStartEdit = (e: React.MouseEvent<HTMLElement>, s: DoubtSession) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditValue(s.title);
  };

  const handleFinishEdit = async () => {
    if (editingId && editValue.trim()) {
      await onUpdateTitle(editingId, editValue);
    }
    setEditingId(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-12 overflow-y-auto custom-scrollbar">
      <div className="relative p-10 rounded-[40px] bg-gradient-to-br from-blue-600/10 to-indigo-600/5 border border-border/60 mb-12 overflow-hidden group shadow-xl">
        <Sparkles className="absolute top-6 right-8 w-12 h-12 text-blue-500/10 group-hover:rotate-12 transition-transform duration-700" />
        <h2 className="text-4xl font-bold text-foreground mb-4 leading-tight">Master your subjects<br />with AI precision.</h2>
        <p className="text-muted-foreground text-lg max-w-xl mb-8 leading-relaxed">Stuck on a problem at 2 AM? Get step-by-step guidance and conceptual deep-dives instantly.</p>
        <div className="flex flex-wrap gap-4">
          <button onClick={() => onCreate('New Physics Session', 'Physics')} className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-blue-600/20 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Start New Chat
          </button>
          {lastSession && (
            <button
              onClick={() => onSelectSession(lastSession)}
              className="px-8 py-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-500 rounded-2xl font-bold transition-all flex items-center gap-2"
            >
              Continue last chat
            </button>
          )}
          <button onClick={onUpload} className="px-8 py-4 bg-muted hover:bg-muted/80 border border-border/60 text-foreground rounded-2xl font-bold transition-all flex items-center gap-2 shadow-sm">
            <ImagePlus className="w-5 h-5" /> Scan Problem
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-widest text-blue-400/80">Subjects</h3>
          <div className="grid grid-cols-1 gap-4">
            {quickTopics.map((topic) => (
              <button
                key={topic.name}
                onClick={() => onCreate(`${topic.name} Doubt Session`, topic.name)}
                className="p-6 rounded-[28px] bg-card/40 border border-border/50 hover:border-blue-500/30 transition-all group flex items-center gap-6 shadow-sm hover:shadow-md"
              >
                <div className="w-14 h-14 rounded-2xl bg-muted border border-border/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner">
                  <topic.icon className={`w-7 h-7 ${topic.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground mb-0.5">{topic.name}</p>
                  <p className="text-xs text-muted-foreground">{topic.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-6 uppercase tracking-widest text-slate-500">History</h3>
          <div className="space-y-3">
            {sessions.slice(0, 4).map(s => (
              <div
                key={s.id}
                onClick={() => onSelectSession(s)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  handleStartEdit(e, s);
                }}
                className="w-full p-5 rounded-[28px] bg-card/30 border border-border/50 hover:bg-card/50 transition-all text-left flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md"
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center gap-4 flex-1 mr-4 overflow-hidden">
                  <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center flex-shrink-0">
                    <Atom className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {editingId === s.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFinishEdit();
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white/10 border border-blue-500/50 rounded px-2 py-0.5 text-sm text-white w-full focus:outline-none"
                      />
                    ) : (
                      <>
                        <div className="flex items-center gap-2 group/title">
                          <p className="text-sm font-bold text-foreground/80 group-hover:text-foreground transition-colors truncate">{s.title}</p>
                          <span
                            onClick={(e) => handleStartEdit(e, s)}
                            className="opacity-0 group-hover/title:opacity-100 p-1 rounded hover:bg-muted transition-all cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-blue-500" />
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(s.updatedAt || s.createdAt).toLocaleDateString()}</p>
                      </>
                    )}
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-600 rotate-180 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="p-10 text-center rounded-[28px] border border-dashed border-white/5">
                <p className="text-sm text-slate-500">No previous sessions found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function ProgressiveResponse({ content }: { content: string }) {
  const steps = content.split('<!-- step -->');
  const [revealedCount, setRevealedCount] = useState(1);
  const isMultiStep = steps.length > 1;

  if (!isMultiStep) {
    return <FormattedText text={content} />;
  }

  return (
    <div className="space-y-4">
      {steps.slice(0, revealedCount).map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className={i > 0 ? "pt-4 border-t border-white/5" : ""}
        >
          <FormattedText text={step.trim()} />
        </motion.div>
      ))}

      {revealedCount < steps.length && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setRevealedCount(prev => prev + 1)}
          className="mt-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-400 text-xs font-bold transition-all flex items-center gap-2 group"
        >
          {revealedCount === 1 ? 'Get Hint' : `Reveal Step ${revealedCount}`}
          <Sparkles className="w-3 h-3 group-hover:rotate-12 transition-transform" />
        </motion.button>
      )}
    </div>
  );
}

function ChatMessage({ message }: { message: ChatMessageType }) {
  const isAI = message.role === 'assistant';
  return (
    <div className={`flex w-full ${isAI ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
      <div className={`flex gap-4 max-w-[85%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
        {isAI && (
          <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-1 shadow-lg shadow-blue-900/20 overflow-hidden">
            <img src="/ai-bot.png" alt="AI" className="w-full h-full object-cover" />
          </div>
        )}
        <div className={`p-5 rounded-[28px] text-[15px] leading-relaxed shadow-xl ${isAI
          ? 'bg-card/60 backdrop-blur-md border border-border/60 text-foreground rounded-tl-none'
          : 'bg-blue-600 text-white border border-blue-400/30 rounded-tr-none shadow-blue-600/20'
          }`}>
          {message.image && (
            <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 max-w-[200px]">
              <img src={message.image} alt="Uploaded problem" className="w-full h-auto object-cover" />
            </div>
          )}
          <div className="whitespace-pre-line">
            {isAI ? (
              <ProgressiveResponse content={message.content} />
            ) : (
              <FormattedText text={message.content} />
            )}
          </div>
          <div className={`text-[10px] mt-3 font-bold uppercase tracking-widest opacity-40 ${isAI ? 'text-slate-400' : 'text-blue-100'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start gap-4">
      <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center overflow-hidden">
        <img src="/ai-bot.png" alt="AI Thinking" className="w-full h-full object-cover animate-pulse" />
      </div>
      <div className="px-6 py-4 bg-white/[0.04] border border-white/5 rounded-[28px] rounded-tl-none flex gap-1.5 items-center">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
      </div>
    </div>
  );
}


function ImageUploadModal({ onClose, onUpload }: { onClose: () => void, onUpload: (file: File) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0A1128] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-white">Visual Problem Solver</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/*"
          onChange={handleFileChange}
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/10 rounded-3xl p-12 text-center group hover:border-blue-500/50 transition-all cursor-pointer bg-white/[0.02]"
        >
          <div className="w-12 h-12 text-blue-500 mx-auto mb-6 group-hover:scale-110 transition-transform flex items-center justify-center">📷</div>
          <p className="text-lg font-semibold text-white mb-2">Snap or Drag Problem</p>
          <p className="text-sm text-slate-500">Supports handwriting and textbook scans</p>
        </div>
      </div>
    </div>
  );
}
