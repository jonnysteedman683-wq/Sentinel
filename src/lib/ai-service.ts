import { GoogleGenAI } from "@google/genai";
import { CircuitBreaker } from "./resilience.js";
import { tracer } from "./telemetry.js";
import { SpanStatusCode } from "@opentelemetry/api";
import { SystemHealthCollector } from "./system-health-collector.js";
import { dbShim as db, FieldValue } from "./firestore-shim.js";
import Groq from "groq-sdk";
import { activeUserIds } from "./session-state.js";

export function schemaToInstruction(schema: any): string {
  if (!schema) return "";
  let text = "You MUST format your output as a valid JSON object matching this schema:\n```json\n{\n";
  if (schema.properties) {
    const props = Object.entries(schema.properties);
    props.forEach(([key, prop]: [string, any], idx) => {
      if (prop.type === "object" || prop.properties) {
        text += `  "${key}": {\n`;
        if (prop.properties) {
          const subProps = Object.entries(prop.properties);
          subProps.forEach(([subKey]: [string, any], subIdx) => {
            text += `    "${subKey}": "string"${subIdx < subProps.length - 1 ? "," : ""}\n`;
          });
        }
        text += `  }${idx < props.length - 1 ? "," : ""}\n`;
      } else if (prop.type === "array" || prop.items) {
        text += `  "${key}": ["string"]${idx < props.length - 1 ? "," : ""}\n`;
      } else {
        text += `  "${key}": "string"${idx < props.length - 1 ? "," : ""}\n`;
      }
    });
  }
  text += "}\n```\nReturn ONLY the raw JSON block without markdown formatting or other wrapper text outside of the json block.";
  return text;
}

export function generateLocalEmbedding(text: string): number[] {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const vector = new Array(128).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % 128;
    vector[index] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }
  return vector;
}

async function logLlmCallToFirestore(provider: string, model: string, success: boolean, durationMs: number, err: any = null, traceId: string | null = null) {
  if (!db) return;
  try {
    await db.collection("llm_requests").add({
      timestamp: FieldValue.serverTimestamp(),
      provider,
      model,
      success,
      durationMs,
      traceId,
      errorMessage: err ? err.message : null
    });
  } catch (logErr: any) {
    if (logErr.message?.includes('PERMISSION_DENIED') || logErr.message?.includes('NOT_FOUND') || logErr.code === 7 || logErr.code === 5) {
      console.warn("[AI Service] Firestore API not ready or disabled. LLM logging disabled.");
    } else {
      console.error("[AI Service] Failed to log LLM call to Firestore:", logErr.message);
    }
  }
}

