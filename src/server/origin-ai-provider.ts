import { ActivityHandling, GoogleGenAI, Modality } from '@google/genai';

export interface OriginAiProviderRequest {
  systemInstruction: string;
  conversation: Array<{ role: "user" | "assistant"; content: string }>;
  requestId: string;
}

export interface OriginAiProviderResponse {
  content: string;
  provider: "gemini" | "origin_ai_service" | "local_fallback";
  model: string;
  metadata?: Record<string, unknown>;
}

export interface OriginAiLiveBootstrapRequest {
  systemInstruction: string;
  requestId: string;
}

export interface OriginAiLiveBootstrapResponse {
  token: string;
  provider: "gemini";
  transport: "gemini_live";
  model: string;
  apiVersion: "v1alpha";
  responseModalities: string[];
  voiceName: string;
  inputAudioTranscription: boolean;
  outputAudioTranscription: boolean;
  sessionResumption: boolean;
  interruptionBehavior: "START_OF_ACTIVITY_INTERRUPTS" | "NO_INTERRUPTION";
  temperature: number;
  maxOutputTokens: number;
}

const GEMINI_LIVE_API_VERSION = "v1alpha" as const;
const DEFAULT_GEMINI_LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const DEFAULT_GEMINI_LIVE_VOICE = "Kore";

function extractText(value: unknown): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const candidate = value as {
    content?: { parts?: Array<{ text?: string }> };
    output?: string;
    text?: string;
    parts?: Array<{ text?: string }>;
  };
  if (typeof candidate.output === "string") {
    return candidate.output;
  }
  if (typeof candidate.text === "string") {
    return candidate.text;
  }
  if (Array.isArray(candidate.parts)) {
    return candidate.parts.map((part) => part.text ?? "").join("").trim();
  }
  if (candidate.content && Array.isArray(candidate.content.parts)) {
    return candidate.content.parts.map((part) => part.text ?? "").join("").trim();
  }
  return "";
}

async function callExternalOriginAiService(
  payload: OriginAiProviderRequest,
): Promise<OriginAiProviderResponse | null> {
  const base = process.env.ORIGIN_AI_SERVICE_URL?.trim();
  if (!base) {
    return null;
  }

  const token = process.env.ORIGIN_AI_SERVICE_TOKEN?.trim();
  const endpoint = base.replace(/\/$/, "");

  try {
    const response = await fetch(`${endpoint}/v1/origin-ai/respond`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-request-id": payload.requestId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      content?: string;
      reply?: string;
      response?: string;
      model?: string;
      metadata?: Record<string, unknown>;
    };

    const content = data.content ?? data.reply ?? data.response ?? "";
    if (!content.trim()) {
      return null;
    }

    return {
      content: content.trim(),
      provider: "origin_ai_service",
      model: data.model?.trim() || "external-origin-ai-service",
      metadata: data.metadata ?? {},
    };
  } catch {
    return null;
  }
}

async function callGemini(payload: OriginAiProviderRequest): Promise<OriginAiProviderResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = payload.conversation.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": payload.requestId,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: payload.systemInstruction }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 700,
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      candidates?: unknown[];
      modelVersion?: string;
      promptFeedback?: Record<string, unknown>;
    };

    const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
    const content = extractText(candidate);
    if (!content.trim()) {
      return null;
    }

    return {
      content: content.trim(),
      provider: "gemini",
      model: data.modelVersion?.trim() || model,
      metadata: {
        promptFeedback: data.promptFeedback ?? null,
      },
    };
  } catch {
    return null;
  }
}

export async function generateOriginAiProviderReply(
  payload: OriginAiProviderRequest,
): Promise<OriginAiProviderResponse | null> {
  const external = await callExternalOriginAiService(payload);
  if (external) {
    return external;
  }
  return callGemini(payload);
}

export async function createOriginAiLiveBootstrap(
  payload: OriginAiLiveBootstrapRequest,
): Promise<OriginAiLiveBootstrapResponse | null> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_LIVE_MODEL?.trim() || DEFAULT_GEMINI_LIVE_MODEL;
  const voiceName = process.env.GEMINI_LIVE_VOICE_NAME?.trim() || DEFAULT_GEMINI_LIVE_VOICE;
  const temperature = 0.55;
  const maxOutputTokens = 260;

  try {
    const client = new GoogleGenAI({
      apiKey,
      apiVersion: GEMINI_LIVE_API_VERSION,
    });

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            systemInstruction: payload.systemInstruction,
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
            realtimeInputConfig: {
              activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: {},
            temperature,
            maxOutputTokens,
          },
        },
        lockAdditionalFields: [
          "liveConnectConstraints.model",
          "liveConnectConstraints.config.systemInstruction",
          "liveConnectConstraints.config.responseModalities",
          "liveConnectConstraints.config.speechConfig",
          "liveConnectConstraints.config.realtimeInputConfig",
          "liveConnectConstraints.config.inputAudioTranscription",
          "liveConnectConstraints.config.outputAudioTranscription",
          "liveConnectConstraints.config.sessionResumption",
          "liveConnectConstraints.config.temperature",
          "liveConnectConstraints.config.maxOutputTokens",
        ],
      },
    });

    if (!token.name?.trim()) {
      return null;
    }

    return {
      token: token.name,
      provider: "gemini",
      transport: "gemini_live",
      model,
      apiVersion: GEMINI_LIVE_API_VERSION,
      responseModalities: [Modality.AUDIO],
      voiceName,
      inputAudioTranscription: true,
      outputAudioTranscription: true,
      sessionResumption: true,
      interruptionBehavior: "START_OF_ACTIVITY_INTERRUPTS",
      temperature,
      maxOutputTokens,
    };
  } catch {
    return null;
  }
}
