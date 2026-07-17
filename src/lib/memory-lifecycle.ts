import { Timestamp } from "firebase/firestore";
import { dbShim as db } from "./firestore-shim.js";
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { publishEvent } from './events.js';
import { MemoryNode, WisdomNode } from '../types.js';
import { callGeminiGenerate } from './ai-service.js';
// import { RollingStats } from './rollingStats.js';

const tracer = trace.getTracer('arcane-brain');

// ========== Decay & Reinforcement ==========

export function computeDecayedStrength(memory: MemoryNode, now: Date, vad?: { v: number; arousal?: number; a?: number; d?: number }): number {
  const hoursSince = (now.getTime() - memory.lastAccessed.toDate().getTime()) / (1000 * 60 * 60);
  const accessBoost = 1 + memory.accessCount * 0.1;
  let lambda =
    memory.state === 'ephemeral' ? 0.01 :
    memory.state === 'shortTerm' ? 0.005 :
    memory.state === 'longTerm' ? 0.001 :
    memory.state === 'core' ? 0.0001 : 0.00001; // wisdom

  // Dynamic Decay (Option A): Modulate decay rate dynamically based on user's emotional state
  if (vad) {
    const arousal = typeof vad.a === 'number' ? vad.a : (typeof (vad as any).arousal === 'number' ? (vad as any).arousal : 0);
    const valence = typeof vad.v === 'number' ? vad.v : 0;
    // High arousal (excitement, intense focus) or positive valence protects memories from decaying
    const stabilityFactor = 1.0 + (arousal * 0.4) + (valence * 0.15);
    const safeFactor = Math.max(0.3, Math.min(3.0, stabilityFactor));
    lambda = lambda / safeFactor;
  }

  return memory.strength * Math.exp(-lambda * hoursSince / accessBoost);
}

export function applyDecay(memory: MemoryNode, vad?: { v: number; a: number; d: number }): MemoryNode {
  const newStrength = computeDecayedStrength(memory, new Date(), vad);
  return { ...memory, strength: Math.max(0, newStrength) };
}

export function reinforceMemory(memory: MemoryNode, boost = 0.1): MemoryNode {
  return {
    ...memory,
    strength: Math.min(1, memory.strength + boost),
    lastAccessed: Timestamp.now(),
    accessCount: memory.accessCount + 1,
  };
}

// ========== State Transitions ==========

export function getStateTransition(memory: MemoryNode): MemoryNode {
  if (memory.state === 'forgotten' || memory.state === 'transformed') return memory;
  const strength = memory.strength;

  if (memory.state === 'ephemeral' && strength > 0.6) {
    return { ...memory, state: 'shortTerm' };
  }
  if (memory.state === 'shortTerm' && strength > 0.8) {
    return { ...memory, state: 'longTerm' };
  }
  if (memory.state === 'longTerm' && strength > 0.95) {
    return { ...memory, state: 'core' };
  }

  // decay thresholds (falling)
  if (memory.state === 'ephemeral' && strength < 0.05) {
    return { ...memory, state: 'forgotten' };
  }
  if (memory.state === 'shortTerm' && strength < 0.1) {
    return { ...memory, state: 'forgotten' };
  }
  if (memory.state === 'longTerm' && strength < 0.2) {
    return { ...memory, state: 'forgotten' };
  }
  if (memory.state === 'core' && strength < 0.3) {
    return { ...memory, state: 'forgotten' };
  }
  if (memory.state === 'wisdom' && strength < 0.5) {
    return { ...memory, state: 'forgotten' };
  }

  return memory;
}

// ========== Wisdom Generation ==========

export async function generateWisdomFromCluster(
  userId: string,
  parentMemories: MemoryNode[]
): Promise<WisdomNode | null> {
  const span = tracer.startSpan('generateWisdomFromCluster');
  try {
    if (parentMemories.length < 3) return null;

    const contents = parentMemories.map(m => m.content).join('\n---\n');
    const prompt = `
You are a cognitive architect. Given these related memories, extract a single, profound insight (max 1 sentence) that captures their shared essence.
Memories:
${contents}
`;
    const insight = await callGeminiGenerate(prompt, 'gemini-3.5-flash');
    const wisdom: WisdomNode = {
      id: `wisdom-${crypto.randomUUID()}`,
      insight: insight.trim(),
      sourceMemoryIds: parentMemories.map(m => m.id),
      strength: 0.9,
      createdAt: Timestamp.now(),
      lastAccessed: Timestamp.now(),
      userId,
    };
    span.setStatus({ code: SpanStatusCode.OK });
    return wisdom;
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
    return null;
  } finally {
    span.end();
  }
}

// ========== Maintenance ==========

