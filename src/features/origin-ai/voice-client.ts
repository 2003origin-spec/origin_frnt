import {
  getOriginAiVoiceBootstrap,
  respondOriginAiVoiceAudio,
  synthesizeOriginAiVoiceText,
  type OriginAiClientPageContext,
} from '@/features/origin-ai/client';
import type { OriginAiReply, OriginAiVoiceStatus } from '@/types';

type AudioContextLike = AudioContext & {
  createScriptProcessor?: (
    bufferSize?: number,
    inputChannels?: number,
    outputChannels?: number,
  ) => ScriptProcessorNode;
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

interface CapturedVoiceTurn {
  audioData: string;
  mimeType: string;
}

interface MicrophonePipeline {
  stream: MediaStream;
  audioContext: AudioContextLike;
  sourceNode: MediaStreamAudioSourceNode;
  processorNode: ScriptProcessorNode;
  sinkNode: GainNode;
  finalizeActivity: () => void;
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
const USER_SPEECH_START_RMS_THRESHOLD_MIN = 0.012;
const USER_SPEECH_ACTIVE_RMS_THRESHOLD_MIN = 0.007;
const USER_SPEECH_START_CHUNKS_REQUIRED = 2;
const USER_SPEECH_END_SILENCE_CHUNKS_REQUIRED = 10;
const AMBIENT_RMS_INITIAL = 0.003;
const AMBIENT_RMS_SMOOTHING = 0.08;
const ASSISTANT_PLAYBACK_GAP_GRACE_MS = 900;
const VOICE_RESPOND_TIMEOUT_MS = 25000;
const VOICE_SPEAK_TIMEOUT_MS = 50000;

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

function float32ToInt16(input: Float32Array): Int16Array {
  const pcm = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm;
}

function encodePcmChunksToWavBase64(chunks: Int16Array[], sampleRate: number): string {
  const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const dataSize = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * 2, true);
  offset += 4;
  view.setUint16(offset, 2, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  for (const chunk of chunks) {
    for (let index = 0; index < chunk.length; index += 1) {
      view.setInt16(offset, chunk[index] ?? 0, true);
      offset += 2;
    }
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index] ?? 0);
  }
  return window.btoa(binary);
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

async function decodeAudioBuffer(
  audioContext: AudioContext,
  base64Data: string,
  mimeType?: string | null,
): Promise<AudioBuffer | null> {
  if (!base64Data.trim()) {
    return null;
  }

  if (mimeType?.includes('audio/pcm')) {
    return pcmChunkToAudioBuffer(audioContext, base64Data, parseSampleRate(mimeType));
  }

  const bytes = base64ToBytes(base64Data);
  const arrayBuffer = Uint8Array.from(bytes).buffer;
  return audioContext.decodeAudioData(arrayBuffer);
}

function calculateRms(input: Float32Array): number {
  if (input.length === 0) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < input.length; index += 1) {
    const sample = input[index] ?? 0;
    sum += sample * sample;
  }

  return Math.sqrt(sum / input.length);
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

  const preferredNames = ['daniel', 'aaron', 'alex', 'arthur', 'fred', 'google us english'];
  const englishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  const preferred =
    englishVoices.find((voice) =>
      preferredNames.some((name) => voice.name.toLowerCase().includes(name)),
    ) ?? englishVoices[0];

  return preferred ?? voices[0] ?? null;
}

