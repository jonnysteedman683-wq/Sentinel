import { GoogleGenAI } from "@google/genai";

class FallbackGenAI {
  models = {
    generateContent: async (_params: any) => ({ text: "Mock response" }),
    embedContent: async (_params: any) => ({ embeddings: [{ values: new Array(768).fill(0.1) }] })
  };
}

let aiClient: any = null;
export function getAi() {
  if (!aiClient) {
    if (process.env.GEMINI_API_KEY) {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } else {
      aiClient = new FallbackGenAI();
    }
  }
  return aiClient;
}

export const callGeminiGenerate = (contents: string, model: string) => getAi().models.generateContent({ contents: [{ role: "user", parts: [{ text: contents }] }], model });
export const callGeminiEmbed = (params: any) => getAi().models.embedContent(params);
