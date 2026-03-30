'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  Play,
  Pause,
  RotateCcw,
  Settings,
  Coffee,
  Clock,
  Volume2,
  VolumeX,
  Flame,
  Target,
  CheckCircle2,
  X,
  History,
  Calendar,
  Maximize2,
  Minimize2,
  ShieldAlert
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { User } from '@/types';
import { apiCall } from '@/lib/api';
import { toast } from 'sonner';

import type { TimeType } from '@/hooks/useTimeTracker';

export interface PomodoroSession {
  id?: number;
  start_time: string;
  end_time?: string;
  duration: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  break_reason?: string;
  interruption_count?: number;
  is_completed: boolean;
}

const PREDEFINED_REASONS = [
  "Stretching / Movement",
  "Water / Snack",
  "Feeling Tired",
  "Distraction / Phone",
  "Bathroom Break",
  "Burnout Prevention",
  "Social Interaction",
  "Other"
];

const formatSessionDate = (dateStr: string | undefined) => {
  if (!dateStr) return { date: 'No Date', time: 'No Time' };
  try {
    const isoStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr;
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return { date: 'Invalid Date', time: 'Invalid Time' };

    return {
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  } catch (e) {
    return { date: 'Error Date', time: 'Error Time' };
  }
};

interface PomodoroProps {
  onBack: () => void;
  user: User;
  setTimeMode?: (mode: TimeType, subject?: string) => void;
  onNavigate?: (view: any) => void;
  onLock?: (locked: boolean) => void;
}

export default function Pomodoro({ onBack, user, setTimeMode, onNavigate: _onNavigate, onLock }: PomodoroProps) {
  const [mode, setMode] = useState<'focus' | 'shortBreak' | 'longBreak'>('focus');
  const [timeRemaining, setTimeRemaining] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);

  // Session History & Break Reason
  const [history, setHistory] = useState<PomodoroSession[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [currentSession, setCurrentSession] = useState<PomodoroSession | null>(null);

  // Live Editing State
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editTimeValue, setEditTimeValue] = useState("");

  // Navigation lock: prevent leaving during focus
  const [showNavLock, setShowNavLock] = useState(false);

  // Track pomodoro seconds to sync to daily analytics
  const pomodoroSecondsRef = useRef(0);
  const lastSyncedRef = useRef(0);

  // Continuous Alarm State
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const audioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nextMode, setNextMode] = useState<'focus' | 'shortBreak' | 'longBreak' | null>(null);

  const [settings, setSettings] = useState({
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4,
    alarmSound: 'classic' as 'classic' | 'digital' | 'bell',
    fullscreenFocus: true
  });
  
  const [interruptionCount, setInterruptionCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Today's Stats Calculation
  const { todaySessions, todayMinutes, focusRate } = useMemo(() => {
    const todayStr = new Date().toLocaleDateString();
    
    // Filter history for today's focus sessions
    const todayFocusSessions = history.filter(s => {
      const { date } = formatSessionDate(s.start_time);
      return date === todayStr && s.mode === 'focus';
    });

    // Sum historical duration (exclude current session ID to avoid double counting if part-synced)
    const historicalSecs = todayFocusSessions
      .filter(s => s.id !== currentSession?.id)
      .reduce((acc, s) => acc + s.duration, 0);
    
    // Add live seconds from current active session
    let liveSecs = 0;
    if (isRunning && mode === 'focus') {
      liveSecs = Math.max(0, modes[mode].defaultTime - timeRemaining);
    }

    const totalSecs = historicalSecs + liveSecs;
    
    // Sessions card: count completed sessions today
    const completedCount = todayFocusSessions.filter(s => s.is_completed).length;
    
    // Focus Rate: Completed / Total Focus Sessions for today
    const rate = todayFocusSessions.length > 0 
      ? Math.round((completedCount / todayFocusSessions.length) * 100) 
      : 100;

    return {
      todaySessions: completedCount,
      todayMinutes: Math.floor(totalSecs / 60),
      focusRate: rate
    };
  }, [history, timeRemaining, isRunning, mode, currentSession]);

  const modes = {
    focus: {
      label: 'Focus Time',
      color: 'from-[#3CACA3] to-[#1E3A5F]',
      bgColor: 'bg-[#3CACA3]/10',
      icon: () => <img src="/ai-bot.png" className="w-8 h-8 object-cover rounded-lg" />,
      defaultTime: settings.focusDuration * 60
    },
    shortBreak: {
      label: 'Short Break',
      color: 'from-green-400 to-green-500',
      bgColor: 'bg-green-100',
      icon: Coffee,
      defaultTime: settings.shortBreakDuration * 60
    },
    longBreak: {
      label: 'Long Break',
      color: 'from-blue-400 to-blue-500',
      bgColor: 'bg-blue-100',
      icon: Coffee,
      defaultTime: settings.longBreakDuration * 60
    },
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (mode === 'focus') {
            pomodoroSecondsRef.current += 1;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timeRemaining === 0 && isRunning) {
      setIsRunning(false);
      setIsAlarmRinging(true);

      let upcomingMode: 'focus' | 'shortBreak' | 'longBreak' = 'focus';

      if (mode === 'focus') {
        const newSessions = sessionsCompleted + 1;
        setSessionsCompleted(newSessions);
        // Determine what comes after the alarm is stopped
        if (newSessions % settings.sessionsBeforeLongBreak === 0) {
          upcomingMode = 'longBreak';
        } else {
          upcomingMode = 'shortBreak';
        }
      } else {
        // Break ended, switch back to focus
        upcomingMode = 'focus';
      }

      setNextMode(upcomingMode);

      if (soundEnabled) {
        startContinuousAlarm();
      }
    }

    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, mode, sessionsCompleted, settings, soundEnabled]);

  useEffect(() => {
    fetchHistory();
    if (setTimeMode) setTimeMode('pomodoro');

    return () => {
      stopContinuousAlarm();
      // Sync remaining seconds on unmount
      const remaining = pomodoroSecondsRef.current - lastSyncedRef.current;
      if (remaining > 0) {
        apiCall('/users/time/', {
          method: 'POST',
          body: JSON.stringify({ time_type: 'pomodoro', time_spent: remaining })
        }).catch(console.error);
      }
    };
  }, []);

  // Sync pomodoro time to analytics every 30 seconds
  useEffect(() => {
    if (!isRunning || mode !== 'focus') return;
    const interval = setInterval(() => {
      const elapsed = pomodoroSecondsRef.current - lastSyncedRef.current;
      if (elapsed > 0) {
        lastSyncedRef.current = pomodoroSecondsRef.current;
        apiCall('/users/time/', {
          method: 'POST',
          body: JSON.stringify({ time_type: 'pomodoro', time_spent: elapsed })
        }).catch(console.error);
      }
    }, 30000); // every 30s
    return () => clearInterval(interval);
  }, [isRunning, mode]);

  // Warn browser on tab close during focus session
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isRunning && mode === 'focus') {
        e.preventDefault();
        e.returnValue = 'You have an active focus session. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isRunning, mode]);

  // Tab switching detection (Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isRunning && mode === 'focus') {
        const timestamp = new Date().toLocaleTimeString();
        console.warn(`[Focus-Lock] User left the tab at ${timestamp}`);
        setInterruptionCount(prev => prev + 1);
        
        toast.error("Focus Interrupted! 🧠", {
          description: "You left the focus tab. This will be recorded as an interruption.",
          duration: 4000
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRunning, mode]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error(`Error attempting to toggle fullscreen: ${err}`);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await apiCall('/users/pomodoro/', { method: 'GET' });
      if (response && Array.isArray(response)) {
        setHistory(response);
        
        // Sync sessionsCompleted for break logic
        const todayStr = new Date().toLocaleDateString();
        const completedToday = response.filter(s => {
          const { date } = formatSessionDate(s.start_time);
          return date === todayStr && s.mode === 'focus' && s.is_completed;
        }).length;
        setSessionsCompleted(completedToday);
      }
    } catch (error) {
      console.error('Failed to fetch pomodoro history:', error);
    }
  };

  const startBackendSession = async (sMode: 'focus' | 'shortBreak' | 'longBreak') => {
    try {
      const resp = await apiCall('/users/pomodoro/', {
        method: 'POST',
        body: JSON.stringify({
          mode: sMode,
          duration: 0,
          is_completed: false
        })
      });
      if (resp && resp.id) {
        setCurrentSession(resp);
      }
    } catch (error) {
      console.error('Failed to start session in backend:', error);
    }
  };

  const updateBackendSession = async (sessionId: number, data: Partial<PomodoroSession>) => {
    try {
      await apiCall(`/users/pomodoro/${sessionId}/`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
      fetchHistory(); // Refresh
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  };

  const handleBack = () => {
    if (isRunning && mode === 'focus') {
      setShowNavLock(true);
      return;
    }
    if (onLock) onLock(false);
    if (setTimeMode) setTimeMode('webpage');
    onBack();
  };

  const handleForceLeave = () => {
    // Pause session and record it as stopped
    if (currentSession?.id) {
      updateBackendSession(currentSession.id, {
        is_completed: false,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }
    // Sync remaining pomodoro time
    const remaining = pomodoroSecondsRef.current - lastSyncedRef.current;
    if (remaining > 0) {
      apiCall('/users/time/', {
        method: 'POST',
        body: JSON.stringify({ time_type: 'pomodoro', time_spent: remaining })
      }).catch(console.error);
    }
    stopContinuousAlarm();
    if (onLock) onLock(false);
    if (setTimeMode) setTimeMode('webpage');
    onBack();
  };

  const playNotificationSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    const now = audioContext.currentTime;

    switch (settings.alarmSound) {
      case 'digital':
        // Rapid high-pitched beeps
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, now); // A5
        oscillator.frequency.setValueAtTime(1108.73, now + 0.1); // C#6

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
        gainNode.gain.setValueAtTime(0, now + 0.1);
        gainNode.gain.linearRampToValueAtTime(0.2, now + 0.15);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);

        oscillator.start(now);
        oscillator.stop(now + 0.25);
        break;

      case 'bell':
        // Smooth ringing sound with slow decay
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(800, now);

        // Add some harmonics for a bell-like quality
        const harmOsc = audioContext.createOscillator();
        const harmGain = audioContext.createGain();
        harmOsc.type = 'sine';
        harmOsc.frequency.setValueAtTime(1600, now);
        harmOsc.connect(harmGain);
        harmGain.connect(audioContext.destination);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);

        harmGain.gain.setValueAtTime(0, now);
        harmGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
        harmGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);

        oscillator.start(now);
        harmOsc.start(now);
        oscillator.stop(now + 1.5);
        harmOsc.stop(now + 1.5);
        break;

      case 'classic':
      default:
        // Standard beep
        oscillator.type = 'sine';
        oscillator.frequency.value = 800;

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

        oscillator.start(now);
        oscillator.stop(now + 0.5);
        break;
    }
  };

  const startContinuousAlarm = () => {
    playNotificationSound(); // Play immediately
    if (!audioIntervalRef.current) {
      audioIntervalRef.current = setInterval(() => {
        playNotificationSound();
      }, 1500); // Beep every 1.5 seconds
    }
  };

  const stopContinuousAlarm = () => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
  };


  const handleStopAlarm = () => {
    stopContinuousAlarm();
    setIsAlarmRinging(false);

    if (currentSession?.id) {
      updateBackendSession(currentSession.id, {
        is_completed: true,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }

    if (mode === 'focus') {
      if (onLock) onLock(false);
      setShowReasonModal(true);
    } else {
      if (nextMode) {
        setMode(nextMode);
        setTimeRemaining(modes[nextMode].defaultTime);
        setNextMode(null);
      }
      setCurrentSession(null);
    }
  };

  const submitBreakReason = async () => {
    const finalReason = selectedReason === "Other" ? customReason : selectedReason;
    if (!finalReason) {
      toast.error("Please provide a reason for the break");
      return;
    }

    setShowReasonModal(false);

    // Start the break session in backend with the reason
    if (nextMode) {
      setMode(nextMode);
      setTimeRemaining(modes[nextMode].defaultTime);

      try {
        const resp = await apiCall('/users/pomodoro/', {
          method: 'POST',
          body: JSON.stringify({
            mode: nextMode,
            duration: 0,
            is_completed: false,
            break_reason: finalReason
          })
        });
        if (resp && resp.id) {
          setCurrentSession(resp);
        }
      } catch (e) {
        console.error("Failed to log break start:", e);
      }

      setNextMode(null);
      setIsRunning(true); // Auto start break
    }

    setSelectedReason("");
    setCustomReason("");
  };


  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    if (isAlarmRinging) return;
    const newIsRunning = !isRunning;
    setIsRunning(newIsRunning);

    if (newIsRunning && !currentSession) {
      startBackendSession(mode);
      setInterruptionCount(0); // Reset for new session

      if (mode === 'focus' && settings.fullscreenFocus && !document.fullscreenElement) {
        toggleFullscreen();
      }
    }

    if (onLock) {
      onLock(newIsRunning && mode === 'focus');
    }
  };

  const resetTimer = () => {
    if (currentSession?.id && isRunning) {
      updateBackendSession(currentSession.id, {
        is_completed: false,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }
    setCurrentSession(null);
    setIsRunning(false);
    setIsAlarmRinging(false);
    stopContinuousAlarm();
    if (onLock) onLock(false);
    setTimeRemaining(modes[mode].defaultTime);
  };

  const switchMode = (newMode: 'focus' | 'shortBreak' | 'longBreak') => {
    if (currentSession?.id && isRunning) {
      updateBackendSession(currentSession.id, {
        is_completed: false,
        duration: Math.max(0, modes[mode].defaultTime - timeRemaining),
        interruption_count: interruptionCount,
        end_time: new Date().toISOString()
      });
    }
    setCurrentSession(null);

    setMode(newMode);
    setIsRunning(false);
    setIsEditingTime(false);
    setIsAlarmRinging(false);
    stopContinuousAlarm();
    if (onLock) onLock(false);
    setTimeRemaining(modes[newMode].defaultTime);
  };

  const handleTimeEditClick = () => {
    if (!isRunning) {
      setEditTimeValue(formatTime(timeRemaining));
      setIsEditingTime(true);
    }
  };

  const handleTimeEditSave = () => {
    setIsEditingTime(false);
    // Parse input (MM:SS or MM)
    const parts = editTimeValue.split(':');
    let newSeconds = 0;

    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseInt(parts[1], 10);
      if (!isNaN(m) && !isNaN(s)) {
        newSeconds = (m * 60) + s;
      }
    } else if (parts.length === 1) {
      const m = parseInt(parts[0], 10);
      if (!isNaN(m)) {
        newSeconds = m * 60;
      }
    }

    if (newSeconds > 0) {
      // Cap at 120 minutes
      newSeconds = Math.min(newSeconds, 120 * 60);
      setTimeRemaining(newSeconds);

      // Update the base setting so progress calculations remain accurate
      if (mode === 'focus') setSettings(prev => ({ ...prev, focusDuration: Math.ceil(newSeconds / 60) }));
      else if (mode === 'shortBreak') setSettings(prev => ({ ...prev, shortBreakDuration: Math.ceil(newSeconds / 60) }));
      else if (mode === 'longBreak') setSettings(prev => ({ ...prev, longBreakDuration: Math.ceil(newSeconds / 60) }));
    }
  };

  const handleTimeEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTimeEditSave();
    } else if (e.key === 'Escape') {
      setIsEditingTime(false);
    }
  };

  const currentMode = modes[mode];
  const progress = ((currentMode.defaultTime - timeRemaining) / currentMode.defaultTime) * 100;

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative overflow-auto">

      {/* ── NAV LOCK OVERLAY ── */}
      {showNavLock && (
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
              <Flame className="w-8 h-8 text-amber-500 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">🚫 Focus in Progress</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
              Your focus timer is still running! Leaving now will <span className="font-bold text-rose-500">interrupt your session</span>. 
              Stay locked in — you've got this!
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowNavLock(false)}
                className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] text-white font-bold hover:opacity-90 transition-all active:scale-95"
              >
                🔒 Stay Focused
              </button>
              <button
                onClick={handleForceLeave}
                className="w-full py-2.5 px-6 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Stop Timer & Leave
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="z-40 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3CACA3] to-[#1E3A5F] flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white">Focus Mode</h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Pomodoro Timer</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-[#3CACA3] text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                title="Session History"
              >
                <History className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                ) : (
                  <VolumeX className="w-5 h-5 text-slate-400" />
                )}
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Toggle Fullscreen"
              >
                {document.fullscreenElement ? (
                  <Minimize2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                ) : (
                  <Maximize2 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                )}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Settings className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Interruption Indicator */}
        {mode === 'focus' && isRunning && interruptionCount > 0 && (
          <div className="flex items-center gap-3 p-4 mb-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 animate-in slide-in-from-top duration-500">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-900 dark:text-rose-100">Focus Interrupted {interruptionCount} {interruptionCount === 1 ? 'time' : 'times'}</p>
              <p className="text-xs text-rose-600 dark:text-rose-400">Try to stay on this page to maintain your streak.</p>
            </div>
          </div>
        )}
        {/* Mode Selector */}
        <div className="flex justify-center gap-2 mb-8">
          {(['focus', 'shortBreak', 'longBreak'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${mode === m
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
            >
              {modes[m].label}
            </button>
          ))}
        </div>

        {/* Timer Display */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            {isAlarmRinging ? (
              <div className="w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center p-6 animate-in zoom-in duration-500">
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border-t-8 border-[#3CACA3] dark:ring-1 dark:ring-white/10 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#3CACA3] to-transparent animate-pulse"></div>

                  <div className="w-20 h-20 mx-auto bg-teal-50 dark:bg-teal-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner">
                    {mode === 'focus' ? (
                      <Target className="w-10 h-10 text-[#3CACA3] animate-bounce" />
                    ) : (
                      <Coffee className="w-10 h-10 text-[#3CACA3] animate-bounce" />
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                    {mode === 'focus' ? "Great Job!" : "Time's Up!"}
                  </h2>

                  <p className="text-slate-600 dark:text-slate-300 font-medium text-lg leading-relaxed mb-8">
                    {mode === 'focus' ? (
                      <>
                        <span className="font-bold text-[#3CACA3]">{user.name}</span>, you studied with intense focus for <span className="font-bold text-slate-900 dark:text-white">{settings.focusDuration} minutes</span>. Keep it up!
                      </>
                    ) : (
                      <>
                        Hey <span className="font-bold text-[#3CACA3]">{user.name}</span>, your break is over. It's time to get back to studying buddy!
                      </>
                    )}
                  </p>

                  <Button
                    onClick={handleStopAlarm}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] hover:opacity-90 text-white font-bold text-lg shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
                  >
                    {nextMode === 'focus' ? 'Start Focus Session' : 'Take a Break'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Circular Progress */}
                <svg className="w-72 h-72 sm:w-96 sm:h-96 transform -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-slate-200 dark:text-slate-800"
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="45%"
                    fill="none"
                    stroke="url(#timerGradient)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${progress * 2.83} 283`}
                    className="transition-all duration-1000"
                  />
                  <defs>
                    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={mode === 'focus' ? '#3CACA3' : mode === 'shortBreak' ? '#4ade80' : '#60a5fa'} />
                      <stop offset="100%" stopColor={mode === 'focus' ? '#1E3A5F' : mode === 'shortBreak' ? '#22c55e' : '#3b82f6'} />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Time Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentMode.color} flex items-center justify-center mb-4`}>
                    <currentMode.icon className="w-8 h-8 text-white" />
                  </div>

                  {isEditingTime ? (
                    <input
                      type="text"
                      value={editTimeValue}
                      onChange={(e) => setEditTimeValue(e.target.value.replace(/[^0-9:]/g, ''))}
                      onBlur={handleTimeEditSave}
                      onKeyDown={handleTimeEditKeyDown}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      className="w-48 text-center text-6xl sm:text-7xl font-bold bg-transparent border-b-2 border-[#3CACA3] focus:outline-none text-slate-900 dark:text-white font-mono"
                      placeholder="MM:SS"
                    />
                  ) : (
                    <div
                      onClick={handleTimeEditClick}
                      className={`text-6xl sm:text-7xl font-bold text-slate-900 dark:text-white font-mono ${!isRunning ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                      title={!isRunning ? "Click to edit time" : ""}
                    >
                      {formatTime(timeRemaining)}
                    </div>
                  )}

                  <p className="text-slate-500 dark:text-slate-400 mt-2">
                    {isRunning ? 'Running...' : 'Paused'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-8">
          {!isAlarmRinging && (
            <>
              <Button
                onClick={toggleTimer}
                className={`w-16 h-16 rounded-full bg-gradient-to-r ${currentMode.color} text-white hover:opacity-90 shadow-lg`}
              >
                {isRunning ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8 ml-1" />
                )}
              </Button>
              <Button
                onClick={resetTimer}
                variant="outline"
                className="w-16 h-16 rounded-full border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <RotateCcw className="w-6 h-6 dark:text-slate-200" />
              </Button>
            </>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-0 shadow-soft dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-2">
                <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{todaySessions}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sessions</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {todayMinutes}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Minutes</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-2">
                <Target className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {focusRate}%
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Focus Rate</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft">
            <CardContent className="p-4 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mb-2">
                <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {user.streak}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Day Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* History Side Panel */}
        <Sheet open={showHistory} onOpenChange={setShowHistory}>
          <SheetContent side="right" className="w-full sm:max-w-md dark:bg-slate-900 dark:border-slate-800 p-0 overflow-hidden flex flex-col">
            <SheetHeader className="p-6 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <History className="w-5 h-5 text-[#3CACA3]" />
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold dark:text-white">Recent Sessions</SheetTitle>
                  <SheetDescription className="dark:text-slate-400">Your focus and break history</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {history.map((session, idx) => {
                const { date, time } = formatSessionDate(session.start_time);
                return (
                  <div
                    key={session.id || idx}
                    className="flex flex-col p-4 rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-[#3CACA3]/30 transition-all shadow-sm group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${session.mode === 'focus' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                          }`}>
                          {session.mode === 'focus' ? <Target className="w-4 h-4" /> : <Coffee className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm capitalize dark:text-white">
                            {session.mode === 'focus' ? 'Focus Session' : 'Break'}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {date}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {time}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {Math.floor(session.duration / 60)}m {session.duration % 60}s
                        </p>
                        <p className={`text-[10px] font-bold tracking-wider ${session.is_completed ? 'text-green-500' : 'text-slate-400'}`}>
                          {session.is_completed ? 'COMPLETED' : 'INTERRUPTED'}
                        </p>
                      </div>
                    </div>

                    {session.break_reason && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-1 tracking-widest">Reason for rest</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic font-medium leading-relaxed">
                          "{session.break_reason}"
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {history.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-16 h-16 mx-auto rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <History className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="font-bold text-slate-900 dark:text-white mb-1">No history yet</p>
                  <p className="text-sm text-slate-500">Your sessions will appear here once you start using the timer.</p>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* Tips */}
        <Card className="border-0 shadow-soft mt-8 dark:bg-slate-900/60 dark:ring-1 dark:ring-white/10">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <img src="/ai-bot.png" className="w-5 h-5 object-cover rounded-sm" />
              Focus Tips
            </h3>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                Put your phone on silent and keep it away
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                Close all unnecessary tabs and apps
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                Take breaks seriously - they help you focus better
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                Stay hydrated and keep a water bottle nearby
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-white/10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Timer Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Focus Duration</label>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{settings.focusDuration} min</span>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex gap-2 mb-4">
                    {[25, 40, 100].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => {
                          setSettings({ ...settings, focusDuration: preset });
                          if (mode === 'focus' && !isRunning) {
                            setTimeRemaining(preset * 60);
                          }
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-md text-sm font-semibold transition-all ${settings.focusDuration === preset
                          ? 'bg-[#3CACA3] text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                      >
                        {preset} min
                      </button>
                    ))}
                  </div>

                  <Slider
                    value={[settings.focusDuration]}
                    onValueChange={(value) => {
                      setSettings({ ...settings, focusDuration: value[0] });
                      if (mode === 'focus' && !isRunning) {
                        setTimeRemaining(value[0] * 60);
                      }
                    }}
                    min={5}
                    max={120}
                    step={5}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Short Break</label>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{settings.shortBreakDuration} min</span>
                  </div>
                  <Slider
                    value={[settings.shortBreakDuration]}
                    onValueChange={(value) => setSettings({ ...settings, shortBreakDuration: value[0] })}
                    min={1}
                    max={30}
                    step={1}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Long Break</label>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{settings.longBreakDuration} min</span>
                  </div>
                  <Slider
                    value={[settings.longBreakDuration]}
                    onValueChange={(value) => setSettings({ ...settings, longBreakDuration: value[0] })}
                    min={5}
                    max={60}
                    step={5}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fullscreen Focus</label>
                    <p className="text-xs text-slate-500">Automatically enter fullscreen when focus starts</p>
                  </div>
                  <button
                    onClick={() => setSettings({ ...settings, fullscreenFocus: !settings.fullscreenFocus })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.fullscreenFocus ? 'bg-[#3CACA3]' : 'bg-slate-200 dark:bg-slate-700'
                      }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.fullscreenFocus ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alarm Sound</label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['classic', 'digital', 'bell'] as const).map((soundType) => (
                      <button
                        key={soundType}
                        onClick={() => {
                          setSettings({ ...settings, alarmSound: soundType });
                          // Small preview when selected
                          if (soundEnabled) {
                            // Temporary mock settings to play the sound immediately without relying on state update

                            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                            const oscillator = audioContext.createOscillator();
                            const gainNode = audioContext.createGain();
                            oscillator.connect(gainNode);
                            gainNode.connect(audioContext.destination);
                            const now = audioContext.currentTime;

                            if (soundType === 'digital') {
                              oscillator.type = 'square';
                              oscillator.frequency.setValueAtTime(880, now);
                              oscillator.frequency.setValueAtTime(1108.73, now + 0.1);
                              gainNode.gain.setValueAtTime(0, now);
                              gainNode.gain.linearRampToValueAtTime(0.2, now + 0.05);
                              gainNode.gain.setValueAtTime(0, now + 0.1);
                              gainNode.gain.linearRampToValueAtTime(0.2, now + 0.15);
                              gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
                              oscillator.start(now);
                              oscillator.stop(now + 0.25);
                            } else if (soundType === 'bell') {
                              oscillator.type = 'sine';
                              oscillator.frequency.setValueAtTime(800, now);
                              const harmOsc = audioContext.createOscillator();
                              const harmGain = audioContext.createGain();
                              harmOsc.type = 'sine';
                              harmOsc.frequency.setValueAtTime(1600, now);
                              harmOsc.connect(harmGain);
                              harmGain.connect(audioContext.destination);
                              gainNode.gain.setValueAtTime(0, now);
                              gainNode.gain.linearRampToValueAtTime(0.4, now + 0.05);
                              gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
                              harmGain.gain.setValueAtTime(0, now);
                              harmGain.gain.linearRampToValueAtTime(0.2, now + 0.05);
                              harmGain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
                              oscillator.start(now);
                              harmOsc.start(now);
                              oscillator.stop(now + 1.5);
                              harmOsc.stop(now + 1.5);
                            } else {
                              oscillator.type = 'sine';
                              oscillator.frequency.value = 800;
                              gainNode.gain.setValueAtTime(0.3, now);
                              gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                              oscillator.start(now);
                              oscillator.stop(now + 0.5);
                            }
                          }
                        }}
                        className={`py-2 px-3 rounded-md text-sm font-semibold capitalize transition-all ${settings.alarmSound === soundType
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md ring-2 ring-slate-900 dark:ring-white ring-offset-2 dark:ring-offset-slate-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                          }`}
                      >
                        {soundType}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sessions before Long Break</label>
                    <span className="text-sm text-slate-500 dark:text-slate-400">{settings.sessionsBeforeLongBreak}</span>
                  </div>
                  <Slider
                    value={[settings.sessionsBeforeLongBreak]}
                    onValueChange={(value) => setSettings({ ...settings, sessionsBeforeLongBreak: value[0] })}
                    min={2}
                    max={8}
                    step={1}
                  />
                </div>
              </div>

              <Button
                onClick={() => setShowSettings(false)}
                className="w-full mt-6 rounded-full bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] text-white"
              >
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </div>
      )
      }
      {/* Break Reason Modal */}
      {showReasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <Card className="w-full max-w-md border-0 shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-white/10 transform animate-in zoom-in-95 duration-300">
            <CardContent className="p-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                  <Coffee className="w-8 h-8 text-[#3CACA3]" />
                </div>
              </div>

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Well Deserved Break!</h3>
                <p className="text-slate-500 dark:text-slate-400">What's the main reason for this rest?</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason-select">Select a reason</Label>
                  <Select value={selectedReason} onValueChange={setSelectedReason}>
                    <SelectTrigger id="reason-select" className="h-12 dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue placeholder="Choose a reason..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedReason === "Other" && (
                  <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                    <Label htmlFor="custom-reason">Describe your reason</Label>
                    <Textarea
                      id="custom-reason"
                      placeholder="e.g., Quick call from parents..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="min-h-[100px] dark:bg-slate-800 dark:border-slate-700 resize-none"
                    />
                  </div>
                )}

                <Button
                  onClick={submitBreakReason}
                  className="w-full h-12 mt-4 bg-gradient-to-r from-[#3CACA3] to-[#1E3A5F] hover:opacity-90 text-white font-bold"
                >
                  Confirm & Start Break
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div >
  );
}
