import { Timestamp } from "firebase/firestore";
import { dbShim as db } from "./firestore-shim.js";
import { callGeminiGenerate } from './ai-service.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { publishEvent } from './events.js';
import { MemoryNode } from '../types.js';
import { randomUUID } from 'crypto';
import { syncFederatedSynapses } from './crdt-federation-service.js';
import { SynapticPayload, CRDTSynapse } from './crdt-synapse.js';

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
    
    const eventsRef = db.collection(`users/${userId}/eventLog`);
    
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
    
    const payloads: SynapticPayload[] = Object.values(edgeUpdates).map(u => ({
      source: u.source,
      target: u.target,
      weightAdds: { 'server-node': u.increment },
      weightSubs: {},
      lastCoaccess: u.lastTime
    }));
    
    if (payloads.length > 0) {
      await syncFederatedSynapses(userId, 'server-node', payloads);
      await publishEvent(userId, 'hebbian', 'HEBBIAN_TRACES_UPDATED', { updatedCount: payloads.length });
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
    
    const edgesRef = db.collection(`users/${userId}/federatedSynapses`);
    
    // Apply decay to all edges based on time since lastCoaccess
    const snapshot = await edgesRef.get();
    const now = Date.now();
    const batch = db.batch();
    let prunedCount = 0;
    
    snapshot.docs.forEach((doc: any) => {
      const payload = doc.data() as SynapticPayload;
      const crdt = new CRDTSynapse('server-node', [payload]);
      const currentTrace = crdt.getWeight(payload.source, payload.target);
      
      const hoursSince = (now - payload.lastCoaccess) / (1000 * 60 * 60);
      const decay = Math.exp(-0.02 * hoursSince); // Decay rate
      const newTrace = currentTrace * decay;
      
      if (newTrace < threshold) {
        batch.delete(doc.ref);
        prunedCount++;
      } else {
        // Logically we apply a subtractive weight to reflect decay
        const diff = currentTrace - newTrace;
        crdt.updateWeight(payload.source, payload.target, -diff, now);
        const updatedPayload = crdt.exportState()[0];
        batch.set(doc.ref, updatedPayload, { merge: true });
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
    const edgesRef = db.collection(`users/${userId}/federatedSynapses`);
    
    // Only core or longTerm memories
    const activeSnap = await memRef.where('state', 'in', ['core', 'longTerm']).get();
    const memories = activeSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MemoryNode));
    
    if (memories.length < 2) {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return;
    }
    
    const edgesSnap = await edgesRef.get();
    const edges = edgesSnap.docs.map((d: any) => d.data() as SynapticPayload);
    const crdtHelper = new CRDTSynapse('server-node');
    const linkedPairs = new Set(edges.map((e: any) => crdtHelper.edgeId(e.source, e.target)));
    
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
            const insightResponse = await callGeminiGenerate(prompt, 'gemini-1.5-flash');
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
            
            // Create links via CRDT
            const nowTime = Date.now();
            const bridgePayload1 = {
              source: bridgeId,
              target: m1.id,
              weightAdds: { 'server-node': 0.5 },
              weightSubs: {},
              lastCoaccess: nowTime
            };
            const bridgePayload2 = {
              source: bridgeId,
              target: m2.id,
              weightAdds: { 'server-node': 0.5 },
              weightSubs: {},
              lastCoaccess: nowTime
            };
            
            await syncFederatedSynapses(userId, 'server-node', [bridgePayload1, bridgePayload2]);
            
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
