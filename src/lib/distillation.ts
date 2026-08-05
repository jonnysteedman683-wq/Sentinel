import { dbShim as db } from "./firestore-shim.js";
import { Timestamp } from "firebase/firestore";
import { MemoryNode, WisdomNode } from "../types.js";
import { sphericalKMeans } from "./clustering.js";
import { callGeminiGenerate } from "./ai-service.js";
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { randomUUID } from "crypto";

const tracer = trace.getTracer('arcane-brain');

export async function runQuantumDistillation(userId: string): Promise<{ clustersFound: number, wisdomExtracted: number }> {
  const span = tracer.startSpan('runQuantumDistillation');
  try {
    const memRef = db.collection(`users/${userId}/memories`);
    const snap = await memRef.where('state', 'in', ['shortTerm', 'ephemeral']).get();
    
    const memories = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as MemoryNode));
    if (memories.length < 3) {
      span.setStatus({ code: SpanStatusCode.OK });
      span.end();
      return { clustersFound: 0, wisdomExtracted: 0 };
    }

    const vectors = memories.map((m: MemoryNode) => m.embedding || []);
    // Ensure all vectors have the same dimension and are not empty
    if (vectors.some((v: number[]) => v.length === 0 || v.length !== vectors[0].length)) {
      span.setStatus({ code: SpanStatusCode.OK, message: 'Invalid embeddings' });
      span.end();
      return { clustersFound: 0, wisdomExtracted: 0 };
    }

    // Aim for clusters of ~4 memories
    const k = Math.max(1, Math.floor(memories.length / 4));
    const assignments = sphericalKMeans(vectors, k);

    const clusters: Record<number, MemoryNode[]> = {};
    for (let i = 0; i < assignments.length; i++) {
      const c = assignments[i];
      if (!clusters[c]) clusters[c] = [];
      clusters[c].push(memories[i]);
    }

    let wisdomExtracted = 0;
    const wisdomRef = db.collection(`users/${userId}/wisdom`);

    // Process each cluster
    for (const [_clusterId, clusterMems] of Object.entries(clusters)) {
      if (clusterMems.length >= 3) {
        // Synthesize wisdom
        const contextLines = clusterMems.map(m => `- ${m.content}`).join('\n');
        const prompt = `You are the Arcane Quantum Brain's memory distillation engine.
Given the following episodic memories that share semantic proximity, extract a single, profound, high-level structural insight or principle (max 2 sentences).
Exclude introductory phrases. Just return the pure insight.

Memories:
${contextLines}`;

        const geminiRes = await callGeminiGenerate(prompt, 'gemini-1.5-flash');
        const insight = (geminiRes as any)?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Emergent pattern detected in episodic sequence.";

        const newWisdom: WisdomNode = {
          id: `wisdom-${randomUUID()}`,
          insight,
          sourceMemoryIds: clusterMems.map(m => m.id),
          strength: 1.0,
          createdAt: Timestamp.now(),
          lastAccessed: Timestamp.now(),
          userId
        };

        const batch = db.batch();
        batch.set(wisdomRef.doc(newWisdom.id), newWisdom);

        for (const m of clusterMems) {
          batch.update(memRef.doc(m.id), { state: 'transformed' });
        }

        await batch.commit();
        wisdomExtracted++;
      }
    }

    const clustersFound = Object.keys(clusters).length;
    span.setStatus({ code: SpanStatusCode.OK });
    return { clustersFound, wisdomExtracted };
  } catch (error: any) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}
