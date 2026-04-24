import { GoogleGenAI, Modality } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const response = await client.models.generateContent({
        model: process.env.GEMINI_TTS_MODEL || "gemini-2.5-pro-preview-tts",
        contents: "Hello world!",
        config: {
          responseModalities: [Modality.AUDIO] as any,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        },
      });
      console.log("Success with genai:", response.text ? "yes": "no");
      console.log(JSON.stringify(response.candidates?.[0]?.content?.parts?.[0] || {}, null, 2));
  } catch(e) {
      console.error("FAIL", e.message);
  }
}
run();