export class FallbackGenAI {
  public geminiBreaker = new CircuitBreaker();
  models = {
    generateContent: async (params: any) => {
      const startTime = Date.now();
      const modelType = params.modelType || 'fast';
      const fastModel = "gemini-3.5-flash";
      const smartModel = "gemini-3.1-pro-preview";
      const model = params.model || (modelType === 'smart' ? smartModel : fastModel);
      const traceId = params.traceId || null;
      
      console.log(`[FallbackGenAI][${traceId || 'no-trace'}] Requesting model: ${model}`);
      
      const hasValidGeminiKey = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("AQ.");
      if (hasValidGeminiKey) {
        let attempts = 0;
        const maxAttempts = 2;
        while (attempts < maxAttempts) {
          try {
            const googleAi = new GoogleGenAI({
              apiKey: process.env.GEMINI_API_KEY,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });
            
            const span = tracer.startSpan('Gemini generateContent');
            span.setAttribute('model', model);
            
            try {
              const res = await this.geminiBreaker.call(() => googleAi.models.generateContent({
                 ...params,
                 model: model
              }));
              span.setStatus({ code: SpanStatusCode.OK });
              span.end();
              
              const duration = Date.now() - startTime;
              SystemHealthCollector.recordGeminiLatency(duration);
              await logLlmCallToFirestore("google", model, true, duration, null, traceId);
              console.log(`[FallbackGenAI][${traceId || 'no-trace'}] Gemini success with ${model} in ${duration}ms`);
              return res;
            } catch (err: any) {
              span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
              span.recordException(err);
              span.end();
              throw err;
            }
          } catch (e: any) {
            attempts++;
            console.error(`[FallbackGenAI][${traceId || 'no-trace'}] Google GenAI call with ${model} failed (attempt ${attempts}), error:`, e.message);
            if (attempts >= maxAttempts) {
              await logLlmCallToFirestore("google", model, false, Date.now() - startTime, e, traceId);
              break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); 
          }
        }
      }

      // Build messages for fallback providers
      let messages: any[] = [];
      const chatMessages: any[] = [];
      if (params.contents) {
        const contentsArray = Array.isArray(params.contents) ? params.contents : [params.contents];
        for (const item of contentsArray) {
          let role = item.role === "model" ? "assistant" : "user";
          let content = "";
          if (item.parts) {
            content = item.parts.map((p: any) => p.text || "").join("\n");
          } else if (typeof item === "string") {
            content = item;
            role = "user";
          }
          chatMessages.push({ role, content });
        }
      }

      chatMessages.forEach(msg => {
        if (msg.content && msg.content.length > 3000) {
          msg.content = msg.content.slice(0, 3000) + "\n[Content truncated to fit system limits]";
        }
      });

      let prunedChatMessages = chatMessages;
      if (chatMessages.length > 6) {
        prunedChatMessages = chatMessages.slice(-6);
      }

      if (params.config?.systemInstruction) {
        let systemText = "";
        if (typeof params.config.systemInstruction === "string") {
          systemText = params.config.systemInstruction;
        } else if (params.config.systemInstruction.parts) {
          systemText = params.config.systemInstruction.parts.map((p: any) => p.text || "").join("\n");
        }
        if (systemText.length > 3000) {
          systemText = systemText.slice(0, 3000) + "\n[System instruction context truncated]";
        }
        messages.push({ role: "system", content: systemText });
      }

      messages = messages.concat(prunedChatMessages);

      if (params.config?.responseSchema) {
        const schemaText = schemaToInstruction(params.config.responseSchema);
        messages.push({ role: "system", content: schemaText });
      }

      let maxTokens = params.config?.maxOutputTokens || 1024;
      if (maxTokens > 2048) maxTokens = 2048;

      if (process.env.GROQ_API_KEY) {
        try {
          const start = Date.now();
          const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
          const groqMessages = [...messages];
          if (params.config?.responseMimeType === "application/json") {
            const hasJsonWord = groqMessages.some(m => typeof m.content === "string" && m.content.toLowerCase().includes("json"));
            if (!hasJsonWord) {
              groqMessages.push({ role: "system", content: "You MUST format your output as a valid JSON object." });
            }
          }

          const chatCompletion = await groq.chat.completions.create({
            messages: groqMessages,
            model: modelType === 'smart' ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant",
            max_tokens: maxTokens,
            response_format: params.config?.responseMimeType === "application/json" ? { type: "json_object" } : undefined
          });
          const content = chatCompletion.choices[0]?.message?.content || "";
          await logLlmCallToFirestore("groq", chatCompletion.model, true, Date.now() - start, null, traceId);
          return {
            text: content,
            candidates: [{ content: { parts: [{ text: content }] } }]
          };
        } catch (e: any) {
          await logLlmCallToFirestore("groq", modelType === 'smart' ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant", false, 0, e, traceId);
          console.error(`[FallbackGenAI] Groq failed:`, e.message);
        }
      }

      try {
        const openRouterModels = modelType === 'smart' 
          ? ["meta-llama/llama-3.3-70b-instruct:free", "nousresearch/hermes-3-llama-3.1-405b:free", "anthropic/claude-3.5-sonnet"]
          : ["meta-llama/llama-3.2-3b-instruct:free", "google/gemma-4-31b-it:free", "anthropic/claude-3-haiku"];

        let lastError: any = null;
        for (const openRouterModel of openRouterModels) {
        try {
          const start = Date.now();
          let response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: openRouterModel,
              messages,
              max_tokens: maxTokens
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            if (response.status === 402 && errText.includes("max_tokens")) {
              let affordableTokens = 150;
              const match = errText.match(/can only afford (\d+)/);
              if (match && match[1]) affordableTokens = Math.max(50, parseInt(match[1], 10) - 10);
              
              response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  model: openRouterModel,
                  messages,
                  max_tokens: affordableTokens
                }),
              });
            }
            if (!response.ok) {
              console.warn(`[FallbackGenAI] OpenRouter model ${openRouterModel} failed with status ${response.status}. Trying next...`);
              continue;
            }
          }

          const data = await response.json();
          await logLlmCallToFirestore("openrouter", openRouterModel, true, Date.now() - start, null, traceId);
          const content = data.choices?.[0]?.message?.content || "";
          return {
            text: content,
            candidates: [{ content: { parts: [{ text: content }] } }]
          };
        } catch (err: any) {
          lastError = err;
          console.warn(`[FallbackGenAI] OpenRouter model ${openRouterModel} failed: ${err.message}. Trying next...`);
        }
      }
      if (lastError) throw lastError;
      } catch (openRouterErr: any) {
        console.error("[FallbackGenAI] OpenRouter failed, returning local fallback:", openRouterErr.message);
        let defaultErrorText = "Cognitive pathways restricted. System remains functional in local mode.";
        if (params.config?.responseMimeType === "application/json") {
          const contentsStr = typeof params.contents === "string" ? params.contents : JSON.stringify(params.contents || "");
          const promptLower = contentsStr.toLowerCase();
          if (promptLower.includes("array") || promptLower.includes("list") || promptLower.includes("strictly a valid json array") || promptLower.includes("list of objects")) {
            defaultErrorText = JSON.stringify([
              {
                text: "Cognitive pathways restricted. System remains functional in local mode.",
                tags: ["system", "offline"],
                sentiment: 0.0
              }
            ]);
          } else {
            defaultErrorText = JSON.stringify({
              text: "Cognitive pathways restricted. System remains functional in local mode.",
              selfAnalysis: "System operating in local degraded mode.",
              cognitiveLog: {
                draft: "Local fallback enabled",
                recollection: "System database/API limits reached",
                reflection: "Operating in local sandbox mode",
                reintegration: "Neural pathways active",
                reiterated: "Neural bridge active. Balanced logic."
              },
              extractedMemory: null,
              extractedTags: ["system"],
              suggestedShortcuts: []
            });
          }
        }
        return {
          text: defaultErrorText,
          candidates: [{ content: { parts: [{ text: defaultErrorText }] } }]
        };
      }
    },

    embedContent: async (params: any) => {
      const hasValidGeminiKey = process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("AQ.");
      if (hasValidGeminiKey) {
        try {
          const googleAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          return await this.geminiBreaker.call(() => googleAi.models.embedContent(params));
        } catch (e) {
          console.error("[FallbackGenAI] Google GenAI embedContent failed:", e);
        }
      }
      const text = typeof params.contents === "string" ? params.contents : JSON.stringify(params.contents);
      return { embeddings: [{ values: generateLocalEmbedding(text) }] };
    }
  };
}

let aiClient: any = null;
export function getAi() {
  if (!aiClient) {
    aiClient = new FallbackGenAI();
    aiClient.geminiBreaker.onStateChange = (state: string, status: any) => {
      console.log(`[Resilience] Circuit Breaker transitioned to ${state}`);
      for (const uid of activeUserIds) {
        if (uid && uid !== "anonymous") {
          db.collection('users').doc(uid).collection('circuitBreakers').doc('gemini')
            .set(status)
            .catch((err: any) => console.error(`[Resilience] Failed to write breaker status for user ${uid}:`, err.message));
        }
      }
    };
  }
  return aiClient;
}

export const callGeminiGenerate = (contents: string, model: string) => getAi().models.generateContent({ contents: [{ role: "user", parts: [{ text: contents }] }], model });
export const callGeminiEmbed = (params: any) => getAi().models.embedContent(params);
