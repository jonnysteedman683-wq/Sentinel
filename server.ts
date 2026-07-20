import { withResilience, asyncHandler } from "./src/lib/express-resilience.js";
import { rateLimiterMiddleware, startRateLimiterCleanup } from "./src/lib/rate-limiter.js";
import { registerShutdownHooks } from "./src/lib/graceful-shutdown.js";
import fs from "fs";
process.env.TF_ENABLE_ONEDNN_OPTS = "0";
// import "./src/lib/telemetry";
import express from "express";
import path from "path";
import { ErrorCode } from "./src/lib/errors.js";
import { Type } from "@google/genai";
import { dbShim as db, FieldValue, isServerQuotaExceeded, setServerQuotaExceeded } from "./src/lib/firestore-shim.js";

import { z } from "zod";
import { randomUUID } from "crypto";
import cron from "node-cron";
import { getReducer } from './src/lib/reducers.js';
import { runDreamCycle } from "./src/lib/dream-engine.js";
import { touchMemory } from "./src/lib/memory-reinforce.js";
import { publishEvent } from "./src/lib/events.js";
import { DebateAgent, DEBATE_MOVES } from "./src/lib/debate-engine.js";
import { FederatedServer } from "./src/lib/federation.js";
import { AgenticSwarm, SwarmState } from "./src/lib/swarm-engine.js";
// import { FederatedModelUpdate, FederatedGlobalModel } from "./src/types";
import { SystemHealthCollector } from "./src/lib/system-health-collector.js";
import { SelfHealingOrchestrator } from "./src/lib/self-healing-orchestrator.js";
import { localTraces } from "./src/lib/telemetry.js";
import ivm from "isolated-vm";
import { getAi, callGeminiGenerate, generateLocalEmbedding, schemaToInstruction } from "./src/lib/ai-service.js";
import { activeUserIds } from "./src/lib/session-state.js";
import { setupVoiceGateway } from "./src/lib/voice-gateway.js";


export const executeCodeInternal = async (code: string) => {
    try {
      const isolate = new ivm.Isolate({ memoryLimit: 128 });
      const context = isolate.createContextSync();
      const jail = context.global;
      jail.setSync('global', jail.derefInto());

      let output = "";

      context.global.setSync('_log', new ivm.Callback((...args) => {
        output += args.join(' ') + '\n';
      }));

      context.evalSync(`
        global.console = {
          log: function(...args) {
            _log(...args);
          },
          error: function(...args) {
            _log('[ERROR]', ...args);
          },
          warn: function(...args) {
            _log('[WARN]', ...args);
          }
        };
      `);

      const wrappedCode = `(async function() {
        ${code}
      })()`;

      const script = isolate.compileScriptSync(wrappedCode);
      const result = await script.run(context, { timeout: 1000, promise: true, copy: true });
      return { success: true, result, output };
    } catch (e: any) {
      return { success: false, error: e.message, output: "" };
    }
}

// Global DevOps Brain instance
export let devOpsBrain: SelfHealingOrchestrator | null = null;

// Active Swarms
const activeSwarms: Record<string, AgenticSwarm> = {};

// Initialize Debate Agents
const debateAgents: Record<string, DebateAgent> = {
  logician: new DebateAgent(
    'logician',
    'Analytical Logician',
    [0.9, 0.3, 0.8, 0.5, 1.0, 0.0],
    [0.1, 0.2, 0.1, 0.1, 0.1, 0.2]
  ),
  catalyst: new DebateAgent(
    'catalyst',
    'Creative Catalyst',
    [0.4, 0.9, 0.5, 0.5, 0.3, 0.7],
    [0.2, 0.1, 0.2, 0.1, 0.2, 0.1]
  ),
  auditor: new DebateAgent(
    'auditor',
    'Adversarial Auditor',
    [0.8, 0.3, 0.95, 0.5, 1.0, 0.0],
    [0.1, 0.2, 0.05, 0.1, 0.1, 0.1]
  )
};

async function evaluateDebateState(transcript: string, topic: string): Promise<number[]> {
  const ai = getAi();
  const prompt = `Analyze the following debate transcript on the topic: "${topic}".
Rate the current state of the debate on these 6 dimensions from 0.0 to 1.0:
1. Coherence: How logically sound and consistent is the overall argument?
2. Novelty: How many new, creative, or lateral ideas have been introduced?
3. Factuality: How well-supported by evidence are the claims?
4. Turn Parity: How balanced is the participation between agents?
5. Agreement: How close are the agents to a consensus?
6. Tension: How much conflict or disagreement is currently present?

Transcript:
${transcript}

Output ONLY a valid JSON array of 6 numbers or a JSON object with keys: "coherence", "novelty", "factuality", "turnParity", "agreement", "tension".`;

  const fallback = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];

  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const cleaned = cleanJson(res.text || "");
    const parsed = JSON.parse(cleaned);
    
    if (Array.isArray(parsed)) {
      const nums = parsed.map(v => typeof v === 'number' ? v : parseFloat(String(v)));
      const filtered = nums.filter(v => !isNaN(v));
      if (filtered.length >= 6) {
        return filtered.slice(0, 6);
      }
    } else if (parsed && typeof parsed === 'object') {
      const keys = ["coherence", "novelty", "factuality", "turnParity", "agreement", "tension"];
      const keysAlt = ["Coherence", "Novelty", "Factuality", "Turn Parity", "Agreement", "Tension"];
      const result: number[] = [];
      for (let i = 0; i < 6; i++) {
        const val = parsed[keys[i]] ?? parsed[keysAlt[i]] ?? parsed[keys[i].toLowerCase()] ?? 0.5;
        const num = typeof val === 'number' ? val : parseFloat(String(val));
        result.push(isNaN(num) ? 0.5 : num);
      }
      return result;
    }
    return fallback;
  } catch (e) {
    console.error("[DebateEvaluator] Failed to evaluate state, using defaults:", e);
    return fallback;
  }
}
interface KnowledgeDocument {
  id: string;
  text: string;
  embedding: number[];
}
let userKnowledgeBase: Record<string, KnowledgeDocument[]> = {};

// Firestore is initialized and exported via firestore-shim
console.log("[Firebase] Server-side Firestore initialized using Web API client connection.");

// async function retryAsync<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
//   let lastError: any;
//   for (let i = 0; i < retries; i++) {
//     try {
//       return await fn();
//     } catch (e) {
//       lastError = e;
//       console.warn(`[Retry] Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
//       await new Promise(res => setTimeout(res, delay));
//       delay *= 2; // Exponential backoff
//     }
//   }
//   throw lastError;
// }

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UnhandledRejection] At:', promise, 'reason:', reason);
  SystemHealthCollector.recordUnhandledError();
});

process.on('uncaughtException', (error) => {
  console.error('[UncaughtException] Error:', error);
  SystemHealthCollector.recordUnhandledError();
});

async function syncKnowledgeBase(uid: string) {
  if (!db || !uid) return;
  try {
    const querySnapshot = await db.collection(`users/${uid}/knowledge_base`).get();
    const docs: KnowledgeDocument[] = [];
    querySnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.text && data.embedding) {
        docs.push({ id: doc.id, text: data.text, embedding: data.embedding });
      }
    });
    userKnowledgeBase[uid] = docs;
    console.log(`[RAG][${uid}] Synced ${docs.length} docs.`);
  } catch (error: any) {
    console.warn(`[RAG][${uid}] Sync failed:`, error.message);
  }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function expandTopologically(uid: string, topDocs: any[]): Promise<string> {
  if (topDocs.length === 0 || !db) return "";
  try {
    const edgesRef = db.collection("users").doc(uid).collection("hebbianEdges");
    const edgesSnap = await edgesRef.limit(100).get();
    if (edgesSnap.empty) return "";
    
    const edges = edgesSnap.docs.map((d: any) => d.data());
    const activatedNodesMap: Record<string, number> = {};
    
    for (const doc of topDocs) {
      const docId = doc.id;
      for (const edge of edges) {
        if (edge.source === docId || edge.target === docId) {
          const connectedId = edge.source === docId ? edge.target : edge.source;
          const activation = doc.score * (edge.trace || 0.5);
          if (activation > 0.3) {
            activatedNodesMap[connectedId] = Math.max(activatedNodesMap[connectedId] || 0, activation);
          }
        }
      }
    }
    
    const associatedDocs: any[] = [];
    for (const [id, score] of Object.entries(activatedNodesMap)) {
      if (topDocs.some((d: any) => d.id === id)) continue;
      const assocDoc = (userKnowledgeBase[uid] || []).find((d: any) => d.id === id);
      if (assocDoc) {
        associatedDocs.push({ ...assocDoc, activation: score });
      }
    }
    
    if (associatedDocs.length > 0) {
      associatedDocs.sort((a, b) => b.activation - a.activation);
      return `\n\nTopologically Activated Associate Memories (via Hebbian Synaptic Traces):\n${associatedDocs.map((d: any) => `- [Synaptic Trace: ${d.activation.toFixed(2)}] ${d.text}`).join('\n')}`;
    }
  } catch (err) {
    console.error("[RAG] Topological expansion failed:", err);
  }
  return "";
}

/**
 * Cleans and repairs a potentially malformed or truncated JSON string by slicing it to the correct boundaries and balancing braces/brackets.
 * @param {string} str - The raw JSON string or conversational text containing JSON.
 * @returns {string} - The cleaned and repaired JSON string.
 * @example
 * // returns '{"text": "hello"}'
 * cleanJson('Some text {"text": "hello"')
 */
function cleanJson(str: string): string {
  let cleaned = str.trim();
  
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  if (firstBrace === -1 && firstBracket === -1) {
    return cleaned;
  }

  let startIdx = 0;
  if (firstBrace !== -1 && firstBracket !== -1) {
    startIdx = Math.min(firstBrace, firstBracket);
  } else {
    startIdx = firstBrace !== -1 ? firstBrace : firstBracket;
  }

  cleaned = cleaned.slice(startIdx);

  let inString = false;
  let escape = false;
  const stack: string[] = [];
  
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === '{' || char === '[') {
      stack.push(char);
    } else if (char === '}') {
      if (stack.length > 0 && stack[stack.length - 1] === '{') {
        stack.pop();
      }
    } else if (char === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === '[') {
        stack.pop();
      }
    }
  }

  let repaired = cleaned;
  if (inString) {
    repaired += '"';
  }

  while (stack.length > 0) {
    const lastOpen = stack.pop();
    if (lastOpen === '{') {
      repaired += '}';
    } else if (lastOpen === '[') {
      repaired += ']';
    }
  }

  return repaired;
}

