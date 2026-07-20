/**
 * Knowledge base document interface
 */
interface KnowledgeDocument {
  id: string;
  text: string;
  embedding: number[];
}

let knowledgeBase: KnowledgeDocument[] = [];

/**
 * Calculate cosine similarity between two vectors
 * Measures the angular distance between vectors in high-dimensional space
 * @param vecA - First vector
 * @param vecB - Second vector
 * @returns Cosine similarity score (-1 to 1, where 1 is identical)
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length === 0 || vecB.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i]! * vecB[i]!;
    normA += vecA[i]! * vecA[i]!;
    normB += vecB[i]! * vecB[i]!;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dotProduct / denominator;
}

export { KnowledgeDocument, knowledgeBase, cosineSimilarity };
