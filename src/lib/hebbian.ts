import { Timestamp } from "firebase/firestore";
import { dbShim as db } from "./firestore-shim.js";
import { callGeminiGenerate } from './ai-service.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { publishEvent } from './events.js';
import { MemoryNode } from '../types.js';
import { randomUUID } from 'crypto';

const tracer = trace.getTracer('arcane-brain');

export interface HebbianEdge {
  id: string;
  source: string;
  target: string;
  trace: number;
  lastCoaccess: number;
}

export async function updateHebbianTraces(userId: string, vad?: { v: number, a: number, d: number }) {
  const span = tracer.startSpan('updateHebbianTraces');
  try {
    
    const eventsRef = db.collection(`users/${userId}/systemHealth/eventLog`);
    
    // Fetch recent memory reinforcements
    // In a real implementation we might keep track of the last processed timestamp
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const snapshot = await eventsRef
      .where('eventType', '==', 'MEMORY_REINFORCED')
      .where('timestamp', '>=', oneDayAgo)
      .orderBy('timestamp', 'asc')
      .get();
      
    const events = snapshot.docs.map((d: any) => d.data());
    
    // Find co-accesses (accessed within 5 minutes of each other)
    const COACCESS_WINDOW = 5 * 60 * 1000;
    
    const edgeUpdates: Record<string, { source: string, target: string, increment: number, lastTime: number }> = {};
    
    // Affective Modulatory gain: High arousal increases synaptic reinforcement rate (LTP scaling)
    const affectiveGain = vad ? (1.0 + Math.max(-0.5, Math.min(1.0, vad.a * 0.7))) : 1.0;
    const baseIncrement = 0.1 * affectiveGain;
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const e1 = events[i];
        const e2 = events[j];
        
        if (e2.timestamp - e1.timestamp > COACCESS_WINDOW) break;
        
        const m1 = e1.payload.memoryId;
        const m2 = e2.payload.memoryId;
        
        if (m1 && m2 && m1 !== m2) {
          const id = m1 < m2 ? `${m1}_${m2}` : `${m2}_${m1}`;
          if (!edgeUpdates[id]) {
            edgeUpdates[id] = {
              source: m1 < m2 ? m1 : m2,
              target: m1 < m2 ? m2 : m1,
              increment: 0,
              lastTime: 0
            };
          }
          edgeUpdates[id].increment += baseIncrement;
          edgeUpdates[id].lastTime = Math.max(edgeUpdates[id].lastTime, e2.timestamp);
        }
      }
    }
    
    const batch = db.batch();
    const edgesRef = db.collection(`users/${userId}/hebbianEdges`);
    
    let updatedCount = 0;
    for (const [id, update] of Object.entries(edgeUpdates)) {
      const edgeRef = edgesRef.doc(id);
      const edgeSnap = await edgeRef.get();
      
      if (edgeSnap.exists) {
        const currentTrace = edgeSnap.data()?.trace || 0;
        batch.set(edgeRef, {
          trace: Math.min(1.0, currentTrace + update.increment),
          lastCoaccess: update.lastTime
        }, { merge: true });
      } else {
        batch.set(edgeRef, {
          id,
          source: update.source,
          target: update.target,
          trace: Math.min(1.0, update.increment),
          lastCoaccess: update.lastTime
        });
      }
      updatedCount++;
    }
    
    if (updatedCount > 0) {
      await batch.commit();
      await publishEvent(userId, 'hebbian', 'HEBBIAN_TRACES_UPDATED', { updatedCount });
    }
    
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

