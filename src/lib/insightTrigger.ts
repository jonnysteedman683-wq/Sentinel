import { Timestamp } from "firebase/firestore";
import { dbShim as db } from "./firestore-shim.js";
import { callGeminiGenerate } from './ai-service.js';
import { MemoryNode } from '../types.js';
import { publishEvent } from './events.js';

export async function triggerInsightFromAnomaly(userId: string, cycleId: string, recentThoughts: string[]) {
  try {
    
    const prompt = `You are the subconscious pattern recognizer. The cognitive stream has experienced an anomaly indicating a shift in thought patterns. 
Given these recent thoughts:
${recentThoughts.join('\n')}

Generate a single, profound, non-obvious insight connecting these themes. Keep it to one sentence.`;
    
    const insightResponse = await callGeminiGenerate(prompt, 'gemini-3.5-flash');
    const insightText = (insightResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text || "A sudden shift in thought reveals a hidden connection between previously distinct ideas.";
    
    // Store as an ephemeral memory with high initial strength
    const memoryId = `insight-${crypto.randomUUID()}`;
    const mem: MemoryNode = {
      id: memoryId,
      content: insightText.trim(),
      summary: 'LSM Anomaly Insight',
      embedding: [], // could generate
      tags: ['insight', 'anomaly-driven'],
      strength: 0.9,
      state: 'ephemeral',
      createdAt: Timestamp.now(),
      lastAccessed: Timestamp.now(),
      accessCount: 1,
      decayRate: 0.05,
      linkedMemories: [],
      userId
    };
    
    await db.doc(`users/${userId}/memories/${memoryId}`).set(mem);
    await publishEvent(userId, 'insight', 'INSIGHT_GENERATED_FROM_ANOMALY', { cycleId, memoryId, text: insightText });
    
  } catch (err) {
    console.error("Failed to trigger insight from anomaly", err);
  }
}
