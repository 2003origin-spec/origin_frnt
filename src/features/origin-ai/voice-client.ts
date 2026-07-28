import {
  getOriginAiVoiceBootstrap,
  sendOriginAiMessageStreaming,
  type OriginAiClientPageContext,
} from '@/features/origin-ai/client';
import { getOriginAiBrowserSessionId } from '@/features/origin-ai/session';
import type { OriginAiReply, OriginAiVoiceStatus } from '@/types';

export interface OriginAiVoiceCallbacks {
  onStatusChange?: (status: OriginAiVoiceStatus) => void;
  onUserTranscript?: (text: string) => void;
  onAssistantTranscript?: (text: string) => void;
  onReplyCommitted?: (reply: OriginAiReply) => void;
  onError?: (message: string) => void;
}

export interface OriginAiVoiceController {
  stop: () => Promise<void>;
  isActive: () => boolean;
}

interface SpeechRecognitionPipeline {
  stop: () => void;
  finalizeActivity: () => void;
}

interface AudioPlayer {
  enqueue: (base64Data: string, mimeType?: string | null) => Promise<void>;
  interrupt: () => void;
  isPlaying: () => boolean;
  close: () => Promise<void>;
}

const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;
const ASSISTANT_PLAYBACK_GAP_GRACE_MS = 900;
const VOICE_RESPOND_TIMEOUT_MS = 180000;

function emitStatus(callbacks: OriginAiVoiceCallbacks, status: OriginAiVoiceStatus): void {
  callbacks.onStatusChange?.(status);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function base64ToBytes(base64Data: string): Uint8Array {
  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function parseSampleRate(mimeType?: string | null): number {
  const match = mimeType?.match(/rate=(\d+)/i);
  return Number(match?.[1] || DEFAULT_OUTPUT_SAMPLE_RATE);
}

function pcmChunkToAudioBuffer(
  audioContext: AudioContext,
  base64Data: string,
  sampleRate: number,
  endian: 'big' | 'little',
): AudioBuffer | null {
  if (!base64Data.trim()) {
    return null;
  }

  const bytes = base64ToBytes(base64Data);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  if (sampleCount <= 0) {
    return null;
  }

  const buffer = audioContext.createBuffer(1, sampleCount, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const byteOffset = sampleIndex * 2;
    const first = bytes[byteOffset] ?? 0;
    const second = bytes[byteOffset + 1] ?? 0;
    const high = endian === 'big' ? first : second;
    const low = endian === 'big' ? second : first;
    let value = (high << 8) | low;
    if (value >= 0x8000) {
      value -= 0x10000;
    }
    channel[sampleIndex] = value / 0x8000;
  }

  return buffer;
}

async function decodeAudioBuffer(
  audioContext: AudioContext,
  base64Data: string,
  mimeType?: string | null,
): Promise<AudioBuffer | null> {
  if (!base64Data.trim()) {
    return null;
  }

  // Gemini TTS returns raw 16-bit little-endian PCM, even when the MIME is audio/L16.
  const normalizedMimeType = mimeType?.toLowerCase();
  const isRawPcm = normalizedMimeType?.includes('audio/pcm') || normalizedMimeType?.includes('audio/l16');
  if (isRawPcm) {
    return pcmChunkToAudioBuffer(audioContext, base64Data, parseSampleRate(mimeType), 'little');
  }

  const bytes = base64ToBytes(base64Data);
  const arrayBuffer = Uint8Array.from(bytes).buffer;
  return audioContext.decodeAudioData(arrayBuffer);
}

function createAudioPlayer(callbacks: OriginAiVoiceCallbacks, onIdle: () => void): AudioPlayer {
  // iOS Safari (mobile) exposes the constructor only as `webkitAudioContext`,
  // so fall back to it — otherwise voice mode throws on mobile.
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('This browser does not support audio playback for voice mode.');
  }
  const audioContext = new AudioContextCtor();
  const activeSources = new Set<AudioBufferSourceNode>();
  let nextPlaybackTime = 0;

  void audioContext.resume().catch(() => {
    // browser will retry on user interaction
  });

  return {
    enqueue: async (base64Data: string, mimeType?: string | null) => {
      const audioBuffer = await decodeAudioBuffer(audioContext, base64Data, mimeType);
      if (!audioBuffer) {
        return;
      }

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);

      const startAt = Math.max(audioContext.currentTime + 0.02, nextPlaybackTime || audioContext.currentTime + 0.02);
      nextPlaybackTime = startAt + audioBuffer.duration;
      activeSources.add(source);
      emitStatus(callbacks, 'speaking');

      source.onended = () => {
        activeSources.delete(source);
        source.disconnect();
        if (activeSources.size === 0) {
          nextPlaybackTime = audioContext.currentTime;
          onIdle();
        }
      };

      source.start(startAt);
    },
    interrupt: () => {
      for (const source of activeSources) {
        try {
          source.stop();
        } catch {
          // already stopped
        }
        source.disconnect();
      }
      activeSources.clear();
      nextPlaybackTime = audioContext.currentTime;
    },
    isPlaying: () => activeSources.size > 0 || nextPlaybackTime > audioContext.currentTime + 0.01,
    close: async () => {
      for (const source of activeSources) {
        try {
          source.stop();
        } catch {
          // ignore shutdown race
        }
        source.disconnect();
      }
      activeSources.clear();
      nextPlaybackTime = audioContext.currentTime;
      await audioContext.close();
    },
  };
}

function pickBrowserSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) {
    return null;
  }

  // Prefer friendly male voices for a teacher-like tone
  const malePreferredNames = ['daniel', 'alex', 'aaron', 'arthur', 'fred', 'mark', 'tom', 'google uk english male', 'google us english male', 'oliver', 'george'];
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  const preferred =
    englishVoices.find((voice) =>
      malePreferredNames.some((name) => voice.name.toLowerCase().includes(name)),
    ) ?? englishVoices[0];

  return preferred ?? voices[0] ?? null;
}

async function speakWithBrowserFallback(text: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return;
  }

  const cleanText = cleanSpeechText(text);
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 0.92;
  const voice = pickBrowserSpeechVoice();
  if (voice) {
    utterance.voice = voice;
  }

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.warn('[OriginAI Voice] Browser speech error:', e);
      reject(new Error('Ori browser speech fallback failed.'));
    };
    window.speechSynthesis.cancel();
    
    // Fix: Timeout prevents Mac/Safari from cancelling the utterance immediately after cancel()
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  });
}

/**
 * Strip markdown so browser speech fallback sounds natural.
 */
function cleanSpeechText(text: string): string {
  return text
    .replace(/[*_#`~>]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}


async function startSpeechRecognitionPipeline(

  isAssistantBusy: () => boolean,
  onUserTranscript: (text: string) => void,
  onUserTurnEnded: (text: string) => void,
): Promise<SpeechRecognitionPipeline> {
  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  if (!SpeechRecognitionCtor) {
    throw new Error('This browser does not support Web Speech API for voice mode. Please use Chrome, Edge or Safari.');
  }

  await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
    throw new Error('Microphone permission denied.');
  });

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';
  let isActive = true;
  let silenceTimeout: ReturnType<typeof setTimeout> | null = null;

  const resetSilenceTimeout = () => {
    if (silenceTimeout) clearTimeout(silenceTimeout);
    silenceTimeout = setTimeout(() => {
      if (finalTranscript.trim()) {
        finishTurn();
      }
    }, 700); // 0.7s of silence triggers completion
  };

  const finishTurn = () => {
    if (silenceTimeout) clearTimeout(silenceTimeout);
    if (!finalTranscript.trim()) return;
    const textToSubmit = finalTranscript.trim();
    finalTranscript = '';
    onUserTurnEnded(textToSubmit);
  };

  recognition.onresult = (event: any) => {
    if (isAssistantBusy()) {
      finalTranscript = '';
      return;
    }

    let interimTranscript = '';
    let currentFinal = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        currentFinal += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (currentFinal) {
      finalTranscript += ' ' + currentFinal;
      finalTranscript = finalTranscript.trim();
    }

    onUserTranscript((finalTranscript + ' ' + interimTranscript).trim());
    resetSilenceTimeout();
  };

  recognition.onerror = (event: any) => {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    console.warn('[OriginAI Voice] Speech recognition error:', event.error);
  };

  recognition.onend = () => {
    if (isActive && !isAssistantBusy()) {
      try {
        recognition.start();
      } catch (e) {
        // ignore already started
      }
    }
  };

  try {
    recognition.start();
  } catch (e) {
    // ignore
  }

  return {
    stop: () => {
      isActive = false;
      if (silenceTimeout) clearTimeout(silenceTimeout);
      try {
        recognition.stop();
      } catch (e) {}
    },
    finalizeActivity: finishTurn,
  };
}

export async function startOriginAiVoiceMode(
  pageContext: OriginAiClientPageContext | undefined,
  getHighlightedText: () => string | null | undefined,
  callbacks: OriginAiVoiceCallbacks,
): Promise<OriginAiVoiceController> {
  // Warm up the speech synthesis engine synchronously with the user interaction
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const warmUp = new SpeechSynthesisUtterance('');
    warmUp.volume = 0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(warmUp);
  }

  emitStatus(callbacks, 'bootstrapping');
  await getOriginAiVoiceBootstrap(pageContext);

  let isActive = true;
  let assistantPlaybackHoldUntil = 0;
  let isBrowserFallbackSpeaking = false;
  let ws: WebSocket | null = null;
  let audioStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let captureContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let vadTimer: number | null = null;
  let recordedChunks: Blob[] = [];
  let isRecordingUtterance = false;
  let speechStartedAt = 0;
  let lastLoudAt = 0;
  let isAwaitingTurn = false;

  const maybeReturnToListening = () => {
    if (!isActive) return;
    if (isAwaitingTurn) return;
    if (audioPlayer.isPlaying()) return;
    if (isBrowserFallbackSpeaking) return;
    if (Date.now() < assistantPlaybackHoldUntil) {
      window.setTimeout(maybeReturnToListening, assistantPlaybackHoldUntil - Date.now());
      return;
    }
    emitStatus(callbacks, 'listening');
  };

  const audioPlayer = createAudioPlayer(callbacks, maybeReturnToListening);

  const pickRecorderMimeType = (): string | undefined => {
    if (typeof MediaRecorder === 'undefined') return undefined;
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  };

  const blobToBase64 = async (blob: Blob): Promise<string> => {
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };

  const stopAndSendUtterance = async () => {
    if (!isActive || !mediaRecorder || mediaRecorder.state === 'inactive') return;
    if (isAwaitingTurn) return;

    await new Promise<void>((resolve) => {
      const recorder = mediaRecorder;
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });

    const mimeType = mediaRecorder?.mimeType || pickRecorderMimeType() || 'audio/webm';
    const blob = new Blob(recordedChunks, { type: mimeType });
    recordedChunks = [];
    isRecordingUtterance = false;

    if (!ws || ws.readyState !== WebSocket.OPEN || blob.size < 800) {
      // Restart listening recorder for next turn
      startUtteranceRecorder();
      return;
    }

    isAwaitingTurn = true;
    emitStatus(callbacks, 'thinking');
    const data = await blobToBase64(blob);
    ws.send(JSON.stringify({ type: 'utterance', data, mimeType }));
  };

  const startUtteranceRecorder = () => {
    if (!isActive || !audioStream || isAwaitingTurn) return;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') return;

    const mimeType = pickRecorderMimeType();
    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(audioStream, { mimeType })
        : new MediaRecorder(audioStream);
    } catch {
      callbacks.onError?.('This browser cannot record audio for voice mode.');
      return;
    }

    recordedChunks = [];
    isRecordingUtterance = false;
    speechStartedAt = 0;
    lastLoudAt = 0;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    mediaRecorder.start(250);
  };

  const startVad = () => {
    if (!audioStream) return;
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    captureContext = new AudioContextCtor();
    void captureContext.resume();
    const source = captureContext.createMediaStreamSource(audioStream);
    analyser = captureContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);
    vadTimer = window.setInterval(() => {
      if (!isActive || !analyser || isAwaitingTurn || audioPlayer.isPlaying()) return;
      analyser.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (let i = 0; i < data.length; i += 1) {
        const centered = ((data[i] ?? 128) - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      const now = Date.now();
      const speaking = rms > 0.045;

      if (speaking) {
        if (!isRecordingUtterance) {
          isRecordingUtterance = true;
          speechStartedAt = now;
        }
        lastLoudAt = now;
      } else if (isRecordingUtterance) {
        const spokenMs = now - speechStartedAt;
        const silentMs = now - lastLoudAt;
        // ~0.5s speech minimum, ~0.85s silence to cut
        if (spokenMs >= 500 && silentMs >= 850) {
          void stopAndSendUtterance();
        }
      }
    }, 100);
  };

  emitStatus(callbacks, 'connecting');

  try {
    audioStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
    });

    const baseUrl =
      process.env.NEXT_PUBLIC_ORIGIN_AI_SERVICE_URL ||
      `${window.location.protocol}//${window.location.host}`;
    const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/api/v1/voice/ws?browserSessionId=${encodeURIComponent(
      getOriginAiBrowserSessionId(),
    )}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (!isActive) return;
      emitStatus(callbacks, 'listening');
      startUtteranceRecorder();
      startVad();
    };

    ws.onmessage = async (event) => {
      if (!isActive) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status' && data.status) {
          if (data.status === 'listening') {
            isAwaitingTurn = false;
            startUtteranceRecorder();
          }
          if (data.status === 'thinking' || data.status === 'speaking') {
            isAwaitingTurn = true;
          }
          emitStatus(callbacks, data.status);
        } else if (data.type === 'transcript' && data.text) {
          callbacks.onUserTranscript?.(data.text);
        } else if (data.type === 'text' && data.delta) {
          callbacks.onAssistantTranscript?.(data.delta);
        } else if (data.type === 'audio' && data.data) {
          emitStatus(callbacks, 'speaking');
          await audioPlayer.enqueue(data.data, data.mimeType);
          assistantPlaybackHoldUntil = Date.now() + ASSISTANT_PLAYBACK_GAP_GRACE_MS;
          maybeReturnToListening();
        } else if (data.type === 'interruption') {
          audioPlayer.interrupt();
          isAwaitingTurn = false;
        } else if (data.type === 'error' && data.message) {
          isAwaitingTurn = false;
          callbacks.onError?.(data.message);
          startUtteranceRecorder();
          emitStatus(callbacks, 'listening');
        }
      } catch {
        // Not JSON or unhandled
      }
    };

    ws.onerror = () => {
      if (isActive) {
        callbacks.onError?.('WebSocket connection error.');
      }
    };

    ws.onclose = () => {
      if (isActive) {
        callbacks.onError?.('Voice session disconnected.');
        isActive = false;
      }
    };
  } catch {
    callbacks.onError?.('Could not access microphone or connect to voice service.');
    isActive = false;
  }

  return {
    stop: async () => {
      if (!isActive) return;
      isActive = false;

      try {
        if (vadTimer) {
          window.clearInterval(vadTimer);
          vadTimer = null;
        }
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.onstop = null;
          mediaRecorder.stop();
        }
        if (captureContext && captureContext.state !== 'closed') {
          await captureContext.close();
        }
        if (audioStream) {
          audioStream.getTracks().forEach((track) => track.stop());
        }
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        audioPlayer.interrupt();
      } catch {
        // ignore shutdown race
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isBrowserFallbackSpeaking = false;

      await audioPlayer.close();
      emitStatus(callbacks, 'idle');
    },
    isActive: () => isActive,
  };
}