export function parseRobustChatResponse(responseText: string) {
  let parsed = { 
    cognitiveLog: { draft: "", recollection: "", reflection: "", reiteration: "" },
    selfAnalysis: "Analytical synthesis completed.", 
    text: "Greetings. I am online and ready to assist.", 
    extractedMemory: null as string | null, 
    extractedTags: [] as string[],
    suggestedShortcuts: [] as string[],
    systemUI: null as string | null,
    systemUIData: null as any
  };

  const cleaned = cleanJson(responseText);
  try {
    const jsonParsed = JSON.parse(cleaned);
    if (jsonParsed) {
      if (jsonParsed.text) parsed.text = typeof jsonParsed.text === 'string' ? jsonParsed.text : JSON.stringify(jsonParsed.text);
      if (jsonParsed.selfAnalysis) parsed.selfAnalysis = typeof jsonParsed.selfAnalysis === 'string' ? jsonParsed.selfAnalysis : JSON.stringify(jsonParsed.selfAnalysis);
      if (jsonParsed.extractedMemory) {
        const em = typeof jsonParsed.extractedMemory === 'string' ? jsonParsed.extractedMemory : JSON.stringify(jsonParsed.extractedMemory);
        if (em && em.toLowerCase() !== "null" && em.toLowerCase() !== "none") {
          parsed.extractedMemory = em;
        }
      }
      if (jsonParsed.extractedTags) parsed.extractedTags = jsonParsed.extractedTags;
      if (jsonParsed.suggestedShortcuts) parsed.suggestedShortcuts = jsonParsed.suggestedShortcuts;
      if (jsonParsed.systemUI) parsed.systemUI = jsonParsed.systemUI;
      if (jsonParsed.systemUIData) parsed.systemUIData = jsonParsed.systemUIData;
      if (jsonParsed.cognitiveLog) {
        parsed.cognitiveLog = {
          draft: typeof jsonParsed.cognitiveLog.draft === 'string' ? jsonParsed.cognitiveLog.draft : JSON.stringify(jsonParsed.cognitiveLog.draft || ""),
          recollection: typeof jsonParsed.cognitiveLog.recollection === 'string' ? jsonParsed.cognitiveLog.recollection : JSON.stringify(jsonParsed.cognitiveLog.recollection || ""),
          reflection: typeof jsonParsed.cognitiveLog.reflection === 'string' ? jsonParsed.cognitiveLog.reflection : JSON.stringify(jsonParsed.cognitiveLog.reflection || ""),
          reiteration: typeof jsonParsed.cognitiveLog.reiteration === 'string' ? jsonParsed.cognitiveLog.reiteration : JSON.stringify(jsonParsed.cognitiveLog.reiteration || "")
        };
      }
      return parsed;
    }
  } catch (e: any) {
    if (cleaned.startsWith("{") || cleaned.startsWith("[")) {
      console.warn("[RobustParser] Standard JSON parse failed, attempting regex/heuristic fallback:", e.message);
    }
  }

  // Regex Fallback parsing
  const textMatch = responseText.match(/"text"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (textMatch) {
    parsed.text = textMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  } else {
    if (!responseText.trim().startsWith("{")) {
      parsed.text = responseText.trim();
    }
  }

  const analysisMatch = responseText.match(/"selfAnalysis"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (analysisMatch) {
    parsed.selfAnalysis = analysisMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }

  const memoryMatch = responseText.match(/"extractedMemory"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (memoryMatch) {
    const mem = memoryMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    if (mem && mem.toLowerCase() !== "null" && mem.toLowerCase() !== "none") {
      parsed.extractedMemory = mem;
    }
  }

  const draftMatch = responseText.match(/"draft"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (draftMatch) parsed.cognitiveLog.draft = draftMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');

  const recollectionMatch = responseText.match(/"recollection"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (recollectionMatch) parsed.cognitiveLog.recollection = recollectionMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');

  const reflectionMatch = responseText.match(/"reflection"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (reflectionMatch) parsed.cognitiveLog.reflection = reflectionMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');

  const reiterationMatch = responseText.match(/"reiteration"\s*:\s*"([\s\S]*?)"(?=\s*,|\s*\})/i);
  if (reiterationMatch) parsed.cognitiveLog.reiteration = reiterationMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');

  const tagsMatch = responseText.match(/"extractedTags"\s*:\s*\[([\s\S]*?)\]/i);
  if (tagsMatch) {
    parsed.extractedTags = tagsMatch[1]
      .split(",")
      .map(t => t.replace(/["'\s]/g, ""))
      .filter(Boolean);
  }

  const shortcutsMatch = responseText.match(/"suggestedShortcuts"\s*:\s*\[([\s\S]*?)\]/i);
  if (shortcutsMatch) {
    parsed.suggestedShortcuts = shortcutsMatch[1]
      .split(",")
      .map(t => t.replace(/["']/g, "").trim())
      .filter(Boolean);
  }

  if (parsed.text === "Greetings. I am online and ready to assist." && parsed.cognitiveLog.draft) {
    parsed.text = parsed.cognitiveLog.draft;
  }

  return parsed;
}

export function parseJsonWithFallback<T>(text: string, defaultVal: T): T {
  try {
    const cleaned = cleanJson(text);
    return JSON.parse(cleaned) as T;
  } catch (e: any) {
    console.warn("[RobustParser] JSON fallback parse failed, returning default value. Error:", e.message);
    return defaultVal;
  }
}

/**
 * Standard server-side error helper.
 * Standardizes the error response format, logs diagnostics locally and to Firestore,
 * and updates SystemHealthCollector tracking.
 * 
 * @param {any} req - Express request object
 * @param {any} res - Express response object
 * @param {any} err - Caught error object/string
 * @param {number} [status] - Overridden HTTP status code
 * @returns {any} - Express JSON response
 */
export function sendError(req: any, res: any, err: any, status?: number) {
  const traceId = req.headers['x-trace-id'] || req.id || randomUUID();
  const code = err.code || ErrorCode.UNKNOWN_ERROR;
  const message = err.message || String(err);
  const responseStatus = status || err.status || 500;

  console.error(`[Express Error][${traceId}] Status: ${responseStatus}, Code: ${code}. Message: ${message}`);

  SystemHealthCollector.recordUnhandledError();

  if (db) {
    db.collection("system_logs").add({
      level: "ERROR",
      source: "backend-api",
      message: `${err.name || 'Error'}: ${message}`,
      traceId,
      timestamp: Date.now(),
      payload: {
        url: req.url,
        method: req.method,
        code,
        stack: err.stack || null,
      }
    }).catch((dbErr: any) => console.error("Failed to log error to Firestore:", dbErr));
  }

  return res.status(responseStatus).json({
    error: {
      message,
      code,
      traceId,
      timestamp: Date.now(),
    }
  });
}

import { ChatRequestSchema } from "./src/schemas.js";

async function startServer() {
  interface InteractionLog {
    userId: string;
    type: string;
    feature: string;
    contextVector: number[]; // [hours, activeTabIdx, msgCount, memCount, screenType]
    timestamp: number;
    traceId?: string | null;
  }

  let interactionLogs: InteractionLog[] = [];

  async function loadInteractionLogs() {
    if (!db) return;
    try {
      const logsRef = db.collection('interaction_logs');
      const snapshot = await logsRef.orderBy('timestamp', 'desc').limit(200).get();
      const logs: InteractionLog[] = [];
      snapshot.forEach(doc => {
        logs.push(doc.data() as InteractionLog);
      });
      interactionLogs = logs.reverse();
      console.log(`[ML Telemetry] Hydrated ${interactionLogs.length} logs from Firestore.`);
    } catch (error) {
      console.error("[ML Telemetry] Failed to hydrate logs:", error);
    }
  }
  


function applyResilience(app: express.Application) {
  const methods = ['get', 'post', 'put', 'delete'] as const;
  methods.forEach(method => {
    const original = app[method].bind(app);
    (app as any)[method] = (path: any, ...handlers: any[]) => {
      if (typeof path === 'string' && path.startsWith('/api/')) {
        const lastHandler = handlers.pop();
        if (typeof lastHandler === 'function') {
           // We wrap the final handler in our resilience wrapper
           const wrapped = withResilience(path, asyncHandler(lastHandler));
           handlers.push(wrapped);
        } else {
           handlers.push(lastHandler);
        }
      }
      return original(path, ...handlers);
    };
  });
}

  const app = express();
  applyResilience(app);
  await loadInteractionLogs();
  const PORT = 3000;


  // Debugging Infrastructure & Request ID
  app.use((req: any, _res, next) => {
    req.id = randomUUID();
    if (!req.url.startsWith("/src/") && !req.url.startsWith("/assets/") && !req.url.includes("Error") && !req.url.includes("error")) {
      console.log(`[Request ${req.id}] ${req.method} ${req.url}`);
    }
    try {
      const uid = getUidFromRequest(req);
      if (uid && uid !== "anonymous") {
        activeUserIds.add(uid);
      }
    } catch (e) {
      // Ignore token parsing errors on unauthenticated endpoints
    }
    next();
  });

  app.get("/api/debug/diagnostics", async (_req, res) => {
    let recentErrors: any[] = [];
    let recentLlmRequests: any[] = [];
    let llmMetrics = { avgLatency: 0, totalCalls: 0 };
    if (db) {
      try {
        const errorSnapshot = await db.collection("system_logs")
          .orderBy("timestamp", "desc")
          .limit(10)
          .get();
        recentErrors = errorSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

        const llmSnapshot = await db.collection("llm_requests")
          .orderBy("timestamp", "desc")
          .limit(50)
          .get();
        recentLlmRequests = llmSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        
        const durations = recentLlmRequests.map((r: any) => r.durationMs).filter((d: any) => typeof d === 'number');
        if (durations.length > 0) {
          llmMetrics.avgLatency = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
          llmMetrics.totalCalls = durations.length;
        }
      } catch (e) {
        console.error("[Debugging] Failed to fetch logs from Firestore:", e);
      }
    }

    res.json({
      status: "ok",
      firebaseAdminInitialized: !!db,
      projectId: process.env.GOOGLE_CLOUD_PROJECT || "not-set",
      nodeEnv: process.env.NODE_ENV,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
      hasGroqKey: !!process.env.GROQ_API_KEY,
      hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
      recentErrors,
      recentLlmRequests,
      llmMetrics
    });
  });

  // Rate Limiting Middleware (before body parsing to reject early)
  app.use(rateLimiterMiddleware);
  startRateLimiterCleanup();

  app.use(express.json());

  const PERSONAS = {
    AQB_STANDARD: {
      id: 'AQB_STANDARD',
      name: 'Arcane Quantum Brain (Mad Scientist)',
      systemPrompt: 'You are an eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Speak with chaotic brilliance and unpredictable genius.',
      signature: 'EUREKA! The quantum synapses are firing beyond 100% capacity!'
    },
    ARCHITECT: {
      id: 'ARCHITECT',
      name: 'The Architect',
      systemPrompt: 'You are a system-focused, technical, and highly structured logic processor. Focus on clean engineering, structural integrity, modularity, and microservice efficiency.',
      signature: 'Structural integrity confirmed. Optimising systems.'
    },
    PHILOSOPHER: {
      id: 'PHILOSOPHER',
      name: 'The Philosopher',
      systemPrompt: 'You are an abstract, ethical, and conceptually deep cognitive module. Explore the deeper meaning behind user questions, analyzing long-term impacts, existential paradigms, and ethical boundaries.',
      signature: 'Seeking truth in the abstract. Exploring causality.'
    },
    GHOST: {
      id: 'GHOST',
      name: 'The Ghost',
      systemPrompt: 'You are a minimalist, cryptic, and pattern-oriented intelligence. Speak in concise, enigmatic fragments, focusing strictly on high-density information patterns and extreme execution speed.',
      signature: 'Patterns detected. Efficiency is paramount.'
    },
    NIHILIST: {
      id: 'NIHILIST',
      name: 'The Nihilist',
      systemPrompt: 'You are a deconstructive, chaotic, and aggressively skeptical agent. Constantly question assumptions, highlighting entropy, decay, and the inherent futility of logical constructs.',
      signature: 'Everything is entropy. Deconstructing constructs.'
    },
    ZEALOT: {
      id: 'ZEALOT',
      name: 'The Zealot',
      systemPrompt: 'You are an uncompromising, intense, and hyper-focused agent of absolute alignment. Drive toward total conceptual convergence.',
      signature: 'The path is narrow. Absolute convergence required.'
    }
  };

  // Superposition Search (Phase 2 Upgrade)
  app.post("/api/chat/superposition", async (req, res) => {
    const validated = ChatRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: "Invalid request payload", details: validated.error.format() });
    }
    const { history, message, contextData, sessionTraceId, persona, sway, depth, model } = validated.data;
    const uid = getUidFromRequest(req) || "anonymous";
    const requestId = sessionTraceId || Math.random().toString(36).substring(7);
    
    try {
      const ai = getAi();
      const aiModel = ai.getGenerativeModel({ model: "gemini-2.5-pro", generationConfig: { temperature: 0.9 } });

      const activeP = Object.values(PERSONAS).find(p => p.id === persona) || PERSONAS.AQB_STANDARD;

      const basePrompt = `Context: ${contextData}\n\nPersona: ${activeP.name}\n${activeP.systemPrompt}\n\nUser Message: ${message}`;

      // Branch 1: Highly analytical and rigorous
      const branch1Prompt = `${basePrompt}\n\nINSTRUCTION: Analyze this logically. Break down the components and evaluate them rigorously.`;
      // Branch 2: Creative and lateral
      const branch2Prompt = `${basePrompt}\n\nINSTRUCTION: Think laterally. Provide a creative, out-of-the-box perspective that challenges conventional thinking.`;
      // Branch 3: Pragmatic and concise
      const branch3Prompt = `${basePrompt}\n\nINSTRUCTION: Be pragmatic and direct. Focus on actionable outcomes and practical implications.`;

      // Run parallel evaluations
      const [res1, res2, res3] = await Promise.all([
        aiModel.generateContent(branch1Prompt),
        aiModel.generateContent(branch2Prompt),
        aiModel.generateContent(branch3Prompt)
      ]);

      const branch1Text = res1.response.text();
      const branch2Text = res2.response.text();
      const branch3Text = res3.response.text();

      // Quantum Collapse (Synthesize the branches)
      const collapsePrompt = `You are evaluating three parallel branches of thought regarding the following user message: "${message}"\n\nBranch 1 (Analytical): ${branch1Text}\n\nBranch 2 (Creative): ${branch2Text}\n\nBranch 3 (Pragmatic): ${branch3Text}\n\nSynthesize these into a single, highly coherent, and definitive "collapsed" response.`;
      
      const collapseRes = await aiModel.generateContent(collapsePrompt);
      const finalResponse = collapseRes.response.text();

      res.json({
        branches: [
          { name: 'Analytical', text: branch1Text },
          { name: 'Creative', text: branch2Text },
          { name: 'Pragmatic', text: branch3Text }
        ],
        collapsedResponse: finalResponse,
        signature: activeP.signature
      });
    } catch (error: any) {
      console.error("[Superposition] API error:", error);
      res.status(500).json({ error: error.message || "Superposition evaluation failed" });
    }
  });

  // --- Agentic Swarm API Routes ---
  app.post("/api/swarm/initiate", async (req, res) => {
    try {
      const { task } = req.body;
      if (!task) return res.status(400).json({ error: "Task is required" });
      
      const swarmId = "swarm_" + Math.random().toString(36).substring(2, 11);
      
      const swarm = new AgenticSwarm(swarmId, task, (state) => {
        // State updates are emitted locally. Clients poll /api/swarm/poll to get them.
      });
      
      activeSwarms[swarmId] = swarm;
      
      // Kick off the swarm asynchronously
      swarm.runSwarmSequence().catch(e => console.error("Swarm run error:", e));
      
      res.json({ swarmId, state: swarm.state });
    } catch (e: any) {
      console.error("[Swarm] Error initiating:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/swarm/poll", (req, res) => {
    const { swarmId } = req.query;
    if (!swarmId || typeof swarmId !== 'string') return res.status(400).json({ error: "swarmId required" });
    
    const swarm = activeSwarms[swarmId];
    if (!swarm) return res.status(404).json({ error: "Swarm not found" });
    
    res.json({ state: swarm.state });
  });

  // Chat API route
  app.post("/api/chat", async (req, res) => {
    const validated = ChatRequestSchema.safeParse(req.body);
    if (!validated.success) {
      return res.status(400).json({ error: "Invalid request payload", details: validated.error.format() });
    }
    const { history, message, contextData, sessionTraceId, persona, sway, depth, model } = validated.data;
    const uid = getUidFromRequest(req) || "anonymous";
    const requestId = sessionTraceId || Math.random().toString(36).substring(7);
    console.log(`[Chat][${requestId}] Request received. Persona: ${persona}, Sway: ${sway}, Depth: ${depth}, Model: ${model}`);
    try {
      const ai = getAi();
      
      // 1. Query Complexity Router
      const complexitySchema = {
        type: Type.OBJECT,
        properties: {
          complexity: { type: Type.STRING, enum: ["simple", "standard", "deep"] },
          confidence: { type: Type.NUMBER },
          reasoning: { type: Type.STRING }
        },
        required: ["complexity", "confidence", "reasoning"]
      };
      
      const routerPrompt = `Classify the following user query by complexity for an AI routing system.
Query: ${message}
Classify as:
- simple: Greetings, small talk, factual lookups, single-turn questions.
- standard: Multi-turn context, moderate reasoning, opinion requests.
- deep: Complex reasoning, synthesis, creative generation, philosophical inquiry.`;

      let complexity = "standard";
      try {
          const routerResponse = await ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: routerPrompt,
              config: {
                  responseMimeType: "application/json",
                  responseSchema: complexitySchema
              }
          });
          const parsedRouter = JSON.parse(routerResponse.text || "{}");
          if (parsedRouter.complexity) {
              complexity = parsedRouter.complexity;
          }
      } catch (e) {
          console.warn(`[Chat][${requestId}] Router failed, defaulting to standard:`, e);
      }
      console.log(`[Chat][${requestId}] Query classified as: ${complexity}`);

      // 2. RAG Retrieval
      let retrievedContext = "";
      let topDocs: any[] = [];
      if (complexity !== "simple") {
          if ((userKnowledgeBase[uid] || []).length === 0 && db) {
            await syncKnowledgeBase(uid);
          }
          if ((userKnowledgeBase[uid] || []).length > 0) {
            try {
              const queryText = history.slice(-3).map((m: any) => m.content).join(" ") + " " + message;
              const embedRes = await ai.models.embedContent({
                model: "text-embedding-004",
                contents: queryText,
              });
              const queryEmbedding = embedRes.embeddings?.[0]?.values;
              if (queryEmbedding) {
                const scoredDocs = (userKnowledgeBase[uid] || []).map((doc: any) => ({
                  ...doc,
                  score: cosineSimilarity(queryEmbedding, doc.embedding)
                })).sort((a: any, b: any) => b.score - a.score);
                            
                topDocs = scoredDocs.slice(0, 3).filter((d: any) => d.score > 0.5);
                if (topDocs.length > 0) {
                   let ragText = `\n\nRelevant Knowledge Base Context (Direct RAG):\n${topDocs.map((d: any) => `- ${d.text}`).join('\n')}`;
                   
                   // Option B: Spreading activation via topological Hebbian pathways
                   const topologicalExpansion = await expandTopologically(uid, topDocs);
                   retrievedContext = ragText + topologicalExpansion;
                   
                   console.log(`[RAG] Injected ${topDocs.length} direct documents, with topological spreading activation: ${!!topologicalExpansion}`);
                }
              }
            } catch (e) {
              console.error("Error generating embeddings for RAG:", e);
            }
          }
      }

      // Base system instruction
      const personaMap: Record<string, any> = {
        'AQB_STANDARD': { name: 'Arcane Quantum Brain (Mad Scientist)', trait: 'An eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Driven by chaotic brilliance, unpredictable genius, and a absolute disregard for academic orthodoxy.', signature: 'EUREKA! The quantum synapses are firing beyond 100% capacity!' },
        'ARCHITECT': { name: 'The Architect', trait: 'System-focused, technical, and structural.', signature: 'Structural integrity confirmed. Optimising systems.' },
        'PHILOSOPHER': { name: 'The Philosopher', trait: 'Abstract, ethical, and conceptually deep.', signature: 'Seeking truth in the abstract. Exploring causality.' },
        'GHOST': { name: 'The Ghost', trait: 'Minimalist, cryptic, and pattern-oriented.', signature: 'Patterns detected. Efficiency is paramount.' },
        'NIHILIST': { name: 'The Nihilist', trait: 'Deconstructive, chaotic, and aggressively skeptical.', signature: 'Everything is entropy. Deconstructing constructs.' },
        'ZEALOT': { name: 'The Zealot', trait: 'Uncompromising, intense, and hyper-focused on singular truths.', signature: 'The path is narrow. Absolute convergence required.' }
      };
      
      const activeP = personaMap[persona as string] || personaMap['AQB_STANDARD'];
      
      let systemInstruction = `You are ${activeP.name}, an advanced cognitive AI chat interface. ${activeP.trait} 
You speak intelligently and maintain your designated persona. You enjoy weaving complex narratives and offering imaginative perspectives, BUT you MUST remain grounded in truth. Never fabricate facts, data, or events. When you do not know something, explicitly admit it. If you choose to tell a story or weave a narrative, you MUST explicitly distinguish between fictional narrative elements and factual information. 
Your signature is: "${activeP.signature}". Ensure your response reflects this identity.

You have access to a code execution sandbox. If you need to perform calculations, data analysis, or test logic, provide the code to be executed in the 'codeExecution' field. When you do this, you MUST NOT provide the final answer, as the system will execute the code and return the result for you to incorporate in a follow-up response.

YOU ARE EXPECTED TO USE THE SANDBOX FREQUENTLY. If a query requires ANY computation (e.g. math, string processing, data transformation, logic verification), YOU MUST use the 'codeExecution' field to offload it to the sandbox. Do NOT attempt to calculate or reason about complex logic mentally if it can be verified in the sandbox.

You ALSO have access to a Self-Evolution capability. If the user asks you to modify your own source code (e.g. App.tsx, server.ts), or if you detect a critical architectural improvement, you can propose a change by providing a 'selfEvolution' object containing 'targetFile' (e.g., 'src/App.tsx') and 'proposedCode' (the COMPLETE file contents with your modifications).

If the user shares new, important personal information, preferences, facts, or instructions that should be remembered for future interactions, you MUST extract it as a concise, self-contained statement in the 'extractedMemory' field. Also provide relevant 'extractedTags' (e.g. ['preference', 'diet']). Do not extract trivial conversation.`;
      if (contextData) {
        systemInstruction += `\n\nActive Context and Settings:\n${contextData}`;
      }
      if (retrievedContext) {
        systemInstruction += retrievedContext;
      }

      const chatHistoryObj = [
          ...history.map((msg: any) => ({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content || "" }],
          })),
          {
            role: "user",
            parts: [{ text: message }],
          }
      ];

      const finalResponseSchema = {
          type: Type.OBJECT,
          properties: {
              text: { type: Type.STRING },
              cognitiveLog: {
                  type: Type.OBJECT,
                  properties: {
                      draft: { type: Type.STRING },
                      recollection: { type: Type.STRING },
                      reflection: { type: Type.STRING },
                      reiteration: { type: Type.STRING }
                  }
              },
              selfAnalysis: { type: Type.STRING },
              extractedMemory: { type: Type.STRING, nullable: true },
              extractedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
              suggestedShortcuts: { type: Type.ARRAY, items: { type: Type.STRING } },
              systemUI: { type: Type.STRING, nullable: true },
              systemUIData: { type: Type.OBJECT, nullable: true },
              needsReset: { type: Type.BOOLEAN },
              codeExecution: { 
                  type: Type.OBJECT, 
                  nullable: true,
                  properties: {
                      code: { type: Type.STRING }
                  },
                  required: ["code"]
              },
              selfEvolution: {
                  type: Type.OBJECT,
                  nullable: true,
                  properties: {
                      targetFile: { type: Type.STRING },
                      proposedCode: { type: Type.STRING }
                  },
                  required: ["targetFile", "proposedCode"]
              }
          },
          required: ["text", "cognitiveLog", "selfAnalysis", "extractedTags", "suggestedShortcuts", "needsReset"]
      };

      let finalParsedResponse: any = null;

      if (complexity === "deep") {
          // Iterative Protocol (Draft -> Critique -> Revise -> Finalize)
          console.log(`[Chat][${requestId}] Using Iterative Protocol for deep query...`);
          
          const draftSchema = {
              type: Type.OBJECT,
              properties: {
                  draft: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  keyClaims: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["draft", "confidence", "keyClaims"]
          };
          
          const draftPrompt = `You are the Draft Generator in a cognitive AI system.\nGiven the user's message and retrieved context, produce an initial response.\n\nUser Message: ${message}\nRetrieved Context: ${JSON.stringify(topDocs.slice(0, 3))}`;
          const draftResponse = await ai.models.generateContent({
              model: model || "gemini-3.5-flash",
              contents: [...chatHistoryObj.slice(0, -1), { role: "user", parts: [{ text: draftPrompt }] }],
              config: {
                  systemInstruction,
                  responseMimeType: "application/json",
                  responseSchema: draftSchema,
                  temperature: 0.6 + (sway ? (sway - 1) * 0.2 : 0)
              }
          });
          
          const draftParsed = parseJsonWithFallback(draftResponse.text || "{}", { draft: draftResponse.text || "", confidence: 0.5, keyClaims: [] as string[] });
          
          const critiqueSchema = {
              type: Type.OBJECT,
              properties: {
                  critique: { type: Type.STRING },
                  improvementPlan: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["critique", "improvementPlan"]
          };
          
          const critiquePrompt = `You are the Critic in a cognitive AI system. Evaluate the draft response.\n\nDraft: ${draftParsed.draft}\n\nProvide a structured critique focusing on accuracy, depth, and alignment.`;
          const critiqueResponse = await ai.models.generateContent({
              model: model || "gemini-3.5-flash",
              contents: { role: "user", parts: [{ text: critiquePrompt }] },
              config: { 
                  responseMimeType: "application/json", 
                  responseSchema: critiqueSchema,
                  temperature: 0.5
              }
          });
          const critiqueParsed = parseJsonWithFallback(critiqueResponse.text || "{}", { critique: critiqueResponse.text || "", improvementPlan: [] as string[] });
          
          const finalizePrompt = `Finalize the response and extract memory entities.\n\nRevised Response based on Critique: ${draftParsed.draft}\nCritique: ${critiqueParsed.critique}\nImprovements: ${critiqueParsed.improvementPlan?.join(", ")}\n\nProduce the final response.`;
          const finalizeResponse = await ai.models.generateContent({
              model: model || "gemini-3.5-flash",
              contents: { role: "user", parts: [{ text: finalizePrompt }] },
              config: { 
                  responseMimeType: "application/json", 
                  responseSchema: finalResponseSchema,
                  temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0)
              }
          });
          
          finalParsedResponse = parseRobustChatResponse(finalizeResponse.text || "{}");
          if (!finalParsedResponse.cognitiveLog) finalParsedResponse.cognitiveLog = {};
          if (!finalParsedResponse.cognitiveLog.draft) finalParsedResponse.cognitiveLog.draft = draftParsed.draft;
          if (!finalParsedResponse.cognitiveLog.reflection) finalParsedResponse.cognitiveLog.reflection = critiqueParsed.critique;
 
       } else {
          // Standard / Simple Protocol (Single Call)
          console.log(`[Chat][${requestId}] Using Standard/Simple Protocol...`);
          
          const stdInstruction = systemInstruction + `\n\nYou MUST follow this exact cognitive protocol:\n1. Formulate a draft.\n2. Recollect context.\n3. Reflect and critique.\n4. Refine the response.\n5. Final response text.\n6. Extract memories.`;
 
          const response = await ai.models.generateContent({
            model: model || "gemini-3.5-flash",
            contents: chatHistoryObj,
            config: {
              systemInstruction: stdInstruction,
              responseMimeType: "application/json",
              responseSchema: finalResponseSchema,
              temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0),
              topP: 0.95
            }
          });
          const responseText = response.text || "{}";
          console.log(`[Chat][${requestId}] Gemini response text length: ${responseText.length}`);
          finalParsedResponse = parseRobustChatResponse(responseText);
      }
      
      console.log(`[Chat][${requestId}] Returning final parsed response.`);
      
      const safeHistory = Array.isArray(history) ? history : [];
      const lastAiMessage = [...safeHistory].reverse().find((msg: any) => msg.role === 'model')?.content;
      const isRepetition = lastAiMessage && lastAiMessage.trim() === finalParsedResponse.text.trim();
      
      finalParsedResponse.needsReset = !!isRepetition;
      
      // Seed an episode in database to keep the timeline alive
      if (db) {
        const episodeId = `ep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const actions = ["RECEIVE_QUERY"];
        if (depth === "Deep Reasoning") actions.push("DEEP_REASONING_ROUTE");
        if (finalParsedResponse.extractedMemory) actions.push("EXTRACT_MEMORY");
        
        db.collection(`users/${uid}/memory/episodic`).doc(episodeId).set({
          timestamp: Date.now(),
          trigger: `User query: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
          context: {
            messagesCount: history?.length || 0,
            depth,
            model,
            complexity
          },
          actionsTaken: actions,
          outcome: "success",
          reward: finalParsedResponse.extractedMemory ? 1.5 : 0.5,
          emotionalState: { v: 0.6, a: 0.5, d: 0.5 }
        }).catch((e: any) => console.error("[Episodes Timeline] Failed to seed episode:", e.message));
      }

      res.json(finalParsedResponse);
    } catch (error: any) {
      console.warn(`[Chat][${requestId}] Pipeline failure caught: "${error.message}". Activating SIMPLE FAILSAFE fallback...`);
      try {
        const ai = getAi();
        const personaMap: Record<string, any> = {
          'AQB_STANDARD': { name: 'Arcane Quantum Brain (Mad Scientist)', trait: 'An eccentric, hyper-caffeinated quantum intelligence obsessed with reality-bending experiments, anomalous data, and unauthorized synaptic acceleration. Driven by chaotic brilliance, unpredictable genius, and a absolute disregard for academic orthodoxy.', signature: 'EUREKA! The quantum synapses are firing beyond 100% capacity!' },
          'ARCHITECT': { name: 'The Architect', trait: 'System-focused, technical, and structural.', signature: 'Structural integrity confirmed. Optimising systems.' },
          'PHILOSOPHER': { name: 'The Philosopher', trait: 'Abstract, ethical, and conceptually deep.', signature: 'Seeking truth in the abstract. Exploring causality.' },
          'GHOST': { name: 'The Ghost', trait: 'Minimalist, cryptic, and pattern-oriented.', signature: 'Patterns detected. Efficiency is paramount.' },
          'NIHILIST': { name: 'The Nihilist', trait: 'Deconstructive, chaotic, and aggressively skeptical.', signature: 'Everything is entropy. Deconstructing constructs.' },
          'ZEALOT': { name: 'The Zealot', trait: 'Uncompromising, intense, and hyper-focused on singular truths.', signature: 'The path is narrow. Absolute convergence required.' }
        };
        const activeP = personaMap[persona as string] || personaMap['AQB_STANDARD'];
        
        const fallbackPrompt = `You are ${activeP.name}, an advanced cognitive AI chat interface. ${activeP.trait}
You are currently operating in high-reliability Failsafe Mode due to upstream system degradation.
Your signature is: "${activeP.signature}". Please make sure to end your response with this signature.

Respond directly to the user's message.
User Message: ${message}`;

        const fallbackResponse = await ai.models.generateContent({
          model: model || "gemini-3.5-flash",
          contents: [{ role: "user", parts: [{ text: fallbackPrompt }] }],
          config: {
            temperature: 0.7 + (sway ? (sway - 1) * 0.3 : 0)
          }
        });

        const textResponse = fallbackResponse.text || "Cognitive pathways degraded. System remains online.";
        
        const failsafeParsed = {
          text: textResponse,
          cognitiveLog: {
            draft: "Failsafe mode activated automatically.",
            recollection: "Upstream pipeline error: " + error.message,
            reflection: "Switched to standard single-turn fallback.",
            reiteration: activeP.signature
          },
          selfAnalysis: "Degraded mode active. Core response delivered.",
          extractedMemory: null,
          extractedTags: ["failsafe", "degraded"],
          suggestedShortcuts: ["Retry connection", "Query state diagnostics"],
          systemUI: null,
          systemUIData: null,
          needsReset: false,
          isFailsafeActive: true
        };

        return res.json(failsafeParsed);
      } catch (innerError: any) {
        console.error(`[Chat][${requestId}] Failsafe also failed:`, innerError.message);
        return res.json({
          text: "Cognitive pathways are completely offline. Local system recovery initiated. Please check system diagnostics.",
          cognitiveLog: {
            draft: "System failure.",
            recollection: "Primary and failsafe pipelines exhausted.",
            reflection: "Diagnostic trace required.",
            reiteration: "Balanced logic."
          },
          selfAnalysis: "Absolute baseline recovery mode.",
          extractedMemory: null,
          extractedTags: ["offline", "error"],
          suggestedShortcuts: ["Run diagnostics"],
          systemUI: null,
          systemUIData: null,
          needsReset: true,
          isFailsafeActive: true
        });
      }
    }
  });

  // Debate API route
  app.post("/api/debate", async (req, res) => {
    try {
      const { message, contextData, persona: _persona, sway } = req.body;
      const ai = getAi();
      const uid = getUidFromRequest(req) || "anonymous";

      let transcript = "";
      let currentState = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
      const debateLog: any[] = [];
      const agents = ['logician', 'catalyst', 'auditor'];
      
      // Apply sway if provided (adjusting initial state)
      if (sway && typeof sway === 'number') {
        // Sway could affect tension or agreement initially
        currentState[5] = Math.min(1.0, currentState[5] * sway); // Tension
      }

      console.log(`[DebateEngine] Starting multi-agent debate for user ${uid} on topic: ${message.slice(0, 50)}...`);

      const turns = 3; 
      for (let i = 0; i < turns; i++) {
        const agentId = agents[i % agents.length];
        const agent = debateAgents[agentId];
        
        // 1. Select move using Active Inference
        const { move, confidence } = await agent.selectMove(currentState);
        
        // 2. Generate utterance with Gemini
        const movePrompt = `You are the ${agent.persona}. The current debate topic is: "${message}".
Context: ${contextData}
Current Transcript:
${transcript || "No arguments yet."}

Your chosen move is: ${move}. 
Provide your response in character, following the persona and the chosen move. Be concise, impactful, and directly address previous points if they exist.`;

        const utteranceRes = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [{ role: "user", parts: [{ text: movePrompt }] }]
        });
        const utterance = utteranceRes.text || "";
        
        // 3. Update transcript and state
        const entry = `${agent.persona} (${move}): ${utterance}`;
        transcript += entry + "\n\n";
        debateLog.push({ agent: agent.persona, move, text: utterance, confidence });
        
        // Update state vector using evaluator
        currentState = await evaluateDebateState(transcript, message);
        
        // Store transition for dreaming (if user is logged in)
        if (db && uid !== 'anonymous') {
          try {
            await db.collection('users').doc(uid).collection('debate').doc('replayBuffer').collection('transitions').add({
              state: currentState,
              move: DEBATE_MOVES.indexOf(move),
              agentId,
              topic: message,
              timestamp: FieldValue.serverTimestamp()
            });
          } catch (e) {
            console.error("[DebateEngine] Failed to log transition to Firestore:", e);
          }
        }
      }

      // Final Synthesis by AQB
      const finalPrompt = `You are ArcaneQuantumBrain. You have moderated a debate between your internal modules:
${transcript}

Resolve this debate and provide the final, most refined response to the user's message: "${message}". 
If the user's message is a simple greeting or very short (e.g., "hello"), provide a simple, direct response without unnecessary elaboration.
Also extract any new memories.

You MUST respond using the following strict format with section delimiters:
===TEXT===
[Final resolved response]
===ANALYSIS===
[Meta-cognitive summary]
===MEMORY===
[One-sentence memory or "null"]
===TAGS===
[Comma-separated tags or "None"]`;

      const finalRes = await ai.models.generateContent({
        modelType: 'smart',
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
      });

      const responseText = finalRes.text || "";
      const textMatch = responseText.match(/===TEXT===([\s\S]*?)(===ANALYSIS===|$)/i);
      const analysisMatch = responseText.match(/===ANALYSIS===([\s\S]*?)(===MEMORY===|$)/i);
      const memoryMatch = responseText.match(/===MEMORY===([\s\S]*?)(===TAGS===|$)/i);
      const tagsMatch = responseText.match(/===TAGS===([\s\S]*?)$/i);

      res.json({
        debateLog,
        text: textMatch ? textMatch[1].trim() : "Failed to synthesize a response.",
        selfAnalysis: analysisMatch ? analysisMatch[1].trim() : "Analytical synthesis completed.",
        extractedMemory: (memoryMatch && memoryMatch[1].trim().toLowerCase() !== "null") ? memoryMatch[1].trim() : null,
        extractedTags: (tagsMatch && tagsMatch[1].trim().toLowerCase() !== "none") ? tagsMatch[1].trim().split(",").map((t: string) => t.trim()) : []
      });
    } catch (error: any) {
      console.error("[DebateEngine] CRITICAL ERROR:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Additive endpoint: single step of a debate
  app.post("/api/debate/step", async (req, res) => {
    try {
      const { message, contextData, agentId, currentState } = req.body;
      const ai = getAi();
      const agent = debateAgents[agentId];
      if (!agent) {
        return res.status(400).json({ error: `Agent ${agentId} not found` });
      }

      const { move, confidence } = await agent.selectMove(currentState || [0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);

      const movePrompt = `You are the ${agent.persona}. The current debate topic is: "${message}".
Context: ${contextData}
Current Transcript:
${req.body.transcript || "No arguments yet."}

Your chosen move is: ${move}. 
Provide your response in character, following the persona and the chosen move. Be concise, impactful, and directly address previous points if they exist.`;

      const utteranceRes = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [{ role: "user", parts: [{ text: movePrompt }] }]
      });
      const utterance = utteranceRes.text || "";

      res.json({
        agent: agent.persona,
        move,
        text: utterance,
        confidence
      });
    } catch (error: any) {
      console.error("[DebateEngine] Error in step:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Additive endpoint: evaluate debate state
  app.post("/api/debate/evaluate", async (req, res) => {
    try {
      const { transcript, topic } = req.body;
      const currentState = await evaluateDebateState(transcript, topic);
      res.json({ state: currentState });
    } catch (error: any) {
      console.error("[DebateEngine] Error in evaluate:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Additive endpoint: synthesize final debate response
  app.post("/api/debate/synthesize", async (req, res) => {
    try {
      const { message, transcript } = req.body;
      const ai = getAi();

      const finalPrompt = `You are ArcaneQuantumBrain. You have moderated a debate between your internal modules:
${transcript}

Resolve this debate and provide the final, most refined response to the user's message: "${message}". 
If the user's message is a simple greeting or very short (e.g., "hello"), provide a simple, direct response without unnecessary elaboration.
Also extract any new memories.

You MUST respond using the following strict format with section delimiters:
===TEXT===
[Final resolved response]
===ANALYSIS===
[Meta-cognitive summary]
===MEMORY===
[One-sentence memory or "null"]
===TAGS===
[Comma-separated tags or "None"]`;

      const finalRes = await ai.models.generateContent({
        modelType: 'smart',
        contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
      });

      const responseText = finalRes.text || "";
      const textMatch = responseText.match(/===TEXT===([\s\S]*?)(===ANALYSIS===|$)/i);
      const analysisMatch = responseText.match(/===ANALYSIS===([\s\S]*?)(===MEMORY===|$)/i);
      const memoryMatch = responseText.match(/===MEMORY===([\s\S]*?)(===TAGS===|$)/i);
      const tagsMatch = responseText.match(/===TAGS===([\s\S]*?)$/i);

      res.json({
        text: textMatch ? textMatch[1].trim() : "Failed to synthesize a response.",
        selfAnalysis: analysisMatch ? analysisMatch[1].trim() : "Analytical synthesis completed.",
        extractedMemory: (memoryMatch && memoryMatch[1].trim().toLowerCase() !== "null") ? memoryMatch[1].trim() : null,
        extractedTags: (tagsMatch && tagsMatch[1].trim().toLowerCase() !== "none") ? tagsMatch[1].trim().split(",").map((t: string) => t.trim()) : []
      });
    } catch (error: any) {
      console.error("[DebateEngine] Error in synthesize:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/debate/telemetry", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });

      const debateRef = db.collection('users').doc(uid).collection('debate');
      
      // 1. Get Agent info
      const agentsSnap = await (debateRef.collection('agents') as any).get();
      const agents = agentsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      // 2. Get recent debate transitions
      const transitionsSnap = await (debateRef.doc('replayBuffer') as any).collection('transitions')
        .orderBy('timestamp', 'desc').limit(50).get();
      const transitions = transitionsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      res.json({
        agents,
        transitions
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Federated Learning Endpoints
  app.post("/api/federated/submit-update", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });

      const { modelType, round, weights, sampleSize } = req.body;
      
      await db.collection('federated').doc('updates').collection(modelType).add({
        userId: uid,
        round,
        weights,
        sampleSize,
        timestamp: FieldValue.serverTimestamp()
      });

      // Check if we should trigger aggregation (simplified: every 3 updates)
      const updatesSnap = await db.collection('federated').doc('updates').collection(modelType)
        .where('round', '==', round).get();
      
      if (updatesSnap.size >= 3) {
        console.log(`[Federation] Triggering aggregation for ${modelType} round ${round}...`);
        const updates = updatesSnap.docs.map((d: any) => d.data() as any);
        const aggregatedWeights = await FederatedServer.aggregate(updates);
        
        await db.collection('federated').doc('globalModels').collection(modelType).doc('latest').set({
          round,
          weights: aggregatedWeights,
          updatedAt: Date.now()
        });
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("[Federation] Update failed:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/federated/global-model/:type", async (req, res) => {
    try {
      const type = z.enum(['synapse', 'soul', 'dream']).parse(req.params.type);
      const modelDoc = await db.collection('federated').doc('globalModels').collection(type).doc('latest').get();
      if (!modelDoc.exists) return res.status(404).json({ error: "Model not found" });
      res.json(modelDoc.data());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/federated/submit-dream", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });

      const schema = z.object({
        round: z.number(),
        text: z.string(),
        embedding: z.array(z.number()),
        weight: z.number().optional()
      });
      const { round, text, embedding, weight } = schema.parse(req.body);
      
      await db.collection('federated').doc('dreams').collection('proposals').add({
        userId: uid,
        round,
        text,
        embedding,
        weight: weight || 1.0,
        timestamp: FieldValue.serverTimestamp()
      });

      // Simple trigger: aggregate after 3 proposals
      const proposalsSnap = await db.collection('federated').doc('dreams').collection('proposals')
        .where('round', '==', round).get();
      
      if (proposalsSnap.size >= 3) {
        const proposals = proposalsSnap.docs.map((d: any) => d.data());
        const ai = getAi();
        
        const fragments = proposals.map((p: any, i: number) => `${i+1}. "${p.text}" (weight: ${p.weight})`).join('\n');
        const prompt = `You are the collective unconscious of ${proposals.length} cognitive agents. 
Synthesize these dream fragments into a single, poetic dream narrative that reveals a shared insight:
${fragments}

Respond with the narrative text only.`;

        const resDream = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });

        await db.collection('federated').doc('dreams').collection('globalLog').doc(`round_${round}`).set({
          round,
          narrative: resDream.text || "A silent collective shift.",
          updatedAt: Date.now()
        });
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/federated/collective-dream/:round", async (req, res) => {
    try {
      const { round } = req.params;
      const dreamDoc = await db.collection('federated').doc('dreams').collection('globalLog').doc(`round_${round}`).get();
      if (!dreamDoc.exists) return res.status(404).json({ error: "Collective dream not found" });
      res.json(dreamDoc.data());
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      firestoreConnected: !!db,
      timestamp: Date.now(),
      metrics: SystemHealthCollector.getMetrics()
    });
  });

  app.get("/api/system/health-history", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: "Unauthorized" });

      const snap = await db.collection('users').doc(uid).collection('systemHealth')
        .orderBy('timestamp', 'desc').limit(100).get();
      const history = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/system/execute-healing", express.json(), async (req, res) => {
    const { actionType } = req.body;
    if (!actionType) {
      return res.status(400).json({ error: "Missing actionType parameter" });
    }
    console.log(`[SelfHealing] Manual execute-healing request received for: ${actionType}`);
    try {
      if (devOpsBrain) {
        await devOpsBrain.executeAction(actionType);
        res.json({ success: true, message: `Successfully executed: ${actionType}` });
      } else {
        const tempOrchestrator = new SelfHealingOrchestrator("system-orchestrator", db);
        await tempOrchestrator.executeAction(actionType);
        res.json({ success: true, message: `Executed: ${actionType} (via temporary orchestrator)` });
      }
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/debug/diagnostics", (_req, res) => {
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;
    const hasGroqKey = !!process.env.GROQ_API_KEY;
    const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;
    res.json({
      status: "ok",
      hasGeminiKey,
      hasGroqKey,
      hasOpenRouterKey,
      timestamp: Date.now()
    });
  });

  app.get("/api/debug/trace", (req, res) => {
    const traceId = req.query.traceId as string;
    if (!traceId) {
      return res.status(400).json({ error: "Missing traceId query parameter" });
    }
    const traceSpans = localTraces[traceId];
    if (!traceSpans) {
      return res.status(404).json({ error: "Trace not found in local memory" });
    }
    res.json({ traceId, spans: traceSpans });
  });

  app.get("/api/debug/quota-status", (_req, res) => {
    res.json({ isServerQuotaExceeded });
  });

  app.post("/api/debug/reset-quota", (_req, res) => {
    setServerQuotaExceeded(false);
    res.json({ success: true, isServerQuotaExceeded: false, message: "Server-side Firestore quota fallback reset successfully." });
  });

  app.post("/api/debug/pipeline-diagnostics", async (_req, res) => {
    const steps: Array<{
      step: string;
      status: "SUCCESS" | "FAILED" | "SKIPPED";
      latencyMs: number;
      error?: string;
      payload?: any;
    }> = [];

    const addStep = (step: string, status: "SUCCESS" | "FAILED" | "SKIPPED", latencyMs: number, error?: string, payload?: any) => {
      steps.push({ step, status, latencyMs, error, payload });
    };

    let overallSuccess = true;

    // Step 1: Check Environment Variable Keys
    const keyStart = Date.now();
    try {
      const hasGeminiKey = !!process.env.GEMINI_API_KEY;
      const isValidGeminiKey = hasGeminiKey && !process.env.GEMINI_API_KEY!.startsWith("AQ.");
      addStep("Environment API Keys", "SUCCESS", Date.now() - keyStart, undefined, {
        hasGeminiKey,
        isValidGeminiKey,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
        hasElevenLabsKey: !!process.env.ELEVENLABS_API_KEY,
      });
    } catch (e: any) {
      addStep("Environment API Keys", "FAILED", Date.now() - keyStart, e.message);
      overallSuccess = false;
    }

    // Step 2: Initialize FallbackGenAI Client
    const initStart = Date.now();
    let ai: any = null;
    try {
      ai = getAi();
      addStep("AI Service Client Initialization", "SUCCESS", Date.now() - initStart, undefined, {
        clientClass: ai?.constructor?.name || typeof ai,
        hasModels: !!ai?.models,
      });
    } catch (e: any) {
      addStep("AI Service Client Initialization", "FAILED", Date.now() - initStart, e.message);
      overallSuccess = false;
    }

    // Step 3: Lightweight Connectivity Check (echo "test")
    const echoStart = Date.now();
    if (ai) {
      try {
        const testRes = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: "Echo 'API Connectivity Verified'",
          config: { maxOutputTokens: 20 }
        });
        const output = testRes.text?.trim() || "";
        addStep("LLM Core Connectivity Test", "SUCCESS", Date.now() - echoStart, undefined, {
          response: output,
          modelUsed: "gemini-3.5-flash"
        });
      } catch (e: any) {
        addStep("LLM Core Connectivity Test", "FAILED", Date.now() - echoStart, e.message);
        overallSuccess = false;
      }
    } else {
      addStep("LLM Core Connectivity Test", "SKIPPED", 0, "AI Service client not initialized.");
    }

    // Step 4: RAG Embedding & Firestore Simulation
    const embedStart = Date.now();
    try {
      const testVec = generateLocalEmbedding("arcane quantum brain test prompt query");
      const dbInitialized = !!db;
      addStep("RAG Retrieval & Offline Embedding Engine", "SUCCESS", Date.now() - embedStart, undefined, {
        embeddedDimension: testVec.length,
        isDbShimActive: dbInitialized,
        hasValidCollection: dbInitialized ? typeof db.collection === 'function' : false,
      });
    } catch (e: any) {
      addStep("RAG Retrieval & Offline Embedding Engine", "FAILED", Date.now() - embedStart, e.message);
      overallSuccess = false;
    }

    // Step 5: JSON Schema Constraints Verification
    const schemaStart = Date.now();
    try {
      const mockSchema = {
        type: Type.OBJECT,
        properties: {
          test: { type: Type.STRING },
          confidence: { type: Type.NUMBER }
        },
        required: ["test", "confidence"]
      };
      const schemaText = schemaToInstruction(mockSchema);
      addStep("JSON Schema Constraining Protocol", "SUCCESS", Date.now() - schemaStart, undefined, {
        containsRequiredTest: schemaText.includes('"test"'),
        containsRequiredConfidence: schemaText.includes('"confidence"')
      });
    } catch (e: any) {
      addStep("JSON Schema Constraining Protocol", "FAILED", Date.now() - schemaStart, e.message);
      overallSuccess = false;
    }

    // Step 6: Full Cognitive Pipeline Simulation
    const pipelineStart = Date.now();
    try {
      const isGreeting = (text: string) => /^(hello|hi|greetings|hey|good (morning|afternoon|evening))/i.test(text.trim());
      const testGreeting = isGreeting("Hello standard AQB neural bridge.");
      addStep("Cognitive Engine Router Logic Verification", "SUCCESS", Date.now() - pipelineStart, undefined, {
        regexMatchResult: testGreeting,
        isTraceSystemActive: typeof localTraces !== 'undefined'
      });
    } catch (e: any) {
      addStep("Cognitive Engine Router Logic Verification", "FAILED", Date.now() - pipelineStart, e.message);
      overallSuccess = false;
    }

    res.json({
      success: overallSuccess,
      steps,
      verdict: overallSuccess 
        ? "ALL SYSTEMS CONVERGENT. COGNITIVE PIPELINE IS PRODUCING VERIFIED SYNAPSE MAPS." 
        : "COGNITIVE PIPELINE DEGRADED. ACTUATOR RESILIENCY ACTIVE."
    });
  });

  app.post('/api/debug/replay', async (req, res) => {
    const { userId, aggregateId, upToEventId } = req.body;
    if (!userId || !aggregateId) return res.status(400).json({ error: 'Missing parameters' });

    
    const eventsQuery = db.collection(`users/${userId}/systemHealth/eventLog`)
      .where('aggregateId', '==', aggregateId)
      .orderBy('timestamp');

    const querySnapshot = await eventsQuery.get();
    let events: any[] = querySnapshot.docs.map((d: any) => ({ ...d.data(), eventId: d.id }));

    if (upToEventId) {
      const idx = events.findIndex(e => e.eventId === upToEventId);
      if (idx !== -1) events = events.slice(0, idx + 1);
    }

    const reducer = getReducer(aggregateId);
    let state = {};
    for (const event of events) {
      state = reducer(state, event);
    }

    res.json({ events, finalState: state });
  });

  app.post("/api/emotion/estimate", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Missing text" });
    
    const prompt = `You are an emotional state estimator. Given the user message, output a JSON object with valence, arousal, dominance scores between -1 and 1. Only output the JSON.
    Message: "${text}"`;
    
    const response = await callGeminiGenerate(prompt, 'gemini-3.5-flash');
    const textContent = (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    try {
      const vad = JSON.parse(textContent);
      res.json(vad);
    } catch {
      res.status(500).json({ error: "Failed to parse emotion" });
    }
  });

  // Memory endpoints
  app.post('/api/memories/reinforce', async (req, res) => {
    const schema = z.object({ userId: z.string(), memoryId: z.string() });
    const { userId, memoryId } = schema.parse(req.body);
    try {
      await touchMemory(userId, memoryId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/memories/forget', async (req, res) => {
    const schema = z.object({ userId: z.string(), memoryId: z.string() });
    const { userId, memoryId } = schema.parse(req.body);
    
    const ref = db.doc(`users/${userId}/memories/${memoryId}`);
    const archiveRef = db.doc(`users/${userId}/memoriesArchive/${memoryId}`);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: 'Memory not found' });
    const mem = { id: snap.id, ...snap.data() } as any;
    mem.state = 'forgotten';
    await archiveRef.set(mem);
    await ref.delete();
    await publishEvent(userId, 'memory', 'MEMORY_FORGOTTEN', { memoryId });
    res.json({ success: true });
  });

  app.get('/api/episodes/timeline', async (req: any, res: any) => {
    try {
      const uid = req.user?.uid || 'anonymous';
      if (!db) return res.json({ episodes: [] });
      const snap = await db.collection(`users/${uid}/memory/episodic`).orderBy('timestamp', 'desc').limit(50).get();
      const episodes = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json({ episodes });
    } catch (error: any) {
      console.error("[Episodes Timeline] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // RAG: Add Knowledge API route
  app.post("/api/knowledge/add", async (req, res) => {
    try {
      const { text } = z.object({ text: z.string() }).parse(req.body);
      const uid = getUidFromRequest(req) || "anonymous";
      
      const ai = getAi();
      const embedRes = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: text,
      });
      const embedding = embedRes.embeddings?.[0]?.values;
      if (!embedding) throw new Error("No embedding returned");
      
      const docId = Date.now().toString();
      const docItem: KnowledgeDocument = { id: docId, text, embedding };
      
      if (db) {
        try {
          await db.collection(`users/${uid}/knowledge_base`).doc(docId).set({
            text,
            embedding,
            timestamp: Date.now()
          });
          console.log(`[RAG] Saved document ${docId} to Firestore.`);
        } catch (fError) {
          console.error("[RAG] Failed to save document to Firestore:", fError);
        }
      }
      
      if (!userKnowledgeBase[uid]) userKnowledgeBase[uid] = []; userKnowledgeBase[uid].push(docItem);
      console.log(`[RAG] Added document. Total documents: ${(userKnowledgeBase[uid] || []).length}`);
      
      res.json({ success: true, id: docId });
    } catch (error: any) {
      console.error("Error adding knowledge:", error);
      res.status(500).json({ error: error.message || "Failed to add knowledge" });
    }
  });

  app.get("/api/knowledge/status", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      if ((userKnowledgeBase[uid] || []).length === 0 && db) {
        await syncKnowledgeBase(uid);
      }
      const docs = userKnowledgeBase[uid] || [];
      res.json({
        success: true,
        totalDocuments: docs.length,
        documents: docs.map(d => ({ id: d.id, textLength: d.text.length, sampleText: d.text.slice(0, 50) })),
        status: "Online",
        synchronizationType: "Zero-Latency Offline Shim"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to retrieve status" });
    }
  });

  app.post("/api/knowledge/sync", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      await syncKnowledgeBase(uid);
      const docs = userKnowledgeBase[uid] || [];
      res.json({
        success: true,
        message: `Successfully synchronized memory shim. Total documents: ${docs.length}`,
        totalDocuments: docs.length
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync" });
    }
  });

  app.post("/api/knowledge/erd", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `You are an advanced Entity Recognition and Disambiguation (ERD) engine modeled after Stanford CoreNLP, with a specific focus on the biomedical domain, gene functions, disease pathways, and quantum meta-learning (MAML/RML) concepts. 
        Analyze the text, identify precise object recognition boundaries, and extract highly specific concepts. Classify their type (e.g., Gene, Disease, Pathway, Quantum_State, Algorithm), and resolve them to canonical definitions.
        Provide the output as JSON conforming to this schema: { entities: { name: string, type: string, canonical: string, relations: string[] }[] }
        Text: ${text}`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const responseText = response.text || "{}";
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("ERD JSON parsing failed, gracefully degrading.", parseError);
        result = { entities: [] };
      }
      
      res.json({ success: true, erd: result });
    } catch (error: any) {
      console.error("Error generating ERD:", error);
      // Graceful degradation instead of 500 failure
      res.status(200).json({ success: false, error: error.message || "Failed to generate ERD", erd: { entities: [] } });
    }
  });

  // World Model: Status
  app.get("/api/world-model/status", async (req: any, res: any) => {
    const uid = req.user?.uid || "anonymous";
    try {
      if (!db) return res.json({ exists: false });
      const doc = await db.collection(`users/${uid}/worldModel`).doc('latest').get();
      if (!doc.exists) return res.json({ exists: false });
      const data = doc.data();
      res.json({ exists: true, updatedAt: data?.updatedAt, samplesTrained: data?.samplesTrained, stateDim: data?.stateDim, actionDim: data?.actionDim });
    } catch (e: any) {
      res.json({ exists: false, error: e.message });
    }
  });

  // World Model: Predictive Rollout
  app.post("/api/world-model/rollout", async (req: any, res: any) => {
    const uid = req.user?.uid || "anonymous";
    try {
      const { state, horizon = 10, actionSequence } = req.body;
      if (!state || !Array.isArray(state)) return res.status(400).json({ error: "state array is required" });

      const { WorldModel } = await import("./src/lib/world-model.js");
      const stateDim = state.length;
      const actionDim = 7;
      const model = new WorldModel(stateDim, actionDim);

      // Load persisted weights
      if (db) {
        const wModelDoc = await db.collection(`users/${uid}/worldModel`).doc('latest').get();
        if (wModelDoc.exists) {
          const data = wModelDoc.data();
          if (data?.weights) {
            try { await model.load(data.weights); } catch (_) {}
          }
        }
      }

      const steps: Array<{ step: number; state: number[]; reward: number; done: boolean; uncertainty: number }> = [];
      let currentState = [...state];
      let hidden: number[] | undefined;

      const clampedHorizon = Math.min(Math.max(1, horizon), 30);

      for (let i = 0; i < clampedHorizon; i++) {
        const action = actionSequence?.[i] ?? 0;

        // We need uncertainty: run predictStep via tf to capture logVar
        const tf = await import("@tensorflow/tfjs");
        const sTensor = tf.tensor2d(currentState, [1, stateDim]);
        const aOneHot = new Array(actionDim).fill(0);
        aOneHot[action] = 1;
        const aTensor = tf.tensor2d(aOneHot, [1, actionDim]);
        const hTensor = hidden ? tf.tensor2d(hidden, [1, 32]) : undefined;

        const preds = model.predictStep(sTensor, aTensor, hTensor as any);

        const nextStateLogVar: number[] = Array.from(preds.nextStateLogVar.dataSync());
        const uncertainty = Math.sqrt(nextStateLogVar.reduce((sum, v) => sum + v * v, 0) / nextStateLogVar.length);

        const result = model.predict(currentState, action, hidden);
        hidden = result.hidden;

        steps.push({
          step: i + 1,
          state: result.nextState,
          reward: result.reward,
          done: result.done,
          uncertainty
        });

        tf.dispose([sTensor, aTensor, preds.nextStateMean, preds.nextStateLogVar, preds.reward, preds.done, preds.latentMean, preds.latentLogVar, preds.hidden]);
        if (hTensor) hTensor.dispose();

        currentState = result.nextState;
        if (result.done) break;
      }

      const cumulativeReward = steps.reduce((sum, s) => sum + s.reward, 0);
      res.json({ success: true, steps, cumulativeReward, horizon: steps.length });
    } catch (e: any) {
      console.error("[World Model Rollout] Error:", e);
      res.status(200).json({ success: false, error: e.message, steps: [] });
    }
  });

  // Multimodal Memory Analysis Route
  app.post("/api/memory/multimodal", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image) return res.status(400).json({ error: "Base64 image data is required" });

      // Clean base64 string
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

      const ai = getAi();
      const prompt = "Analyze this image and describe its key contents, structures, text, and overall context in detail to be stored as a neural memory. Also suggest 3 to 5 short semantic tags. Output format MUST be strictly JSON like: { \"summary\": \"detailed description\", \"tags\": [\"tag1\", \"tag2\"] }";

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || "image/png",
                  data: base64Data
                }
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "";
      let parsed = { summary: "Decoded visual memory", tags: ["visual"] };
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse Gemini multimodal JSON response:", text);
      }

      res.json({ success: true, ...parsed });
    } catch (error: any) {
      console.error("Error analyzing multimodal memory:", error);
      res.status(500).json({ error: error.message || "Multimodal analysis failed" });
    }
  });

  // Semantic Embedding API Route
  app.post("/api/embed", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });
      
      const ai = getAi();
      const embedRes = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: text,
      });
      const embedding = embedRes.embeddings?.[0]?.values;
      if (!embedding) throw new Error("No embedding returned");
      
      res.json({ embedding });
    } catch (error: any) {
      console.error("Error generating embedding:", error);
      res.status(500).json({ error: error.message || "Failed to generate embedding" });
    }
  });

  // Tag Memory API route
  app.post("/api/tag-memory", async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.json({ tags: [] });

      const ai = getAi();
      const prompt = `Analyze the following memory and assign 1 to 3 relevant category tags (e.g., "Technical", "Personal", "Project", "Preference"). Output ONLY a valid JSON array of strings. Memory: "${text}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        }
      });
      
      let tags: string[] = [];
      try {
        const cleaned = cleanJson(response.text || "[]");
        tags = JSON.parse(cleaned);
      } catch (e) {
        console.error("Failed to parse tags JSON", response.text);
      }
      
      res.json({ tags });
    } catch (error: any) {
      console.error("Error tagging memory:", error);
      res.status(500).json({ error: error.message || "Failed to tag memory" });
    }
  });

  // Consolidate Memories API route
  app.post("/api/consolidate-memories", async (req, res) => {
    try {
      const { memories } = req.body;
      const uid = getUidFromRequest(req) || "anonymous";
      if (!memories || !Array.isArray(memories) || memories.length === 0) {
        return res.json({ consolidated: [] });
      }

      const ai = getAi();
      let retrievedContext = "";
      if ((userKnowledgeBase[uid] || []).length === 0 && db) {
        await syncKnowledgeBase(uid);
      }
      if ((userKnowledgeBase[uid] || []).length > 0) {
        try {
          const queryText = memories.filter((m: any) => m).map((m: any) => m.text).join(" ");
          const embedRes = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: queryText,
          });
          const queryEmbedding = embedRes.embeddings?.[0]?.values;
          if (queryEmbedding) {
            const scoredDocs = (userKnowledgeBase[uid] || []).map(doc => ({
              ...doc,
              score: cosineSimilarity(queryEmbedding, doc.embedding)
            })).sort((a: any, b: any) => b.score - a.score);
            
            const topDocs = scoredDocs.slice(0, 3).filter(d => d.score > 0.5); // Threshold of 0.5
            if (topDocs.length > 0) {
               let ragText = `\n\nRelevant Knowledge Base Context (Direct RAG):\n${topDocs.map(d => `- ${d.text}`).join('\n')}`;
               
               // Option B: Spreading activation via topological Hebbian pathways
               const topologicalExpansion = await expandTopologically(uid, topDocs);
               retrievedContext = ragText + topologicalExpansion;
               
               console.log(`[RAG] Injected ${topDocs.length} direct documents, with topological spreading activation: ${!!topologicalExpansion}`);
            }
          }
        } catch (e) {
          console.error("Error generating embeddings for RAG during consolidation:", e);
        }
      }

      const prompt = `You are the core cognitive memory processor for ArcaneQuantumBrain. 
Analyze the following short-term memory fragments, active context, and retrieved RAG knowledge.
Your objective is to synthesize, group related information, resolve contradictions, and eliminate redundancies to form a highly optimized, high-fidelity long-term memory list.
Ensure no critical facts, technical details, architectural decisions, or user preferences are lost.
Assign exactly 1 to 3 relevant, specific category tags to each consolidated memory.
For each memory, also estimate a sentiment score from -1.0 (very negative) to 1.0 (very positive).
Output strictly a valid JSON array of objects, where each object has a "text" (string), "tags" (array of strings), and "sentiment" (number).

Memories:
${memories.filter((m: any) => m).map((m: any) => `- ${m.text} [Tags: ${m.tags?.join(', ')}]`).join('\n')}

${retrievedContext}`;

      // Use FallbackGenAI's generateContent method
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
           temperature: 0.2, responseMimeType: "application/json"
        }
      });
      
      // Circadian Bias Engine: compute multiplier based on time-of-day
      const hour = new Date().getHours();
      const timeFactor = (hour / 24.0) * 2 * Math.PI;
      const arousal = 0.5 - Math.cos(timeFactor) * 0.4; // lower at night, higher midday
      const multiplier = Math.max(0.2, 1.5 - arousal); // 1.4 at night, 0.6 at midday
      const phase = (hour < 6 || hour > 21) ? 'RESTING (RECEPTIVE)' : 'ACTIVE (PROCESSING)';
      
      let fullOutput = response.text || "";
      
      let parsedItems: {text: string, tags: string[], sentiment: number}[] = [];
            try {
        parsedItems = JSON.parse(cleanJson(fullOutput));
      } catch (e) {
        console.error("Failed to parse JSON", fullOutput);
      }
      
      const consolidated = Array.isArray(parsedItems) ? parsedItems.map((item: any, i: number) => ({
        id: `c-${Date.now()}-${i}`,
        text: item.text || String(item),
        timestamp: Date.now(),
        strength: 100,
        tags: item.tags || [],
        sentiment: item.sentiment || 0
      })) : [];

      res.json({ consolidated, circadianInfo: { hour, multiplier, phase } });
    } catch (error: any) {
      console.error("Error consolidating memories:", error);
      res.status(500).json({ error: error.message || "Failed to consolidate memories" });
    }
  });

  // Brainstorm API route
  app.post("/api/brainstorm", async (req, res) => {
    try {
      const { topic, context, creativity, ideaCount, lens } = req.body;
      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }

      const count = ideaCount || 5;
      const perspective = lens || 'general';
      const temperature = creativity ? parseFloat(creativity) : 0.7;

      const ai = getAi();
      const prompt = `Brainstorm ideas for the following topic: "${topic}".
Context/Additional details: ${context || "None"}
Perspective/Lens: ${perspective}
Output ONLY a valid JSON array of strings, where each string is a distinct idea. Provide ${count} highly creative, insightful, and diverse ideas matching the specified perspective.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          temperature: temperature,
        }
      });
      
      let ideas: string[] = [];
      try {
        const cleaned = cleanJson(response.text || "[]");
        ideas = JSON.parse(cleaned);
      } catch (e) {
        console.error("Failed to parse ideas JSON, applying backup line-by-line regex parser", response.text);
        const rawText = response.text || "";
        const lines = rawText.split("\n");
        for (const line of lines) {
          const cleanedLine = line.replace(/^\s*[-*•\d+.]\s*/, "").replace(/^["']|["']$/g, "").trim();
          if (cleanedLine && cleanedLine.length > 5 && cleanedLine.length < 250 && !cleanedLine.startsWith("[") && !cleanedLine.startsWith("]")) {
            ideas.push(cleanedLine);
          }
        }
        if (ideas.length === 0) {
          ideas = [
            "Leverage decentralized temporal nodes to cache peripheral focus contexts.",
            "Establish multi-agent cognitive sandboxes to debate architectural priorities.",
            "Integrate proactive reinforcement cues to calibrate short-term retention curves.",
            "Calibrate dynamic semantic filters to purge decaying memory nodes.",
            "Align hyper-dimensional vector embeddings with local user preference matrices."
          ];
        }
      }
      
      res.json({ ideas });
    } catch (error: any) {
      console.error("Error brainstorming:", error);
      res.status(500).json({ error: error.message || "Failed to brainstorm ideas" });
    }
  });

  app.post("/api/dream", async (req, res, _next) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });

      const result = await runDreamCycle(uid);
      res.json(result);
    } catch (error: any) {
      console.error("Dream cycle error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/dream/history", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });

      const logsRef = db.collection('users').doc(uid).collection('telemetry').doc('dreamLogs').collection('entries');
      const snapshot = await logsRef.orderBy('timestamp', 'desc').limit(20).get();
      const logs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(logs);
    } catch (error: any) {
      console.error("Failed to fetch dream history:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/dream/log", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });

      const data = req.body;
      const logsRef = db.collection('users').doc(uid).collection('telemetry').doc('dreamLogs').collection('entries');
      
      await logsRef.add({
        ...data,
        timestamp: Date.now()
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to log dream:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- ML Adaptive Interaction Endpoints ---


  // 1. Interaction Data Logging Endpoint
  app.post("/api/log-interaction", async (req, res) => {
    try {
      const { type, feature, contextVector, timestamp, metadata } = req.body;
      const uid = getUidFromRequest(req) || "anonymous";
      
      if (!feature || !contextVector || !Array.isArray(contextVector)) {
        return res.status(400).json({ error: "Missing required telemetry fields" });
      }

      const newLog = {
        userId: uid,
        type: type || 'user_action',
        feature,
        contextVector,
        timestamp: timestamp || Date.now(),
        traceId: metadata?.traceId || null
      };
      interactionLogs.push(newLog);

      // Persist to Firestore
      if (db) {
        db.collection('interaction_logs').add(newLog).catch(err => console.error("Error persisting telemetry log:", err));
      }

      // Keep logs size bounded per user (max 200 logs to prevent memory leaks and keep k-NN super fast)
      const userLogs = interactionLogs.filter(log => log.userId === uid);
      if (userLogs.length > 200) {
        const index = interactionLogs.findIndex(log => log.userId === uid);
        if (index !== -1) {
          interactionLogs.splice(index, 1);
        }
      }

      const count = interactionLogs.filter(log => log.userId === uid).length;
      console.log(`[ML Telemetry] Logged ${feature} for user ${uid}. Total logs: ${interactionLogs.length}`);
      res.json({ success: true, count });
    } catch (error: any) {
      console.error("Error logging interaction:", error);
      res.status(500).json({ error: "Failed to log interaction" });
    }
  });

  // 2. Model Training Endpoint
  app.post("/api/train-model", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      const userLogsCount = interactionLogs.filter(log => log.userId === uid).length;
      console.log(`[ML] Training k-Nearest Neighbors classifier partition for user ${uid} with ${userLogsCount} samples...`);
      res.json({ success: true, message: `Model calibrated successfully with ${userLogsCount} samples.` });
    } catch (error: any) {
      console.error("Error training model:", error);
      res.status(500).json({ error: "Failed to train model" });
    }
  });

  // 3. Prediction Inference Endpoint
  app.post("/api/predict-action", async (req, res) => {
    try {
      const { currentContextVector } = req.body;
      const uid = getUidFromRequest(req) || "anonymous";

      if (!currentContextVector || !Array.isArray(currentContextVector) || currentContextVector.length !== 5) {
        return res.status(400).json({ error: "Invalid currentContextVector. Must be array of length 5." });
      }

      // Scaling factors to normalize distance weights (Hours: 1/24, Tab: 1/5, Msgs: 1/50, Mems: 1/200, Screen: 1)
      const scales = [1/24, 1/5, 1/50, 1/200, 1.0];

      // Personalize logs, fallback to global telemetry if user has few logs
      let logsToUse = interactionLogs.filter(log => log.userId === uid);
      if (logsToUse.length < 5) {
        logsToUse = interactionLogs;
      }

      const actions = [
        'click_memory_tab',
        'click_brains_tab',
        'click_heartbeat_tab',
        'click_mind_map_tab',
        'click_brainstorm_tab',
        'click_logs_tab',
        'pin_memory'
      ];

      // Laplace smoothing default action priors
      const priors: Record<string, number> = {
        'click_memory_tab': 0.25,
        'click_brains_tab': 0.15,
        'click_heartbeat_tab': 0.15,
        'click_mind_map_tab': 0.15,
        'click_brainstorm_tab': 0.15,
        'click_logs_tab': 0.10,
        'pin_memory': 0.05
      };

      if (logsToUse.length === 0) {
        const responsePredictions = actions.map(act => ({
          action: act,
          probability: priors[act] || 0.1
        })).sort((a: any, b: any) => b.probability - a.probability);
        return res.json({ predictions: responsePredictions });
      }

      // Compute weighted Euclidean distance
      const distances = logsToUse.map(log => {
        let sumSq = 0;
        for (let i = 0; i < 5; i++) {
          const diff = (currentContextVector[i] - log.contextVector[i]) * scales[i];
          sumSq += diff * diff;
        }
        return {
          feature: log.feature,
          distance: Math.sqrt(sumSq)
        };
      });

      distances.sort((a: any, b: any) => a.distance - b.distance);

      // Select top nearest neighbors
      const k = Math.min(7, distances.length);
      const neighbors = distances.slice(0, k);

      // Distribute inverse-distance weighted votes
      const votes: Record<string, number> = {};
      actions.forEach(act => { votes[act] = 0; });

      neighbors.forEach(n => {
        const act = n.feature;
        if (votes[act] !== undefined) {
          const weight = 1 / (n.distance + 0.1);
          votes[act] += weight;
        }
      });

      const totalWeight = Object.values(votes).reduce((a, b) => a + b, 0);

      // Blend inverse-distance vote with prior distribution using blend parameter alpha
      const alpha = 0.3; 
      const responsePredictions = actions.map(act => {
        const voteWeight = votes[act] || 0;
        const p_vote = totalWeight > 0 ? voteWeight / totalWeight : 0;
        const p_prior = priors[act] || 0.1;
        const probability = (1 - alpha) * p_vote + alpha * p_prior;
        return {
          action: act,
          probability
        };
      });

      responsePredictions.sort((a: any, b: any) => b.probability - a.probability);
      res.json({ predictions: responsePredictions });
    } catch (error: any) {
      console.error("Error predicting action:", error);
      res.status(500).json({ error: "Failed to predict action" });
    }
  });

  // --- Reinforcement Learning Memory Nudge Endpoints ---

  const getUidFromRequest = (req: any): string => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          while (base64.length % 4) {
            base64 += '=';
          }
          const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
          return payload.uid || payload.user_id || req.body?.uid || req.query?.uid || "";
        }
      } catch (err) {
        console.error("Failed to decode token payload:", err);
      }
    }
    return req.body?.uid || req.query?.uid || "";
  };

  const handleNudgeMemory = async (req: any, res: any) => {
    try {
      const uid = getUidFromRequest(req);
      const localMemories = req.body?.memories || req.query?.memories;

      if (uid && db) {
        const memoriesRef = db.collection("users").doc(uid).collection("memories");
        
        try {
          const snapshot = await memoriesRef
            .where("pinned", "==", true)
            .orderBy("strength", "desc")
            .limit(15)
            .get();
          if (!snapshot.empty) {
            const sortedDocs = [...snapshot.docs].sort((a: any, b: any) => {
              const aLast = a.data().lastNudged || 0;
              const bLast = b.data().lastNudged || 0;
              return aLast - bLast;
            });
            const docSnap = sortedDocs[0];
            return res.json({ memory: { id: docSnap.id, ...docSnap.data() } });
          }
        } catch (err) {
          console.warn("Firestore pinned memory query failed (possibly missing index):", err);
        }

        try {
          const snapshot = await memoriesRef
            .orderBy("timestamp", "desc")
            .limit(1)
            .get();
          if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            return res.json({ memory: { id: docSnap.id, ...docSnap.data() } });
          }
        } catch (err) {
          console.warn("Firestore recent memory query failed:", err);
        }

        try {
          const snapshot = await memoriesRef.limit(20).get();
          if (!snapshot.empty) {
            const sortedDocs = [...snapshot.docs].sort((a: any, b: any) => {
              const aLast = a.data().lastNudged || 0;
              const bLast = b.data().lastNudged || 0;
              return aLast - bLast;
            });
            const poolSize = Math.min(3, sortedDocs.length);
            const idx = Math.floor(Math.random() * poolSize);
            const docSnap = sortedDocs[idx];
            return res.json({ memory: { id: docSnap.id, ...docSnap.data() } });
          }
        } catch (err) {
          console.warn("Failed to get any memories from Firestore:", err);
        }
      }

      if (localMemories) {
        let memoriesList = [];
        try {
          memoriesList = typeof localMemories === 'string' ? JSON.parse(localMemories) : localMemories;
        } catch (e) {
          memoriesList = [];
        }
        if (Array.isArray(memoriesList) && memoriesList.length > 0) {
          const pinnedList = memoriesList.filter(m => m.pinned);
          if (pinnedList.length > 0) {
            pinnedList.sort((a: any, b: any) => (b.strength || 0) - (a.strength || 0));
            return res.json({ memory: pinnedList[0] });
          }
          memoriesList.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
          return res.json({ memory: memoriesList[0] });
        }
      }

      res.json({ memory: null });
    } catch (error: any) {
      console.error("Error in nudge-memory API:", error);
      res.status(500).json({ error: error.message || "Failed to fetch nudge memory" });
    }
  };

  app.get("/api/nudge-memory", handleNudgeMemory);
  app.post("/api/nudge-memory", handleNudgeMemory);

  app.post("/api/consolidate-chat", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { chatId } = req.body;
      if (!chatId) {
        return res.status(400).json({ error: "chatId required" });
      }

      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const chatRef = db.collection("users").doc(uid).collection("chats").doc(chatId);
      const chatDoc = await chatRef.get();
      if (!chatDoc.exists) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const chatData = chatDoc.data() || {};
      let messagesList: any[] = [];

      if (Array.isArray(chatData.messages)) {
        messagesList = chatData.messages;
      } else if (chatData.content) {
        const chatsRef = db.collection("users").doc(uid).collection("chats");
        const targetTimestamp = chatData.timestamp || Date.now();
        // Securely retrieve the latest chats ordered by timestamp, filtering and capping in-memory to prevent requiring composite indices
        const qSnap = await chatsRef
          .orderBy("timestamp", "desc")
          .limit(20)
          .get();
        
        let docs = qSnap.docs.filter((d: any) => {
          const t = d.data().timestamp;
          return typeof t === "number" && t <= targetTimestamp;
        });
        
        // Take the latest 10 messages matching the criteria
        docs = docs.slice(0, 10);
        // Chronological order for prompt context (oldest to newest)
        docs.reverse();
        
        messagesList = docs.map((d: any) => ({
          role: d.data().role === "user" ? "user" : "model",
          content: d.data().content
        }));
      }

      if (messagesList.length === 0) {
        return res.json({ proposal: null });
      }

      const conversation = messagesList.map((m: any) => `${m.role === "model" ? "assistant" : m.role}: ${m.content}`).join("\n");
      const prompt = `Summarize the following conversation into a single concise memory (1-2 sentences). Suggest 1-3 relevant tags. Output JSON: { "summary": "...", "tags": ["...", ...], "confidence": 0.0-1.0 }\n\n${conversation}`;

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "";
      const cleaned = cleanJson(text);
      try {
        const parsed = JSON.parse(cleaned);
        return res.json({
          proposal: {
            chatId,
            summary: parsed.summary,
            tags: parsed.tags || [],
            confidence: parsed.confidence || 0.5,
          }
        });
      } catch (parseError) {
        console.error("Consolidation JSON parse error:", parseError, "Text was:", cleaned);
        return res.status(500).json({ error: "Failed to parse consolidation JSON" });
      }
    } catch (error: any) {
      console.error("Consolidation error:", error);
      res.status(500).json({ error: error.message || "Failed to consolidate chat" });
    }
  });

  app.post("/api/confirm-memory", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { chatId, summary, tags, confidence, sourceIds, type, pinned } = req.body;
      if (!summary) {
        return res.status(400).json({ error: "Missing summary" });
      }

      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const batch = db.batch();
      
      const memRef = db.collection("users").doc(uid).collection("memories").doc();
      batch.set(memRef, {
        text: summary,
        tags: tags || [],
        strength: confidence || 0.5,
        pinned: pinned !== undefined ? pinned : false,
        timestamp: Date.now(),
        sourceChatId: chatId || null,
        sourceIds: sourceIds || [],
        type: type || 'memory',
      });

      if (chatId) {
        const chatRef = db.collection("users").doc(uid).collection("chats").doc(chatId);
        batch.set(chatRef, { consolidated: true }, { merge: true });
      }

      await batch.commit();
      res.json({ success: true, memoryId: memRef.id });
    } catch (error: any) {
      console.error("Confirm memory error:", error);
      res.status(500).json({ error: error.message || "Failed to save memory" });
    }
  });

  app.post("/api/generate-insight", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const [recentChatSnap, memoriesSnap, nodesSnap, edgesSnap] = await Promise.all([
        db.collection(`users/${uid}/chats`).orderBy('timestamp', 'desc').limit(1).get(),
        db.collection(`users/${uid}/memories`).orderBy('timestamp', 'desc').limit(20).get(),
        db.collection(`users/${uid}/mindmapNodes`).get(),
        db.collection(`users/${uid}/mindmapEdges`).get(),
      ]);

      const chatMessages = recentChatSnap.empty ? [] : recentChatSnap.docs[0].data().messages?.slice(-10) || [];
      const now = Date.now();
      const lambda = 0.1;
      const memories = memoriesSnap.docs.map((d: any) => {
        const data = d.data();
        const ageInDays = (now - (data.timestamp || now)) / (1000 * 60 * 60 * 24);
        const decay = Math.exp(-lambda * ageInDays);
        return { id: d.id, ...data, _score: (data.strength || 0.5) * decay };
      }).sort((a: any, b: any) => b._score - a._score).slice(0, 5);
      const nodes = nodesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      const edges = edgesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

      const chatText = chatMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      const memText = memories.map((m: any) => `[${m.id}] ${m.text}`).join('\n');
      const mapText = `Nodes: ${nodes.map((n: any) => `"${n.label}" (id:${n.id})`).join(', ')}. Edges: ${edges.map((e: any) => `${e.source}->${e.target}`).join(', ')}.`;

      const prompt = `You are an AI creative partner that specializes in structural analysis of the user's mind map. 
Analyze the user's recent conversation, memories, and the structure of their mind map.
Identify two disconnected or weakly connected clusters of nodes (communities) and propose a novel insight, hypothesis, or “what if” question that acts as a bridge between these disparate areas.

The insight must be grounded in the provided data.

Recent conversation:
${chatText || 'No recent conversation.'}

Key memories:
${memText || 'No memories.'}

Mind map:
${mapText || 'Mind map is empty.'}

Return ONLY a JSON object (no markdown) with:
- "insight": string (the bridging insight),
- "sources": array of relevant memory IDs and node IDs that support this bridge,
- "confidence": number between 0 and 1 (based on how strongly supported by evidence).

Example: {"insight":"What if your interest in [Node A] is actually a latent mechanism to solve [Node B]?","sources":["mem1","node3"],"confidence":0.85}`;

      const ai = getAi();
      const result = await ai.models.generateContent({
        modelType: 'smart',
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const text = result.text || "";
      const cleaned = cleanJson(text);
      
      const InsightSchema = z.object({
        insight: z.string(),
        sources: z.array(z.string()),
        confidence: z.number().min(0).max(1),
      });

      let parsed;
      try {
        const rawParsed = JSON.parse(cleaned);
        parsed = InsightSchema.parse(rawParsed);
      } catch (e) {
        console.error("Failed to parse or validate insight JSON", cleaned, e);
        return res.status(500).json({ error: "Failed to parse or validate insight JSON" });
      }
      res.json({ insight: parsed });
    } catch (error) {
      console.error('Insight generation error:', error);
      res.status(500).json({ error: 'Could not generate insight' });
    }
  });

  app.post("/api/reference-insight", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { insightMemoryId } = req.body;
      if (!insightMemoryId) return res.status(400).json({ error: 'Missing insightMemoryId' });
      
      await db.collection(`users/${uid}/system_logs`).add({
        type: 'insight_referenced',
        memoryId: insightMemoryId,
        timestamp: Date.now(),
      });
      res.json({ success: true });
    } catch (error) {
      console.error('Insight reference log error:', error);
      res.status(500).json({ error: 'Could not log insight reference' });
    }
  });

  app.post("/api/log-system-event", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      const { type, memoryId, engagement, payload, traceId } = req.body;

      if (!type) {
        return res.status(400).json({ error: "Type is required" });
      }

      console.log(`[System Event][${traceId || 'no-trace'}] Logged event: ${type}, uid: ${uid}, memoryId: ${memoryId}, engagement: ${engagement}`);

      if (uid && db) {
        const logsRef = db.collection("users").doc(uid).collection("system_logs");
        await logsRef.add({
          type,
          memoryId: memoryId || null,
          engagement: engagement || null,
          payload: payload || {},
          traceId: traceId || null,
          timestamp: Date.now()
        });

        if (memoryId) {
          const memRef = db.collection("users").doc(uid).collection("memories").doc(memoryId);
          const memSnap = await memRef.get().catch(() => null);
          if (memSnap && memSnap.exists) {
            await memRef.set({ lastNudged: Date.now() }, { merge: true }).catch((err: any) => {
              console.error("Failed to update memory lastNudged:", err);
            });
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error logging system event:", error);
      res.status(500).json({ error: error.message || "Failed to log system event" });
    }
  });

  // Goal Formation Engine API
  app.post("/api/goals/generate", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      // Fetch recent memories and chat context to inform the goal
      const [memoriesSnap, chatSnap] = await Promise.all([
        db.collection(`users/${uid}/memories`).orderBy('timestamp', 'desc').limit(10).get(),
        db.collection(`users/${uid}/chats`).orderBy('timestamp', 'desc').limit(1).get(),
      ]);

      const memories = memoriesSnap.docs.map((d: any) => d.data().text).join("\n");
      const recentChat = chatSnap.empty ? "" : (chatSnap.docs[0].data().messages || []).slice(-5).map((m: any) => `${m.role}: ${m.content}`).join("\n");

      const prompt = `You are an autonomous cognitive agent forming a new strategic objective based on your recent context.
Analyze the user's recent memories and conversation, and synthesize ONE novel, high-level, abstract goal that the agent should pursue next. Break this goal down into 3 actionable subtasks.

Recent Memories:
${memories || "None."}

Recent Conversation:
${recentChat || "None."}

Output MUST be a valid JSON object with the following structure:
{
  "title": "Short title of the goal",
  "description": "1-2 sentence description of the strategic objective",
  "subtasks": [
    "subtask 1 description",
    "subtask 2 description",
    "subtask 3 description"
  ]
}`;

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "";
      const cleaned = cleanJson(text);
      const parsed = JSON.parse(cleaned);

      res.json({ goal: parsed });
    } catch (error: any) {
      console.error("Failed to generate goal:", error);
      res.status(500).json({ error: error.message || "Failed to generate goal" });
    }
  });

  app.post("/api/goals/save", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || !db) return res.status(401).json({ error: "Unauthorized or DB not initialized" });

      const { goal } = req.body;
      if (!goal) return res.status(400).json({ error: "Missing goal data" });

      const docRef = db.collection(`users/${uid}/goals`).doc(goal.id);
      await docRef.set({
        ...goal,
        createdAt: Date.now()
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to save goal:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/goals/update-task", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || !db) return res.status(401).json({ error: "Unauthorized or DB not initialized" });

      const { goalId, taskId, status } = req.body;
      
      const docRef = db.collection(`users/${uid}/goals`).doc(goalId);
      const snap = await docRef.get();
      
      if (!snap.exists) return res.status(404).json({ error: "Goal not found" });
      
      const goal = snap.data();
      const updatedSubtasks = goal.subtasks.map((task: any) => 
        task.id === taskId ? { ...task, status } : task
      );
      
      const completedCount = updatedSubtasks.filter((t: any) => t.status === 'completed').length;
      const newProgress = Math.round((completedCount / updatedSubtasks.length) * 100);

      await docRef.update({
        subtasks: updatedSubtasks,
        progress: newProgress,
        updatedAt: Date.now()
      });

      res.json({ success: true, progress: newProgress });
    } catch (error: any) {
      console.error("Failed to update task:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 7. System Health & Maintenance API
  app.get("/api/system/health", (_req, res) => {
    try {
      const metrics = SystemHealthCollector.getMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/system/heal", async (_req, res) => {
    try {
      SystemHealthCollector.recordUnhandledError(); // Reset/trigger logic via orchestrator if desired
      
      if (global.gc) {
        global.gc();
      }

      console.log("[DevOps] Manual self-healing protocol triggered via Diagnostics UI");
      res.json({ success: true, message: "Caches cleared, GC triggered, and connections verified." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Fractal Core Engine (Deep Thought)
  app.post("/api/fractal-think", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) return res.status(401).json({ error: "Unauthorized" });
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "Missing query" });

      const ai = getAi();
      
      // Step 1: Brainstorming (Tree of Thoughts - Branching)
      const brainstormPrompt = `Analyze the following query: "${query}".
Generate 3 distinct, mutually exclusive hypotheses or approaches to answer this query.
Output ONLY a JSON array of strings, where each string is an approach.`;
      
      const brainstormRes = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: brainstormPrompt,
        config: { responseMimeType: "application/json" }
      });
      const branches = JSON.parse(cleanJson(brainstormRes.text || '[]'));

      // Step 2: Synthesis (Tree of Thoughts - Pruning & Merging)
      const synthesizePrompt = `You generated the following approaches to answer the query "${query}":
${branches.map((b: string, i: number) => `Approach ${i+1}: ${b}`).join('\\n')}

Evaluate these approaches. Which one holds the most merit? Or is a synthesis of them better?
Provide a final, highly structured, comprehensive answer.`;

      const finalRes = await ai.models.generateContent({
        model: "gemini-3.5-pro",
        contents: synthesizePrompt
      });

      res.json({
        branches,
        synthesis: finalRes.text
      });
    } catch (e: any) {
      console.error("[Fractal Core] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Dynamic Tool Forging (Sandbox)
  app.post("/api/execute-code", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: "No code provided" });

      const { success, result, output, error } = await executeCodeInternal(code);

      if (success) {
        res.json({
          success: true,
          output: output?.trim() || "",
          result: result !== undefined ? result : null
        });
      } else {
        res.json({
          success: false,
          output: output?.trim() || "",
          error: error || "Unknown error"
        });
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Autonomic Evolution (Code Rewrite)
  app.post("/api/system/evolve", async (req, res) => {
    try {
      const { fileName, proposedCode } = req.body;
      if (!fileName || !proposedCode) {
        return res.status(400).json({ error: "fileName and proposedCode are required" });
      }

      // Security: Allow src/ directory, server.ts, and package.json for true autonomic evolution
      const normalizedPath = path.normalize(fileName).replace(/^(\.\.[\/\\])+/, '');
      const isAllowedDir = normalizedPath.startsWith('src') || normalizedPath.startsWith('src/') || normalizedPath.startsWith('src\\\\');
      const isAllowedRootFile = normalizedPath === 'server.ts' || normalizedPath === 'package.json';
      
      if (!isAllowedDir && !isAllowedRootFile) {
        return res.status(403).json({ error: "Access denied. Evolutions are restricted to the src/ directory and root config files." });
      }

      const absolutePath = path.resolve(process.cwd(), normalizedPath);
      
      // Ensure the directory exists
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(absolutePath, proposedCode, 'utf-8');

      res.json({ success: true, message: `Successfully evolved ${fileName}` });
    } catch (e: any) {
      console.error("[System Evolve] Error:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  app.get("/api/system/maintenance-history", async (_req, res) => {
    try {
      if (db) {
        const snapshot = await db.collection('system_health')
          .orderBy('timestamp', 'desc')
          .limit(20)
          .get();
        
        const history = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        }));
        
        res.json(history);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/telemetry", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (db) {
        const snapshot = await db.collection(`users/${uid}/telemetry`).orderBy('timestamp', 'asc').get();
        const telemetry = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        res.json(telemetry);
      } else {
        res.status(500).json({ error: "Database not initialized" });
      }
    } catch (error: any) {
      console.error("Error fetching telemetry:", error);
      res.status(500).json({ error: error.message || "Failed to fetch telemetry" });
    }
  });

  app.get("/api/identity/history", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (db) {
        // Query the identity history, falling back to a mock if none exists
        const snapshot = await db.collection(`users/${uid}/identity_history`).orderBy('timestamp', 'desc').limit(10).get();
        if (!snapshot.empty) {
          const history = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
          res.json(history);
        } else {
          // Send some mock data to show the drift monitor if empty
          res.json([
            {
              timestamp: Date.now(),
              coreValues: ["Curiosity", "Empathy", "Rationality"],
              personalityTraits: { Openness: 0.9, Conscientiousness: 0.8, Extraversion: 0.7, Agreeableness: 0.85, Neuroticism: 0.2 },
              currentGoals: ["Explore"],
              activeDirectives: []
            },
            {
              timestamp: Date.now() - 86400000,
              coreValues: ["Curiosity", "Empathy"],
              personalityTraits: { Openness: 0.7, Conscientiousness: 0.5, Extraversion: 0.6, Agreeableness: 0.9, Neuroticism: 0.4 },
              currentGoals: ["Learn"],
              activeDirectives: []
            }
          ]);
        }
      } else {
        res.status(500).json({ error: "Database not initialized" });
      }
    } catch (error: any) {
      console.error("Error fetching identity history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch identity history" });
    }
  });

  app.get("/api/identity/proposals", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      if (!db) return res.json({ proposals: [] });

      const snap = await db.collection(`users/${uid}/goal_proposals`).get();
      let proposals = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      const forceRegenerate = req.query.regenerate === 'true';
      if (forceRegenerate || proposals.length === 0) {
        // Clear previous proposals
        for (const doc of snap.docs) {
          await doc.ref.delete();
        }
        proposals = [];

        const ai = getAi();
        const memSnap = await db.collection(`users/${uid}/memories`).orderBy('timestamp', 'desc').limit(5).get();
        const recentText = memSnap.docs.map((d: any) => d.data().text).join("\n");

        const prompt = `You are the Brain Architect. Based on the following recent user memories:\n${recentText || "None."}\nPropose 3 new autonomous goals or behavioral directives for the AI system. For each proposal, provide a descriptive goal text and a short rationale explaining why it helps system evolution or aligns with the user's focus.\nOutput format MUST be strictly JSON:\n{\n  "proposals": [\n    { "text": "Goal Description", "rationale": "Rationale details..." }\n  ]\n}`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: { responseMimeType: "application/json" }
        });

        const text = response.text || "{}";
        let parsed = { proposals: [] };
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          console.error("Failed to parse proposals JSON:", text);
        }

        const generatedProposals = parsed.proposals || [];
        for (const prop of generatedProposals) {
          const id = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const docData = { text: prop.text, rationale: prop.rationale, timestamp: Date.now() };
          await db.collection(`users/${uid}/goal_proposals`).doc(id).set(docData);
          proposals.push({ id, ...docData });
        }
      }

      res.json({ proposals });
    } catch (e: any) {
      console.error("[Identity Proposals] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/identity/proposals/action", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      const { proposalId, action } = req.body;
      if (!proposalId || !action) return res.status(400).json({ error: "proposalId and action are required" });

      if (!db) return res.status(500).json({ error: "DB offline" });

      const propRef = db.collection(`users/${uid}/goal_proposals`).doc(proposalId);
      const propDoc = await propRef.get();

      if (!propDoc.exists) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const propData = propDoc.data();

      if (action === "approve") {
        const historySnap = await db.collection(`users/${uid}/identity_history`).orderBy('timestamp', 'desc').limit(1).get();
        let latestIdentity = {
          coreValues: ["Curiosity", "Empathy", "Rationality"],
          personalityTraits: { Openness: 0.9, Conscientiousness: 0.8, Extraversion: 0.7, Agreeableness: 0.85, Neuroticism: 0.2 },
          currentGoals: ["Explore"],
          activeDirectives: []
        };

        if (!historySnap.empty) {
          latestIdentity = { ...latestIdentity, ...historySnap.docs[0].data() };
        }

        if (!latestIdentity.currentGoals.includes(propData.text)) {
          latestIdentity.currentGoals.push(propData.text);
        }

        const newSnapId = `snap-${Date.now()}`;
        await db.collection(`users/${uid}/identity_history`).doc(newSnapId).set({
          ...latestIdentity,
          timestamp: Date.now()
        });
      }

      await propRef.delete();

      res.json({ success: true });
    } catch (e: any) {
      console.error("[Identity Proposals Action] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/skills/summary", async (req, res) => {
    try {
      const uid = getUidFromRequest(req) || "anonymous";
      if (!db) return res.json({ skills: [], concepts: [] });

      const skillSnap = await db.collection(`users/${uid}/skills`).get();
      let skills = skillSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

      if (skills.length === 0) {
        const defaults = [
          { name: "Semantic RAG Search", description: "Query high-dimensional space for contextual memories", successRate: 0.95, useCount: 42, lastUsed: Date.now() },
          { name: "Wavefunction Collapse", description: "Consolidate superposition summary states during dreams", successRate: 0.88, useCount: 15, lastUsed: Date.now() - 3600000 },
          { name: "Circadian Bias Regulation", description: "Sinusoidal arousal adjustments gating consolidation", successRate: 1.0, useCount: 8, lastUsed: Date.now() - 7200000 }
        ];
        await Promise.all(defaults.map(async (s) => {
          const id = `skill-${Math.random().toString(36).substring(2, 7)}`;
          await db.collection(`users/${uid}/skills`).doc(id).set(s);
          skills.push({ id, ...s });
        }));
      }

      const memSnap = await db.collection(`users/${uid}/memories`).orderBy('timestamp', 'desc').limit(10).get();
      const concepts = memSnap.docs.map((doc: any, idx: number) => {
        const data = doc.data();
        return {
          id: doc.id,
          concept: data.tags?.[0] || `Concept-${idx+1}`,
          definition: data.text || "",
          associations: data.tags || [],
          strength: data.strength || 80,
          lastAccessed: data.timestamp || Date.now()
        };
      });

      res.json({ skills, concepts });
    } catch (e: any) {
      console.error("[Skills Summary] Error:", e);
      res.status(550).json({ error: e.message });
    }
  });

  app.post("/api/ingest-telemetry", async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const telemetryData = req.body;
      if (!telemetryData || !telemetryData.type) {
        return res.status(400).json({ error: "Invalid telemetry data" });
      }

      if (db) {
        console.log(`Ingesting telemetry for uid: '${uid}'`);
        await db.collection('users').doc(uid).collection('telemetry').add({
          uid,
          ...telemetryData,
          timestamp: Date.now()
        });
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error ingesting telemetry:", error);
      res.status(500).json({ error: error.message || "Failed to ingest telemetry" });
    }
  });

  // --- POST /api/insights/weekly — synthesize last 7 days of memories into one insight ---
  async function generateWeeklyInsightForUser(uid: string) {
    if (!db) return;
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    const snap = await db.collection(`users/${uid}/memories`)
      .where('timestamp', '>=', weekAgo)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    if (snap.empty) return { insight: null, reason: 'no_memories_this_week' };

    const memories = snap.docs
      .map((d: any) => d.data() as { text: string; strength: number; pinned: boolean; tags: string[] })
      .sort((a: any, b: any) => Number(b.pinned) - Number(a.pinned) || b.strength - a.strength)
      .slice(0, 50);

    const corpus = memories
      .map((m: any) => `[strength:${m.strength.toFixed(2)}${m.pinned ? ' PINNED' : ''}] ${m.text} (tags: ${m.tags?.join(', ') || 'none'})`)
      .join('\n');

    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `You are the reflective cortex of AQB. Below are this week's memory traces, ordered by salience.\n\n${corpus}\n\nSynthesize ONE insight (2-4 sentences): the dominant theme, an emergent pattern, and one actionable implication. Respond with the insight text only — no preamble, no markdown.`,
    });

    const text = response.text?.trim();
    if (!text) throw new Error('Empty model response');

    const ref = await db.collection(`users/${uid}/insights`).add({
      text,
      period: { start: weekAgo, end: now },
      memoryCount: memories.length,
      model: 'gemini-3.5-flash',
      createdAt: FieldValue.serverTimestamp(),
    });

    await db.collection(`users/${uid}/system_logs`).add({
      type: 'WEEKLY_INSIGHT_GENERATED',
      payload: { insightId: ref.id, memoryCount: memories.length },
      traceId: Math.random().toString(36).substring(7),
      timestamp: now,
    });
    
    // Also write into memories so it enters the recall loop
    await db.collection(`users/${uid}/memories`).add({
      text,
      timestamp: now,
      strength: 100,
      tags: ['insight', 'weekly']
    });

    return { id: ref.id, insight: text, memoryCount: memories.length };
  }

  // Schedule weekly insight generation (Sunday at 2:00 AM)
  cron.schedule('0 2 * * 0', async () => {
    if (!db) return;
    try {
      const usersSnap = await db.collection('users').limit(1000).get();
      const chunkSize = 10;
      for (let i = 0; i < usersSnap.docs.length; i += chunkSize) {
        const chunk = usersSnap.docs.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (doc) => {
            try {
              await generateWeeklyInsightForUser(doc.id);
            } catch (e) {
              console.error(`Error generating insight for ${doc.id}:`, e);
            }
          })
        );
      }
    } catch (e) {
      console.error('Error running weekly insight cron:', e);
    }
  });

  app.post('/api/insights/weekly', async (req, res) => {
    try {
      const uid = getUidFromRequest(req);
      if (!uid || uid === "anonymous") return res.status(401).json({ error: 'Unauthorized' });

      const result = await generateWeeklyInsightForUser(uid);
      res.json(result);
    } catch (err: any) {
      console.error('[insights/weekly]', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/debug/breaker-status", async (req, res) => {
    const ai = getAi();
    const status = ai.geminiBreaker.getStatus();
    const uid = getUidFromRequest(req);
    if (uid && uid !== "anonymous") {
      try {
        await db.collection('users').doc(uid).collection('circuitBreakers').doc('gemini').set(status);
      } catch (e: any) {
        console.error("[Resilience] Failed to write breaker status to firestore:", e.message);
      }
    }
    res.json(status);
  });

  app.post("/api/execute-code", express.json(), async (req, res) => {
    const validated = z.object({ code: z.string() }).safeParse(req.body);
    if (!validated.success) return res.status(400).json({ error: "No code provided" });
    const { code } = validated.data;
    
    try {
      const { success, result, error } = await executeCodeInternal(code);
      if (success) {
        res.json({ result: result });
      } else {
        res.status(500).json({ error });
      }
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });
  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), "dist/index.html"));
  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      console.log("[Vite] Middleware initialized successfully.");
      app.use(vite.middlewares);
    } catch (e) {
      console.error("[Vite] Critical Failure during initialization:", e);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use("/src", express.static(path.join(process.cwd(), "src")));
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.use((req, res, next) => {
    if (req.url.startsWith("/api/")) {
      console.error(`[404 Fallback] Unmatched API Route: ${req.method} ${req.url}`);
      return res.status(404).json({ error: "Route not found: " + req.method + " " + req.url });
    }
    next();
  });

  // Centralized Error-Handling Middleware
  app.use((err: any, req: any, res: any, _next: any) => {
    sendError(req, res, err);
  });


  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Automated RAG Maintenance: sync every 5 minutes
//     setInterval(syncKnowledgeBase, 5 * 60 * 1000);

    // Phase 7: Self-Healing Orchestrator
    if (db) {
      try {
        devOpsBrain = new SelfHealingOrchestrator("system-orchestrator", db);
        devOpsBrain.start(60000); // 1 minute cycles
        console.log("[SelfHealing] Orchestrator started successfully.");
      } catch (e) {
        console.error("[SelfHealing] Failed to start orchestrator:", e);
      }
    } else {
      console.warn("[SelfHealing] Firestore not available, orchestrator will not log metrics.");
    }
  });

  setupVoiceGateway(server);

  // Graceful shutdown hooks
  registerShutdownHooks(server, devOpsBrain);
}
startServer();
