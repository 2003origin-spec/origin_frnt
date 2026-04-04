import { ActivityHandling, GoogleGenAI } from '@google/genai';

import {
  getOriginAiVoiceBootstrap,
  persistOriginAiVoiceTurn,
  type OriginAiClientPageContext,
} from '@/features/origin-ai/client';
import type { OriginAiReply, OriginAiVoiceStatus } from '@/types';

type LiveContentTurn = {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
};

type LiveSessionLike = {
  sendClientContent: (params: { turns: LiveContentTurn[]; turnComplete?: boolean }) => void;
  sendRealtimeInput: (params: {
    audio?: { data?: string; mimeType?: string };
    audioStreamEnd?: boolean;
    text?: string;
  }) => void;
  close: () => void;
};

type AudioContextLike = AudioContext & {
  createScriptProcessor?: (
    bufferSize?: number,
    inputChannels?: number,
    outputChannels?: number,
  ) => ScriptProcessorNode;
};

type LiveServerEventLike = {
  setupComplete?: { sessionId?: string };
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
    inputTranscription?: { text?: string };
    outputTranscription?: { text?: string };
    turnComplete?: boolean;
    interrupted?: boolean;
    waitingForInput?: boolean;
  };
};

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

interface MicrophonePipeline {
  stream: MediaStream;
  audioContext: AudioContextLike;
  sourceNode: MediaStreamAudioSourceNode;
  processorNode: ScriptProcessorNode;
  sinkNode: GainNode;
}

interface AudioPlayer {
  enqueue: (base64Data: string, mimeType?: string | null) => Promise<void>;
  interrupt: () => void;
  isPlaying: () => boolean;
  close: () => Promise<void>;
}

const INPUT_SAMPLE_RATE = 16000;
const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;
const PROCESSOR_BUFFER_SIZE = 2048;

function emitStatus(callbacks: OriginAiVoiceCallbacks, status: OriginAiVoiceStatus): void {
  callbacks.onStatusChange?.(status);
}

function float32ToBase64Pcm(input: Float32Array): string {
  const pcm = new Int16Array(input.length);

  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return window.btoa(binary);
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
    const low = bytes[byteOffset] ?? 0;
    const high = bytes[byteOffset + 1] ?? 0;
    let value = (high << 8) | low;
    if (value >= 0x8000) {
      value -= 0x10000;
    }
    channel[sampleIndex] = value / 0x8000;
  }

  return buffer;
}

function mergeTranscript(previous: string, incoming: string): string {
  const next = incoming.trim();
  if (!next) {
    return previous;
  }
  if (!previous) {
    return next;
  }
  if (next.startsWith(previous)) {
    return next;
  }
  if (previous.startsWith(next)) {
    return previous;
  }
  if (previous.includes(next)) {
    return previous;
  }
  return `${previous} ${next}`.trim();
}

function createAudioPlayer(callbacks: OriginAiVoiceCallbacks, onIdle: () => void): AudioPlayer {
  const AudioContextCtor = window.AudioContext;
  const audioContext = new AudioContextCtor();
  const activeSources = new Set<AudioBufferSourceNode>();
  let nextPlaybackTime = 0;

  void audioContext.resume().catch(() => {
    // browser will retry on user interaction
  });

  return {
    enqueue: async (base64Data: string, mimeType?: string | null) => {
      const audioBuffer = pcmChunkToAudioBuffer(audioContext, base64Data, parseSampleRate(mimeType));
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
          // already stopped
        }
        source.disconnect();
      }
      activeSources.clear();
      nextPlaybackTime = audioContext.currentTime;
      await audioContext.close();
    },
  };
}

