// NOTE: the former `generateOriginAiProviderReply` client targeted
// `${ORIGIN_AI_SERVICE_URL}/v1/origin-ai/respond`, a path the Python service
// never exposed (every router is mounted under /api/v1/...). It always 404'd
// and silently returned null, so the legacy chat path could pretend a
// fallback reply was a real generation (bug-fix doc 12, finding 5). Real
// generations go through the proxy in app/api/origin-ai/[...slug]/route.ts;
// the legacy path now treats "no service" as the explicit KB/local fallback.

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
 provider: "origin_ai_service";
 model: string;
}

export interface OriginAiVoiceSynthesisResponse {
 data: string;
 mimeType: string;
 provider: "origin_ai_service";
 model: string;
 voiceName: string;
 duration?: number;
}

const DEFAULT_GEMINI_STT_MODEL = "gemini-2.5-flash";
const DEFAULT_GEMINI_TTS_MODEL = "gemini-2.5-pro-preview-tts";
const DEFAULT_GEMINI_LIVE_VOICE = "Aoede";
const DEFAULT_PROVIDER_TIMEOUT_MS = 45000;
const MAX_TTS_SEGMENT_CHARS = 4000;
const NON_LATIN_VOICE_SCRIPT_REGEX =
 /[\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Myanmar}\p{Script=Thai}\p{Script=Lao}\p{Script=Tibetan}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const META_VOICE_TRANSCRIPT_REGEX =
 /(^|[\r\n]+|\*\*)(analyzing the question|addressing the question|clarifying the query|acknowledging interruption|my focus is|my plan is|looks like it involves|i can see that(?: the)? user needs|i(?:'|’)ve understood|i plan to|i will now|i should give|i(?:'|’)ll start by|constraints)\b/i;

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

function originAiServiceEndpoint(path: string): string | null {
 const base = process.env.ORIGIN_AI_SERVICE_URL?.trim();
 if (!base) {
 return null;
 }
 return `${base.replace(/\/$/, "")}${path}`;
}

function originAiServiceHeaders(requestId: string): HeadersInit {
 const token = process.env.ORIGIN_AI_SERVICE_TOKEN?.trim();
 return {
 "content-type": "application/json",
 ...(token ? { Authorization: `Bearer ${token}` } : {}),
 "x-request-id": requestId,
 };
}

export async function normalizeVoiceTranscriptForChat(
 text: string,
 role: "user" | "assistant",
): Promise<string> {
 // The model-backed rewrite used the dead `/v1/origin-ai/respond` client, so
 // in practice this has always returned the locally cleaned text. Keep that
 // behaviour explicit; the role only decides which transcripts are flagged.
 const cleaned = text.replace(/\*\*/g, "").trim();
 if (!cleaned) {
 return "";
 }

 const needsRomanization = NON_LATIN_VOICE_SCRIPT_REGEX.test(cleaned);
 const needsAssistantRewrite = role === "assistant" && META_VOICE_TRANSCRIPT_REGEX.test(cleaned);
 if (needsRomanization || needsAssistantRewrite) {
 console.warn(
 `[OriginAI voice] transcript (${role}) would need a model rewrite; no text provider is wired, returning cleaned text`,
 );
 }

 return cleaned;
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
 requestId: string,
): Promise<OriginAiVoiceTranscriptionResponse> {
 const endpoint = originAiServiceEndpoint("/v1/origin-ai/transcribe");
 if (!endpoint) {
 throw new Error("Ori service is not configured for voice transcription.");
 }

 const response = await withTimeout(fetch(endpoint, {
 method: "POST",
 headers: originAiServiceHeaders(requestId),
 body: JSON.stringify({ audioData, mimeType }),
 }), "Ori voice transcription timed out.");

 if (!response.ok) {
 throw new Error("Ori voice transcription service returned an error.");
 }

 const data = (await response.json()) as { transcript?: string; model?: string };
 const transcript = data.transcript?.trim() || "";
 if (!transcript) {
 throw new Error("Ori could not transcribe the voice message.");
 }

 return {
 transcript,
 provider: "origin_ai_service",
 model: data.model?.trim() || DEFAULT_GEMINI_STT_MODEL,
 };
}

export async function synthesizeOriginAiVoiceAudio(
 text: string,
 requestId: string,
 voiceNameOverride?: string | null,
): Promise<OriginAiVoiceSynthesisResponse> {
 const cleaned = cleanTextForSpeech(text);

 if (!cleaned) {
 throw new Error("Ori voice synthesis text is empty after cleaning.");
 }

 const endpoint = originAiServiceEndpoint("/v1/origin-ai/speak");
 if (!endpoint) {
 throw new Error("Ori service is not configured for voice synthesis.");
 }

 const voiceName = voiceNameOverride?.trim() || process.env.GEMINI_LIVE_VOICE_NAME?.trim() || DEFAULT_GEMINI_LIVE_VOICE;
 let response: Response;
 try {
 response = await withTimeout(
 fetch(endpoint, {
 method: "POST",
 headers: originAiServiceHeaders(requestId),
 body: JSON.stringify({ text: cleaned, voiceName }),
 }),
 "Ori voice synthesis timed out.",
 );
 } catch (error) {
 const detail = error instanceof Error ? error.message : String(error);
 console.error(
 `[OriginAI TTS] service synthesis failed (voice=${voiceName}, req=${requestId}): ${detail}`,
 );
 throw new Error(`Ori voice synthesis failed: ${detail}`);
 }

 if (!response.ok) {
 throw new Error("Ori voice synthesis service returned an error.");
 }

 const data = (await response.json()) as {
 voice_audio?: (Partial<OriginAiVoiceSynthesisResponse> & { mime_type?: string; voice_name?: string }) | null;
 voice_audio_segments?: Array<Partial<OriginAiVoiceSynthesisResponse> & { mime_type?: string; voice_name?: string }>;
 };
 const audio = data.voice_audio ?? data.voice_audio_segments?.find((segment) => segment.data);
 if (!audio?.data) {
 console.error(
 `[OriginAI TTS] No audio in service response (voice=${voiceName}, req=${requestId})`,
 );
 throw new Error("Ori could not extract audio from the synthesis response.");
 }

 return {
 data: audio.data ?? "",
 mimeType: audio.mimeType ?? audio.mime_type ?? "audio/wav",
 provider: "origin_ai_service",
 model: audio.model ?? DEFAULT_GEMINI_TTS_MODEL,
 voiceName: audio.voiceName ?? audio.voice_name ?? voiceName,
 duration: audio.duration ?? cleaned.length / 15,
 };
}

export async function synthesizeOriginAiVoiceAudioSegments(
 text: string,
 requestId: string,
 voiceNameOverride?: string | null,
): Promise<OriginAiVoiceSynthesisResponse[]> {
 const segments = splitTextForSpeech(text);
 if (segments.length === 0) {
 throw new Error("Ori voice synthesis text is empty.");
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