export async function runMaintenance(userId: string) {
  const span = tracer.startSpan('Run Memory Maintenance');
  try {
    await purgeOldForgottenMemories(userId);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

export async function purgeOldForgottenMemories(userId: string) {
  
  const archiveRef = db.collection(`users/${userId}/memoriesArchive`);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const snapshot = await archiveRef.where('lastAccessed', '<', Timestamp.fromDate(thirtyDaysAgo)).get();
  
  if (snapshot.empty) return;
  
  const batch = db.batch();
  snapshot.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}

// ========== Main Lifecycle Phase (called from DreamEngine) ==========

export async function memoryLifecyclePhase(userId: string) {
  const span = tracer.startSpan('Memory Lifecycle Phase');
  try {
    
    const memRef = db.collection(`users/${userId}/memories`);
    const archiveRef = db.collection(`users/${userId}/memoriesArchive`);
    const wisdomRef = db.collection(`users/${userId}/wisdom`);

    // Fetch the latest emotional state (VAD) to dynamically modulate decay (Option A)
    let currentVAD = { v: 0, a: 0, d: 0 };
    try {
      const emotionSnapshots = await db.collection(`users/${userId}/emotionHistory`).orderBy('timestamp', 'desc').limit(1).get();
      if (!emotionSnapshots.empty) {
        currentVAD = emotionSnapshots.docs[0].data().vad || currentVAD;
      }
    } catch (err) {
      console.warn("[MemoryLifecycle] Failed to fetch latest emotion snapshot for dynamic decay modulation:", err);
    }

    // 1. Fetch all active memories
    const activeSnap = await memRef.where('state', 'not-in', ['forgotten', 'transformed']).get();
    const memories: MemoryNode[] = activeSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MemoryNode));
    
    const batch = db.batch();
    let decayedCount = 0;
    let forgottenCount = 0;
    let reinforcedCount = 0;
    let wisdomCreated = 0;

    // 2. Apply decay and check transitions
    for (const mem of memories) {
      let updated = applyDecay(mem, currentVAD);
      updated = getStateTransition(updated);

      if (updated.state === 'forgotten') {
        // Archive and delete
        batch.set(archiveRef.doc(mem.id), updated);
        batch.delete(memRef.doc(mem.id));
        forgottenCount++;
        await publishEvent(userId, 'memory', 'MEMORY_FORGOTTEN', { memoryId: mem.id });
      } else {
        // Update if changed
        if (updated.strength !== mem.strength || updated.state !== mem.state) {
          batch.set(memRef.doc(mem.id), updated, { merge: true });
          decayedCount++;
          if (updated.strength > mem.strength) reinforcedCount++;
          if (updated.state !== mem.state) {
            await publishEvent(userId, 'memory', 'MEMORY_STATE_CHANGED', {
              memoryId: mem.id, oldState: mem.state, newState: updated.state,
            });
          }
        }
      }
    }

    // 3. Wisdom Mining: cluster core memories (simple cosine similarity)
    const coreMemories = memories.filter(m => m.state === 'core');
    if (coreMemories.length >= 3) {
      // Hierarchical clustering based on embedding similarity
      const clusters = clusterMemories(coreMemories, 0.85);
      for (const cluster of clusters) {
        if (cluster.length >= 3) {
          const wisdom = await generateWisdomFromCluster(userId, cluster);
          if (wisdom) {
            batch.set(wisdomRef.doc(wisdom.id), wisdom);
            // Mark parent memories as transformed
            for (const parent of cluster) {
              batch.set(memRef.doc(parent.id), { state: 'transformed', parentWisdom: wisdom.id }, { merge: true });
              await publishEvent(userId, 'memory', 'MEMORY_TRANSFORMED', { memoryId: parent.id, wisdomId: wisdom.id });
            }
            wisdomCreated++;
            await publishEvent(userId, 'memory', 'WISDOM_CREATED', { wisdomId: wisdom.id });
          }
        }
      }
    }

    await batch.commit();

    span.setAttribute('decayed', decayedCount);
    span.setAttribute('forgotten', forgottenCount);
    span.setAttribute('reinforced', reinforcedCount);
    span.setAttribute('wisdomCreated', wisdomCreated);
    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    span.recordException(err);
  } finally {
    span.end();
  }
}

// Simple clustering helper (average linkage)
function clusterMemories(memories: MemoryNode[], threshold: number): MemoryNode[][] {
  const clusters: MemoryNode[][] = [];
  const visited = new Set<string>();
  for (const mem of memories) {
    if (visited.has(mem.id)) continue;
    const cluster: MemoryNode[] = [mem];
    visited.add(mem.id);
    for (const other of memories) {
      if (visited.has(other.id)) continue;
      if (cosineSimilarity(mem.embedding, other.embedding) >= threshold) {
        cluster.push(other);
        visited.add(other.id);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
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
