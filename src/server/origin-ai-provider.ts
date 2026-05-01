import { GoogleGenAI, Modality } from '@google/genai';

export interface OriginAiProviderRequest {
 systemInstruction: string;
 conversation: Array<{ role: "user" | "assistant"; content: string }>;
 requestId: string;
 maxOutputTokens?: number;
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
 provider: "gemini";
 transport: "server_voice";
 speechToTextModel: string;
 textToSpeechModel: string;
 voiceName: string;
}

export interface OriginAiVoiceTranscriptionResponse {
 transcript: string;
 provider: "gemini";
 model: string;
}

export interface OriginAiVoiceSynthesisResponse {
 data: string;
 mimeType: string;
 provider: "gemini";
 model: string;
 voiceName: string;
 duration?: number;
}

const DEFAULT_GEMINI_STT_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-pro-preview-tts";
const DEFAULT_GEMINI_LIVE_VOICE = "Aoede";
const DEFAULT_PROVIDER_TIMEOUT_MS = 45000;
const DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS = 700;
const MAX_TTS_SEGMENT_CHARS = 4000;
const NON_LATIN_VOICE_SCRIPT_REGEX =
 /[\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Myanmar}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const META_VOICE_TRANSCRIPT_REGEX =
 /(^|[\r\n]+|\*\*)(analyzing the question|addressing the question|clarifying the query|acknowledging interruption|my focus is|my plan is|looks like it involves|i can see that(?: the)? user needs|i(?:'|’)ve understood|i plan to|i will now|i should give|i(?:'|’)ll start by|constraints)\b/i;

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

function extractInlineAudio(value: unknown): { data: string; mimeType: string } | null {
 if (!value || typeof value !== "object") {
 return null;
 }

 const candidate = value as {
 candidates?: Array<{
 content?: {
 parts?: Array<{
 inlineData?: {
 data?: string;
 mimeType?: string;
 };
 }>;
 };
 }>;
 data?: string;
 };

 const firstCandidate = Array.isArray(candidate.candidates) ? candidate.candidates[0] : null;
 const parts = firstCandidate?.content?.parts ?? [];
 const inlineData = parts.find((part) => part.inlineData?.data?.trim())?.inlineData;
 if (inlineData?.data?.trim()) {
 return {
 data: inlineData.data.trim(),
 mimeType: inlineData.mimeType?.trim() || "audio/wav",
 };
 }

 if (typeof candidate.data === "string" && candidate.data.trim()) {
 return {
 data: candidate.data.trim(),
 mimeType: "audio/wav",
 };
 }

 return null;
}

function providerTimeoutMs(): number {
 const raw = Number(process.env.ORIGIN_AI_PROVIDER_TIMEOUT_MS ?? "");
 if (Number.isFinite(raw) && raw > 0) {
 return raw;
 }
 return DEFAULT_PROVIDER_TIMEOUT_MS;
}