async function startMicrophonePipeline(liveSession: LiveSessionLike): Promise<MicrophonePipeline> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const AudioContextCtor = window.AudioContext;
  const audioContext = new AudioContextCtor({ sampleRate: INPUT_SAMPLE_RATE }) as AudioContextLike;
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const processorNode = audioContext.createScriptProcessor?.(PROCESSOR_BUFFER_SIZE, 1, 1);

  if (!processorNode) {
    stream.getTracks().forEach((track) => track.stop());
    await audioContext.close();
    throw new Error('This browser cannot start Origin AI voice mode.');
  }

  const sinkNode = audioContext.createGain();
  sinkNode.gain.value = 0;

  processorNode.onaudioprocess = (event) => {
    const channelData = event.inputBuffer.getChannelData(0);
    if (!channelData || channelData.length === 0) {
      return;
    }

    liveSession.sendRealtimeInput({
      audio: {
        data: float32ToBase64Pcm(channelData),
        mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}`,
      },
    });
  };

  sourceNode.connect(processorNode);
  processorNode.connect(sinkNode);
  sinkNode.connect(audioContext.destination);

  return {
    stream,
    audioContext,
    sourceNode,
    processorNode,
    sinkNode,
  };
}

export async function startOriginAiVoiceMode(
  pageContext: OriginAiClientPageContext | undefined,
  callbacks: OriginAiVoiceCallbacks,
): Promise<OriginAiVoiceController> {
  emitStatus(callbacks, 'bootstrapping');
  const bootstrap = await getOriginAiVoiceBootstrap(pageContext);

  const ai = new GoogleGenAI({
    apiKey: bootstrap.voice.token,
    apiVersion: bootstrap.voice.apiVersion,
  });

  let isActive = true;
  let liveSessionId: string | null = null;
  let userTranscriptBuffer = '';
  let assistantTranscriptBuffer = '';
  let assistantTurnInProgress = false;
  let pendingCommitCount = 0;
  let microphonePipeline: MicrophonePipeline | null = null;

  const maybeReturnToListening = () => {
    if (!isActive) {
      return;
    }
    if (assistantTurnInProgress) {
      return;
    }
    if (audioPlayer.isPlaying()) {
      return;
    }
    if (pendingCommitCount > 0) {
      return;
    }
    emitStatus(callbacks, 'listening');
  };

  const audioPlayer = createAudioPlayer(callbacks, maybeReturnToListening);

  const queueTurnCommit = (
    userTranscript: string,
    assistantTranscript: string,
    interrupted: boolean,
  ) => {
    if (!assistantTranscript.trim()) {
      maybeReturnToListening();
      return;
    }

    pendingCommitCount += 1;
    callbacks.onUserTranscript?.(userTranscript);
    callbacks.onAssistantTranscript?.(assistantTranscript);

    void (async () => {
      try {
        const reply = await persistOriginAiVoiceTurn(
          userTranscript,
          assistantTranscript,
          pageContext,
          {
            liveSessionId,
            model: bootstrap.voice.model,
            transport: 'gemini_live',
            interrupted,
          },
        );
        callbacks.onReplyCommitted?.(reply);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Origin AI could not save the voice turn.';
        callbacks.onError?.(message);
        emitStatus(callbacks, 'error');
      } finally {
        pendingCommitCount = Math.max(0, pendingCommitCount - 1);
        maybeReturnToListening();
      }
    })();
  };

  const flushTurn = (interrupted: boolean) => {
    const userTranscript = userTranscriptBuffer.trim();
    const assistantTranscript = assistantTranscriptBuffer.trim();

    if (!userTranscript && !assistantTranscript) {
      maybeReturnToListening();
      return;
    }

    userTranscriptBuffer = '';
    assistantTranscriptBuffer = '';
    queueTurnCommit(userTranscript, assistantTranscript, interrupted);
  };

  emitStatus(callbacks, 'connecting');

  const liveConfig: Record<string, unknown> = {
    responseModalities: bootstrap.voice.responseModalities as never,
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: bootstrap.voice.voiceName,
        },
      },
    },
    realtimeInputConfig: {
      activityHandling:
        bootstrap.voice.interruptionBehavior === 'NO_INTERRUPTION'
          ? ActivityHandling.NO_INTERRUPTION
          : ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
    },
    inputAudioTranscription: bootstrap.voice.inputAudioTranscription ? {} : undefined,
    outputAudioTranscription: bootstrap.voice.outputAudioTranscription ? {} : undefined,
    sessionResumption: bootstrap.voice.sessionResumption ? {} : undefined,
    temperature: bootstrap.voice.temperature,
    maxOutputTokens: bootstrap.voice.maxOutputTokens,
  };

  if (bootstrap.voice.authMode === 'api_key' && bootstrap.liveSystemInstruction?.trim()) {
    liveConfig.systemInstruction = bootstrap.liveSystemInstruction.trim();
  }

  const liveSession = (await ai.live.connect({
    model: bootstrap.voice.model,
    config: liveConfig,
    callbacks: {
      onopen: () => {
        emitStatus(callbacks, 'listening');
      },
      onmessage: (event: unknown) => {
        const message = event as LiveServerEventLike;

        if (message.setupComplete?.sessionId) {
          liveSessionId = message.setupComplete.sessionId;
        }

        const inputTranscript = message.serverContent?.inputTranscription?.text?.trim();
        if (inputTranscript) {
          userTranscriptBuffer = mergeTranscript(userTranscriptBuffer, inputTranscript);
          callbacks.onUserTranscript?.(userTranscriptBuffer);
        }

        const outputTranscript = message.serverContent?.outputTranscription?.text?.trim();
        if (outputTranscript) {
          assistantTurnInProgress = true;
          assistantTranscriptBuffer = mergeTranscript(assistantTranscriptBuffer, outputTranscript);
          callbacks.onAssistantTranscript?.(assistantTranscriptBuffer);
          if (!audioPlayer.isPlaying()) {
            emitStatus(callbacks, 'thinking');
          }
        }

        const parts = message.serverContent?.modelTurn?.parts ?? [];
        for (const part of parts) {
          const inlineData = part.inlineData;
          if (inlineData?.data?.trim()) {
            assistantTurnInProgress = true;
            void audioPlayer.enqueue(inlineData.data, inlineData.mimeType ?? null).catch(() => {
              callbacks.onError?.('Origin AI audio playback failed.');
              emitStatus(callbacks, 'error');
            });
          }

          if (part.text?.trim()) {
            assistantTurnInProgress = true;
            assistantTranscriptBuffer = mergeTranscript(assistantTranscriptBuffer, part.text);
            callbacks.onAssistantTranscript?.(assistantTranscriptBuffer);
          }
        }

        if (message.serverContent?.interrupted) {
          audioPlayer.interrupt();
          assistantTurnInProgress = false;
          flushTurn(true);
        }

        if (message.serverContent?.turnComplete) {
          assistantTurnInProgress = false;
          flushTurn(false);
        }

        if (message.serverContent?.waitingForInput) {
          maybeReturnToListening();
        }
      },
      onerror: (event: unknown) => {
        const message =
          event instanceof Error
            ? event.message
            : typeof event === 'object' &&
                event &&
                'message' in event &&
                typeof (event as { message?: unknown }).message === 'string'
              ? (event as { message: string }).message
              : 'Origin AI voice mode hit a connection issue.';
        callbacks.onError?.(message);
        emitStatus(callbacks, 'error');
      },
      onclose: () => {
        if (isActive) {
          emitStatus(callbacks, 'idle');
        }
      },
    },
  })) as LiveSessionLike;

  if (bootstrap.conversationSeed.length > 0) {
    liveSession.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [{ text: bootstrap.contextSeed }],
        },
      ],
      turnComplete: false,
    });
  }

  if (bootstrap.conversationSeed.length > 0) {
    liveSession.sendClientContent({
      turns: bootstrap.conversationSeed.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })),
      turnComplete: false,
    });
  } else {
    liveSession.sendClientContent({
      turns: [
        {
          role: 'user',
          parts: [{ text: bootstrap.contextSeed }],
        },
      ],
      turnComplete: false,
    });
  }

  microphonePipeline = await startMicrophonePipeline(liveSession);

  return {
    stop: async () => {
      if (!isActive) {
        return;
      }

      isActive = false;
      assistantTurnInProgress = false;

      try {
        liveSession.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        // ignore close race
      }

      audioPlayer.interrupt();
      flushTurn(false);

      if (microphonePipeline) {
        microphonePipeline.processorNode.disconnect();
        microphonePipeline.sourceNode.disconnect();
        microphonePipeline.sinkNode.disconnect();
        microphonePipeline.stream.getTracks().forEach((track) => track.stop());
        await microphonePipeline.audioContext.close();
      }

      await audioPlayer.close();
      liveSession.close();
      emitStatus(callbacks, 'idle');
    },
    isActive: () => isActive,
  };
}
