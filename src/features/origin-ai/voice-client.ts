import { GoogleGenAI } from '@google/genai';

import {
  getOriginAiVoiceBootstrap,
  persistOriginAiVoiceTurn,
  type OriginAiClientPageContext,
} from '@/features/origin-ai/client';
import type { OriginAiReply, OriginAiVoiceStatus } from '@/types';

type LiveSessionLike = {
  sendClientContent: (params: unknown) => void;
  sendRealtimeInput: (params: unknown) => void;
  close: () => void;
};

type AudioContextLike = AudioContext & {
  createScriptProcessor?: (bufferSize?: number, inputChannels?: number, outputChannels?: number) => ScriptProcessorNode;
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

const INPUT_SAMPLE_RATE = 16000;
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

function speakAssistantReply(text: string, callbacks: OriginAiVoiceCallbacks): Promise<void> {
  if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return Promise.resolve();
  }

  window.speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => emitStatus(callbacks, 'speaking');
    utterance.onend = () => {
      emitStatus(callbacks, 'listening');
      resolve();
    };
    utterance.onerror = () => {
      emitStatus(callbacks, 'listening');
      resolve();
    };
    window.speechSynthesis.speak(utterance);
  });
}

async function startMicrophonePipeline(
  liveSession: LiveSessionLike,
): Promise<{
  stream: MediaStream;
  audioContext: AudioContextLike;
  sourceNode: MediaStreamAudioSourceNode;
  processorNode: ScriptProcessorNode;
  sinkNode: GainNode;
}> {
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
  let turnCommitInFlight = false;
  let pipeline:
    | {
        stream: MediaStream;
        audioContext: AudioContextLike;
        sourceNode: MediaStreamAudioSourceNode;
        processorNode: ScriptProcessorNode;
        sinkNode: GainNode;
      }
    | null = null;

  const finalizeTurn = async () => {
    if (!isActive || turnCommitInFlight) {
      return;
    }

    const userTranscript = userTranscriptBuffer.trim();
    const assistantTranscript = assistantTranscriptBuffer.trim();
    if (!userTranscript && !assistantTranscript) {
      return;
    }

    turnCommitInFlight = true;
    emitStatus(callbacks, 'thinking');

    try {
      callbacks.onUserTranscript?.(userTranscript);
      callbacks.onAssistantTranscript?.(assistantTranscript);
      const reply = await persistOriginAiVoiceTurn(
        userTranscript,
        assistantTranscript,
        pageContext,
        {
          liveSessionId,
          model: bootstrap.voice.model,
          transport: 'gemini_live',
        },
      );
      callbacks.onReplyCommitted?.(reply);
      await speakAssistantReply(assistantTranscript, callbacks);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Origin AI could not save the voice turn.';
      callbacks.onError?.(message);
      emitStatus(callbacks, 'error');
    } finally {
      userTranscriptBuffer = '';
      assistantTranscriptBuffer = '';
      turnCommitInFlight = false;
      if (isActive) {
        emitStatus(callbacks, 'listening');
      }
    }
  };

  emitStatus(callbacks, 'connecting');

  const liveSession = (await ai.live.connect({
    model: bootstrap.voice.model,
    config: {
      responseModalities: bootstrap.voice.responseModalities as never,
      inputAudioTranscription: bootstrap.voice.inputAudioTranscription ? {} : undefined,
      sessionResumption: bootstrap.voice.sessionResumption ? {} : undefined,
      temperature: bootstrap.voice.temperature,
      maxOutputTokens: bootstrap.voice.maxOutputTokens,
    },
    callbacks: {
      onopen: () => {
        emitStatus(callbacks, 'listening');
      },
      onmessage: (event: unknown) => {
        const message = event as {
          setupComplete?: { sessionId?: string };
          serverContent?: {
            inputTranscription?: { text?: string };
            outputTranscription?: { text?: string };
            turnComplete?: boolean;
            interrupted?: boolean;
          };
          text?: string;
        };

        if (message.setupComplete?.sessionId) {
          liveSessionId = message.setupComplete.sessionId;
        }

        const inputTranscript = message.serverContent?.inputTranscription?.text;
        if (inputTranscript?.trim()) {
          userTranscriptBuffer = mergeTranscript(userTranscriptBuffer, inputTranscript);
          callbacks.onUserTranscript?.(userTranscriptBuffer);
        }

        const modelText = message.text?.trim() || message.serverContent?.outputTranscription?.text?.trim();
        if (modelText) {
          assistantTranscriptBuffer = mergeTranscript(assistantTranscriptBuffer, modelText);
          callbacks.onAssistantTranscript?.(assistantTranscriptBuffer);
          emitStatus(callbacks, 'thinking');
        }

        if (message.serverContent?.interrupted) {
          assistantTranscriptBuffer = '';
          emitStatus(callbacks, 'listening');
        }

        if (message.serverContent?.turnComplete) {
          void finalizeTurn();
        }
      },
      onerror: (event: unknown) => {
        const message =
          event instanceof Error
            ? event.message
            : typeof event === 'object' && event && 'message' in event && typeof (event as { message?: unknown }).message === 'string'
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
      turns: bootstrap.conversationSeed.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      })),
      turnComplete: false,
    });
  }

  pipeline = await startMicrophonePipeline(liveSession);

  return {
    stop: async () => {
      if (!isActive) {
        return;
      }

      isActive = false;
      emitStatus(callbacks, 'idle');

      try {
        liveSession.sendRealtimeInput({ audioStreamEnd: true });
      } catch {
        // ignore close race
      }

      window.speechSynthesis?.cancel();

      if (pipeline) {
        pipeline.processorNode.disconnect();
        pipeline.sourceNode.disconnect();
        pipeline.sinkNode.disconnect();
        pipeline.stream.getTracks().forEach((track) => track.stop());
        await pipeline.audioContext.close();
      }

      liveSession.close();
    },
    isActive: () => isActive,
  };
}