function cleanTextForSpeech(text: string): string {
 return text
 .replace(/\*\*(.*?)\*\*/g, "$1")
 .replace(/`([^`]+)`/g, "$1")
 .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
 .replace(/^\s*[-*]\s+/gm, "")
 .replace(/^\s*\d+\.\s+/gm, "")
 .replace(/\s+/g, " ")
 .trim();
}

function splitTextForSpeech(text: string): string[] {
 const cleaned = cleanTextForSpeech(text);
 if (!cleaned) {
 return [];
 }

 const sentences = cleaned
 .split(/(?<=[.!?])\s+/)
 .map((part) => part.trim())
 .filter(Boolean);

 if (sentences.length === 0) {
 return [cleaned];
 }

 const segments: string[] = [];
 let current = "";

 for (const sentence of sentences) {
 const next = current ? `${current} ${sentence}` : sentence;
 if (next.length <= MAX_TTS_SEGMENT_CHARS) {
 current = next;
 continue;
 }

 if (current) {
 segments.push(current);
 }

 if (sentence.length <= MAX_TTS_SEGMENT_CHARS) {
 current = sentence;
 continue;
 }

 const words = sentence.split(/\s+/).filter(Boolean);
 let chunk = "";
 for (const word of words) {
 const chunkNext = chunk ? `${chunk} ${word}` : word;
 if (chunkNext.length <= MAX_TTS_SEGMENT_CHARS) {
 chunk = chunkNext;
 continue;
 }
 if (chunk) {
 segments.push(chunk);
 }
 chunk = word;
 }
 current = chunk;
 }

 if (current) {
 segments.push(current);
 }

 return segments;
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
 let timeoutId: ReturnType<typeof setTimeout> | undefined;
 try {
 return await Promise.race([
 promise,
 new Promise<T>((_, reject) => {
 timeoutId = setTimeout(() => reject(new Error(message)), providerTimeoutMs());
 }),
 ]);
 } finally {
 if (timeoutId) {
 clearTimeout(timeoutId);
 }
 }
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
 const controller = new AbortController();
 const timeoutId = setTimeout(() => controller.abort(), providerTimeoutMs());

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
 signal: controller.signal,
 body: JSON.stringify({
 systemInstruction: {
 parts: [{ text: payload.systemInstruction }],
 },
 contents,
 generationConfig: {
 temperature: 0.7,
 topP: 0.9,
 maxOutputTokens: payload.maxOutputTokens ?? DEFAULT_PROVIDER_MAX_OUTPUT_TOKENS,
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
 } finally {
 clearTimeout(timeoutId);
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

export async function normalizeVoiceTranscriptForChat(
 text: string,
 role: "user" | "assistant",
): Promise<string> {
 const cleaned = text.replace(/\*\*/g, "").trim();
 if (!cleaned) {
 return "";
 }

 const needsRomanization = NON_LATIN_VOICE_SCRIPT_REGEX.test(cleaned);
 const needsAssistantRewrite = role === "assistant" && META_VOICE_TRANSCRIPT_REGEX.test(cleaned);

 if (!needsRomanization && !needsAssistantRewrite) {
 return cleaned;
 }

 const prompt =
 role === "assistant"
 ? "Rewrite this spoken assistant transcript into a clean natural conversational reply. Remove internal planning, headings, meta analysis, and broken partial setup lines. Keep the meaning and guardrails. If the language is Hinglish, write it only in Roman script. Never use any non-Latin script, including Devanagari, Gujarati, Burmese, Thai, Urdu, or Arabic. Return only the cleaned transcript."
 : "Convert this spoken student transcript into natural Roman-script English or Hinglish only. Do not change the meaning. Keep question numbers, formulas, symbols, names, and technical terms intact. Never use any non-Latin script, including Devanagari, Gujarati, Burmese, Thai, Urdu, or Arabic. Return only the cleaned Roman-script transcript.";

 const rewritten = await callGemini({
 systemInstruction: prompt,
 conversation: [{ role: "user", content: cleaned }],
 requestId: `voice_transcript_normalize_${role}_${Date.now()}`,
 });

 return rewritten?.content.trim() || cleaned;
}

export async function createOriginAiLiveBootstrap(
 _payload: OriginAiLiveBootstrapRequest,
): Promise<OriginAiLiveBootstrapResponse> {
 void _payload;
 const voiceName = process.env.GEMINI_LIVE_VOICE_NAME?.trim() || DEFAULT_GEMINI_LIVE_VOICE;
 return {
 provider: "gemini",
 transport: "server_voice",
 speechToTextModel:
 process.env.GEMINI_STT_MODEL?.trim() ||
 process.env.GEMINI_MODEL?.trim() ||
 DEFAULT_GEMINI_STT_MODEL,
 textToSpeechModel: process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_GEMINI_TTS_MODEL,
 voiceName,
 };
}

export async function transcribeOriginAiVoiceAudio(
 audioData: string,
 mimeType: string,
 _requestId: string,
): Promise<OriginAiVoiceTranscriptionResponse> {
 void _requestId;
 const apiKey = process.env.GEMINI_API_KEY?.trim();
 if (!apiKey) {
 throw new Error("Gemini API key is missing for voice transcription.");
 }

 const model =
 process.env.GEMINI_STT_MODEL?.trim() ||
 process.env.GEMINI_MODEL?.trim() ||
 DEFAULT_GEMINI_STT_MODEL;

 const client = new GoogleGenAI({ apiKey });
 const response = await withTimeout(
 client.models.generateContent({
 model,
 contents: [
 {
 text:
 "Transcribe this student voice message for a study mentor chat. Return only the student's spoken words in natural Roman-script English or Hinglish. Keep formulas, variables, units, question numbers, and technical terms intact. Never use Devanagari, Urdu, Arabic, Gujarati, Burmese, Thai, or any other non-Latin script.",
 },
 {
 inlineData: {
 data: audioData,
 mimeType,
 },
 },
 ],
 config: {
 temperature: 0.1,
 maxOutputTokens: 240,
 },
 }),
 "Origin AI voice transcription timed out.",
 );

 const transcript = response.text?.trim() || extractText(response);
 if (!transcript) {
 throw new Error("Origin AI could not transcribe the voice message.");
 }

 return {
 transcript,
 provider: "gemini",
 model,
 };
}

export async function synthesizeOriginAiVoiceAudio(
 text: string,
 requestId: string,
 voiceNameOverride?: string | null,
): Promise<OriginAiVoiceSynthesisResponse> {
 const apiKey = process.env.GEMINI_API_KEY?.trim();
 if (!apiKey) {
 throw new Error("Gemini API key is missing for voice synthesis.");
 }

 const model = process.env.GEMINI_TTS_MODEL?.trim() || DEFAULT_GEMINI_TTS_MODEL;
 const voiceName = voiceNameOverride?.trim() || process.env.GEMINI_LIVE_VOICE_NAME?.trim() || DEFAULT_GEMINI_LIVE_VOICE;
 const cleaned = cleanTextForSpeech(text);

 if (!cleaned) {
 throw new Error("Origin AI voice synthesis text is empty after cleaning.");
 }

 const client = new GoogleGenAI({ apiKey });

 let response: Awaited<ReturnType<typeof client.models.generateContent>>;
 try {
 response = await withTimeout(
 client.models.generateContent({
 model,
 contents: cleaned,
 config: {
 responseModalities: [Modality.AUDIO],
 speechConfig: {
 voiceConfig: {
 prebuiltVoiceConfig: {
 voiceName,
 },
 },
 },
 },
 }),
 "Origin AI voice synthesis timed out.",
 );
 } catch (error) {
 const detail = error instanceof Error ? error.message : String(error);
 console.error(
 `[OriginAI TTS] Gemini synthesis failed (model=${model}, voice=${voiceName}, req=${requestId}): ${detail}`,
 );
 throw new Error(`Origin AI voice synthesis failed: ${detail}`);
 }

 const audio = extractInlineAudio(response);
 if (!audio) {
 console.error(
 `[OriginAI TTS] No audio in Gemini response (model=${model}, voice=${voiceName}, req=${requestId})`,
 );
 throw new Error("Origin AI could not extract audio from the synthesis response.");
 }

 return {
 data: audio.data,
 mimeType: audio.mimeType,
 provider: "gemini",
 model,
 voiceName,
 duration: cleaned.length / 15,
 };
}

export async function synthesizeOriginAiVoiceAudioSegments(
 text: string,
 requestId: string,
 voiceNameOverride?: string | null,
): Promise<OriginAiVoiceSynthesisResponse[]> {
 const segments = splitTextForSpeech(text);
 if (segments.length === 0) {
 throw new Error("Origin AI voice synthesis text is empty.");
 }

 // Synthesize sequentially so a quota/rate error on segment N does not
 // also waste calls on segments N+1…M. The successfully synthesized
 // segments are still usable — the caller can play what we got and fall
 // back to browser speech for the remainder.
 const results: OriginAiVoiceSynthesisResponse[] = [];
 for (let i = 0; i < segments.length; i++) {
 try {
 const result = await synthesizeOriginAiVoiceAudio(
 segments[i]!,
 `${requestId}_${i + 1}`,
 voiceNameOverride,
 );
 results.push(result);
 } catch (error) {
 // If this is the first segment, re-throw so the caller knows
 // nothing was synthesized. Otherwise return what we have.
 if (results.length === 0) {
 throw error;
 }
 const detail = error instanceof Error ? error.message : String(error);
 console.warn(
 `[OriginAI TTS] Segment ${i + 1}/${segments.length} failed, returning ${results.length} completed segment(s): ${detail}`,
 );
 break;
 }
 }

 return results;
}