async function speakWithBrowserFallback(text: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = 1.0;
  utterance.pitch = 0.92;
  const voice = pickBrowserSpeechVoice();
  if (voice) {
    utterance.voice = voice;
  }

  await new Promise<void>((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = () => reject(new Error('Origin AI browser speech fallback failed.'));
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

async function startMicrophonePipeline(
  isAssistantBusy: () => boolean,
  onUserTurnEnded: (turn: CapturedVoiceTurn) => void,
): Promise<MicrophonePipeline> {
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

  let activeSpeechChunks = 0;
  let activeSilenceChunks = 0;
  let userSpeechActive = false;
  let ambientRms = AMBIENT_RMS_INITIAL;
  let pendingSpeechChunks: Int16Array[] = [];
  let capturedSpeechChunks: Int16Array[] = [];

  const finishTurn = () => {
    if (!userSpeechActive || capturedSpeechChunks.length === 0) {
      userSpeechActive = false;
      activeSpeechChunks = 0;
      activeSilenceChunks = 0;
      pendingSpeechChunks = [];
      capturedSpeechChunks = [];
      return;
    }

    const audioData = encodePcmChunksToWavBase64(capturedSpeechChunks, INPUT_SAMPLE_RATE);

    userSpeechActive = false;
    activeSpeechChunks = 0;
    activeSilenceChunks = 0;
    pendingSpeechChunks = [];
    capturedSpeechChunks = [];

    onUserTurnEnded({
      audioData,
      mimeType: 'audio/wav',
    });
  };

  processorNode.onaudioprocess = (event) => {
    const channelData = event.inputBuffer.getChannelData(0);
    if (!channelData || channelData.length === 0) {
      return;
    }

    const rms = calculateRms(channelData);
    const pcmChunk = float32ToInt16(channelData);

    if (isAssistantBusy()) {
      if (!userSpeechActive) {
        activeSpeechChunks = 0;
        activeSilenceChunks = 0;
        pendingSpeechChunks = [];
        capturedSpeechChunks = [];
      }
      return;
    }

    if (!userSpeechActive) {
      ambientRms = ambientRms * (1 - AMBIENT_RMS_SMOOTHING) + rms * AMBIENT_RMS_SMOOTHING;

      const startThreshold = Math.max(USER_SPEECH_START_RMS_THRESHOLD_MIN, ambientRms * 3.2);
      if (rms < startThreshold) {
        activeSpeechChunks = 0;
        pendingSpeechChunks = [];
        return;
      }

      activeSpeechChunks += 1;
      pendingSpeechChunks.push(pcmChunk);
      if (activeSpeechChunks < USER_SPEECH_START_CHUNKS_REQUIRED) {
        return;
      }

      userSpeechActive = true;
      activeSpeechChunks = 0;
      activeSilenceChunks = 0;
      capturedSpeechChunks = pendingSpeechChunks.slice();
      pendingSpeechChunks = [];
      return;
    }

    const activeSpeechThreshold = Math.max(USER_SPEECH_ACTIVE_RMS_THRESHOLD_MIN, ambientRms * 1.8);
    if (rms >= activeSpeechThreshold) {
      activeSilenceChunks = 0;
      capturedSpeechChunks.push(pcmChunk);
      return;
    }

    activeSilenceChunks += 1;
    if (activeSilenceChunks >= USER_SPEECH_END_SILENCE_CHUNKS_REQUIRED) {
      finishTurn();
    }
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
    finalizeActivity: finishTurn,
  };
}

export async function startOriginAiVoiceMode(
  pageContext: OriginAiClientPageContext | undefined,
  getHighlightedText: () => string | null | undefined,
  callbacks: OriginAiVoiceCallbacks,
): Promise<OriginAiVoiceController> {
  emitStatus(callbacks, 'bootstrapping');
  const bootstrap = await getOriginAiVoiceBootstrap(pageContext);

  let isActive = true;
  let isAwaitingResponse = false;
  let microphonePipeline: MicrophonePipeline | null = null;
  let assistantPlaybackHoldUntil = 0;
  let isBrowserFallbackSpeaking = false;

  const maybeReturnToListening = () => {
    if (!isActive) {
      return;
    }
    if (isAwaitingResponse) {
      return;
    }
    if (audioPlayer.isPlaying()) {
      return;
    }
    if (isBrowserFallbackSpeaking) {
      return;
    }
    if (Date.now() < assistantPlaybackHoldUntil) {
      window.setTimeout(maybeReturnToListening, assistantPlaybackHoldUntil - Date.now());
      return;
    }
    emitStatus(callbacks, 'listening');
  };

  const audioPlayer = createAudioPlayer(callbacks, maybeReturnToListening);

  emitStatus(callbacks, 'connecting');

  microphonePipeline = await startMicrophonePipeline(
    () => isAwaitingResponse || audioPlayer.isPlaying() || Date.now() < assistantPlaybackHoldUntil,
    (turn) => {
      if (!isActive || isAwaitingResponse) {
        return;
      }

      isAwaitingResponse = true;
      emitStatus(callbacks, 'thinking');

      void (async () => {
        try {
          const highlightedText = getHighlightedText();
          const reply = await withTimeout(
            respondOriginAiVoiceAudio(
              turn.audioData,
              turn.mimeType,
              pageContext,
              bootstrap.voice.voiceName,
              highlightedText,
            ),
            VOICE_RESPOND_TIMEOUT_MS,
            'Origin AI took too long to prepare the voice reply.',
          );

          if (!isActive) {
            return;
          }

          callbacks.onUserTranscript?.(reply.userTranscript);
          callbacks.onAssistantTranscript?.(reply.assistantTranscript);
          callbacks.onReplyCommitted?.(reply);

          // Text reply is ready — now synthesize audio in a separate step.
          // Emit 'speaking' so the UI reflects that TTS is in progress
          // instead of staying stuck on 'thinking'.
          emitStatus(callbacks, 'speaking');

          let voiceAudio = reply.voiceAudio;
          let voiceAudioSegments = voiceAudio ? [voiceAudio] : [];
          let fallbackText = reply.assistantTranscript;
          if (!voiceAudio) {
            try {
              const speakResponse = await withTimeout(
                synthesizeOriginAiVoiceText(reply.assistantTranscript, bootstrap.voice.voiceName),
                VOICE_SPEAK_TIMEOUT_MS,
                'Origin AI took too long to synthesize the spoken reply.',
              );
              voiceAudio = speakResponse.voiceAudio;
              voiceAudioSegments =
                speakResponse.voiceAudioSegments?.length > 0
                  ? speakResponse.voiceAudioSegments
                  : speakResponse.voiceAudio
                    ? [speakResponse.voiceAudio]
                    : [];
              fallbackText = speakResponse.fallbackText ?? reply.assistantTranscript;
              if (speakResponse.synthesisError) {
                console.warn('[OriginAI Voice] TTS synthesis failed, will use browser fallback:', speakResponse.synthesisError);
              }
            } catch (speakErr) {
              // TTS failed — the text reply is already committed via
              // onReplyCommitted, so the user can still read it. Continue
              // the conversation loop with browser speech fallback.
              console.warn('[OriginAI Voice] TTS call failed, will use browser fallback:', speakErr);
            }
          }

          if (!isActive) {
            return;
          }

          if (voiceAudioSegments.length > 0) {
            assistantPlaybackHoldUntil = Date.now() + ASSISTANT_PLAYBACK_GAP_GRACE_MS;
            for (const segment of voiceAudioSegments) {
              await audioPlayer.enqueue(segment.data, segment.mimeType);
            }
          } else if (fallbackText.trim()) {
            assistantPlaybackHoldUntil = Date.now() + ASSISTANT_PLAYBACK_GAP_GRACE_MS;
            isBrowserFallbackSpeaking = true;
            emitStatus(callbacks, 'speaking');
            try {
              await speakWithBrowserFallback(fallbackText);
            } catch {
              // Ignore fallback speech errors; the text reply is already visible.
            } finally {
              isBrowserFallbackSpeaking = false;
            }
          }
          // If audio is unavailable, skip playback silently. The text
          // reply was already committed and the loop will return to
          // listening via the finally block below.
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Origin AI voice mode could not finish the turn.';
          callbacks.onError?.(message);
          // Don't set status to 'error' permanently — let the finally
          // block return to listening so the conversation can continue.
        } finally {
          isAwaitingResponse = false;
          maybeReturnToListening();
        }
      })();
    },
  );

  emitStatus(callbacks, 'listening');

  return {
    stop: async () => {
      if (!isActive) {
        return;
      }

      isActive = false;
      isAwaitingResponse = false;

      try {
        audioPlayer.interrupt();
      } catch {
        // ignore shutdown race
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      isBrowserFallbackSpeaking = false;

      if (microphonePipeline) {
        try {
          microphonePipeline.processorNode.disconnect();
          microphonePipeline.sourceNode.disconnect();
          microphonePipeline.sinkNode.disconnect();
        } catch {
          // ignore shutdown race
        }
        microphonePipeline.stream.getTracks().forEach((track) => track.stop());
        await microphonePipeline.audioContext.close();
      }

      await audioPlayer.close();
      emitStatus(callbacks, 'idle');
    },
    isActive: () => isActive,
  };
}