export async function pruneWeakEdges(userId: string, threshold: number = 0.1) {
  const span = tracer.startSpan('pruneWeakEdges');
  try {
    
    const edgesRef = db.collection(`users/${userId}/hebbianEdges`);
    
    // Apply decay to all edges based on time since lastCoaccess
    const snapshot = await edgesRef.get();
    const now = Date.now();
    const batch = db.batch();
    let prunedCount = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const edge = doc.data() as HebbianEdge;
      const hoursSince = (now - edge.lastCoaccess) / (1000 * 60 * 60);
      const decay = Math.exp(-0.02 * hoursSince); // Decay rate
      const newTrace = edge.trace * decay;
      
      if (newTrace < threshold) {
        batch.delete(doc.ref);
        prunedCount++;
      } else {
        batch.set(doc.ref, { trace: newTrace }, { merge: true });
      }
    });
    
    await batch.commit();
    if (prunedCount > 0) {
      await publishEvent(userId, 'hebbian', 'WEAK_EDGES_PRUNED', { prunedCount, threshold });
    }
    
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export async function neurogenesisPhase(userId: string, vad: { v: number, a: number, d: number }) {
  const span = tracer.startSpan('neurogenesisPhase');
  try {
    
    const memRef = db.collection(`users/${userId}/memories`);
    const edgesRef = db.collection(`users/${userId}/hebbianEdges`);
    
    // Only core or longTerm memories
    const activeSnap = await memRef.where('state', 'in', ['core', 'longTerm']).get();
    const memories = activeSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MemoryNode));
    
    if (memories.length < 2) {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return;
    }
    
    const edgesSnap = await edgesRef.get();
    const edges = edgesSnap.docs.map((d: any) => d.data() as HebbianEdge);
    const linkedPairs = new Set(edges.map((e: any) => e.source < e.target ? `${e.source}_${e.target}` : `${e.target}_${e.source}`));
    
    // Modulation by VAD
    // Higher arousal -> lower similarity threshold needed for bridge (more connections)
    // Higher valence -> slightly more connections
    const baseThreshold = 0.85;
    const threshold = baseThreshold - (vad.a * 0.1) - (vad.v * 0.05); 
    
    let bridgesCreated = 0;
    
    // O(N^2) for unlinked high-similarity nodes
    // Find unlinked clusters/nodes
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const m1 = memories[i];
        const m2 = memories[j];
        
        const pairId = m1.id < m2.id ? `${m1.id}_${m2.id}` : `${m2.id}_${m1.id}`;
        
        if (!linkedPairs.has(pairId)) {
          // Check similarity
          const sim = cosineSimilarity(m1.embedding, m2.embedding);
          
          if (sim > threshold) {
            // Generate Bridge
            const prompt = `Synthesize a bridging conceptual insight connecting these two ideas (max 1 sentence):\nIdea 1: ${m1.content}\nIdea 2: ${m2.content}`;
            const insightResponse = await callGeminiGenerate(prompt, 'gemini-3.5-flash');
            const insight = (insightResponse as any)?.candidates?.[0]?.content?.parts?.[0]?.text || `A conceptual bridge between idea 1 and idea 2.`;
            
            const bridgeId = `bridge-${randomUUID()}`;
            
            // Create Bridge Node (MemoryNode with state shortTerm)
            const bridgeNode: MemoryNode = {
              id: bridgeId,
              content: insight.trim(),
              summary: 'Neurogenesis Bridge',
              embedding: m1.embedding.map((val: any, idx: number) => (val + m2.embedding[idx]) / 2), // Midpoint embedding
              tags: ['bridge', 'neurogenesis'],
              strength: 0.8,
              state: 'shortTerm',
              createdAt: Timestamp.now(),
              lastAccessed: Timestamp.now(),
              accessCount: 0,
              decayRate: 0.005,
              linkedMemories: [m1.id, m2.id],
              userId
            };
            
            await memRef.doc(bridgeId).set(bridgeNode);
            
            // Create links
            const edge1Id = bridgeId < m1.id ? `${bridgeId}_${m1.id}` : `${m1.id}_${bridgeId}`;
            const edge2Id = bridgeId < m2.id ? `${bridgeId}_${m2.id}` : `${m2.id}_${bridgeId}`;
            
            await edgesRef.doc(edge1Id).set({ id: edge1Id, source: bridgeId, target: m1.id, trace: 0.5, lastCoaccess: Date.now() });
            await edgesRef.doc(edge2Id).set({ id: edge2Id, source: bridgeId, target: m2.id, trace: 0.5, lastCoaccess: Date.now() });
            
            linkedPairs.add(pairId); // Prevent duplicate bridge for this pair
            bridgesCreated++;
            
            await publishEvent(userId, 'hebbian', 'NEUROGENESIS_BRIDGE_CREATED', { bridgeId, sourceA: m1.id, sourceB: m2.id, similarity: sim, vadThreshold: threshold });
            
            if (bridgesCreated >= 3) {
                break; // Limit neurogenesis per cycle
            }
          }
        }
      }
      if (bridgesCreated >= 3) break;
    }
    
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}
