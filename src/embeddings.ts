// Singleton worker instance for embeddings
let workerInstance: Worker | null = null;
let currentMessageId = 0;
const pendingResolvers = new Map<number, (arr: number[]) => void>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('./workers/embedding.worker.ts', import.meta.url), { type: 'module' });
    workerInstance.onmessage = (ev) => {
      const { id, embedding } = ev.data;
      const resolve = pendingResolvers.get(id);
      if (resolve) {
        resolve(embedding as number[]);
        pendingResolvers.delete(id);
      }
    };
  }
  return workerInstance;
}

/**
 * Generates a vector embedding for the given text using local Xenova transformer.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    return new Promise((resolve) => {
      const w = getWorker();
      const id = ++currentMessageId;
      pendingResolvers.set(id, resolve);
      w.postMessage({ id, text });
    });
  } catch (error) {
    console.error("Embedding generation failed, returning empty vector:", error);
    return [];
  }
}

/**
 * Calculates the cosine similarity between two vectors.
 * Returns a value between -1 and 1. 1 indicates identical direction.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA?.length || !vecB?.length || vecA.length !== vecB.length) {
    return 0; // Graceful fallback for mismatched or empty embeddings
  }
  
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

/**
 * Utility to rank a list of items by their vector similarity to a query vector.
 */
export function rankBySimilarity<T extends { embedding?: number[] }>(
  queryEmbedding: number[],
  items: T[],
  topK: number = 5
): Array<{ item: T; score: number }> {
  if (!queryEmbedding || queryEmbedding.length === 0) {
    return items.slice(0, topK).map(item => ({ item, score: 0 }));
  }

  const scoredItems = items.map(item => ({
    item,
    score: item.embedding ? cosineSimilarity(queryEmbedding, item.embedding) : 0
  }));

  // Sort descending (highest similarity first)
  return scoredItems
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
